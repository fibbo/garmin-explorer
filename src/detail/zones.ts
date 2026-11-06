import type { Activity, Track } from "../types";

export interface Zone {
  /** 0 = below zone 1 */
  zone: number;
  seconds: number;
  /** e.g. "131–139 bpm", or "" when the limits are unknown */
  range: string;
}

/** From the recording when it has zones (with bpm limits), else from the summary */
export function hrZones(a: Activity, track: Track | null): Zone[] | null {
  let seconds: number[],
    upper: number[] | null = null;
  if (track?.hrZones?.seconds.some((s) => s > 0)) {
    seconds = track.hrZones.seconds;
    upper = track.hrZones.upperBpm;
  } else if (a.hrZoneSeconds?.some((s) => s > 0)) seconds = a.hrZoneSeconds;
  else return null;
  // The time above the zone 5 limit counts as zone 5.
  const zones: Zone[] = [1, 2, 3, 4, 5].map((zone) => ({
    zone,
    seconds: (seconds[zone] || 0) + (zone === 5 ? seconds[6] || 0 : 0),
    range: upper
      ? zone === 5
        ? `${upper[4]}+ bpm`
        : `${upper[zone - 1]}–${upper[zone]} bpm`
      : "",
  }));
  if (seconds[0] > 0)
    zones.unshift({
      zone: 0,
      seconds: seconds[0],
      range: upper ? `< ${upper[0]} bpm` : "",
    });
  return zones;
}
