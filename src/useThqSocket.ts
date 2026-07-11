import { useEffect, useState } from "react";
import { lineMetaFor, projectToLeftPct } from "./derive";
import type {
  AlertEntry,
  Device,
  DeviceError,
  ExternalLineMeta,
  MovementState,
  Severity,
  TravelDir,
} from "./types";

export type ThqConnectionState = "connecting" | "open" | "closed" | "error";

export interface ThqCoords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
}

export interface ThqLocationUpdate {
  id: string;
  type: "location_update";
  session_id?: string;
  device: string;
  state: MovementState;
  station_id?: number | null;
  line_id: number;
  coords: ThqCoords;
  timestamp: number;
  segment_id?: string | null;
  from_station_id?: number | null;
  to_station_id?: number | null;
  battery_level?: number | null;
  battery_state?: 0 | 1 | 2 | 3 | null;
}

export interface ThqLogEvent {
  id: string;
  type: "log";
  session_id?: string;
  // ログは匿名送信が可能なため device が null になり得る。
  device: string | null;
  app_version?: string;
  platform?: "ios" | "android" | "macos" | "unknown";
  channel?: "production" | "canary";
  timestamp: number;
  log: {
    type: "system" | "app" | "client";
    level: "debug" | "info" | "warn" | "error";
    message: string;
  };
}

export interface ThqInteractionEvent {
  id: string;
  type: "interaction";
  session_id?: string;
  device: string | null;
  app_version?: string;
  platform?: "ios" | "android" | "macos" | "unknown";
  channel?: "production" | "canary";
  timestamp: number;
  event_name: string;
  properties: Record<string, string | number | boolean | null> | null;
}

export interface ThqErrorMessage {
  type: "error";
  error: { type: string; reason: string };
}

export interface ThqProxyEvent {
  type: "_proxy";
  state: "open" | "closed" | "error";
  code?: number;
  reason?: string;
}

export interface ThqLineMetaEvent {
  type: "_line_meta";
  id: number;
  name: string;
  nameRoman: string | null;
  color: string;
  stations: {
    id: number;
    name: string;
    nameRoman: string | null;
    latitude: number;
    longitude: number;
  }[];
}

export type ThqMessage =
  | ThqLocationUpdate
  | ThqLogEvent
  | ThqInteractionEvent
  | ThqErrorMessage
  | ThqProxyEvent
  | ThqLineMetaEvent;

export interface ThqDevicesState {
  connection: ThqConnectionState;
  received: number;
  lastError: string | null;
  devices: Map<string, Device>;
  alerts: AlertEntry[];
  lineMetadata: Map<number, ExternalLineMeta>;
  latestLocation: ThqLocationUpdate | null;
  latestLog: ThqLogEvent | null;
  now: number;
}

/** Kept as the LiveStatusBar's prop name. */
export type ThqSocketState = ThqDevicesState;

const ERROR_TTL_MS = 60_000;
const ALERTS_CAP = 40;

const INITIAL: ThqDevicesState = {
  connection: "connecting",
  received: 0,
  lastError: null,
  devices: new Map(),
  alerts: [],
  lineMetadata: new Map(),
  latestLocation: null,
  latestLog: null,
  now: 0,
};

function freshDevice(deviceId: string, ts: number): Device {
  return {
    deviceId,
    lineId: null,
    stationId: null,
    movementState: null,
    latitude: null,
    longitude: null,
    accuracy: null,
    speed: 0,
    lastSeenAt: ts,
    activeErrors: new Map(),
    lastLeftPct: null,
    travelDir: 0,
    headAngle: null,
    batteryLevel: null,
    batteryState: null,
  };
}

const TRAVEL_DELTA_THRESHOLD = 0.2;
// Squared (dLat,dLon) threshold to filter GPS noise (~10m at Tokyo latitude).
const HEAD_ANGLE_SQDIST_THRESHOLD = 1e-8;

function computeHeadAngle(
  prevLat: number | null,
  prevLon: number | null,
  lat: number,
  lon: number,
): number | null {
  if (prevLat == null || prevLon == null) return null;
  const dLat = lat - prevLat;
  const dLon = lon - prevLon;
  if (dLat * dLat + dLon * dLon < HEAD_ANGLE_SQDIST_THRESHOLD) return null;
  // Screen Y is inverted vs latitude (north = top = smaller y).
  return (Math.atan2(-dLat, dLon) * 180) / Math.PI;
}

function synthesizeCode(type: string, level: string): string {
  const t = type === "system" ? "SYS" : type === "app" ? "APP" : "CLT";
  const l = level === "error" ? "E" : "W";
  return `${t}-${l}`;
}

function applyLocation(
  state: ThqDevicesState,
  msg: ThqLocationUpdate,
  ts: number,
): ThqDevicesState {
  const devices = new Map(state.devices);
  const prev = devices.get(msg.device) ?? freshDevice(msg.device, msg.timestamp || ts);

  const lineMeta = state.lineMetadata.get(msg.line_id);
  const newLeftPct = projectToLeftPct(
    msg.station_id ?? null,
    msg.coords.latitude,
    msg.coords.longitude,
    lineMeta?.stations ?? [],
  );

  let travelDir: TravelDir = prev.travelDir;
  if (newLeftPct != null && prev.lastLeftPct != null && prev.lineId === msg.line_id) {
    const delta = newLeftPct - prev.lastLeftPct;
    if (Math.abs(delta) > TRAVEL_DELTA_THRESHOLD) travelDir = delta > 0 ? 1 : -1;
  } else if (prev.lineId !== msg.line_id) {
    travelDir = 0;
  }

  const headAngle =
    computeHeadAngle(prev.latitude, prev.longitude, msg.coords.latitude, msg.coords.longitude) ??
    prev.headAngle;

  const next: Device = {
    ...prev,
    lineId: msg.line_id,
    stationId: msg.station_id ?? null,
    movementState: msg.state,
    latitude: msg.coords.latitude,
    longitude: msg.coords.longitude,
    accuracy: msg.coords.accuracy ?? null,
    speed: msg.coords.speed ?? 0,
    lastSeenAt: msg.timestamp || ts,
    lastLeftPct: newLeftPct,
    travelDir,
    headAngle,
    // null は「不明」なので直近の既知値を保持する。
    batteryLevel: msg.battery_level ?? prev.batteryLevel,
    batteryState: msg.battery_state ?? prev.batteryState,
  };
  devices.set(msg.device, next);
  return {
    ...state,
    received: state.received + 1,
    devices,
    latestLocation: msg,
  };
}

function applyLog(state: ThqDevicesState, msg: ThqLogEvent, ts: number): ThqDevicesState {
  const base: ThqDevicesState = {
    ...state,
    received: state.received + 1,
    latestLog: msg,
  };
  if (msg.log.level !== "warn" && msg.log.level !== "error") return base;

  const sev: Severity = msg.log.level === "error" ? "E" : "W";
  const code = synthesizeCode(msg.log.type, msg.log.level);
  const label = msg.log.message;
  const errTs = msg.timestamp || ts;

  // 匿名ログ (device: null) は端末に紐付けられないため、アラートのみ記録する。
  if (msg.device == null) {
    const alert: AlertEntry = {
      ts: errTs,
      device: "匿名",
      lineId: null,
      lineColor: "#6b7d9c",
      code,
      label,
      sev,
    };
    return { ...base, alerts: [alert, ...base.alerts].slice(0, ALERTS_CAP) };
  }

  const devices = new Map(base.devices);
  const prev = devices.get(msg.device) ?? freshDevice(msg.device, errTs);
  const activeErrors = new Map(prev.activeErrors);
  const errKey = `${msg.log.type}:${msg.log.level}:${label}`;
  const err: DeviceError = { code, message: label, sev, ts: errTs };
  activeErrors.set(errKey, err);
  const nextDevice: Device = { ...prev, activeErrors };
  devices.set(msg.device, nextDevice);

  const meta = nextDevice.lineId != null ? lineMetaFor(nextDevice.lineId, base.lineMetadata) : null;
  const alert: AlertEntry = {
    ts: errTs,
    device: msg.device,
    lineId: nextDevice.lineId,
    lineColor: meta?.color ?? "#6b7d9c",
    code,
    label,
    sev,
  };
  const alerts = [alert, ...base.alerts].slice(0, ALERTS_CAP);

  return { ...base, devices, alerts };
}

function applyLineMeta(state: ThqDevicesState, msg: ThqLineMetaEvent): ThqDevicesState {
  const lineMetadata = new Map(state.lineMetadata);
  lineMetadata.set(msg.id, {
    id: msg.id,
    name: msg.name,
    nameRoman: msg.nameRoman,
    color: msg.color,
    stations: msg.stations ?? [],
  });
  return { ...state, lineMetadata };
}

function applyProxy(state: ThqDevicesState, msg: ThqProxyEvent): ThqDevicesState {
  if (msg.state === "open") return { ...state, lastError: null };
  if (msg.state === "closed") {
    const reason = msg.reason ? `: ${msg.reason}` : "";
    const code = msg.code ? ` (${msg.code})` : "";
    return { ...state, lastError: `upstream closed${code}${reason}` };
  }
  return { ...state, lastError: "upstream error" };
}

function pruneStaleErrors(state: ThqDevicesState, now: number): ThqDevicesState {
  let changedAny = false;
  const devices = new Map<string, Device>();
  for (const [id, d] of state.devices) {
    let changed = false;
    const next = new Map(d.activeErrors);
    for (const [k, e] of d.activeErrors) {
      if (now - e.ts > ERROR_TTL_MS) {
        next.delete(k);
        changed = true;
      }
    }
    if (changed) {
      devices.set(id, { ...d, activeErrors: next });
      changedAny = true;
    } else {
      devices.set(id, d);
    }
  }
  return { ...state, now, devices: changedAny ? devices : state.devices };
}

export function useThqDevices(path: string = "/api/thq-events"): ThqDevicesState {
  // now は 0 で初期化し、実時刻は useEffect で入れる。
  // 初期レンダーで Date.now() を使うと SSR とクライアントで値がずれて hydration mismatch になる。
  const [state, setState] = useState<ThqDevicesState>(INITIAL);

  useEffect(() => {
    setState({ ...INITIAL, connection: "connecting", now: Date.now() });
    const source = new EventSource(path);

    source.addEventListener("open", () => {
      setState((s) => ({ ...s, connection: "open" }));
    });

    source.addEventListener("error", () => {
      setState((s) => ({ ...s, connection: s.connection === "open" ? "closed" : "error" }));
    });

    source.addEventListener("message", (ev: MessageEvent<string>) => {
      let msg: ThqMessage;
      try {
        msg = JSON.parse(ev.data) as ThqMessage;
      } catch (e) {
        setState((s) => ({
          ...s,
          lastError: `parse failed: ${e instanceof Error ? e.message : String(e)}`,
        }));
        return;
      }
      const ts = Date.now();
      setState((s) => {
        if (msg.type === "location_update") return applyLocation(s, msg, ts);
        if (msg.type === "log") return applyLog(s, msg, ts);
        if (msg.type === "interaction") return { ...s, received: s.received + 1 };
        if (msg.type === "error")
          return { ...s, lastError: `${msg.error.type}: ${msg.error.reason}` };
        if (msg.type === "_proxy") return applyProxy(s, msg);
        if (msg.type === "_line_meta") return applyLineMeta(s, msg);
        return s;
      });
    });

    const tickId = setInterval(() => {
      setState((s) => pruneStaleErrors(s, Date.now()));
    }, 1000);

    return () => {
      source.close();
      clearInterval(tickId);
    };
  }, [path]);

  return state;
}
