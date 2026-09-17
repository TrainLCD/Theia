import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { TriageJudgement, TriageSignature } from "../../src/useAlertTriage";
import {
  buildTriageState,
  clearTriageCache,
  parseTriageBody,
  triageAlerts,
  type TriageDeps,
} from "./alertTriage";

/** 正規キー (`${logType}:${level}:${message}`) を持つ署名。サーバーはこれ以外を受け取らない。 */
function sig(message: string): TriageSignature {
  return {
    key: `location:error:${message}`,
    logType: "location",
    level: "error",
    message,
  };
}

function judgementFor(signature: TriageSignature): TriageJudgement {
  return {
    key: signature.key,
    impact: 2.1,
    impactConfidence: 0.8,
    category: "location",
    categoryConfidence: 0.9,
    actionable: 0.7,
  };
}

/** 呼び出し回数を数える差し替え口。実際の API は叩かない。 */
function fakeDeps(): TriageDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    judge: async (signature) => {
      calls.push(signature.key);
      return judgementFor(signature);
    },
  };
}

function ok(result: ReturnType<typeof parseTriageBody>): TriageSignature[] {
  if ("error" in result) throw new Error(`expected signatures, got: ${result.error}`);
  return result.signatures;
}

beforeEach(() => {
  clearTriageCache();
});

describe("parseTriageBody", () => {
  it("reads well-formed signatures and drops duplicate keys", () => {
    const signatures = ok(parseTriageBody({ signatures: [sig("a"), sig("a"), sig("b")] }));
    expect(signatures.map((s) => s.message)).toEqual(["a", "b"]);
  });

  it("caps the batch at the shared limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => sig(`m${i}`));
    expect(ok(parseTriageBody({ signatures: many })).length).toBe(24);
  });

  it("rejects a key that does not match the log content", () => {
    // key は本文から決まる。食い違ったまま受け取ると、別のログにキャッシュ済みの
    // 判定を返してしまう。
    const tampered = { ...sig("GPS timeout"), message: "something else" };
    expect(parseTriageBody({ signatures: [tampered] })).toEqual({
      error: "invalid signature entry",
    });
    expect(ok(parseTriageBody({ signatures: [sig("GPS timeout")] }))).toEqual([sig("GPS timeout")]);
  });

  it("rejects a logType containing a colon, which would make the key ambiguous", () => {
    // ("app:error:b" + "warn" + "c") と ("app" + "error" + "b:warn:c") は
    // どちらも key が "app:error:b:warn:c" になる。片方の判定がもう片方に返ってしまう。
    const ambiguous = {
      key: "app:error:b:warn:c",
      logType: "app:error:b",
      level: "warn",
      message: "c",
    };
    expect(parseTriageBody({ signatures: [ambiguous] })).toEqual({
      error: "invalid signature entry",
    });
  });

  it("rejects a malformed body instead of silently skipping entries", () => {
    expect(parseTriageBody(null)).toEqual({ error: "body must be an object" });
    expect(parseTriageBody({})).toEqual({ error: '"signatures" must be an array' });
    expect(parseTriageBody({ signatures: [{ ...sig("a"), level: "debug" }] })).toEqual({
      error: "invalid signature entry",
    });
    expect(parseTriageBody({ signatures: [{ ...sig("a"), key: "" }] })).toEqual({
      error: "invalid signature entry",
    });
  });
});

describe("buildTriageState", () => {
  it("passes only the log content, so the same text always judges the same way", () => {
    expect(buildTriageState(sig("GPS timeout"))).toEqual({
      app: "TrainLCD: 乗車中の現在地と次の駅を案内する鉄道向けの iOS / Android アプリ",
      log_type: "location",
      log_level: "error",
      message: "GPS timeout",
    });
  });
});

describe("triageAlerts", () => {
  it("asks once per distinct message and serves repeats from the cache", async () => {
    const deps = fakeDeps();
    const first = await triageAlerts([sig("a"), sig("b")], deps);
    expect(first.judgements.length).toBe(2);
    expect(deps.calls.length).toBe(2);

    const second = await triageAlerts([sig("a"), sig("c")], deps);
    expect(second.judgements.length).toBe(2);
    expect(deps.calls.length).toBe(3);
  });

  it("returns the judgements it did get and reports the failures", async () => {
    const deps: TriageDeps = {
      judge: async (signature) => {
        if (signature.message === "bad") throw new Error("rate limited");
        return judgementFor(signature);
      },
    };
    const result = await triageAlerts([sig("good"), sig("bad")], deps);
    expect(result.judgements.map((j) => j.key)).toEqual([sig("good").key]);
    expect(result.error).toBe("1 件の判定に失敗: rate limited");
  });

  it("does not cache a failed judgement", async () => {
    let attempts = 0;
    const deps: TriageDeps = {
      judge: async (signature) => {
        attempts += 1;
        if (attempts === 1) throw new Error("boom");
        return judgementFor(signature);
      },
    };
    expect((await triageAlerts([sig("a")], deps)).judgements).toEqual([]);
    expect((await triageAlerts([sig("a")], deps)).judgements.map((j) => j.key)).toEqual([
      sig("a").key,
    ]);
  });

  it("never asks upstream when every message is already known", async () => {
    const deps = fakeDeps();
    await triageAlerts([sig("a")], deps);
    const cached = await triageAlerts([sig("a")], deps);
    expect(deps.calls).toEqual([sig("a").key]);
    expect(cached.error).toBeUndefined();
  });
});

describe("triage cache eviction", () => {
  it("keeps a signature that was read again, and drops the untouched oldest", async () => {
    const deps = fakeDeps();
    // 上限ちょうどまで埋める。
    const filled = Array.from({ length: 500 }, (_, i) => sig(`m${i}`));
    for (const signature of filled) await triageAlerts([signature], deps);
    expect(deps.calls.length).toBe(500);

    // 最古のものを読み直す。挿入順が動けば、次の追加で捨てられるのは 2 番目になる。
    await triageAlerts([filled[0]!], deps);
    expect(deps.calls.length).toBe(500);

    await triageAlerts([sig("fresh")], deps);
    expect(deps.calls.length).toBe(501);

    // 読み直した最古のものはまだキャッシュに居る。
    await triageAlerts([filled[0]!], deps);
    expect(deps.calls.length).toBe(501);

    // 代わりに 2 番目が捨てられている。
    await triageAlerts([filled[1]!], deps);
    expect(deps.calls.length).toBe(502);
  });
});

describe("triage circuit breaker", () => {
  it("stops asking upstream after repeated failures", async () => {
    let calls = 0;
    const deps: TriageDeps = {
      judge: async () => {
        calls += 1;
        throw new Error("upstream down");
      },
    };
    const batch = Array.from({ length: 5 }, (_, i) => sig(`m${i}`));
    const first = await triageAlerts(batch, deps);
    expect(first.error).toContain("判定に失敗");
    expect(calls).toBe(5);

    // 遮断中は 1 件も問い合わせない。
    const second = await triageAlerts([sig("later")], deps);
    expect(calls).toBe(5);
    expect(second.judgements).toEqual([]);
    expect(second.error).toBe("上流の連続失敗により問い合わせを停止中");
  });

  it("abandons the rest of the queue once the breaker opens mid-request", async () => {
    let calls = 0;
    const deps: TriageDeps = {
      judge: async () => {
        calls += 1;
        throw new Error("upstream down");
      },
    };
    const batch = Array.from({ length: 12 }, (_, i) => sig(`m${i}`));
    const result = await triageAlerts(batch, deps);
    // 遮断の判定は 1 件ごとなので、同時に走っている worker のぶんだけ行き過ぎる。
    // 4 並列の 1 巡目 (4 件) では閾値 5 に届かず、2 巡目の 4 件も走ってから開く。
    // 行き過ぎは worker 数までに収まり、残り 4 件は上流に投げない。
    expect(calls).toBe(8);
    expect(calls).toBeLessThan(batch.length);
    expect(result.judgements).toEqual([]);
    expect(result.error).toContain("残り 4 件は中止");
  });
});
