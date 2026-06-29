import type { Bar } from "../types";

// Sort key for a bar's countdown end; bars without a (live) countdown sort last.
export function endValue(bar: Bar): number {
  return bar.countdown_enabled && bar.countdown_end_at ? new Date(bar.countdown_end_at).getTime() : Infinity;
}

export interface ListQuery {
  query: string;
  status: string[]; // any of "active" | "draft"; empty = all
  sort: string; // "<field> asc|desc", field ∈ title | status | countdown
}

// Search (title OR message, case-insensitive) + status filter, then sort. Pure — easy to unit-test.
export function filterSortBars(items: Bar[], { query, status, sort }: ListQuery): Bar[] {
  const q = query.trim().toLowerCase();
  const list = items.filter((b) => {
    const matchesQuery = !q || b.title.toLowerCase().includes(q) || b.message.toLowerCase().includes(q);
    const matchesStatus =
      status.length === 0 ||
      (status.includes("active") && b.enabled) ||
      (status.includes("draft") && !b.enabled);
    return matchesQuery && matchesStatus;
  });
  const [field, dir] = (sort || "title asc").split(" ");
  const sign = dir === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    if (field === "status") return sign * (Number(b.enabled) - Number(a.enabled));
    if (field === "countdown") return sign * (endValue(a) - endValue(b));
    return sign * a.title.localeCompare(b.title);
  });
}

export interface Paged<T> {
  items: T[];
  totalPages: number;
  currentPage: number; // clamped into [1, totalPages]
}

// Slice `list` into the requested page; clamps the page so callers can't read past the end.
export function paginate<T>(list: T[], page: number, size: number): Paged<T> {
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * size;
  return { items: list.slice(start, start + size), totalPages, currentPage };
}
