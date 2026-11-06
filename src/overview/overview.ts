// The overview page: totals, a bar chart per year or month, totals per sport and records.
import { activities, activityYears } from "../data";
import { eventTarget, find } from "../dom";
import { formatHours, formatNumber, MONTHS } from "../format";
import { openActivity, syncFilters } from "../list";
import { SPORTS, type Sport, sportColor } from "../sports";
import {
  goToActivity,
  goToList,
  type OverviewMetric,
  setOverviewMetric,
  setSort,
  setSportFilter,
  setYearFilter,
  state,
} from "../state";
import type { Activity, SportKey } from "../types";
import { type Bucket, drawBarChart } from "./bar-chart";
import { recordsHtml } from "./records";

interface Metric {
  label: string;
  value: (a: Activity) => number;
  format: (v: number) => string;
}

const METRICS: Record<OverviewMetric, Metric> = {
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

const sum = (list: Activity[], value: (a: Activity) => number | null) =>
  list.reduce((s, a) => s + (value(a) || 0), 0);

function buckets(
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
    return activityYears
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
function sportRows(shown: Activity[], sports: Sport[]) {
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

export function renderOverview() {
  const page = find("#view-overview");
  const year = state.overviewYear,
    metric = METRICS[state.overviewMetric] ?? METRICS.dist;
  const shown = activities.filter((a) => year === "all" || a.year === +year);
  const sports = SPORTS.filter((s) => shown.some((a) => a.sport === s.key));
  const bars = buckets(year, shown, sports, metric);
  const per = year === "all" ? "year" : "month";

  const totalTile = (label: string, value: string, unit = "") =>
    `<div class="tile"><div class="l">${label}</div><div class="v num">${value}${unit ? `<small>${unit}</small>` : ""}</div></div>`;
  const bucketTable = `<table><thead><tr><th>${year === "all" ? "Year" : "Month"}</th>${sports.map((s) => `<th>${s.label}</th>`).join("")}<th>Total</th></tr></thead>
        <tbody>${bars
          .map(
            (b) =>
              `<tr><td>${b.label}</td>${sports.map((s) => `<td>${b.bySport[s.key] ? metric.format(b.bySport[s.key] ?? 0) : "–"}</td>`).join("")}<td><b>${metric.format(b.total)}</b></td></tr>`,
          )
          .join("")}</tbody></table>`;
  const sportTable = `<table>
        <thead><tr><th>Sport</th><th>Count</th><th>Distance</th><th>Time</th><th>Climbing</th><th>Avg HR</th></tr></thead>
        <tbody>${sportRows(shown, sports)
          .map(
            (
              r,
            ) => `<tr class="click" data-g="${r.sport.key}"><td><span style="display:inline-flex;align-items:center;gap:8px"><i class="dot" style="background:${sportColor(r.sport.key)}"></i>${r.sport.label}</span></td>
          <td>${r.count}</td><td>${r.distance ? formatNumber(r.distance / 1000) + " km" : "–"}</td><td>${formatHours(r.time)}</td><td>${r.ascent ? formatNumber(r.ascent) + " m" : "–"}</td><td>${r.avgHr ? Math.round(r.avgHr) : "–"}</td></tr>`,
          )
          .join("")}</tbody></table>`;

  page.innerHTML = `<div class="ov-inner">
    <div class="ov-head">
      <h1>${year === "all" ? "All years" : year}</h1>
      <select id="ovYear" aria-label="Year"><option value="all">All years</option>${activityYears.map((y) => `<option value="${y}">${y}</option>`).join("")}</select>
      <div class="seg" id="ovMetric">${Object.entries(METRICS)
        .map(
          ([key, m]) =>
            `<button data-m="${key}" aria-pressed="${key === state.overviewMetric}">${m.label}</button>`,
        )
        .join("")}</div>
    </div>
    <div class="card"><div class="tiles">
      ${totalTile("Activities", formatNumber(shown.length))}
      ${totalTile("Distance", formatNumber(sum(shown, (a) => a.distance) / 1000), "km")}
      ${totalTile("Moving time", formatNumber(sum(shown, (a) => a.activeTime) / 3600), "h")}
      ${totalTile("Elevation gain", formatNumber(sum(shown, (a) => a.ascent)), "m")}
      ${totalTile("Calories", formatNumber(sum(shown, (a) => a.calories)), "kcal")}
    </div></div>
    <div class="card">
      <div class="card-h"><h2>${metric.label} per ${per}</h2>
        <div class="legend">${sports.map((s) => `<span><i style="background:${sportColor(s.key)}"></i>${s.label}</span>`).join("")}</div>
        <span class="hint" style="margin-left:auto">${year === "all" ? "Click a year to drill in" : "Click a month to list its activities"}</span></div>
      <div class="card-b"><svg id="bars" height="280"></svg>
        <details><summary>Show as table</summary><div class="table-wrap">${bucketTable}</div></details>
      </div>
    </div>
    <div class="two">
      <div class="card"><div class="card-h"><h2>By sport</h2></div><div class="card-b table-wrap">${sportTable}</div></div>
      <div class="card"><div class="card-h"><h2>Records</h2></div><div class="records" style="margin-top:12px">
        ${recordsHtml(shown)}
      </div></div>
    </div>
  </div>`;

  const yearSelect = find<HTMLSelectElement>("#ovYear");
  yearSelect.value = year;
  yearSelect.onchange = () => {
    state.overviewYear = yearSelect.value;
    renderOverview();
  };
  find("#ovMetric").onclick = (e) => {
    const button = eventTarget(e, "button");
    if (!button) return;
    setOverviewMetric(button.dataset.m as OverviewMetric);
    renderOverview();
  };
  page
    .querySelectorAll<HTMLElement>(".rec")
    .forEach(
      (tile) => (tile.onclick = () => openActivity(Number(tile.dataset.id))),
    );
  // A sport row lists that sport's activities for the shown year
  page.querySelectorAll<HTMLElement>("tr[data-g]").forEach(
    (row) =>
      (row.onclick = () => {
        setSportFilter(row.dataset.g as SportKey);
        setYearFilter(year);
        syncFilters();
        goToList();
      }),
  );
  drawBarChart(bars, sports, metric.format, (bucket) => {
    if (year === "all") {
      state.overviewYear = String(bucket.key);
      renderOverview();
    } else if (bucket.activities.length) {
      // List the whole year, newest first, and open the month's latest activity
      setSportFilter("all");
      setYearFilter(year);
      setSort("date");
      state.query = "";
      syncFilters();
      const latest = bucket.activities.reduce((a, b) =>
        b.start > a.start ? b : a,
      );
      goToActivity(latest.id);
    }
  });
}
