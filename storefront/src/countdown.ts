export type CountdownFormat = "dd:hh:mm:ss" | "hh:mm:ss" | "with_labels";

export interface Remaining {
  d: number;
  h: number;
  m: number;
  s: number;
}

// remaining breaks a millisecond duration into d/h/m/s, clamping negatives to zero.
export function remaining(ms: number): Remaining {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

// formatRemaining renders the remaining time in one of the three countdown formats.
export function formatRemaining(ms: number, format: CountdownFormat): string {
  const { d, h, m, s } = remaining(ms);
  if (format === "hh:mm:ss") return `${pad(d * 24 + h)}:${pad(m)}:${pad(s)}`;
  if (format === "with_labels") return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(s)}`; // dd:hh:mm:ss
}

// isExpired is true at or after the deadline (inclusive boundary).
export function isExpired(deadlineMs: number, nowMs: number): boolean {
  return nowMs >= deadlineMs;
}
