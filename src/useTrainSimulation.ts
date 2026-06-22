import { useEffect, useRef, useState } from "react";
import { buildTrains, stepSimulation } from "./simulation";
import type { AlertEntry, Train } from "./types";

export interface SimulationResult {
  trains: Train[];
  alerts: AlertEntry[];
  now: number;
  tick: number;
}

export function useTrainSimulation(intervalMs = 1000): SimulationResult {
  const trainsRef = useRef<Train[]>([]);
  const alertsRef = useRef<AlertEntry[]>([]);
  const tickRef = useRef(0);
  if (trainsRef.current.length === 0) {
    trainsRef.current = buildTrains();
  }

  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      stepSimulation({ trains: trainsRef.current, alerts: alertsRef.current, tickRef });
      setTick(tickRef.current);
      setNow(Date.now());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { trains: trainsRef.current, alerts: alertsRef.current, now, tick };
}
