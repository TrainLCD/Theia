import type {
  FreezeLineLabel,
  FreezePayload,
  FreezeRow,
  FreezeSessionRow,
  FreezeSummaryRow,
} from "../../src/useThqFreezes";
import type { ThqChannel, ThqPlatform } from "../../src/useThqSocket";
import { resolveLine } from "./lineCatalog";
import { THQ_GRAPHQL_URL, THQ_OBSERVER_TOKEN } from "./thqAuth";

// THQ の LocationFreezeFilter に対応。from / to は必須で、差は最大 90 日 (サーバー側の制約)。
export interface FreezeFilter {
  from: string;
  to: string;
  lineId: number | null;
  segmentId: string | null;
  device: string | null;
  sessionId: string | null;
  appVersion: string | null;
  platform: ThqPlatform | null;
  channel: ThqChannel | null;
  gapThresholdMs: number;
  speedThresholdKmh: number;
  requireAppAlive: boolean;
  limit: number;
}

const FETCH_TIMEOUT_MS = 20_000;

const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// THQ 側の上限。これを超える窓はサーバーがエラーにするため手前で弾く。
const MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_GAP_THRESHOLD_MS = 60_000;
const MIN_GAP_THRESHOLD_MS = 1_000;
const DEFAULT_SPEED_THRESHOLD_KMH = 30;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 2000;

const PLATFORMS: ThqPlatform[] = ["ios", "android", "macos", "unknown"];
const CHANNELS: ThqChannel[] = ["production", "canary"];

type QueryInput = Record<string, string | string[] | undefined>;

function str(input: QueryInput, key: string): string | null {
  const raw = input[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

type NumResult = { value: number | null } | { error: string };

// 未指定は null を返すが、指定されていて数値として読めない場合はエラーにする。
// 既定値に落とすと、指定したつもりの条件と違う結果を返しても気付けない。
function num(input: QueryInput, key: string): NumResult {
  const value = str(input, key);
  if (value == null) return { value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { error: `invalid "${key}": ${value}` };
  return { value: parsed };
}

/** クエリ文字列を FreezeFilter に落とす。不正な値は理由付きで弾く。 */
export function parseFreezeQuery(
  input: QueryInput,
  now: number,
): { filter: FreezeFilter } | { error: string } {
  const toRaw = str(input, "to");
  const fromRaw = str(input, "from");
  const to = toRaw != null ? Date.parse(toRaw) : now;
  if (Number.isNaN(to)) return { error: `invalid "to": ${toRaw}` };
  const from = fromRaw != null ? Date.parse(fromRaw) : to - DEFAULT_WINDOW_MS;
  if (Number.isNaN(from)) return { error: `invalid "from": ${fromRaw}` };
  if (from >= to) return { error: '"from" must be earlier than "to"' };
  if (to - from > MAX_WINDOW_MS) return { error: "the time range must be at most 90 days" };

  const platform = str(input, "platform");
  if (platform != null && !PLATFORMS.includes(platform as ThqPlatform)) {
    return { error: `invalid "platform": ${platform}` };
  }
  const channel = str(input, "channel");
  if (channel != null && !CHANNELS.includes(channel as ThqChannel)) {
    return { error: `invalid "channel": ${channel}` };
  }
  const lineId = num(input, "lineId");
  if ("error" in lineId) return lineId;
  if (lineId.value != null && !Number.isInteger(lineId.value)) {
    return { error: `invalid "lineId": ${str(input, "lineId")}` };
  }
  const gapThresholdMs = num(input, "gapThresholdMs");
  if ("error" in gapThresholdMs) return gapThresholdMs;
  const speedThresholdKmh = num(input, "speedThresholdKmh");
  if ("error" in speedThresholdKmh) return speedThresholdKmh;
  const limit = num(input, "limit");
  if ("error" in limit) return limit;

  return {
    filter: {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      lineId: lineId.value,
      segmentId: str(input, "segmentId"),
      device: str(input, "device"),
      sessionId: str(input, "sessionId"),
      appVersion: str(input, "appVersion"),
      platform: platform as ThqPlatform | null,
      channel: channel as ThqChannel | null,
      gapThresholdMs: Math.max(
        MIN_GAP_THRESHOLD_MS,
        Math.round(gapThresholdMs.value ?? DEFAULT_GAP_THRESHOLD_MS),
      ),
      speedThresholdKmh: Math.max(0, speedThresholdKmh.value ?? DEFAULT_SPEED_THRESHOLD_KMH),
      // 既定は true。明示的に "false" のときだけ条件を外す。
      requireAppAlive: str(input, "requireAppAlive") !== "false",
      limit: Math.min(MAX_LIMIT, Math.max(1, Math.round(limit.value ?? DEFAULT_LIMIT))),
    },
  };
}

// 3 本とも同じ filter を取るので 1 リクエストにまとめる。
const FREEZE_QUERY = `query Freezes($filter: LocationFreezeFilter!, $limit: Int!) {
  freezes: locationFreezes(filter: $filter, limit: $limit) {
    sessionId device lineId segmentId fromStationId toStationId
    appVersion platform channel
    gapStart gapEnd gapMs speedBeforeGap
    coordsBeforeGap { latitude longitude accuracy speed }
    coordsAfterGap { latitude longitude accuracy speed }
    jumpDistanceMeters aliveEventCount
  }
  sessions: locationFreezeSessions(filter: $filter, limit: $limit) {
    sessionId device lineIds appVersion platform channel
    startedAt endedAt locationCount maxSpeed
    freezeCount maxGapMs totalGapMs
  }
  summary: locationFreezeSummary(filter: $filter, limit: $limit) {
    lineId segmentId fromStationId toStationId device
    appVersion platform channel
    sessionCount locationCount
    freezeSessionCount freezeCount maxGapMs totalGapMs
  }
}`;

interface FreezeGqlResponse {
  data?: { freezes: FreezeRow[]; sessions: FreezeSessionRow[]; summary: FreezeSummaryRow[] } | null;
  errors?: { message: string }[];
}

/** null のフィルタは送らない (サーバー側で「未指定」と「null 一致」を区別するため)。 */
export function buildFilterVariables(filter: FreezeFilter): Record<string, unknown> {
  const out: Record<string, unknown> = {
    from: filter.from,
    to: filter.to,
    gapThresholdMs: filter.gapThresholdMs,
    speedThresholdKmh: filter.speedThresholdKmh,
    requireAppAlive: filter.requireAppAlive,
  };
  const optional = {
    lineId: filter.lineId,
    segmentId: filter.segmentId,
    device: filter.device,
    sessionId: filter.sessionId,
    appVersion: filter.appVersion,
    platform: filter.platform,
    channel: filter.channel,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

/** freezes / sessions / summary に現れる路線 ID を重複なく集める。 */
export function collectLineIds(data: {
  freezes: FreezeRow[];
  sessions: FreezeSessionRow[];
  summary: FreezeSummaryRow[];
}): number[] {
  const ids = new Set<number>();
  for (const row of data.freezes) if (row.lineId != null) ids.add(row.lineId);
  for (const row of data.summary) if (row.lineId != null) ids.add(row.lineId);
  for (const row of data.sessions) for (const id of row.lineIds) ids.add(id);
  return Array.from(ids).sort((a, b) => a - b);
}

async function resolveLineLabels(ids: number[]): Promise<FreezeLineLabel[]> {
  const metas = await Promise.all(ids.map((id) => resolveLine(id)));
  const labels: FreezeLineLabel[] = [];
  for (const meta of metas) {
    if (meta) labels.push({ id: meta.id, name: meta.name, color: meta.color });
  }
  return labels;
}

const EMPTY: Omit<FreezePayload, "error"> = { freezes: [], sessions: [], summary: [], lines: [] };

export async function fetchThqFreezes(filter: FreezeFilter): Promise<FreezePayload> {
  if (!THQ_OBSERVER_TOKEN) {
    return { ...EMPTY, error: "THQ_OBSERVER_TOKEN is not set" };
  }
  try {
    const res = await fetch(THQ_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${THQ_OBSERVER_TOKEN}`,
      },
      body: JSON.stringify({
        query: FREEZE_QUERY,
        variables: { filter: buildFilterVariables(filter), limit: filter.limit },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[thq-freezes] HTTP ${res.status}`);
      return { ...EMPTY, error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as FreezeGqlResponse;
    if (json.errors?.length) {
      console.warn("[thq-freezes] GraphQL errors", json.errors);
      return { ...EMPTY, error: json.errors.map((e) => e.message).join("; ") };
    }
    const data = json.data;
    if (!data) return { ...EMPTY, error: "empty GraphQL response" };
    const lines = await resolveLineLabels(collectLineIds(data));
    return { freezes: data.freezes, sessions: data.sessions, summary: data.summary, lines };
  } catch (e) {
    console.warn("[thq-freezes] fetch failed", e);
    return { ...EMPTY, error: e instanceof Error ? e.message : String(e) };
  }
}
