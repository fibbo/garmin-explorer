<script lang="ts">
  import { formatDuration } from "../format";
  import type { Zone } from "./zones";

  let { zones }: { zones: Zone[] } = $props();

  const total = $derived(zones.reduce((s, z) => s + z.seconds, 0) || 1);
  const longest = $derived(Math.max(...zones.map((z) => z.seconds)) || 1);
</script>

<div class="card">
  <div class="card-h"><h2>Heart-rate zones</h2></div>
  <div class="card-b">
    {#each zones as z (z.zone)}
      <div class="zone">
        <div>
          {z.zone ? "Zone " + z.zone : "Below Z1"}
          <div class="r">{z.range}</div>
        </div>
        <div class="bar" title={formatDuration(z.seconds)}>
          <i
            style:width="{((z.seconds / longest) * 100).toFixed(1)}%"
            style:background={z.zone ? `var(--z${z.zone})` : "var(--s-other)"}
          ></i>
        </div>
        <div class="tv">
          {formatDuration(z.seconds)} · {Math.round((z.seconds / total) * 100)}%
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .zone {
    display: grid;
    grid-template-columns: 112px 1fr 92px;
    gap: 10px;
    align-items: center;
    padding: 5px 0;
    font-size: 13px;
  }
  .zone .bar {
    height: 14px;
    background: var(--surface-2);
    border-radius: 4px;
    overflow: hidden;
  }
  .zone .bar i {
    display: block;
    height: 100%;
    border-radius: 0 4px 4px 0;
  }
  .zone .r {
    color: var(--muted);
    font-size: 12px;
  }
  .zone .tv {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--text-2);
  }
</style>
