// What to plot for a recording: one chart per channel that has data.
import { formatDuration, paceUnit } from "../format";
import { isSwim, paceDistance, usesPace } from "../sports";
import type { Activity, Samples, Series } from "../types";

export interface ChartSeries {
  key: "hr" | "pace" | "speed" | "alt" | "cad" | "power" | "temp";
  name: string;
  unit: string;
  colorVar: string;
  /** One value per sample */
  values: Series;
  format: (v: number) => string;
  /** Draw higher values lower (pace: faster is up) */
  invert?: boolean;
  /** Stronger area fill under the line */
  fill?: boolean;
}

/** Smoothing windows in seconds, for the noisy channels */
const SPEED_WINDOW = 15;
const POWER_WINDOW = 10;

/** Centered moving average over `seconds`, by sample time. Gaps stay gaps. */
function smooth(values: Series, time: number[], seconds: number): Series {
  const out: Series = new Array(values.length).fill(null);
  const half = seconds / 2;
  let sum = 0,
    count = 0,
    lo = 0,
    hi = 0;
  for (let i = 0; i < values.length; i++) {
    for (; hi < values.length && time[hi] <= time[i] + half; hi++) {
      const v = values[hi];
      if (v != null) {
        sum += v;
        count++;
      }
    }
    for (; lo < hi && time[lo] < time[i] - half; lo++) {
      const v = values[lo];
      if (v != null) {
        sum -= v;
        count--;
      }
    }
    if (values[i] != null && count) out[i] = sum / count;
  }
  return out;
}

/** null when the channel has no non-zero value */
const withData = (values: Series | null) =>
  values?.some((v) => v != null && v !== 0) ? values : null;

const rounded = (v: number) => String(Math.round(v));

export function chartSeries(a: Activity, samples: Samples): ChartSeries[] {
  const list: ChartSeries[] = [];
  const heartRate = withData(samples.heartRate),
    speed = withData(samples.speed),
    altitude = withData(samples.altitude),
    cadence = withData(samples.cadence),
    power = withData(samples.power),
    temperature = withData(samples.temperature);

  if (heartRate)
    list.push({
      key: "hr",
      name: "Heart rate",
      unit: "bpm",
      colorVar: "--s8",
      values: heartRate.map((v) => v || null),
      format: rounded,
    });
  if (speed) {
    const smoothed = smooth(speed, samples.time, SPEED_WINDOW);
    if (usesPace(a)) {
      // Slower than this is standing still, which would blow up the pace axis.
      const minSpeed = isSwim(a) ? 0.2 : 0.8;
      list.push({
        key: "pace",
        name: "Pace",
        unit: paceUnit(a),
        colorVar: "--s1",
        invert: true,
        values: smoothed.map((v) =>
          v && v > minSpeed ? paceDistance(a) / v : null,
        ),
        format: formatDuration,
      });
    } else
      list.push({
        key: "speed",
        name: "Speed",
        unit: "km/h",
        colorVar: "--s1",
        values: smoothed.map((v) => (v == null ? null : v * 3.6)),
        format: (v) => v.toFixed(1),
      });
  }
  if (altitude)
    list.push({
      key: "alt",
      name: "Elevation",
      unit: "m",
      colorVar: "--s6",
      values: altitude,
      format: rounded,
      fill: true,
    });
  if (cadence)
    list.push({
      key: "cad",
      name: "Cadence",
      unit: a.sport === "bike" ? "rpm" : "spm",
      colorVar: "--s7",
      values: cadence.map((v) => v || null),
      format: rounded,
    });
  if (power)
    list.push({
      key: "power",
      name: "Power",
      unit: "W",
      colorVar: "--s4",
      values: smooth(power, samples.time, POWER_WINDOW),
      format: rounded,
    });
  if (temperature)
    list.push({
      key: "temp",
      name: "Temperature",
      unit: "°C",
      colorVar: "--s3",
      values: temperature,
      format: rounded,
    });
  return list;
}
