// The recording of the open activity: map and charts, kept in sync.
// Hovering either one moves a shared cursor, and zooming the charts highlights that part on the map.
import { eventTarget, find, findOptional, setPressed } from "../dom";
import { formatDistance, formatDuration } from "../format";
import { load, save } from "../storage";
import type { Activity, Track } from "../types";
import type uPlot from "uplot";
import {
  applyZoom,
  createCharts,
  destroyCharts,
  plotAxis,
  redrawCharts,
  resizeCharts,
  showCursor,
  type Chart,
  type ChartEvents,
} from "./charts";
import { createTrackMap, leafletLoaded, type TrackMap } from "./map";
import { chartSeries, type ChartSeries } from "./series";

export type XAxis = "distance" | "time";

export interface Recording {
  activity: Activity;
  track: Track;
  series: ChartSeries[];
  xAxis: XAxis;
  /** Zoomed range of samples, null when showing everything */
  zoom: [number, number] | null;
  /** Sample under the mouse */
  cursor: number | null;
  charts: Chart[];
  /** Samples with a GPS position, and those positions */
  gpsSamples: number[];
  gpsPoints: L.LatLngTuple[];
  /** Samples on the charts' x axis, and their x values (km or s) */
  plotSamples: number[];
  plotX: number[];
  map: TrackMap | null;
  /** Resizes the charts with their container */
  resizeObserver: ResizeObserver | null;
}

let current: Recording | null = null;

export const isZoomed = () => !!current?.zoom;

export function closeRecording() {
  if (!current) return;
  current.map?.remove();
  current.resizeObserver?.disconnect();
  destroyCharts(current.charts);
  current = null;
}

const chartEvents: ChartEvents = {
  hover: setCursor,
  zoom: zoomTo,
  resetZoom,
};

/** Renders the map and charts of `track` into `container`. */
export function showRecording(
  activity: Activity,
  track: Track,
  container: HTMLElement,
) {
  closeRecording();
  const samples = track.samples;
  const hasDistance =
    !!samples.distance &&
    samples.distance.filter((v) => v != null).length >
      samples.time.length * 0.5 &&
    (activity.distance || 0) > 0;
  const gpsSamples: number[] = [],
    gpsPoints: L.LatLngTuple[] = [];
  const { lat, lon } = samples;
  if (lat && lon)
    samples.time.forEach((_, i) => {
      const la = lat[i],
        lo = lon[i];
      if (la != null && lo != null) {
        gpsSamples.push(i);
        gpsPoints.push([la, lo]);
      }
    });
  const savedAxis =
    load<string>("xMode", "dist") === "time" ? "time" : "distance";
  const rec: Recording = {
    activity,
    track,
    series: chartSeries(activity, samples),
    xAxis: hasDistance ? savedAxis : "time",
    zoom: null,
    cursor: null,
    charts: [],
    gpsSamples,
    gpsPoints,
    plotSamples: [],
    plotX: [],
    map: null,
    resizeObserver: null,
  };
  current = rec;

  const hasTrack = gpsPoints.length > 1;
  const hasMap = hasTrack && leafletLoaded();
  container.innerHTML = `<div class="track">
    ${hasTrack ? `<div class="card">${hasMap ? `<div id="map"></div>` : `<div class="nomap">Map library (lib/leaflet.js) not found.</div>`}</div>` : ""}
    ${
      rec.series.length
        ? `<div class="card">
      <div class="card-h">
        <h2>Charts</h2>
        ${hasDistance ? `<div class="seg" id="xmode"><button data-x="distance" aria-pressed="${rec.xAxis === "distance"}">Distance</button><button data-x="time" aria-pressed="${rec.xAxis === "time"}">Time</button></div>` : ""}
        <span class="hint">Drag to zoom · double-click or Esc to reset${hasTrack ? "" : " · no GPS track"}</span>
        <button class="icon-btn" id="resetZoom" hidden style="height:26px;font-size:12.5px">Reset zoom</button>
        <span class="cursorbar num" id="cursorbar"></span>
      </div>
      <div class="charts" id="charts"></div></div>`
        : ""
    }
  </div>`;
  if (hasMap)
    rec.map = createTrackMap("map", gpsPoints, (i) =>
      setCursor(i == null ? null : gpsSamples[i]),
    );
  if (!rec.series.length) return;
  const chartsContainer = find("#charts");
  buildCharts(rec);
  rec.resizeObserver = new ResizeObserver(([entry]) =>
    resizeCharts(rec.charts, entry.contentRect.width),
  );
  rec.resizeObserver.observe(chartsContainer);
  const axisButtons = findOptional("#xmode");
  if (axisButtons)
    axisButtons.onclick = (e) => {
      const button = eventTarget(e, "button");
      if (!button) return;
      rec.xAxis = button.dataset.x as XAxis;
      save("xMode", rec.xAxis === "time" ? "time" : "dist");
      setPressed(axisButtons.querySelectorAll("button"), button);
      buildCharts(rec);
    };
  find("#resetZoom").onclick = resetZoom;
}

function buildCharts(rec: Recording) {
  destroyCharts(rec.charts);
  rec.charts = [];
  Object.assign(rec, plotAxis(rec.track.samples, rec.xAxis));
  rec.charts = createCharts(rec, find("#charts"), chartEvents);
  showCursor(rec);
}

/** Repaints map and charts with the current theme colors. */
export function redrawRecording() {
  if (!current) return;
  current.map?.applyTheme();
  redrawCharts(current.charts);
}

/** Moves the cursor to a sample, or hides it. `source` is the chart the mouse is on. */
export function setCursor(sample: number | null, source?: uPlot) {
  const rec = current;
  if (!rec) return;
  rec.cursor = sample;
  showCursor(rec, source);
  const bar = findOptional("#cursorbar");
  const samples = rec.track.samples;
  if (sample == null) {
    if (bar) bar.textContent = "";
    rec.map?.showCursor(null);
    return;
  }
  const distance = samples.distance?.[sample];
  if (bar)
    bar.textContent = [
      formatDuration(samples.time[sample]),
      distance != null ? formatDistance(distance, rec.activity) : null,
    ]
      .filter((part) => part != null)
      .join(" · ");
  const lat = samples.lat?.[sample],
    lon = samples.lon?.[sample];
  rec.map?.showCursor(lat != null && lon != null ? [lat, lon] : null);
}

/** Zooms the charts to a range of samples and highlights it on the map. */
export function zoomTo(fromSample: number, toSample: number) {
  const rec = current;
  if (!rec) return;
  rec.zoom = [fromSample, toSample];
  const button = findOptional("#resetZoom");
  if (button) button.hidden = false;
  applyZoom(rec);
  rec.map?.highlight(
    rec.gpsPoints.filter(
      (_, k) =>
        rec.gpsSamples[k] >= fromSample && rec.gpsSamples[k] <= toSample,
    ),
  );
}

export function resetZoom() {
  const rec = current;
  if (!rec) return;
  rec.zoom = null;
  const button = findOptional("#resetZoom");
  if (button) button.hidden = true;
  document
    .querySelectorAll("#lower tr.active")
    .forEach((row) => row.classList.remove("active"));
  applyZoom(rec);
  rec.map?.clearHighlight();
}
