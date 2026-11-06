<script lang="ts">
  import { app, goToActivity, type Tab } from "./state.svelte";
  import { startSync, sync } from "./sync.svelte";
  import { nextTheme, theme } from "./theme.svelte";

  let { showTabs, onSync }: { showTabs: boolean; onSync: () => void } =
    $props();

  function openTab(tab: Tab) {
    if (tab === "overview") location.hash = "#/overview";
    else if (app.selectedId) goToActivity(app.selectedId);
    else location.hash = "#/";
  }
</script>

<header class="top">
  <div class="brand">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"><path d="M3 17l5-6 4 4 4-7 5 9" /></svg
    >
    <span>Garmin Explorer</span>
  </div>
  <div class="tabs" role="tablist" hidden={!showTabs}>
    <button
      class="tab"
      role="tab"
      aria-selected={app.tab === "activities"}
      onclick={() => openTab("activities")}>Activities</button
    >
    <button
      class="tab"
      role="tab"
      aria-selected={app.tab === "overview"}
      onclick={() => openTab("overview")}>Overview</button
    >
  </div>
  <div class="spacer"></div>
  {#if sync.available}
    <button
      class="icon-btn"
      id="sync"
      title="Download new activities from Garmin Connect"
      aria-busy={sync.running || undefined}
      onclick={() => startSync(onSync)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><path d="M20 12a8 8 0 1 1-2.34-5.66L20 8.5" /><path
          d="M20 3.5v5h-5"
        /></svg
      >
      <span>Sync</span>
    </button>
  {/if}
  <button
    class="icon-btn"
    id="theme"
    title="Theme: {theme.mode}"
    onclick={nextTheme}
  >
    {#if theme.mode === "auto"}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        ><circle cx="12" cy="12" r="8" /><path
          d="M12 4a8 8 0 0 1 0 16z"
          fill="currentColor"
        /></svg
      >
    {:else if theme.mode === "light"}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        ><circle cx="12" cy="12" r="4" /><path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        /></svg
      >
    {:else}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
        ><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg
      >
    {/if}
  </button>
</header>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 16px;
    height: 52px;
    flex: none;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    font-weight: 650;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .brand svg {
    color: var(--accent);
  }
  .tabs {
    display: flex;
    gap: 4px;
  }
  .tab {
    border: 0;
    background: none;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    color: var(--text-2);
  }
  .tab:hover {
    background: var(--surface-2);
  }
  .tab[aria-selected="true"] {
    background: var(--surface-2);
    color: var(--text);
    font-weight: 600;
  }
  .spacer {
    flex: 1;
  }
  #sync[aria-busy="true"] svg {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    #sync[aria-busy="true"] svg {
      animation: none;
    }
  }
  @media (max-width: 760px) {
    .top {
      gap: 8px;
      padding: 0 12px;
    }
    .brand span {
      display: none;
    }
  }
</style>
