import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function suppressProxyErrors() {
  return {
    name: "suppress-proxy-errors",
    configureServer(server) {
      const originalLog = console.error;
      console.error = (...args) => {
        const msg = args.join(" ");
        if (msg.includes("http proxy error") && msg.includes("ECONNREFUSED"))
          return;
        originalLog.apply(console, args);
      };
      const origWarn = console.warn;
      console.warn = (...args) => {
        const msg = args.join(" ");
        if (msg.includes("http proxy error") && msg.includes("ECONNREFUSED"))
          return;
        origWarn.apply(console, args);
      };
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:5001";

  return {
    plugins: [
      suppressProxyErrors(),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          id: "/admin",
          name: "Trstprep Admin Dashboard",
          short_name: "Trstprep Admin",
          description: "Trstprep Content Management and Administration Portal",
          theme_color: "#0f172a",
          background_color: "#0f172a",
          display: "standalone",
          orientation: "any",
          scope: "/",
          start_url: "/",
          lang: "en-IN",
          dir: "ltr",
          categories: ["productivity", "utilities"],
          prefer_related_applications: false,
          shortcuts: [
            {
              name: "Terminal Logs",
              short_name: "TLogs",
              description: "Live backend terminal — 10k logs, fullscreen",
              url: "/admin/logs",
              icons: [
                {
                  src: "/icons/icon-192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
              ],
            },
            {
              name: "System Health",
              short_name: "Health",
              description: "Real-time system health monitor",
              url: "/admin/system-health",
              icons: [
                {
                  src: "/icons/icon-192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
              ],
            },
          ],
          icons: [
            {
              src: "/favicon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-192-maskable.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/socket\.io\//,
            /^\/uploads\//,
            /^\/assets\//,
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "gstatic-fonts-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    optimizeDeps: {
      include: ["@trstprep/shared-config", "@trstprep/shared-hooks"],
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@trstprep/shared-hooks": path.resolve(
          __dirname,
          "../../packages/shared-hooks",
        ),
        "@trstprep/shared-config": path.resolve(
          __dirname,
          "../../packages/shared-config",
        ),
        dompurify: path.resolve(__dirname, "node_modules/dompurify"),
        "react-hot-toast": path.resolve(
          __dirname,
          "node_modules/react-hot-toast",
        ),
        "@": path.resolve(__dirname, "./src"),
        "@features": path.resolve(__dirname, "./src/features"),
        "@shared": path.resolve(__dirname, "./src/shared"),
        "@components": path.resolve(__dirname, "./src/shared/components"),
        "@api": path.resolve(__dirname, "./src/shared/api"),
      },
    },
    server: {
      port: 3002,
      strictPort: false,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (err) => {
              if (err.code === "ECONNREFUSED") return;
              console.error("[proxy error]", err);
            });
          },
        },
        "/socket.io": {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", () => {});
            proxy.on("proxyReqWs", () => {});
          },
        },
        "/assets": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (err) => {
              if (err.code === "ECONNREFUSED") return;
              console.error("[proxy error]", err);
            });
          },
        },
        "/uploads": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (err) => {
              if (err.code === "ECONNREFUSED") return;
              console.error("[proxy error]", err);
            });
          },
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      // Drop console statements in production to reduce bundle size and avoid info leakage
      esbuildOptions: mode === "production" ? { dropConsole: true } : undefined,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"],
            icons: ["lucide-react", "@heroicons/react"],
            utils: ["axios", "react-hot-toast"],
            katex: ["katex"],
          },
        },
      },
    },
  };
});
