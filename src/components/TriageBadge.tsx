import type { ReactNode } from "react";
import {
  LOW_CONFIDENCE,
  NEEDS_FIX,
  TRIAGE_CATEGORY_COLOR,
  TRIAGE_CATEGORY_LABEL,
  triageImpactLabel,
  type TriageJudgement,
  type TriageSummary,
} from "../useAlertTriage";

// トリアージ判定の表示部品。アラートフィード・端末診断・路線ヘッダーで使い回す。
// 判定が割れている軸 (confidence が低い) は破線・半透明にして、鵜呑みにせず
// 本文を読む手がかりにする。数値そのものは title に出す。

export function TriageBadge({
  color,
  faded,
  title,
  children,
}: {
  color: string;
  faded: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className="font-mono"
      style={{
        fontSize: 9.5,
        fontWeight: 600,
        color,
        border: `1px solid ${color}`,
        borderStyle: faded ? "dashed" : "solid",
        opacity: faded ? 0.5 : 1,
        padding: "1px 5px",
        borderRadius: 4,
        cursor: "help",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;

/** 1 件のログに対する 3 軸。アラートフィードと端末診断のエラー一覧で使う。 */
export function TriageBadges({ judgement }: { judgement: TriageJudgement }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      <TriageBadge
        color={TRIAGE_CATEGORY_COLOR[judgement.category]}
        faded={judgement.categoryConfidence < LOW_CONFIDENCE}
        title={`所在の確信度 ${pct(judgement.categoryConfidence)}`}
      >
        {TRIAGE_CATEGORY_LABEL[judgement.category]}
      </TriageBadge>
      <TriageBadge
        color="#dbe6f5"
        faded={judgement.impactConfidence < LOW_CONFIDENCE}
        title={`影響度 ${judgement.impact.toFixed(2)} / 3・確信度 ${pct(judgement.impactConfidence)}`}
      >
        {triageImpactLabel(judgement.impact)}
      </TriageBadge>
      <TriageBadge
        color={judgement.actionable >= NEEDS_FIX ? "#ef4444" : "#6b7d9c"}
        faded={judgement.actionable < NEEDS_FIX}
        title={`アプリ側の修正が要る確率 ${pct(judgement.actionable)}`}
      >
        要修正 {pct(judgement.actionable)}
      </TriageBadge>
    </div>
  );
}

/**
 * 端末や路線をまとめて見るときの 1 個。最も優先度が高い判定の所在と影響度を出し、
 * 要修正が複数あるときだけ件数を添える。判定が 1 件も無ければ何も出さない。
 */
export function TriageSummaryBadge({ summary }: { summary: TriageSummary }) {
  const worst = summary.worst;
  if (worst == null) return null;
  const color = TRIAGE_CATEGORY_COLOR[worst.category];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <TriageBadge
        color={color}
        faded={worst.impactConfidence < LOW_CONFIDENCE}
        title={`最も重いログ: ${TRIAGE_CATEGORY_LABEL[worst.category]}・影響度 ${worst.impact.toFixed(2)} / 3・確信度 ${pct(worst.impactConfidence)}`}
      >
        {TRIAGE_CATEGORY_LABEL[worst.category]} / {triageImpactLabel(worst.impact)}
      </TriageBadge>
      {summary.needsFix > 0 && (
        <TriageBadge
          color="#ef4444"
          faded={false}
          title={`アプリ側の修正が要ると判定されたログ ${summary.needsFix} 件 (判定済み ${summary.judged} 件)`}
        >
          要修正 {summary.needsFix}
        </TriageBadge>
      )}
    </span>
  );
}
