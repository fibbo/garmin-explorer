#!/bin/bash
# Builds Garmin Explorer, serves it on http://localhost:8000 and opens it in the browser.
# The Sync button in the page downloads new activities from Garmin Connect; it needs GARMIN_API_KEY.
# Close this window (or Ctrl+C) to stop.
cd "$(dirname "$0")"
PORT="${1:-8000}"
if ! node -e 'process.exit(+process.versions.node.split(".")[0] < 24)' 2>/dev/null; then
  echo "Garmin Explorer needs Node.js 24 or newer: https://nodejs.org"
  exit 1
fi
# Install the packages on the first run, and again when package-lock.json changed
if [ package-lock.json -nt node_modules/.package-lock.json ] && ! npm ci --silent; then
  echo "npm ci failed."
fi
if ! npm run --silent build; then
  echo "Build failed, serving the last build in dist/."
fi
exec node server/serve.ts --port "$PORT" --open
