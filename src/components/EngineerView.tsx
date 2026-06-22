import type { ReactNode } from "react";
import type { Filter, TrainView } from "../types";

const GRID = "1.1fr .9fr .7fr 1.2fr .8fr .7fr 1.5fr";

export interface EngineerViewProps {
  table: TrainView[];
  worst: TrainView[];
  engSel: TrainView | undefined;
  filter: Filter;
  onFilter: (f: Filter) => void;
  onSelectTrain: (id: string) => void;
  selectedId: string | null;
  counts: { total: number; alerts: number; err: number; commBad: number };
}

export function EngineerView({
  table,
  worst,
  engSel,
  filter,
  onFilter,
  onSelectTrain,
  selectedId,
  counts,
}: EngineerViewProps) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          padding: "16px 18px",
          gap: 12,
          overflow: "hidden",
        }}
      >
        <FilterBar filter={filter} onFilter={onFilter} counts={counts} />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            border: "1px solid #1a2740",
            borderRadius: 10,
          }}
        >
          <TableHeader />
          {table.map((tr) => (
            <TableRow
              key={tr.id}
              tr={tr}
              selected={tr.id === selectedId}
              onSelect={() => onSelectTrain(tr.id)}
            />
          ))}
        </div>
      </div>

      <aside
        style={{
          width: 340,
          flex: "none",
          borderLeft: "1px solid #1e2c44",
          background: "#0a101d",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {engSel && <DiagnosticsPanel engSel={engSel} />}
        <WorstList worst={worst} onSelectTrain={onSelectTrain} />
      </aside>
    </div>
  );
}

function FilterBar({
  filter,
  onFilter,
  counts,
}: {
  filter: Filter;
  onFilter: (f: Filter) => void;
  counts: { total: number; alerts: number; err: number; commBad: number };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#8597b3", letterSpacing: ".14em" }}>
        全デバイス診断
      </div>
      <div style={{ flex: 1 }} />
      <FilterChip on={filter === "all"} color="#cdd8e8" onClick={() => onFilter("all")}>
        すべて {counts.total}
      </FilterChip>
      <FilterChip on={filter === "alert"} color="#fbbf24" onClick={() => onFilter("alert")}>
        警報 {counts.alerts}
      </FilterChip>
      <FilterChip on={filter === "error"} color="#f87171" onClick={() => onFilter("error")}>
        エラー {counts.err}
      </FilterChip>
      <FilterChip on={filter === "comm"} color="#cdd8e8" onClick={() => onFilter("comm")}>
        通信異常 {counts.commBad}
      </FilterChip>
    </div>
  );
}

function FilterChip({
  on,
  color,
  onClick,
  children,
}: {
  on: boolean;
  color: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 7,
        border: `1px solid ${on ? "#3b82f6" : "#1e2c44"}`,
        background: on ? "#10203b" : "#0c1322",
        color,
        fontFamily: "inherit",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TableHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        gap: 0,
        position: "sticky",
        top: 0,
        background: "#0d1626",
        borderBottom: "1px solid #1e2c44",
        fontSize: 10,
        color: "#6b7d9c",
        fontWeight: 600,
        letterSpacing: ".06em",
        zIndex: 2,
      }}
    >
      <div style={{ padding: "10px 12px" }}>デバイス</div>
      <div style={{ padding: "10px 12px" }}>路線</div>
      <div style={{ padding: "10px 12px" }}>速度</div>
      <div style={{ padding: "10px 12px" }}>位置情報精度</div>
      <div style={{ padding: "10px 12px" }}>通信</div>
      <div style={{ padding: "10px 12px" }}>状態</div>
      <div style={{ padding: "10px 12px" }}>エラーコード</div>
    </div>
  );
}

function TableRow({
  tr,
  selected,
  onSelect,
}: {
  tr: TrainView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        gap: 0,
        borderBottom: "1px solid #131d31",
        background: selected ? "#10203b" : "transparent",
        cursor: "pointer",
        alignItems: "center",
        fontSize: 11.5,
      }}
    >
      <div style={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            color: "#0a101d",
            background: tr.typeColor,
            padding: "1px 5px",
            borderRadius: 3,
          }}
        >
          {tr.type}
        </span>
        <span className="font-mono" style={{ fontWeight: 600, color: "#dbe6f5" }}>
          {tr.no}
        </span>
      </div>
      <div style={{ padding: "9px 12px", color: "#aeb9cc" }}>
        <span style={{ color: tr.lineColor }}>●</span> {tr.lineName}
      </div>
      <div className="font-mono" style={{ padding: "9px 12px", color: "#cdd8e8" }}>
        {tr.speed}
      </div>
      <div style={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{ flex: 1, height: 5, borderRadius: 3, background: "#1b2740", overflow: "hidden" }}
        >
          <div style={{ width: `${tr.conf}%`, height: "100%", background: tr.confColor }} />
        </div>
        <span className="font-mono" style={{ color: tr.confColor, width: 44 }}>
          ±{tr.meters}m
        </span>
      </div>
      <div style={{ padding: "9px 12px", fontWeight: 600, color: tr.commColor }}>
        {tr.commLabel}
      </div>
      <div style={{ padding: "9px 12px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: tr.statusColor,
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: tr.statusColor }} />
          {tr.statusLabel}
        </span>
      </div>
      <div className="font-mono" style={{ padding: "9px 12px", fontSize: 10.5, color: "#94a3b8" }}>
        {tr.errorCodes}
      </div>
    </div>
  );
}

function DiagnosticsPanel({ engSel }: { engSel: TrainView }) {
  return (
    <div style={{ padding: 16, borderBottom: "1px solid #1e2c44" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#8597b3",
          letterSpacing: ".14em",
          marginBottom: 12,
        }}
      >
        デバイス診断
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#0a101d",
            background: engSel.typeColor,
            padding: "2px 7px",
            borderRadius: 4,
          }}
        >
          {engSel.type}
        </span>
        <span className="font-mono" style={{ fontSize: 18, fontWeight: 600 }}>
          {engSel.no}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: engSel.statusColor,
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: engSel.statusColor }}
          />
          {engSel.statusLabel}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <DiagTile label="速度">
          <span className="font-mono" style={{ fontSize: 20, fontWeight: 600 }}>
            {engSel.speed}
            <span style={{ fontSize: 10, color: "#6b7d9c" }}> km/h</span>
          </span>
        </DiagTile>
        <DiagTile label="位置情報精度">
          <span
            className="font-mono"
            style={{ fontSize: 20, fontWeight: 600, color: engSel.confColor }}
          >
            ±{engSel.meters}
            <span style={{ fontSize: 10, color: "#6b7d9c" }}> m</span>
          </span>
        </DiagTile>
        <DiagTile label="進行方向">
          <span style={{ fontSize: 18, fontWeight: 600, paddingTop: 2 }}>
            {engSel.dirGlyph} {engSel.dirText}
          </span>
        </DiagTile>
        <DiagTile label="通信状態">
          <span style={{ fontSize: 17, fontWeight: 600, color: engSel.commColor, paddingTop: 2 }}>
            {engSel.commLabel}
          </span>
        </DiagTile>
      </div>
      <div style={{ fontSize: 10, color: "#6b7d9c", marginBottom: 7, letterSpacing: ".08em" }}>
        検出エラー / 警告
      </div>
      {engSel.hasErrors ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {engSel.errors.map((e) => (
            <div
              key={e.code}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "9px 10px",
                background: e.bg,
                border: `1px solid ${e.color}`,
                borderRadius: 7,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: e.color,
                  border: `1px solid ${e.color}`,
                  padding: "1px 5px",
                  borderRadius: 3,
                }}
              >
                {e.sev}
              </span>
              <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: e.color }}>
                {e.code}
              </span>
              <span style={{ fontSize: 11.5, color: "#cdd8e8" }}>{e.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 10px",
            background: "#0c1a13",
            border: "1px solid #1e3a2a",
            borderRadius: 7,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ fontSize: 11.5, color: "#86efac" }}>検出されたエラーはありません</span>
        </div>
      )}
    </div>
  );
}

function DiagTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{ padding: 11, background: "#0c1322", border: "1px solid #18233a", borderRadius: 8 }}
    >
      <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function WorstList({
  worst,
  onSelectTrain,
}: {
  worst: TrainView[];
  onSelectTrain: (id: string) => void;
}) {
  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#8597b3",
          letterSpacing: ".14em",
          marginBottom: 12,
        }}
      >
        位置情報精度 ワースト
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {worst.map((w) => (
          <div key={w.id} onClick={() => onSelectTrain(w.id)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span className="font-mono" style={{ fontSize: 10.5, color: "#aeb9cc" }}>
                {w.no} <span style={{ color: w.lineColor }}>●</span>
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 10.5, color: w.confColor, fontWeight: 600 }}
              >
                ±{w.meters}m
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#1b2740", overflow: "hidden" }}>
              <div style={{ width: `${w.conf}%`, height: "100%", background: w.confColor }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
