export type View = "network" | "map" | "line" | "engineer" | "interactions" | "battery" | "freeze";
export type Filter = "all" | "alert" | "error" | "comm" | "fix";
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
  headAngle: number | null;
  batteryLevel: number | null;
  batteryState: 0 | 1 | 2 | 3 | null;
}

export interface BatterySample {
  ts: number;
  pct: number;
  charging: boolean;
}

export interface AlertEntry {
  ts: number;
  /** ログ本文ごとの識別子 (`${log.type}:${log.level}:${message}`)。トリアージ判定の単位。 */
  key: string;
  /** 元のログの type。判定に渡す文脈として使う。 */
  logType: string;
  device: string;
  lineId: number | null;
  lineColor: string;
  code: string;
  label: string;
  sev: Severity;
}

export interface TrainErrorView {
  /** activeErrors の Map キーそのもの。AlertEntry.key と同じで、トリアージ判定を引ける。 */
  key: string;
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
  headAngle: number | null;
  latitude: number | null;
  longitude: number | null;
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
  batteryPct: number | null;
  batteryCharging: boolean;
  batteryColor: string;
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
  nameRoman: string | null;
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

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface MapStation {
  id: number;
  name: string;
  nameRoman: string | null;
  x: number;
  y: number;
}

export interface MapLineView {
  meta: LineMeta;
  pointsStr: string;
  stations: MapStation[];
  count: number;
}

export interface MapTrainView extends TrainView {
  mapX: number;
  mapY: number;
  headAngle: number;
  hasMapPosition: boolean;
}

export interface MapData {
  lines: MapLineView[];
  trains: MapTrainView[];
  bounds: MapBounds | null;
}

export interface FormattedAlert {
  /** AlertEntry.key をそのまま引き継ぐ。トリアージ判定を引くためのキー。 */
  key: string;
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
