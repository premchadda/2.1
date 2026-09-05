import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSIENT_PROXY_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ECONNABORTED",
]);

const isTransientProxyError = (err) => {
  if (!err) return false;
  if (TRANSIENT_PROXY_ERROR_CODES.has(err.code)) return true;
  const message = String(err.message || err);
  return [...TRANSIENT_PROXY_ERROR_CODES].some((code) =>
    message.includes(code),
  );
};

const isTransientProxyLog = (args) => {
  const message = args
    .map((arg) => {
      if (arg instanceof Error) return `${arg.code || ""} ${arg.message || ""}`;
      if (arg && typeof arg === "object")
        return `${arg.code || ""} ${arg.message || ""}`;
      return String(arg);
    })
    .join(" ");

  return (
    (message.includes("http proxy error") ||
      message.includes("ws proxy error") ||
      message.includes("[proxy error]")) &&
    [...TRANSIENT_PROXY_ERROR_CODES].some((code) => message.includes(code))
  );
};

const writeProxyFallbackResponse = (res) => {
  if (
    !res ||
    typeof res.writeHead !== "function" ||
    res.headersSent ||
    res.writableEnded
  ) {
    return false;
  }

  res.writeHead(503, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(
    JSON.stringify({
      success: false,
      message: "Backend temporarily unavailable. Retrying shortly.",
    }),
  );
  return true;
};

const configureResilientProxy = (proxy) => {
  proxy.on("error", (err, _req, res) => {
    if (isTransientProxyError(err)) {
      if (
        !writeProxyFallbackResponse(res) &&
        res &&
        typeof res.destroy === "function"
      ) {
        res.destroy();
      }
      return;
    }

    console.error("[proxy error]", err);
  });
};

function suppressProxyErrors() {
  return {
    name: "suppress-proxy-errors",
    configureServer(_server) {
      if (console.__trstprepProxyErrorsSuppressed) return;
      console.__trstprepProxyErrorsSuppressed = true;

      const originalLog = console.error;
      console.error = (...args) => {
        if (isTransientProxyLog(args)) return;
        originalLog.apply(console, args);
      };
      const origWarn = console.warn;
      console.warn = (...args) => {
        if (isTransientProxyLog(args)) return;
        origWarn.apply(console, args);
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:5001";

  return {
    clearScreen: false,
    esbuild:
      mode === "production" ? { drop: ["console", "debugger"] } : undefined,
    plugins: [
      suppressProxyErrors(),
      react(),
      ...(mode === "analyze"
        ? [visualizer({ open: true, filename: "stats.html", gzipSize: true })]
        : []),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          id: "/",
          name: "Trstprep - Exam Prep Platform",
          short_name: "Trstprep",
          description:
            "India's platform for SSC, Railway & Banking exam preparation. Mock tests, practice labs, and study materials.",
          theme_color: "#6366f1",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          lang: "en-IN",
          dir: "ltr",
          categories: ["education", "productivity"],
          prefer_related_applications: false,
          shortcuts: [
            {
              name: "Test Series",
              short_name: "Tests",
              description: "Explore full & sectional test series",
              url: "/test-series",
              icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
            },
            {
              name: "Live Tests",
              short_name: "Live",
              description: "Attempt live all-India mock tests",
              url: "/live-tests",
              icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
            },
            {
              name: "Practice Lab",
              short_name: "Practice",
              description: "Topic-wise practice questions",
              url: "/practice",
              icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
            },
            {
              name: "Current Affairs",
              short_name: "GK",
              description: "Daily news & current affairs",
              url: "/current-affairs",
              icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
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
          cleanupOutdatedCaches: true,
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/socket\.io\//,
            /^\/uploads\//,
            /^\/assets\//,
          ],
          runtimeCaching: [
            // 1. Google Fonts Caching (CacheFirst)
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache-v2",
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
                cacheName: "gstatic-fonts-cache-v2",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            // 2. CRITICAL: NetworkOnly for sensitive & transactional endpoints (auth, attempts, payments, telemetry, admin)
            {
              urlPattern:
                /\/api\/(auth|payments|telemetry|admin|test-attempts\/submit|test-attempts\/save-answer|test-attempts\/start).*/i,
              handler: "NetworkOnly",
            },
            // 3. User State & Dashboard (NetworkFirst with fast network timeout)
            {
              urlPattern:
                /\/api\/(users\/profile|users\/dashboard|notifications|attempted-tests).*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-user-state-v2",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 2 },
              },
            },
            // 4. Public Catalog & Study Material (StaleWhileRevalidate)
            {
              urlPattern:
                /\/api\/(test-series|exam-categories|subscription-plans|current-affairs|study-materials).*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "api-public-catalog-v2",
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
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
      include: [
        "@trstprep/shared-config",
        "@trstprep/shared-hooks",
        "react",
        "react-dom",
        "react-router-dom",
        "katex",
      ],
    },
    resolve: {
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
      },
      dedupe: ["react", "react-dom", "react-router-dom", "react-router"],
      extensions: [".js", ".jsx", ".json"],
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          configure: configureResilientProxy,
          selfHandleResponse: false,
        },
        "/socket.io": {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
          configure: configureResilientProxy,
        },
        "/assets/avatar": {
          target: backendUrl,
          changeOrigin: true,
          configure: configureResilientProxy,
          selfHandleResponse: false,
        },
        "/uploads": {
          target: backendUrl,
          changeOrigin: true,
          configure: configureResilientProxy,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: mode !== "production",
      cssCodeSplit: true,
      cssMinify: "esbuild",
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "axios", "react-hot-toast"],
            router: ["react-router-dom"],
            charts: ["chart.js", "react-chartjs-2"],
            recharts: ["recharts"],
            katex: ["katex"],
            query: ["@tanstack/react-query"],
            ui: ["lucide-react"],
          },
        },
      },
    },
  };
});
