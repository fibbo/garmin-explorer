// Reads what an activity summary needs from a .fit file.
import { Decoder, Stream } from "@garmin/fitsdk";

export interface FitScan {
  /**
   * [start ms, seconds] of each activity in the file. A multisport file has one
   * per session (swim, bike, ...) plus one for the whole file, which belongs to
   * the multisport activity.
   */
  spans: [number, number][];
  /** Number of records with a timestamp */
  samples: number;
  gps: boolean;
  vo2: number | null;
}

const ms = (v: unknown) => (v instanceof Date ? v.getTime() : null);

/**
 * VO2 max from Garmin's undocumented message 140, if the activity produced an
 * estimate: field 7 × 3.5 / 65536, unless field 29 is 0.
 */
function vo2Of(messages: Record<string, unknown>) {
  const list = (messages[140] ?? []) as Record<number, unknown>[];
  for (const m of list) {
    const estimate = m[7],
      measured = m[29];
    if (Number.isInteger(estimate) && estimate && measured !== 0)
      return Math.round(((estimate as number) * 3.5) / 65536);
  }
  return null;
}

/** null when the file is not an activity or can't be read. */
export function scanFit(data: Uint8Array): FitScan | null {
  let messages;
  try {
    ({ messages } = new Decoder(Stream.fromByteArray(data)).read({
      includeUnknownData: true,
    }));
  } catch {
    return null;
  }
  // A truncated file still gives the messages read before the damage.
  if (messages.fileIdMesgs?.[0]?.type !== "activity") return null;

  let first: number | null = null,
    last: number | null = null,
    samples = 0,
    gps = false;
  for (const r of messages.recordMesgs ?? []) {
    const t = ms(r.timestamp);
    if (t == null) continue;
    samples++;
    first ??= t;
    last = t;
    if (!gps) {
      const lat = r.positionLat,
        lon = r.positionLong;
      gps =
        Number.isInteger(lat) &&
        Number.isInteger(lon) &&
        (lat !== 0 || lon !== 0);
    }
  }
  const sessions: [number, number][] = [];
  for (const s of messages.sessionMesgs ?? []) {
    const start = ms(s.startTime);
    if (start != null) sessions.push([start, Number(s.totalElapsedTime) || 0]);
  }
  if (first == null || last == null) {
    if (!sessions.length) return null;
    first = last = sessions[0][0];
  }

  let spans: [number, number][];
  if (sessions.length > 1) {
    const start = sessions[0][0];
    spans = [...sessions, [start, (last - start) / 1000]];
  } else if (sessions.length) spans = sessions;
  else spans = [[first, (last - first) / 1000]];
  return {
    spans,
    samples,
    gps,
    vo2: vo2Of(messages as Record<string, unknown>),
  };
}
