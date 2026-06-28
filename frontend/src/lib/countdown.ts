import type { CountdownFormat } from "../types";

export function remaining(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatRemaining(ms: number, format: CountdownFormat): string {
  const { d, h, m, s } = remaining(ms);
  if (format === "hh:mm:ss") return `${pad(d * 24 + h)}:${pad(m)}:${pad(s)}`;
  if (format === "with_labels") return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(s)}`;
}
