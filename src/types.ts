export type View = "network" | "line" | "engineer";
export type Filter = "all" | "alert" | "error" | "comm";
export type Comm = "ok" | "weak" | "lost";
export type Status = "normal" | "warn" | "error";
export type Severity = "E" | "W";

export interface LineDef {
  id: string;
  name: string;
  color: string;
  lengthKm: number;
  maxSpeed: number;
  stations: string[];
}

export interface TrainTypeDef {
  t: string;
  c: string;
}

export interface ErrorDef {
  code: string;
  label: string;
  sev: Severity;
}

export interface ActiveError extends ErrorDef {
  ttl: number;
}

export interface Train {
  id: string;
  no: string;
  type: string;
  typeColor: string;
  lineId: string;
  cars: number;
  pos: number;
  dir: 1 | -1;
  speed: number;
  baseSpeed: number;
  maxSpeed: number;
  conf: number;
  comm: Comm;
  phase: number;
  phase2: number;
  errors: ActiveError[];
}

export interface AlertEntry {
  ts: number;
  no: string;
  line: string;
  lineColor: string;
  code: string;
  label: string;
  sev: Severity;
  kind: "raise" | "clear";
}

export interface TrainErrorView {
  code: string;
  label: string;
  sev: Severity;
  color: string;
  bg: string;
}

export interface TrainView {
  id: string;
  no: string;
  type: string;
  typeColor: string;
  cars: number;
  lineId: string;
  lineName: string;
  lineColor: string;
  leftPct: number;
  dir: 1 | -1;
  dirGlyph: string;
  dirText: string;
  status: Status;
  statusColor: string;
  statusLabel: string;
  isAlert: boolean;
  glowColor: string;
  speed: number;
  speedPct: number;
  conf: number;
  confColor: string;
  meters: number;
  comm: Comm;
  commLabel: string;
  commColor: string;
  errors: TrainErrorView[];
  hasErrors: boolean;
  noErrors: boolean;
  errorCodes: string;
  nextStation: string;
}

export interface LineView {
  def: LineDef;
  stations: { name: string; leftPct: number }[];
  trains: TrainView[];
  trainCount: number;
  alertCount: number;
  hasAlert: boolean;
}

export interface FormattedAlert {
  time: string;
  no: string;
  line: string;
  lineColor: string;
  code: string;
  label: string;
  color: string;
  tagBg: string;
  tag: string;
}
