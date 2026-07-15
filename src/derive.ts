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
  MapBounds,
  MapData,
  MapLineView,
  MapTrainView,
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

export const commLabelOf = (c: Comm) => (c === "ok" ? "正常" : c === "weak" ? "微弱" : "不通");

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

  const batteryPct =
    device.batteryLevel != null
      ? Math.max(0, Math.min(100, Math.round(device.batteryLevel * 100)))
      : null;
  const batteryCharging = device.batteryState === 2;
  const batteryColor =
    batteryPct == null
      ? "#6b7d9c"
      : batteryPct <= 20
        ? "#ef4444"
        : batteryPct <= 40
          ? "#f59e0b"
          : "#22c55e";

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
    headAngle: device.headAngle,
    latitude: device.latitude,
    longitude: device.longitude,
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
    speed: Math.round(device.speed * 3.6),
    speedPct: Math.min(100, Math.round(((device.speed * 3.6) / ASSUMED_MAX_SPEED) * 100)),
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
    batteryPct,
    batteryCharging,
    batteryColor,
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
      nameRoman: s.nameRoman,
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

function computeMapBounds(points: { lat: number; lon: number }[]): MapBounds | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  const padLat = Math.max((maxLat - minLat) * 0.06, 0.001);
  const padLon = Math.max((maxLon - minLon) * 0.06, 0.001);
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLon: minLon - padLon,
    maxLon: maxLon + padLon,
  };
}

function projectGeo(lat: number, lon: number, bounds: MapBounds): { x: number; y: number } {
  const latSpread = bounds.maxLat - bounds.minLat;
  const lonSpread = bounds.maxLon - bounds.minLon;
  const x = lonSpread > 0 ? ((lon - bounds.minLon) / lonSpread) * 100 : 50;
  const y = latSpread > 0 ? ((bounds.maxLat - lat) / latSpread) * 100 : 50;
  return { x, y };
}

export function buildMapData(
  views: TrainView[],
  externalLines: Map<number, ExternalLineMeta>,
): MapData {
  const lineEntries = Array.from(externalLines.entries()).sort((a, b) => a[0] - b[0]);
  if (lineEntries.length === 0) return { lines: [], trains: [], bounds: null };

  const points: { lat: number; lon: number }[] = [];
  for (const [, ext] of lineEntries) {
    for (const s of ext.stations) points.push({ lat: s.latitude, lon: s.longitude });
  }
  for (const v of views) {
    if (v.latitude != null && v.longitude != null) {
      points.push({ lat: v.latitude, lon: v.longitude });
    }
  }
  const bounds = computeMapBounds(points);
  if (!bounds) return { lines: [], trains: [], bounds: null };

  const countByLine = new Map<number, number>();
  for (const v of views) {
    if (v.lineId != null) countByLine.set(v.lineId, (countByLine.get(v.lineId) ?? 0) + 1);
  }

  const lines: MapLineView[] = lineEntries.map(([id, ext]) => {
    const projected = ext.stations.map((s) => {
      const p = projectGeo(s.latitude, s.longitude, bounds);
      return { id: s.id, name: s.name, nameRoman: s.nameRoman, x: p.x, y: p.y };
    });
    return {
      meta: lineMetaFor(id, externalLines),
      pointsStr: projected.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "),
      stations: projected,
      count: countByLine.get(id) ?? 0,
    };
  });

  const trains: MapTrainView[] = views.map((v) => {
    if (v.latitude == null || v.longitude == null) {
      return { ...v, mapX: 50, mapY: 50, headAngle: 0, hasMapPosition: false };
    }
    const p = projectGeo(v.latitude, v.longitude, bounds);
    return { ...v, mapX: p.x, mapY: p.y, headAngle: v.headAngle ?? 0, hasMapPosition: true };
  });

  return { lines, trains, bounds };
}

// projectGeo は線形写像なので、投影済みの % 座標を可視要素の範囲で再正規化すれば、
// 地理座標から bounds を計算し直すのと同じ結果になる。パディング率は computeMapBounds と揃える。
function computeVisibleViewBox(
  data: MapData,
  hiddenLineIds: ReadonlySet<number>,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const line of data.lines) {
    if (hiddenLineIds.has(line.meta.id)) continue;
    for (const st of line.stations) add(st.x, st.y);
  }
  for (const tr of data.trains) {
    if (!tr.hasMapPosition) continue;
    if (tr.lineId != null && hiddenLineIds.has(tr.lineId)) continue;
    add(tr.mapX, tr.mapY);
  }
  if (minX === Infinity) return null;
  const padX = Math.max((maxX - minX) * 0.06, 0.001);
  const padY = Math.max((maxY - minY) * 0.06, 0.001);
  return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
}

export function refitMapData(data: MapData, hiddenLineIds: ReadonlySet<number>): MapData {
  if (hiddenLineIds.size === 0) return data;
  const box = computeVisibleViewBox(data, hiddenLineIds);
  if (!box) return data;
  const xSpread = box.maxX - box.minX;
  const ySpread = box.maxY - box.minY;
  const fx = (x: number) => (xSpread > 0 ? ((x - box.minX) / xSpread) * 100 : 50);
  const fy = (y: number) => (ySpread > 0 ? ((y - box.minY) / ySpread) * 100 : 50);
  const lines = data.lines.map((line) => {
    const stations = line.stations.map((st) => ({ ...st, x: fx(st.x), y: fy(st.y) }));
    return {
      ...line,
      stations,
      pointsStr: stations.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "),
    };
  });
  const trains = data.trains.map((tr) =>
    tr.hasMapPosition ? { ...tr, mapX: fx(tr.mapX), mapY: fy(tr.mapY) } : tr,
  );
  return { ...data, lines, trains };
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
