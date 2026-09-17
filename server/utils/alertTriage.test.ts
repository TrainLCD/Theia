import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { TriageJudgement, TriageSignature } from "../../src/useAlertTriage";
import {
  buildTriageState,
  clearTriageCache,
  parseTriageBody,
  triageAlerts,
  type TriageDeps,
} from "./alertTriage";

function sig(key: string, message = "location update failed"): TriageSignature {
  return { key, logType: "location", level: "error", message };
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
    expect(signatures.map((s) => s.key)).toEqual(["a", "b"]);
  });

  it("caps the batch at the shared limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => sig(`k${i}`));
    expect(ok(parseTriageBody({ signatures: many })).length).toBe(24);
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
    expect(buildTriageState(sig("a", "GPS timeout"))).toEqual({
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
    expect(first.judgements.map((j) => j.key).sort()).toEqual(["a", "b"]);
    expect(deps.calls.sort()).toEqual(["a", "b"]);

    const second = await triageAlerts([sig("a"), sig("c")], deps);
    expect(second.judgements.map((j) => j.key).sort()).toEqual(["a", "c"]);
    expect(deps.calls.sort()).toEqual(["a", "b", "c"]);
  });

  it("returns the judgements it did get and reports the failures", async () => {
    const deps: TriageDeps = {
      judge: async (signature) => {
        if (signature.key === "bad") throw new Error("rate limited");
        return judgementFor(signature);
      },
    };
    const result = await triageAlerts([sig("good"), sig("bad")], deps);
    expect(result.judgements.map((j) => j.key)).toEqual(["good"]);
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
    expect((await triageAlerts([sig("a")], deps)).judgements.map((j) => j.key)).toEqual(["a"]);
  });

  it("never asks upstream when every message is already known", async () => {
    const deps = fakeDeps();
    await triageAlerts([sig("a")], deps);
    const cached = await triageAlerts([sig("a")], deps);
    expect(deps.calls).toEqual(["a"]);
    expect(cached.error).toBeUndefined();
  });
});
