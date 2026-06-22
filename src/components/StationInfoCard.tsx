import type { LineMeta } from "../types";

export interface StationInfoCardProps {
  name: string;
  nameRoman: string | null;
  id: number;
  line: LineMeta;
}

export function StationInfoCard({ name, nameRoman, id, line }: StationInfoCardProps) {
  return (
    <div
      style={{
        background: "rgba(10,16,29,.92)",
        border: "1px solid #2b3f63",
        borderRadius: 8,
        padding: "9px 12px",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 22px rgba(0,0,0,.55)",
        minWidth: 150,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e6edf7", lineHeight: 1.2 }}>
        {name}
      </div>
      {nameRoman && (
        <div
          className="font-mono"
          style={{ fontSize: 10, color: "#6b7d9c", marginTop: 2, lineHeight: 1.2 }}
        >
          {nameRoman}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid #1a2740",
          fontSize: 11,
        }}
      >
        <span
          style={{ width: 9, height: 9, borderRadius: 2, background: line.color, flex: "none" }}
        />
        <span
          style={{
            color: "#cdd8e8",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {line.name}
        </span>
      </div>
      <div className="font-mono" style={{ fontSize: 10, color: "#51617a", marginTop: 4 }}>
        ID {id}
      </div>
    </div>
  );
}
