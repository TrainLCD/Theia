import { TypeSafeClient, choice, noul, score, type EntryType } from "@typesafe-ai/sdk";
import {
  MAX_TRIAGE_BATCH,
  type TriageCategory,
  type TriageJudgement,
  type TriagePayload,
  type TriageSignature,
} from "../../src/useAlertTriage";

// 端末から届く自由文ログを TypeSafe の System One に渡し、3 つの独立した軸で判定する。
// 軸は互いに独立なので 1 リクエストにまとめて並列に問い合わせる。
// 判定に渡すのはログの文面だけ。発生件数や端末数はコード側が正確に知っている事実なので、
// モデルには聞かない。文面が同じなら結果も同じになり、そのままキャッシュできる。

const CACHE_CAP = 500;
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 15_000;
// 連続でこの回数失敗したら、上流が落ちているとみなして一定時間問い合わせを止める。
const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 60_000;

const IMPACT_CRITERIA: [EntryType, EntryType, EntryType, EntryType] = [
  {
    what: "アプリの利用者には何も起きていない。内部の記録や、想定内の再試行で回復した事象。",
    examples: ["位置情報の送信に失敗したが、次の送信は成功した", "キャッシュを破棄して取り直した"],
  },
  {
    what: "表示の更新が一時的に遅れる、または古い値のまま残るが、利用者は操作を続けられる。",
    examples: ["現在地の更新が数十秒止まった", "路線データの取得が遅く、読み込み表示が続いた"],
  },
  {
    what: "現在地・次駅・到着判定などの主要機能が誤った結果を出し、利用者が誤った案内を見る。",
    examples: ["実際とは違う駅に到着したと判定した", "別の路線の情報を表示した"],
  },
  {
    what: "アプリが使えなくなる。クラッシュ、起動不可、画面が先に進まない。",
    examples: ["起動直後にクラッシュした", "位置情報の権限が取得できず案内画面に進めない"],
  },
];

const CATEGORY_CRITERIA = {
  location: {
    what: "位置情報そのものに関する事象。測位、精度、位置情報の権限、センサー。",
    not_for: "位置情報をサーバーへ送る通信の失敗",
    examples: ["位置情報の権限が拒否された", "測位精度が著しく低い"],
  },
  network: {
    what: "通信に関する事象。接続、タイムアウト、HTTP のエラー応答、WebSocket の切断。",
    not_for: "接続はできていて、返ってきた中身が壊れている場合",
    examples: ["API がタイムアウトした", "WebSocket が切断された"],
  },
  auth: {
    what: "認証・認可に関する事象。トークン、ログイン、サーバーが要求する権限。",
    not_for: "OS が管理する位置情報や通知の権限",
    examples: ["トークンの有効期限が切れた", "401 が返った"],
  },
  data: {
    what: "受け取った、または保存したデータの欠落・不整合・解析失敗。",
    not_for: "データを取りに行く通信そのものの失敗",
    examples: ["JSON の解析に失敗した", "必須の駅 ID が欠けていた"],
  },
  ui: {
    what: "画面の描画・レイアウト・アニメーション・画面遷移に関する事象。",
    examples: ["レイアウトの制約が壊れた", "画面遷移でクラッシュした"],
  },
  other: "上記のいずれにも当てはまらない、または文面からは所在を判断できない。",
  // satisfies でキーを TriageCategory に固定する。増減させると判定結果の型が合わなくなる。
} satisfies Record<TriageCategory, EntryType>;

const TRIAGE_QUESTIONS = {
  impact: score(
    "このログが示す事象は、アプリの利用者の体験にどの程度影響するか。",
    IMPACT_CRITERIA,
  ),
  category: choice("このログが示す事象は、どこで起きているか。", CATEGORY_CRITERIA),
  actionable: noul("このログは、アプリ側の修正を要する不具合を示しているか。", {
    true: "アプリのコードや設定を直さない限り、同じ条件で再発する事象。",
    false:
      "圏外・権限の拒否・アプリの終了など、端末の環境や利用者の操作によるもので、アプリ側の修正では防げない事象。",
  }),
};

/** モデルに渡す文脈。TrainLCD が何のアプリかを添えないと「利用者への影響」が判断できない。 */
export function buildTriageState(signature: TriageSignature) {
  return {
    app: "TrainLCD: 乗車中の現在地と次の駅を案内する鉄道向けの iOS / Android アプリ",
    log_type: signature.logType,
    log_level: signature.level,
    message: signature.message,
  };
}

type ParsedBody = { signatures: TriageSignature[] } | { error: string };

const LEVELS = new Set(["warn", "error"]);

function readSignature(raw: unknown): TriageSignature | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { key, logType, level, message } = raw as Record<string, unknown>;
  if (typeof key !== "string" || key === "") return null;
  // logType にコロンが入ると key の区切りが一意に決まらない。
  // ("app:error:b" + "warn" + "c") と ("app" + "error" + "b:warn:c") が同じ key になり、
  // 中身の違うログが互いのキャッシュを引いてしまう。level は語彙が固定、message は
  // 末尾なので、曖昧になるのは logType だけ。
  if (typeof logType !== "string" || logType.includes(":")) return null;
  if (typeof level !== "string" || !LEVELS.has(level)) return null;
  if (typeof message !== "string") return null;
  // key は本文から決まる値なので、送られてきた key が本文と食い違っていたら受け取らない。
  // ここを素通しすると、別のログに既存の判定をキャッシュから返してしまう。
  if (key !== `${logType}:${level}:${message}`) return null;
  return { key, logType, level: level as "warn" | "error", message };
}

/** POST の本文を読む。1 件でも形が違えば理由付きで弾く。黙って捨てると判定漏れに気付けない。 */
export function parseTriageBody(body: unknown): ParsedBody {
  if (typeof body !== "object" || body === null) return { error: "body must be an object" };
  const raw = (body as Record<string, unknown>).signatures;
  if (!Array.isArray(raw)) return { error: '"signatures" must be an array' };
  const signatures: TriageSignature[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const signature = readSignature(entry);
    if (signature == null) return { error: "invalid signature entry" };
    if (seen.has(signature.key)) continue;
    seen.add(signature.key);
    signatures.push(signature);
    if (signatures.length >= MAX_TRIAGE_BATCH) break;
  }
  return { signatures };
}

// 挿入順の Map を LRU として使う。判定は文面ごとに 1 度きりなので、これで足りる。
const cache = new Map<string, TriageJudgement>();

function remember(judgement: TriageJudgement): void {
  cache.delete(judgement.key);
  cache.set(judgement.key, judgement);
  while (cache.size > CACHE_CAP) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/** テスト用。プロセス内のキャッシュと連続失敗の記録を空にする。 */
export function clearTriageCache(): void {
  cache.clear();
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

// TypeSafe への同時実行数をプロセス全体で抑える。/api/thq-triage はリクエストごとに
// triageAlerts を呼ぶので、1 リクエスト内の CONCURRENCY だけでは同時アクセス数のぶん
// 倍に膨らむ。SDK 側に同時実行の制限は無いため、ここで持つ。
let inFlight = 0;
const waiting: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  // 起こされた後にもう一度見る。resolve とカウンタ加算の間に別の呼び出しが
  // 割り込めるので、if ではなく while でないと上限を超える。
  while (inFlight >= CONCURRENCY) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  inFlight += 1;
}

function releaseSlot(): void {
  inFlight -= 1;
  waiting.shift()?.();
}

// 上流が落ちているとき、リクエストのたびに 24 件 × タイムアウトを積み上げないための遮断。
// 失敗した判定はキャッシュしないので、これが無いと同じ問い合わせを延々と繰り返す。
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

function breakerIsOpen(now: number): boolean {
  return now < breakerOpenUntil;
}

function recordJudgeSuccess(): void {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

function recordJudgeFailure(now: number): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= BREAKER_THRESHOLD) breakerOpenUntil = now + BREAKER_COOLDOWN_MS;
}

let client: TypeSafeClient | null | undefined;

// .env.example をそのままコピーすると空文字になるため、?? ではなく || で見る。
function getClient(): TypeSafeClient | null {
  if (client !== undefined) return client;
  const apiKey = process.env.TYPESAFE_API_KEY || undefined;
  client = apiKey == null ? null : new TypeSafeClient({ apiKey, timeout: REQUEST_TIMEOUT_MS });
  return client;
}

// 同時実行の制限と遮断の判定は呼び出し元 (triageAlerts の worker) が持つ。
// ここでスロットを待つと、待っている間に遮断されたことに気付けない。
async function askTypeSafe(signature: TriageSignature): Promise<TriageJudgement> {
  const active = getClient();
  if (active == null) throw new Error("TYPESAFE_API_KEY is not set");
  const { answers } = await active.systemOne({
    state: buildTriageState(signature),
    questions: TRIAGE_QUESTIONS,
  });
  return {
    key: signature.key,
    impact: answers.impact.score,
    impactConfidence: answers.impact.confidence,
    category: answers.category.choice,
    categoryConfidence: answers.category.confidence,
    actionable: answers.actionable.noul,
  };
}

/** 問い合わせ先の差し替え口。テストは実際の API を叩かずにここを置き換える。 */
export interface TriageDeps {
  judge: (signature: TriageSignature) => Promise<TriageJudgement>;
}

const DEFAULT_DEPS: TriageDeps = { judge: askTypeSafe };

/**
 * 文面をトリアージする。キャッシュ済みのものはそのまま返し、残りだけ問い合わせる。
 * 1 件でも判定できれば 200 で返し、失敗した分は error に理由をまとめる。
 * 判定が欠けてもアラート表示は成立するので、全体を失敗にはしない。
 */
export async function triageAlerts(
  signatures: TriageSignature[],
  deps: TriageDeps = DEFAULT_DEPS,
): Promise<TriagePayload> {
  const judgements: TriageJudgement[] = [];
  const queue: TriageSignature[] = [];
  for (const signature of signatures.slice(0, MAX_TRIAGE_BATCH)) {
    const cached = cache.get(signature.key);
    if (cached) {
      // Map.get は挿入順を動かさない。参照されたものを末尾に送り直さないと
      // FIFO になり、よく出るログほど先に捨てられる。
      remember(cached);
      judgements.push(cached);
    } else {
      queue.push(signature);
    }
  }
  if (queue.length === 0) return { judgements };

  if (getClient() == null && deps === DEFAULT_DEPS) {
    return { judgements, error: "TYPESAFE_API_KEY is not set" };
  }

  if (breakerIsOpen(Date.now())) {
    return { judgements, error: "上流の連続失敗により問い合わせを停止中" };
  }

  const failures: string[] = [];
  let next = 0;
  let skipped = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (next < queue.length) {
      const signature = queue[next++]!;
      // 走っている途中で遮断されたら、残りは問い合わせずに諦める。
      if (breakerIsOpen(Date.now())) {
        skipped += 1;
        continue;
      }
      await acquireSlot();
      try {
        // スロットを待っている間に遮断されることがある。取得後にもう一度見ないと、
        // 待たされていたぶんが遮断後に上流を叩く。
        if (breakerIsOpen(Date.now())) {
          skipped += 1;
          continue;
        }
        const judgement = await deps.judge(signature);
        recordJudgeSuccess();
        remember(judgement);
        judgements.push(judgement);
      } catch (e: unknown) {
        recordJudgeFailure(Date.now());
        failures.push(e instanceof Error ? e.message : String(e));
      } finally {
        releaseSlot();
      }
    }
  });
  await Promise.all(workers);

  if (failures.length === 0 && skipped === 0) return { judgements };
  if (failures.length === 0) {
    return { judgements, error: `上流の連続失敗により ${skipped} 件の問い合わせを中止` };
  }
  const suffix = skipped > 0 ? ` (残り ${skipped} 件は中止)` : "";
  return { judgements, error: `${failures.length} 件の判定に失敗: ${failures[0]}${suffix}` };
}
