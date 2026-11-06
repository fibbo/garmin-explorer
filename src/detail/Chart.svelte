<script lang="ts">
  import { onMount } from "svelte";
  import uPlot from "uplot";
  import { watchTheme } from "../theme.svelte";
  import { chartOptions, yRange } from "./charts";
  import type { Recording } from "./recording.svelte";
  import type { ChartSeries } from "./series";

  let {
    recording: rec,
    series,
    showsXAxis,
    width,
  }: {
    recording: Recording;
    series: ChartSeries;
    showsXAxis: boolean;
    /** Width of the charts, 0 until known */
    width: number;
  } = $props();

  let plotArea: HTMLElement;
  let plot: uPlot;
  let unit = $state("");

  /** One value per plot point */
  const values = $derived(rec.axis.plotSamples.map((i) => series.values[i]));
  const average = $derived.by(() => {
    const defined = values.filter((v) => v != null);
    return `avg ${series.format(defined.reduce((s, v) => s + v, 0) / (defined.length || 1))} ${series.unit}`;
  });
  /** The average, or the value under the cursor */
  const valueText = $derived.by(() => {
    const p = rec.cursorIndex;
    if (p == null) return average;
    const v = values[p];
    return v == null ? "–" : `${series.format(v)} ${series.unit}`;
  });

  let range: [number, number] = [0, 1];

  onMount(() => {
    const [first, last] = rec.visible;
    range = yRange(series, values, first, last);
    plot = new uPlot(
      chartOptions({
        series,
        xAxis: rec.xAxis,
        plotSamples: rec.axis.plotSamples,
        width: plotArea.clientWidth,
        showsXAxis,
        yRange: () => range,
        onUnit: (u) => (unit = u),
        onHover: (sample, source) => rec.hoverSample(sample, source),
        onZoom: (from, to) => rec.zoomTo(from, to),
        onResetZoom: () => rec.resetZoom(),
      }),
      [rec.axis.plotX, values],
      plotArea,
    );
    // uPlot has no touch support, so move the cursor on touch ourselves.
    plot.over.addEventListener(
      "touchmove",
      (e) => {
        const left =
          e.touches[0].clientX - plot.over.getBoundingClientRect().left;
        rec.hoverSample(rec.axis.plotSamples[plot.posToIdx(left)] ?? null);
      },
      { passive: true },
    );
    plot.over.addEventListener("touchend", () => rec.hoverSample(null));
    return () => plot.destroy();
  });

  // Show the zoomed range, with the y range fitted to it
  $effect(() => {
    const [first, last] = rec.visible;
    const { plotX } = rec.axis;
    if (!plotX.length) return;
    range = yRange(series, values, first, last);
    plot.setScale("x", { min: plotX[first], max: plotX[last] });
  });

  // Follow the cursor of the other charts and the map
  $effect(() => {
    const p = rec.cursorIndex;
    if (rec.hover.source === plot) return;
    plot.setCursor(
      {
        left: p == null ? -10 : plot.valToPos(rec.axis.plotX[p], "x"),
        top: 0,
      },
      false,
    );
  });

  $effect(() => {
    if (width && plot.width !== width)
      plot.setSize({ width, height: plot.height });
  });

  $effect(() => {
    watchTheme();
    plot.redraw(false);
  });
</script>

<div class="chart">
  <div class="chart-h">
    <span class="name"
      ><i class="dot" style:background="var({series.colorVar})"
      ></i>{series.name}</span
    >
    <span class="val num">{valueText}</span>
  </div>
  <div class="chart-w" bind:this={plotArea}>
    <span class="x-unit">{unit}</span>
  </div>
</div>

<style>
  .chart {
    position: relative;
  }
  .chart-h {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 8px 0 54px;
    font-size: 12.5px;
  }
  .chart-h .name {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .chart-h .val {
    color: var(--text-2);
  }
  .chart-w {
    position: relative;
  }
  .chart-w :global(.u-over) {
    cursor: crosshair;
    touch-action: pan-y;
  }
  .chart-w :global(.u-select) {
    background: var(--accent-soft);
  }
  .chart-w :global(.u-hz .u-cursor-x) {
    border-right: 1px dashed var(--text-2);
  }
  .x-unit {
    position: absolute;
    right: 2px;
    bottom: 4px;
    z-index: 1;
    font:
      11px/1 system-ui,
      sans-serif;
    color: var(--muted);
    pointer-events: none;
  }
</style>
