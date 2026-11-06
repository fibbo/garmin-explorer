import {
  formatDistance,
  formatDuration,
  formatKmh,
  formatPace,
} from "../format";
import { usesPace } from "../sports";
import type { Activity, Lap, Track } from "../types";

export interface Column {
  header: string;
  cell: (lap: Lap, index: number) => string | number;
  /** Hide the column when no lap has a value for this field */
  field?: keyof Lap;
}

function allColumns(a: Activity): Column[] {
  const pace = usesPace(a);
  return [
    { header: "Lap", cell: (_, i) => i + 1 },
    {
      header: "Distance",
      cell: (l) => (l.distance ? formatDistance(l.distance, a) : "–"),
      field: "distance",
    },
    {
      header: "Time",
      cell: (l) => formatDuration(l.duration),
      field: "duration",
    },
    {
      header: pace ? "Pace" : "Speed",
      cell: (l) =>
        l.avgSpeed
          ? pace
            ? formatPace(l.avgSpeed, a)
            : formatKmh(l.avgSpeed)
          : "–",
      field: "avgSpeed",
    },
    { header: "Avg HR", cell: (l) => l.avgHr ?? "–", field: "avgHr" },
    { header: "Max HR", cell: (l) => l.maxHr ?? "–", field: "maxHr" },
    {
      header: "Ascent",
      cell: (l) => (l.ascent != null ? l.ascent + " m" : "–"),
      field: "ascent",
    },
    {
      header: "Cadence",
      cell: (l) => l.avgCadence ?? "–",
      field: "avgCadence",
    },
    {
      header: "Power",
      cell: (l) => (l.avgPower != null ? l.avgPower + " W" : "–"),
      field: "avgPower",
    },
  ];
}

/** The columns that have a value in at least one lap */
export const columns = (a: Activity, laps: Lap[]) =>
  allColumns(a).filter(({ field }) =>
    field ? laps.some((l) => l[field] != null && l[field] !== 0) : true,
  );

/** First and last sample of a lap, or null when the lap has no samples */
export function lapSamples(
  track: Track,
  lapIndex: number,
): [number, number] | null {
  const lap = track.laps[lapIndex],
    next = track.laps[lapIndex + 1];
  if (!lap) return null;
  const start = lap.startTime,
    end = next ? next.startTime : lap.startTime + (lap.duration || 0);
  const time = track.samples.time;
  const first = time.findIndex((t) => t >= start);
  if (first < 0) return null;
  let last = time.length - 1;
  for (let i = time.length - 1; i >= 0; i--)
    if (time[i] <= end) {
      last = i;
      break;
    }
  return [first, Math.max(first + 1, last)];
}
