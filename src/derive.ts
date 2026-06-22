import type {
  AlertEntry,
  Comm,
  Device,
  ExternalLineMeta,
  ExternalStation,
  FormattedAlert,
  LineMeta,
  LineStationView,
  LineView,
  MovementState,
  Status,
  TrainView,
} from "./types";
import { fmtTime } from "./utils";

const LINE_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#06b6d4",
  "#f59e0b",
  "#a78bfa",
  "#f43f5e",
  "#ec4899",
  "#22c55e",
  "#facc15",
  "#8b5cf6",
];

const ASSUMED_MAX_SPEED = 200;
const STALE_WARN_SEC = 15;
const STALE_LOST_SEC = 45;

const STATE_LABEL: Record<MovementState, string> = {
  moving: "走行",
  arrived: "停車",
  approaching: "接近",
  passing: "通過",
};

const STATE_COLOR: Record<MovementState, string> = {
  moving: "#38bdf8",
  arrived: "#22c55e",
  approaching: "#f59e0b",
  passing: "#94a3b8",
};

const STATE_GLYPH: Record<MovementState, string> = {
  moving: "▶",
  arrived: "●",
  approaching: "▶",
  passing: "▷",
};

export function lineMetaFor(lineId: number, external?: Map<number, ExternalLineMeta>): LineMeta {
  const ext = external?.get(lineId);
  if (ext) {
    return { id: ext.id, name: ext.name, color: ext.color };
  }
  return {
    id: lineId,
    color: LINE_PALETTE[Math.abs(lineId) % LINE_PALETTE.length]!,
    name: `Line ${lineId}`,
  };
}

export const statusColor = (s: Status) =>
  s === "error" ? "#ef4444" : s === "warn" ? "#f59e0b" : "#22c55e";

export const statusLabel = (s: Status) =>
  s === "error" ? "エラー" : s === "warn" ? "警告" : "正常";

export const confColorOf = (c: number) => (c < 50 ? "#ef4444" : c < 75 ? "#f59e0b" : "#22c55e");

export const commLabelOf = (c: Comm) => (c === "ok" ? "正常" : c === "weak" ? "微弱" : "断");

export const commColorOf = (c: Comm) =>
  c === "ok" ? "#22c55e" : c === "weak" ? "#f59e0b" : "#ef4444";

export function computeComm(accuracy: number | null, staleSec: number): Comm {
  if (staleSec > STALE_LOST_SEC) return "lost";
  if (accuracy != null && accuracy > 100) return "lost";
  if (staleSec > STALE_WARN_SEC) return "weak";
  if (accuracy != null && accuracy > 20) return "weak";
  return "ok";
}

function computeStatus(device: Device, comm: Comm): Status {
  const errs = Array.from(device.activeErrors.values());
  if (errs.some((e) => e.sev === "E")) return "error";
  if (errs.some((e) => e.sev === "W") || comm === "lost" || comm === "weak") return "warn";
  return "normal";
}

function confFromAccuracy(accuracy: number | null): number {
  if (accuracy == null) return 50;
  const c = Math.max(0, Math.min(99, 99 - accuracy));
  return Math.round(c);
}

function projectIndex(lat: number, lon: number, stations: ExternalStation[]): number {
  let bestDist = Infinity;
  let bestStart = 0;
  let bestT = 0;
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i]!;
    const b = stations[i + 1]!;
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = ((lon - a.longitude) * dx + (lat - a.latitude) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const projLon = a.longitude + t * dx;
    const projLat = a.latitude + t * dy;
    const ddx = lon - projLon;
    const ddy = lat - projLat;
    const dist = ddx * ddx + ddy * ddy;
    if (dist < bestDist) {
      bestDist = dist;
      bestStart = i;
      bestT = t;
    }
  }
  return bestStart + bestT;
}

export function projectToLeftPct(
  stationId: number | null,
  latitude: number | null,
  longitude: number | null,
  stations: ExternalStation[],
): number | null {
  if (stations.length === 0) return null;
  const denom = Math.max(1, stations.length - 1);
  if (stationId != null) {
    const idx = stations.findIndex((s) => s.id === stationId);
    if (idx >= 0) return (idx / denom) * 100;
  }
  if (latitude != null && longitude != null) {
    return (projectIndex(latitude, longitude, stations) / denom) * 100;
  }
  return null;
}

function computePosition(
  device: Device,
  stations: ExternalStation[],
): { leftPct: number; hasPosition: boolean } {
  const pct = projectToLeftPct(device.stationId, device.latitude, device.longitude, stations);
  if (pct == null) return { leftPct: 0, hasPosition: false };
  return { leftPct: pct, hasPosition: true };
}

function nearestStation(
  lat: number,
  lon: number,
  stations: ExternalStation[],
): ExternalStation | null {
  let bestDist = Infinity;
  let best: ExternalStation | null = null;
  for (const s of stations) {
    const dx = lon - s.longitude;
    const dy = lat - s.latitude;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

export function deriveTrain(
  device: Device,
  now: number,
  externalLines?: Map<number, ExternalLineMeta>,
): TrainView {
  const staleSec = Math.max(0, Math.floor((now - device.lastSeenAt) / 1000));
  const comm = computeComm(device.accuracy, staleSec);
  const st = computeStatus(device, comm);
  const sc = statusColor(st);
  const conf = confFromAccuracy(device.accuracy);
  const cc = confColorOf(conf);
  const meters = device.accuracy != null ? Math.round(device.accuracy) : null;

  const errs = Array.from(device.activeErrors.values()).map((e) => ({
    code: e.code,
    label: e.message,
    sev: e.sev,
    color: e.sev === "E" ? "#ef4444" : "#f59e0b",
    bg: e.sev === "E" ? "#1f0d0d" : "#1c1403",
  }));

  const externalMeta = device.lineId != null ? externalLines?.get(device.lineId) : null;
  const stations = externalMeta?.stations ?? [];
  const meta = device.lineId != null ? lineMetaFor(device.lineId, externalLines) : null;
  const movementState = device.movementState;
  const stateLabel = movementState ? STATE_LABEL[movementState] : "—";
  const stateColor = movementState ? STATE_COLOR[movementState] : "#6b7d9c";
  const stateGlyph = movementState ? STATE_GLYPH[movementState] : "·";

  const positionResult = computePosition(device, stations);

  let nextStation = "—";
  const namedStation = (id: number) => stations.find((s) => s.id === id)?.name ?? `S${id}`;
  if (device.stationId != null) {
    const name = namedStation(device.stationId);
    if (movementState === "arrived") nextStation = `${name} 停車中`;
    else if (movementState === "approaching") nextStation = `→ ${name}`;
    else if (movementState === "passing") nextStation = `${name} 通過`;
    else nextStation = name;
  } else if (device.latitude != null && device.longitude != null && stations.length > 0) {
    const near = nearestStation(device.latitude, device.longitude, stations);
    if (near) nextStation = `${near.name} 付近`;
  }

  return {
    id: device.deviceId,
    no: device.deviceId,
    type: stateLabel,
    typeColor: stateColor,
    lineId: device.lineId,
    lineName: meta?.name ?? "未割当",
    lineColor: meta?.color ?? "#6b7d9c",
    leftPct: positionResult.leftPct,
    hasPosition: positionResult.hasPosition,
    travelDir: device.travelDir,
    movementState,
    dirGlyph: stateGlyph,
    dirText: stateLabel,
    status: st,
    statusColor: sc,
    statusLabel: statusLabel(st),
    isAlert: st !== "normal",
    glowColor:
      st === "normal"
        ? "rgba(34,197,94,.25)"
        : st === "error"
          ? "rgba(239,68,68,.5)"
          : "rgba(245,158,11,.45)",
    speed: Math.round(device.speed),
    speedPct: Math.min(100, Math.round((device.speed / ASSUMED_MAX_SPEED) * 100)),
    conf,
    confColor: cc,
    meters,
    comm,
    commLabel: commLabelOf(comm),
    commColor: commColorOf(comm),
    errors: errs,
    hasErrors: errs.length > 0,
    noErrors: errs.length === 0,
    errorCodes: errs.length ? errs.map((e) => e.code).join(" ") : "—",
    nextStation,
    staleSec,
  };
}

export function buildLineViews(
  views: TrainView[],
  externalLines?: Map<number, ExternalLineMeta>,
): LineView[] {
  const byLine = new Map<number, TrainView[]>();
  const unassigned: TrainView[] = [];
  for (const v of views) {
    if (v.lineId == null) unassigned.push(v);
    else {
      const arr = byLine.get(v.lineId);
      if (arr) arr.push(v);
      else byLine.set(v.lineId, [v]);
    }
  }
  const sortedIds = Array.from(byLine.keys()).sort((a, b) => a - b);
  const out: LineView[] = sortedIds.map((id) => {
    const devices = byLine.get(id)!;
    const ext = externalLines?.get(id);
    const extStations = ext?.stations ?? [];
    const denom = Math.max(1, extStations.length - 1);
    const stations: LineStationView[] = extStations.map((s, i) => ({
      id: s.id,
      name: s.name,
      leftPct: (i / denom) * 100,
    }));
    return {
      meta: lineMetaFor(id, externalLines),
      devices,
      stations,
      trainCount: devices.length,
      alertCount: devices.filter((t) => t.isAlert).length,
      hasAlert: devices.some((t) => t.isAlert),
    };
  });
  if (unassigned.length > 0) {
    out.push({
      meta: { id: -1, color: "#6b7d9c", name: "未割当" },
      devices: unassigned,
      stations: [],
      trainCount: unassigned.length,
      alertCount: unassigned.filter((t) => t.isAlert).length,
      hasAlert: unassigned.some((t) => t.isAlert),
    });
  }
  return out;
}

export interface Kpi {
  total: number;
  running: number;
  alerts: number;
  err: number;
  warn: number;
  normal: number;
  commBad: number;
  avgMeters: number;
  avgSpeed: number;
}

export function computeKpi(views: TrainView[]): Kpi {
  const total = views.length;
  const len = Math.max(1, total);
  const accSamples = views.filter((v) => v.meters != null);
  return {
    total,
    running: views.filter((t) => t.speed > 3).length,
    alerts: views.filter((t) => t.isAlert).length,
    err: views.filter((t) => t.status === "error").length,
    warn: views.filter((t) => t.status === "warn").length,
    normal: views.filter((t) => t.status === "normal").length,
    commBad: views.filter((t) => t.comm !== "ok").length,
    avgMeters: accSamples.length
      ? Math.round(accSamples.reduce((a, b) => a + (b.meters ?? 0), 0) / accSamples.length)
      : 0,
    avgSpeed: total ? Math.round(views.reduce((a, b) => a + b.speed, 0) / len) : 0,
  };
}

export function formatAlerts(
  alerts: AlertEntry[],
  externalLines?: Map<number, ExternalLineMeta>,
): FormattedAlert[] {
  return alerts.map((a) => ({
    time: fmtTime(a.ts),
    device: a.device,
    line: a.lineId != null ? (externalLines?.get(a.lineId)?.name ?? `Line ${a.lineId}`) : "未割当",
    lineColor:
      a.lineId != null ? (externalLines?.get(a.lineId)?.color ?? a.lineColor) : a.lineColor,
    code: a.code,
    label: a.label,
    color: a.sev === "E" ? "#ef4444" : "#f59e0b",
    tagBg: a.sev === "E" ? "#1f0d0d" : "#1c1403",
    tag: a.sev === "E" ? "エラー" : "警告",
  }));
}
