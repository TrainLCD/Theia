import type { TrainView } from "../types";

type BatteryInfo = Pick<TrainView, "batteryPct" | "batteryCharging" | "batteryColor">;

export function BatteryBadge({ tr, fontSize = 11 }: { tr: BatteryInfo; fontSize?: number }) {
  if (tr.batteryPct == null) return null;
  const h = Math.round(fontSize * 0.85);
  const w = h * 2;
  return (
    <span
      title={`バッテリ ${tr.batteryPct}%${tr.batteryCharging ? " (充電中)" : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, flex: "none" }}
    >
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <span
          style={{
            width: w,
            height: h,
            border: "1px solid #3b4c68",
            borderRadius: 2,
            padding: 1.5,
            display: "inline-flex",
            boxSizing: "border-box",
          }}
        >
          <span
            style={{
              width: `${tr.batteryPct}%`,
              background: tr.batteryColor,
              borderRadius: 1,
            }}
          />
        </span>
        <span
          style={{
            width: 2,
            height: Math.max(3, Math.round(h * 0.4)),
            background: "#3b4c68",
            borderRadius: "0 1px 1px 0",
          }}
        />
      </span>
      <span className="font-mono" style={{ fontSize, color: tr.batteryColor, fontWeight: 600 }}>
        {tr.batteryCharging ? "⚡" : ""}
        {tr.batteryPct}%
      </span>
    </span>
  );
}
