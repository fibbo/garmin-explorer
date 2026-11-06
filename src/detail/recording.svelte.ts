// The recording of the open activity: map and charts, kept in sync.
// Hovering either one moves a shared cursor, and zooming the charts highlights that part on the map.
import type L from "leaflet";
import type uPlot from "uplot";
import { formatDistance, formatDuration } from "../format";
import { load, save } from "../storage";
import type { Activity, Track } from "../types";
import { plotAxis, plotIndexOf } from "./charts";
import { chartSeries, type ChartSeries } from "./series";

export type XAxis = "distance" | "time";

export class Recording {
  readonly activity: Activity;
  readonly track: Track;
  readonly series: ChartSeries[];
  /** Whether the charts can use distance as x axis */
  readonly hasDistance: boolean;
  /** Samples with a GPS position, and those positions */
  readonly gpsSamples: number[] = [];
  readonly gpsPoints: L.LatLngTuple[] = [];

  xAxis = $state<XAxis>("time");
  /** Zoomed range of samples, null when showing everything */
  zoom = $state.raw<[number, number] | null>(null);
  /** The lap zoomed to */
  activeLap = $state<number | null>(null);
  /** Sample under the mouse, and the chart the mouse is on, which moves its own cursor */
  hover = $state.raw<{ sample: number | null; source: uPlot | null }>({
    sample: null,
    source: null,
  });

  /** Samples on the charts' x axis, and their x values (km or s) */
  readonly axis: { plotSamples: number[]; plotX: number[] };
  /** Plot point under the mouse */
  readonly cursorIndex: number | null;
  /** Visible range of plot points */
  readonly visible: [number, number];
  /** Time and distance at the cursor */
  readonly cursorText: string;
  /** GPS position at the cursor */
  readonly cursorPosition: L.LatLngTuple | null;
  /** GPS positions in the zoomed range */
  readonly zoomedPositions: L.LatLngTuple[] | null;

  constructor(activity: Activity, track: Track) {
    this.activity = activity;
    this.track = track;
    this.series = chartSeries(activity, track.samples);
    const samples = track.samples;
    this.hasDistance =
      !!samples.distance &&
      samples.distance.filter((v) => v != null).length >
        samples.time.length * 0.5 &&
      (activity.distance || 0) > 0;
    const { lat, lon } = samples;
    if (lat && lon)
      samples.time.forEach((_, i) => {
        const la = lat[i],
          lo = lon[i];
        if (la != null && lo != null) {
          this.gpsSamples.push(i);
          this.gpsPoints.push([la, lo]);
        }
      });
    const saved =
      load<string>("xMode", "dist") === "time" ? "time" : "distance";
    this.xAxis = this.hasDistance ? saved : "time";

    this.axis = $derived(plotAxis(this.track.samples, this.xAxis));
    this.cursorIndex = $derived(
      this.hover.sample == null || !this.axis.plotSamples.length
        ? null
        : plotIndexOf(this.axis.plotSamples, this.hover.sample),
    );
    this.visible = $derived.by((): [number, number] => {
      const { plotSamples, plotX } = this.axis;
      const n = plotX.length;
      if (!this.zoom) return [0, n - 1];
      const first = plotIndexOf(plotSamples, this.zoom[0]),
        last = Math.max(first + 1, plotIndexOf(plotSamples, this.zoom[1]));
      return [first, Math.min(n - 1, last)];
    });
    this.cursorText = $derived.by(() => {
      const sample = this.hover.sample;
      if (sample == null) return "";
      const samples = this.track.samples;
      const distance = samples.distance?.[sample];
      return [
        formatDuration(samples.time[sample]),
        distance != null ? formatDistance(distance, this.activity) : null,
      ]
        .filter((part) => part != null)
        .join(" · ");
    });
    this.cursorPosition = $derived.by((): L.LatLngTuple | null => {
      const sample = this.hover.sample;
      if (sample == null) return null;
      const lat = this.track.samples.lat?.[sample],
        lon = this.track.samples.lon?.[sample];
      return lat != null && lon != null ? [lat, lon] : null;
    });
    this.zoomedPositions = $derived.by(() => {
      const zoom = this.zoom;
      if (!zoom) return null;
      return this.gpsPoints.filter(
        (_, k) =>
          this.gpsSamples[k] >= zoom[0] && this.gpsSamples[k] <= zoom[1],
      );
    });
  }

  setXAxis(xAxis: XAxis) {
    this.xAxis = xAxis;
    save("xMode", xAxis === "time" ? "time" : "dist");
  }

  /** Moves the cursor to a sample, or hides it. `source` is the chart the mouse is on. */
  hoverSample(sample: number | null, source: uPlot | null = null) {
    this.hover = { sample, source };
  }

  /** Zooms the charts to a range of samples and highlights it on the map. */
  zoomTo(fromSample: number, toSample: number, lap: number | null = null) {
    this.zoom = [fromSample, toSample];
    this.activeLap = lap;
  }

  resetZoom() {
    this.zoom = null;
    this.activeLap = null;
  }
}

/** The recording on screen, for the keyboard shortcuts */
export const openRecording: { current: Recording | null } = { current: null };
