/// <reference types="vite/client" />

// Public, build-embedded env (loaded by Vite from frontend/.env). No secrets here.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SHOPIFY_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
