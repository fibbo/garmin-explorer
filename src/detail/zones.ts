import { formatDuration } from "../format";
import type { Activity, Track } from "../types";

interface Zone {
  /** 0 = below zone 1 */
  zone: number;
  seconds: number;
  /** e.g. "131–139 bpm", or "" when the limits are unknown */
  range: string;
}

/** From the recording when it has zones (with bpm limits), else from the summary */
function hrZones(a: Activity, track: Track | null): Zone[] | null {
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

/** The heart-rate zones card, or "" when there is no zone data */
export function zonesCard(a: Activity, track: Track | null) {
  const zones = hrZones(a, track);
  if (!zones) return "";
  const total = zones.reduce((s, z) => s + z.seconds, 0) || 1,
    longest = Math.max(...zones.map((z) => z.seconds)) || 1;
  const rows = zones.map(
    (
      z,
    ) => `<div class="zone"><div>${z.zone ? "Zone " + z.zone : "Below Z1"}<div class="r">${z.range}</div></div>
        <div class="bar" title="${formatDuration(z.seconds)}"><i style="width:${((z.seconds / longest) * 100).toFixed(1)}%;background:${z.zone ? `var(--z${z.zone})` : "var(--s-other)"}"></i></div>
        <div class="tv">${formatDuration(z.seconds)} · ${Math.round((z.seconds / total) * 100)}%</div></div>`,
  );
  return `<div class="card"><div class="card-h"><h2>Heart-rate zones</h2></div><div class="card-b">
      ${rows.join("")}
    </div></div>`;
}
