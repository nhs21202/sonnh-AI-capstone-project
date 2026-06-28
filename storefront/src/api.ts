import type { CountdownFormat } from "./countdown";

export interface PublicBar {
  message: string;
  background_color: string;
  text_color: string;
  countdown_enabled: boolean;
  countdown_end_at: string | null;
  countdown_bg_color: string;
  countdown_text_color: string;
  countdown_format: CountdownFormat;
}

// Injected at build time by webpack DefinePlugin from storefront/.env.
declare const process: { env: { REACT_APP_API_BASE_URL?: string } };

// fetchActiveBar reads the shop's single active bar from the public endpoint (or null).
export async function fetchActiveBar(shop: string): Promise<PublicBar | null> {
  const base = process.env.REACT_APP_API_BASE_URL ?? "";
  try {
    const res = await fetch(`${base}/web/public/bar?shop=${encodeURIComponent(shop)}`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    if (!res.ok) return null;
    const env = await res.json();
    return (env && env.data) || null;
  } catch {
    return null;
  }
}
