import { fetchActiveBar } from "./api";
import { renderBar } from "./render";

declare global {
  interface Window {
    Shopify?: { shop?: string };
    announcementBarEnabled?: boolean;
  }
}

// On the storefront: read the shop, fetch the single active bar, render it (or nothing).
async function init(): Promise<void> {
  const shop = window.Shopify?.shop;
  if (!shop) return;
  const bar = await fetchActiveBar(shop);
  if (bar) renderBar(bar);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void init());
} else {
  void init();
}

export {};
