// The activity detail page: header, summary stats, recording, laps and HR zones.
import { activityById, loadTrack } from "../data";
import { eventTarget, find, findOptional } from "../dom";
import {
  escapeHtml,
  formatDate,
  formatDistance,
  formatDuration,
  formatKmh,
  formatNumber,
  formatPace,
  formatTime,
  paceUnit,
  speedStat,
  type Stat,
} from "../format";
import { stepThroughList } from "../list";
import {
  activityTypeLabel,
  isOnFoot,
  isSwim,
  sportBadge,
  usesPace,
} from "../sports";
import { state } from "../state";
import type { Activity, Track } from "../types";
import { lapSamples, lapsCard } from "./laps";
import { closeRecording, showRecording, zoomTo } from "./recording";
import { zonesCard } from "./zones";

const NO_RECORDING =
  "This activity has no recording (.fit file), only the summary.";

function stats(a: Activity): Stat[] {
  return [
    a.distance
      ? {
          label: "Distance",
          value: formatDistance(a.distance, a, false),
          unit: isSwim(a) ? "m" : "km",
        }
      : null,
    { label: "Moving time", value: formatDuration(a.activeTime) },
    speedStat(a),
    a.avgHr
      ? { label: "Avg heart rate", value: Math.round(a.avgHr), unit: "bpm" }
      : null,
    a.ascent
      ? { label: "Elevation gain", value: formatNumber(a.ascent), unit: "m" }
      : null,
    a.calories
      ? { label: "Calories", value: formatNumber(a.calories), unit: "kcal" }
      : null,
  ].filter((s) => s != null);
}

/** Label and value pairs below the stats */
function facts(a: Activity): [string, string | number][] {
  const cadenceUnit = isOnFoot(a) ? " spm" : a.sport === "bike" ? " rpm" : "";
  const list: ([string, string | number] | null)[] = [
    ["Sport", activityTypeLabel(a.type)],
    a.elapsedTime && a.activeTime && a.elapsedTime - a.activeTime > 30
      ? ["Elapsed", formatDuration(a.elapsedTime)]
      : null,
    a.maxHr ? ["Max HR", `${Math.round(a.maxHr)} bpm`] : null,
    a.maxSpeed && a.avgSpeed && !isSwim(a)
      ? usesPace(a)
        ? ["Best pace", formatPace(a.maxSpeed, a) + " " + paceUnit(a)]
        : ["Max speed", formatKmh(a.maxSpeed) + " km/h"]
      : null,
    a.avgCadence
      ? ["Avg cadence", `${Math.round(a.avgCadence)}${cadenceUnit}`]
      : null,
    a.avgPower
      ? [
          "Avg power",
          `${Math.round(a.avgPower)} W${a.normPower ? ` · NP ${Math.round(a.normPower)} W` : ""}`,
        ]
      : null,
    a.aerobicEffect
      ? [
          "Training effect",
          `${a.aerobicEffect.toFixed(1)} aerobic${a.anaerobicEffect ? ` · ${a.anaerobicEffect.toFixed(1)} anaerobic` : ""}`,
        ]
      : null,
    a.trainingEffectLabel
      ? ["Focus", activityTypeLabel(a.trainingEffectLabel.toLowerCase())]
      : null,
    a.trainingLoad ? ["Training load", formatNumber(a.trainingLoad)] : null,
    a.vo2max ? ["VO₂ max", a.vo2max] : null,
    a.steps ? ["Steps", formatNumber(a.steps)] : null,
    a.descent ? ["Descent", `${formatNumber(a.descent)} m`] : null,
  ];
  return list.filter((f) => f != null);
}

function markSelected(id: number) {
  document
    .querySelectorAll(".item[aria-selected=true]")
    .forEach((item) => item.setAttribute("aria-selected", "false"));
  const item = findOptional(`.item[data-id="${id}"]`);
  if (item) {
    item.setAttribute("aria-selected", "true");
    item.scrollIntoView({ block: "nearest" });
  }
}

const ICON_UP = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>`;
const ICON_DOWN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
const ICON_BACK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`;

export async function renderDetail(id: number) {
  const a = activityById.get(id);
  const page = find("#detail");
  if (!a) {
    page.innerHTML = `<div class="empty">Select an activity on the left.</div>`;
    return;
  }
  state.selectedId = id;
  markSelected(id);
  document.body.classList.add("detail-open");

  const position = state.listed.findIndex((x) => x.id === id);
  const isFirst = position <= 0,
    isLast = position < 0 || position >= state.listed.length - 1;
  page.innerHTML = `<div class="detail-inner">
    <div class="dhead">
      <button class="icon-btn back" id="back" title="Back to list">${ICON_BACK}</button>
      ${sportBadge(a)}
      <div style="min-width:0"><h1>${escapeHtml(a.name)}</h1>
        <div class="sub">${formatDate(a.localStart)} at ${formatTime(a.localStart)}${a.location ? " · " + escapeHtml(a.location) : ""}${a.isPr ? ' · <span class="pill">PR</span>' : ""}</div></div>
      <div class="nav">
        <button class="icon-btn" id="prev" title="Newer (↑)" ${isFirst ? "disabled" : ""}>${ICON_UP}</button>
        <button class="icon-btn" id="next" title="Older (↓)" ${isLast ? "disabled" : ""}>${ICON_DOWN}</button>
      </div>
    </div>
    <div class="card">
      <div class="tiles">${stats(a)
        .map(
          (s) =>
            `<div class="tile"><div class="l">${s.label}</div><div class="v num">${s.value}${s.unit ? `<small>${s.unit}</small>` : ""}</div></div>`,
        )
        .join("")}</div>
      <div class="facts">${facts(a)
        .map(
          ([label, value]) =>
            `<div><span>${label}</span> <b>${escapeHtml(value)}</b></div>`,
        )
        .join("")}</div>
    </div>
    <div id="trackArea"><div class="card loading">${a.hasRecording ? "Loading recording…" : NO_RECORDING}</div></div>
    <div class="two" id="lower"></div>
  </div>`;
  find("#back").onclick = () => {
    document.body.classList.remove("detail-open");
    history.replaceState(null, "", "#/");
  };
  find("#prev").onclick = () => stepThroughList(-1);
  find("#next").onclick = () => stepThroughList(1);
  page.scrollTop = 0;

  closeRecording();
  const track = a.hasRecording ? await loadTrack(a) : null;
  if (state.selectedId !== id) return; // another activity was opened meanwhile
  const trackArea = find("#trackArea");
  if (track) showRecording(a, track, trackArea);
  else if (a.hasRecording)
    trackArea.innerHTML = `<div class="card loading">Couldn't load the recording data/fit/${id}.fit.</div>`;
  renderLower(a, track);
}

function renderLower(a: Activity, track: Track | null) {
  const cards = [
    track ? lapsCard(a, track.laps) : "",
    zonesCard(a, track),
  ].filter((card) => card);
  const lower = find("#lower");
  lower.innerHTML = cards.join("");
  if (cards.length < 2) lower.style.gridTemplateColumns = "1fr";
  lower.onclick = (e) => {
    const row = eventTarget(e, "tr[data-lap]");
    if (!row || !track) return;
    const range = lapSamples(track, Number(row.dataset.lap));
    if (!range) return;
    lower
      .querySelectorAll("tr.active")
      .forEach((r) => r.classList.remove("active"));
    row.classList.add("active");
    zoomTo(...range);
  };
}
