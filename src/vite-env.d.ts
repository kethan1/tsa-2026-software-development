/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gemini API key, exposed to the browser so the Speech tab can call the API directly. */
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
