// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { MapData, MapLineView, MapTrainView } from "../types";
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
