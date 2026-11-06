export type SportKey = "run" | "bike" | "swim" | "hike" | "strength" | "other";

/** One value per recorded sample. null where the sample has no value. */
export type Series = (number | null)[];

export interface Activity {
  id: number;
  name: string;
  /** Garmin activity type, e.g. "trail_running" */
  type: string;
  sport: SportKey;
  /** UTC timestamp in ms */
  start: number;
  /** Local wall-clock start time. Read it with the getUTC* methods. */
  localStart: Date;
  year: number;
  location: string | null;
  /** Lower-case name, location and type, for the search box */
  searchText: string;
  /** m */
  distance: number | null;
  /** s */
  duration: number | null;
  /** Moving time, or the duration when there is none. s */
  activeTime: number | null;
  /** s */
  elapsedTime: number | null;
  /** m/s */
  avgSpeed: number | null;
  /** m/s */
  maxSpeed: number | null;
  avgHr: number | null;
  maxHr: number | null;
  /** m */
  ascent: number | null;
  /** m */
  descent: number | null;
  /** kcal */
  calories: number | null;
  /** steps/min on foot, rpm on the bike */
  avgCadence: number | null;
  /** W */
  avgPower: number | null;
  /** W */
  normPower: number | null;
  aerobicEffect: number | null;
  anaerobicEffect: number | null;
  /** e.g. "LACTATE_THRESHOLD" */
  trainingEffectLabel: string | null;
  trainingLoad: number | null;
  vo2max: number | null;
  steps: number | null;
  /** Seconds in each HR zone, see HrZones.seconds */
  hrZoneSeconds: number[] | null;
  isPr: boolean;
  /** Whether data/fit/<id>.fit exists */
  hasRecording: boolean;
}

export interface Lap {
  /** s since the activity start */
  startTime: number;
  /** m */
  distance: number | null;
  /** s */
  duration: number | null;
  /** m/s */
  avgSpeed: number | null;
  avgHr: number | null;
  maxHr: number | null;
  /** m */
  ascent: number | null;
  /** steps/min on foot, rpm on the bike */
  avgCadence: number | null;
  /** W */
  avgPower: number | null;
}

export interface HrZones {
  /** [below zone 1, zone 1, ..., zone 5, above the zone 5 limit] */
  seconds: number[];
  /** Upper bpm limit of each entry in `seconds` */
  upperBpm: number[] | null;
}

export interface Samples {
  /** s since the activity start, never null */
  time: number[];
  lat: Series | null;
  lon: Series | null;
  heartRate: Series | null;
  /** m/s */
  speed: Series | null;
  /** m */
  altitude: Series | null;
  /** steps/min on foot, rpm on the bike */
  cadence: Series | null;
  /** W */
  power: Series | null;
  /** m */
  distance: Series | null;
  /** °C */
  temperature: Series | null;
}

export interface Track {
  samples: Samples;
  laps: Lap[];
  hrZones: HrZones | null;
}
