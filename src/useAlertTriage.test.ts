import { describe, expect, it } from "vite-plus/test";
import type { AlertEntry } from "./types";
import {
  signatureFor,
  summarizeTriage,
  triageImpactLabel,
  triagePriority,
  type TriageJudgement,
} from "./useAlertTriage";

function judgement(overrides: Partial<TriageJudgement> = {}): TriageJudgement {
  return {
    key: "k",
    impact: 2,
    impactConfidence: 0.8,
    category: "location",
    categoryConfidence: 0.9,
    actionable: 1,
    ...overrides,
  };
}

describe("triagePriority", () => {
  it("ranks a high-impact, fixable event above a high-impact environmental one", () => {
    const fixable = triagePriority(judgement({ impact: 3, actionable: 0.9 }));
    const environmental = triagePriority(judgement({ impact: 3, actionable: 0.1 }));
    expect(fixable).toBeGreaterThan(environmental);
  });

  it("keeps impact as the main axis", () => {
    const severe = triagePriority(judgement({ impact: 3, actionable: 0 }));
    const harmless = triagePriority(judgement({ impact: 0.5, actionable: 1 }));
    expect(severe).toBeGreaterThan(harmless);
  });

  it("stays within the score range", () => {
    expect(triagePriority(judgement({ impact: 0, actionable: 0 }))).toBe(0);
    expect(triagePriority(judgement({ impact: 3, actionable: 1 }))).toBe(3);
  });
});

describe("triageImpactLabel", () => {
  it("names the nearest level, including scores between levels", () => {
    expect(triageImpactLabel(0)).toBe("影響なし");
    expect(triageImpactLabel(1.4)).toBe("軽微");
    expect(triageImpactLabel(1.6)).toBe("誤案内");
    expect(triageImpactLabel(3)).toBe("利用不能");
  });

  it("clamps values outside the rubric", () => {
    expect(triageImpactLabel(-1)).toBe("影響なし");
    expect(triageImpactLabel(9)).toBe("利用不能");
  });
});

describe("signatureFor", () => {
  it("maps the alert severity back to the log level", () => {
    const base: AlertEntry = {
      ts: 0,
      key: "location:error:GPS timeout",
      logType: "location",
      device: "d1",
      lineId: null,
      lineColor: "#000",
      code: "LOC-E",
      label: "GPS timeout",
      sev: "E",
    };
    expect(signatureFor(base)).toEqual({
      key: "location:error:GPS timeout",
      logType: "location",
      level: "error",
      message: "GPS timeout",
    });
    expect(signatureFor({ ...base, sev: "W" }).level).toBe("warn");
  });
});

describe("summarizeTriage", () => {
  const triage = new Map<string, TriageJudgement>([
    ["mild", judgement({ key: "mild", impact: 1, actionable: 0.9, category: "ui" })],
    ["severe", judgement({ key: "severe", impact: 3, actionable: 0.8, category: "location" })],
    ["environmental", judgement({ key: "environmental", impact: 2, actionable: 0.2 })],
  ]);

  it("picks the highest-priority judgement and counts the fixable ones", () => {
    const summary = summarizeTriage(["mild", "severe", "environmental"], triage);
    expect(summary.worst?.key).toBe("severe");
    expect(summary.needsFix).toBe(2);
    expect(summary.judged).toBe(3);
  });

  it("ignores keys that have no judgement yet", () => {
    const summary = summarizeTriage(["severe", "not-judged-yet"], triage);
    expect(summary.judged).toBe(1);
    expect(summary.worst?.key).toBe("severe");
  });

  it("reports nothing when no key is judged", () => {
    expect(summarizeTriage(["unknown"], triage)).toEqual({
      worst: null,
      needsFix: 0,
      judged: 0,
    });
  });
});
