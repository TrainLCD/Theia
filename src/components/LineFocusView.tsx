import type { LineView, TrainView, TravelDir } from "../types";
import { Dial } from "./Dial";

function travelBorderRadius(dir: TravelDir, nose: number, tail: number): string {
  if (dir === 1) return `${tail}px ${nose}px ${nose}px ${tail}px`;
  if (dir === -1) return `${nose}px ${tail}px ${tail}px ${nose}px`;
  const m = (nose + tail) / 2;
  return `${m}px`;
}

export interface LineFocusViewProps {
  linesView: LineView[];
  activeLine: LineView | null;
  onSelectLine: (id: number) => void;
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
      {activeLine ? (
        <>
          <LineMap activeLine={activeLine} onSelectTrain={onSelectTrain} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "#8597b3", letterSpacing: ".14em" }}>
            動作中デバイス — 速度 / 位置情報精度
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))",
              gap: 13,
            }}
          >
            {activeLine.devices.map((tr) => (
              <TrainCard key={tr.id} tr={tr} onSelect={() => onSelectTrain(tr.id)} />
            ))}
            {activeLine.devices.length === 0 && (
              <div
                style={{
                  padding: 28,
                  border: "1px dashed #25344f",
                  borderRadius: 10,
                  color: "#51617a",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                この路線のデバイスはまだ受信していません
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            padding: 32,
            border: "1px dashed #25344f",
            borderRadius: 10,
            color: "#51617a",
            fontSize: 12,
            textAlign: "center",
            lineHeight: 1.7,
          }}
        >
          THQ からデバイスイベントを待機しています…
        </div>
      )}
    </div>
  );
}

function LineTabs({
  linesView,
  activeLine,
  onSelectLine,
}: {
  linesView: LineView[];
  activeLine: LineView | null;
  onSelectLine: (id: number) => void;
}) {
  if (linesView.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {linesView.map((ln) => {
        const active = activeLine ? ln.meta.id === activeLine.meta.id : false;
        return (
          <button
            key={ln.meta.id}
            onClick={() => onSelectLine(ln.meta.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${active ? "#e6edf7" : "#1e2c44"}`,
              background: active ? "#1a2333" : "#0c1322",
              color: "#e6edf7",
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: ln.meta.color }} />
            {ln.meta.name}
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
  const hasStations = activeLine.stations.length > 0;
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
            background: activeLine.meta.color,
            boxShadow: `0 0 12px ${activeLine.meta.color}`,
          }}
        />
        <span style={{ fontSize: 17, fontWeight: 700 }}>{activeLine.meta.name}</span>
        <span className="font-mono" style={{ fontSize: 11, color: "#51617a" }}>
          {activeLine.trainCount} デバイス
          {hasStations ? ` · ${activeLine.stations.length}駅` : ""}
          {activeLine.alertCount > 0 ? ` · ⚠ ${activeLine.alertCount}` : ""}
        </span>
      </div>
      {hasStations ? (
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
              backgroundImage: `repeating-linear-gradient(90deg, ${activeLine.meta.color} 0 11px, transparent 11px 22px)`,
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
              background: activeLine.meta.color,
              opacity: 0.3,
            }}
          />
          {activeLine.stations.map((st) => (
            <StationMarker key={st.id} name={st.name} leftPct={st.leftPct} />
          ))}
          {activeLine.devices.map((tr) => (
            <TrainBadge key={tr.id} tr={tr} onClick={() => onSelectTrain(tr.id)} />
          ))}
        </div>
      ) : (
        <div style={{ color: "#51617a", fontSize: 11, padding: "12px 0 18px" }}>
          駅情報を読込中…
        </div>
      )}
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
        transition: "left .9s linear",
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
            transform: "translate(-50%,-50%)",
            animation: "ringPulse 1.6s ease-out infinite",
          }}
        />
      )}
      <div
        title={tr.no}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          padding: "3px 8px",
          width: 86,
          borderRadius: travelBorderRadius(tr.travelDir, 14, 3),
          background: "#0e1830",
          border: `1.5px solid ${tr.statusColor}`,
          boxShadow: `0 0 10px ${tr.glowColor}`,
          overflow: "hidden",
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#dbe6f5",
            lineHeight: 1.1,
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {tr.no}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            lineHeight: 1.1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: tr.statusColor,
              flex: "none",
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              color: "#cdd8e8",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {tr.speed}
            <span style={{ fontSize: 8.5, color: "#6b7d9c", marginLeft: 2 }}>km/h</span>
          </span>
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
        <span className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {tr.no}
        </span>
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
        <Dial value={tr.speed} unit="km/h" pct={tr.speedPct} color="#e6edf7" size={78} />
        <Dial
          value={tr.meters != null ? `±${tr.meters}` : "—"}
          unit="精度 m"
          pct={tr.conf}
          color={tr.confColor}
          size={78}
        />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
          <div>
            <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>通信</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: tr.commColor }}>{tr.commLabel}</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>駅</div>
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
              key={`${e.code}:${e.label}`}
              className="font-mono"
              title={`${e.code} ${e.label}`}
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                color: e.color,
                background: e.bg,
                border: `1px solid ${e.color}`,
                padding: "2px 6px",
                borderRadius: 4,
                maxWidth: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
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
