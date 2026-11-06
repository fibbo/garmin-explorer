<!-- Stacked bar chart of a metric per year or month, one color per sport. -->
<script lang="ts">
  import { niceStep } from "../format";
  import { type Sport, sportColor } from "../sports";
  import type { Bucket } from "./overview";

  let {
    buckets,
    sports,
    format,
    onclick,
  }: {
    buckets: Bucket[];
    sports: Sport[];
    format: (v: number) => string;
    onclick: (bucket: Bucket) => void;
  } = $props();

  const HEIGHT = 280;
  const PAD = { left: 52, right: 8, top: 10, bottom: 26 };
  /** Gap between stacked segments, in px */
  const SEGMENT_GAP = 2;

  let measuredWidth = $state(0);
  const width = $derived(measuredWidth || 800);

  /** Bar path with rounded top corners */
  const roundedTop = (
    x: number,
    top: number,
    bottom: number,
    width: number,
    r: number,
  ) =>
    `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${bottom}Z`;
  const rect = (x: number, top: number, bottom: number, width: number) =>
    `M${x},${bottom}V${top}H${x + width}V${bottom}Z`;

  const chart = $derived.by(() => {
    const max = Math.max(...buckets.map((b) => b.total), 1e-9),
      step = niceStep(max, 4),
      top = Math.ceil(max / step) * step;
    const plotWidth = width - PAD.left - PAD.right,
      plotHeight = HEIGHT - PAD.top - PAD.bottom,
      slotWidth = plotWidth / buckets.length,
      barWidth = Math.min(44, slotWidth * 0.68);
    const toY = (v: number) => PAD.top + plotHeight - (v / top) * plotHeight;

    const grid: { y: number; label: string }[] = [];
    for (let v = 0; v <= top + 1e-9; v += step)
      grid.push({
        y: toY(v),
        label: v === 0 ? "0" : format(v).replace(/ (km|h|m)$/, ""),
      });

    const bars = buckets.map((b, i) => {
      const center = PAD.left + slotWidth * i + slotWidth / 2,
        x = center - barWidth / 2;
      const stacked = sports.filter((s) => (b.bySport[s.key] ?? 0) > 0);
      const segments: { d: string; color: string }[] = [];
      let sum = 0;
      stacked.forEach((s, j) => {
        const v = b.bySport[s.key] ?? 0;
        const bottom = toY(sum),
          segmentTop = toY(sum + v);
        sum += v;
        const height = Math.max(
          0,
          bottom - segmentTop - (j > 0 ? SEGMENT_GAP : 0),
        );
        if (height <= 0) return;
        const d =
          j === stacked.length - 1
            ? roundedTop(
                x,
                segmentTop,
                segmentTop + height,
                barWidth,
                Math.min(4, height, barWidth / 2),
              )
            : rect(x, segmentTop, segmentTop + height, barWidth);
        segments.push({ d, color: sportColor(s.key) });
      });
      return {
        bucket: b,
        segments,
        center,
        label: slotWidth < 34 ? b.shortLabel : b.label.split(" ")[0],
        hitX: PAD.left + slotWidth * i,
      };
    });
    return { grid, bars, slotWidth, plotHeight };
  });

  let tip = $state.raw<{ bucket: Bucket; x: number; y: number } | null>(null);
  let tipElement = $state<HTMLElement>();

  // Next to the mouse, flipped to the other side near the window edge
  $effect(() => {
    if (!tip || !tipElement) return;
    const size = tipElement.getBoundingClientRect();
    let x = tip.x + 14,
      y = tip.y + 14;
    if (x + size.width > innerWidth - 8) x = tip.x - size.width - 14;
    if (y + size.height > innerHeight - 8) y = tip.y - size.height - 14;
    tipElement.style.left = x + "px";
    tipElement.style.top = y + "px";
  });
</script>

<div bind:clientWidth={measuredWidth}>
  <svg
    class="bars"
    id="bars"
    height={HEIGHT}
    viewBox="0 0 {width} {HEIGHT}"
    role="img"
  >
    {#each chart.grid as line, i (i)}
      <line
        class="grid"
        x1={PAD.left}
        x2={width - PAD.right}
        y1={line.y}
        y2={line.y}
      /><text x={PAD.left - 8} y={line.y + 4} text-anchor="end"
        >{line.label}</text
      >
    {/each}
    {#each chart.bars as bar, i (i)}
      {#each bar.segments as segment, j (j)}
        <path d={segment.d} fill={segment.color} />
      {/each}
      <text x={bar.center} y={HEIGHT - 8} text-anchor="middle">{bar.label}</text
      >
      <!-- Invisible full-height target for hover and click -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <rect
        class="bar-hit"
        data-i={i}
        x={bar.hitX}
        y={PAD.top}
        width={chart.slotWidth}
        height={chart.plotHeight}
        onmousemove={(e) =>
          (tip = { bucket: bar.bucket, x: e.clientX, y: e.clientY })}
        onmouseleave={() => (tip = null)}
        onclick={() => {
          tip = null;
          onclick(bar.bucket);
        }}
      />
    {/each}
  </svg>
</div>

{#if tip}
  {@const b = tip.bucket}
  <div class="tooltip" bind:this={tipElement}>
    <div class="tt-h">{b.label}</div>
    {#each sports
      .filter((s) => b.bySport[s.key])
      .reverse() as sport (sport.key)}
      <div class="tt-r">
        <span
          ><i class="dot" style:background={sportColor(sport.key)}
          ></i>{sport.label}</span
        ><b class="num">{format(b.bySport[sport.key] ?? 0)}</b>
      </div>
    {/each}
    <div class="tt-r total">
      <span>Total · {b.activities.length} activities</span><b class="num"
        >{format(b.total)}</b
      >
    </div>
  </div>
{/if}

<style>
  .bars {
    width: 100%;
    display: block;
  }
  .bars .bar-hit {
    fill: transparent;
    cursor: pointer;
  }
  .bars text {
    fill: var(--muted);
    font-size: 11px;
  }
  .bars .grid {
    stroke: var(--border);
  }
  .tooltip {
    position: fixed;
    z-index: 1000;
    pointer-events: none;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12.5px;
    box-shadow: 0 4px 16px #0000001f;
    min-width: 120px;
  }
  .tt-h {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .tt-r {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  }
  .tt-r span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-2);
  }
  .total {
    border-top: 1px solid var(--border);
    margin-top: 4px;
    padding-top: 4px;
  }
</style>
