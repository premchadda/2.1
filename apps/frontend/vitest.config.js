/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "virtual:pwa-register/react": path.resolve(
        __dirname,
        "./src/test/mocks/pwa-register.js",
      ),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.js"],
    // Without this the API client falls back to same-origin relative URLs and
    // logs "baseURL is empty" once per suite. Tests never reach the network
    // (see setup.js adapter stub), so an explicit origin only silences it.
    env: {
      VITE_API_URL: "http://localhost:5001",
    },
    server: {
      deps: {
        inline: [/@trstprep\//],
      },
    },
  },
});
