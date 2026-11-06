// uPlot settings for the recording charts, one chart per series. They share the x axis, the zoom and the cursor.
import uPlot from "uplot";
import { cssVar } from "../dom";
import { formatDuration, pad2 } from "../format";
import type { Samples, Series } from "../types";
import type { XAxis } from "./recording.svelte";
import type { ChartSeries } from "./series";

export interface ChartSetup {
  series: ChartSeries;
  xAxis: XAxis;
  /** The sample of each plot point */
  plotSamples: number[];
  width: number;
  /** Only the bottom chart shows the x axis */
  showsXAxis: boolean;
  /** y range for the current zoom */
  yRange: () => [number, number];
  /** The x axis unit changed */
  onUnit: (unit: string) => void;
  /** The mouse moved to a sample, or left the chart */
  onHover: (sample: number | null, source: uPlot) => void;
  onZoom: (fromSample: number, toSample: number) => void;
  onResetZoom: () => void;
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
export function plotIndexOf(plotSamples: number[], sample: number) {
  let lo = 0,
    hi = plotSamples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (plotSamples[mid] < sample) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * 1st to 99th percentile of the visible values plus a margin, so spikes don't flatten the line.
 * Elevation uses the full range.
 */
export function yRange(
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

export function chartOptions(setup: ChartSetup): uPlot.Options {
  const { series, xAxis, plotSamples, width, showsXAxis } = setup;
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
      y: { dir: series.invert ? -1 : 1, range: () => setup.yRange() },
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
          setup.onResetZoom();
          return null;
        },
      },
    },
    hooks: {
      setCursor: [
        (u) => {
          const p = u.cursor.idx;
          setup.onHover(p == null ? null : plotSamples[p], u);
        },
      ],
      setSelect: [
        (u) => {
          const { left, width } = u.select;
          if (width > MIN_ZOOM_DRAG) {
            const from = u.posToIdx(left),
              to = u.posToIdx(left + width);
            if (to > from) setup.onZoom(plotSamples[from], plotSamples[to]);
          }
          u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
        },
      ],
      draw: [
        (u) => {
          if (showsXAxis)
            setup.onUnit(
              xAxis === "distance"
                ? "km"
                : (u.scales.x.max ?? 0) >= 3600
                  ? "h:mm"
                  : "min",
            );
        },
      ],
    },
  };
}
