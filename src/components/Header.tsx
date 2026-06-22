import type { ReactNode } from "react";

export interface HeaderProps {
  kpis: { running: number; total: number; alerts: number; avgMeters: number; avgSpeed: number };
  clock: string;
  dateStr: string;
}

export function Header({ kpis, clock, dateStr }: HeaderProps) {
  return (
    <header
      style={{
        height: 62,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "0 22px",
        background: "linear-gradient(180deg,#0e1626,#0b1220)",
        borderBottom: "1px solid #1e2c44",
        zIndex: 5,
      }}
    >
      <Brand />
      <div style={{ width: 1, height: 30, background: "#1e2c44" }} />
      <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
        <KpiBlock label="稼働中 / 全デバイス">
          <span className="font-mono" style={{ color: "#22c55e", fontSize: 19, fontWeight: 600 }}>
            {kpis.running}
          </span>
          <span className="font-mono" style={{ color: "#3c4a63", fontSize: 14 }}>
            {" "}
            / {kpis.total}
          </span>
        </KpiBlock>
        <KpiBlock label="警報">
          <span className="font-mono" style={{ color: "#f59e0b", fontSize: 19, fontWeight: 600 }}>
            {kpis.alerts}
            <span style={{ fontSize: 11, color: "#6b7d9c" }}> 件</span>
          </span>
        </KpiBlock>
        <KpiBlock label="平均位置情報精度">
          <span className="font-mono" style={{ color: "#38bdf8", fontSize: 19, fontWeight: 600 }}>
            {kpis.avgMeters}
            <span style={{ fontSize: 11, color: "#6b7d9c" }}> m</span>
          </span>
        </KpiBlock>
        <KpiBlock label="平均速度">
          <span className="font-mono" style={{ color: "#e6edf7", fontSize: 19, fontWeight: 600 }}>
            {kpis.avgSpeed}
            <span style={{ fontSize: 11, color: "#6b7d9c" }}> km/h</span>
          </span>
        </KpiBlock>
      </div>
      <div style={{ flex: 1 }} />
      <LiveIndicator />
      <div style={{ textAlign: "right", lineHeight: 1.15 }}>
        <div
          className="font-mono"
          style={{ fontSize: 21, fontWeight: 600, letterSpacing: ".04em" }}
        >
          {clock}
        </div>
        <div style={{ fontSize: 10.5, color: "#6b7d9c" }}>{dateStr}</div>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "radial-gradient(circle at 50% 35%, #15294b, #0c1830)",
          border: "1px solid #2b3f63",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid #3b82f6" }} />
        <div
          style={{
            position: "absolute",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#7dd3fc",
            boxShadow: "0 0 8px #38bdf8",
          }}
        />
      </div>
      <div style={{ lineHeight: 1.12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".16em" }}>THEIA</div>
        <div style={{ fontSize: 10, color: "#6b7d9c", letterSpacing: ".1em", fontWeight: 500 }}>
          The TrainLCD Project
        </div>
      </div>
    </div>
  );
}

function LiveIndicator() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 11px",
        border: "1px solid #1e3a2a",
        background: "#0c1a13",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#22c55e",
          animation: "blink 1.4s infinite",
        }}
      />
      <span style={{ fontSize: 11, fontWeight: 600, color: "#4ade80", letterSpacing: ".1em" }}>
        LIVE
      </span>
    </div>
  );
}

function KpiBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ lineHeight: 1.1 }}>
      <div style={{ fontSize: 10, color: "#6b7d9c", letterSpacing: ".08em" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
