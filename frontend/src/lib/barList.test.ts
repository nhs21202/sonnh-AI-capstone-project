import { describe, it, expect } from "vitest";
import { filterSortBars, paginate, endValue } from "./barList";
import { makeBar } from "../test/factories";

const titlesOf = (bars: { title: string }[]) => bars.map((b) => b.title);

describe("filterSortBars — search", () => {
  const bars = [
    makeBar({ id: 1, title: "Summer Sale", message: "20% off everything" }),
    makeBar({ id: 2, title: "Winter Promo", message: "Free shipping" }),
    makeBar({ id: 3, title: "Clearance", message: "summer stock must go" }),
  ];

  it("matches by title (case-insensitive)", () => {
    const r = filterSortBars(bars, { query: "winter", status: [], sort: "title asc" });
    expect(titlesOf(r)).toEqual(["Winter Promo"]);
  });

  it("matches by message, not just title", () => {
    const r = filterSortBars(bars, { query: "shipping", status: [], sort: "title asc" });
    expect(titlesOf(r)).toEqual(["Winter Promo"]);
  });

  it("matches title OR message (query 'summer' hits two different fields)", () => {
    const r = filterSortBars(bars, { query: "summer", status: [], sort: "title asc" });
    expect(titlesOf(r).sort()).toEqual(["Clearance", "Summer Sale"]);
  });

  it("returns nothing when there is no match", () => {
    expect(filterSortBars(bars, { query: "zzz", status: [], sort: "title asc" })).toEqual([]);
  });

  it("ignores surrounding whitespace in the query", () => {
    const r = filterSortBars(bars, { query: "  winter  ", status: [], sort: "title asc" });
    expect(titlesOf(r)).toEqual(["Winter Promo"]);
  });
});

describe("filterSortBars — status filter", () => {
  const bars = [
    makeBar({ id: 1, title: "A", enabled: true }),
    makeBar({ id: 2, title: "B", enabled: false }),
    makeBar({ id: 3, title: "C", enabled: false }),
  ];

  it("empty filter returns all", () => {
    expect(filterSortBars(bars, { query: "", status: [], sort: "title asc" })).toHaveLength(3);
  });
  it("active only", () => {
    expect(titlesOf(filterSortBars(bars, { query: "", status: ["active"], sort: "title asc" }))).toEqual(["A"]);
  });
  it("draft only", () => {
    expect(titlesOf(filterSortBars(bars, { query: "", status: ["draft"], sort: "title asc" }))).toEqual(["B", "C"]);
  });
  it("active + draft returns all", () => {
    expect(filterSortBars(bars, { query: "", status: ["active", "draft"], sort: "title asc" })).toHaveLength(3);
  });
});

describe("filterSortBars — sort", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const sooner = new Date(Date.now() + 3_600_000).toISOString();
  const bars = [
    makeBar({ id: 1, title: "Banana", enabled: false, countdown_enabled: true, countdown_end_at: future }),
    makeBar({ id: 2, title: "apple", enabled: true, countdown_enabled: true, countdown_end_at: sooner }),
    makeBar({ id: 3, title: "Cherry", enabled: false }), // no countdown → sorts last by countdown
  ];

  it("title asc / desc (case-insensitive via localeCompare)", () => {
    expect(titlesOf(filterSortBars(bars, { query: "", status: [], sort: "title asc" }))).toEqual(["apple", "Banana", "Cherry"]);
    expect(titlesOf(filterSortBars(bars, { query: "", status: [], sort: "title desc" }))).toEqual(["Cherry", "Banana", "apple"]);
  });

  it("status: active first vs draft first", () => {
    expect(filterSortBars(bars, { query: "", status: [], sort: "status asc" })[0].title).toBe("apple"); // the enabled one
    expect(filterSortBars(bars, { query: "", status: [], sort: "status desc" })[0].enabled).toBe(false);
  });

  it("countdown soonest first; bars without a countdown sort last", () => {
    const asc = filterSortBars(bars, { query: "", status: [], sort: "countdown asc" });
    expect(titlesOf(asc)).toEqual(["apple", "Banana", "Cherry"]); // sooner, later, none
  });

  it("does not mutate the input array", () => {
    const input = [makeBar({ title: "Z" }), makeBar({ title: "A" })];
    const snapshot = titlesOf(input);
    filterSortBars(input, { query: "", status: [], sort: "title asc" });
    expect(titlesOf(input)).toEqual(snapshot);
  });
});

describe("endValue", () => {
  it("is Infinity when there is no live countdown", () => {
    expect(endValue(makeBar({ countdown_enabled: false }))).toBe(Infinity);
    expect(endValue(makeBar({ countdown_enabled: true, countdown_end_at: null }))).toBe(Infinity);
  });
  it("is the deadline epoch when set", () => {
    const iso = "2030-01-01T00:00:00.000Z";
    expect(endValue(makeBar({ countdown_enabled: true, countdown_end_at: iso }))).toBe(Date.parse(iso));
  });
});

describe("paginate", () => {
  const list = Array.from({ length: 23 }, (_, i) => i + 1);

  it("returns the requested page slice", () => {
    expect(paginate(list, 1, 10).items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paginate(list, 2, 10).items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(paginate(list, 3, 10).items).toEqual([21, 22, 23]);
  });

  it("computes totalPages", () => {
    expect(paginate(list, 1, 10).totalPages).toBe(3);
    expect(paginate([], 1, 10).totalPages).toBe(1);
  });

  it("clamps a page past the end down to the last page", () => {
    const r = paginate(list, 99, 10);
    expect(r.currentPage).toBe(3);
    expect(r.items).toEqual([21, 22, 23]);
  });

  it("clamps a page below 1 up to page 1", () => {
    expect(paginate(list, 0, 10).currentPage).toBe(1);
  });

  it("empty list yields one empty page", () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], totalPages: 1, currentPage: 1 });
  });
});
