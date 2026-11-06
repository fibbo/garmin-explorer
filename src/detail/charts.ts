// uPlot line charts for a recording, one per series. They share the x axis, the zoom and the cursor.
// The recording drives zoom and cursor, so the map and the lap table stay in sync with the charts.
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { cssVar, find } from "../dom";
import { formatDuration, pad2 } from "../format";
import type { Samples, Series } from "../types";
import type { Recording, XAxis } from "./recording";
import type { ChartSeries } from "./series";

export interface Chart {
  series: ChartSeries;
  plot: uPlot;
  /** One value per plot point (see Recording.plotSamples) */
  values: Series;
  /** y range for the current zoom, read by uPlot */
  yRange: [number, number];
  /** Shows the average, or the value under the cursor */
  valueLabel: HTMLElement;
  average: string;
}

export interface ChartEvents {
  /** `source` is the chart the mouse is on, which already shows the cursor */
  hover: (sample: number | null, source?: uPlot) => void;
  zoom: (fromSample: number, toSample: number) => void;
  resetZoom: () => void;
}

const FONT = "11px system-ui, sans-serif";
/** Drags shorter than this (px) don't zoom */
const MIN_ZOOM_DRAG = 6;
const TIME_STEPS = [
  30, 60, 120, 300, 600, 900, 1200, 1800, 3600, 7200, 10800, 14400, 21600,
];
const PACE_STEPS = [15, 30, 60, 120, 300, 600, 900, 1800];

/**
 * The samples to plot and their x values (km or s).
 * Samples without an x value, or where x goes backwards, are skipped.
 */
export function plotAxis(samples: Samples, xAxis: XAxis) {
  const x =
    xAxis === "distance" && samples.distance ? samples.distance : samples.time;
  const plotSamples: number[] = [],
    plotX: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (v != null && v >= last) {
      plotSamples.push(i);
      plotX.push(xAxis === "distance" ? v / 1000 : v);
      last = v;
    }
  }
  return { plotSamples, plotX };
}

/** First plot point at or after `sample` */
function plotIndexOf(plotSamples: number[], sample: number) {
  let lo = 0,
    hi = plotSamples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (plotSamples[mid] < sample) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Visible range of plot points for the current zoom */
function visibleRange(rec: Recording): [number, number] {
  const n = rec.plotX.length;
  if (!rec.zoom) return [0, n - 1];
  const first = plotIndexOf(rec.plotSamples, rec.zoom[0]),
    last = Math.max(first + 1, plotIndexOf(rec.plotSamples, rec.zoom[1]));
  return [first, Math.min(n - 1, last)];
}

/**
 * 1st to 99th percentile of the visible values plus a margin, so spikes don't flatten the line.
 * Elevation uses the full range.
 */
function yRange(
  series: ChartSeries,
  values: Series,
  first: number,
  last: number,
): [number, number] {
  const visible: number[] = [];
  for (let p = first; p <= last; p++) {
    const v = values[p];
    if (v != null) visible.push(v);
  }
  visible.sort((a, b) => a - b);
  let min = visible.length ? visible[Math.floor(visible.length * 0.01)] : 0,
    max = visible.length ? visible[Math.ceil(visible.length * 0.99) - 1] : 1;
  if (series.key === "alt" && visible.length) {
    min = visible[0];
    max = visible[visible.length - 1];
  }
  if (max - min < 1e-6) {
    min -= 1;
    max += 1;
  }
  const margin = (max - min) * 0.08;
  return [min - margin, max + margin];
}

/** Enough decimals to tell ticks `step` apart */
const decimalsFor = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);

function xTickLabel(v: number, step: number, xAxis: XAxis) {
  if (xAxis === "distance") return v.toFixed(decimalsFor(step));
  const s = Math.round(v),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return h
    ? `${h}:${pad2(m)}`
    : `${m}:${pad2(s % 60)}`.replace(/:00$/, "") + "′";
}

/** "#2a78d6" + 0.1 -> "#2a78d61a" */
const withAlpha = (color: string, alpha: number) =>
  /^#[0-9a-f]{6}$/i.test(color)
    ? color +
      Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")
    : color;

function chartOptions(
  rec: Recording,
  chart: Chart,
  width: number,
  showsXAxis: boolean,
  unitLabel: HTMLElement,
  events: ChartEvents,
): uPlot.Options {
  const { series } = chart;
  const xAxis = rec.xAxis;
  const muted = () => cssVar("--muted"),
    border = () => cssVar("--border"),
    color = () => cssVar(series.colorVar);
  return {
    width,
    height: showsXAxis ? 112 : 92,
    padding: [8, 12, showsXAxis ? 0 : 4, 0],
    legend: { show: false },
    scales: {
      x: {
        time: false,
        range: (_u, min, max) => (min === max ? [min, min + 1] : [min, max]),
      },
      y: { dir: series.invert ? -1 : 1, range: () => chart.yRange },
    },
    axes: [
      {
        show: showsXAxis,
        size: 22,
        gap: 3,
        font: FONT,
        stroke: muted,
        space: 70,
        incrs: xAxis === "time" ? TIME_STEPS : undefined,
        grid: { show: false },
        ticks: { size: 3, width: 1, stroke: border },
        // Leave room for the unit at the right end
        filter: (u, splits) =>
          splits.map((v) =>
            u.valToPos(v, "x") > u.bbox.width / uPlot.pxRatio - 22 ? null : v,
          ),
        values: (_u, splits, _axis, _space, step) =>
          splits.map((v) => (v == null ? null : xTickLabel(v, step, xAxis))),
      },
      {
        // Same width as the indent of the chart headers
        size: 54,
        gap: 8,
        font: FONT,
        stroke: muted,
        space: 18,
        incrs: series.key === "pace" ? PACE_STEPS : undefined,
        values: (_u, splits, _axis, _space, step) =>
          splits.map((v) =>
            series.key === "pace"
              ? formatDuration(v)
              : v.toFixed(decimalsFor(step)),
          ),
        grid: { stroke: border, width: 1 },
        ticks: { show: false },
      },
    ],
    series: [
      {},
      {
        stroke: color,
        width: 1.75,
        fill: () => withAlpha(color(), series.fill ? 0.22 : 0.1),
        // Fill down to the bottom of the plot, which is the top of the scale for pace
        fillTo: (u) => (series.invert ? u.scales.y.max : u.scales.y.min) ?? 0,
        points: { show: false },
      },
    ],
    cursor: {
      y: false,
      points: {
        size: 11,
        width: 1.5,
        stroke: () => cssVar("--surface"),
        fill: color,
      },
      drag: { x: true, y: false, setScale: false },
      bind: {
        dblclick: () => () => {
          events.resetZoom();
          return null;
        },
      },
    },
    hooks: {
      setCursor: [
        (u) => {
          const p = u.cursor.idx;
          events.hover(p == null ? null : rec.plotSamples[p], u);
        },
      ],
      setSelect: [
        (u) => {
          const { left, width } = u.select;
          if (width > MIN_ZOOM_DRAG) {
            const from = u.posToIdx(left),
              to = u.posToIdx(left + width);
            if (to > from)
              events.zoom(rec.plotSamples[from], rec.plotSamples[to]);
          }
          u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
        },
      ],
      draw: [
        (u) => {
          if (showsXAxis)
            unitLabel.textContent =
              xAxis === "distance"
                ? "km"
                : (u.scales.x.max ?? 0) >= 3600
                  ? "h:mm"
                  : "min";
        },
      ],
    },
  };
}

function createChart(
  rec: Recording,
  series: ChartSeries,
  showsXAxis: boolean,
  container: HTMLElement,
  events: ChartEvents,
): Chart {
  const [first, last] = visibleRange(rec);
  const values = rec.plotSamples.map((i) => series.values[i]);
  const defined = values.filter((v) => v != null);
  const average = `avg ${series.format(defined.reduce((s, v) => s + v, 0) / (defined.length || 1))} ${series.unit}`;
  const root = document.createElement("div");
  root.className = "chart";
  root.innerHTML = `<div class="chart-h"><span class="name"><i class="dot" style="background:var(${series.colorVar})"></i>${series.name}</span>
      <span class="val num">${average}</span></div>
      <div class="chart-w"><span class="x-unit"></span></div>`;
  container.appendChild(root);
  const plotArea = find(".chart-w", root);

  const chart = {
    series,
    values,
    yRange: yRange(series, values, first, last),
    valueLabel: find(".val", root),
    average,
  } as Chart;
  const plot = new uPlot(
    chartOptions(
      rec,
      chart,
      plotArea.clientWidth,
      showsXAxis,
      find(".x-unit", root),
      events,
    ),
    [rec.plotX, values],
    plotArea,
  );
  chart.plot = plot;
  if (rec.zoom)
    plot.setScale("x", { min: rec.plotX[first], max: rec.plotX[last] });

  // uPlot has no touch support, so move the cursor on touch ourselves.
  plot.over.addEventListener(
    "touchmove",
    (e) => {
      const left =
        e.touches[0].clientX - plot.over.getBoundingClientRect().left;
      events.hover(rec.plotSamples[plot.posToIdx(left)] ?? null);
    },
    { passive: true },
  );
  plot.over.addEventListener("touchend", () => events.hover(null));
  return chart;
}

export function createCharts(
  rec: Recording,
  container: HTMLElement,
  events: ChartEvents,
): Chart[] {
  container.innerHTML = "";
  return rec.series.map((series, k) =>
    createChart(rec, series, k === rec.series.length - 1, container, events),
  );
}

export function destroyCharts(charts: Chart[]) {
  charts.forEach((c) => c.plot.destroy());
}

export function resizeCharts(charts: Chart[], width: number) {
  charts.forEach((c) => {
    if (c.plot.width !== width)
      c.plot.setSize({ width, height: c.plot.height });
  });
}

/** Repaints with the current theme colors */
export function redrawCharts(charts: Chart[]) {
  charts.forEach((c) => c.plot.redraw(false));
}

/** Shows rec.zoom on all charts, with each chart's y range fitted to the visible part. */
export function applyZoom(rec: Recording) {
  if (!rec.plotX.length) return;
  const [first, last] = visibleRange(rec);
  for (const chart of rec.charts) {
    chart.yRange = yRange(chart.series, chart.values, first, last);
    chart.plot.setScale("x", { min: rec.plotX[first], max: rec.plotX[last] });
  }
}

/** Moves the cursor of every chart except `source` to rec.cursor, and updates the value labels. */
export function showCursor(rec: Recording, source?: uPlot) {
  const p =
    rec.cursor == null || !rec.plotSamples.length
      ? null
      : plotIndexOf(rec.plotSamples, rec.cursor);
  for (const chart of rec.charts) {
    if (chart.plot !== source)
      chart.plot.setCursor(
        {
          left: p == null ? -10 : chart.plot.valToPos(rec.plotX[p], "x"),
          top: 0,
        },
        false,
      );
    const v = p == null ? null : chart.values[p];
    chart.valueLabel.textContent =
      p == null
        ? chart.average
        : v == null
          ? "–"
          : `${chart.series.format(v)} ${chart.series.unit}`;
  }
}
