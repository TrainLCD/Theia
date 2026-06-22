import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EngineerView } from "#/components/EngineerView";
import { Header } from "#/components/Header";
import { LineFocusView } from "#/components/LineFocusView";
import { NetworkView } from "#/components/NetworkView";
import { TabNav } from "#/components/TabNav";
import { LINE_DEFS } from "#/data";
import { buildLineViews, computeKpi, deriveTrain, formatAlerts } from "#/derive";
import type { Filter, View } from "#/types";
import { useTrainSimulation } from "#/useTrainSimulation";
import { formatClock } from "#/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { trains, alerts, now } = useTrainSimulation();

  const [view, setView] = useState<View>("network");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLineId, setActiveLineId] = useState<string>(LINE_DEFS[0]!.id);
  const [filter, setFilter] = useState<Filter>("all");

  const views = trains.map(deriveTrain);
  const kpi = computeKpi(views);
  const linesView = buildLineViews(views);
  const activeLine = linesView.find((l) => l.def.id === activeLineId) ?? linesView[0]!;
  const sel = selectedId ? (views.find((t) => t.id === selectedId) ?? null) : null;

  const table = views
    .filter((t) => {
      if (filter === "alert") return t.isAlert;
      if (filter === "error") return t.status === "error";
      if (filter === "comm") return t.comm !== "ok";
      return true;
    })
    .sort((a, b) => Number(b.isAlert) - Number(a.isAlert) || a.conf - b.conf);

  const worst = views
    .slice()
    .sort((a, b) => a.conf - b.conf)
    .slice(0, 9);
  const engSel = sel ?? table[0] ?? views[0];

  const { clock, dateStr } = formatClock(now);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        background: "#080b12",
        color: "#e6edf7",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Header
        kpis={{
          running: kpi.running,
          total: kpi.total,
          alerts: kpi.alerts,
          avgMeters: kpi.avgMeters,
          avgSpeed: kpi.avgSpeed,
        }}
        clock={clock}
        dateStr={dateStr}
      />
      <TabNav
        view={view}
        onChangeView={setView}
        counts={{ normal: kpi.normal, warn: kpi.warn, err: kpi.err }}
      />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {view === "network" && (
          <NetworkView
            linesView={linesView}
            sel={sel}
            alerts={formatAlerts(alerts)}
            onSelectTrain={setSelectedId}
          />
        )}
        {view === "line" && (
          <LineFocusView
            linesView={linesView}
            activeLine={activeLine}
            onSelectLine={setActiveLineId}
            onSelectTrain={setSelectedId}
          />
        )}
        {view === "engineer" && (
          <EngineerView
            table={table}
            worst={worst}
            engSel={engSel}
            filter={filter}
            onFilter={setFilter}
            onSelectTrain={setSelectedId}
            selectedId={selectedId}
            counts={{ total: kpi.total, alerts: kpi.alerts, err: kpi.err, commBad: kpi.commBad }}
          />
        )}
      </div>
    </div>
  );
}
