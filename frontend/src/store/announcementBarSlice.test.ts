import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import reducer, { applyToggle, fetchBars } from "./announcementBarSlice";
import { barsRepo } from "../api/AnnouncementBarRepository";
import { makeBar } from "../test/factories";

vi.mock("../api/AnnouncementBarRepository", () => ({
  barsRepo: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const mockedList = vi.mocked(barsRepo.list);

function makeStore() {
  return configureStore({ reducer: { bars: reducer } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyToggle reducer (optimistic one-active)", () => {
  const base = () => ({
    items: [makeBar({ id: 1, enabled: true }), makeBar({ id: 2, enabled: false }), makeBar({ id: 3, enabled: false })],
    loading: false,
    error: null as string | null,
  });

  it("enabling a bar disables all the others", () => {
    const s = reducer(base(), applyToggle({ id: 2, enabled: true }));
    expect(s.items.map((b) => b.enabled)).toEqual([false, true, false]);
  });

  it("disabling a bar leaves the others untouched", () => {
    const twoActive = {
      items: [makeBar({ id: 1, enabled: true }), makeBar({ id: 2, enabled: true })],
      loading: false,
      error: null as string | null,
    };
    const s = reducer(twoActive, applyToggle({ id: 1, enabled: false }));
    expect(s.items.find((b) => b.id === 1)!.enabled).toBe(false);
    expect(s.items.find((b) => b.id === 2)!.enabled).toBe(true);
  });

  it("disabling an unknown id is a no-op", () => {
    const s = reducer(base(), applyToggle({ id: 999, enabled: false }));
    expect(s.items.map((b) => b.enabled)).toEqual([true, false, false]);
  });
});

describe("fetchBars thunk", () => {
  it("fulfilled: populates items from the repo and clears loading", async () => {
    mockedList.mockResolvedValue([makeBar({ id: 1 }), makeBar({ id: 2 })]);
    const store = makeStore();
    await store.dispatch(fetchBars());
    const s = store.getState().bars;
    expect(s.items).toHaveLength(2);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("rejected: surfaces the error, clears loading, and leaves items unchanged", async () => {
    mockedList.mockRejectedValue(new Error("network boom"));
    const store = makeStore();
    await store.dispatch(fetchBars());
    const s = store.getState().bars;
    expect(s.loading).toBe(false);
    expect(s.error).toBe("network boom");
    expect(s.items).toEqual([]);
  });

  it("pending: sets loading and clears any prior error", () => {
    const s = reducer({ items: [], loading: false, error: "stale" }, { type: fetchBars.pending.type });
    expect(s.loading).toBe(true);
    expect(s.error).toBeNull();
  });
});
