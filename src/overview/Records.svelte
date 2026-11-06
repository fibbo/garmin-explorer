<script lang="ts">
  import { formatDate } from "../format";
  import SportBadge from "../SportBadge.svelte";
  import { openActivity } from "../state.svelte";
  import type { Activity } from "../types";
  import { records } from "./records";

  let { activities }: { activities: Activity[] } = $props();
</script>

{#each records(activities) as { label, activity: a, value } (label)}
  {#if a}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="rec" data-id={a.id} onclick={() => openActivity(a.id)}>
      <SportBadge sport={a.sport} />
      <div style="min-width:0">
        <div class="l">{label}</div>
        <div class="v num">{value(a)}</div>
        <div class="s">{a.name} · {formatDate(a.localStart)}</div>
      </div>
    </div>
  {/if}
{/each}

<style>
  .rec {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    cursor: pointer;
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 10px;
    align-items: center;
  }
  .rec:hover {
    background: var(--surface-2);
  }
  .rec .l {
    font-size: 12px;
    color: var(--muted);
  }
  .rec .v {
    font-weight: 600;
  }
  .rec .s {
    font-size: 12px;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
