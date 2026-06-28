import { BaseRepository } from "./BaseRepository";
import type { Bar, BarInput } from "../types";

export class AnnouncementBarRepository extends BaseRepository {
  async list(): Promise<Bar[]> {
    const { data } = await this.client.get(this.base());
    return data.data ?? [];
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
