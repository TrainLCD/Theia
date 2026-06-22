export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

export const pad = (n: number) => String(n).padStart(2, "0");

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

const DAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function formatClock(now: number): { clock: string; dateStr: string } {
  const d = new Date(now);
  return {
    clock: pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()),
    dateStr: d.getMonth() + 1 + "月" + d.getDate() + "日 (" + DAYS[d.getDay()] + ")",
  };
}
