import { describe, expect, it } from "vite-plus/test";
import type { FreezeRow, FreezeSessionRow, FreezeSummaryRow } from "../../src/useThqFreezes";
import { buildFilterVariables, collectLineIds, parseFreezeQuery } from "./thqFreeze";
import type { FreezeFilter } from "./thqFreeze";

const NOW = Date.parse("2026-09-09T12:00:00.000Z");

function ok(result: ReturnType<typeof parseFreezeQuery>): FreezeFilter {
  if ("error" in result) throw new Error(`expected a filter, got: ${result.error}`);
  return result.filter;
}

describe("parseFreezeQuery", () => {
  it("defaults to the last 7 days with the THQ default thresholds", () => {
    const filter = ok(parseFreezeQuery({}, NOW));
    expect(filter.to).toBe("2026-09-09T12:00:00.000Z");
    expect(filter.from).toBe("2026-09-02T12:00:00.000Z");
    expect(filter.gapThresholdMs).toBe(60_000);
    expect(filter.speedThresholdKmh).toBe(30);
    expect(filter.requireAppAlive).toBe(true);
    expect(filter.limit).toBe(200);
  });

  it('only drops requireAppAlive on an explicit "false"', () => {
    expect(ok(parseFreezeQuery({ requireAppAlive: "false" }, NOW)).requireAppAlive).toBe(false);
    expect(ok(parseFreezeQuery({ requireAppAlive: "true" }, NOW)).requireAppAlive).toBe(true);
    expect(ok(parseFreezeQuery({ requireAppAlive: "" }, NOW)).requireAppAlive).toBe(true);
  });

  it("clamps the thresholds and the limit to the upstream bounds", () => {
    const filter = ok(
      parseFreezeQuery({ gapThresholdMs: "10", speedThresholdKmh: "-5", limit: "9999" }, NOW),
    );
    expect(filter.gapThresholdMs).toBe(1_000);
    expect(filter.speedThresholdKmh).toBe(0);
    expect(filter.limit).toBe(2000);
  });

  it("rejects a range wider than 90 days, an inverted range and unparsable dates", () => {
    const wide = parseFreezeQuery(
      { from: "2026-01-01T00:00:00Z", to: "2026-09-09T00:00:00Z" },
      NOW,
    );
    expect(wide).toEqual({ error: "the time range must be at most 90 days" });
    const inverted = parseFreezeQuery(
      { from: "2026-09-09T00:00:00Z", to: "2026-09-08T00:00:00Z" },
      NOW,
    );
    expect(inverted).toEqual({ error: '"from" must be earlier than "to"' });
    expect(parseFreezeQuery({ from: "yesterday" }, NOW)).toEqual({
      error: 'invalid "from": yesterday',
    });
  });

  it("rejects numeric params that were supplied but cannot be parsed", () => {
    // 既定値に落とすと、指定したつもりの条件と違う結果が返っても気付けない。
    expect(parseFreezeQuery({ gapThresholdMs: "abc" }, NOW)).toEqual({
      error: 'invalid "gapThresholdMs": abc',
    });
    expect(parseFreezeQuery({ speedThresholdKmh: "fast" }, NOW)).toEqual({
      error: 'invalid "speedThresholdKmh": fast',
    });
    expect(parseFreezeQuery({ limit: "all" }, NOW)).toEqual({ error: 'invalid "limit": all' });
    expect(parseFreezeQuery({ lineId: "yamanote" }, NOW)).toEqual({
      error: 'invalid "lineId": yamanote',
    });
    // 未指定は従来どおり既定値のまま。
    expect(ok(parseFreezeQuery({}, NOW))).toMatchObject({
      gapThresholdMs: 60_000,
      speedThresholdKmh: 30,
      limit: 200,
      lineId: null,
    });
  });

  it("rejects enum values the upstream schema does not know", () => {
    expect(parseFreezeQuery({ platform: "windows" }, NOW)).toEqual({
      error: 'invalid "platform": windows',
    });
    expect(parseFreezeQuery({ channel: "beta" }, NOW)).toEqual({
      error: 'invalid "channel": beta',
    });
    expect(parseFreezeQuery({ lineId: "11302.5" }, NOW)).toEqual({
      error: 'invalid "lineId": 11302.5',
    });
    expect(ok(parseFreezeQuery({ platform: "ios", lineId: "11302" }, NOW))).toMatchObject({
      platform: "ios",
      lineId: 11302,
    });
  });
});

describe("buildFilterVariables", () => {
  it("omits unset filters so the upstream treats them as unfiltered", () => {
    const vars = buildFilterVariables(ok(parseFreezeQuery({ device: "iPhone 16" }, NOW)));
    expect(vars).toEqual({
      from: "2026-09-02T12:00:00.000Z",
      to: "2026-09-09T12:00:00.000Z",
      gapThresholdMs: 60_000,
      speedThresholdKmh: 30,
      requireAppAlive: true,
      device: "iPhone 16",
    });
    expect(vars).not.toHaveProperty("lineId");
    expect(vars).not.toHaveProperty("limit");
  });
});

describe("collectLineIds", () => {
  it("merges the line ids of all three result shapes, deduped and ascending", () => {
    const freezes = [{ lineId: 11302 }, { lineId: null }] as FreezeRow[];
    const sessions = [{ lineIds: [99301, 11302] }, { lineIds: [] }] as FreezeSessionRow[];
    const summary = [{ lineId: 21002 }, { lineId: 11302 }] as FreezeSummaryRow[];
    expect(collectLineIds({ freezes, sessions, summary })).toEqual([11302, 21002, 99301]);
  });
});
