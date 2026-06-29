import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("exposes a switch whose aria-checked reflects `checked`", () => {
    const { rerender } = render(<Toggle checked={false} onChange={() => {}} label="Power" />);
    expect(screen.getByRole("switch", { name: "Power" })).toHaveAttribute("aria-checked", "false");
    rerender(<Toggle checked onChange={() => {}} label="Power" />);
    expect(screen.getByRole("switch", { name: "Power" })).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the negated value on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Power" />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles via keyboard (Enter and Space)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} label="Power" />);
    screen.getByRole("switch").focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("does not fire onChange when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Power" disabled />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
