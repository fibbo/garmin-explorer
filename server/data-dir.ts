// Reads and writes data/: index.json with the activity summaries and the .fit file of each activity.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { DATA_VERSION, type Index, type Summary } from "../src/data-format.ts";
import type { FitScan } from "./fit-scan.ts";

export const DATA_DIR = join(import.meta.dirname, "..", "data");

/** A problem the user has to fix. The message says how. */
export class UserError extends Error {}

export const fitPath = (out: string, id: number) =>
  join(out, "fit", `${id}.fit`);

/** Writes to a temporary file first, so readers never see a half-written file. */
function writeAtomically(path: string, data: string | Uint8Array) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, data);
  renameSync(`${path}.tmp`, path);
}

/** The activities in data/index.json, or none when there is no such file. */
export function readIndex(out: string): Summary[] {
  const path = join(out, "index.json");
  if (!existsSync(path)) return [];
  const index = JSON.parse(readFileSync(path, "utf8")) as Index;
  if (index.version !== DATA_VERSION)
    throw new UserError(
      `${path} was written by another version of Garmin Explorer. Import your export again, or move ${out} away and sync again.`,
    );
  return index.activities;
}

export function writeIndex(out: string, activities: Summary[]) {
  activities.sort((a, b) => b.start - a.start);
  const index: Index = {
    version: DATA_VERSION,
    generated: new Date().toISOString(),
    activities,
  };
  writeAtomically(join(out, "index.json"), JSON.stringify(index));
}

/** Stores the .fit file of an activity and flags it in the summary. false when it has no samples. */
export function saveFit(
  out: string,
  activity: Summary,
  data: Uint8Array,
  scan: FitScan | null,
) {
  if (!scan?.samples) return false;
  writeAtomically(fitPath(out, activity.id), data);
  activity.track = true;
  activity.gps = scan.gps;
  return true;
}

/** Rounds to `digits` decimals. Keeps null and undefined as null. */
export const round = (value: number | null | undefined, digits = 0) =>
  value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
