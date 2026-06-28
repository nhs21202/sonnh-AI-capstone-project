import { configureStore } from "@reduxjs/toolkit";
import bars from "./announcementBarSlice";

export const store = configureStore({ reducer: { bars } });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
