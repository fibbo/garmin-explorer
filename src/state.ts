import { load, save } from "./storage";
import type { Activity, SportKey } from "./types";

export type SortKey = "date" | "date-asc" | "dist" | "dur" | "up" | "hr";
export type OverviewMetric = "dist" | "time" | "count" | "up";

interface State {
  tab: "activities" | "overview";
  /** Lower-case search text */
  query: string;
  sport: SportKey | "all";
  /** "all" or a year */
  year: string;
  sort: SortKey;
  /** Activities shown in the list, in list order */
  listed: Activity[];
  selectedId: number | null;
  /** "all" or a year */
  overviewYear: string;
  overviewMetric: OverviewMetric;
}

export const state: State = {
  tab: "activities",
  query: "",
  sport: load<State["sport"]>("group", "all"),
  year: load("year", "all"),
  sort: load<SortKey>("sort", "date"),
  listed: [],
  selectedId: null,
  overviewYear: "all",
  overviewMetric: load<OverviewMetric>("ovMetric", "dist"),
};

export function setSportFilter(sport: State["sport"]) {
  state.sport = sport;
  save("group", sport);
}
export function setYearFilter(year: string) {
  state.year = year;
  save("year", year);
}
export function setSort(sort: SortKey) {
  state.sort = sort;
  save("sort", sort);
}
export function setOverviewMetric(metric: OverviewMetric) {
  state.overviewMetric = metric;
  save("ovMetric", metric);
}

export const goToActivity = (id: number) => {
  location.hash = `#/a/${id}`;
};
export const goToList = () => {
  location.hash = "#/";
};
