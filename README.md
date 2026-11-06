# Garmin Explorer

A single-page browser for your Garmin Connect activities: list, filter and open every activity with its map, synced charts, laps and heart-rate zones, plus an overview of totals and records.

It needs [Node.js](https://nodejs.org) 24 or newer.

## Usage

1. Start `serve.command` (double-click it on macOS).
   It builds the app, serves it on <http://localhost:8000> and opens it in the browser.
   The map tiles come from OpenStreetMap, so they need an internet connection.
   Everything else works offline.
2. Click **Sync** to download your activities from Garmin Connect, see [Sync](#sync).
   Or import a Garmin data export, see [Import an export](#import-an-export).

## Sync

The Sync button downloads new activities through the official [Garmin Connect Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-api/).

1. Create a key at <https://connect.garmin.com/app/settings/personalApiToken>.
   It expires after at most a year, and Garmin emails you before that.
2. Set `GARMIN_API_KEY` to the key in the shell that starts Garmin Explorer.

A sync refreshes the summaries of all activities and downloads the `.fit` file of every activity that has none in `data/fit/` yet.
It works on top of an export or on an empty `data/` folder, so the full history can also come from the API alone.
Running it again only fetches what is new.

The page can't call Garmin's API itself, so the server runs the sync and streams its progress to the page.
The key never reaches the page.
`npm run sync` runs the same sync in the terminal.

## Import an export

Request a data export from Garmin, unpack it, then run:

```sh
npm run import -- ~/Downloads/<garmin-export-folder>
```

This reads `DI_CONNECT/DI-Connect-Fitness/*summarizedActivities.json`, scans the `.fit` files inside `DI_CONNECT/DI-Connect-Uploaded-Files/*.zip`, matches them to activities by start time (±2 min) and duration, and writes `data/`.
It replaces `data/index.json`, so sync again afterwards to add activities that are newer than the export.

## Development

The app is written in [Svelte](https://svelte.dev) 5 and TypeScript in `src/`, the server and the scripts in TypeScript in `server/`.
Node runs `server/` directly, without a build step.
`npm run build` type-checks both and builds the app with [Vite](https://vite.dev) into `dist/`, which the server serves.

```sh
npm install
npm run build   # type-check and build
npm run watch   # rebuild the app on every change (no type-check, use `npm run check` for that)
npm run serve   # serve on http://localhost:8000, `-- --port 8001 --open` to change the port and open the browser
npm run format  # format with Prettier
```

`serve.command` also installs the packages and rebuilds before it serves the page.

## Layout

- `index.html` - the page Vite builds the app into
- `src/` - the app
  - `main.ts` - entry point
  - `App.svelte` - loads the activities, routes between the pages and handles the keyboard shortcuts
  - `app.css` - theme colors and the styles shared by several components.
    Each component has its own styles.
  - `state.svelte.ts` - the activities, the filters, the open activity and the overview settings
  - `data-format.ts` - the format of `data/index.json` and of the sync progress, shared with `server/`
  - `types.ts` - the activity and track types the app works with
  - `data.ts` - reads `data/` and maps its short keys to the readable names in `types.ts`
  - `fit.ts` - decodes a `.fit` file into a track with Garmin's FIT SDK.
    It loads with the first recording, as the SDK is large.
  - `Header.svelte`, `SyncPanel.svelte`, `sync.svelte.ts` - the top bar, and the Sync button with its progress panel
  - `theme.svelte.ts` - the light, dark and auto theme switch
  - `ActivitiesView.svelte`, `Sidebar.svelte` - the activities page: filters and list on the left, the open activity on the right
  - `sports.ts`, `SportBadge.svelte` - sport groups, icons and per-sport rules (pace or speed, cadence per leg)
  - `format.ts` - number, duration, distance, pace and date formatting
  - `storage.ts` - remembers settings in `localStorage`
  - `dom.ts` - reads the theme colors for the charts and the map
  - `detail/` - activity page: summary, laps, HR zones, and the recording.
    `recording.svelte.ts` keeps the map (`TrackMap.svelte`) and the charts (`Chart.svelte`) in sync.
  - `overview/` - overview page: totals, bar chart, records
- `server/`
  - `serve.ts` - serves `dist/` and `data/` on 127.0.0.1 and runs the sync when the page asks
  - `sync.ts` - Garmin Connect Personal API → `data/`
  - `import.ts` - Garmin data export → `data/`
  - `garmin-api.ts` - Personal API client
  - `fit-scan.ts` - reads start times, sessions and VO2 max from a `.fit` file
  - `data-dir.ts` - reads and writes `data/`
- `data/index.json` - all activity summaries, with a format version
- `data/fit/<activityId>.fit` - the original recording of each activity, decoded in the browser at full resolution when the activity is opened.
  The activities of a multisport race (e.g. a triathlon) share one file, and each shows its own session of it.
- The map uses [Leaflet](https://leafletjs.com) (BSD-2-Clause), the charts [uPlot](https://github.com/leeoniya/uPlot) (MIT), and zips are read with [fflate](https://github.com/101arrowz/fflate) (MIT)
- `.fit` files are decoded with Garmin's [FIT JavaScript SDK](https://www.npmjs.com/package/@garmin/fitsdk) (`@garmin/fitsdk`), under Garmin's FIT Protocol License, not an open-source license

## Tips

- ↑/↓ (or j/k) step through the list, `/` focuses search, Esc resets chart zoom.
- Drag across any chart to zoom all charts and highlight that stretch on the map.
  Click a lap to zoom to it.
- Links like `http://localhost:8000/#/a/<activityId>` open an activity directly.

## Notes on the data

- Export summary units: distance in cm, durations in ms, speed in 0.1 m/s, elevation in cm, calories in a unit that is ×4.184 kcal.
- Running and walking cadence in `.fit` records and laps is per leg.
  `src/fit.ts` doubles it to steps/min.
- HR zones come from the `.fit` `time_in_zone` message (with bpm limits).
  The summary's `hrTimeInZone_1..5` is the fallback.
- The API summaries have no VO2 max.
  The sync reads it from the undocumented `.fit` message 140 (field 7 × 3.5 / 65536, only when field 29 is non-zero), which matches Garmin's value on every activity checked.
