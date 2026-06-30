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

// Server-side list query. `status` mirrors the UI ChoiceList (any of "active"|"draft"); only a
// single selection is sent to the server — both or none means "all".
export interface BarListParams {
  q?: string;
  status?: string[];
  sort?: string; // "<field> <dir>", field ∈ title | status | countdown
  page?: number;
  pageSize?: number;
}

// One page of bars plus the server's pagination meta.
export interface BarListResult {
  items: Bar[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

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
