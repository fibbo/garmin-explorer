import type { Activity, SportKey } from "./types";

export interface Sport {
  key: SportKey;
  label: string;
  /** CSS variable holding the sport's color */
  colorVar: string;
  /** Garmin activity types that belong to this sport */
  garminTypes: string[];
}

export const SPORTS: Sport[] = [
  {
    key: "run",
    label: "Running",
    colorVar: "--s1",
    garminTypes: [
      "running",
      "treadmill_running",
      "trail_running",
      "track_running",
      "street_running",
      "virtual_run",
      "indoor_running",
    ],
  },
  {
    key: "bike",
    label: "Cycling",
    colorVar: "--s2",
    garminTypes: [
      "cycling",
      "road_biking",
      "cyclocross",
      "indoor_cycling",
      "mountain_biking",
      "gravel_cycling",
      "virtual_ride",
      "e_bike_fitness",
      "bmx",
    ],
  },
  {
    key: "swim",
    label: "Swimming",
    colorVar: "--s3",
    garminTypes: ["lap_swimming", "open_water_swimming", "swimming"],
  },
  {
    key: "hike",
    label: "Hiking & walking",
    colorVar: "--s4",
    garminTypes: [
      "hiking",
      "walking",
      "casual_walking",
      "mountaineering",
      "speed_walking",
    ],
  },
  {
    key: "strength",
    label: "Gym & climbing",
    colorVar: "--s5",
    garminTypes: [
      "strength_training",
      "yoga",
      "indoor_climbing",
      "bouldering",
      "breathwork",
      "pilates",
      "hiit",
      "cardio_training",
      "fitness_equipment",
    ],
  },
  { key: "other", label: "Other", colorVar: "--s-other", garminTypes: [] },
];

const SPORT_BY_KEY = Object.fromEntries(
  SPORTS.map((s) => [s.key, s]),
) as Record<SportKey, Sport>;
const SPORT_BY_TYPE = new Map(
  SPORTS.flatMap((s) => s.garminTypes.map((type) => [type, s.key])),
);

export const sportOf = (garminType: string): SportKey =>
  SPORT_BY_TYPE.get(garminType) ?? "other";

export const sportColor = (sport: SportKey) =>
  `var(${SPORT_BY_KEY[sport].colorVar})`;

const ICON_PATHS: Record<SportKey, string> = {
  run: '<path d="M13 4.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0"/><path d="M7 21l3-5 3 2v4M6 12l3-4 4 1 3 4h3M10 16l1.5-6"/>',
  bike: '<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17l4-7h6l3 7M9.5 10 12 17h0M14 6h2.5l-1 4"/>',
  swim: '<path d="M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M7 14l4-4-2-2 4-2 4 6"/><circle cx="18" cy="6" r="1.6"/>',
  hike: '<path d="M3 20l6-10 4 6 3-4 5 8z"/>',
  strength: '<path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/>',
  other: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
};

/** The sport icon on a colored square */
export const sportBadge = (a: Activity) =>
  `<span class="badge" style="background:${sportColor(a.sport)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[a.sport]}</svg></span>`;

/** "trail_running" -> "Trail running" */
export const activityTypeLabel = (type: string | null | undefined) =>
  (type || "other")
    .replace(/_v\d+$/, "")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

export const isSwim = (a: Activity) => a.sport === "swim";

/** Running and hiking: cadence is counted in steps, and .fit files store it per leg. */
export const isOnFoot = (a: Activity) =>
  a.sport === "run" || a.sport === "hike";

/** Show pace (time per km or per 100 m) instead of speed */
export const usesPace = (a: Activity) => isOnFoot(a) || isSwim(a);

/** Pace is per 100 m when swimming, per km otherwise */
export const paceDistance = (a: Activity) => (isSwim(a) ? 100 : 1000);
