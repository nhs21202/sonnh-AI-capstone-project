import { describe, it, expect } from "vitest";
import { hexToHsba, hsbaToHex } from "./color";

describe("hex <-> HSBA", () => {
  it("round-trips opaque hex colors (normalizing to uppercase)", () => {
    for (const hex of ["#1A1A1A", "#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF", "#3DDC84"]) {
      expect(hsbaToHex(hexToHsba(hex))).toBe(hex);
    }
  });

  it("treats lowercase input the same and returns uppercase", () => {
    expect(hsbaToHex(hexToHsba("#ffffff"))).toBe("#FFFFFF");
    expect(hsbaToHex(hexToHsba("#1a1a1a"))).toBe("#1A1A1A");
  });

  it("preserves the alpha channel (#RRGGBBAA)", () => {
    expect(hsbaToHex(hexToHsba("#1A1A1A80"))).toBe("#1A1A1A80");
    expect(hexToHsba("#FFFFFF00").alpha).toBe(0);
  });

  it("defaults alpha to 1 for 6-digit hex", () => {
    expect(hexToHsba("#1A1A1A").alpha).toBe(1);
  });

  it("white is full brightness, zero saturation; black is zero brightness", () => {
    expect(hexToHsba("#FFFFFF")).toMatchObject({ saturation: 0, brightness: 1 });
    expect(hexToHsba("#000000").brightness).toBe(0);
  });

  it("derives the right hue for primaries", () => {
    expect(Math.round(hexToHsba("#FF0000").hue)).toBe(0);
    expect(Math.round(hexToHsba("#00FF00").hue)).toBe(120);
    expect(Math.round(hexToHsba("#0000FF").hue)).toBe(240);
  });
});
