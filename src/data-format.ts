// The format of data/index.json, shared by the app and the scripts in server/ that write it.
// The summaries use short keys to stay small.
// Node runs server/ without a build step, so this file must not import anything.

/** Bump when the format of data/ changes */
export const DATA_VERSION = 2;

type Num = number | null;

/** One activity in data/index.json */
export interface Summary {
  id: number;
  name: string;
  /** Garmin activity type, e.g. "trail_running" */
  type: string;
  /** Garmin sport, e.g. "RUNNING". Only in activities from an export. */
  sport?: string | null;
  /** UTC start, ms */
  start: number;
  /** Local wall-clock start, as if it were UTC, ms */
  local: number;
  loc: string | null;
  /** m */
  dist: Num;
  /** s */
  dur: Num;
  /** Moving time, s */
  mov: Num;
  /** s */
  elapsed: Num;
  /** m/s */
  spd: Num;
  maxSpd: Num;
  hr: Num;
  maxHr: Num;
  /** m */
  up: Num;
  down: Num;
  /** kcal */
  cal: Num;
  /** steps/min on foot, rpm on the bike */
  cad: Num;
  /** W */
  pwr: Num;
  np: Num;
  maxPwr: Num;
  /** Training effect */
  te: Num;
  ate: Num;
  teLabel: string | null;
  load: Num;
  vo2: Num;
  steps: Num;
  laps: Num;
  /** Seconds below zone 1, in zones 1-5 and above zone 5 */
  zones: number[] | null;
  fav: boolean;
  pr: boolean;
  lat: Num;
  lon: Num;
  /** Whether data/fit/<id>.fit exists */
  track: boolean;
  /** Whether the recording has GPS positions */
  gps: boolean;
}

export interface Index {
  version: number;
  /** When the file was written, ISO 8601 */
  generated: string;
  activities: Summary[];
}

/**
 * How badly a recording fits an activity: the difference in start time plus
 * the difference in duration, both in seconds.
 */
export const recordingMismatch = (
  activityStart: number,
  activitySeconds: number,
  recordingStart: number,
  recordingSeconds: number,
) =>
  Math.abs(activityStart - recordingStart) / 1000 +
  Math.abs(activitySeconds - recordingSeconds);

/** What a sync reports while it runs. The server streams these to the page as JSON lines. */
export type SyncEvent =
  | { type: "status"; text: string }
  | { type: "progress"; done: number; total: number; text: string }
  | { type: "done"; text: string; changed: boolean }
  | { type: "error"; text: string };
