import type { Bar } from "../types";

let seq = 1;

// A valid Bar with overridable fields, for tests.
export function makeBar(over: Partial<Bar> = {}): Bar {
  const id = over.id ?? seq++;
  return {
    id,
    shop: "demo.myshopify.com",
    title: `Bar ${id}`,
    enabled: false,
    message: "Hello",
    background_color: "#1A1A1A",
    text_color: "#FFFFFF",
    countdown_enabled: false,
    countdown_end_at: null,
    countdown_bg_color: "#000000",
    countdown_text_color: "#FFFFFF",
    countdown_format: "dd:hh:mm:ss",
    ...over,
  };
}
