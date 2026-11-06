import {
  formatDistance,
  formatDuration,
  formatNumber,
  formatPace,
} from "../format";
import type { Activity } from "../types";

export interface RecordEntry {
  label: string;
  activity: Activity | null;
  value: (a: Activity) => string;
}

type NumberField =
  "distance" | "ascent" | "duration" | "trainingLoad" | "avgHr";

/** The activity with the highest `field` among those that pass `filter` */
function highest(
  activities: Activity[],
  field: NumberField,
  filter: (a: Activity) => boolean = () => true,
) {
  let best: Activity | null = null;
  for (const a of activities)
    if (
      filter(a) &&
      a[field] &&
      (!best || (a[field] ?? 0) > (best[field] ?? 0))
    )
      best = a;
  return best;
}

export function records(activities: Activity[]): RecordEntry[] {
  const distance = (a: Activity) => formatDistance(a.distance, a);
  return [
    {
      label: "Longest run",
      activity: highest(activities, "distance", (a) => a.sport === "run"),
      value: distance,
    },
    {
      label: "Fastest run (≥ 5 km)",
      activity: activities
        .filter(
          (a) =>
            a.sport === "run" &&
            (a.distance || 0) >= 5000 &&
            a.avgSpeed &&
            a.type !== "treadmill_running",
        )
        .reduce<Activity | null>(
          (best, a) =>
            !best || (a.avgSpeed || 0) > (best.avgSpeed || 0) ? a : best,
          null,
        ),
      value: (a) => formatPace(a.avgSpeed, a) + " /km",
    },
    {
      label: "Longest ride",
      activity: highest(activities, "distance", (a) => a.sport === "bike"),
      value: distance,
    },
    {
      label: "Longest swim",
      activity: highest(activities, "distance", (a) => a.sport === "swim"),
      value: distance,
    },
    {
      label: "Most climbing",
      activity: highest(activities, "ascent"),
      value: (a) => formatNumber(a.ascent) + " m",
    },
    {
      label: "Longest activity",
      activity: highest(activities, "duration"),
      value: (a) => formatDuration(a.duration),
    },
    {
      label: "Highest training load",
      activity: highest(activities, "trainingLoad"),
      value: (a) => formatNumber(a.trainingLoad),
    },
    {
      label: "Hardest effort (avg HR)",
      activity: highest(activities, "avgHr", (a) => (a.duration || 0) > 1200),
      value: (a) => Math.round(a.avgHr || 0) + " bpm",
    },
  ];
}
