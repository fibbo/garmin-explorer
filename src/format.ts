import { isSwim, paceDistance, usesPace } from "./sports";
import type { Activity } from "./types";

type Num = number | null | undefined;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** 3725 -> "1:02:05", 125 -> "2:05" */
export function formatDuration(seconds: Num): string {
  if (seconds == null || !isFinite(seconds)) return "–";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = total % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

export function formatHours(seconds: number) {
  const h = seconds / 3600;
  return h >= 100 ? Math.round(h).toLocaleString() + " h" : h.toFixed(1) + " h";
}

/** In m when swimming, in km otherwise */
export function formatDistance(meters: Num, a?: Activity, withUnit = true) {
  if (!meters) return "–";
  if (a && isSwim(a))
    return Math.round(meters).toLocaleString() + (withUnit ? " m" : "");
  const km = meters / 1000;
  return (km >= 100 ? km.toFixed(0) : km.toFixed(2)) + (withUnit ? " km" : "");
}

/** Speed in m/s as time per km, or per 100 m when swimming */
export function formatPace(speed: Num, a: Activity) {
  if (!speed || speed < 0.05) return "–";
  return formatDuration(paceDistance(a) / speed);
}

export const paceUnit = (a: Activity) => (isSwim(a) ? "/100 m" : "/km");

export const formatKmh = (speed: number) => (speed * 3.6).toFixed(1);

export interface Stat {
  label: string;
  value: string | number;
  unit?: string;
}

/** Average pace or speed, depending on the sport */
export function speedStat(a: Activity, speed = a.avgSpeed): Stat | null {
  if (!speed) return null;
  return usesPace(a)
    ? { label: "Avg pace", value: formatPace(speed, a), unit: paceUnit(a) }
    : { label: "Avg speed", value: formatKmh(speed), unit: "km/h" };
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Activity times are local wall-clock times stored as UTC, so read them with getUTC*.
export const formatDate = (d: Date) =>
  `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const formatTime = (d: Date) =>
  `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;

/** Localized number with a fixed number of decimals */
export const formatNumber = (value: Num, decimals = 0) =>
  value == null
    ? "–"
    : value.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      });

/** A round step (1, 2 or 5 times a power of ten) that splits `range` into about `count` parts */
export function niceStep(range: number, count: number) {
  const raw = range / count,
    magnitude = 10 ** Math.floor(Math.log10(raw)),
    f = raw / magnitude;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * magnitude;
}
