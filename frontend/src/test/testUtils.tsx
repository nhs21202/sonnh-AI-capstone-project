import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import barsReducer from "../store/announcementBarSlice";

// A fresh Redux store per test (isolated state).
export function makeStore() {
  return configureStore({ reducer: { bars: barsReducer } });
}

// Render `ui` inside Polaris's AppProvider (required or Polaris throws) and, when a store is
// passed, the Redux Provider. Used by component/integration tests.
export function renderWithProviders(
  ui: ReactElement,
  { store }: { store?: ReturnType<typeof makeStore> } = {},
) {
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const content = <AppProvider i18n={enTranslations}>{children}</AppProvider>;
    return store ? <Provider store={store}>{content}</Provider> : content;
  };
  return render(ui, { wrapper: Wrapper });
}
