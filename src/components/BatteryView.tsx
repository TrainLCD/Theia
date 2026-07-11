import { useEffect, useMemo, useRef, useState } from "react";
import type { BatterySample, TrainView } from "../types";

export interface BatteryViewProps {
  history: Map<string, BatterySample[]>;
  views: TrainView[];
  now: number;
}

// dataviz スキルの検証済みカテゴリカルパレット(ダーク面 #0c1322 で全チェック通過)。
// スロットは初出順で固定し、フィルタや並び替えで色が変わらないようにする。
const SERIES_COLORS = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
  "#d95926",
];
const MAX_PLOTTED = SERIES_COLORS.length;

const SURFACE = "#0c1322";
const GRID = "#131d31";
const AXIS_INK = "#6b7d9c";
const PRIMARY_INK = "#e6edf7";
const SECONDARY_INK = "#8597b3";

const GAP_BREAK_MS = 10 * 60_000;
const TOOLTIP_TOLERANCE_MS = 5 * 60_000;
const MAX_POINTS_PER_SERIES = 600;
const MAX_DIRECT_LABELS = 4;
const LABEL_MIN_GAP_PX = 13;

const WINDOW_PRESETS: { label: string; ms: number | null }[] = [
  { label: "30分", ms: 30 * 60_000 },
  { label: "1時間", ms: 60 * 60_000 },
  { label: "3時間", ms: 3 * 60 * 60_000 },
  { label: "6時間", ms: 6 * 60 * 60_000 },
  { label: "全て", ms: null },
];

const ML = 44;
const MR = 132;
const MT = 12;
const MB = 26;
const CHART_H = 380;

interface Series {
  device: string;
  color: string;
  samples: BatterySample[];
}

function fmtHm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtHms(ts: number): string {
  return `${fmtHm(ts)}:${String(new Date(ts).getSeconds()).padStart(2, "0")}`;
}

function fmtAgo(ts: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 60) return `${sec}s 前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  return `${Math.floor(sec / 3600)}時間前`;
}

function nearestSample(samples: BatterySample[], ts: number): BatterySample | null {
  if (samples.length === 0) return null;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].ts < ts) lo = mid + 1;
    else hi = mid;
  }
  const cand = samples[lo];
  const prev = lo > 0 ? samples[lo - 1] : null;
  const best = prev && Math.abs(prev.ts - ts) < Math.abs(cand.ts - ts) ? prev : cand;
  return Math.abs(best.ts - ts) <= TOOLTIP_TOLERANCE_MS ? best : null;
}

function thin(samples: BatterySample[]): BatterySample[] {
  if (samples.length <= MAX_POINTS_PER_SERIES) return samples;
  const stride = Math.ceil(samples.length / MAX_POINTS_PER_SERIES);
  const out = samples.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== samples[samples.length - 1]) out.push(samples[samples.length - 1]);
  return out;
}

export function BatteryView({ history, views, now }: BatteryViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [windowMs, setWindowMs] = useState<number | null>(60 * 60_000);
  const [hoverTs, setHoverTs] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allSeries: Series[] = useMemo(
    () =>
      Array.from(history.entries()).map(([device, samples], i) => ({
        device,
        // 9 台目以降は色を持たない(巡回させない): チャートには載せず表のみ。
        color: i < MAX_PLOTTED ? SERIES_COLORS[i] : "#3b4c68",
        samples,
      })),
    [history],
  );
  const plotted = allSeries.slice(0, MAX_PLOTTED);
  const overflow = allSeries.length - plotted.length;

  const dataMin = Math.min(...plotted.map((s) => s.samples[0]?.ts ?? Infinity));
  const dataMax = Math.max(...plotted.map((s) => s.samples[s.samples.length - 1]?.ts ?? -Infinity));
  const hasData = now > 0 && Number.isFinite(dataMin) && Number.isFinite(dataMax);

  let tMax = windowMs != null ? now : dataMax;
  let tMin = windowMs != null ? now - windowMs : dataMin;
  if (tMax - tMin < 60_000) {
    tMin = tMax - 5 * 60_000;
    tMax = tMax + 60_000;
  }

  const plotW = Math.max(60, width - ML - MR);
  const plotH = CHART_H - MT - MB;
  const x = (ts: number) => ML + ((ts - tMin) / (tMax - tMin)) * plotW;
  const y = (pct: number) => MT + (1 - pct / 100) * plotH;

  const windowed = plotted.map((s) => ({
    ...s,
    samples: thin(s.samples.filter((p) => p.ts >= tMin && p.ts <= tMax)),
  }));

  const binTs = useMemo(() => {
    const set = new Set<number>();
    for (const s of windowed) for (const p of s.samples) set.add(p.ts);
    return Array.from(set).sort((a, b) => a - b);
  }, [windowed]);

  const snapTs = (clientX: number, svg: SVGSVGElement): number | null => {
    if (binTs.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    const ts = tMin + ((clientX - rect.left - ML) / plotW) * (tMax - tMin);
    let lo = 0;
    let hi = binTs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (binTs[mid] < ts) lo = mid + 1;
      else hi = mid;
    }
    const prev = lo > 0 ? binTs[lo - 1] : null;
    return prev != null && Math.abs(prev - ts) < Math.abs(binTs[lo] - ts) ? prev : binTs[lo];
  };

  const stepHover = (dir: 1 | -1) => {
    if (binTs.length === 0) return;
    if (hoverTs == null) {
      setHoverTs(binTs[binTs.length - 1]);
      return;
    }
    const i = binTs.indexOf(hoverTs);
    const next =
      binTs[Math.max(0, Math.min(binTs.length - 1, (i < 0 ? binTs.length - 1 : i) + dir))];
    setHoverTs(next);
  };

  // 直接ラベルは「残量が少ない」系列を優先して最大4件。近接時は後続をスキップし、
  // 識別は常設の凡例とツールチップに任せる(ラベルを縦にずらさない)。
  const endLabels = useMemo(() => {
    const ends = windowed
      .map((s) => {
        const last = s.samples[s.samples.length - 1];
        return last ? { device: s.device, color: s.color, pct: last.pct, yPos: y(last.pct) } : null;
      })
      .filter((e): e is NonNullable<typeof e> => e != null)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, MAX_DIRECT_LABELS)
      .sort((a, b) => a.yPos - b.yPos);
    const placed: typeof ends = [];
    for (const e of ends) {
      const prev = placed[placed.length - 1];
      if (!prev || e.yPos - prev.yPos >= LABEL_MIN_GAP_PX) placed.push(e);
    }
    return placed;
  }, [windowed, tMin, tMax, plotH]);

  const xTicks = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => tMin + ((tMax - tMin) * i) / (n - 1));
  }, [tMin, tMax]);

  const tooltipRows =
    hoverTs == null
      ? []
      : windowed.map((s) => ({
          device: s.device,
          color: s.color,
          sample: nearestSample(s.samples, hoverTs),
        }));

  const viewByDevice = new Map(views.map((v) => [v.id, v]));

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
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{ fontSize: 12, fontWeight: 600, color: SECONDARY_INK, letterSpacing: ".14em" }}
        >
          バッテリ残量推移
        </div>
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

      <div
        style={{
          background: SURFACE,
          border: "1px solid #22324f",
          borderRadius: 11,
          padding: 15,
        }}
      >
        {allSeries.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px 16px",
              marginBottom: 10,
            }}
          >
            {plotted.map((s) => {
              const last = s.samples[s.samples.length - 1];
              return (
                <span
                  key={s.device}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 2,
                      borderRadius: 1,
                      background: s.color,
                      flex: "none",
                    }}
                  />
                  <span className="font-mono" style={{ color: PRIMARY_INK, fontWeight: 600 }}>
                    {s.device}
                  </span>
                  {last && (
                    <span className="font-mono" style={{ color: SECONDARY_INK }}>
                      {last.charging ? "⚡" : ""}
                      {last.pct}%
                    </span>
                  )}
                </span>
              );
            })}
            {overflow > 0 && (
              <span style={{ fontSize: 10.5, color: AXIS_INK }}>
                +{overflow} 台は下の表のみに表示
              </span>
            )}
          </div>
        )}

        {!hasData ? (
          <div
            style={{
              height: CHART_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: AXIS_INK,
              fontSize: 12,
            }}
          >
            バッテリ情報を含む位置情報イベントの受信待ちです
          </div>
        ) : (
          <div
            ref={wrapRef}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") stepHover(-1);
              else if (e.key === "ArrowRight") stepHover(1);
              else if (e.key === "Escape") setHoverTs(null);
            }}
            style={{ position: "relative", outlineColor: "#2c3f61" }}
          >
            <svg
              width="100%"
              height={CHART_H}
              viewBox={`0 0 ${width} ${CHART_H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="デバイスごとのバッテリ残量の時系列チャート"
              onPointerMove={(e) => setHoverTs(snapTs(e.clientX, e.currentTarget))}
              onPointerLeave={() => setHoverTs(null)}
              style={{ display: "block", touchAction: "none" }}
            >
              {[0, 20, 40, 60, 80, 100].map((v) => (
                <g key={v}>
                  <line
                    x1={ML}
                    x2={ML + plotW}
                    y1={y(v)}
                    y2={y(v)}
                    stroke={v === 20 ? "#ef4444" : GRID}
                    strokeOpacity={v === 20 ? 0.35 : 1}
                    strokeWidth={1}
                  />
                  <text
                    x={ML - 7}
                    y={y(v) + 3}
                    textAnchor="end"
                    fontSize={9.5}
                    fill={AXIS_INK}
                    className="font-mono"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {v}%
                  </text>
                </g>
              ))}
              {xTicks.map((t) => (
                <text
                  key={t}
                  x={x(t)}
                  y={CHART_H - 8}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill={AXIS_INK}
                  className="font-mono"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmtHm(t)}
                </text>
              ))}
              <line x1={ML} x2={ML + plotW} y1={y(0)} y2={y(0)} stroke="#1e2c44" strokeWidth={1} />

              {windowed.map((s) => {
                const segments: BatterySample[][] = [];
                let cur: BatterySample[] = [];
                for (const p of s.samples) {
                  const prev = cur[cur.length - 1];
                  if (prev && p.ts - prev.ts > GAP_BREAK_MS) {
                    if (cur.length > 0) segments.push(cur);
                    cur = [];
                  }
                  cur.push(p);
                }
                if (cur.length > 0) segments.push(cur);
                const last = s.samples[s.samples.length - 1];
                return (
                  <g key={s.device}>
                    {segments.map((seg, i) =>
                      seg.length === 1 ? (
                        <circle
                          key={i}
                          cx={x(seg[0].ts)}
                          cy={y(seg[0].pct)}
                          r={2.5}
                          fill={s.color}
                        />
                      ) : (
                        <polyline
                          key={i}
                          points={seg.map((p) => `${x(p.ts)},${y(p.pct)}`).join(" ")}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ),
                    )}
                    {last && (
                      <circle
                        cx={x(last.ts)}
                        cy={y(last.pct)}
                        r={4}
                        fill={s.color}
                        stroke={SURFACE}
                        strokeWidth={2}
                      />
                    )}
                  </g>
                );
              })}

              {endLabels.map((e) => (
                <g key={e.device}>
                  <line
                    x1={ML + plotW + 6}
                    x2={ML + plotW + 16}
                    y1={e.yPos}
                    y2={e.yPos}
                    stroke={e.color}
                    strokeWidth={2}
                  />
                  <text
                    x={ML + plotW + 20}
                    y={e.yPos + 3.5}
                    fontSize={10}
                    fill="#cdd8e8"
                    className="font-mono"
                  >
                    {e.device} {e.pct}%
                  </text>
                </g>
              ))}

              {hoverTs != null && (
                <g>
                  <line
                    x1={x(hoverTs)}
                    x2={x(hoverTs)}
                    y1={MT}
                    y2={MT + plotH}
                    stroke="#3b4c68"
                    strokeWidth={1}
                  />
                  {tooltipRows.map(
                    (r) =>
                      r.sample && (
                        <circle
                          key={r.device}
                          cx={x(r.sample.ts)}
                          cy={y(r.sample.pct)}
                          r={3.5}
                          fill={r.color}
                          stroke={SURFACE}
                          strokeWidth={2}
                        />
                      ),
                  )}
                </g>
              )}
            </svg>

            {hoverTs != null && (
              <div
                style={{
                  position: "absolute",
                  top: MT + 4,
                  left: Math.min(x(hoverTs) + 10, width - 190),
                  width: 176,
                  background: "#0a1120",
                  border: "1px solid #22324f",
                  borderRadius: 8,
                  padding: "8px 10px",
                  pointerEvents: "none",
                  boxShadow: "0 8px 24px rgba(0,0,0,.45)",
                }}
              >
                <div
                  className="font-mono"
                  style={{ fontSize: 10, color: AXIS_INK, marginBottom: 5 }}
                >
                  {fmtHms(hoverTs)}
                </div>
                {tooltipRows.map((r) => (
                  <div
                    key={r.device}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      lineHeight: 1.7,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 2,
                        borderRadius: 1,
                        background: r.color,
                        flex: "none",
                      }}
                    />
                    <span
                      className="font-mono"
                      style={{ color: PRIMARY_INK, fontWeight: 700, minWidth: 42 }}
                    >
                      {r.sample ? `${r.sample.charging ? "⚡" : ""}${r.sample.pct}%` : "—"}
                    </span>
                    <span
                      style={{
                        color: SECONDARY_INK,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.device}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
            display: "grid",
            gridTemplateColumns: "minmax(140px,1.4fr) repeat(5, minmax(70px,1fr)) minmax(90px,1fr)",
            fontSize: 10,
            fontWeight: 600,
            color: AXIS_INK,
            letterSpacing: ".1em",
            borderBottom: "1px solid #1e2c44",
          }}
        >
          {["デバイス", "現在", "最小", "最大", "変化", "充電", "最終更新"].map((h) => (
            <div key={h} style={{ padding: "8px 12px" }}>
              {h}
            </div>
          ))}
        </div>
        {allSeries.length === 0 && (
          <div style={{ padding: "14px 12px", fontSize: 11.5, color: AXIS_INK }}>データなし</div>
        )}
        {allSeries.map((s, i) => {
          const inWindow = s.samples.filter((p) => p.ts >= tMin && p.ts <= tMax);
          const latest = s.samples[s.samples.length - 1];
          const view = viewByDevice.get(s.device);
          const currentPct = latest?.pct ?? view?.batteryPct ?? null;
          const min = inWindow.length ? Math.min(...inWindow.map((p) => p.pct)) : null;
          const max = inWindow.length ? Math.max(...inWindow.map((p) => p.pct)) : null;
          const delta =
            inWindow.length >= 2 ? inWindow[inWindow.length - 1].pct - inWindow[0].pct : null;
          const charging = latest?.charging ?? view?.batteryCharging ?? false;
          return (
            <div
              key={s.device}
              className="font-mono"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(140px,1.4fr) repeat(5, minmax(70px,1fr)) minmax(90px,1fr)",
                fontSize: 11.5,
                color: "#cdd8e8",
                borderBottom: "1px solid #131d31",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 7 }}>
                <span
                  style={{
                    width: 12,
                    height: 2,
                    borderRadius: 1,
                    background: i < MAX_PLOTTED ? s.color : "#3b4c68",
                    flex: "none",
                  }}
                />
                <span
                  style={{
                    fontWeight: 600,
                    color: PRIMARY_INK,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.device}
                </span>
              </div>
              <div style={{ padding: "8px 12px", fontWeight: 700, color: PRIMARY_INK }}>
                {currentPct != null ? `${currentPct}%` : "—"}
              </div>
              <div style={{ padding: "8px 12px" }}>{min != null ? `${min}%` : "—"}</div>
              <div style={{ padding: "8px 12px" }}>{max != null ? `${max}%` : "—"}</div>
              <div
                style={{
                  padding: "8px 12px",
                  color: delta == null ? "#cdd8e8" : delta < 0 ? "#f59e0b" : "#22c55e",
                }}
              >
                {delta != null ? `${delta > 0 ? "+" : ""}${delta}pt` : "—"}
              </div>
              <div style={{ padding: "8px 12px" }}>{charging ? "⚡ 充電中" : "—"}</div>
              <div style={{ padding: "8px 12px", color: SECONDARY_INK }}>
                {latest ? fmtAgo(latest.ts, now) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
