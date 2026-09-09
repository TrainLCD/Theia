import { useCallback, useEffect, useState } from "react";
import type { ThqChannel, ThqPlatform } from "./useThqSocket";

// THQ の現在地凍結検出 (locationFreezes / locationFreezeSessions / locationFreezeSummary)
// のレスポンス。サーバー側 (server/utils/thqFreeze.ts) がこの型で返す。

export interface FreezeCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
}

/** 欠落 1 件。gapStart 降順で返る。 */
export interface FreezeRow {
  sessionId: string;
  device: string;
  lineId: number | null;
  segmentId: string | null;
  fromStationId: number | null;
  toStationId: number | null;
  appVersion: string | null;
  platform: ThqPlatform | null;
  channel: ThqChannel | null;
  gapStart: string;
  gapEnd: string;
  gapMs: number;
  speedBeforeGap: number;
  coordsBeforeGap: FreezeCoords;
  coordsAfterGap: FreezeCoords;
  jumpDistanceMeters: number;
  aliveEventCount: number;
}

/** セッション 1 件。凍結 0 件のセッションも含まれる。 */
export interface FreezeSessionRow {
  sessionId: string;
  device: string;
  lineIds: number[];
  appVersion: string | null;
  platform: ThqPlatform | null;
  channel: ThqChannel | null;
  startedAt: string;
  endedAt: string;
  locationCount: number;
  maxSpeed: number | null;
  freezeCount: number;
  maxGapMs: number | null;
  totalGapMs: number;
}

/** 路線・区間・端末・ビルド別の集計。凍結 0 件のグループも含まれる。 */
export interface FreezeSummaryRow {
  lineId: number | null;
  segmentId: string | null;
  fromStationId: number | null;
  toStationId: number | null;
  device: string;
  appVersion: string | null;
  platform: ThqPlatform | null;
  channel: ThqChannel | null;
  sessionCount: number;
  locationCount: number;
  freezeSessionCount: number;
  freezeCount: number;
  maxGapMs: number | null;
  totalGapMs: number;
}

export interface FreezeLineLabel {
  id: number;
  name: string;
  color: string;
}

export interface FreezePayload {
  freezes: FreezeRow[];
  sessions: FreezeSessionRow[];
  summary: FreezeSummaryRow[];
  lines: FreezeLineLabel[];
  error?: string;
}

/** 画面側のフィルタ。期間は「今から遡る長さ」で持ち、取得時に from / to へ変換する。 */
export interface FreezeQuery {
  windowMs: number;
  lineId: number | null;
  device: string | null;
  appVersion: string | null;
  gapThresholdMs: number;
  speedThresholdKmh: number;
  requireAppAlive: boolean;
}

export interface FreezeState extends FreezePayload {
  loading: boolean;
  /** 最後に取得が完了した時刻 (ms)。未取得なら 0。 */
  fetchedAt: number;
  reload: () => void;
}

const EMPTY: FreezePayload = { freezes: [], sessions: [], summary: [], lines: [] };

export function buildFreezeSearch(query: FreezeQuery, now: number): string {
  const params = new URLSearchParams({
    from: new Date(now - query.windowMs).toISOString(),
    to: new Date(now).toISOString(),
    gapThresholdMs: String(query.gapThresholdMs),
    speedThresholdKmh: String(query.speedThresholdKmh),
    requireAppAlive: String(query.requireAppAlive),
  });
  if (query.lineId != null) params.set("lineId", String(query.lineId));
  if (query.device) params.set("device", query.device);
  if (query.appVersion) params.set("appVersion", query.appVersion);
  return params.toString();
}

/**
 * 凍結検出を取得する。上流の GraphQL は重いので、タブが一度も開かれていない間は
 * enabled=false にして呼ばない。
 */
export function useThqFreezes(
  query: FreezeQuery,
  enabled: boolean,
  path = "/api/thq-freezes",
): FreezeState {
  const [payload, setPayload] = useState<FreezePayload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const {
    windowMs,
    lineId,
    device,
    appVersion,
    gapThresholdMs,
    speedThresholdKmh,
    requireAppAlive,
  } = query;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    const search = buildFreezeSearch(
      {
        windowMs,
        lineId,
        device,
        appVersion,
        gapThresholdMs,
        speedThresholdKmh,
        requireAppAlive,
      },
      Date.now(),
    );
    fetch(`${path}?${search}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as FreezePayload;
      })
      .then((body) => {
        setPayload({ ...EMPTY, ...body });
        setFetchedAt(Date.now());
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setPayload({ ...EMPTY, error: e instanceof Error ? e.message : String(e) });
        setFetchedAt(Date.now());
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    enabled,
    path,
    windowMs,
    lineId,
    device,
    appVersion,
    gapThresholdMs,
    speedThresholdKmh,
    requireAppAlive,
    reloadKey,
  ]);

  return { ...payload, loading, fetchedAt, reload };
}
