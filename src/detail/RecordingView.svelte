<script lang="ts">
  import Chart from "./Chart.svelte";
  import { openRecording, type Recording } from "./recording.svelte";
  import TrackMap from "./TrackMap.svelte";

  let { recording: rec }: { recording: Recording } = $props();

  const hasTrack = $derived(rec.gpsPoints.length > 1);
  let chartsSize = $state<DOMRectReadOnly>();

  $effect(() => {
    openRecording.current = rec;
    return () => {
      if (openRecording.current === rec) openRecording.current = null;
    };
  });
</script>

<div class="track">
  {#if hasTrack}
    <div class="card"><TrackMap recording={rec} /></div>
  {/if}
  {#if rec.series.length}
    <div class="card">
      <div class="card-h">
        <h2>Charts</h2>
        {#if rec.hasDistance}
          <div class="seg" id="xmode">
            <button
              data-x="distance"
              aria-pressed={rec.xAxis === "distance"}
              onclick={() => rec.setXAxis("distance")}>Distance</button
            ><button
              data-x="time"
              aria-pressed={rec.xAxis === "time"}
              onclick={() => rec.setXAxis("time")}>Time</button
            >
          </div>
        {/if}
        <span class="hint"
          >Drag to zoom · double-click or Esc to reset{hasTrack
            ? ""
            : " · no GPS track"}</span
        >
        <button
          class="icon-btn reset"
          hidden={!rec.zoom}
          onclick={() => rec.resetZoom()}>Reset zoom</button
        >
        <span class="cursorbar num">{rec.cursorText}</span>
      </div>
      <div class="charts" bind:contentRect={chartsSize}>
        {#key rec.xAxis}
          {#each rec.series as series, k (series.key)}
            <Chart
              recording={rec}
              {series}
              showsXAxis={k === rec.series.length - 1}
              width={chartsSize?.width ?? 0}
            />
          {/each}
        {/key}
      </div>
    </div>
  {/if}
</div>

<style>
  .track {
    display: grid;
    gap: 16px;
  }
  .track > * {
    min-width: 0;
  }
  .reset {
    height: 26px;
    font-size: 12.5px;
  }
  .cursorbar {
    margin-left: auto;
    font-size: 12.5px;
    color: var(--text-2);
  }
  .charts {
    padding: 4px 8px 12px;
  }
</style>
