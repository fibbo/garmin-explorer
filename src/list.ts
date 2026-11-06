// The sidebar: filters, search and the activity list.
import { activities, activityYears } from "./data";
import { eventTarget, find, setPressed } from "./dom";
import {
  escapeHtml,
  formatDate,
  formatDistance,
  formatDuration,
  formatHours,
  formatTime,
  MONTHS,
  speedStat,
} from "./format";
import { SPORTS, sportBadge, sportColor } from "./sports";
import {
  goToActivity,
  setSort,
  setSportFilter,
  setYearFilter,
  state,
  type SortKey,
} from "./state";
import type { Activity, SportKey } from "./types";

const SORTS: Record<SortKey, (a: Activity, b: Activity) => number> = {
  date: (a, b) => b.start - a.start,
  "date-asc": (a, b) => a.start - b.start,
  dist: (a, b) => (b.distance || 0) - (a.distance || 0),
  dur: (a, b) => (b.duration || 0) - (a.duration || 0),
  up: (a, b) => (b.ascent || 0) - (a.ascent || 0),
  hr: (a, b) => (b.avgHr || 0) - (a.avgHr || 0),
};

export function initList() {
  const counts: Partial<Record<SportKey, number>> = {};
  activities.forEach((a) => (counts[a.sport] = (counts[a.sport] ?? 0) + 1));
  const chips = find("#chips");
  chips.innerHTML = [
    `<button class="chip" data-g="all" aria-pressed="${state.sport === "all"}">All <span class="n">${activities.length}</span></button>`,
    ...SPORTS.filter((s) => counts[s.key]).map(
      (s) =>
        `<button class="chip" data-g="${s.key}" aria-pressed="${state.sport === s.key}"><i class="dot" style="background:${sportColor(s.key)}"></i>${s.label} <span class="n">${counts[s.key]}</span></button>`,
    ),
  ].join("");
  chips.onclick = (e) => {
    const chip = eventTarget(e, ".chip");
    if (!chip) return;
    setSportFilter(chip.dataset.g as SportKey | "all");
    setPressed(chips.querySelectorAll(".chip"), chip);
    renderList();
  };

  const yearSelect = find<HTMLSelectElement>("#year"),
    sortSelect = find<HTMLSelectElement>("#sort"),
    search = find<HTMLInputElement>("#q");
  yearSelect.innerHTML =
    `<option value="all">All years</option>` +
    activityYears.map((y) => `<option value="${y}">${y}</option>`).join("");
  if (state.year !== "all" && !activityYears.includes(+state.year))
    state.year = "all";
  yearSelect.value = state.year;
  sortSelect.value = state.sort;
  yearSelect.onchange = () => {
    setYearFilter(yearSelect.value);
    renderList();
  };
  sortSelect.onchange = () => {
    setSort(sortSelect.value as SortKey);
    renderList();
  };
  let searchTimer: number | undefined;
  search.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = search.value.trim().toLowerCase();
      renderList();
    }, 80);
  };

  find("#list").onclick = (e) => {
    const item = eventTarget(e, ".item");
    if (item) goToActivity(Number(item.dataset.id));
  };
}

function listItem(a: Activity) {
  const speed = speedStat(a);
  const metrics = [
    a.distance ? formatDistance(a.distance, a) : null,
    formatDuration(a.activeTime),
    speed
      ? `${speed.value}${speed.unit === "km/h" ? " km/h" : speed.unit}`
      : null,
    a.avgHr ? `♥ ${Math.round(a.avgHr)}` : null,
  ].filter((m) => m != null);
  return `<li class="item" data-id="${a.id}" aria-selected="${a.id === state.selectedId}">${sportBadge(a)}<div style="min-width:0">
      <div class="t">${escapeHtml(a.name)}</div>
      <div class="m num">${metrics.map(escapeHtml).join("<span>·</span>")}</div>
      <div class="d">${formatDate(a.localStart)} · ${formatTime(a.localStart)}${a.location ? " · " + escapeHtml(a.location) : ""}</div></div></li>`;
}

export function renderList() {
  const words = state.query ? state.query.split(/\s+/) : [];
  const listed = activities.filter(
    (a) =>
      (state.sport === "all" || a.sport === state.sport) &&
      (state.year === "all" || a.year === +state.year) &&
      words.every((w) => a.searchText.includes(w)),
  );
  listed.sort(SORTS[state.sort] ?? SORTS.date);
  state.listed = listed;

  const totalDistance = listed.reduce((s, a) => s + (a.distance || 0), 0),
    totalTime = listed.reduce((s, a) => s + (a.activeTime || 0), 0);
  find("#count").textContent =
    `${listed.length} activities · ${Math.round(totalDistance / 1000).toLocaleString()} km · ${formatHours(totalTime)}`;

  const byMonth = state.sort.startsWith("date");
  let html = "",
    lastMonth: string | null = null;
  for (const a of listed) {
    if (byMonth) {
      const month = `${MONTHS[a.localStart.getUTCMonth()]} ${a.year}`;
      if (month !== lastMonth) {
        lastMonth = month;
        html += `<li class="month-h">${month}</li>`;
      }
    }
    html += listItem(a);
  }
  find("#list").innerHTML =
    html || `<li class="loading">No activities match.</li>`;
}

/** Puts the filter controls back in line with the state and re-renders the list. */
export function syncFilters() {
  find<HTMLSelectElement>("#year").value = state.year;
  find<HTMLSelectElement>("#sort").value = state.sort;
  find<HTMLInputElement>("#q").value = state.query;
  find("#chips")
    .querySelectorAll<HTMLElement>(".chip")
    .forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.g === state.sport)),
    );
  renderList();
}

/** Opens an activity, clearing the filters first if they hide it. */
export function openActivity(id: number) {
  if (!state.listed.some((a) => a.id === id)) {
    setSportFilter("all");
    setYearFilter("all");
    state.query = "";
    syncFilters();
  }
  goToActivity(id);
}

/** Opens the next (1) or previous (-1) activity in the list. */
export function stepThroughList(direction: 1 | -1) {
  const listed = state.listed;
  if (!listed.length) return;
  const i = listed.findIndex((a) => a.id === state.selectedId);
  const next =
    i < 0 ? 0 : Math.max(0, Math.min(listed.length - 1, i + direction));
  goToActivity(listed[next].id);
}
