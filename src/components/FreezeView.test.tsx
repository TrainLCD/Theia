// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ExternalLineMeta } from "../types";
import type { FreezeQuery, FreezeState } from "../useThqFreezes";
import { ViewSettingsProvider } from "../useViewSetting";
import { DEFAULT_FREEZE_QUERY, FreezeView } from "./FreezeView";

const LINE_METADATA = new Map<number, ExternalLineMeta>();

function state(overrides: Partial<FreezeState> = {}): FreezeState {
  return {
    freezes: [],
    sessions: [],
    summary: [],
    lines: [{ id: 11302, name: "山手線", color: "#80C241" }],
    loading: false,
    fetchedAt: Date.parse("2026-09-09T12:00:00Z"),
    reload: () => {},
    ...overrides,
  };
}

const SUMMARY_ROW = {
  lineId: 11302,
  segmentId: "11302:1130201:1130202",
  fromStationId: 1130201,
  toStationId: 1130202,
  device: "iPhone 16",
  appVersion: "10.15.0(2895)",
  platform: "ios" as const,
  channel: "canary" as const,
  sessionCount: 3,
  locationCount: 210,
  freezeSessionCount: 1,
  freezeCount: 2,
  maxGapMs: 300_000,
  totalGapMs: 420_000,
};

const FREEZE_ROW = {
  sessionId: "sess-1",
  device: "iPhone 16",
  lineId: 11302,
  segmentId: null,
  fromStationId: null,
  toStationId: null,
  appVersion: "10.15.0(2895)",
  platform: "ios" as const,
  channel: "canary" as const,
  gapStart: "2026-09-09T00:09:39.126Z",
  gapEnd: "2026-09-09T00:14:39.126Z",
  gapMs: 300_000,
  speedBeforeGap: 74.5,
  coordsBeforeGap: { latitude: 35.65, longitude: 139.7, accuracy: 12, speed: 74.5 },
  coordsAfterGap: { latitude: 35.66, longitude: 139.71, accuracy: 15, speed: 60 },
  jumpDistanceMeters: 1340.2,
  aliveEventCount: 7,
};

function renderView(freeze: FreezeState, onChangeQuery: (q: FreezeQuery) => void = () => {}) {
  return render(
    <ViewSettingsProvider>
      <FreezeView
        freeze={freeze}
        query={DEFAULT_FREEZE_QUERY}
        onChangeQuery={onChangeQuery}
        lineMetadata={LINE_METADATA}
      />
    </ViewSettingsProvider>,
  );
}

afterEach(cleanup);

describe("FreezeView", () => {
  it("集計タブを初期表示し、路線名とビルドを解決して並べる", () => {
    const { getAllByText, getByText } = renderView(state({ summary: [SUMMARY_ROW] }));
    // 路線フィルタの選択肢にも同じ名前が出るため、表の行と合わせて 2 箇所。
    expect(getAllByText("山手線").length).toBeGreaterThan(0);
    expect(getByText("10.15.0(2895) · ios · canary")).toBeTruthy();
    expect(getByText("11302:1130201:1130202")).toBeTruthy();
  });

  it("凍結が 0 件でも対象セッションがあれば「凍結なし」として区別できる", () => {
    const { getByText, queryByText } = renderView(
      state({
        summary: [{ ...SUMMARY_ROW, freezeSessionCount: 0, freezeCount: 0, maxGapMs: null }],
      }),
    );
    // 集計グループはあるが凍結はゼロ、という状態が読み取れること。
    expect(getByText("集計グループ").nextSibling?.textContent).toBe("1");
    expect(getByText("凍結件数").nextSibling?.textContent).toBe("0");
    expect(queryByText("条件に一致するグループがありません")).toBeNull();
  });

  it("タブを切り替えると個別の欠落を欠落長・ずれ付きで表示する", () => {
    const { getByText } = renderView(state({ freezes: [FREEZE_ROW] }));
    fireEvent.click(getByText("個別の欠落"));
    expect(getByText("5分00秒")).toBeTruthy();
    expect(getByText("1.34km")).toBeTruthy();
    expect(getByText("74.5")).toBeTruthy();
  });

  it("しきい値プリセットを押すとクエリを更新する", () => {
    let next: FreezeQuery | null = null;
    const { getByText } = renderView(state(), (q) => {
      next = q;
    });
    fireEvent.click(getByText("3分"));
    expect(next).toMatchObject({ gapThresholdMs: 180_000 });
  });

  it("取得失敗は空表示ではなく理由付きで知らせる", () => {
    const { getByText } = renderView(state({ error: "HTTP 401" }));
    expect(getByText("取得に失敗しました: HTTP 401")).toBeTruthy();
  });
});
