import { describe, it, expect } from "vitest";
import { remaining, formatRemaining } from "./countdown";

const D = 86_400_000;
const sample = 1 * D + 2 * 3_600_000 + 3 * 60_000 + 4_000; // 1d 2h 3m 4s

describe("remaining", () => {
  it("breaks ms into d/h/m/s", () => {
    expect(remaining(sample)).toEqual({ d: 1, h: 2, m: 3, s: 4 });
  });
  it("clamps negative (expired) to zero", () => {
    expect(remaining(-5000)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });
  it("floors sub-second remainder", () => {
    expect(remaining(1999)).toEqual({ d: 0, h: 0, m: 0, s: 1 });
  });
});

describe("formatRemaining", () => {
  it("dd:hh:mm:ss zero-pads each unit", () => {
    expect(formatRemaining(sample, "dd:hh:mm:ss")).toBe("01:02:03:04");
  });
  it("hh:mm:ss rolls days into hours", () => {
    expect(formatRemaining(sample, "hh:mm:ss")).toBe("26:03:04"); // 1*24 + 2
  });
  it("with_labels uses d/h/m/s suffixes", () => {
    expect(formatRemaining(sample, "with_labels")).toBe("1d 02h 03m 04s");
  });
  it("renders all-zero at/after expiry for every format", () => {
    expect(formatRemaining(0, "dd:hh:mm:ss")).toBe("00:00:00:00");
    expect(formatRemaining(-1, "hh:mm:ss")).toBe("00:00:00");
    expect(formatRemaining(0, "with_labels")).toBe("0d 00h 00m 00s");
  });
});
