import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vite config for the embedded admin. The API base URL is injected via VITE_API_BASE_URL.
// The `test` block configures Vitest: jsdom for component tests + a setup file.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
