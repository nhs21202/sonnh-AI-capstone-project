import { BaseRepository } from "./BaseRepository";
import type { Bar, BarInput, BarListParams, BarListResult } from "../types";

export class AnnouncementBarRepository extends BaseRepository {
  // Server-side search/filter/sort/pagination. `status` is sent only when exactly one of
  // active/draft is chosen — both or none means "all", so the param is omitted.
  async list(params: BarListParams = {}): Promise<BarListResult> {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 10,
    };
    const q = params.q?.trim();
    if (q) query.q = q;
    if (params.status?.length === 1) query.status = params.status[0];
    if (params.sort) query.sort = params.sort;

    const { data } = await this.client.get(this.base(), { params: query });
    const items: Bar[] = data.data ?? [];
    const meta = data.meta ?? {};
    return {
      items,
      total: meta.total ?? items.length,
      page: meta.page ?? 1,
      pageSize: meta.page_size ?? (params.pageSize ?? 10),
      totalPages: meta.total_pages ?? 1,
    };
  }
  async create(input: BarInput): Promise<Bar> {
    const { data } = await this.client.post(this.base(), input);
    return data.data;
  }
  async update(id: number, input: BarInput): Promise<Bar> {
    const { data } = await this.client.put(`${this.base()}/${id}`, input);
    return data.data;
  }
  async remove(id: number): Promise<void> {
    await this.client.delete(`${this.base()}/${id}`);
  }
}

export const barsRepo = new AnnouncementBarRepository();
