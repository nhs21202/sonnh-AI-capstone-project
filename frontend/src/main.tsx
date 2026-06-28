import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { App } from "./App";
import { store } from "./store/store";

// Note: App Bridge React provider (apiKey + host) is enabled by the embedded host; the API client
// reads the session token from window.shopify at request time.
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <Provider store={store}>
        <AppProvider i18n={enTranslations}>
          <App />
        </AppProvider>
      </Provider>
    </React.StrictMode>,
  );
}
