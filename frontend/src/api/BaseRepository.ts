import { apiClient, currentShop } from "./ApiClient";

// BaseRepository centralizes the client and the shop-scoped URL prefix.
export class BaseRepository {
  protected client = apiClient;
  protected base(): string {
    return `/api/v1/announcement-bars/${currentShop()}`;
  }
}
