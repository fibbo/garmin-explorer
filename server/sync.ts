// Syncs activities from Garmin Connect into data/ with the Garmin Connect Personal API.
//
// Usage: GARMIN_API_KEY=... npm run sync [-- --out data]
//
// Refreshes the summaries of all activities and downloads the .fit file of every
// activity that has none in data/fit/ yet. Works on top of an imported export or
// on an empty data/ folder. When the server starts it as a child process, it
// sends its progress as SyncEvent messages instead of printing it.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Summary, SyncEvent } from "../src/data-format.ts";
import {
  DATA_DIR,
  fitPath,
  readIndex,
  round,
  saveFit,
  UserError,
  writeIndex,
} from "./data-dir.ts";
import { scanFit } from "./fit-scan.ts";
import { type ApiActivity, GarminApi, KEY_URL } from "./garmin-api.ts";

/** "2026-10-27 11:50:41" -> ms, reading it as UTC. For the local time this gives the wall clock, like the export. */
const asUtcMs = (s: string) => Date.parse(`${s.replace(" ", "T")}Z`);

const num = (v: unknown) => (typeof v === "number" ? v : null);

/** API activity (SI units) -> the summary format of data/index.json */
function summarize(a: ApiActivity): Summary {
  const zones = [0, 1, 2, 3, 4, 5, 6].map((i) => num(a[`hrTimeInZone_${i}`]));
  return {
    id: a.activityId,
    name: a.activityName || a.activityType.typeKey,
    type: a.activityType.typeKey,
    // Multisport parents have no beginTimestamp
    start: a.beginTimestamp || asUtcMs(a.startTimeGMT),
    local: asUtcMs(a.startTimeLocal),
    loc: (a.locationName as string) || null,
    dist: round(num(a.distance), 1),
    dur: round(num(a.duration), 1),
    mov: round(num(a.movingDuration), 1),
    elapsed: round(num(a.elapsedDuration), 1),
    spd: round(num(a.averageSpeed), 3),
    maxSpd: round(num(a.maxSpeed), 3),
    hr: num(a.averageHR),
    maxHr: num(a.maxHR),
    up: round(num(a.elevationGain), 1),
    down: round(num(a.elevationLoss), 1),
    cal: round(num(a.calories)),
    cad:
      num(a.averageRunningCadenceInStepsPerMinute) ||
      num(a.averageBikingCadenceInRevPerMinute),
    pwr: num(a.avgPower),
    np: num(a.normPower),
    maxPwr: num(a.maxPower),
    te: num(a.aerobicTrainingEffect),
    ate: num(a.anaerobicTrainingEffect),
    teLabel: (a.trainingEffectLabel as string) ?? null,
    load: round(num(a.activityTrainingLoad)),
    vo2: null,
    steps: num(a.steps),
    laps: num(a.lapCount),
    zones: zones.some((z) => z) ? zones.map((z) => Math.round(z ?? 0)) : null,
    fav: !!a.favorite,
    pr: !!a.pr,
    lat: num(a.startLatitude),
    lon: num(a.startLongitude),
    track: false,
    gps: false,
  };
}

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

async function sync(out: string, report: (event: SyncEvent) => void) {
  const key = process.env.GARMIN_API_KEY?.trim();
  if (!key)
    throw new UserError(
      `GARMIN_API_KEY is not set. Create a key at ${KEY_URL} and set GARMIN_API_KEY in the shell that starts Garmin Explorer.`,
    );
  mkdirSync(out, { recursive: true });
  const status = (text: string) => report({ type: "status", text });
  const known = new Map(readIndex(out).map((a) => [a.id, a]));
  const before = JSON.stringify([...known.values()]);

  status("Connecting to Garmin Connect");
  const api = await GarminApi.connect(key, status);
  status("Loading the activity list");
  const remote = await api.activities();
  status(
    `${count(remote.length, "activity", "activities")} on Garmin Connect, ${known.size} here`,
  );

  // New activities, and known ones whose recording is missing from data/fit/
  const todo: [Summary, ApiActivity][] = [];
  let added = 0;
  for (const raw of remote) {
    const fresh = summarize(raw);
    const old = known.get(fresh.id);
    if (old) {
      // Keep what the API lacks (VO2 max, sport, recording flags) and the export's finer HR zones.
      for (const [k, v] of Object.entries(fresh) as [
        keyof Summary,
        unknown,
      ][]) {
        if (["vo2", "track", "gps"].includes(k)) continue;
        if (v == null || v === "" || (k === "zones" && old.zones)) continue;
        (old as unknown as Record<string, unknown>)[k] = v;
      }
      if (old.track && !existsSync(fitPath(out, old.id))) todo.push([old, raw]);
    } else {
      known.set(fresh.id, fresh);
      todo.push([fresh, raw]);
      added++;
    }
  }

  const activities = [...known.values()];
  let recordings = 0;
  for (const [i, [activity, raw]] of todo.entries()) {
    activity.track = false;
    const path = fitPath(out, activity.id);
    const files = existsSync(path)
      ? [new Uint8Array(readFileSync(path))]
      : raw.manualActivity
        ? []
        : await api.fitFiles(activity.id);
    for (const data of files) {
      const scan = scanFit(data);
      if (saveFit(out, activity, data, scan)) {
        activity.vo2 ||= scan?.vo2 ?? null;
        recordings++;
        break;
      }
    }
    const date = new Date(activity.local).toISOString().slice(0, 10);
    report({
      type: "progress",
      done: i + 1,
      total: todo.length,
      text: `${date} ${activity.name}${activity.track ? "" : " (no recording)"}`,
    });
    if ((i + 1) % 50 === 0) writeIndex(out, activities);
  }
  writeIndex(out, activities);

  const changed = JSON.stringify(activities) !== before;
  const text = added
    ? count(added, "new activity", "new activities")
    : recordings
      ? `${count(recordings, "recording", "recordings")} downloaded`
      : changed
        ? "Activities updated"
        : "Everything is up to date";
  report({ type: "done", text, changed });
}

function printEvent(event: SyncEvent) {
  if (event.type === "progress")
    console.log(`  ${event.done}/${event.total} ${event.text}`);
  else if (event.type === "error") console.error(event.text);
  else console.log(event.text);
}

const { values } = parseArgs({
  options: { out: { type: "string", default: DATA_DIR } },
});
const send = process.send?.bind(process);
const report = send ? (event: SyncEvent) => send(event) : printEvent;
try {
  await sync(values.out, report);
} catch (error) {
  if (!(error instanceof UserError)) throw error;
  report({ type: "error", text: error.message });
  process.exitCode = 1;
}
