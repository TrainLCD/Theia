import { describe, expect, it } from "vite-plus/test";
import type { ThqInteractionEvent, ThqLocationUpdate, ThqLogEvent } from "../../src/useThqSocket";
import type { LineMeta } from "./lineCatalog";
import { batteryStateToNumber, buildSnapshotMessages } from "./thqGraphql";
import type { GqlInteractionRow, GqlLocationRow, GqlLogRow, GqlSnapshotData } from "./thqGraphql";

function locationRow(overrides: Partial<GqlLocationRow> = {}): GqlLocationRow {
  return {
    id: "loc-1",
    sessionId: "sess-1",
    device: "iPhone 16",
    state: "moving",
    stationId: 9930138,
    lineId: 99301,
    coords: { latitude: 35.75, longitude: 139.63, accuracy: 9.0, speed: 12.3 },
    timestamp: 1_000,
    segmentId: null,
    fromStationId: null,
    toStationId: null,
    batteryLevel: 0.4,
    batteryState: "unplugged",
    ...overrides,
  };
}

function logRow(overrides: Partial<GqlLogRow> = {}): GqlLogRow {
  return {
    id: "log-1",
    sessionId: "sess-1",
    device: "iPhone 16",
    appVersion: "10.8.0",
    platform: "ios",
    channel: "canary",
    timestamp: 2_000,
    type: "app",
    level: "warn",
    message: "something happened",
    ...overrides,
  };
}

function interactionRow(overrides: Partial<GqlInteractionRow> = {}): GqlInteractionRow {
  return {
    id: "int-1",
    sessionId: "sess-1",
    device: "iPhone 16",
    appVersion: "10.8.0",
    platform: "ios",
    channel: "canary",
    timestamp: 3_000,
    eventName: "app_launch",
    properties: { screen: "home" },
    ...overrides,
  };
}

function emptyData(overrides: Partial<GqlSnapshotData> = {}): GqlSnapshotData {
  return { locations: [], warns: [], errs: [], interactions: [], ...overrides };
}

const LINE_META: LineMeta = {
  id: 99301,
  name: "テスト線",
  nameRoman: "Test Line",
  color: "#ff0000",
  stations: [
    { id: 1, name: "甲駅", nameRoman: "Ko", latitude: 35.0, longitude: 139.0 },
    { id: 2, name: "乙駅", nameRoman: "Otsu", latitude: 35.1, longitude: 139.1 },
  ],
};

describe("batteryStateToNumber", () => {
  it("maps the UIDevice.BatteryState enum order", () => {
    expect(batteryStateToNumber("unknown")).toBe(0);
    expect(batteryStateToNumber("unplugged")).toBe(1);
    expect(batteryStateToNumber("charging")).toBe(2);
    expect(batteryStateToNumber("full")).toBe(3);
    expect(batteryStateToNumber(null)).toBeNull();
  });
});

describe("buildSnapshotMessages", () => {
  it("puts line metadata first, then events sorted oldest to newest", () => {
    const data = emptyData({
      locations: [locationRow({ id: "loc-new", timestamp: 5_000 })],
      warns: [logRow({ id: "log-old", timestamp: 1_000 })],
      interactions: [interactionRow({ id: "int-mid", timestamp: 3_000 })],
    });
    const messages = buildSnapshotMessages(data, [LINE_META]);
    expect(messages.map((m) => m.type)).toEqual([
      "_line_meta",
      "log",
      "interaction",
      "location_update",
    ]);
    expect(messages[0]).toMatchObject({ id: 99301, name: "テスト線", color: "#ff0000" });
  });

  it("converts locations to the snake_case wire shape", () => {
    const messages = buildSnapshotMessages(emptyData({ locations: [locationRow()] }), []);
    expect(messages).toHaveLength(1);
    const loc = messages[0] as ThqLocationUpdate;
    expect(loc).toEqual({
      id: "loc-1",
      type: "location_update",
      session_id: "sess-1",
      device: "iPhone 16",
      state: "moving",
      station_id: 9930138,
      line_id: 99301,
      coords: { latitude: 35.75, longitude: 139.63, accuracy: 9.0, speed: 12.3 },
      timestamp: 1_000,
      segment_id: null,
      from_station_id: null,
      to_station_id: null,
      battery_level: 0.4,
      battery_state: 1,
    });
  });

  it("skips locations missing required fields", () => {
    const data = emptyData({
      locations: [
        locationRow({ device: null }),
        locationRow({ lineId: null }),
        locationRow({ timestamp: null }),
        locationRow({ state: null }),
        locationRow({ coords: null }),
        locationRow({ coords: { latitude: null, longitude: 139.0, accuracy: null, speed: null } }),
      ],
    });
    expect(buildSnapshotMessages(data, [])).toHaveLength(0);
  });

  it("nests log fields and keeps anonymous (null) devices", () => {
    const data = emptyData({
      warns: [logRow({ device: null })],
      errs: [logRow({ id: "log-2", level: "error", type: "system", timestamp: 4_000 })],
    });
    const messages = buildSnapshotMessages(data, []);
    expect(messages).toHaveLength(2);
    const warn = messages[0] as ThqLogEvent;
    expect(warn.device).toBeNull();
    expect(warn.log).toEqual({ type: "app", level: "warn", message: "something happened" });
    const err = messages[1] as ThqLogEvent;
    expect(err.log).toEqual({ type: "system", level: "error", message: "something happened" });
  });

  it("converts interactions and passes properties through", () => {
    const messages = buildSnapshotMessages(emptyData({ interactions: [interactionRow()] }), []);
    const inter = messages[0] as ThqInteractionEvent;
    expect(inter.type).toBe("interaction");
    expect(inter.event_name).toBe("app_launch");
    expect(inter.properties).toEqual({ screen: "home" });
    expect(inter.session_id).toBe("sess-1");
  });

  it("skips interactions and logs missing required fields", () => {
    const data = emptyData({
      warns: [logRow({ message: null }), logRow({ level: null }), logRow({ timestamp: null })],
      interactions: [interactionRow({ eventName: null }), interactionRow({ timestamp: null })],
    });
    expect(buildSnapshotMessages(data, [])).toHaveLength(0);
  });
});
