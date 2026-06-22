import type { ThqConnectionState, ThqSocketState } from "../useThqSocket";

const STATE_LABEL: Record<ThqConnectionState, string> = {
  connecting: "接続中",
  open: "接続済",
  closed: "切断",
  error: "エラー",
};

const STATE_COLOR: Record<ThqConnectionState, string> = {
  connecting: "#f59e0b",
  open: "#22c55e",
  closed: "#6b7d9c",
  error: "#ef4444",
};

export interface LiveStatusBarProps {
  url: string;
  socket: ThqSocketState;
}

export function LiveStatusBar({ url, socket }: LiveStatusBarProps) {
  const color = STATE_COLOR[socket.connection];
  const label = STATE_LABEL[socket.connection];

  const latest = formatLatest(socket);

  return (
    <div
      style={{
        height: 26,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 16px",
        background: "#0a101d",
        borderTop: "1px solid #1e2c44",
        fontSize: 11,
        color: "#8597b3",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: color,
            animation: socket.connection === "open" ? "blink 1.6s infinite" : undefined,
          }}
        />
        <span style={{ fontWeight: 600, color, letterSpacing: ".08em" }}>THQ · {label}</span>
      </div>
      <span className="font-mono" style={{ fontSize: 10.5, color: "#51617a" }}>
        {url}
      </span>
      <span style={{ width: 1, height: 14, background: "#1e2c44" }} />
      <span style={{ fontSize: 10.5 }}>
        受信{" "}
        <span className="font-mono" style={{ color: "#cdd8e8" }}>
          {socket.received}
        </span>{" "}
        件
      </span>
      {latest && (
        <>
          <span style={{ width: 1, height: 14, background: "#1e2c44" }} />
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              color: "#aeb9cc",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
              minWidth: 0,
            }}
          >
            {latest}
          </span>
        </>
      )}
      {!latest && <div style={{ flex: 1 }} />}
      {socket.lastError && (
        <span
          className="font-mono"
          style={{
            fontSize: 10.5,
            color: "#fca5a5",
            background: "#1f0d0d",
            border: "1px solid #4a1818",
            padding: "1px 6px",
            borderRadius: 4,
            maxWidth: 360,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={socket.lastError}
        >
          {socket.lastError}
        </span>
      )}
    </div>
  );
}

function formatLatest(s: ThqSocketState): string | null {
  const loc = s.latestLocation;
  const log = s.latestLog;
  if (!loc && !log) return null;
  const pickLoc = loc && (!log || loc.timestamp >= log.timestamp);
  if (pickLoc && loc) {
    const acc = loc.coords.accuracy != null ? `±${loc.coords.accuracy.toFixed(1)}m` : "—";
    const spd = loc.coords.speed != null ? `${loc.coords.speed.toFixed(1)}km/h` : "—";
    return `LOC ${loc.device} · L${loc.line_id}${loc.station_id ? ` S${loc.station_id}` : ""} · ${loc.state} · ${acc} · ${spd}`;
  }
  if (log) {
    return `LOG ${log.device} · ${log.log.level.toUpperCase()} · ${log.log.message}`;
  }
  return null;
}
