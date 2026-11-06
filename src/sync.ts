// The Sync button: has the server sync with Garmin Connect, and shows its progress.
import type { SyncEvent } from "./data-format";
import { find } from "./dom";
import { escapeHtml } from "./format";

const HIDE_AFTER_MS = 5000;

let running = false;
let hideTimer: number | undefined;

type Kind = "busy" | "done" | "error";
const TITLES: Record<Kind, string> = {
  busy: "Syncing with Garmin Connect",
  done: "Sync finished",
  error: "Sync failed",
};

/** Escapes the text and turns web addresses into links, which may wrap after a "/" */
const withLinks = (text: string) =>
  escapeHtml(text).replace(
    /https:\/\/([^\s<]+)/g,
    (url, rest: string) =>
      `<a href="${url}" target="_blank" rel="noopener">${rest.replaceAll("/", "/<wbr>")}</a>`,
  );

function showPanel(kind: Kind, text: string, progress: number | null = null) {
  clearTimeout(hideTimer);
  const panel = find("#sync-panel");
  panel.hidden = false;
  panel.dataset.kind = kind;
  find("#sync-title").textContent = TITLES[kind];
  find("#sync-text").innerHTML = withLinks(text);
  const bar = find("#sync-bar");
  bar.hidden = progress == null;
  bar.style.setProperty("--progress", String(progress ?? 0));
  if (kind === "done") hideTimer = setTimeout(hidePanel, HIDE_AFTER_MS);
}

function hidePanel() {
  clearTimeout(hideTimer);
  find("#sync-panel").hidden = true;
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

async function sync(onChange: () => void) {
  if (running) {
    find("#sync-panel").hidden = false;
    return;
  }
  running = true;
  const button = find("#sync");
  button.setAttribute("aria-busy", "true");
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
    running = false;
    button.removeAttribute("aria-busy");
  }
  if (last?.type === "done" && last.changed) onChange();
}

/**
 * Shows the Sync button when the page is served by server/serve.ts, and picks
 * up a sync that is already running. `onChange` runs after a sync changed data/.
 */
export async function initSync(onChange: () => void) {
  let status: { running: boolean };
  try {
    const response = await fetch("api/sync", { cache: "no-store" });
    if (!response.ok) return;
    status = await response.json();
  } catch {
    return;
  }
  const button = find("#sync");
  button.hidden = false;
  button.onclick = () => void sync(onChange);
  find("#sync-close").onclick = hidePanel;
  if (status.running) void sync(onChange);
}
