import axios, { type AxiosInstance } from "axios";

// The shop comes from the embedded-app URL param (Shopify always passes it).
const shop =
  new URLSearchParams(window.location.search).get("shop") ||
  (window as unknown as { shopify?: { config?: { shop?: string } } }).shopify?.config?.shop ||
  "";

// App Bridge v4 exposes window.shopify.idToken() to mint a fresh session token per request.
async function sessionToken(): Promise<string | null> {
  const s = (window as unknown as { shopify?: { idToken?: () => Promise<string> } }).shopify;
  if (s && typeof s.idToken === "function") {
    try {
      return await s.idToken();
    } catch {
      return null;
    }
  }
  return null;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Attach the App Bridge session token to every admin request.
apiClient.interceptors.request.use(async (config) => {
  const token = await sessionToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function currentShop(): string {
  return shop;
}
