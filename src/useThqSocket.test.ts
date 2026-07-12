import { describe, expect, it } from "vite-plus/test";
import { applyMessage } from "./useThqSocket";
import type {
  ThqDevicesState,
  ThqLineMetaEvent,
  ThqLocationUpdate,
  ThqLogEvent,
  ThqMessage,
} from "./useThqSocket";

const BASE: ThqDevicesState = {
  connection: "open",
  received: 0,
  lastError: null,
  devices: new Map(),
  alerts: [],
  lineMetadata: new Map(),
  interactions: [],
  batteryHistory: new Map(),
  latestLocation: null,
  latestLog: null,
  now: 0,
};

function replay(messages: ThqMessage[], ts = 1_000_000): ThqDevicesState {
  let state = BASE;
  for (const m of messages) state = applyMessage(state, m, ts);
  return state;
}

function lineMeta(): ThqLineMetaEvent {
  return {
    type: "_line_meta",
    id: 99301,
    name: "テスト線",
    nameRoman: "Test Line",
    color: "#ff0000",
    stations: [
      { id: 1, name: "甲駅", nameRoman: "Ko", latitude: 35.0, longitude: 139.0 },
      { id: 2, name: "乙駅", nameRoman: "Otsu", latitude: 35.1, longitude: 139.1 },
    ],
  };
}

function location(overrides: Partial<ThqLocationUpdate> = {}): ThqLocationUpdate {
  return {
    id: `loc-${overrides.timestamp ?? 1_000}`,
    type: "location_update",
    device: "iPhone 16",
    state: "moving",
    station_id: null,
    line_id: 99301,
    coords: { latitude: 35.05, longitude: 139.05, accuracy: 9.0, speed: 10.0 },
    timestamp: 1_000,
    battery_level: 0.5,
    battery_state: 1,
    ...overrides,
  };
}

function warnLog(ts: number, message = "warn message"): ThqLogEvent {
  return {
    id: `log-${ts}`,
    type: "log",
    device: "iPhone 16",
    timestamp: ts,
    log: { type: "app", level: "warn", message },
  };
}

describe("applyMessage replay (snapshot seeding)", () => {
  it("seeds a device from a location after line metadata", () => {
    const state = replay([lineMeta(), location({ timestamp: 5_000 })]);
    const device = state.devices.get("iPhone 16");
    expect(device).toBeDefined();
    expect(device?.lineId).toBe(99301);
    expect(device?.lastSeenAt).toBe(5_000);
    expect(device?.batteryLevel).toBe(0.5);
    // 路線メタが先に適用されていれば座標から路線上の位置が射影できる。
    expect(device?.lastLeftPct).not.toBeNull();
    expect(state.latestLocation?.timestamp).toBe(5_000);
  });

  it("keeps alerts newest-first and capped at 40", () => {
    const logs = Array.from({ length: 45 }, (_, i) => warnLog(1_000 + i, `w${i}`));
    const state = replay(logs);
    expect(state.alerts).toHaveLength(40);
    expect(state.alerts[0]?.label).toBe("w44");
    expect(state.alerts[39]?.label).toBe("w5");
  });

  it("keeps interactions newest-first", () => {
    const state = replay([
      {
        id: "int-1",
        type: "interaction",
        device: "iPhone 16",
        timestamp: 1_000,
        event_name: "first",
        properties: null,
      },
      {
        id: "int-2",
        type: "interaction",
        device: "iPhone 16",
        timestamp: 2_000,
        event_name: "second",
        properties: null,
      },
    ]);
    expect(state.interactions.map((i) => i.event_name)).toEqual(["second", "first"]);
  });

  it("thins unchanged battery samples closer than 30s apart", () => {
    const state = replay([
      location({ timestamp: 1_000 }),
      // 残量・充電状態が同じで 30 秒未満 → 間引かれる。
      location({ timestamp: 11_000 }),
      // 30 秒以上空けば残す。
      location({ timestamp: 41_000 }),
      // 残量が変われば間隔に関わらず残す。
      location({ timestamp: 42_000, battery_level: 0.4 }),
    ]);
    const history = state.batteryHistory.get("iPhone 16");
    expect(history?.map((h) => h.ts)).toEqual([1_000, 41_000, 42_000]);
    expect(history?.map((h) => h.pct)).toEqual([50, 50, 40]);
  });

  it("counts each applied event as received", () => {
    const state = replay([location({ timestamp: 1_000 }), warnLog(2_000)]);
    expect(state.received).toBe(2);
  });
});
