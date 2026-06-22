import { ERROR_DEFS, LINE_DEFS, LINE_MAP, TIME_SCALE, TRAIN_TYPES } from "./data";
import type { AlertEntry, Train } from "./types";
import { pick, rnd } from "./utils";

export function buildTrains(): Train[] {
  const trains: Train[] = [];
  let no = 1001;
  LINE_DEFS.forEach((line, li) => {
    const count = 4 + (li % 3);
    for (let i = 0; i < count; i++) {
      const tp = pick(TRAIN_TYPES);
      const base = rnd(line.maxSpeed * 0.55, line.maxSpeed * 0.85);
      trains.push({
        id: "T" + no,
        no: no + "M",
        type: tp.t,
        typeColor: tp.c,
        lineId: line.id,
        cars: pick([4, 6, 8, 10]),
        pos: Math.random(),
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: base,
        baseSpeed: base,
        maxSpeed: line.maxSpeed,
        conf: rnd(82, 97),
        comm: "ok",
        phase: rnd(0, 12),
        phase2: rnd(0, 12),
        errors: [],
      });
      no += pick([1, 2, 3]);
    }
  });
  return trains;
}

export interface SimulationStep {
  trains: Train[];
  alerts: AlertEntry[];
  tickRef: { current: number };
}

export function stepSimulation({ trains, alerts, tickRef }: SimulationStep): void {
  const t = tickRef.current + 1;
  trains.forEach((tr) => {
    const line = LINE_MAP[tr.lineId]!;
    const hardError = tr.errors.some((e) => e.sev === "E");
    let target = tr.baseSpeed + Math.sin((t + tr.phase) / 7) * tr.baseSpeed * 0.22;
    if (hardError) target *= 0.15;
    tr.speed += (target - tr.speed) * 0.25 + (Math.random() - 0.5) * 3;
    tr.speed = Math.max(0, Math.min(tr.maxSpeed, tr.speed));
    tr.pos += ((tr.dir * (tr.speed / 3600)) / line.lengthKm) * TIME_SCALE;
    if (tr.pos >= 1) {
      tr.pos = 1;
      tr.dir = -1;
    }
    if (tr.pos <= 0) {
      tr.pos = 0;
      tr.dir = 1;
    }
    const r = Math.random();
    if (tr.comm === "ok") {
      if (r < 0.01) tr.comm = "weak";
    } else if (tr.comm === "weak") {
      if (r < 0.15) tr.comm = "ok";
      else if (r < 0.18) tr.comm = "lost";
    } else {
      if (r < 0.2) tr.comm = "weak";
    }
    let tc = tr.comm === "lost" ? 28 : tr.comm === "weak" ? 62 : 92;
    tc += Math.sin((t + tr.phase2) / 9) * 4;
    tr.conf += (tc - tr.conf) * 0.2 + (Math.random() - 0.5) * 2.5;
    tr.conf = Math.max(12, Math.min(99, tr.conf));
    tr.errors = tr.errors.filter((e) => {
      e.ttl--;
      if (e.ttl <= 0) {
        alerts.unshift({
          ts: Date.now(),
          no: tr.no,
          line: line.name,
          lineColor: line.color,
          code: e.code,
          label: e.label,
          sev: e.sev,
          kind: "clear",
        });
        return false;
      }
      return true;
    });
  });
  if (Math.random() < 0.5) {
    const tr = pick(trains);
    const ed = pick(ERROR_DEFS);
    if (!tr.errors.some((e) => e.code === ed.code)) {
      tr.errors.push({ ...ed, ttl: Math.floor(rnd(6, 16)) });
      const ln = LINE_MAP[tr.lineId]!;
      alerts.unshift({
        ts: Date.now(),
        no: tr.no,
        line: ln.name,
        lineColor: ln.color,
        code: ed.code,
        label: ed.label,
        sev: ed.sev,
        kind: "raise",
      });
    }
  }
  if (alerts.length > 40) alerts.length = 40;
  tickRef.current = t;
}
