// Decodes an activity's original .fit file into a Track, with Garmin's FIT SDK.
import { Decoder, type FitMessages, Stream } from "@garmin/fitsdk";
import { recordingMismatch } from "./data-format";
import { isOnFoot } from "./sports";
import type { Activity, HrZones, Lap, Series, Track } from "./types";

const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31;

const ms = (v: unknown) => (v instanceof Date ? v.getTime() : null);

const numberOrNull = (v: unknown) =>
  typeof v === "number" && isFinite(v) ? v : null;

/** null when no sample has a value */
const channel = (values: Series) =>
  values.some((v) => v != null) ? values : null;

function median(values: Series) {
  const sorted = values.filter((v) => v != null).sort((a, b) => a - b);
  return sorted.length ? sorted[sorted.length >> 1] : null;
}

/**
 * Cadence in steps/min. Watches record running and walking cadence per leg,
 * so double it on foot, unless it already looks like steps (well above 120).
 */
function stepsPerMinute(a: Activity, cadence: Series): Series {
  if (!isOnFoot(a) || (median(cadence) ?? 0) >= 120) return cadence;
  return cadence.map((v) => (v == null ? null : v * 2));
}

/**
 * A multisport file (e.g. a triathlon) holds one session per sport, and Garmin
 * shows each as its own activity, plus one for the whole race. Finds the
 * session of `a` by start time and duration. null means the whole file.
 */
function sessionOf(messages: FitMessages, a: Activity) {
  const sessions = messages.sessionMesgs ?? [];
  if (sessions.length < 2) return null;
  const duration = a.elapsedTime ?? a.duration ?? 0;
  let best: { from: number; to: number; index: number } | null = null,
    bestMismatch = Infinity;
  for (const [i, s] of sessions.entries()) {
    const from = ms(s.startTime),
      seconds = numberOrNull(s.totalElapsedTime);
    if (from == null || seconds == null) continue;
    const mismatch = recordingMismatch(a.start, duration, from, seconds);
    if (mismatch < bestMismatch) {
      bestMismatch = mismatch;
      best = {
        from,
        to: from + seconds * 1000,
        index: typeof s.messageIndex === "number" ? s.messageIndex : i,
      };
    }
  }
  // The multisport activity itself spans all sessions, so none fits it well.
  return bestMismatch < 60 ? best : null;
}

/** Throws when the file can't be decoded. null when it has no samples. */
export function trackFromFit(buffer: ArrayBuffer, a: Activity): Track | null {
  const { messages } = new Decoder(Stream.fromArrayBuffer(buffer)).read();
  const session = sessionOf(messages, a);
  const multisport = (messages.sessionMesgs?.length ?? 0) > 1;
  const inSession = (t: number | null) =>
    t != null && (!session || (t >= session.from && t <= session.to));

  const time: number[] = [];
  const lat: Series = [],
    lon: Series = [],
    heartRate: Series = [],
    speed: Series = [],
    altitude: Series = [],
    cadence: Series = [],
    power: Series = [],
    distance: Series = [],
    temperature: Series = [];
  for (const r of messages.recordMesgs ?? []) {
    const timestamp = ms(r.timestamp);
    if (timestamp == null || !inSession(timestamp)) continue;
    time.push((timestamp - a.start) / 1000);
    const la = numberOrNull(r.positionLat),
      lo = numberOrNull(r.positionLong);
    const hasPosition = la != null && lo != null && (la !== 0 || lo !== 0);
    lat.push(hasPosition ? la * SEMICIRCLES_TO_DEGREES : null);
    lon.push(hasPosition ? lo * SEMICIRCLES_TO_DEGREES : null);
    heartRate.push(numberOrNull(r.heartRate));
    speed.push(numberOrNull(r.enhancedSpeed ?? r.speed));
    altitude.push(numberOrNull(r.enhancedAltitude ?? r.altitude));
    const c = numberOrNull(r.cadence);
    cadence.push(
      c == null ? null : c + (numberOrNull(r.fractionalCadence) ?? 0),
    );
    power.push(numberOrNull(r.power));
    distance.push(numberOrNull(r.distance));
    temperature.push(numberOrNull(r.temperature));
  }
  if (!time.length) return null;

  const onFoot = isOnFoot(a);
  const lapMesgs = (messages.lapMesgs ?? []).filter((l) =>
    inSession(ms(l.startTime) ?? a.start),
  );
  const laps: Lap[] = lapMesgs.map((l) => {
    const cad = numberOrNull(l.avgRunningCadence ?? l.avgCadence);
    return {
      startTime: ((ms(l.startTime) ?? a.start) - a.start) / 1000,
      distance: numberOrNull(l.totalDistance),
      duration: numberOrNull(l.totalTimerTime),
      avgSpeed: numberOrNull(l.enhancedAvgSpeed ?? l.avgSpeed),
      avgHr: numberOrNull(l.avgHeartRate),
      maxHr: numberOrNull(l.maxHeartRate),
      ascent: numberOrNull(l.totalAscent),
      avgCadence: cad == null ? null : onFoot ? cad * 2 : cad,
      avgPower: numberOrNull(l.avgPower),
    };
  });

  // Zones of the session, with the bpm limits the watch used. A whole
  // multisport race has none here, so the summary's zones are shown instead.
  let hrZones: HrZones | null = null;
  const zones =
    multisport && !session
      ? undefined
      : (messages.timeInZoneMesgs ?? []).find(
          (z) =>
            ((z.referenceMesg as unknown) === "session" ||
              z.referenceMesg === 18) &&
            (!session || z.referenceIndex === session.index) &&
            z.timeInHrZone?.length,
        );
  if (zones?.timeInHrZone)
    hrZones = {
      seconds: zones.timeInHrZone.map((s) => Math.round(s || 0)),
      upperBpm: zones.hrZoneHighBoundary ?? null,
    };

  return {
    samples: {
      time,
      lat: channel(lat),
      lon: channel(lon),
      heartRate: channel(heartRate),
      speed: channel(speed),
      altitude: channel(altitude),
      cadence: channel(cadence) && stepsPerMinute(a, cadence),
      power: channel(power),
      distance: channel(distance),
      temperature: channel(temperature),
    },
    laps,
    hrZones,
  };
}
