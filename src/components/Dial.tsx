export interface DialProps {
  value: number | string;
  unit: string;
  pct: number;
  color: string;
  size?: number;
}

export function Dial({ value, unit, pct, color, size = 84 }: DialProps) {
  const inset = Math.round(size * 0.083);
  const valColor = typeof value === "string" && value.startsWith("±") ? color : "#e6edf7";
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "none",
        borderRadius: "50%",
        background: `conic-gradient(${color} ${pct}%, #1b2740 0)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset,
          borderRadius: "50%",
          background: "#0c1322",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: size >= 84 ? 21 : 19,
            fontWeight: 600,
            lineHeight: 1,
            color: valColor,
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 9, color: "#6b7d9c" }}>{unit}</span>
      </div>
    </div>
  );
}
