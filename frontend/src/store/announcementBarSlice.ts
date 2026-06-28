import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
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
  reducers: {},
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

export default slice.reducer;
