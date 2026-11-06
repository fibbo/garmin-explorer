// Stacked bar chart (SVG) of a metric per year or month, one color per sport.
import { eventTarget, find } from "../dom";
import { niceStep } from "../format";
import { type Sport, sportColor } from "../sports";
import type { Activity, SportKey } from "../types";
import { hideTooltip, showTooltip } from "./tooltip";

export interface Bucket {
  /** Year, or month index 0-11 */
  key: number;
  label: string;
  shortLabel: string;
  activities: Activity[];
  bySport: Partial<Record<SportKey, number>>;
  total: number;
}

const HEIGHT = 280;
const PAD = { left: 52, right: 8, top: 10, bottom: 26 };
/** Gap between stacked segments, in px */
const SEGMENT_GAP = 2;

/** Bar path with rounded top corners */
const roundedTop = (
  x: number,
  top: number,
  bottom: number,
  width: number,
  r: number,
) =>
  `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${bottom}Z`;
const rect = (x: number, top: number, bottom: number, width: number) =>
  `M${x},${bottom}V${top}H${x + width}V${bottom}Z`;

export function drawBarChart(
  buckets: Bucket[],
  sports: Sport[],
  format: (v: number) => string,
  onClick: (bucket: Bucket) => void,
) {
  const svg = find<SVGSVGElement>("#bars");
  const width = svg.clientWidth || 800;
  const max = Math.max(...buckets.map((b) => b.total), 1e-9),
    step = niceStep(max, 4),
    top = Math.ceil(max / step) * step;
  const plotWidth = width - PAD.left - PAD.right,
    plotHeight = HEIGHT - PAD.top - PAD.bottom,
    slotWidth = plotWidth / buckets.length,
    barWidth = Math.min(44, slotWidth * 0.68);
  const toY = (v: number) => PAD.top + plotHeight - (v / top) * plotHeight;

  let html = "";
  for (let v = 0; v <= top + 1e-9; v += step)
    html += `<line class="grid" x1="${PAD.left}" x2="${width - PAD.right}" y1="${toY(v)}" y2="${toY(v)}"/><text x="${PAD.left - 8}" y="${toY(v) + 4}" text-anchor="end">${v === 0 ? "0" : format(v).replace(/ (km|h|m)$/, "")}</text>`;
  buckets.forEach((b, i) => {
    const center = PAD.left + slotWidth * i + slotWidth / 2,
      x = center - barWidth / 2;
    const stacked = sports.filter((s) => (b.bySport[s.key] ?? 0) > 0);
    let sum = 0;
    stacked.forEach((s, j) => {
      const v = b.bySport[s.key] ?? 0;
      const bottom = toY(sum),
        segmentTop = toY(sum + v);
      sum += v;
      const height = Math.max(
        0,
        bottom - segmentTop - (j > 0 ? SEGMENT_GAP : 0),
      );
      if (height <= 0) return;
      const d =
        j === stacked.length - 1
          ? roundedTop(
              x,
              segmentTop,
              segmentTop + height,
              barWidth,
              Math.min(4, height, barWidth / 2),
            )
          : rect(x, segmentTop, segmentTop + height, barWidth);
      html += `<path d="${d}" fill="${sportColor(s.key)}"/>`;
    });
    html += `<text x="${center}" y="${HEIGHT - 8}" text-anchor="middle">${slotWidth < 34 ? b.shortLabel : b.label.split(" ")[0]}</text>`;
    // Invisible full-height target for hover and click
    html += `<rect class="bar-hit" data-i="${i}" x="${PAD.left + slotWidth * i}" y="${PAD.top}" width="${slotWidth}" height="${plotHeight}"/>`;
  });
  svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);
  svg.innerHTML = html;

  const bucketAt = (e: Event) => {
    const hit = eventTarget<SVGElement>(e, ".bar-hit");
    return hit ? buckets[Number(hit.dataset.i)] : null;
  };
  svg.onmousemove = (e) => {
    const b = bucketAt(e);
    if (!b) return hideTooltip();
    const rows = sports
      .filter((s) => b.bySport[s.key])
      .reverse()
      .map(
        (s) =>
          `<div class="tt-r"><span><i class="dot" style="background:${sportColor(s.key)}"></i>${s.label}</span><b class="num">${format(b.bySport[s.key] ?? 0)}</b></div>`,
      );
    showTooltip(
      e,
      `<div class="tt-h">${b.label}</div>${rows.join("")}
      <div class="tt-r" style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><span>Total · ${b.activities.length} activities</span><b class="num">${format(b.total)}</b></div>`,
    );
  };
  svg.onmouseleave = hideTooltip;
  svg.onclick = (e) => {
    const b = bucketAt(e);
    if (!b) return;
    hideTooltip();
    onClick(b);
  };
}
