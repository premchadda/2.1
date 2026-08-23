import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./shared/providers/AuthContext";
import { ThemeProvider } from "./shared/context/ThemeContext.jsx";
import { setSharedApiClient } from "@trstprep/shared-hooks";
import { apiClient } from "./shared/lib/dataService.js";
import "./styles/tokens.css";
import "./styles/index.css";
// KaTeX CSS loaded dynamically in MathRenderer only when needed (was global 100KB for all routes)

// Register the frontend API client instance globally for shared hooks
setSharedApiClient(apiClient);

// HIGH-06 FIX: Validate required environment variables at startup
import { validateEnvVars } from "./shared/lib/env-validation.js";
validateEnvVars();

// NOTE: Previous Node.prototype.removeChild/insertBefore monkey-patch has been removed.
// It was a workaround for browser extensions (Google Translate, Grammarly, AutoFill)
// mutating the DOM and causing `NotFoundError: Failed to execute 'removeChild' on 'Node'`
// in React 17. React 18's concurrent reconciler no longer throws fatally on
// external DOM mutations — it recovers via re-render — so the patch is unnecessary
// and is intentionally not reintroduced to avoid masking real DOM bugs and to keep
// the prototype clean. If a future extension again breaks rendering, prefer a
// scoped error boundary over a global prototype override.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      // React Query v5 renamed `cacheTime` to `gcTime`. The old name is
      // silently ignored — default 5-minute GC was in effect instead of
      // the intended 30 minutes.
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

import ErrorBoundary from "./shared/components/common/ErrorBoundary.jsx";

function Main() {
  // Dynamically load ReactQueryDevtools only in development
  const [ReactQueryDevtools, setReactQueryDevtools] = useState(null);

  useEffect(() => {
    if (import.meta.env.DEV) {
      import("@tanstack/react-query-devtools").then((mod) => {
        setReactQueryDevtools(() => mod.ReactQueryDevtools);
      });
    }
  }, []);

  return (
    <React.StrictMode>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <ErrorBoundary>
              <AuthProvider>
                <ThemeProvider>
                  <App />
                  <Toaster
                    position="top-right"
                    containerStyle={{ zIndex: 9999999 }}
                    containerClassName="!z-[9999999]"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: "#1f2937",
                        color: "#fff",
                        border: "1px solid #374151",
                      },
                    }}
                  />
                </ThemeProvider>
              </AuthProvider>
            </ErrorBoundary>
          </BrowserRouter>
          {ReactQueryDevtools && (
            <ReactQueryDevtools
              initialIsOpen={false}
              position="bottom-left"
              buttonPosition="bottom-left"
            />
          )}
        </QueryClientProvider>
      </HelmetProvider>
    </React.StrictMode>
  );
}

// Standard React 18 root creation — no custom `_reactRoot` property on DOM
// element (was a non-standard pattern that could conflict with testing
// libraries and HMR).
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<Main />);

export default Main;
