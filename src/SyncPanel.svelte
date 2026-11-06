<script lang="ts">
  import { hidePanel, type PanelKind, sync } from "./sync.svelte";

  const TITLES: Record<PanelKind, string> = {
    busy: "Syncing with Garmin Connect",
    done: "Sync finished",
    error: "Sync failed",
  };

  /** The text split into plain parts and web addresses */
  const parts = (text: string) =>
    text.split(/(https:\/\/[^\s]+)/).map((part, i) => ({
      text: part,
      isLink: i % 2 === 1,
    }));
</script>

{#if sync.panel}
  <div
    class="sync-panel card"
    id="sync-panel"
    class:error={sync.panel.kind === "error"}
    role="status"
    hidden={!sync.panelOpen}
  >
    <div class="sync-head">
      <b>{TITLES[sync.panel.kind]}</b><button
        class="sync-close"
        aria-label="Close"
        onclick={hidePanel}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg
        >
      </button>
    </div>
    <div class="sync-text">
      {#each parts(sync.panel.text) as part}{#if part.isLink}<a
            href={part.text}
            target="_blank"
            rel="noopener"
            >{#each part.text
              .slice("https://".length)
              .split("/") as piece, i}{#if i}/<wbr />{/if}{piece}{/each}</a
          >{:else}{part.text}{/if}{/each}
    </div>
    {#if sync.panel.progress != null}
      <div class="sync-bar" style:--progress={sync.panel.progress}></div>
    {/if}
  </div>
{/if}

<style>
  .sync-panel {
    position: fixed;
    top: 60px;
    right: 16px;
    z-index: 1100;
    width: min(340px, calc(100vw - 32px));
    padding: 10px 12px 12px 14px;
    box-shadow: 0 4px 16px #0000001f;
    font-size: 13px;
  }
  .sync-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .error .sync-head b {
    color: var(--s8);
  }
  .sync-close {
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
    width: 24px;
    height: 24px;
    margin-right: -4px;
    display: grid;
    place-items: center;
    border-radius: 6px;
  }
  .sync-close:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .sync-text {
    color: var(--text-2);
    margin-top: 2px;
    overflow-wrap: break-word;
  }
  .sync-text a {
    color: var(--accent);
  }
  .sync-bar {
    height: 4px;
    margin-top: 10px;
    border-radius: 2px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .sync-bar::before {
    content: "";
    display: block;
    height: 100%;
    background: var(--accent);
    width: calc(var(--progress, 0) * 100%);
    transition: width 0.2s;
  }
</style>
