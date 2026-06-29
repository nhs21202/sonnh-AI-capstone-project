import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeStore } from "../test/testUtils";
import { makeBar } from "../test/factories";

const { listMock, updateMock, removeMock, toastShow } = vi.hoisted(() => ({
  listMock: vi.fn(),
  updateMock: vi.fn(),
  removeMock: vi.fn(),
  toastShow: vi.fn(),
}));

vi.mock("../api/AnnouncementBarRepository", () => ({
  barsRepo: { list: listMock, create: vi.fn(), update: updateMock, remove: removeMock },
}));
vi.mock("@shopify/app-bridge-react", () => ({
  useAppBridge: () => ({
    toast: { show: toastShow },
    saveBar: { show: vi.fn(), hide: vi.fn(), leaveConfirmation: vi.fn() },
  }),
}));

import { BarsList } from "./BarsList";

beforeEach(() => {
  vi.clearAllMocks();
});

function renderList() {
  return renderWithProviders(<BarsList onAdd={vi.fn()} onEdit={vi.fn()} />, { store: makeStore() });
}

describe("BarsList — pagination (10 per page)", () => {
  it("shows 10 rows on page 1 and the rest on page 2", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue(Array.from({ length: 12 }, (_, i) => makeBar({ id: i + 1 })));
    renderList();
    await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(10));
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeInTheDocument());
    expect(screen.getAllByRole("switch")).toHaveLength(2);
  });
});

describe("BarsList — optimistic toggle", () => {
  it("activating a draft flips it instantly, calls update, and toasts", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue([makeBar({ id: 1, enabled: false }), makeBar({ id: 2, enabled: false })]);
    updateMock.mockResolvedValue(makeBar({ id: 1, enabled: true }));
    renderList();
    await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(2));
    const first = screen.getAllByRole("switch")[0];
    expect(first).toHaveAttribute("aria-checked", "false");
    await user.click(first);
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(toastShow).toHaveBeenCalledWith("Bar activated");
    expect(screen.getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "true");
  });
});

describe("BarsList — delete", () => {
  it("deleting the last row on page 2 steps back to page 1 and toasts", async () => {
    const user = userEvent.setup();
    const eleven = Array.from({ length: 11 }, (_, i) => makeBar({ id: i + 1 }));
    listMock.mockResolvedValueOnce(eleven).mockResolvedValue(eleven.slice(0, 10));
    removeMock.mockResolvedValue(undefined);
    renderList();
    await waitFor(() => expect(screen.getByText("Page 1 of 2")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeInTheDocument());
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(10));
    expect(screen.queryByText(/Page .* of/)).toBeNull(); // single page now → pagination hidden
    expect(toastShow).toHaveBeenCalledWith("Bar deleted");
  });
});

describe("BarsList — empty state", () => {
  it("shows the Polaris empty state when there are no bars", async () => {
    listMock.mockResolvedValue([]);
    renderList();
    await waitFor(() => expect(screen.getByText("Create your first announcement bar")).toBeInTheDocument());
  });
});
