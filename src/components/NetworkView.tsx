import type { FormattedAlert, LineView, TrainView } from "../types";
import { Dial } from "./Dial";

export interface NetworkViewProps {
  linesView: LineView[];
  sel: TrainView | null;
  alerts: FormattedAlert[];
  onSelectTrain: (id: string) => void;
}

export function NetworkView({ linesView, sel, alerts, onSelectTrain }: NetworkViewProps) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          padding: "16px 18px",
          gap: 11,
          overflowY: "auto",
          background: "radial-gradient(1200px 600px at 30% -10%, #0d1729, #080b12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#8597b3", letterSpacing: ".14em" }}>
            デバイス
          </div>
          <div className="font-mono" style={{ fontSize: 10.5, color: "#51617a" }}>
            ▶◀ 矢印 = 進行方向　·　クリックでデバイスを選択
          </div>
        </div>
        {linesView.map((ln) => (
          <LineStrip key={ln.def.id} ln={ln} sel={sel} onSelectTrain={onSelectTrain} />
        ))}
      </div>

      <aside
        style={{
          width: 372,
          flex: "none",
          borderLeft: "1px solid #1e2c44",
          background: "#0a101d",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: "none", borderBottom: "1px solid #1e2c44", padding: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#8597b3",
              letterSpacing: ".14em",
              marginBottom: 12,
            }}
          >
            選択デバイス
          </div>
          {sel ? <SelectedDevicePanel sel={sel} /> : <SelectedDevicePlaceholder />}
        </div>
        <AlertFeed alerts={alerts} />
      </aside>
    </div>
  );
}

function LineStrip({
  ln,
  sel,
  onSelectTrain,
}: {
  ln: LineView;
  sel: TrainView | null;
  onSelectTrain: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: "#0b1220",
        border: "1px solid #1a2740",
        borderRadius: 10,
        padding: "13px 16px 26px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: 3,
            background: ln.def.color,
            boxShadow: `0 0 10px ${ln.def.color}`,
          }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{ln.def.name}</span>
        <span className="font-mono" style={{ fontSize: 10.5, color: "#51617a" }}>
          最高 {ln.def.maxSpeed}km/h
        </span>
        <div style={{ flex: 1 }} />
        <span className="font-mono" style={{ fontSize: 11, color: "#6b7d9c" }}>
          {ln.trainCount}デバイス
        </span>
        {ln.hasAlert && (
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "#f59e0b",
              background: "#231803",
              border: "1px solid #4a3508",
              padding: "2px 7px",
              borderRadius: 5,
            }}
          >
            ⚠ {ln.alertCount}
          </span>
        )}
      </div>
      <div style={{ position: "relative", height: 30, margin: "0 6px" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 4,
            transform: "translateY(-50%)",
            borderRadius: 2,
            backgroundImage: `repeating-linear-gradient(90deg, ${ln.def.color} 0 11px, transparent 11px 22px)`,
            backgroundSize: "22px 100%",
            opacity: 0.3,
            animation: "dashmove 1.1s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 1,
            transform: "translateY(-50%)",
            background: ln.def.color,
            opacity: 0.25,
          }}
        />
        {ln.stations.map((st) => (
          <div
            key={st.name}
            style={{
              position: "absolute",
              top: "50%",
              transform: "translate(-50%,-50%)",
              left: `${st.leftPct}%`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#0b1220",
                border: "2px solid #3a4d6e",
              }}
            />
          </div>
        ))}
        {ln.trains.map((tr) => (
          <TrainDot
            key={tr.id}
            tr={tr}
            selected={sel?.id === tr.id}
            onClick={() => onSelectTrain(tr.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TrainDot({
  tr,
  selected,
  onClick,
}: {
  tr: TrainView;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      title={tr.no}
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
            width: 18,
            height: 18,
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
          padding: "2px 7px 2px 5px",
          borderRadius: 8,
          background: "#0e1830",
          border: `1.5px solid ${tr.statusColor}`,
          boxShadow: `0 0 8px ${tr.glowColor}`,
          transform: `scale(${selected ? 1.25 : 1})`,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: tr.statusColor }} />
        <span className="font-mono" style={{ fontSize: 10, fontWeight: 600, color: "#dbe6f5" }}>
          {tr.dirGlyph}
          {tr.speed}
        </span>
      </div>
    </div>
  );
}

function SelectedDevicePanel({ sel }: { sel: TrainView }) {
  return (
    <div
      style={{ background: "#0c1322", border: "1px solid #22324f", borderRadius: 11, padding: 15 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#0a101d",
            background: sel.typeColor,
            padding: "2px 7px",
            borderRadius: 4,
          }}
        >
          {sel.type}
        </span>
        <span className="font-mono" style={{ fontSize: 17, fontWeight: 600 }}>
          {sel.no}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: sel.lineColor, fontWeight: 600 }}>
          ● {sel.lineName}
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <Dial value={sel.speed} unit="km/h" pct={sel.speedPct} color="#3b82f6" />
        <Dial value={`±${sel.meters}`} unit="精度 m" pct={sel.conf} color={sel.confColor} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>通信状態</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: sel.commColor }}>
              {sel.commLabel}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "9px 11px",
          background: "#0a1120",
          border: "1px solid #18233a",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Cell label="進行方向">
          {sel.dirGlyph} {sel.dirText}
        </Cell>
        <Cell label="次駅">{sel.nextStation}</Cell>
        <Cell label="編成">{sel.cars}両</Cell>
      </div>
      {sel.hasErrors ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sel.errors.map((e) => (
            <div
              key={e.code}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 9px",
                background: e.bg,
                border: `1px solid ${e.color}`,
                borderRadius: 6,
              }}
            >
              <span
                className="font-mono"
                style={{ fontSize: 10.5, fontWeight: 700, color: e.color }}
              >
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
            padding: "7px 9px",
            background: "#0c1a13",
            border: "1px solid #1e3a2a",
            borderRadius: 6,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ fontSize: 11.5, color: "#86efac" }}>異常なし — 正常稼働中</span>
        </div>
      )}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>{label}</div>
      <div style={{ fontSize: 12, color: "#cdd8e8" }}>{children}</div>
    </div>
  );
}

function SelectedDevicePlaceholder() {
  return (
    <div
      style={{
        height: 170,
        border: "1px dashed #25344f",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#51617a",
        fontSize: 12,
        textAlign: "center",
        lineHeight: 1.7,
      }}
    >
      路線図上のデバイスをクリックすると
      <br />
      詳細データを表示します
    </div>
  );
}

function AlertFeed({ alerts }: { alerts: FormattedAlert[] }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: "16px 16px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#8597b3", letterSpacing: ".14em" }}>
          アラートフィード
        </span>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#ef4444",
            animation: "glowPulse 1.3s infinite",
          }}
        />
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 7,
          paddingBottom: 16,
        }}
      >
        {alerts.map((a, i) => (
          <AlertItem key={i} a={a} />
        ))}
        {alerts.length === 0 && (
          <div style={{ color: "#51617a", fontSize: 11, padding: "16px 4px" }}>
            アラートはありません
          </div>
        )}
      </div>
    </div>
  );
}

function AlertItem({ a }: { a: FormattedAlert }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "9px 11px",
        background: "#0d1626",
        border: "1px solid #1a2740",
        borderLeft: `3px solid ${a.color}`,
        borderRadius: 7,
        animation: "fadeIn .3s ease",
      }}
    >
      <div className="font-mono" style={{ fontSize: 10, color: "#51617a", paddingTop: 1 }}>
        {a.time}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: a.color,
              background: a.tagBg,
              padding: "1px 5px",
              borderRadius: 3,
            }}
          >
            {a.tag}
          </span>
          <span className="font-mono" style={{ fontSize: 11, color: "#dbe6f5", fontWeight: 600 }}>
            {a.code}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "#aeb9cc", marginTop: 3 }}>{a.label}</div>
        <div style={{ fontSize: 10, color: "#6b7d9c", marginTop: 2 }}>
          <span style={{ color: a.lineColor }}>●</span> {a.line} · デバイス {a.no}
        </div>
      </div>
    </div>
  );
}
