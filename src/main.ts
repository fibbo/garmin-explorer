// Entry point: wires up the page and routes between list, activity and overview.
// Routes: #/ (list), #/a/<activityId> (activity), #/overview
import { activities, DataError, loadActivities, NO_DATA_HELP } from "./data";
import { renderDetail } from "./detail/detail";
import { isZoomed, redrawRecording, resetZoom } from "./detail/recording";
import { find, findOptional } from "./dom";
import { escapeHtml } from "./format";
import { initList, renderList, stepThroughList } from "./list";
import { renderOverview } from "./overview/overview";
import { hideTooltip } from "./overview/tooltip";
import { goToActivity, state } from "./state";
import { initSync } from "./sync";
import { initTheme } from "./theme";

function onThemeChange() {
  redrawRecording();
  if (state.tab === "overview") renderOverview();
}

function showTab(tab: typeof state.tab) {
  state.tab = tab;
  document
    .querySelectorAll<HTMLElement>(".tab")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.tab === tab)),
    );
  find("#view-activities").hidden = tab !== "activities";
  find("#view-overview").hidden = tab !== "overview";
  hideTooltip();
}

function route() {
  const hash = location.hash;
  if (hash.startsWith("#/overview")) {
    showTab("overview");
    renderOverview();
    return;
  }
  showTab("activities");
  const match = hash.match(/^#\/a\/(\d+)/);
  if (match) {
    const id = Number(match[1]);
    if (id !== state.selectedId || !findOptional("#detail .detail-inner"))
      renderDetail(id);
    return;
  }
  document.body.classList.remove("detail-open");
  // On wide screens, open the first activity next to the list
  if (!state.selectedId && state.listed.length && innerWidth > 760)
    renderDetail(state.listed[0].id);
}

function onKeyDown(e: KeyboardEvent) {
  if (
    state.tab !== "activities" ||
    (e.target instanceof Element &&
      e.target.matches("input,select,textarea")) ||
    e.metaKey ||
    e.ctrlKey
  )
    return;
  if (e.key === "ArrowDown" || e.key === "j") {
    e.preventDefault();
    stepThroughList(1);
  } else if (e.key === "ArrowUp" || e.key === "k") {
    e.preventDefault();
    stepThroughList(-1);
  } else if (e.key === "Escape") {
    if (isZoomed()) resetZoom();
  } else if (e.key === "/") {
    e.preventDefault();
    find("#q").focus();
  }
}

let started = false;

/** Shows a message in place of the app. The header stays, for the Sync button. */
function showProblem(title: string, html: string) {
  find(".tabs").hidden = true;
  find("#view-activities").hidden = true;
  find("#view-overview").hidden = true;
  const view = find("#view-problem");
  view.hidden = false;
  view.innerHTML = `<div class="empty"><div><h2>${title}</h2><p>${html}</p></div></div>`;
}

/** Shows what a sync changed in data/ */
async function onSync() {
  if (!started) {
    location.reload();
    return;
  }
  try {
    await loadActivities();
  } catch (error) {
    console.error(error);
    location.reload();
    return;
  }
  initList();
  renderList();
  if (state.tab === "overview") renderOverview();
  // Its recording may have been downloaded just now
  if (state.selectedId && document.body.classList.contains("detail-open"))
    renderDetail(state.selectedId);
}

async function start() {
  initTheme(onThemeChange);
  void initSync(onSync);
  try {
    await loadActivities();
  } catch (error) {
    if (error instanceof DataError) showProblem(error.title, error.message);
    else {
      console.error(error);
      showProblem("Couldn't load your activities", escapeHtml(String(error)));
    }
    return;
  }
  if (!activities.length) {
    showProblem("No activities yet", NO_DATA_HELP);
    return;
  }
  started = true;
  initList();
  renderList();
  document.querySelectorAll<HTMLElement>(".tab").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.tab === "overview") location.hash = "#/overview";
        else if (state.selectedId) goToActivity(state.selectedId);
        else location.hash = "#/";
      }),
  );
  document.addEventListener("keydown", onKeyDown);
  // The bar chart is drawn for the current width. The activity charts resize themselves.
  let resizeTimer: number | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.tab === "overview") renderOverview();
    }, 120);
  });
  window.addEventListener("hashchange", route);
  route();
}

void start();
