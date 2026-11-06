// Serves Garmin Explorer on http://localhost:8000 and runs the sync when the page asks.
//
// Usage: npm run serve [-- --port 8000 --open]
//
// Only listens on 127.0.0.1. GET /api/sync says whether a sync is running.
// POST /api/sync starts one, unless one is running already, and streams its
// SyncEvents as JSON lines until it ends.
import { execFile, fork } from "node:child_process";
import { createReadStream, type Stats, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { parseArgs } from "node:util";
import type { SyncEvent } from "../src/data-format.ts";

const ROOT = join(import.meta.dirname, "..");
/** The page, built into dist/ by `npm run build` */
const DIST = join(ROOT, "dist");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".fit": "application/octet-stream",
};

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "8000" },
    open: { type: "boolean", default: false },
  },
});
const port = Number(values.port);
const url = `http://localhost:${port}/`;
/** Other host names could point here through DNS rebinding, so only these are served. */
const HOSTS = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);

interface SyncRun {
  events: SyncEvent[];
  listeners: Set<(event: SyncEvent | null) => void>;
}
/** The sync that is running, if any */
let current: SyncRun | null = null;

function startSync(): SyncRun {
  const run: SyncRun = { events: [], listeners: new Set() };
  const emit = (event: SyncEvent | null) => {
    if (event) {
      run.events.push(event);
      console.log(
        event.type === "progress"
          ? `  ${event.done}/${event.total} ${event.text}`
          : event.text,
      );
    }
    run.listeners.forEach((listener) => listener(event));
  };
  const child = fork(join(import.meta.dirname, "sync.ts"), [], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  child.on("message", (event: SyncEvent) => emit(event));
  child.on("error", (error) => console.error(error));
  child.on("close", (code) => {
    const ended = run.events.some(
      (e) => e.type === "done" || e.type === "error",
    );
    if (!ended)
      emit({
        type: "error",
        text: `The sync stopped unexpectedly (exit code ${code}). The terminal running the server shows the details.`,
      });
    current = null;
    emit(null);
  });
  console.log("Sync started");
  return run;
}

function streamSync(res: ServerResponse) {
  const run = (current ??= startSync());
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-store",
  });
  const write = (event: SyncEvent | null) => {
    if (event) res.write(`${JSON.stringify(event)}\n`);
    else {
      run.listeners.delete(write);
      res.end();
    }
  };
  run.events.forEach(write);
  run.listeners.add(write);
  res.on("close", () => run.listeners.delete(write));
}

function serveFile(req: IncomingMessage, res: ServerResponse, path: string) {
  let relative: string;
  try {
    // The leading "/" keeps ".." from leaving the folder
    relative = normalize(decodeURIComponent(path)).slice(1);
  } catch {
    return send(res, 400, "Bad request");
  }
  // Only the page and data/ are served. Everything else in the folder stays private.
  const file = relative.startsWith(`data${sep}`)
    ? join(ROOT, relative)
    : join(DIST, relative || "index.html");
  let stats: Stats;
  try {
    stats = statSync(file);
  } catch {
    return send(res, 404, "Not found");
  }
  if (!stats.isFile()) return send(res, 404, "Not found");
  const etag = `"${stats.size.toString(36)}-${stats.mtimeMs.toString(36)}"`;
  const headers = {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    // Always check for a newer version, but skip the download when it hasn't changed
    "Cache-Control": "no-cache",
    ETag: etag,
  };
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  res.writeHead(200, { ...headers, "Content-Length": stats.size });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

function send(res: ServerResponse, status: number, text: string) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

const server = createServer((req, res) => {
  const host = req.headers.host ?? "";
  if (!HOSTS.has(host)) return send(res, 403, "Forbidden");
  const path = new URL(req.url ?? "/", url).pathname;
  if (path === "/api/sync") {
    if (req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      return res.end(JSON.stringify({ running: !!current }));
    }
    // Other sites can send a POST to localhost too. Browsers add their origin.
    if (req.method === "POST" && req.headers.origin === `http://${host}`)
      return streamSync(res);
    return send(res, req.method === "POST" ? 403 : 405, "Not allowed");
  }
  if (req.method !== "GET" && req.method !== "HEAD")
    return send(res, 405, "Not allowed");
  serveFile(req, res, path);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is in use. Is Garmin Explorer already running? Use --port to pick another one.`
      : error.message,
  );
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Garmin Explorer is running on ${url}`);
  console.log("Press Ctrl+C to stop.");
  if (values.open)
    execFile(process.platform === "darwin" ? "open" : "xdg-open", [url]);
});
