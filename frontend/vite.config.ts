import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for the embedded admin. The API base URL is injected via VITE_API_BASE_URL.
export default defineConfig({
  plugins: [react()],
});
