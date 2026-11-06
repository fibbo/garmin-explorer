<script lang="ts">
  import { loadTrack } from "../data";
  import { formatDate, formatTime } from "../format";
  import SportBadge from "../SportBadge.svelte";
  import { app, stepThroughList } from "../state.svelte";
  import type { Activity, Track } from "../types";
  import Laps from "./Laps.svelte";
  import RecordingView from "./RecordingView.svelte";
  import { Recording } from "./recording.svelte";
  import { facts, stats } from "./summary";
  import Zones from "./Zones.svelte";
  import { hrZones } from "./zones";

  let { activity: a }: { activity: Activity } = $props();

  /** undefined while loading, null when there is none */
  let track = $state.raw<Track | null | undefined>(undefined);
  const recording = $derived(track ? new Recording(a, track) : null);
  const zones = $derived(track === undefined ? null : hrZones(a, track));
  const showLaps = $derived(!!recording && recording.track.laps.length > 1);

  const position = $derived(app.listed.findIndex((x) => x.id === a.id));
  const isFirst = $derived(position <= 0);
  const isLast = $derived(position < 0 || position >= app.listed.length - 1);

  $effect(() => {
    const activity = a;
    track = undefined;
    if (!activity.hasRecording) {
      track = null;
      return;
    }
    let current = true;
    void loadTrack(activity).then((loaded) => {
      if (current) track = loaded;
    });
    return () => {
      current = false;
    };
  });

  function back() {
    app.detailOpen = false;
    history.replaceState(null, "", "#/");
  }
</script>

<div class="detail-inner">
  <div class="dhead">
    <button class="icon-btn back" id="back" title="Back to list" onclick={back}
      ><svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg
      ></button
    >
    <SportBadge sport={a.sport} />
    <div style="min-width:0">
      <h1>{a.name}</h1>
      <div class="sub">
        {formatDate(a.localStart)} at {formatTime(a.localStart)}{a.location
          ? " · " + a.location
          : ""}{#if a.isPr}{" · "}<span class="pill">PR</span>{/if}
      </div>
    </div>
    <div class="nav">
      <button
        class="icon-btn"
        id="prev"
        title="Newer (↑)"
        disabled={isFirst}
        onclick={() => stepThroughList(-1)}
        ><svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"><path d="M18 15l-6-6-6 6" /></svg
        ></button
      >
      <button
        class="icon-btn"
        id="next"
        title="Older (↓)"
        disabled={isLast}
        onclick={() => stepThroughList(1)}
        ><svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
        ></button
      >
    </div>
  </div>
  <div class="card">
    <div class="tiles">
      {#each stats(a) as stat (stat.label)}
        <div class="tile">
          <div class="l">{stat.label}</div>
          <div class="v num">
            {stat.value}{#if stat.unit}<small>{stat.unit}</small>{/if}
          </div>
        </div>
      {/each}
    </div>
    <div class="facts">
      {#each facts(a) as [label, value] (label)}
        <div><span>{label}</span> <b>{value}</b></div>
      {/each}
    </div>
  </div>
  <div>
    {#if recording}
      {#key recording}
        <RecordingView {recording} />
      {/key}
    {:else if track === undefined}
      <div class="card loading">Loading recording…</div>
    {:else if a.hasRecording}
      <div class="card loading">
        Couldn't load the recording data/fit/{a.id}.fit.
      </div>
    {:else}
      <div class="card loading">
        This activity has no recording (.fit file), only the summary.
      </div>
    {/if}
  </div>
  <div
    class="two"
    style:grid-template-columns={showLaps && zones ? null : "1fr"}
  >
    {#if showLaps && recording}
      <Laps {recording} />
    {/if}
    {#if zones}
      <Zones {zones} />
    {/if}
  </div>
</div>

<style>
  .detail-inner {
    max-width: 1180px;
    margin: 0 auto;
    padding: 20px 24px 48px;
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1fr);
  }
  .detail-inner > * {
    min-width: 0;
  }
  .dhead {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .dhead :global(.badge) {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }
  .dhead :global(.badge svg) {
    width: 24px;
    height: 24px;
  }
  .dhead h1 {
    font-size: 22px;
    line-height: 1.2;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .dhead .sub {
    color: var(--text-2);
    font-size: 13px;
  }
  .dhead .nav {
    margin-left: auto;
    display: flex;
    gap: 6px;
  }
  .back {
    display: none;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 22px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    font-size: 13px;
  }
  .facts span {
    color: var(--muted);
  }
  .facts b {
    font-weight: 550;
  }
  @media (max-width: 760px) {
    .back {
      display: inline-flex;
    }
    .detail-inner {
      padding: 12px 16px 40px;
    }
    .dhead h1 {
      font-size: 18px;
    }
    .dhead .nav {
      display: none;
    }
  }
</style>
