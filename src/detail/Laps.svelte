<script lang="ts">
  import { columns, lapSamples } from "./laps";
  import type { Recording } from "./recording.svelte";

  let { recording: rec }: { recording: Recording } = $props();

  const laps = $derived(rec.track.laps);
  const shown = $derived(columns(rec.activity, laps));

  function zoomToLap(index: number) {
    const range = lapSamples(rec.track, index);
    if (range) rec.zoomTo(...range, index);
  }
</script>

<div class="card">
  <div class="card-h">
    <h2>Laps</h2>
    <span class="hint">Click a lap to zoom to it</span>
  </div>
  <div class="card-b table-wrap">
    <table>
      <thead>
        <tr>
          {#each shown as column (column.header)}<th>{column.header}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each laps as lap, i (i)}
          <tr
            class="click"
            class:active={rec.activeLap === i}
            data-lap={i}
            onclick={() => zoomToLap(i)}
          >
            {#each shown as column (column.header)}<td>{column.cell(lap, i)}</td
              >{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
