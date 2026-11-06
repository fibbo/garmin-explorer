<script lang="ts">
  import { onMount } from "svelte";
  import ActivitiesView from "./ActivitiesView.svelte";
  import { DataError, loadActivities, NO_DATA_HELP } from "./data";
  import { openRecording } from "./detail/recording.svelte";
  import Header from "./Header.svelte";
  import Overview from "./overview/Overview.svelte";
  import { app, stepThroughList } from "./state.svelte";
  import { save } from "./storage";
  import { initSync } from "./sync.svelte";
  import SyncPanel from "./SyncPanel.svelte";

  interface Problem {
    title: string;
    /** Trusted HTML */
    html?: string;
    text?: string;
  }

  let loaded = $state(false);
  let problem = $state.raw<Problem | null>(null);

  $effect(() => save("group", app.sport));
  $effect(() => save("year", app.year));
  $effect(() => save("sort", app.sort));
  $effect(() => save("ovMetric", app.overviewMetric));

  /** Loads data/, again after a sync changed it */
  async function load() {
    const hadActivities = app.activities.length > 0;
    try {
      app.setActivities(await loadActivities());
    } catch (error) {
      if (error instanceof DataError)
        problem = { title: error.title, html: error.message };
      else {
        console.error(error);
        problem = {
          title: "Couldn't load your activities",
          text: String(error),
        };
      }
      loaded = true;
      return;
    }
    problem = app.activities.length
      ? null
      : { title: "No activities yet", html: NO_DATA_HELP };
    loaded = true;
    if (!hadActivities) route();
  }

  // Routes: #/ (list), #/a/<activityId> (activity), #/overview
  function route() {
    if (!loaded || problem) return;
    const hash = location.hash;
    if (hash.startsWith("#/overview")) {
      app.tab = "overview";
      return;
    }
    app.tab = "activities";
    const match = hash.match(/^#\/a\/(\d+)/);
    if (match) {
      app.selectedId = Number(match[1]);
      app.detailOpen = app.byId.has(app.selectedId);
      return;
    }
    app.detailOpen = false;
    // On wide screens, open the first activity next to the list
    if (!app.selectedId && app.listed.length && innerWidth > 760)
      app.selectedId = app.listed[0].id;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (
      problem ||
      app.tab !== "activities" ||
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
      if (openRecording.current?.zoom) openRecording.current.resetZoom();
    } else if (e.key === "/") {
      e.preventDefault();
      document.querySelector<HTMLInputElement>("#q")?.focus();
    }
  }

  onMount(() => {
    void initSync(load);
    void load();
  });
</script>

<svelte:window onkeydown={onKeyDown} onhashchange={route} />

<Header showTabs={!problem} onSync={load} />
<SyncPanel />
{#if problem}
  <main class="view">
    <div class="empty">
      <div>
        <h2>{problem.title}</h2>
        <p>
          {#if problem.html}{@html problem.html}{:else}{problem.text}{/if}
        </p>
      </div>
    </div>
  </main>
{:else if loaded}
  <ActivitiesView hidden={app.tab !== "activities"} />
  {#if app.tab === "overview"}
    <Overview />
  {/if}
{/if}
