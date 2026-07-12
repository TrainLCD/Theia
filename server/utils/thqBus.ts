import { allCachedLines, resolveLine } from "./lineCatalog";
import type { LineMeta } from "./lineCatalog";

type Listener = (msg: unknown) => void;

const listeners = new Set<Listener>();
const announcedLines = new Set<number>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let warnedMissingToken = false;

const THQ_URL = process.env.THQ_WS_URL ?? "wss://thq.trainlcd.app/ws";
const THQ_TOKEN = process.env.THQ_WS_TOKEN;
const THQ_SUBSCRIBE_DEVICE = process.env.THQ_SUBSCRIBE_DEVICE ?? "theia";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

// Upstream resends its ring buffer (default 1000 events) as a snapshot on every
// reconnect, so events must be deduped by their server-assigned id before fanout.
const seenEventIds = new Set<string>();
const SEEN_IDS_CAP = 2000;

function isDuplicateEvent(id: string): boolean {
  if (seenEventIds.has(id)) return true;
  seenEventIds.add(id);
  if (seenEventIds.size > SEEN_IDS_CAP) {
    const oldest = seenEventIds.values().next().value;
    if (oldest !== undefined) seenEventIds.delete(oldest);
  }
  return false;
}

function broadcast(msg: unknown) {
  for (const l of listeners) {
    try {
      l(msg);
    } catch (e) {
      console.warn("[thq] listener threw", e);
    }
  }
}

export function lineMetaMsg(meta: LineMeta) {
  return {
    type: "_line_meta" as const,
    id: meta.id,
    name: meta.name,
    nameRoman: meta.nameRoman,
    color: meta.color,
    stations: meta.stations,
  };
}

function maybeAnnounceLine(lineId: number) {
  if (announcedLines.has(lineId)) return;
  announcedLines.add(lineId);
  void resolveLine(lineId).then((meta) => {
    if (meta) {
      broadcast(lineMetaMsg(meta));
    } else {
      // Allow a retry on next event for transient failures.
      announcedLines.delete(lineId);
    }
  });
}

function connect() {
  if (ws) return;
  if (!THQ_TOKEN && !warnedMissingToken) {
    warnedMissingToken = true;
    console.warn(
      "[thq] THQ_WS_TOKEN is not set; the upstream only accepts the observer token and rejects the handshake with 401",
    );
  }
  const protocols = THQ_TOKEN ? ["thq", `thq-auth-${THQ_TOKEN}`] : ["thq"];
  let socket: WebSocket;
  try {
    socket = new WebSocket(THQ_URL, protocols);
  } catch (e) {
    console.error("[thq] WebSocket construct failed", e);
    scheduleReconnect();
    return;
  }
  ws = socket;
  socket.addEventListener("open", () => {
    console.log("[thq] upstream open", THQ_URL);
    reconnectAttempts = 0;
    try {
      socket.send(JSON.stringify({ type: "subscribe", device: THQ_SUBSCRIBE_DEVICE }));
    } catch (e) {
      console.error("[thq] subscribe send failed", e);
    }
    broadcast({ type: "_proxy", state: "open" });
  });
  socket.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)) as {
        type?: string;
        line_id?: number;
        id?: string;
      };
      if (typeof msg.id === "string" && isDuplicateEvent(msg.id)) return;
      if (msg.type === "location_update" && typeof msg.line_id === "number") {
        maybeAnnounceLine(msg.line_id);
      }
      broadcast(msg);
    } catch (e) {
      console.warn("[thq] parse failed", e);
    }
  });
  socket.addEventListener("close", (ev) => {
    console.warn("[thq] upstream closed", ev.code, ev.reason);
    broadcast({ type: "_proxy", state: "closed", code: ev.code, reason: ev.reason });
    ws = null;
    scheduleReconnect();
  });
  socket.addEventListener("error", () => {
    broadcast({ type: "_proxy", state: "error" });
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  // No retry cap: this proxy is the app's only upstream link, so it must keep
  // trying; the exponential backoff tops out at RECONNECT_MAX_MS.
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempts, RECONNECT_MAX_MS);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

export function subscribeToThq(listener: Listener): () => void {
  connect();
  for (const meta of allCachedLines()) {
    try {
      listener(lineMetaMsg(meta));
    } catch (e) {
      console.warn("[thq] initial dump listener threw", e);
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const THQ_UPSTREAM_URL = THQ_URL;
