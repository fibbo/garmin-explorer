<!-- The overview page: totals, a bar chart per year or month, totals per sport and records. -->
<script lang="ts">
  import { formatHours, formatNumber } from "../format";
  import { SPORTS, sportColor } from "../sports";
  import { app, goToActivity, goToList } from "../state.svelte";
  import type { SportKey } from "../types";
  import BarChart from "./BarChart.svelte";
  import { type Bucket, buckets, METRICS, sportRows, sum } from "./overview";
  import Records from "./Records.svelte";

  const year = $derived(app.overviewYear);
  const metric = $derived(METRICS[app.overviewMetric] ?? METRICS.dist);
  const shown = $derived(
    app.activities.filter((a) => year === "all" || a.year === +year),
  );
  const sports = $derived(
    SPORTS.filter((s) => shown.some((a) => a.sport === s.key)),
  );
  const bars = $derived(buckets(app.years, year, shown, sports, metric));

  const totals = $derived([
    { label: "Activities", value: formatNumber(shown.length), unit: "" },
    {
      label: "Distance",
      value: formatNumber(sum(shown, (a) => a.distance) / 1000),
      unit: "km",
    },
    {
      label: "Moving time",
      value: formatNumber(sum(shown, (a) => a.activeTime) / 3600),
      unit: "h",
    },
    {
      label: "Elevation gain",
      value: formatNumber(sum(shown, (a) => a.ascent)),
      unit: "m",
    },
    {
      label: "Calories",
      value: formatNumber(sum(shown, (a) => a.calories)),
      unit: "kcal",
    },
  ]);

  /** A sport row lists that sport's activities for the shown year */
  function listSport(sport: SportKey) {
    app.sport = sport;
    app.year = year;
    goToList();
  }

  function openBucket(bucket: Bucket) {
    if (year === "all") app.overviewYear = String(bucket.key);
    else if (bucket.activities.length) {
      // List the whole year, newest first, and open the month's latest activity
      app.clearFilters();
      app.year = year;
      app.sort = "date";
      const latest = bucket.activities.reduce((a, b) =>
        b.start > a.start ? b : a,
      );
      goToActivity(latest.id);
    }
  }
</script>

<main class="view ov">
  <div class="ov-inner">
    <div class="ov-head">
      <h1>{year === "all" ? "All years" : year}</h1>
      <select id="ovYear" aria-label="Year" bind:value={app.overviewYear}>
        <option value="all">All years</option>
        {#each app.years as y (y)}
          <option value={String(y)}>{y}</option>
        {/each}
      </select>
      <div class="seg" id="ovMetric">
        {#each Object.entries(METRICS) as [key, m] (key)}<button
            data-m={key}
            aria-pressed={key === app.overviewMetric}
            onclick={() =>
              (app.overviewMetric = key as typeof app.overviewMetric)}
            >{m.label}</button
          >{/each}
      </div>
    </div>
    <div class="card">
      <div class="tiles">
        {#each totals as total (total.label)}
          <div class="tile">
            <div class="l">{total.label}</div>
            <div class="v num">
              {total.value}{#if total.unit}<small>{total.unit}</small>{/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
    <div class="card">
      <div class="card-h">
        <h2>{metric.label} per {year === "all" ? "year" : "month"}</h2>
        <div class="legend">
          {#each sports as s (s.key)}
            <span><i style:background={sportColor(s.key)}></i>{s.label}</span>
          {/each}
        </div>
        <span class="hint" style="margin-left:auto"
          >{year === "all"
            ? "Click a year to drill in"
            : "Click a month to list its activities"}</span
        >
      </div>
      <div class="card-b">
        <BarChart
          buckets={bars}
          {sports}
          format={metric.format}
          onclick={openBucket}
        />
        <details>
          <summary>Show as table</summary>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{year === "all" ? "Year" : "Month"}</th>
                  {#each sports as s (s.key)}<th>{s.label}</th>{/each}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {#each bars as b (b.key)}
                  <tr>
                    <td>{b.label}</td>
                    {#each sports as s (s.key)}<td
                        >{b.bySport[s.key]
                          ? metric.format(b.bySport[s.key] ?? 0)
                          : "–"}</td
                      >{/each}
                    <td><b>{metric.format(b.total)}</b></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
    <div class="two">
      <div class="card">
        <div class="card-h"><h2>By sport</h2></div>
        <div class="card-b table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sport</th><th>Count</th><th>Distance</th><th>Time</th><th
                  >Climbing</th
                ><th>Avg HR</th>
              </tr>
            </thead>
            <tbody>
              {#each sportRows(shown, sports) as r (r.sport.key)}
                <tr
                  class="click"
                  data-g={r.sport.key}
                  onclick={() => listSport(r.sport.key)}
                >
                  <td
                    ><span class="sport"
                      ><i class="dot" style:background={sportColor(r.sport.key)}
                      ></i>{r.sport.label}</span
                    ></td
                  >
                  <td>{r.count}</td>
                  <td
                    >{r.distance
                      ? formatNumber(r.distance / 1000) + " km"
                      : "–"}</td
                  >
                  <td>{formatHours(r.time)}</td>
                  <td>{r.ascent ? formatNumber(r.ascent) + " m" : "–"}</td>
                  <td>{r.avgHr ? Math.round(r.avgHr) : "–"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Records</h2></div>
        <div class="records">
          <Records activities={shown} />
        </div>
      </div>
    </div>
  </div>
</main>

<style>
  .ov {
    overflow-y: auto;
  }
  .ov-inner {
    max-width: 1180px;
    margin: 0 auto;
    padding: 20px 24px 48px;
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1fr);
  }
  .ov-inner > * {
    min-width: 0;
  }
  .ov-head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .ov-head h1 {
    font-size: 22px;
    margin: 0 8px 0 0;
    letter-spacing: -0.01em;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 12.5px;
    color: var(--text-2);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
  }
  .sport {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .records {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0;
    margin-top: 12px;
  }
  details summary {
    cursor: pointer;
    color: var(--text-2);
    font-size: 13px;
    padding: 4px 0;
  }
  @media (max-width: 760px) {
    .ov-inner {
      padding: 12px 16px 40px;
    }
  }
</style>
