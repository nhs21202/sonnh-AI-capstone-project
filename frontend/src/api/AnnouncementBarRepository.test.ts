import { describe, it, expect, vi, beforeEach } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

// Mock the shared axios client so we can assert the exact request the repository builds.
vi.mock("./ApiClient", () => ({
  apiClient: { get: getMock, post: vi.fn(), put: vi.fn(), delete: vi.fn(), interceptors: { request: { use: vi.fn() } } },
  currentShop: () => "demo.myshopify.com",
}));

import { barsRepo } from "./AnnouncementBarRepository";

const base = "/api/v1/announcement-bars/demo.myshopify.com";

function envelope(items: unknown[], meta: Record<string, unknown>) {
  return { data: { error: false, msg: "success", data: items, meta } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AnnouncementBarRepository.list — server-side query", () => {
  it("forwards q / status / sort / page as query params (snake_case page_size)", async () => {
    getMock.mockResolvedValue(envelope([], { total: 0, page: 2, page_size: 10, total_pages: 0, active_count: 0 }));
    await barsRepo.list({ q: "sale", status: ["active"], sort: "title desc", page: 2, pageSize: 10 });
    expect(getMock).toHaveBeenCalledWith(base, {
      params: { q: "sale", status: "active", sort: "title desc", page: 2, page_size: 10 },
    });
  });

  it("omits status when both choices are selected (= all)", async () => {
    getMock.mockResolvedValue(envelope([], { total: 0, page: 1, page_size: 10, total_pages: 0, active_count: 0 }));
    await barsRepo.list({ status: ["active", "draft"], page: 1, pageSize: 10 });
    expect(getMock.mock.calls[0][1].params).not.toHaveProperty("status");
  });

  it("maps the meta envelope into a typed result", async () => {
    getMock.mockResolvedValue(envelope([{ id: 1 }], { total: 23, page: 3, page_size: 10, total_pages: 3 }));
    const res = await barsRepo.list({ page: 3 });
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(23);
    expect(res.totalPages).toBe(3);
    expect(res.page).toBe(3);
  });
});
