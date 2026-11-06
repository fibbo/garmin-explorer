// The overview page: totals, a bar chart per year or month, totals per sport and records.
import { formatNumber, MONTHS } from "../format";
import type { Sport } from "../sports";
import type { OverviewMetric } from "../state.svelte";
import type { Activity, SportKey } from "../types";

export interface Bucket {
  /** Year, or month index 0-11 */
  key: number;
  label: string;
  shortLabel: string;
  activities: Activity[];
  bySport: Partial<Record<SportKey, number>>;
  total: number;
}

export interface Metric {
  label: string;
  value: (a: Activity) => number;
  format: (v: number) => string;
}

export const METRICS: Record<OverviewMetric, Metric> = {
  dist: {
    label: "Distance",
    value: (a) => (a.distance || 0) / 1000,
    format: (v) => `${formatNumber(v, v < 10 ? 1 : 0)} km`,
  },
  time: {
    label: "Time",
    value: (a) => (a.activeTime || 0) / 3600,
    format: (v) => `${formatNumber(v, 1)} h`,
  },
  count: { label: "Count", value: () => 1, format: (v) => formatNumber(v) },
  up: {
    label: "Climbing",
    value: (a) => a.ascent || 0,
    format: (v) => `${formatNumber(v)} m`,
  },
};

export const sum = (list: Activity[], value: (a: Activity) => number | null) =>
  list.reduce((s, a) => s + (value(a) || 0), 0);

export function buckets(
  years: number[],
  year: string,
  shown: Activity[],
  sports: Sport[],
  metric: Metric,
): Bucket[] {
  const bucket = (
    key: number,
    label: string,
    shortLabel: string,
    list: Activity[],
  ): Bucket => {
    const bySport: Partial<Record<SportKey, number>> = {};
    for (const s of sports)
      bySport[s.key] = sum(
        list.filter((a) => a.sport === s.key),
        metric.value,
      );
    const total = Object.values(bySport).reduce((s, v) => s + (v ?? 0), 0);
    return { key, label, shortLabel, activities: list, bySport, total };
  };
  if (year === "all")
    return years
      .slice()
      .reverse()
      .map((y) =>
        bucket(
          y,
          String(y),
          "’" + String(y).slice(2),
          shown.filter((a) => a.year === y),
        ),
      );
  return MONTHS.map((m, i) =>
    bucket(
      i,
      `${m} ${year}`,
      m,
      shown.filter((a) => a.localStart.getUTCMonth() === i),
    ),
  );
}

/** One row per sport. Avg HR is weighted by time. */
export function sportRows(shown: Activity[], sports: Sport[]) {
  return sports.map((sport) => {
    const list = shown.filter((a) => a.sport === sport.key);
    const withHr = list.filter((a) => a.avgHr);
    const hrTime = sum(withHr, (a) => a.activeTime);
    return {
      sport,
      count: list.length,
      distance: sum(list, (a) => a.distance),
      time: sum(list, (a) => a.activeTime),
      ascent: sum(list, (a) => a.ascent),
      avgHr: hrTime
        ? sum(withHr, (a) => (a.avgHr || 0) * (a.activeTime || 0)) / hrTime
        : null,
    };
  });
}
