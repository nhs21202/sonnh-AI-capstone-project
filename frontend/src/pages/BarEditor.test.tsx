import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/testUtils";
import { makeBar } from "../test/factories";

const { createMock, updateMock, toastShow, saveBarShow, saveBarHide, leaveConfirmation } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  toastShow: vi.fn(),
  saveBarShow: vi.fn(),
  saveBarHide: vi.fn(),
  leaveConfirmation: vi.fn(),
}));

vi.mock("../api/AnnouncementBarRepository", () => ({
  barsRepo: { create: createMock, update: updateMock, list: vi.fn(), remove: vi.fn() },
}));
vi.mock("@shopify/app-bridge-react", () => ({
  useAppBridge: () => ({
    saveBar: { show: saveBarShow, hide: saveBarHide, leaveConfirmation },
    toast: { show: toastShow },
  }),
  SaveBar: ({ children }: { children: ReactNode }) => <div data-testid="savebar">{children}</div>,
}));

import { BarEditor } from "./BarEditor";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BarEditor — invalid submit is blocked (form wiring, not just computeErrors)", () => {
  it("empty title: create is NOT called and an inline error shows", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BarEditor bar={null} onDone={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /create bar/i }));
    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByText("Title is required.")).toBeInTheDocument();
  });

  it("invalid hex color: create is NOT called and an inline error shows", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BarEditor bar={null} onDone={vi.fn()} />);
    await user.type(screen.getByLabelText(/title/i), "Sale");
    const bg = screen.getByRole("textbox", { name: /background color/i });
    await user.clear(bg);
    await user.type(bg, "red");
    await user.click(screen.getByRole("button", { name: /create bar/i }));
    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByText(/valid hex color/i)).toBeInTheDocument();
  });

  it("empty message (always required): create is NOT called and an inline error shows", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BarEditor bar={null} onDone={vi.fn()} />);
    await user.type(screen.getByLabelText(/title/i), "Sale");
    await user.clear(screen.getByLabelText(/message/i));
    await user.click(screen.getByRole("button", { name: /create bar/i }));
    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByText("Message is required.")).toBeInTheDocument();
  });

  it("countdown on reveals the deadline field; an empty deadline blocks submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BarEditor bar={null} onDone={vi.fn()} />);
    expect(screen.queryByLabelText(/countdown deadline/i)).toBeNull();
    await user.type(screen.getByLabelText(/title/i), "Sale");
    await user.click(screen.getByRole("switch", { name: /enable countdown/i }));
    expect(screen.getByLabelText(/countdown deadline/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create bar/i }));
    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByText(/deadline is required/i)).toBeInTheDocument();
  });
});

describe("BarEditor — valid submit", () => {
  it("Add: creates the bar once, with the right payload, then toasts + onDone", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue(makeBar());
    const onDone = vi.fn();
    renderWithProviders(<BarEditor bar={null} onDone={onDone} />);
    await user.type(screen.getByLabelText(/title/i), "Sale");
    await user.click(screen.getByRole("button", { name: /create bar/i }));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toMatchObject({
      title: "Sale",
      message: "Your message here!",
      enabled: false,
      countdown_end_at: null,
    });
    expect(toastShow).toHaveBeenCalledWith("Bar created");
    expect(onDone).toHaveBeenCalled();
  });

  it("Add with countdown: the payload's countdown_end_at is the store-local deadline as a UTC string", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue(makeBar());
    renderWithProviders(<BarEditor bar={null} onDone={vi.fn()} />);
    await user.type(screen.getByLabelText(/title/i), "Sale");
    await user.click(screen.getByRole("switch", { name: /enable countdown/i }));
    fireEvent.change(screen.getByLabelText(/countdown deadline/i), { target: { value: "2030-01-01T00:00" } });
    await user.click(screen.getByRole("button", { name: /create bar/i }));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0].countdown_end_at).toBe("2030-01-01T00:00:00.000Z");
  });

  it("Edit: saving updates the bar with its id and toasts", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(makeBar({ id: 5 }));
    renderWithProviders(<BarEditor bar={makeBar({ id: 5, title: "Old" })} onDone={vi.fn()} />);
    const title = screen.getByLabelText(/title/i);
    await user.clear(title);
    await user.type(title, "New");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0]).toBe(5);
    expect(updateMock.mock.calls[0][1]).toMatchObject({ title: "New" });
    expect(toastShow).toHaveBeenCalledWith("Bar saved");
  });
});
