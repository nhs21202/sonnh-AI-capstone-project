import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { barsRepo } from "../api/AnnouncementBarRepository";
import type { Bar } from "../types";

export const fetchBars = createAsyncThunk("bars/fetch", () => barsRepo.list());

interface BarsState {
  items: Bar[];
  loading: boolean;
  error: string | null;
}

const initialState: BarsState = { items: [], loading: false, error: null };

const slice = createSlice({
  name: "bars",
  initialState,
  reducers: {
    // Optimistic flip for the list toggle: update the UI instantly, then the server call + refetch
    // reconcile. Enabling one bar drops the others to drafts here too (mirrors the one-active rule).
    applyToggle(state, action: PayloadAction<{ id: number; enabled: boolean }>) {
      const { id, enabled } = action.payload;
      state.items = state.items.map((b) =>
        b.id === id ? { ...b, enabled } : enabled ? { ...b, enabled: false } : b,
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBars.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchBars.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload;
      })
      .addCase(fetchBars.rejected, (s, a) => {
        s.loading = false;
        s.error = a.error.message ?? "Failed to load bars";
      });
  },
});

export const { applyToggle } = slice.actions;
export default slice.reducer;
