import { LINE_DEFS, LINE_MAP } from "./data";
import type {
  AlertEntry,
  Comm,
  FormattedAlert,
  LineDef,
  LineView,
  Status,
  Train,
  TrainView,
} from "./types";
import { fmtTime } from "./utils";

export const statusColor = (s: Status) =>
  s === "error" ? "#ef4444" : s === "warn" ? "#f59e0b" : "#22c55e";

export const statusLabel = (s: Status) =>
  s === "error" ? "エラー" : s === "warn" ? "警告" : "正常";

export const confColorOf = (c: number) => (c < 50 ? "#ef4444" : c < 75 ? "#f59e0b" : "#22c55e");

export const commLabelOf = (c: Comm) => (c === "ok" ? "正常" : c === "weak" ? "微弱" : "断");

export const commColorOf = (c: Comm) =>
  c === "ok" ? "#22c55e" : c === "weak" ? "#f59e0b" : "#ef4444";

export function trainStatus(tr: Train): Status {
  if (tr.errors.some((e) => e.sev === "E")) return "error";
  if (tr.errors.some((e) => e.sev === "W") || tr.conf < 50 || tr.comm === "lost") return "warn";
  return "normal";
}

function nextStation(tr: Train, line: LineDef): string {
  const n = line.stations.length;
  const idx = tr.pos * (n - 1);
  const ni = tr.dir > 0 ? Math.ceil(idx + 0.001) : Math.floor(idx - 0.001);
  return line.stations[Math.max(0, Math.min(n - 1, ni))]!;
}

export function deriveTrain(tr: Train): TrainView {
  const line = LINE_MAP[tr.lineId]!;
  const st = trainStatus(tr);
  const sc = statusColor(st);
  const meters = Math.round(((100 - tr.conf) / 100) * 30) + 1;
  const conf = Math.round(tr.conf);
  const cc = confColorOf(conf);
  const errs = tr.errors.map((e) => ({
    code: e.code,
    label: e.label,
    sev: e.sev,
    color: e.sev === "E" ? "#ef4444" : "#f59e0b",
    bg: e.sev === "E" ? "#1f0d0d" : "#1c1403",
  }));
  return {
    id: tr.id,
    no: tr.no,
    type: tr.type,
    typeColor: tr.typeColor,
    cars: tr.cars,
    lineId: tr.lineId,
    lineName: line.name,
    lineColor: line.color,
    leftPct: tr.pos * 100,
    dir: tr.dir,
    dirGlyph: tr.dir > 0 ? "▶" : "◀",
    dirText: (tr.dir > 0 ? line.stations[line.stations.length - 1]! : line.stations[0]!) + "方面",
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
    speed: Math.round(tr.speed),
    speedPct: Math.round((tr.speed / tr.maxSpeed) * 100),
    conf,
    confColor: cc,
    meters,
    comm: tr.comm,
    commLabel: commLabelOf(tr.comm),
    commColor: commColorOf(tr.comm),
    errors: errs,
    hasErrors: errs.length > 0,
    noErrors: errs.length === 0,
    errorCodes: errs.length ? errs.map((e) => e.code).join(" ") : "—",
    nextStation: nextStation(tr, line),
  };
}

export function buildLineViews(views: TrainView[]): LineView[] {
  const byLine: Record<string, TrainView[]> = {};
  views.forEach((t) => {
    (byLine[t.lineId] = byLine[t.lineId] || []).push(t);
  });
  return LINE_DEFS.map((l) => {
    const trs = byLine[l.id] || [];
    return {
      def: l,
      stations: l.stations.map((s, i) => ({
        name: s,
        leftPct: (i / (l.stations.length - 1)) * 100,
      })),
      trains: trs,
      trainCount: trs.length,
      alertCount: trs.filter((t) => t.isAlert).length,
      hasAlert: trs.some((t) => t.isAlert),
    };
  });
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
  return {
    total,
    running: views.filter((t) => t.speed > 3).length,
    alerts: views.filter((t) => t.isAlert).length,
    err: views.filter((t) => t.status === "error").length,
    warn: views.filter((t) => t.status === "warn").length,
    normal: views.filter((t) => t.status === "normal").length,
    commBad: views.filter((t) => t.comm !== "ok").length,
    avgMeters: total ? Math.round(views.reduce((a, b) => a + b.meters, 0) / len) : 0,
    avgSpeed: total ? Math.round(views.reduce((a, b) => a + b.speed, 0) / len) : 0,
  };
}

export function formatAlerts(alerts: AlertEntry[]): FormattedAlert[] {
  return alerts.map((a) => ({
    time: fmtTime(a.ts),
    no: a.no,
    line: a.line,
    lineColor: a.lineColor,
    code: a.code,
    label: a.label,
    color: a.kind === "clear" ? "#22c55e" : a.sev === "E" ? "#ef4444" : "#f59e0b",
    tagBg: a.kind === "clear" ? "#0c1a13" : a.sev === "E" ? "#1f0d0d" : "#1c1403",
    tag: a.kind === "clear" ? "復旧" : a.sev === "E" ? "エラー" : "警告",
  }));
}
