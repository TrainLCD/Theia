import type { ReactNode } from "react";
import type { View } from "../types";

export interface TabNavProps {
  view: View;
  onChangeView: (v: View) => void;
  counts: { normal: number; warn: number; err: number };
}

export function TabNav({ view, onChangeView, counts }: TabNavProps) {
  const navColor = (v: View) => (view === v ? "#e6edf7" : "#6b7d9c");
  return (
    <nav
      style={{
        height: 46,
        flex: "none",
        display: "flex",
        alignItems: "stretch",
        gap: 2,
        padding: "0 14px",
        background: "#0a101d",
        borderBottom: "1px solid #1e2c44",
      }}
    >
      <NavButton
        active={view === "network"}
        color={navColor("network")}
        onClick={() => onChangeView("network")}
      >
        ネットワーク監視
      </NavButton>
      <NavButton
        active={view === "map"}
        color={navColor("map")}
        onClick={() => onChangeView("map")}
      >
        マップ
      </NavButton>
      <NavButton
        active={view === "line"}
        color={navColor("line")}
        onClick={() => onChangeView("line")}
      >
        路線フォーカス
      </NavButton>
      <NavButton
        active={view === "engineer"}
        color={navColor("engineer")}
        onClick={() => onChangeView("engineer")}
      >
        エラー解析
      </NavButton>
      <NavButton
        active={view === "interactions"}
        color={navColor("interactions")}
        onClick={() => onChangeView("interactions")}
      >
        インタラクション
      </NavButton>
      <div style={{ flex: 1 }} />
      <div
        className="font-mono"
        style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 6, fontSize: 11 }}
      >
        <Legend color="#22c55e" label={`正常 ${counts.normal}`} />
        <Legend color="#f59e0b" label={`警告 ${counts.warn}`} />
        <Legend color="#ef4444" label={`エラー ${counts.err}`} />
      </div>
    </nav>
  );
}

function NavButton({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        background: "transparent",
        border: "none",
        color,
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 600,
        padding: "0 18px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
      {children}
      {active && (
        <span
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 0,
            height: 2,
            background: "#e6edf7",
            borderRadius: 2,
          }}
        />
      )}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#8597b3" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}
