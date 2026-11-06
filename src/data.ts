// Reads data/: index.json with the activity summaries, and the original .fit file of each activity.
// The summaries use short keys to stay small. This module maps them to readable names.
import { DATA_VERSION, type Index, type Summary } from "./data-format";
import { activityTypeLabel, sportOf } from "./sports";
import type { Activity, Track } from "./types";

function toActivity(raw: Summary): Activity {
  const name =
    !raw.name || raw.name === raw.type ? activityTypeLabel(raw.type) : raw.name;
  const localStart = new Date(raw.local);
  return {
    id: raw.id,
    name,
    type: raw.type,
    sport: sportOf(raw.type),
    start: raw.start,
    localStart,
    year: localStart.getUTCFullYear(),
    location: raw.loc || null,
    searchText:
      `${name} ${raw.loc || ""} ${activityTypeLabel(raw.type)}`.toLowerCase(),
    distance: raw.dist ?? null,
    duration: raw.dur ?? null,
    activeTime: raw.mov || (raw.dur ?? null),
    elapsedTime: raw.elapsed ?? null,
    avgSpeed: raw.spd ?? null,
    maxSpeed: raw.maxSpd ?? null,
    avgHr: raw.hr ?? null,
    maxHr: raw.maxHr ?? null,
    ascent: raw.up ?? null,
    descent: raw.down ?? null,
    calories: raw.cal ?? null,
    avgCadence: raw.cad ?? null,
    avgPower: raw.pwr ?? null,
    normPower: raw.np ?? null,
    aerobicEffect: raw.te ?? null,
    anaerobicEffect: raw.ate ?? null,
    trainingEffectLabel: raw.teLabel ?? null,
    trainingLoad: raw.load ?? null,
    vo2max: raw.vo2 ?? null,
    steps: raw.steps ?? null,
    hrZoneSeconds: raw.zones ?? null,
    isPr: !!raw.pr,
    hasRecording: !!raw.track,
  };
}

/** A problem with data/ that the user has to fix. The message (HTML) says how. */
export class DataError extends Error {
  readonly title: string;
  constructor(title: string, message: string) {
    super(message);
    this.title = title;
  }
}

export const NO_DATA_HELP =
  "Click <b>Sync</b> to download your activities from Garmin Connect, or import a Garmin data export with <code>npm run import -- /path/to/export</code>.";

/** Loads data/index.json. The activities are newest first. */
export async function loadActivities(): Promise<Activity[]> {
  if (location.protocol === "file:")
    throw new DataError(
      "Start the server",
      "Garmin Explorer can't be opened as a file. Start <code>serve.command</code>, or run <code>npm run serve</code> in its folder.",
    );
  const response = await fetch("data/index.json", { cache: "no-cache" });
  if (response.status === 404) throw new DataError("No data yet", NO_DATA_HELP);
  if (!response.ok)
    throw new DataError(
      "Couldn't load your activities",
      `data/index.json returned HTTP ${response.status}.`,
    );
  const index = (await response.json()) as Index;
  if (index.version !== DATA_VERSION)
    throw new DataError(
      "Data needs updating",
      "data/ was written by another version of Garmin Explorer. Import your export again with <code>npm run import -- /path/to/export</code>, or move data/ away and sync again.",
    );
  return index.activities.map(toActivity);
}

const tracks = new Map<number, Promise<Track | null>>();

async function fetchTrack(a: Activity) {
  const response = await fetch(`data/fit/${a.id}.fit`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // The FIT SDK is large, so it loads with the first recording
  const [{ trackFromFit }, buffer] = await Promise.all([
    import("./fit"),
    response.arrayBuffer(),
  ]);
  return trackFromFit(buffer, a);
}

/** Decodes data/fit/<id>.fit. Resolves to null when it can't be loaded or decoded. */
export function loadTrack(a: Activity): Promise<Track | null> {
  let track = tracks.get(a.id);
  if (!track) {
    track = fetchTrack(a).catch((error: unknown) => {
      console.error(`data/fit/${a.id}.fit:`, error);
      tracks.delete(a.id);
      return null;
    });
    tracks.set(a.id, track);
  }
  return track;
}
