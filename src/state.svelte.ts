// The app state: the activities, the list filters, the open activity and the overview settings.
import { load } from "./storage";
import type { Activity, SportKey } from "./types";

export type SortKey = "date" | "date-asc" | "dist" | "dur" | "up" | "hr";
export type OverviewMetric = "dist" | "time" | "count" | "up";
export type Tab = "activities" | "overview";

const SORTS: Record<SortKey, (a: Activity, b: Activity) => number> = {
  date: (a, b) => b.start - a.start,
  "date-asc": (a, b) => a.start - b.start,
  dist: (a, b) => (b.distance || 0) - (a.distance || 0),
  dur: (a, b) => (b.duration || 0) - (a.duration || 0),
  up: (a, b) => (b.ascent || 0) - (a.ascent || 0),
  hr: (a, b) => (b.avgHr || 0) - (a.avgHr || 0),
};

class AppState {
  /** All activities, newest first */
  activities = $state.raw<Activity[]>([]);
  byId = $derived(new Map(this.activities.map((a) => [a.id, a])));
  /** Years with activities, newest first */
  years = $derived(
    [...new Set(this.activities.map((a) => a.year))].sort((a, b) => b - a),
  );

  tab = $state<Tab>("activities");
  /** What is typed in the search box */
  search = $state("");
  /** The search words, lower case. Follows `search` with a short delay. */
  query = $state("");
  sport = $state<SportKey | "all">(load("group", "all"));
  /** "all" or a year */
  year = $state<string>(load("year", "all"));
  sort = $state<SortKey>(load("sort", "date"));
  selectedId = $state<number | null>(null);
  /** On phones the open activity replaces the list */
  detailOpen = $state(false);
  /** "all" or a year */
  overviewYear = $state("all");
  overviewMetric = $state<OverviewMetric>(load("ovMetric", "dist"));

  /** Activities shown in the list, in list order */
  listed = $derived.by(() => {
    const words = this.query ? this.query.split(/\s+/) : [];
    return this.activities
      .filter(
        (a) =>
          (this.sport === "all" || a.sport === this.sport) &&
          (this.year === "all" || a.year === +this.year) &&
          words.every((w) => a.searchText.includes(w)),
      )
      .sort(SORTS[this.sort] ?? SORTS.date);
  });

  setActivities(activities: Activity[]) {
    this.activities = activities;
    if (this.year !== "all" && !this.years.includes(+this.year))
      this.year = "all";
  }

  clearFilters() {
    this.sport = "all";
    this.year = "all";
    this.search = "";
    this.query = "";
  }
}

export const app = new AppState();

export const goToActivity = (id: number) => {
  location.hash = `#/a/${id}`;
};
export const goToList = () => {
  location.hash = "#/";
};

/** Opens an activity, clearing the filters first if they hide it. */
export function openActivity(id: number) {
  if (!app.listed.some((a) => a.id === id)) app.clearFilters();
  goToActivity(id);
}

/** Opens the next (1) or previous (-1) activity in the list. */
export function stepThroughList(direction: 1 | -1) {
  const listed = app.listed;
  if (!listed.length) return;
  const i = listed.findIndex((a) => a.id === app.selectedId);
  const next =
    i < 0 ? 0 : Math.max(0, Math.min(listed.length - 1, i + direction));
  goToActivity(listed[next].id);
}
