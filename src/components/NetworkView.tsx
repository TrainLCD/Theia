import { useMemo, useState } from "react";
import type {
  FormattedAlert,
  LineMeta,
  LineStationView,
  LineView,
  TrainView,
  TravelDir,
} from "../types";
import { summarizeTrains, triagePriority, type TriageJudgement } from "../useAlertTriage";
import { useViewSetting } from "../useViewSetting";
import { BatteryBadge } from "./BatteryBadge";
import { Dial } from "./Dial";
import { StationInfoCard } from "./StationInfoCard";
import { TriageBadges, TriageSummaryBadge } from "./TriageBadge";

function travelBorderRadius(dir: TravelDir, nose: number, tail: number): string {
  if (dir === 1) return `${tail}px ${nose}px ${nose}px ${tail}px`;
  if (dir === -1) return `${nose}px ${tail}px ${tail}px ${nose}px`;
  const m = (nose + tail) / 2;
  return `${m}px`;
}

export interface NetworkViewProps {
  linesView: LineView[];
  sel: TrainView | null;
  alerts: FormattedAlert[];
  /** ログ本文ごとのトリアージ判定。後追いで届くので、無いアラートは時刻順のまま出す。 */
  triage: Map<string, TriageJudgement>;
  onSelectTrain: (id: string) => void;
}

export function NetworkView({ linesView, sel, alerts, triage, onSelectTrain }: NetworkViewProps) {
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
            端末一覧
          </div>
          <div className="font-mono" style={{ fontSize: 10.5, color: "#51617a" }}>
            クリックで端末を選択
          </div>
        </div>
        {linesView.length === 0 && <EmptyState />}
        {linesView.map((ln) => (
          <LineStrip
            key={ln.meta.id}
            ln={ln}
            sel={sel}
            triage={triage}
            onSelectTrain={onSelectTrain}
          />
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
            選択端末
          </div>
          {sel ? <SelectedDevicePanel sel={sel} /> : <SelectedDevicePlaceholder />}
        </div>
        <AlertFeed alerts={alerts} triage={triage} />
      </aside>
    </div>
  );
}

function EmptyState() {
  return (
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
      端末イベント受信待ち
    </div>
  );
}

function LineStrip({
  ln,
  sel,
  triage,
  onSelectTrain,
}: {
  ln: LineView;
  sel: TrainView | null;
  triage: Map<string, TriageJudgement>;
  onSelectTrain: (id: string) => void;
}) {
  const [hoverStationId, setHoverStationId] = useState<number | null>(null);
  const hoveredStation = ln.stations.find((s) => s.id === hoverStationId) ?? null;
  // 路線に乗っている端末のログをまとめる。件数は alertCount がコード側で数えているので、
  // ここは「その路線で一番重いのは何か」だけを足す。
  const summary = useMemo(() => summarizeTrains(ln.devices, triage), [ln.devices, triage]);
  return (
    <div
      style={{
        background: "#0b1220",
        border: "1px solid #1a2740",
        borderRadius: 10,
        padding: "13px 16px 14px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: 3,
            background: ln.meta.color,
            boxShadow: `0 0 10px ${ln.meta.color}`,
          }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{ln.meta.name}</span>
        <div style={{ flex: 1 }} />
        <span className="font-mono" style={{ fontSize: 11, color: "#6b7d9c" }}>
          {ln.trainCount} 台
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
        <TriageSummaryBadge summary={summary} />
      </div>
      {ln.stations.length > 0 ? (
        <div style={{ position: "relative", height: 46, margin: "0 6px 28px" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 4,
              transform: "translateY(-50%)",
              borderRadius: 2,
              backgroundImage: `repeating-linear-gradient(90deg, ${ln.meta.color} 0 11px, transparent 11px 22px)`,
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
              background: ln.meta.color,
              opacity: 0.25,
            }}
          />
          {ln.stations.map((st) => {
            const hovered = hoverStationId === st.id;
            return (
              <div
                key={st.id}
                onMouseEnter={() => setHoverStationId(st.id)}
                onMouseLeave={() => setHoverStationId((cur) => (cur === st.id ? null : cur))}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${st.leftPct}%`,
                  transform: "translate(-50%,-50%)",
                  padding: 4,
                  cursor: "help",
                  zIndex: hovered ? 4 : 1,
                }}
              >
                <div
                  style={{
                    width: hovered ? 11 : 8,
                    height: hovered ? 11 : 8,
                    borderRadius: "50%",
                    background: "#0b1220",
                    border: `2px solid ${hovered ? "#cdd8e8" : "#3a4d6e"}`,
                    transition: "width .12s, height .12s, border-color .12s",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%) rotate(-32deg)",
                    transformOrigin: "top left",
                    whiteSpace: "nowrap",
                    fontSize: 9.5,
                    color: "#8597b3",
                    fontWeight: 500,
                    marginTop: 4,
                    pointerEvents: "none",
                  }}
                >
                  {st.name}
                </div>
              </div>
            );
          })}
          {ln.devices.map((tr) => (
            <PositionedDeviceChip
              key={tr.id}
              tr={tr}
              selected={sel?.id === tr.id}
              onClick={() => onSelectTrain(tr.id)}
            />
          ))}
          {hoveredStation && <StationTooltip st={hoveredStation} line={ln.meta} />}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            paddingTop: 4,
          }}
        >
          {ln.devices.map((tr) => (
            <DeviceChip
              key={tr.id}
              tr={tr}
              selected={sel?.id === tr.id}
              onClick={() => onSelectTrain(tr.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StationTooltip({ st, line }: { st: LineStationView; line: LineMeta }) {
  const flipX = st.leftPct > 70;
  const offsetX = flipX ? -8 : 8;
  return (
    <div
      style={{
        position: "absolute",
        left: `${st.leftPct}%`,
        bottom: "calc(50% + 10px)",
        transform: `translate(${flipX ? "-100%" : "0"}, 0) translateX(${offsetX}px)`,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <StationInfoCard name={st.name} nameRoman={st.nameRoman} id={st.id} line={line} />
    </div>
  );
}

function PositionedDeviceChip({
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
      title={`${tr.no} · ${tr.statusLabel} · ${tr.dirText}`}
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
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: `2px solid ${tr.statusColor}`,
            transform: "translate(-50%,-50%)",
            animation: "ringPulse 1.6s ease-out infinite",
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          padding: "3px 6px",
          width: 70,
          borderRadius: travelBorderRadius(tr.travelDir, 12, 3),
          background: "#0e1830",
          border: `1.5px solid ${selected ? "#e6edf7" : tr.statusColor}`,
          boxShadow: `0 0 8px ${tr.glowColor}`,
          transform: `scale(${selected ? 1.15 : 1})`,
          overflow: "hidden",
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 9.5,
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
            gap: 4,
            lineHeight: 1.1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: tr.statusColor,
              flex: "none",
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#dbe6f5",
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

function DeviceChip({
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
      title={`${tr.no} · ${tr.statusLabel} · ${tr.dirText}`}
      style={{
        position: "relative",
        cursor: "pointer",
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
            transform: "translate(-50%,-50%)",
            animation: "ringPulse 1.6s ease-out infinite",
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          padding: "3px 8px",
          width: 78,
          borderRadius: travelBorderRadius(tr.travelDir, 14, 3),
          background: "#0e1830",
          border: `1.5px solid ${selected ? "#e6edf7" : tr.statusColor}`,
          boxShadow: `0 0 8px ${tr.glowColor}`,
          overflow: "hidden",
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 10,
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
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: tr.statusColor,
              flex: "none",
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              color: tr.typeColor,
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
            whiteSpace: "nowrap",
          }}
        >
          {sel.type}
        </span>
        <span className="font-mono" style={{ fontSize: 15, fontWeight: 600 }}>
          {sel.no}
        </span>
        <BatteryBadge tr={sel} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: sel.lineColor, fontWeight: 600 }}>
          ● {sel.lineName}
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <Dial value={sel.speed} unit="km/h" pct={sel.speedPct} color="#e6edf7" />
        <Dial
          value={sel.meters != null ? `±${sel.meters}` : "—"}
          unit="精度 m"
          pct={sel.conf}
          color={sel.confColor}
        />
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
            <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>通信</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: sel.commColor }}>
              {sel.commLabel}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>最終受信</div>
            <div style={{ fontSize: 12, color: "#cdd8e8" }}>{sel.staleSec}秒前</div>
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
        <Cell label="状態">
          {sel.dirGlyph} {sel.dirText}
        </Cell>
        <Cell label="駅 / 区間">{sel.nextStation}</Cell>
      </div>
      {sel.hasErrors ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sel.errors.map((e) => (
            <div
              key={`${e.code}:${e.label}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "7px 9px",
                background: e.bg,
                border: `1px solid ${e.color}`,
                borderRadius: 6,
                minWidth: 0,
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: e.color,
                  flex: "none",
                  whiteSpace: "nowrap",
                  lineHeight: 1.35,
                }}
              >
                {e.code}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "#cdd8e8",
                  flex: 1,
                  minWidth: 0,
                  lineHeight: 1.35,
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {e.label}
              </span>
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
          <span style={{ fontSize: 11.5, color: "#86efac" }}>異常なし</span>
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
      端末を選択すると
      <br />
      詳細データを表示
    </div>
  );
}

type AlertSort = "time" | "priority";

function AlertFeed({
  alerts,
  triage,
}: {
  alerts: FormattedAlert[];
  triage: Map<string, TriageJudgement>;
}) {
  const [sort, setSort] = useViewSetting<AlertSort>("network.alertSort", "time");
  // 判定は後追いで届くので、重要度順でも未判定のものは最後に落として時刻順を保つ。
  const ordered = useMemo(() => {
    if (sort === "time") return alerts;
    return alerts
      .map((a, i) => ({ a, i, p: triage.get(a.key) }))
      .sort((x, y) => {
        const px = x.p ? triagePriority(x.p) : -1;
        const py = y.p ? triagePriority(y.p) : -1;
        return py - px || x.i - y.i;
      })
      .map((e) => e.a);
  }, [alerts, triage, sort]);

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
        <div style={{ flex: 1 }} />
        <SortToggle sort={sort} onChange={setSort} />
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
        {ordered.map((a, i) => (
          <AlertItem key={i} a={a} judgement={triage.get(a.key)} />
        ))}
        {ordered.length === 0 && (
          <div style={{ color: "#51617a", fontSize: 11, padding: "16px 4px" }}>アラートなし</div>
        )}
      </div>
    </div>
  );
}

const SORTS: { key: AlertSort; label: string }[] = [
  { key: "time", label: "新着順" },
  { key: "priority", label: "重要度順" },
];

function SortToggle({ sort, onChange }: { sort: AlertSort; onChange: (next: AlertSort) => void }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {SORTS.map((s) => {
        const active = s.key === sort;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: active ? "#dbe6f5" : "#51617a",
              background: active ? "#17233a" : "transparent",
              border: `1px solid ${active ? "#2b3d5e" : "#1a2740"}`,
              padding: "2px 7px",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function AlertItem({ a, judgement }: { a: FormattedAlert; judgement?: TriageJudgement }) {
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
        <div
          style={{
            fontSize: 11.5,
            color: "#aeb9cc",
            marginTop: 3,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            lineHeight: 1.35,
          }}
        >
          {a.label}
        </div>
        <div style={{ fontSize: 10, color: "#6b7d9c", marginTop: 2 }}>
          <span style={{ color: a.lineColor }}>●</span> {a.line} · {a.device}
        </div>
        {judgement && (
          <div style={{ marginTop: 5 }}>
            <TriageBadges judgement={judgement} />
          </div>
        )}
      </div>
    </div>
  );
}
