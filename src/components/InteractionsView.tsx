import { useMemo, useState } from "react";
import type { ThqInteractionEvent } from "../useThqSocket";

export interface InteractionsViewProps {
  interactions: ThqInteractionEvent[];
  now: number;
}

// 集計バーは「件数」という単一系列なので全バー同色(検証済みパレットのスロット1)。
const BAR_COLOR = "#3987e5";

const SURFACE = "#0c1322";
const AXIS_INK = "#6b7d9c";
const PRIMARY_INK = "#e6edf7";
const SECONDARY_INK = "#8597b3";

const ANON = "(匿名)";
// 実デバイス名と衝突しない匿名イベント用の内部キー(表示時に ANON へ変換)。
const ANON_KEY = "\u0000anon";
const MAX_RANK_ROWS = 12;
const MAX_FEED_ROWS = 200;

const WINDOW_PRESETS: { label: string; ms: number | null }[] = [
  { label: "30分", ms: 30 * 60_000 },
  { label: "1時間", ms: 60 * 60_000 },
  { label: "3時間", ms: 3 * 60 * 60_000 },
  { label: "6時間", ms: 6 * 60 * 60_000 },
  { label: "全て", ms: null },
];

function fmtHms(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function deviceKey(e: ThqInteractionEvent): string {
  return e.device ?? ANON_KEY;
}

function deviceLabel(key: string): string {
  return key === ANON_KEY ? ANON : key;
}

function fmtProps(props: ThqInteractionEvent["properties"]): string {
  if (!props) return "—";
  const entries = Object.entries(props);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}=${String(v)}`).join("  ");
}

function rankCounts(keys: string[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function InteractionsView({ interactions, now }: InteractionsViewProps) {
  const [windowMs, setWindowMs] = useState<number | null>(null);
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<string | null>(null);

  const inWindow = useMemo(() => {
    const tMin = windowMs != null ? now - windowMs : -Infinity;
    return interactions.filter((e) => e.timestamp >= tMin);
  }, [interactions, windowMs, now]);

  // ランキングは相互フィルタ: イベント別はデバイス絞り込みを、デバイス別は
  // イベント絞り込みを反映し、自身の軸は全候補を出したままにする。
  const eventRanks = rankCounts(
    inWindow
      .filter((e) => deviceFilter == null || deviceKey(e) === deviceFilter)
      .map((e) => e.event_name),
  );
  const deviceRanks = rankCounts(
    inWindow.filter((e) => eventFilter == null || e.event_name === eventFilter).map(deviceKey),
  );

  const filtered = useMemo(
    () =>
      inWindow
        .filter((e) => eventFilter == null || e.event_name === eventFilter)
        .filter((e) => deviceFilter == null || deviceKey(e) === deviceFilter)
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp),
    [inWindow, eventFilter, deviceFilter],
  );

  const kindCount = new Set(filtered.map((e) => e.event_name)).size;
  const devCount = new Set(filtered.map(deviceKey)).size;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: "16px 18px",
        gap: 11,
        overflowY: "auto",
        background: "radial-gradient(1200px 600px at 30% -10%, #0d1729, #080b12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div
          style={{ fontSize: 12, fontWeight: 600, color: SECONDARY_INK, letterSpacing: ".14em" }}
        >
          インタラクション解析
        </div>
        {eventFilter != null && (
          <FilterChip label={`イベント: ${eventFilter}`} onClear={() => setEventFilter(null)} />
        )}
        {deviceFilter != null && (
          <FilterChip
            label={`デバイス: ${deviceLabel(deviceFilter)}`}
            onClear={() => setDeviceFilter(null)}
          />
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4 }}>
          {WINDOW_PRESETS.map((p) => {
            const active = windowMs === p.ms;
            return (
              <button
                key={p.label}
                onClick={() => setWindowMs(p.ms)}
                style={{
                  background: active ? "#1a2333" : "transparent",
                  border: `1px solid ${active ? "#2c3f61" : "#1b2740"}`,
                  color: active ? PRIMARY_INK : AXIS_INK,
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 11 }}>
        <StatTile label="件数" value={filtered.length} />
        <StatTile label="イベント種類" value={kindCount} />
        <StatTile label="デバイス数" value={devCount} />
      </div>

      <div style={{ display: "flex", gap: 11, alignItems: "stretch" }}>
        <RankCard
          title="イベント別件数"
          ranks={eventRanks}
          selected={eventFilter}
          onToggle={(k) => setEventFilter((cur) => (cur === k ? null : k))}
        />
        <RankCard
          title="デバイス別件数"
          ranks={deviceRanks}
          selected={deviceFilter}
          formatKey={deviceLabel}
          onToggle={(k) => setDeviceFilter((cur) => (cur === k ? null : k))}
        />
      </div>

      <div
        style={{
          background: SURFACE,
          border: "1px solid #22324f",
          borderRadius: 11,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            fontSize: 11,
            fontWeight: 600,
            color: SECONDARY_INK,
            letterSpacing: ".12em",
            borderBottom: "1px solid #1e2c44",
            display: "flex",
            alignItems: "center",
          }}
        >
          イベントフィード
          <span style={{ flex: 1 }} />
          <span className="font-mono" style={{ fontSize: 10, color: AXIS_INK, fontWeight: 400 }}>
            {filtered.length > MAX_FEED_ROWS
              ? `${filtered.length} 件中 ${MAX_FEED_ROWS} 件を表示`
              : `${filtered.length} 件`}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "76px minmax(90px,1fr) minmax(120px,1.2fr) minmax(160px,2fr) minmax(140px,1.2fr)",
            fontSize: 10,
            fontWeight: 600,
            color: AXIS_INK,
            letterSpacing: ".1em",
            borderBottom: "1px solid #1e2c44",
          }}
        >
          {["時刻", "デバイス", "イベント", "プロパティ", "端末"].map((h) => (
            <div key={h} style={{ padding: "7px 12px" }}>
              {h}
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: "16px 14px", fontSize: 11.5, color: AXIS_INK }}>
            {interactions.length === 0
              ? "インタラクションイベントの受信待ちです"
              : "条件に一致するイベントがありません"}
          </div>
        )}
        {filtered.slice(0, MAX_FEED_ROWS).map((e) => (
          <div
            key={e.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "76px minmax(90px,1fr) minmax(120px,1.2fr) minmax(160px,2fr) minmax(140px,1.2fr)",
              fontSize: 11.5,
              borderBottom: "1px solid #131d31",
              alignItems: "center",
            }}
          >
            <div className="font-mono" style={{ padding: "7px 12px", color: SECONDARY_INK }}>
              {fmtHms(e.timestamp)}
            </div>
            <div
              className="font-mono"
              style={{
                padding: "7px 12px",
                color: e.device ? PRIMARY_INK : AXIS_INK,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {e.device ?? ANON}
            </div>
            <div
              className="font-mono"
              style={{
                padding: "7px 12px",
                color: "#cdd8e8",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {e.event_name}
            </div>
            <div
              className="font-mono"
              title={e.properties ? JSON.stringify(e.properties) : undefined}
              style={{
                padding: "7px 12px",
                color: SECONDARY_INK,
                fontSize: 10.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {fmtProps(e.properties)}
            </div>
            <div
              className="font-mono"
              style={{
                padding: "7px 12px",
                color: AXIS_INK,
                fontSize: 10.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {[e.platform, e.channel, e.app_version ? `v${e.app_version}` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      title="クリックで解除"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "#13233d",
        border: "1px solid #2c3f61",
        color: PRIMARY_INK,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 10.5,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <span className="font-mono">{label}</span>
      <span style={{ color: AXIS_INK }}>✕</span>
    </button>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        flex: 1,
        background: SURFACE,
        border: "1px solid #22324f",
        borderRadius: 11,
        padding: "10px 14px",
      }}
    >
      <div style={{ fontSize: 9.5, color: AXIS_INK, marginBottom: 3 }}>{label}</div>
      <div className="font-mono" style={{ fontSize: 20, fontWeight: 600, color: PRIMARY_INK }}>
        {value}
      </div>
    </div>
  );
}

function RankCard({
  title,
  ranks,
  selected,
  formatKey,
  onToggle,
}: {
  title: string;
  ranks: { key: string; count: number }[];
  selected: string | null;
  formatKey?: (key: string) => string;
  onToggle: (key: string) => void;
}) {
  const max = ranks[0]?.count ?? 0;
  const shown = ranks.slice(0, MAX_RANK_ROWS);
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: SURFACE,
        border: "1px solid #22324f",
        borderRadius: 11,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: SECONDARY_INK,
          letterSpacing: ".12em",
          marginBottom: 10,
          display: "flex",
        }}
      >
        {title}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: AXIS_INK, fontWeight: 400 }}>クリックで絞り込み</span>
      </div>
      {shown.length === 0 && (
        <div style={{ fontSize: 11, color: AXIS_INK, padding: "6px 0" }}>データなし</div>
      )}
      {shown.map((r) => {
        const active = selected === r.key;
        const dimmed = selected != null && !active;
        return (
          <button
            key={r.key}
            onClick={() => onToggle(r.key)}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(90px, 38%) 1fr 44px",
              alignItems: "center",
              gap: 8,
              width: "100%",
              background: active ? "#13233d" : "transparent",
              border: "none",
              borderRadius: 5,
              padding: "4px 6px",
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: dimmed ? 0.45 : 1,
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: PRIMARY_INK,
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {formatKey?.(r.key) ?? r.key}
            </span>
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  height: 10,
                  width: `${max > 0 ? Math.max(2, (r.count / max) * 100) : 0}%`,
                  background: BAR_COLOR,
                  borderRadius: "0 4px 4px 0",
                }}
              />
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: "#cdd8e8",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.count}
            </span>
          </button>
        );
      })}
      {ranks.length > MAX_RANK_ROWS && (
        <div style={{ fontSize: 10, color: AXIS_INK, padding: "5px 6px 0" }}>
          他 {ranks.length - MAX_RANK_ROWS} 種
        </div>
      )}
    </div>
  );
}
