<script lang="ts">
  import { onMount } from "svelte";
  import { watchTheme } from "../theme.svelte";
  import { createTrackMap, type TrackMap } from "./map";
  import type { Recording } from "./recording.svelte";

  let { recording: rec }: { recording: Recording } = $props();

  let element: HTMLElement;
  let map: TrackMap;

  onMount(() => {
    map = createTrackMap(element, rec.gpsPoints, (i) =>
      rec.hoverSample(i == null ? null : rec.gpsSamples[i]),
    );
    return () => map.remove();
  });

  $effect(() => map.showCursor(rec.cursorPosition));

  let zoomed = false;
  $effect(() => {
    const positions = rec.zoomedPositions;
    if (positions) map.highlight(positions);
    else if (zoomed) map.clearHighlight();
    zoomed = !!positions;
  });

  $effect(() => {
    watchTheme();
    map.applyTheme();
  });
</script>

<div id="map" bind:this={element}></div>

<style>
  #map {
    height: 360px;
    border-radius: 0 0 var(--radius) var(--radius);
    background: var(--surface-2);
  }
  @media (max-width: 760px) {
    #map {
      height: 280px;
    }
  }
</style>
