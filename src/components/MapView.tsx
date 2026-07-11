import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LineMeta, MapData, MapLineView, MapStation, MapTrainView, TrainView } from "../types";
import { BatteryBadge } from "./BatteryBadge";
import { StationInfoCard } from "./StationInfoCard";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;
const WHEEL_STEP = 1.15;
const DRAG_THRESHOLD = 4;

interface Pan {
  x: number;
  y: number;
}

function clampZoom(z: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

function clampPan(p: Pan, z: number, w: number, h: number): Pan {
  return {
    x: Math.min(0, Math.max(-w * (z - 1), p.x)),
    y: Math.min(0, Math.max(-h * (z - 1), p.y)),
  };
}

export interface MapViewProps {
  data: MapData;
  sel: TrainView | null;
  onSelectTrain: (id: string) => void;
}

export function MapView({ data, sel, onSelectTrain }: MapViewProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "radial-gradient(1400px 800px at 50% 18%, #0c1626, #070a10)",
      }}
    >
      <GridBackground />
      <TopLeftLabel />
      <Canvas data={data} selectedId={sel?.id ?? null} onSelectTrain={onSelectTrain} />
      <Legend lines={data.lines} />
      {sel && <SelectedCard sel={sel} />}
      {data.lines.length === 0 && <Empty />}
    </div>
  );
}

function GridBackground() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(120,150,200,.05) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(120,150,200,.05) 1px, transparent 1px)",
        backgroundSize: "46px 46px",
      }}
    />
  );
}

function TopLeftLabel() {
  return (
    <div style={{ position: "absolute", top: 20, left: 24, zIndex: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#8597b3", letterSpacing: ".14em" }}>
        地理ビュー — 全路線
      </div>
      <div className="font-mono" style={{ fontSize: 10.5, color: "#51617a", marginTop: 3 }}>
        ▶ 進行方向　·　クリックでデバイスを選択
      </div>
    </div>
  );
}

function Canvas({
  data,
  selectedId,
  onSelectTrain,
}: {
  data: MapData;
  selectedId: string | null;
  onSelectTrain: (id: string) => void;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startPan: { x: 0, y: 0 } as Pan,
    moved: false,
  });
  const suppressClickRef = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  const applyZoom = (mx: number, my: number, factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curZ = zoomRef.current;
    const newZ = clampZoom(curZ * factor);
    if (newZ === curZ) return;
    const curP = panRef.current;
    const nx = mx - ((mx - curP.x) * newZ) / curZ;
    const ny = my - ((my - curP.y) * newZ) / curZ;
    setZoom(newZ);
    setPan(clampPan({ x: nx, y: ny }, newZ, rect.width, rect.height));
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
    applyZoom(mx, my, factor);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPan: panRef.current,
      moved: false,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        d.moved = true;
        setGrabbing(true);
      }
      if (!d.moved) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPan(
        clampPan(
          { x: d.startPan.x + dx, y: d.startPan.y + dy },
          zoomRef.current,
          rect.width,
          rect.height,
        ),
      );
    };
    const onUp = () => {
      if (dragRef.current.moved) {
        suppressClickRef.current = true;
      }
      dragRef.current.active = false;
      dragRef.current.moved = false;
      setGrabbing(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.stopPropagation();
      e.preventDefault();
      suppressClickRef.current = false;
    }
  };

  const zoomFromCenter = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    applyZoom(rect.width / 2, rect.height / 2, factor);
  };

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const canPan = zoom > 1;
  const cursor = grabbing ? "grabbing" : canPan ? "grab" : "default";

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onClickCapture={onClickCapture}
      style={{
        position: "absolute",
        inset: "54px 28px 28px 28px",
        cursor,
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
          }}
        >
          {data.lines.map((line) => (
            <polyline
              key={line.meta.id}
              points={line.pointsStr}
              fill="none"
              stroke={line.meta.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={0.9}
            />
          ))}
        </svg>
        {data.lines.flatMap((line) =>
          line.stations.map((st) => {
            const key = `${line.meta.id}-${st.id}`;
            return (
              <StationDot
                key={key}
                st={st}
                zoom={zoom}
                hovered={hoverKey === key}
                onEnter={() => setHoverKey(key)}
                onLeave={() => setHoverKey((cur) => (cur === key ? null : cur))}
              />
            );
          }),
        )}
        {data.trains
          .filter((tr) => tr.hasMapPosition)
          .map((tr) => (
            <TrainMarker
              key={tr.id}
              tr={tr}
              zoom={zoom}
              selected={tr.id === selectedId}
              onClick={() => onSelectTrain(tr.id)}
            />
          ))}
        {data.lines.flatMap((line) =>
          line.stations.map((st) => {
            const key = `${line.meta.id}-${st.id}`;
            if (hoverKey !== key) return null;
            return <StationTooltip key={`tip-${key}`} st={st} zoom={zoom} line={line.meta} />;
          }),
        )}
      </div>
      <ZoomControls
        zoom={zoom}
        onZoomIn={() => zoomFromCenter(ZOOM_STEP)}
        onZoomOut={() => zoomFromCenter(1 / ZOOM_STEP)}
        onReset={reset}
      />
    </div>
  );
}

function StationDot({
  st,
  zoom,
  hovered,
  onEnter,
  onLeave,
}: {
  st: MapStation;
  zoom: number;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "absolute",
        left: `${st.x}%`,
        top: `${st.y}%`,
        transformOrigin: "0 0",
        transform: `scale(${1 / zoom}) translate(-50%,-50%)`,
        zIndex: hovered ? 4 : 2,
        padding: 4,
        cursor: "help",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          width: hovered ? 10 : 7,
          height: hovered ? 10 : 7,
          borderRadius: "50%",
          background: "#0a0f18",
          border: `1.5px solid ${hovered ? "#cdd8e8" : "#46597b"}`,
          transition: "width .12s, height .12s, border-color .12s",
        }}
      />
    </div>
  );
}

function StationTooltip({ st, zoom, line }: { st: MapStation; zoom: number; line: LineMeta }) {
  const flipX = st.x > 65;
  const flipY = st.y < 20;
  const offsetX = flipX ? -12 : 12;
  const offsetY = flipY ? 12 : -12;
  const translate = `translate(${flipX ? "-100%" : "0"}, ${flipY ? "0" : "-100%"})`;
  return (
    <div
      style={{
        position: "absolute",
        left: `${st.x}%`,
        top: `${st.y}%`,
        transformOrigin: "0 0",
        transform: `scale(${1 / zoom}) ${translate} translate(${offsetX}px, ${offsetY}px)`,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <StationInfoCard name={st.name} nameRoman={st.nameRoman} id={st.id} line={line} />
    </div>
  );
}

function TrainMarker({
  tr,
  zoom,
  selected,
  onClick,
}: {
  tr: MapTrainView;
  zoom: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      title={`${tr.no} · ${tr.statusLabel} · ${tr.lineName}`}
      style={{
        position: "absolute",
        left: `${tr.mapX}%`,
        top: `${tr.mapY}%`,
        transformOrigin: "0 0",
        transform: `scale(${1 / zoom}) translate(-50%,-50%)`,
        transition: "left .98s linear, top .98s linear",
        cursor: "pointer",
        zIndex: 3,
        pointerEvents: "auto",
      }}
    >
      {tr.isAlert && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: `2px solid ${tr.statusColor}`,
            transform: "translate(-50%,-50%)",
            animation: "ringPulse 1.6s ease-out infinite",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%,-50%) rotate(${tr.headAngle}deg) translateX(12px)`,
          width: 0,
          height: 0,
          borderLeft: `7px solid ${tr.statusColor}`,
          borderTop: "4.5px solid transparent",
          borderBottom: "4.5px solid transparent",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 15,
          height: 15,
          borderRadius: "50%",
          background: "#0e1830",
          border: `2px solid ${selected ? "#e6edf7" : tr.statusColor}`,
          boxShadow: `0 0 9px ${tr.glowColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${selected ? 1.25 : 1})`,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: tr.statusColor }} />
      </div>
    </div>
  );
}

function Legend({ lines }: { lines: MapLineView[] }) {
  if (lines.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 24,
        zIndex: 4,
        background: "rgba(10,16,29,.82)",
        border: "1px solid #1e2c44",
        borderRadius: 10,
        padding: "12px 14px",
        backdropFilter: "blur(6px)",
        maxHeight: "60vh",
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 10, color: "#6b7d9c", letterSpacing: ".1em", marginBottom: 9 }}>
        路線
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {lines.map((ln) => (
          <div key={ln.meta.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 18,
                height: 3,
                borderRadius: 2,
                background: ln.meta.color,
                flex: "none",
              }}
            />
            <span
              style={{
                fontSize: 11.5,
                color: "#cdd8e8",
                flex: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {ln.meta.name}
            </span>
            <span className="font-mono" style={{ fontSize: 10.5, color: "#6b7d9c" }}>
              {ln.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectedCard({ sel }: { sel: TrainView }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: 24,
        zIndex: 4,
        width: 330,
        background: "rgba(12,19,34,.9)",
        border: "1px solid #22324f",
        borderRadius: 12,
        padding: 15,
        backdropFilter: "blur(8px)",
        boxShadow: "0 12px 36px rgba(0,0,0,.5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
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
        <span className="font-mono" style={{ fontSize: 15, fontWeight: 600 }}>
          {sel.no}
        </span>
        <BatteryBadge tr={sel} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: sel.lineColor, fontWeight: 600 }}>
          ● {sel.lineName}
        </span>
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        <Tile label="速度">
          <span className="font-mono" style={{ fontSize: 18, fontWeight: 600 }}>
            {sel.speed}
            <span style={{ fontSize: 9, color: "#6b7d9c" }}> km/h</span>
          </span>
        </Tile>
        <Tile label="位置情報精度">
          <span
            className="font-mono"
            style={{ fontSize: 18, fontWeight: 600, color: sel.confColor }}
          >
            {sel.meters != null ? `±${sel.meters}` : "—"}
            <span style={{ fontSize: 9, color: "#6b7d9c" }}> m</span>
          </span>
        </Tile>
        <Tile label="通信">
          <span style={{ fontSize: 15, fontWeight: 600, color: sel.commColor, paddingTop: 2 }}>
            {sel.commLabel}
          </span>
        </Tile>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginTop: 11,
          fontSize: 11,
          color: "#aeb9cc",
        }}
      >
        <span style={{ color: "#6b7d9c" }}>駅</span> {sel.nextStation}
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        padding: 10,
        background: "#0a1120",
        border: "1px solid #18233a",
        borderRadius: 8,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 9.5, color: "#6b7d9c" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "rgba(10,16,29,.82)",
        border: "1px solid #1e2c44",
        borderRadius: 10,
        padding: 6,
        backdropFilter: "blur(6px)",
      }}
    >
      <ZoomButton label="+" title="拡大" onClick={onZoomIn} disabled={zoom >= MAX_ZOOM} />
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          color: "#8597b3",
          textAlign: "center",
          letterSpacing: ".06em",
        }}
      >
        {zoom.toFixed(1)}x
      </div>
      <ZoomButton label="−" title="縮小" onClick={onZoomOut} disabled={zoom <= MIN_ZOOM} />
      <ZoomButton label="⟲" title="リセット" onClick={onReset} disabled={zoom === 1} small />
    </div>
  );
}

function ZoomButton({
  label,
  title,
  onClick,
  disabled,
  small,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      disabled={disabled}
      style={{
        width: 30,
        height: small ? 24 : 28,
        borderRadius: 6,
        background: "#0e1830",
        border: "1px solid #22324f",
        color: disabled ? "#3a4866" : "#cdd8e8",
        fontSize: small ? 14 : 17,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}

function Empty() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#51617a",
        fontSize: 12,
        letterSpacing: ".1em",
      }}
    >
      路線データを待機しています…
    </div>
  );
}
