import { describe, it, expect } from "vitest";
import { computeErrors, MAX_TITLE, MAX_MESSAGE } from "./barValidation";
import { defaultBarInput, type BarInput } from "../types";

const base = (over: Partial<BarInput> = {}): BarInput => ({
  ...defaultBarInput(),
  title: "Sale",
  message: "Hi",
  ...over,
});

describe("computeErrors", () => {
  it("accepts a valid bar", () => {
    expect(computeErrors(base(), "")).toEqual({});
  });

  it("requires a title", () => {
    expect(computeErrors(base({ title: "   " }), "").title).toBeTruthy();
  });

  it("rejects a title longer than the max", () => {
    expect(computeErrors(base({ title: "a".repeat(MAX_TITLE + 1) }), "").title).toBeTruthy();
  });

  it("accepts a title of exactly the max length", () => {
    expect(computeErrors(base({ title: "a".repeat(MAX_TITLE) }), "").title).toBeUndefined();
  });

  it("rejects a message longer than the max, even when the bar is disabled", () => {
    const e = computeErrors(base({ enabled: false, message: "m".repeat(MAX_MESSAGE + 1) }), "");
    expect(e.message).toBeTruthy();
  });

  it("accepts a message of exactly the max length", () => {
    const e = computeErrors(base({ message: "m".repeat(MAX_MESSAGE) }), "");
    expect(e.message).toBeUndefined();
  });

  it("requires a message always, even when the bar is disabled", () => {
    expect(computeErrors(base({ enabled: false, message: "" }), "").message).toBeTruthy();
  });

  it("rejects an invalid hex color", () => {
    expect(computeErrors(base({ background_color: "red" }), "").background_color).toBeTruthy();
  });

  it("requires a future deadline when the countdown is on", () => {
    const e = computeErrors(base({ countdown_enabled: true }), "2000-01-01T00:00", "UTC", Date.parse("2020-01-01T00:00:00Z"));
    expect(e.deadline).toBeTruthy();
  });
});
