<script lang="ts">
  import { tick } from "svelte";
  import {
    formatDate,
    formatDistance,
    formatDuration,
    formatHours,
    formatTime,
    MONTHS,
    speedStat,
  } from "./format";
  import SportBadge from "./SportBadge.svelte";
  import { SPORTS, sportColor } from "./sports";
  import { app, goToActivity } from "./state.svelte";
  import type { Activity, SportKey } from "./types";

  const SEARCH_DELAY_MS = 80;

  let list: HTMLElement;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  const counts = $derived.by(() => {
    const counts: Partial<Record<SportKey, number>> = {};
    for (const a of app.activities)
      counts[a.sport] = (counts[a.sport] ?? 0) + 1;
    return counts;
  });

  const totals = $derived({
    distance: app.listed.reduce((s, a) => s + (a.distance || 0), 0),
    time: app.listed.reduce((s, a) => s + (a.activeTime || 0), 0),
  });

  /** The listed activities, with a month heading before each new month when sorted by date */
  const rows = $derived.by(() => {
    const byMonth = app.sort.startsWith("date");
    const rows: ({ month: string } | { activity: Activity })[] = [];
    let lastMonth: string | null = null;
    for (const activity of app.listed) {
      if (byMonth) {
        const month = `${MONTHS[activity.localStart.getUTCMonth()]} ${activity.year}`;
        if (month !== lastMonth) {
          lastMonth = month;
          rows.push({ month });
        }
      }
      rows.push({ activity });
    }
    return rows;
  });

  function metrics(a: Activity) {
    const speed = speedStat(a);
    return [
      a.distance ? formatDistance(a.distance, a) : null,
      formatDuration(a.activeTime),
      speed
        ? `${speed.value}${speed.unit === "km/h" ? " km/h" : speed.unit}`
        : null,
      a.avgHr ? `♥ ${Math.round(a.avgHr)}` : null,
    ].filter((m) => m != null);
  }

  function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      app.query = app.search.trim().toLowerCase();
    }, SEARCH_DELAY_MS);
  }

  // Keep the open activity in view
  $effect(() => {
    if (app.selectedId == null) return;
    void tick().then(() =>
      list
        .querySelector(".item[aria-selected=true]")
        ?.scrollIntoView({ block: "nearest" }),
    );
  });
</script>

<div class="filters">
  <input
    class="search"
    id="q"
    type="search"
    placeholder="Search name or place"
    autocomplete="off"
    bind:value={app.search}
    oninput={onSearch}
  />
  <div class="chips">
    <button
      class="chip"
      data-g="all"
      aria-pressed={app.sport === "all"}
      onclick={() => (app.sport = "all")}
      >All <span class="n">{app.activities.length}</span></button
    >
    {#each SPORTS.filter((s) => counts[s.key]) as sport (sport.key)}
      <button
        class="chip"
        data-g={sport.key}
        aria-pressed={app.sport === sport.key}
        onclick={() => (app.sport = sport.key)}
        ><i class="dot" style:background={sportColor(sport.key)}
        ></i>{sport.label}
        <span class="n">{counts[sport.key]}</span></button
      >
    {/each}
  </div>
  <div class="row">
    <select id="year" aria-label="Year" bind:value={app.year}>
      <option value="all">All years</option>
      {#each app.years as year (year)}
        <option value={String(year)}>{year}</option>
      {/each}
    </select>
    <select id="sort" aria-label="Sort" bind:value={app.sort}>
      <option value="date">Newest first</option>
      <option value="date-asc">Oldest first</option>
      <option value="dist">Longest distance</option>
      <option value="dur">Longest time</option>
      <option value="up">Most climbing</option>
      <option value="hr">Highest avg HR</option>
    </select>
  </div>
</div>
<div class="count">
  <span
    >{app.listed.length} activities · {Math.round(
      totals.distance / 1000,
    ).toLocaleString()} km · {formatHours(totals.time)}</span
  ><span><span class="kbd">↑</span> <span class="kbd">↓</span> to browse</span>
</div>
<ul
  class="list"
  role="listbox"
  aria-label="Activities"
  tabindex="0"
  bind:this={list}
>
  {#each rows as row ("month" in row ? row.month : row.activity.id)}
    {#if "month" in row}
      <li class="month-h" role="presentation">{row.month}</li>
    {:else}
      {@const a = row.activity}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        class="item"
        role="option"
        data-id={a.id}
        aria-selected={a.id === app.selectedId}
        onclick={() => goToActivity(a.id)}
      >
        <SportBadge sport={a.sport} />
        <div style="min-width:0">
          <div class="t">{a.name}</div>
          <div class="m num">
            {#each metrics(a) as metric, i}{#if i}<span>·</span
                >{/if}{metric}{/each}
          </div>
          <div class="d">
            {formatDate(a.localStart)} · {formatTime(a.localStart)}{a.location
              ? " · " + a.location
              : ""}
          </div>
        </div>
      </li>
    {/if}
  {:else}
    <li class="loading" role="presentation">No activities match.</li>
  {/each}
</ul>

<style>
  .filters {
    padding: 12px;
    display: grid;
    gap: 8px;
    border-bottom: 1px solid var(--border);
  }
  .search {
    width: 100%;
    height: 34px;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0 10px 0 32px;
    background: var(--surface-2)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%237a7974' stroke-width='2' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")
      no-repeat 10px center;
  }
  .search:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row select {
    flex: 1;
    min-width: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 999px;
    padding: 3px 10px 3px 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--text-2);
  }
  .chip:hover {
    background: var(--surface-2);
  }
  .chip[aria-pressed="true"] {
    background: var(--accent-soft);
    border-color: transparent;
    color: var(--text);
    font-weight: 600;
  }
  .chip .n {
    color: var(--muted);
    font-weight: 400;
  }
  .count {
    padding: 6px 14px;
    font-size: 12px;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
  }
  .kbd {
    font-size: 11px;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 4px;
    color: var(--muted);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    overflow-y: auto;
    flex: 1;
  }
  .month-h {
    position: sticky;
    top: -4px;
    z-index: 1;
    background: var(--surface);
    padding: 8px 14px 4px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
  }
  .item {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 10px;
    padding: 8px 14px;
    cursor: pointer;
    border-left: 3px solid transparent;
    scroll-margin-top: 34px;
  }
  .item:hover {
    background: var(--surface-2);
  }
  .item[aria-selected="true"] {
    background: var(--select);
    border-left-color: var(--accent);
  }
  .item .t {
    font-weight: 550;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item .m {
    font-size: 12.5px;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item .m span {
    margin: 0 6px;
  }
  .item .d {
    font-size: 12px;
    color: var(--muted);
  }
</style>
