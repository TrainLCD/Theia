export type View = "network" | "line" | "engineer";
export type Filter = "all" | "alert" | "error" | "comm";
export type Comm = "ok" | "weak" | "lost";
export type Status = "normal" | "warn" | "error";
export type Severity = "E" | "W";
export type MovementState = "arrived" | "approaching" | "passing" | "moving";

export interface DeviceError {
  code: string;
  message: string;
  sev: Severity;
  ts: number;
}

export type TravelDir = 1 | -1 | 0;

export interface Device {
  deviceId: string;
  lineId: number | null;
  stationId: number | null;
  movementState: MovementState | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number;
  lastSeenAt: number;
  activeErrors: Map<string, DeviceError>;
  lastLeftPct: number | null;
  travelDir: TravelDir;
}

export interface AlertEntry {
  ts: number;
  device: string;
  lineId: number | null;
  lineColor: string;
  code: string;
  label: string;
  sev: Severity;
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
  lineId: number | null;
  lineName: string;
  lineColor: string;
  leftPct: number;
  hasPosition: boolean;
  travelDir: TravelDir;
  movementState: MovementState | null;
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
  meters: number | null;
  comm: Comm;
  commLabel: string;
  commColor: string;
  errors: TrainErrorView[];
  hasErrors: boolean;
  noErrors: boolean;
  errorCodes: string;
  nextStation: string;
  staleSec: number;
}

export interface LineMeta {
  id: number;
  color: string;
  name: string;
}

export interface ExternalStation {
  id: number;
  name: string;
  nameRoman: string | null;
  latitude: number;
  longitude: number;
}

export interface ExternalLineMeta {
  id: number;
  name: string;
  nameRoman: string | null;
  color: string;
  stations: ExternalStation[];
}

export interface LineStationView {
  id: number;
  name: string;
  leftPct: number;
}

export interface LineView {
  meta: LineMeta;
  devices: TrainView[];
  stations: LineStationView[];
  trainCount: number;
  alertCount: number;
  hasAlert: boolean;
}

export interface FormattedAlert {
  time: string;
  device: string;
  line: string;
  lineColor: string;
  code: string;
  label: string;
  color: string;
  tagBg: string;
  tag: string;
}
