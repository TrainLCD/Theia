import { useEffect, useRef, useState } from "react";
import type { AlertEntry, TrainView } from "./types";

// ログ本文の意味づけ。server/utils/alertTriage.ts が TypeSafe の System One に問い合わせ、
// この型で返す。判定は「ログの文面」だけに依存させてあるので、同じ文面なら結果は使い回せる。

/** 事象の所在。UI のバッジと配色に使う。 */
export type TriageCategory = "location" | "network" | "auth" | "data" | "ui" | "other";

/** 判定の単位。同じ文面のログは 1 回しか問い合わせない。 */
export interface TriageSignature {
  /** `${log.type}:${log.level}:${message}`。useThqSocket が付ける errKey と同じ。 */
  key: string;
  logType: string;
  level: "warn" | "error";
  message: string;
}

export interface TriageJudgement {
  key: string;
  /** 利用者への影響度。0〜3 の期待値で、整数レベルの間に落ちることがある。 */
  impact: number;
  /** impact の分布の尖り具合 (0〜1)。低いときはレベルの判断が割れている。 */
  impactConfidence: number;
  category: TriageCategory;
  categoryConfidence: number;
  /** アプリ側の修正を要する不具合を示している確率 (0〜1)。 */
  actionable: number;
}

export interface TriagePayload {
  judgements: TriageJudgement[];
  error?: string;
}

export interface AlertTriageState {
  judgements: Map<string, TriageJudgement>;
  /** 直近の取得失敗。判定が無いだけでアラート表示自体は続く。 */
  error: string | null;
}

/** 1 リクエストで送る文面の上限。サーバー側も同じ値で切り詰める。 */
export const MAX_TRIAGE_BATCH = 24;

/** これだけ連続で失敗したら以降は問い合わせない。 */
const MAX_CONSECUTIVE_FAILURES = 3;

/** 1 つの文面を送り直す上限。判定が返らないまま候補に戻り続けるのを防ぐ。 */
const MAX_ATTEMPTS_PER_KEY = 2;

export function signatureFor(alert: AlertEntry): TriageSignature {
  return {
    key: alert.key,
    logType: alert.logType,
    level: alert.sev === "E" ? "error" : "warn",
    message: alert.label,
  };
}

/**
 * 影響度を主軸に、アプリ側の修正が要る確率で重み付けした表示用の優先度 (0〜3)。
 * 判定値そのものは保持しているので、この重みを変えても再問い合わせは要らない。
 */
export function triagePriority(judgement: TriageJudgement): number {
  return judgement.impact * (0.5 + 0.5 * judgement.actionable);
}

const IMPACT_LABELS = ["影響なし", "軽微", "誤案内", "利用不能"] as const;

/** impact の期待値を、最も近い整数レベルの名前にする。 */
export function triageImpactLabel(impact: number): string {
  const index = Math.max(0, Math.min(IMPACT_LABELS.length - 1, Math.round(impact)));
  return IMPACT_LABELS[index]!;
}

/** 端末や路線など、複数のログをまとめて見るときの要約。 */
export interface TriageSummary {
  /** 優先度が最も高い判定。判定が 1 件も付いていなければ null。 */
  worst: TriageJudgement | null;
  /** アプリ側の修正が要る確率が半分を超える判定の件数。 */
  needsFix: number;
  /** 判定が付いた件数。渡したキーの数より少ないことがある。 */
  judged: number;
}

export const EMPTY_TRIAGE_SUMMARY: TriageSummary = { worst: null, needsFix: 0, judged: 0 };

/** 修正が要ると見なす境界。ここを下回る判定は端末や路線の「要修正」に数えない。 */
export const NEEDS_FIX = 0.5;

/**
 * 複数のログの判定をまとめる。判定は後追いで届くので、未判定のキーは黙って無視する
 * (件数そのものは既存の alertCount 等がコード側で正確に数えている)。
 */
export function summarizeTriage(
  keys: Iterable<string>,
  triage: Map<string, TriageJudgement>,
): TriageSummary {
  let worst: TriageJudgement | null = null;
  let needsFix = 0;
  let judged = 0;
  for (const key of keys) {
    const judgement = triage.get(key);
    if (!judgement) continue;
    judged += 1;
    if (judgement.actionable >= NEEDS_FIX) needsFix += 1;
    if (worst == null || triagePriority(judgement) > triagePriority(worst)) worst = judgement;
  }
  return { worst, needsFix, judged };
}

/** 端末の一群ぶんをまとめる。TrainView.errors がログ本文のキーを持っている。 */
export function summarizeTrains(
  trains: readonly TrainView[],
  triage: Map<string, TriageJudgement>,
): TriageSummary {
  const keys: string[] = [];
  for (const train of trains) for (const error of train.errors) keys.push(error.key);
  return summarizeTriage(keys, triage);
}

export const TRIAGE_CATEGORY_LABEL: Record<TriageCategory, string> = {
  location: "位置情報",
  network: "通信",
  auth: "認証",
  data: "データ",
  ui: "画面",
  other: "その他",
};

export const TRIAGE_CATEGORY_COLOR: Record<TriageCategory, string> = {
  location: "#38bdf8",
  network: "#a78bfa",
  auth: "#f59e0b",
  data: "#22c55e",
  ui: "#ec4899",
  other: "#6b7d9c",
};

/** 判定が割れているときの目安。これを下回る軸は UI 側で控えめに出す。 */
export const LOW_CONFIDENCE = 0.5;

/**
 * アラートの文面をトリアージする。届いたアラートのうち未判定の文面だけをまとめて送り、
 * 結果を key で引ける Map にして返す。判定は後追いで届くので、アラート自体の表示は待たせない。
 */
export function useAlertTriage(
  alerts: AlertEntry[],
  enabled = true,
  path = "/api/thq-triage",
): AlertTriageState {
  const [judgements, setJudgements] = useState<Map<string, TriageJudgement>>(() => new Map());
  const [error, setError] = useState<string | null>(null);
  // 文面ごとの扱い。送信中・判定済み・諦めたものは次のバッチに入れない。
  // 送信中を判定済みと分けないと、返らなかった文面が永久に候補から外れる。
  const inFlightRef = useRef<Map<string, AbortController>>(new Map());
  const settledRef = useRef<Set<string>>(new Set());
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const failuresRef = useRef(0);
  // 1 リクエスト終わるごとに進める。alerts が変わらなくても effect をもう一度
  // 走らせないと、1 バッチ (24 件) を超えるぶんの続きを取りに行けない。
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;

    const batch: TriageSignature[] = [];
    const seen = new Set<string>();
    for (const alert of alerts) {
      if (seen.has(alert.key)) continue;
      if (settledRef.current.has(alert.key) || inFlightRef.current.has(alert.key)) continue;
      seen.add(alert.key);
      batch.push(signatureFor(alert));
      if (batch.length >= MAX_TRIAGE_BATCH) break;
    }
    if (batch.length === 0) return;

    const controller = new AbortController();
    for (const signature of batch) inFlightRef.current.set(signature.key, controller);

    // 自分が送ったぶんだけ外す。後から始まったバッチが同じ文面を握っている場合に
    // それを剥がしてしまうと、二重送信になる。
    const releaseOwned = () => {
      for (const signature of batch) {
        if (inFlightRef.current.get(signature.key) === controller) {
          inFlightRef.current.delete(signature.key);
        }
      }
    };

    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signatures: batch }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as TriagePayload;
      })
      .then((payload) => {
        failuresRef.current = 0;
        setError(payload.error ?? null);
        const returned = new Set(payload.judgements.map((j) => j.key));
        releaseOwned();
        for (const signature of batch) {
          if (returned.has(signature.key)) {
            settledRef.current.add(signature.key);
            attemptsRef.current.delete(signature.key);
            continue;
          }
          // 返らなかったぶんは次のバッチで拾い直すが、回数は区切る。
          const attempts = (attemptsRef.current.get(signature.key) ?? 0) + 1;
          attemptsRef.current.set(signature.key, attempts);
          if (attempts >= MAX_ATTEMPTS_PER_KEY) settledRef.current.add(signature.key);
        }
        if (payload.judgements.length > 0) {
          setJudgements((prev) => {
            const next = new Map(prev);
            for (const judgement of payload.judgements) next.set(judgement.key, judgement);
            return next;
          });
        }
        setRound((r) => r + 1);
      })
      .catch((e: unknown) => {
        releaseOwned();
        if (controller.signal.aborted) return;
        failuresRef.current += 1;
        setError(e instanceof Error ? e.message : String(e));
        setRound((r) => r + 1);
      });

    return () => {
      controller.abort();
      // 中止した時点で外しておく。catch が走るのは次の effect が始まった後なので、
      // そこまで待つと中止したぶんが候補に戻らないまま取り残される。
      releaseOwned();
    };
  }, [alerts, enabled, path, round]);

  return { judgements, error };
}
