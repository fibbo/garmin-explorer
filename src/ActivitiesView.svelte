<script lang="ts">
  import Detail from "./detail/Detail.svelte";
  import Sidebar from "./Sidebar.svelte";
  import { app } from "./state.svelte";

  let { hidden }: { hidden: boolean } = $props();

  let detailPane: HTMLElement;
  const activity = $derived(
    app.selectedId == null ? null : app.byId.get(app.selectedId),
  );

  $effect(() => {
    void app.selectedId;
    detailPane.scrollTop = 0;
  });
</script>

<main class="view split" class:detail-open={app.detailOpen} {hidden}>
  <aside class="sidebar"><Sidebar /></aside>
  <section class="detail" id="detail" bind:this={detailPane}>
    {#if activity}
      {#key activity.id}
        <Detail {activity} />
      {/key}
    {:else if app.selectedId != null}
      <div class="empty">Select an activity on the left.</div>
    {/if}
  </section>
</main>

<style>
  .split {
    display: flex;
  }
  .sidebar {
    width: 360px;
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--surface);
    border-right: 1px solid var(--border);
  }
  .detail {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
  }
  @media (max-width: 760px) {
    .sidebar {
      width: 100%;
      border-right: 0;
    }
    .detail {
      display: none;
    }
    .detail-open .sidebar {
      display: none;
    }
    .detail-open .detail {
      display: block;
    }
  }
</style>
