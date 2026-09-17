// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AlertEntry } from "./types";
import {
  MAX_TRIAGE_BATCH,
  useAlertTriage,
  type TriageJudgement,
  type TriagePayload,
} from "./useAlertTriage";

function alert(n: number): AlertEntry {
  return {
    ts: n,
    key: `location:error:msg ${n}`,
    logType: "location",
    device: "d1",
    lineId: null,
    lineColor: "#000",
    code: "LOC-E",
    label: `msg ${n}`,
    sev: "E",
  };
}

function judgementFor(key: string): TriageJudgement {
  return {
    key,
    impact: 2,
    impactConfidence: 0.8,
    category: "location",
    categoryConfidence: 0.9,
    actionable: 0.7,
  };
}

/** 送られた署名を記録し、payload を組み立てて返す fetch の差し替え。 */
function stubFetch(respond: (keys: string[]) => TriagePayload) {
  const batches: string[][] = [];
  const fetchStub = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as {
      signatures: { key: string }[];
    };
    const keys = body.signatures.map((s) => s.key);
    batches.push(keys);
    return new Response(JSON.stringify(respond(keys)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchStub);
  return { batches };
}

function Harness({ alerts, onState }: { alerts: AlertEntry[]; onState: (n: number) => void }) {
  const { judgements } = useAlertTriage(alerts);
  onState(judgements.size);
  return <div data-testid="count">{judgements.size}</div>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useAlertTriage", () => {
  it("keeps requesting until every alert is judged, past the batch limit", async () => {
    const alerts = Array.from({ length: MAX_TRIAGE_BATCH + 9 }, (_, i) => alert(i));
    const { batches } = stubFetch((keys) => ({ judgements: keys.map(judgementFor) }));

    const { getByTestId } = render(<Harness alerts={alerts} onState={() => {}} />);

    // 1 バッチ目は上限ぶん。alerts が変わらなくても続きを取りに行く。
    await waitFor(() => expect(getByTestId("count").textContent).toBe(String(alerts.length)));
    expect(batches.length).toBe(2);
    expect(batches[0]!.length).toBe(MAX_TRIAGE_BATCH);
    expect(batches[1]!.length).toBe(9);
    expect(new Set(batches.flat()).size).toBe(alerts.length);
  });

  it("retries a signature the server did not answer, then gives up", async () => {
    const alerts = [alert(1), alert(2)];
    // 2 件目だけ判定を返さない (部分成功)。
    const { batches } = stubFetch((keys) => ({
      judgements: keys.filter((k) => k.endsWith("1")).map(judgementFor),
      error: "1 件の判定に失敗: boom",
    }));

    render(<Harness alerts={alerts} onState={() => {}} />);

    // 返らなかった文面は次のバッチで送り直され、上限に達したら候補から外れる。
    await waitFor(() => expect(batches.length).toBe(2));
    expect(batches[1]).toEqual([alert(2).key]);
    await new Promise((r) => setTimeout(r, 20));
    expect(batches.length).toBe(2);
  });

  it("stops asking once nothing is left to judge", async () => {
    const alerts = [alert(1)];
    const { batches } = stubFetch((keys) => ({ judgements: keys.map(judgementFor) }));

    const { getByTestId } = render(<Harness alerts={alerts} onState={() => {}} />);
    await waitFor(() => expect(getByTestId("count").textContent).toBe("1"));
    await new Promise((r) => setTimeout(r, 20));
    expect(batches.length).toBe(1);
  });
});
