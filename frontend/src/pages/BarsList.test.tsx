import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeStore } from "../test/testUtils";
import { makeBar } from "../test/factories";
import type { Bar, BarListResult } from "../types";

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

// Build a server-style page result; callers override total/totalPages as needed.
function result(items: Bar[], over: Partial<BarListResult> = {}): BarListResult {
  return { items, total: items.length, page: 1, pageSize: 10, totalPages: 1, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
});

function renderList() {
  return renderWithProviders(<BarsList onAdd={vi.fn()} onEdit={vi.fn()} />, { store: makeStore() });
}

describe("BarsList — server-driven list", () => {
  it("renders the page of bars returned by the server", async () => {
    listMock.mockResolvedValue(result([makeBar({ id: 1, enabled: true }), makeBar({ id: 2 })], { total: 2 }));
    renderList();
    await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(2));
  });

  it("clicking Next fetches the next page from the server (page param)", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue(
      result(Array.from({ length: 10 }, (_, i) => makeBar({ id: i + 1 })), { total: 12, totalPages: 2 }),
    );
    renderList();
    await waitFor(() => expect(screen.getByText("Page 1 of 2")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  });
});

describe("BarsList — optimistic toggle", () => {
  it("activating a draft flips it instantly, calls update, and toasts", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue(result([makeBar({ id: 1, enabled: false }), makeBar({ id: 2, enabled: false })], { total: 2 }));
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
  it("deleting a row removes it server-side, refetches, and toasts", async () => {
    const user = userEvent.setup();
    listMock
      .mockResolvedValueOnce(result([makeBar({ id: 1 }), makeBar({ id: 2 })], { total: 2 }))
      .mockResolvedValue(result([makeBar({ id: 2 })], { total: 1 }));
    removeMock.mockResolvedValue(undefined);
    renderList();
    await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(2));
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(() => expect(removeMock).toHaveBeenCalledTimes(1));
    expect(toastShow).toHaveBeenCalledWith("Bar deleted");
    await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(1));
  });
});

describe("BarsList — empty state", () => {
  it("shows the Polaris empty state when there are no bars and no filters", async () => {
    listMock.mockResolvedValue(result([], { total: 0 }));
    renderList();
    await waitFor(() => expect(screen.getByText("Create your first announcement bar")).toBeInTheDocument());
  });
});
