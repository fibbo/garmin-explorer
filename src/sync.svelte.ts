// Has the server sync with Garmin Connect, and keeps the progress for the sync panel.
import type { SyncEvent } from "./data-format";

const HIDE_AFTER_MS = 5000;

export type PanelKind = "busy" | "done" | "error";

export const sync = $state({
  /** The page is served by server/serve.ts, which can sync */
  available: false,
  running: false,
  /** The panel can be closed while the sync goes on */
  panelOpen: false,
  panel: null as {
    kind: PanelKind;
    text: string;
    /** 0 to 1, null when unknown */
    progress: number | null;
  } | null,
});

let hideTimer: ReturnType<typeof setTimeout> | undefined;
/** Closed during the sync: progress doesn't open it again, the end does */
let closedWhileBusy = false;

function showPanel(
  kind: PanelKind,
  text: string,
  progress: number | null = null,
) {
  clearTimeout(hideTimer);
  sync.panel = { kind, text, progress };
  if (kind !== "busy" || !closedWhileBusy) sync.panelOpen = true;
  if (kind === "done") hideTimer = setTimeout(hidePanel, HIDE_AFTER_MS);
}

export function hidePanel() {
  clearTimeout(hideTimer);
  sync.panelOpen = false;
  closedWhileBusy = sync.running;
}

function showEvent(event: SyncEvent) {
  if (event.type === "progress")
    showPanel(
      "busy",
      `${event.done} of ${event.total} · ${event.text}`,
      event.done / event.total,
    );
  else if (event.type === "status") showPanel("busy", event.text);
  else showPanel(event.type, event.text);
}

/** The JSON lines of a streamed response, as they arrive */
async function* readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (line) yield JSON.parse(line) as SyncEvent;
    }
  }
}

/** Starts a sync, or follows the one that is running. `onChange` runs after it changed data/. */
export async function startSync(onChange: () => void) {
  closedWhileBusy = false;
  if (sync.running) {
    sync.panelOpen = true;
    return;
  }
  sync.running = true;
  showPanel("busy", "Starting");
  let last: SyncEvent | null = null;
  try {
    const response = await fetch("api/sync", { method: "POST" });
    if (!response.ok || !response.body)
      throw new Error(`HTTP ${response.status}`);
    for await (const event of readEvents(response.body)) {
      last = event;
      showEvent(event);
    }
    if (last?.type !== "done" && last?.type !== "error")
      throw new Error("The response ended early");
  } catch (error) {
    console.error("Sync:", error);
    last = null;
    showPanel(
      "error",
      "Lost the connection to the Garmin Explorer server. Is it still running?",
    );
  } finally {
    sync.running = false;
  }
  if (last?.type === "done" && last.changed) onChange();
}

/** Shows the Sync button when the server can sync, and follows a sync that is already running. */
export async function initSync(onChange: () => void) {
  let status: { running: boolean };
  try {
    const response = await fetch("api/sync", { cache: "no-store" });
    if (!response.ok) return;
    status = await response.json();
  } catch {
    return;
  }
  sync.available = true;
  if (status.running) void startSync(onChange);
}
