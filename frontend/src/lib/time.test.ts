import { describe, it, expect } from "vitest";
import { storeLocalToUTC, utcToStoreLocal } from "./time";

describe("store timezone <-> UTC", () => {
  it("converts a store-local deadline to UTC and back (America/New_York, summer = EDT UTC-4)", () => {
    const tz = "America/New_York";
    const local = "2026-07-05T23:59";
    const utc = storeLocalToUTC(local, tz);
    expect(utc).toBe("2026-07-06T03:59:00.000Z"); // 23:59 EDT == 03:59 UTC next day
    expect(utcToStoreLocal(utc, tz)).toBe(local);
  });

  it("applies the DST offset by date (same NY wall-clock is UTC-5 in winter, UTC-4 in summer)", () => {
    const tz = "America/New_York";
    const winter = "2026-01-15T12:00"; // EST = UTC-5
    const summer = "2026-07-15T12:00"; // EDT = UTC-4
    expect(storeLocalToUTC(winter, tz)).toBe("2026-01-15T17:00:00.000Z");
    expect(storeLocalToUTC(summer, tz)).toBe("2026-07-15T16:00:00.000Z");
    expect(utcToStoreLocal("2026-01-15T17:00:00.000Z", tz)).toBe(winter);
  });

  it("round-trips a fixed-offset timezone with no DST (Asia/Ho_Chi_Minh = UTC+7)", () => {
    const tz = "Asia/Ho_Chi_Minh";
    const local = "2026-07-05T23:59";
    const utc = storeLocalToUTC(local, tz);
    expect(utc).toBe("2026-07-05T16:59:00.000Z"); // 23:59 +07 == 16:59 UTC
    expect(utcToStoreLocal(utc, tz)).toBe(local);
  });

  it("throws on empty/invalid local input (contract: callers must guard, which the editor does)", () => {
    expect(() => storeLocalToUTC("", "UTC")).toThrow();
    expect(() => storeLocalToUTC("not-a-date", "UTC")).toThrow();
  });
});
