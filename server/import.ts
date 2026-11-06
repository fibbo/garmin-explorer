// Imports a Garmin Connect data export into data/.
//
// Usage: npm run import -- /path/to/garmin-export [--out data]
//
// Reads the activity summaries and the uploaded .fit files, matches recordings
// to activities by start time and duration, and writes:
//   data/index.json     summaries of all activities
//   data/fit/<id>.fit   the original recording of each activity, decoded by the page when opened
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { unzipSync } from "fflate";
import { recordingMismatch, type Summary } from "../src/data-format.ts";
import { DATA_DIR, round, saveFit, UserError, writeIndex } from "./data-dir.ts";
import { scanFit } from "./fit-scan.ts";

/** A recording belongs to an activity that starts at most this far from it */
const MATCH_WINDOW_MS = 120_000;

/** One activity in the export's *summarizedActivities.json. Only the fields we read. */
type ExportActivity = Record<string, unknown> & { activityId: number };

const num = (v: unknown) => (typeof v === "number" ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** The value of `key` times `scale`, rounded */
const scaled = (
  a: ExportActivity,
  key: string,
  scale: number,
  digits: number,
) => {
  const v = num(a[key]);
  return v == null ? null : round(v * scale, digits);
};

function readSummaries(root: string) {
  const dir = join(root, "DI_CONNECT", "DI-Connect-Fitness");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) =>
      f.endsWith("summarizedActivities.json"),
    );
  } catch {
    throw new UserError(
      `${dir} not found. Pass the folder of an unpacked Garmin data export.`,
    );
  }
  const activities: ExportActivity[] = [];
  for (const f of files) {
    const d = JSON.parse(readFileSync(join(dir, f), "utf8"));
    activities.push(
      ...(Array.isArray(d) ? d[0] : d).summarizedActivitiesExport,
    );
  }
  return activities;
}

/** Export activity (Garmin's internal units) -> the summary format of data/index.json */
function summarize(a: ExportActivity): Summary {
  const zones = [0, 1, 2, 3, 4, 5, 6].map((i) => num(a[`hrTimeInZone_${i}`]));
  const type = str(a.activityType) ?? "other";
  return {
    id: a.activityId,
    name: str(a.name) || str(a.activityType) || "Activity",
    type,
    sport: str(a.sportType),
    start: Math.trunc(num(a.beginTimestamp) || num(a.startTimeGmt) || 0),
    local: Math.trunc(num(a.startTimeLocal) || num(a.beginTimestamp) || 0),
    loc: str(a.locationName),
    // cm, ms, 0.1 m/s
    dist: scaled(a, "distance", 0.01, 1),
    dur: scaled(a, "duration", 0.001, 1),
    mov: scaled(a, "movingDuration", 0.001, 1),
    elapsed: scaled(a, "elapsedDuration", 0.001, 1),
    spd: scaled(a, "avgSpeed", 10, 3),
    maxSpd: scaled(a, "maxSpeed", 10, 3),
    hr: num(a.avgHr),
    maxHr: num(a.maxHr),
    up: scaled(a, "elevationGain", 0.01, 1),
    down: scaled(a, "elevationLoss", 0.01, 1),
    cal: scaled(a, "calories", 1 / 4.184, 0),
    cad:
      num(a.avgDoubleCadence) ||
      2 * (num(a.avgRunCadence) || 0) ||
      num(a.avgBikeCadence),
    pwr: num(a.avgPower),
    np: num(a.normPower),
    maxPwr: num(a.maxPower),
    te: num(a.aerobicTrainingEffect),
    ate: num(a.anaerobicTrainingEffect),
    teLabel: str(a.trainingEffectLabel),
    load: scaled(a, "activityTrainingLoad", 1, 0),
    vo2: num(a.vO2MaxValue),
    steps: num(a.steps),
    laps: num(a.lapCount),
    zones: zones.some((z) => z)
      ? zones.map((z) => (z ? Math.round(z / 1000) : 0))
      : null,
    fav: !!a.favorite,
    pr: !!a.pr,
    lat: num(a.startLatitude),
    lon: num(a.startLongitude),
    track: false,
    gps: false,
  };
}

/** Index of the first activity in `byStart` that starts at or after `start` */
function firstFrom(byStart: Summary[], start: number) {
  let lo = 0,
    hi = byStart.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (byStart[mid].start < start) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The activity starting within 2 minutes of `start` (ms) that fits best, also by duration (s). */
function findActivity(byStart: Summary[], start: number, seconds: number) {
  let best: Summary | null = null,
    bestMismatch = Infinity;
  for (
    let i = firstFrom(byStart, start - MATCH_WINDOW_MS);
    i < byStart.length && byStart[i].start <= start + MATCH_WINDOW_MS;
    i++
  ) {
    const a = byStart[i];
    const mismatch = recordingMismatch(
      a.start,
      a.elapsed || a.dur || 0,
      start,
      seconds,
    );
    if (mismatch < bestMismatch) {
      bestMismatch = mismatch;
      best = a;
    }
  }
  return best;
}

function importExport(root: string, out: string) {
  const activities = readSummaries(root).map(summarize);
  const byStart = [...activities].sort((a, b) => a.start - b.start);
  console.log(`${activities.length} activities in summaries`);

  const zipDir = join(root, "DI_CONNECT", "DI-Connect-Uploaded-Files");
  let zips: string[] = [];
  try {
    zips = readdirSync(zipDir)
      .filter((f) => f.endsWith(".zip"))
      .sort()
      .map((f) => join(zipDir, f));
  } catch {
    console.log(`${zipDir} not found, importing summaries without recordings`);
  }
  let scanned = 0,
    matched = 0;
  for (const zip of zips) {
    const files = Object.values(
      unzipSync(readFileSync(zip), {
        filter: (f) => f.name.toLowerCase().endsWith(".fit"),
      }),
    );
    for (const [i, data] of files.entries()) {
      if (i % 2000 === 0)
        console.log(
          `  ${basename(zip)}: ${i}/${files.length} files, ${matched} matched`,
        );
      scanned++;
      const scan = scanFit(data);
      for (const [start, seconds] of scan?.spans ?? []) {
        const activity = findActivity(byStart, start, seconds);
        if (activity && !activity.track && saveFit(out, activity, data, scan))
          matched++;
      }
    }
  }
  writeIndex(out, activities);
  console.log(
    `Done: ${scanned} .fit files scanned, ${matched}/${activities.length} activities have recordings.`,
  );
  console.log(`Wrote ${out}`);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string", default: DATA_DIR } },
});
if (positionals.length !== 1) {
  console.error("Usage: npm run import -- /path/to/garmin-export [--out data]");
  process.exit(2);
}
try {
  importExport(positionals[0], values.out);
} catch (error) {
  if (!(error instanceof UserError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
