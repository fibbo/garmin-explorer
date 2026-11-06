// The summary numbers of an activity, shown at the top of its page.
import {
  formatDistance,
  formatDuration,
  formatKmh,
  formatNumber,
  formatPace,
  paceUnit,
  speedStat,
  type Stat,
} from "../format";
import { activityTypeLabel, isOnFoot, isSwim, usesPace } from "../sports";
import type { Activity } from "../types";

/** The big numbers */
export function stats(a: Activity): Stat[] {
  return [
    a.distance
      ? {
          label: "Distance",
          value: formatDistance(a.distance, a, false),
          unit: isSwim(a) ? "m" : "km",
        }
      : null,
    { label: "Moving time", value: formatDuration(a.activeTime) },
    speedStat(a),
    a.avgHr
      ? { label: "Avg heart rate", value: Math.round(a.avgHr), unit: "bpm" }
      : null,
    a.ascent
      ? { label: "Elevation gain", value: formatNumber(a.ascent), unit: "m" }
      : null,
    a.calories
      ? { label: "Calories", value: formatNumber(a.calories), unit: "kcal" }
      : null,
  ].filter((s) => s != null);
}

/** Label and value pairs below the stats */
export function facts(a: Activity): [string, string | number][] {
  const cadenceUnit = isOnFoot(a) ? " spm" : a.sport === "bike" ? " rpm" : "";
  const list: ([string, string | number] | null)[] = [
    ["Sport", activityTypeLabel(a.type)],
    a.elapsedTime && a.activeTime && a.elapsedTime - a.activeTime > 30
      ? ["Elapsed", formatDuration(a.elapsedTime)]
      : null,
    a.maxHr ? ["Max HR", `${Math.round(a.maxHr)} bpm`] : null,
    a.maxSpeed && a.avgSpeed && !isSwim(a)
      ? usesPace(a)
        ? ["Best pace", formatPace(a.maxSpeed, a) + " " + paceUnit(a)]
        : ["Max speed", formatKmh(a.maxSpeed) + " km/h"]
      : null,
    a.avgCadence
      ? ["Avg cadence", `${Math.round(a.avgCadence)}${cadenceUnit}`]
      : null,
    a.avgPower
      ? [
          "Avg power",
          `${Math.round(a.avgPower)} W${a.normPower ? ` · NP ${Math.round(a.normPower)} W` : ""}`,
        ]
      : null,
    a.aerobicEffect
      ? [
          "Training effect",
          `${a.aerobicEffect.toFixed(1)} aerobic${a.anaerobicEffect ? ` · ${a.anaerobicEffect.toFixed(1)} anaerobic` : ""}`,
        ]
      : null,
    a.trainingEffectLabel
      ? ["Focus", activityTypeLabel(a.trainingEffectLabel.toLowerCase())]
      : null,
    a.trainingLoad ? ["Training load", formatNumber(a.trainingLoad)] : null,
    a.vo2max ? ["VO₂ max", a.vo2max] : null,
    a.steps ? ["Steps", formatNumber(a.steps)] : null,
    a.descent ? ["Descent", `${formatNumber(a.descent)} m`] : null,
  ];
  return list.filter((f) => f != null);
}
