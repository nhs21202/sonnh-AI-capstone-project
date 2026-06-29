export type CountdownFormat = "dd:hh:mm:ss" | "hh:mm:ss" | "with_labels";

export interface Bar {
  id: number;
  shop: string;
  title: string;
  enabled: boolean;
  message: string;
  background_color: string;
  text_color: string;
  countdown_enabled: boolean;
  countdown_end_at: string | null;
  countdown_bg_color: string;
  countdown_text_color: string;
  countdown_format: CountdownFormat;
}

// Fields the admin form sends (the server owns id/shop/timestamps).
export type BarInput = Omit<Bar, "id" | "shop">;

export const defaultBarInput = (): BarInput => ({
  title: "",
  enabled: false,
  message: "Your message here!",
  background_color: "#1A1A1A",
  text_color: "#FFFFFF",
  countdown_enabled: false,
  countdown_end_at: null,
  countdown_bg_color: "#000000",
  countdown_text_color: "#FFFFFF",
  countdown_format: "dd:hh:mm:ss",
});
