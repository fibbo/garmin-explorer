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

The app is written in TypeScript in `src/`, the server and the scripts in `server/`.
Node runs `server/` directly, without a build step.
`npm run build` type-checks both with `tsc` and bundles the app with esbuild into `dist/app.js` and `dist/app.css`, which `index.html` loads.

```sh
npm install
npm run build   # type-check and bundle
npm run watch   # rebuild the app on every change (no type-check, use `npm run check` for that)
npm run serve   # serve on http://localhost:8000, `-- --port 8001 --open` to change the port and open the browser
```

`serve.command` also installs the packages and rebuilds before it serves the page.

## Layout

- `index.html` - page markup and styles
- `src/` - the app, bundled into `dist/app.js`
  - `main.ts` - entry point and routing
  - `data-format.ts` - the format of `data/index.json` and of the sync progress, shared with `server/`
  - `types.ts` - the activity and track types the app works with
  - `data.ts` - reads `data/` and maps its short keys to the readable names in `types.ts`
  - `fit.ts` - decodes a `.fit` file into a track with Garmin's FIT SDK
  - `state.ts` - the current filters, sort, selection and tab, and the links between pages
  - `storage.ts` - remembers settings in `localStorage`
  - `sync.ts` - the Sync button and its progress panel
  - `theme.ts` - the light, dark and auto theme switch
  - `sports.ts` - sport groups, icons and per-sport rules (pace or speed, cadence per leg)
  - `format.ts` - number, duration, distance, pace and date formatting
  - `dom.ts` - small DOM helpers
  - `css.d.ts` - lets TypeScript import `.css` files, which esbuild bundles into `dist/app.css`
  - `list.ts` - sidebar filters and activity list
  - `detail/` - activity page: summary, laps, HR zones, and the recording (map and charts kept in sync)
  - `overview/` - overview page: totals, bar chart, records
- `server/`
  - `serve.ts` - serves the page on 127.0.0.1 and runs the sync when the page asks
  - `sync.ts` - Garmin Connect Personal API → `data/`
  - `import.ts` - Garmin data export → `data/`
  - `garmin-api.ts` - Personal API client
  - `fit-scan.ts` - reads start times, sessions and VO2 max from a `.fit` file
  - `data-dir.ts` - reads and writes `data/`
- `data/index.json` - all activity summaries, with a format version
- `data/fit/<activityId>.fit` - the original recording of each activity, decoded in the browser at full resolution when the activity is opened.
  The activities of a multisport race (e.g. a triathlon) share one file, and each shows its own session of it.
- `lib/` - Leaflet 1.9.4 (BSD-2-Clause)
- Charts use [uPlot](https://github.com/leeoniya/uPlot) (MIT), zips are read with [fflate](https://github.com/101arrowz/fflate) (MIT)
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
