import { useMemo, type ReactNode } from "react";
import type { ExternalLineMeta } from "../types";
import type {
  FreezeQuery,
  FreezeRow,
  FreezeSessionRow,
  FreezeState,
  FreezeSummaryRow,
} from "../useThqFreezes";
import { useViewSetting } from "../useViewSetting";

export interface FreezeViewProps {
  freeze: FreezeState;
  query: FreezeQuery;
  onChangeQuery: (next: FreezeQuery) => void;
  /** ライブで観測済みの路線メタ。路線フィルタの選択肢に使う。 */
  lineMetadata: Map<number, ExternalLineMeta>;
}

const SURFACE = "#0c1322";
const AXIS_INK = "#6b7d9c";
const PRIMARY_INK = "#e6edf7";
const SECONDARY_INK = "#8597b3";
const FREEZE_INK = "#ef4444";
const CLEAN_INK = "#22c55e";
const FALLBACK_LINE_COLOR = "#6b7d9c";

const MAX_ROWS = 200;

const WINDOW_PRESETS: { label: string; ms: number }[] = [
  { label: "24時間", ms: 24 * 60 * 60_000 },
  { label: "3日", ms: 3 * 24 * 60 * 60_000 },
  { label: "7日", ms: 7 * 24 * 60 * 60_000 },
  { label: "30日", ms: 30 * 24 * 60 * 60_000 },
  { label: "90日", ms: 90 * 24 * 60 * 60_000 },
];

const GAP_PRESETS: { label: string; ms: number }[] = [
  { label: "10秒", ms: 10_000 },
  { label: "30秒", ms: 30_000 },
  { label: "60秒", ms: 60_000 },
  { label: "3分", ms: 180_000 },
  { label: "5分", ms: 300_000 },
];

const SPEED_PRESETS: { label: string; kmh: number }[] = [
  { label: "5km/h", kmh: 5 },
  { label: "15km/h", kmh: 15 },
  { label: "30km/h", kmh: 30 },
  { label: "60km/h", kmh: 60 },
];

type Pane = "summary" | "sessions" | "freezes";

const PANES: { key: Pane; label: string }[] = [
  { key: "summary", label: "集計 (路線・区間・ビルド別)" },
  { key: "sessions", label: "セッション" },
  { key: "freezes", label: "個別の欠落" },
];

export const DEFAULT_FREEZE_QUERY: FreezeQuery = {
  windowMs: 7 * 24 * 60 * 60_000,
  lineId: null,
  device: null,
  appVersion: null,
  // THQ の既定値。1 回/秒の送信間隔の 60 倍。
  gapThresholdMs: 60_000,
  // 駅停車・徐行を除外するための既定値。
  speedThresholdKmh: 30,
  requireAppAlive: true,
};

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}秒`;
  // 先に丸めてから分と秒に割る。分・秒を別々に丸めると 119_999ms が「1分60秒」になる。
  const rounded = Math.round(sec);
  const min = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${min}分${String(rest).padStart(2, "0")}秒`;
}

function fmtStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmtMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`;
}

function fmtBuild(row: {
  appVersion: string | null;
  platform: string | null;
  channel: string | null;
}): string {
  return [row.appVersion, row.platform, row.channel].filter(Boolean).join(" · ") || "—";
}

export function FreezeView({ freeze, query, onChangeQuery, lineMetadata }: FreezeViewProps) {
  const [pane, setPane] = useViewSetting<Pane>("freeze.pane", "summary");

  const lineName = useMemo(() => {
    const names = new Map<number, { name: string; color: string }>();
    for (const meta of lineMetadata.values()) {
      names.set(meta.id, { name: meta.name, color: meta.color });
    }
    // 凍結レスポンス側の路線名を優先する (ライブに出てこない過去の路線も引けるため)。
    for (const line of freeze.lines) names.set(line.id, { name: line.name, color: line.color });
    return names;
  }, [lineMetadata, freeze.lines]);

  const renderLine = (id: number | null) => {
    if (id == null) return { label: "路線不明", color: FALLBACK_LINE_COLOR };
    const hit = lineName.get(id);
    return { label: hit?.name ?? `Line ${id}`, color: hit?.color ?? FALLBACK_LINE_COLOR };
  };

  const lineOptions = useMemo(
    () =>
      Array.from(lineName.entries())
        .map(([id, v]) => ({ id, name: v.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [lineName],
  );

  const patch = (next: Partial<FreezeQuery>) => onChangeQuery({ ...query, ...next });

  const totalFreezes = freeze.summary.reduce((acc, r) => acc + r.freezeCount, 0);
  const totalSessions = freeze.sessions.length;
  const freezeSessions = freeze.sessions.filter((s) => s.freezeCount > 0).length;
  const worstGap = freeze.sessions.reduce<number | null>(
    (acc, s) => (s.maxGapMs != null && (acc == null || s.maxGapMs > acc) ? s.maxGapMs : acc),
    null,
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: "16px 18px",
        gap: 11,
        overflow: "hidden",
        background: "radial-gradient(1200px 600px at 30% -10%, #0d1729, #080b12)",
      }}
    >
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{ fontSize: 12, fontWeight: 600, color: SECONDARY_INK, letterSpacing: ".14em" }}
        >
          現在地凍結
        </div>
        <span style={{ fontSize: 10.5, color: AXIS_INK }}>
          位置ログの欠落・欠落直前の速度・欠落中のアプリ生存の 3 条件で検出
        </span>
        <div style={{ flex: 1 }} />
        {freeze.fetchedAt > 0 && (
          <span className="font-mono" style={{ fontSize: 10, color: AXIS_INK }}>
            {fmtStamp(new Date(freeze.fetchedAt).toISOString())} 取得
          </span>
        )}
        <button
          onClick={freeze.reload}
          disabled={freeze.loading}
          style={{
            background: "#13233d",
            border: "1px solid #2c3f61",
            color: freeze.loading ? AXIS_INK : PRIMARY_INK,
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: freeze.loading ? "default" : "pointer",
          }}
        >
          {freeze.loading ? "取得中…" : "再取得"}
        </button>
      </div>

      <div
        style={{
          flex: "none",
          background: SURFACE,
          border: "1px solid #22324f",
          borderRadius: 11,
          padding: "11px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        <FilterRow label="期間">
          <PresetGroup
            options={WINDOW_PRESETS.map((p) => ({ label: p.label, value: p.ms }))}
            value={query.windowMs}
            onSelect={(windowMs) => patch({ windowMs })}
          />
        </FilterRow>
        <FilterRow label="欠落しきい値">
          <PresetGroup
            options={GAP_PRESETS.map((p) => ({ label: p.label, value: p.ms }))}
            value={query.gapThresholdMs}
            onSelect={(gapThresholdMs) => patch({ gapThresholdMs })}
          />
        </FilterRow>
        <FilterRow label="速度しきい値">
          <PresetGroup
            options={SPEED_PRESETS.map((p) => ({ label: p.label, value: p.kmh }))}
            value={query.speedThresholdKmh}
            onSelect={(speedThresholdKmh) => patch({ speedThresholdKmh })}
          />
        </FilterRow>
        <FilterRow label="路線">
          <select
            value={query.lineId ?? ""}
            onChange={(e) =>
              patch({ lineId: e.target.value === "" ? null : Number(e.target.value) })
            }
            style={{
              background: "#111a2b",
              border: "1px solid #22324f",
              color: PRIMARY_INK,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              fontFamily: "inherit",
              minWidth: 180,
            }}
          >
            <option value="">全路線</option>
            {lineOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <Toggle
            label="アプリ生存を必須にする"
            checked={query.requireAppAlive}
            onChange={(requireAppAlive) => patch({ requireAppAlive })}
          />
          <span style={{ fontSize: 10, color: AXIS_INK }}>
            外すとクラッシュ由来の欠落も含まれます
          </span>
        </FilterRow>
      </div>

      {freeze.error && (
        <div
          style={{
            flex: "none",
            background: "#2a1116",
            border: "1px solid #5c2029",
            borderRadius: 9,
            padding: "8px 12px",
            fontSize: 11.5,
            color: "#f2b8b8",
          }}
        >
          取得に失敗しました: {freeze.error}
        </div>
      )}

      <div style={{ flex: "none", display: "flex", gap: 11 }}>
        <StatTile
          label="凍結件数"
          value={String(totalFreezes)}
          tone={totalFreezes > 0 ? "alert" : "clean"}
        />
        <StatTile
          label="凍結セッション"
          value={totalSessions === 0 ? "—" : `${freezeSessions} / ${totalSessions}`}
          tone={totalSessions === 0 ? "neutral" : freezeSessions > 0 ? "alert" : "clean"}
        />
        <StatTile
          label="最長の欠落"
          value={fmtDuration(worstGap)}
          tone={worstGap == null ? "neutral" : "alert"}
        />
        <StatTile label="集計グループ" value={String(freeze.summary.length)} />
      </div>

      <div style={{ flex: "none", display: "flex", gap: 4 }}>
        {PANES.map((p) => (
          <button
            key={p.key}
            onClick={() => setPane(p.key)}
            style={{
              background: pane === p.key ? "#1a2333" : "transparent",
              border: `1px solid ${pane === p.key ? "#2c3f61" : "#1b2740"}`,
              color: pane === p.key ? PRIMARY_INK : AXIS_INK,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pane === "summary" && (
        <SummaryTable rows={freeze.summary} loading={freeze.loading} renderLine={renderLine} />
      )}
      {pane === "sessions" && (
        <SessionTable rows={freeze.sessions} loading={freeze.loading} renderLine={renderLine} />
      )}
      {pane === "freezes" && (
        <FreezeTable rows={freeze.freezes} loading={freeze.loading} renderLine={renderLine} />
      )}
    </div>
  );
}

type LineRenderer = (id: number | null) => { label: string; color: string };

function Card({
  title,
  count,
  loading,
  empty,
  columns,
  headers,
  children,
}: {
  title: string;
  count: number;
  loading: boolean;
  empty: string;
  columns: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div
      style={{
        // 残りの高さいっぱいまで伸ばし、行の縦スクロールはこのカードの中だけで
        // 起こす。こうするとフィルタと集計タイルが常に見えたままになる。
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: SURFACE,
        border: "1px solid #22324f",
        borderRadius: 11,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: "none",
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
        {title}
        <span style={{ flex: 1 }} />
        <span className="font-mono" style={{ fontSize: 10, color: AXIS_INK, fontWeight: 400 }}>
          {count > MAX_ROWS ? `${count} 件中 ${MAX_ROWS} 件を表示` : `${count} 件`}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <div style={{ minWidth: 860 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: columns,
              fontSize: 10,
              fontWeight: 600,
              color: AXIS_INK,
              letterSpacing: ".1em",
              borderBottom: "1px solid #1e2c44",
              // 行数が多いので列見出しは縦スクロール中も残す。横スクロールには
              // 追従させたいので sticky は top のみ。
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: SURFACE,
            }}
          >
            {headers.map((h) => (
              <div key={h} style={{ padding: "7px 12px" }}>
                {h}
              </div>
            ))}
          </div>
          {count === 0 && (
            <div style={{ padding: "16px 14px", fontSize: 11.5, color: AXIS_INK }}>
              {loading ? "取得中…" : empty}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

const SUMMARY_COLUMNS =
  "minmax(120px,1.3fr) minmax(150px,1.6fr) minmax(110px,1fr) minmax(170px,1.6fr) 92px 108px 72px 96px";

function SummaryTable({
  rows,
  loading,
  renderLine,
}: {
  rows: FreezeSummaryRow[];
  loading: boolean;
  renderLine: LineRenderer;
}) {
  return (
    <Card
      title="路線・区間・端末・ビルド別"
      count={rows.length}
      loading={loading}
      empty="条件に一致するグループがありません"
      columns={SUMMARY_COLUMNS}
      headers={[
        "路線",
        "区間",
        "端末",
        "ビルド",
        "セッション",
        "凍結セッション",
        "凍結",
        "最長欠落",
      ]}
    >
      {rows.slice(0, MAX_ROWS).map((r, i) => {
        const line = renderLine(r.lineId);
        return (
          <div
            key={`${r.lineId}:${r.segmentId}:${r.device}:${r.appVersion}:${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: SUMMARY_COLUMNS,
              fontSize: 11.5,
              borderBottom: "1px solid #131d31",
              alignItems: "center",
            }}
          >
            <Cell>
              <LineTag label={line.label} color={line.color} />
            </Cell>
            <Cell mono dim>
              {r.segmentId ?? "—"}
            </Cell>
            <Cell mono>{r.device}</Cell>
            <Cell mono dim>
              {fmtBuild(r)}
            </Cell>
            <Cell mono>{r.sessionCount}</Cell>
            <Cell mono accent={r.freezeSessionCount > 0}>
              {r.freezeSessionCount}
            </Cell>
            <Cell mono accent={r.freezeCount > 0}>
              {r.freezeCount}
            </Cell>
            <Cell mono dim>
              {fmtDuration(r.maxGapMs)}
            </Cell>
          </div>
        );
      })}
    </Card>
  );
}

const SESSION_COLUMNS =
  "minmax(150px,1.4fr) minmax(110px,1fr) minmax(130px,1.2fr) minmax(160px,1.5fr) 84px 108px 72px 96px";

function SessionTable({
  rows,
  loading,
  renderLine,
}: {
  rows: FreezeSessionRow[];
  loading: boolean;
  renderLine: LineRenderer;
}) {
  return (
    <Card
      title="セッション別 (凍結 0 件も表示)"
      count={rows.length}
      loading={loading}
      empty="条件に一致するセッションがありません"
      columns={SESSION_COLUMNS}
      headers={["開始", "端末", "路線", "ビルド", "位置ログ", "最高速度 km/h", "凍結", "最長欠落"]}
    >
      {rows.slice(0, MAX_ROWS).map((r) => (
        <div
          key={r.sessionId}
          title={`session ${r.sessionId}\n${fmtStamp(r.startedAt)} → ${fmtStamp(r.endedAt)}`}
          style={{
            display: "grid",
            gridTemplateColumns: SESSION_COLUMNS,
            fontSize: 11.5,
            borderBottom: "1px solid #131d31",
            alignItems: "center",
          }}
        >
          <Cell mono>{fmtStamp(r.startedAt)}</Cell>
          <Cell mono>{r.device}</Cell>
          <Cell>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {r.lineIds.length === 0 && <span style={{ color: AXIS_INK }}>—</span>}
              {r.lineIds.map((id) => {
                const line = renderLine(id);
                return <LineTag key={id} label={line.label} color={line.color} />;
              })}
            </div>
          </Cell>
          <Cell mono dim>
            {fmtBuild(r)}
          </Cell>
          <Cell mono>{r.locationCount}</Cell>
          <Cell mono dim>
            {r.maxSpeed == null ? "—" : `${r.maxSpeed.toFixed(1)}`}
          </Cell>
          <Cell mono accent={r.freezeCount > 0}>
            {r.freezeCount}
          </Cell>
          <Cell mono dim>
            {fmtDuration(r.maxGapMs)}
          </Cell>
        </div>
      ))}
    </Card>
  );
}

const FREEZE_COLUMNS =
  "minmax(120px,1.2fr) minmax(110px,1fr) minmax(120px,1.2fr) 88px 108px 76px 100px minmax(150px,1.4fr)";

function FreezeTable({
  rows,
  loading,
  renderLine,
}: {
  rows: FreezeRow[];
  loading: boolean;
  renderLine: LineRenderer;
}) {
  return (
    <Card
      title="欠落 1 件ごと (新しい順)"
      count={rows.length}
      loading={loading}
      empty="条件に一致する凍結はありません"
      columns={FREEZE_COLUMNS}
      headers={[
        "欠落開始",
        "端末",
        "路線",
        "欠落長",
        "直前速度 km/h",
        "ずれ",
        "生存イベント",
        "ビルド",
      ]}
    >
      {rows.slice(0, MAX_ROWS).map((r, i) => {
        const line = renderLine(r.lineId);
        return (
          <div
            key={`${r.sessionId}:${r.gapStart}:${i}`}
            title={`session ${r.sessionId}\n${fmtStamp(r.gapStart)} → ${fmtStamp(r.gapEnd)}${
              r.segmentId ? `\n区間 ${r.segmentId}` : ""
            }`}
            style={{
              display: "grid",
              gridTemplateColumns: FREEZE_COLUMNS,
              fontSize: 11.5,
              borderBottom: "1px solid #131d31",
              alignItems: "center",
            }}
          >
            <Cell mono>{fmtStamp(r.gapStart)}</Cell>
            <Cell mono>{r.device}</Cell>
            <Cell>
              <LineTag label={line.label} color={line.color} />
            </Cell>
            <Cell mono accent>
              {fmtDuration(r.gapMs)}
            </Cell>
            <Cell mono dim>
              {r.speedBeforeGap.toFixed(1)}
            </Cell>
            <Cell mono dim>
              {fmtMeters(r.jumpDistanceMeters)}
            </Cell>
            <Cell mono dim>
              {r.aliveEventCount}
            </Cell>
            <Cell mono dim>
              {fmtBuild(r)}
            </Cell>
          </div>
        );
      })}
    </Card>
  );
}

function Cell({
  children,
  mono,
  dim,
  accent,
}: {
  children: ReactNode;
  mono?: boolean;
  dim?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={mono ? "font-mono" : undefined}
      style={{
        padding: "7px 12px",
        color: accent ? FREEZE_INK : dim ? SECONDARY_INK : PRIMARY_INK,
        fontWeight: accent ? 600 : 400,
        fontSize: dim ? 10.5 : undefined,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function LineTag({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: PRIMARY_INK,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flex: "none" }} />
      {label}
    </span>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ width: 92, flex: "none", fontSize: 10.5, color: AXIS_INK }}>{label}</div>
      {children}
    </div>
  );
}

function PresetGroup({
  options,
  value,
  onSelect,
}: {
  options: { label: string; value: number }[];
  value: number;
  onSelect: (value: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.label}
            onClick={() => onSelect(o.value)}
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
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: checked ? PRIMARY_INK : AXIS_INK,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#3987e5", cursor: "pointer" }}
      />
      {label}
    </label>
  );
}

function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  // alert: 凍結あり(赤) / clean: 対象はあるが凍結ゼロ(緑) / neutral: 判定なし
  tone?: "alert" | "clean" | "neutral";
}) {
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
      <div
        className="font-mono"
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: tone === "alert" ? FREEZE_INK : tone === "clean" ? CLEAN_INK : PRIMARY_INK,
        }}
      >
        {value}
      </div>
    </div>
  );
}
