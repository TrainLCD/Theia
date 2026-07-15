// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { MapData, MapLineView, MapTrainView } from "../types";
import { ViewSettingsProvider } from "../useViewSetting";
import { MapView } from "./MapView";

function line(id: number, name: string, color: string): MapLineView {
  return {
    meta: { id, name, color },
    pointsStr: `0,0 ${id * 10},${id * 10}`,
    stations: [{ id: id * 100, name: `${name} 駅`, nameRoman: null, x: id * 5, y: id * 5 }],
    count: 1,
  };
}

function train(id: string, lineId: number): MapTrainView {
  return {
    id,
    no: id,
    statusLabel: "走行",
    lineName: `Line ${lineId}`,
    lineId,
    isAlert: false,
    statusColor: "#4ade80",
    glowColor: "#4ade80",
    mapX: 50,
    mapY: 50,
    headAngle: 0,
    hasMapPosition: true,
  } as unknown as MapTrainView;
}

function makeData(): MapData {
  return {
    lines: [line(1, "山手線", "#9acd32"), line(2, "中央線", "#ffa500")],
    trains: [train("T1", 1), train("T2", 2)],
    bounds: { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 },
  };
}

afterEach(cleanup);

describe("MapView 路線の表示切替", () => {
  it("路線ごとに切替スイッチを描画し、初期状態では全て表示する", () => {
    const { container, getAllByRole } = render(
      <MapView data={makeData()} sel={null} onSelectTrain={() => {}} />,
    );
    const switches = getAllByRole("switch");
    expect(switches).toHaveLength(2);
    for (const sw of switches) expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
  });

  it("凡例の行をクリックすると、その路線のポリラインと列車を非表示にする", () => {
    const { container, getAllByRole, queryByTitle } = render(
      <MapView data={makeData()} sel={null} onSelectTrain={() => {}} />,
    );
    expect(queryByTitle(/^T1/)).not.toBeNull();

    fireEvent.click(getAllByRole("switch")[0]);

    expect(getAllByRole("switch")[0].getAttribute("aria-checked")).toBe("false");
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
    // 非表示にした路線の列車は消え、もう一方の路線の列車は残る。
    expect(queryByTitle(/^T1/)).toBeNull();
    expect(queryByTitle(/^T2/)).not.toBeNull();
  });

  it("行を再度クリックすると路線を再表示する", () => {
    const { container, getAllByRole } = render(
      <MapView data={makeData()} sel={null} onSelectTrain={() => {}} />,
    );
    const firstSwitch = () => getAllByRole("switch")[0];

    fireEvent.click(firstSwitch());
    expect(container.querySelectorAll("polyline")).toHaveLength(1);

    fireEvent.click(firstSwitch());
    expect(firstSwitch().getAttribute("aria-checked")).toBe("true");
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
  });
});

describe("MapView 設定の保持", () => {
  // タブ切替(view の条件付きレンダリング)による MapView のアンマウントを模す。
  function Harness({ showMap }: { showMap: boolean }) {
    return (
      <ViewSettingsProvider>
        {showMap && <MapView data={makeData()} sel={null} onSelectTrain={() => {}} />}
      </ViewSettingsProvider>
    );
  }

  it("タブ切替でアンマウントされても路線の表示/非表示を保持する", () => {
    const { rerender, getAllByRole, container } = render(<Harness showMap />);
    fireEvent.click(getAllByRole("switch")[0]);
    expect(container.querySelectorAll("polyline")).toHaveLength(1);

    rerender(<Harness showMap={false} />);
    rerender(<Harness showMap />);

    expect(getAllByRole("switch")[0].getAttribute("aria-checked")).toBe("false");
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
  });
});

describe("MapView 等倍の再フィット", () => {
  it("路線を非表示にすると、表示中の要素だけで等倍の表示範囲を再計算する", () => {
    const { container, getAllByRole, getByTitle } = render(
      <MapView data={makeData()} sel={null} onSelectTrain={() => {}} />,
    );

    fireEvent.click(getAllByRole("switch")[0]);

    // 可視要素は中央線の駅 (10,10) と T2 (50,50)。
    // 範囲 10〜50 に 6% パディングを加えて 0〜100 へ再正規化される。
    const poly = container.querySelector("polyline");
    expect(poly?.getAttribute("points")).toBe("5.36,5.36");
    const t2 = getByTitle(/^T2/);
    expect(Number.parseFloat(t2.style.left)).toBeCloseTo(94.64, 2);
    expect(Number.parseFloat(t2.style.top)).toBeCloseTo(94.64, 2);
  });

  it("再表示すると元の座標に戻る", () => {
    const { container, getAllByRole } = render(
      <MapView data={makeData()} sel={null} onSelectTrain={() => {}} />,
    );
    const firstSwitch = () => getAllByRole("switch")[0];

    fireEvent.click(firstSwitch());
    fireEvent.click(firstSwitch());

    const polys = container.querySelectorAll("polyline");
    expect(polys).toHaveLength(2);
    expect(polys[0]?.getAttribute("points")).toBe("0,0 10,10");
  });
});
