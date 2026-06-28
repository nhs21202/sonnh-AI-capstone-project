import { describe, it, expect } from "vitest";
import { storeLocalToUTC, utcToStoreLocal } from "./time";

describe("store timezone <-> UTC", () => {
  it("converts a store-local deadline to UTC and back (every visitor sees the same instant)", () => {
    const tz = "America/New_York"; // EDT = UTC-4 in July
    const local = "2026-07-05T23:59";
    const utc = storeLocalToUTC(local, tz);
    expect(utc).toBe("2026-07-06T03:59:00.000Z"); // 23:59 EDT == 03:59 UTC next day
    expect(utcToStoreLocal(utc, tz)).toBe(local);
  });
});
