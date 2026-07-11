import type {
  ThqInteractionEvent,
  ThqLocationUpdate,
  ThqLogEvent,
  ThqMessage,
  ThqSnapshotPayload,
} from "../../src/useThqSocket";
import { resolveLine } from "./lineCatalog";
import type { LineMeta } from "./lineCatalog";
import { lineMetaMsg } from "./thqBus";

const GQL_URL = process.env.THQ_GRAPHQL_URL ?? "https://thq.trainlcd.app/graphql";
const THQ_TOKEN = process.env.THQ_WS_TOKEN;

// バッテリー履歴のクライアント上限 (1440 件 × 30 秒間隔 ≒ 12 時間) に合わせる。
const SNAPSHOT_WINDOW_MS = 12 * 60 * 60 * 1000;
const LOCATIONS_LIMIT = 1000;
// クライアントの ALERTS_CAP に合わせる (warn / error それぞれで取得)。
const LOGS_LIMIT = 40;
// クライアントの INTERACTIONS_CAP に合わせる。
const INTERACTIONS_LIMIT = 500;
const FETCH_TIMEOUT_MS = 10_000;

// warn / error は単一値フィルタしか受け付けないためエイリアスで 2 回引く。
const SNAPSHOT_QUERY = `query Snapshot($from: DateTime!, $locLimit: Int!, $logLimit: Int!, $interLimit: Int!) {
  locations(from: $from, limit: $locLimit) {
    id sessionId device state stationId lineId
    coords { latitude longitude accuracy speed }
    timestamp segmentId fromStationId toStationId
    batteryLevel batteryState
  }
  warns: logEvents(from: $from, level: warn, limit: $logLimit) {
    id sessionId device appVersion platform channel timestamp type level message
  }
  errs: logEvents(from: $from, level: error, limit: $logLimit) {
    id sessionId device appVersion platform channel timestamp type level message
  }
  interactions: interactionEvents(from: $from, limit: $interLimit) {
    id sessionId device appVersion platform channel timestamp eventName properties
  }
}`;

type GqlBatteryState = "unknown" | "unplugged" | "charging" | "full";

interface GqlCoords {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
}

export interface GqlLocationRow {
  id: string;
  sessionId: string | null;
  device: string | null;
  state: ThqLocationUpdate["state"] | null;
  stationId: number | null;
  lineId: number | null;
  coords: GqlCoords | null;
  timestamp: number | null;
  segmentId: string | null;
  fromStationId: number | null;
  toStationId: number | null;
  batteryLevel: number | null;
  batteryState: GqlBatteryState | null;
}

export interface GqlLogRow {
  id: string;
  sessionId: string | null;
  device: string | null;
  appVersion: string | null;
  platform: ThqLogEvent["platform"] | null;
  channel: ThqLogEvent["channel"] | null;
  timestamp: number | null;
  type: ThqLogEvent["log"]["type"] | null;
  level: ThqLogEvent["log"]["level"] | null;
  message: string | null;
}

export interface GqlInteractionRow {
  id: string;
  sessionId: string | null;
  device: string | null;
  appVersion: string | null;
  platform: ThqInteractionEvent["platform"] | null;
  channel: ThqInteractionEvent["channel"] | null;
  timestamp: number | null;
  eventName: string | null;
  properties: ThqInteractionEvent["properties"];
}

export interface GqlSnapshotData {
  locations: GqlLocationRow[] | null;
  warns: GqlLogRow[] | null;
  errs: GqlLogRow[] | null;
  interactions: GqlInteractionRow[] | null;
}

interface GqlSnapshotResponse {
  data?: GqlSnapshotData | null;
  errors?: { message: string }[];
}

// iOS UIDevice.BatteryState 由来の WS 数値表現に合わせる。
export function batteryStateToNumber(state: GqlBatteryState | null): 0 | 1 | 2 | 3 | null {
  if (state === "unknown") return 0;
  if (state === "unplugged") return 1;
  if (state === "charging") return 2;
  if (state === "full") return 3;
  return null;
}

function toLocationUpdate(row: GqlLocationRow): ThqLocationUpdate | null {
  if (
    row.device == null ||
    row.state == null ||
    row.lineId == null ||
    row.timestamp == null ||
    row.coords?.latitude == null ||
    row.coords.longitude == null
  ) {
    return null;
  }
  return {
    id: row.id,
    type: "location_update",
    session_id: row.sessionId ?? undefined,
    device: row.device,
    state: row.state,
    station_id: row.stationId,
    line_id: row.lineId,
    coords: {
      latitude: row.coords.latitude,
      longitude: row.coords.longitude,
      accuracy: row.coords.accuracy,
      speed: row.coords.speed,
    },
    timestamp: row.timestamp,
    segment_id: row.segmentId,
    from_station_id: row.fromStationId,
    to_station_id: row.toStationId,
    battery_level: row.batteryLevel,
    battery_state: batteryStateToNumber(row.batteryState),
  };
}

function toLogEvent(row: GqlLogRow): ThqLogEvent | null {
  if (row.type == null || row.level == null || row.message == null || row.timestamp == null) {
    return null;
  }
  return {
    id: row.id,
    type: "log",
    session_id: row.sessionId ?? undefined,
    device: row.device,
    app_version: row.appVersion ?? undefined,
    platform: row.platform ?? undefined,
    channel: row.channel ?? undefined,
    timestamp: row.timestamp,
    log: { type: row.type, level: row.level, message: row.message },
  };
}

function toInteractionEvent(row: GqlInteractionRow): ThqInteractionEvent | null {
  if (row.eventName == null || row.timestamp == null) return null;
  return {
    id: row.id,
    type: "interaction",
    session_id: row.sessionId ?? undefined,
    device: row.device,
    app_version: row.appVersion ?? undefined,
    platform: row.platform ?? undefined,
    channel: row.channel ?? undefined,
    timestamp: row.timestamp,
    event_name: row.eventName,
    properties: row.properties ?? null,
  };
}

// 路線メタを先頭に置き (再生時の座標→位置の射影に必要)、イベントは時系列昇順で
// 並べる。クライアントの reducer は先頭追加でリストを作るため、昇順再生で
// 「新しい順」のリストが自然に得られる。
export function buildSnapshotMessages(data: GqlSnapshotData, lineMetas: LineMeta[]): ThqMessage[] {
  const events: (ThqLocationUpdate | ThqLogEvent | ThqInteractionEvent)[] = [];
  for (const row of data.locations ?? []) {
    const msg = toLocationUpdate(row);
    if (msg) events.push(msg);
  }
  for (const row of [...(data.warns ?? []), ...(data.errs ?? [])]) {
    const msg = toLogEvent(row);
    if (msg) events.push(msg);
  }
  for (const row of data.interactions ?? []) {
    const msg = toInteractionEvent(row);
    if (msg) events.push(msg);
  }
  events.sort((a, b) => a.timestamp - b.timestamp);
  return [...lineMetas.map(lineMetaMsg), ...events];
}

async function doFetchSnapshot(): Promise<ThqSnapshotPayload> {
  if (!THQ_TOKEN) {
    return { messages: [], error: "THQ_WS_TOKEN is not set" };
  }
  try {
    const res = await fetch(GQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${THQ_TOKEN}`,
      },
      body: JSON.stringify({
        query: SNAPSHOT_QUERY,
        variables: {
          from: new Date(Date.now() - SNAPSHOT_WINDOW_MS).toISOString(),
          locLimit: LOCATIONS_LIMIT,
          logLimit: LOGS_LIMIT,
          interLimit: INTERACTIONS_LIMIT,
        },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[thq-snapshot] HTTP ${res.status}`);
      return { messages: [], error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as GqlSnapshotResponse;
    if (json.errors?.length) {
      console.warn("[thq-snapshot] GraphQL errors", json.errors);
      return { messages: [], error: json.errors.map((e) => e.message).join("; ") };
    }
    const data = json.data;
    if (!data) {
      return { messages: [], error: "empty GraphQL response" };
    }
    const lineIds = new Set<number>();
    for (const row of data.locations ?? []) {
      if (row.lineId != null) lineIds.add(row.lineId);
    }
    const lineMetas = (await Promise.all(Array.from(lineIds, (id) => resolveLine(id)))).filter(
      (m): m is LineMeta => m != null,
    );
    return { messages: buildSnapshotMessages(data, lineMetas) };
  } catch (e) {
    console.warn("[thq-snapshot] fetch failed", e);
    return { messages: [], error: e instanceof Error ? e.message : String(e) };
  }
}

let inFlightSnapshot: Promise<ThqSnapshotPayload> | null = null;

// 複数タブの同時リロードで上流 GraphQL を叩き過ぎないよう、進行中の取得は共有する。
export function fetchThqSnapshot(): Promise<ThqSnapshotPayload> {
  if (!inFlightSnapshot) {
    inFlightSnapshot = doFetchSnapshot().finally(() => {
      inFlightSnapshot = null;
    });
  }
  return inFlightSnapshot;
}
