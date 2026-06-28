import { describe, it, expect } from "vitest";
import { remaining, formatRemaining, isExpired } from "./countdown";

describe("remaining", () => {
  it("breaks ms into d/h/m/s and clamps negatives to zero", () => {
    const ms = ((2 * 24 + 14) * 3600 + 3 * 60 + 9) * 1000; // 2d 14h 03m 09s
    expect(remaining(ms)).toEqual({ d: 2, h: 14, m: 3, s: 9 });
    expect(remaining(-5000)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });
});

describe("formatRemaining", () => {
  const ms = ((2 * 24 + 14) * 3600 + 3 * 60 + 9) * 1000;
  it("dd:hh:mm:ss", () => expect(formatRemaining(ms, "dd:hh:mm:ss")).toBe("02:14:03:09"));
  it("hh:mm:ss folds days into hours", () => expect(formatRemaining(ms, "hh:mm:ss")).toBe("62:03:09"));
  it("with_labels", () => expect(formatRemaining(ms, "with_labels")).toBe("2d 14h 03m 09s"));
});

describe("isExpired", () => {
  it("true at/after the deadline, false before", () => {
    const now = 1_000_000;
    expect(isExpired(now - 1000, now)).toBe(true);
    expect(isExpired(now, now)).toBe(true);
    expect(isExpired(now + 1000, now)).toBe(false);
  });
});
