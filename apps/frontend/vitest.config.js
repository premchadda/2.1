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
    server: {
      deps: {
        inline: [/@trstprep\//],
      },
    },
  },
});
