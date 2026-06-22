import type { LineView, TrainView } from "../types";
import { Dial } from "./Dial";

export interface LineFocusViewProps {
  linesView: LineView[];
  activeLine: LineView;
  onSelectLine: (id: string) => void;
  onSelectTrain: (id: string) => void;
}

export function LineFocusView({
  linesView,
  activeLine,
  onSelectLine,
  onSelectTrain,
}: LineFocusViewProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: "16px 18px",
        gap: 14,
        overflowY: "auto",
        background: "radial-gradient(1200px 600px at 70% -10%, #0d1729, #080b12)",
      }}
    >
      <LineTabs linesView={linesView} activeLine={activeLine} onSelectLine={onSelectLine} />
      <LineMap activeLine={activeLine} onSelectTrain={onSelectTrain} />
      <div style={{ fontSize: 12, fontWeight: 600, color: "#8597b3", letterSpacing: ".14em" }}>
        稼働中デバイス — 速度 / 位置情報精度
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))",
          gap: 13,
        }}
      >
        {activeLine.trains.map((tr) => (
          <TrainCard key={tr.id} tr={tr} onSelect={() => onSelectTrain(tr.id)} />
        ))}
      </div>
    </div>
  );
}

function LineTabs({
  linesView,
  activeLine,
  onSelectLine,
}: {
  linesView: LineView[];
  activeLine: LineView;
  onSelectLine: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {linesView.map((ln) => {
        const active = ln.def.id === activeLine.def.id;
        return (
          <button
            key={ln.def.id}
            onClick={() => onSelectLine(ln.def.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${active ? "#3b82f6" : "#1e2c44"}`,
              background: active ? "#10203b" : "#0c1322",
              color: "#e6edf7",
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: ln.def.color }} />
            {ln.def.name}
            <span className="font-mono" style={{ fontSize: 10.5, color: "#6b7d9c" }}>
              {ln.trainCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LineMap({
  activeLine,
  onSelectTrain,
}: {
  activeLine: LineView;
  onSelectTrain: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: "#0b1220",
        border: "1px solid #1a2740",
        borderRadius: 12,
        padding: "22px 30px 14px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 34 }}>
        <span
          style={{
            width: 13,
            height: 13,
            borderRadius: 4,
            background: activeLine.def.color,
            boxShadow: `0 0 12px ${activeLine.def.color}`,
          }}
        />
        <span style={{ fontSize: 17, fontWeight: 700 }}>{activeLine.def.name}</span>
        <span className="font-mono" style={{ fontSize: 11, color: "#51617a" }}>
          最高速度 {activeLine.def.maxSpeed} km/h · {activeLine.def.stations.length}駅
        </span>
      </div>
      <div style={{ position: "relative", height: 46, margin: "0 14px 40px" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 6,
            transform: "translateY(-50%)",
            borderRadius: 3,
            backgroundImage: `repeating-linear-gradient(90deg, ${activeLine.def.color} 0 11px, transparent 11px 22px)`,
            backgroundSize: "22px 100%",
            opacity: 0.34,
            animation: "dashmove 1.1s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 2,
            transform: "translateY(-50%)",
            background: activeLine.def.color,
            opacity: 0.3,
          }}
        />
        {activeLine.stations.map((st) => (
          <StationMarker key={st.name} name={st.name} leftPct={st.leftPct} />
        ))}
        {activeLine.trains.map((tr) => (
          <TrainBadge key={tr.id} tr={tr} onClick={() => onSelectTrain(tr.id)} />
        ))}
      </div>
    </div>
  );
}

function StationMarker({ name, leftPct }: { name: string; leftPct: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateX(-50%)",
        left: `${leftPct}%`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 11,
          height: 11,
          borderRadius: "50%",
          background: "#0b1220",
          border: "2.5px solid #46597b",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 18,
          left: "50%",
          transform: "translateX(-50%) rotate(-32deg)",
          transformOrigin: "top left",
          whiteSpace: "nowrap",
          fontSize: 10.5,
          color: "#8597b3",
          fontWeight: 500,
        }}
      >
        {name}
      </div>
    </div>
  );
}

function TrainBadge({ tr, onClick }: { tr: TrainView; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        top: "50%",
        left: `${tr.leftPct}%`,
        transform: "translate(-50%,-50%)",
        transition: "left .98s linear",
        cursor: "pointer",
        zIndex: 3,
      }}
    >
      {tr.isAlert && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: `2px solid ${tr.statusColor}`,
            animation: "ringPulse 1.6s ease-out infinite",
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px",
          borderRadius: 9,
          background: "#0e1830",
          border: `1.5px solid ${tr.statusColor}`,
          boxShadow: `0 0 10px ${tr.glowColor}`,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: tr.statusColor }} />
        <span className="font-mono" style={{ fontSize: 11, fontWeight: 600 }}>
          {tr.dirGlyph} {tr.no}
        </span>
      </div>
    </div>
  );
}

function TrainCard({ tr, onSelect }: { tr: TrainView; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: "#0c1322",
        border: `1px solid ${tr.status === "normal" ? "#1a2740" : tr.statusColor}`,
        borderRadius: 11,
        padding: 15,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#0a101d",
            background: tr.typeColor,
            padding: "2px 7px",
            borderRadius: 4,
          }}
        >
          {tr.type}
        </span>
        <span className="font-mono" style={{ fontSize: 15, fontWeight: 600 }}>
          {tr.no}
        </span>
        <span style={{ fontSize: 10.5, color: "#51617a" }}>{tr.cars}両</span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: tr.statusColor,
            boxShadow: `0 0 7px ${tr.statusColor}`,
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Dial value={tr.speed} unit="km/h" pct={tr.speedPct} color="#3b82f6" size={78} />
        <Dial value={`±${tr.meters}`} unit="精度 m" pct={tr.conf} color={tr.confColor} size={78} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
          <div>
            <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>通信</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: tr.commColor }}>{tr.commLabel}</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>次駅 {tr.dirGlyph}</div>
            <div style={{ fontSize: 11.5, color: "#cdd8e8" }}>{tr.nextStation}</div>
          </div>
        </div>
      </div>
      {tr.hasErrors && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginTop: 13,
            paddingTop: 12,
            borderTop: "1px solid #16213a",
          }}
        >
          {tr.errors.map((e) => (
            <span
              key={e.code}
              className="font-mono"
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                color: e.color,
                background: e.bg,
                border: `1px solid ${e.color}`,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {e.code} {e.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
