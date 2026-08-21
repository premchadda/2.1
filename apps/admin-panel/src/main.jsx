import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./shared/providers/AuthContext.jsx";
import { ThemeProvider } from "./shared/context/ThemeContext.jsx";
import { setSharedApiClient } from "@trstprep/shared-hooks";
import { adminAPI } from "./shared/lib/dataService.js";
import App from "./App.jsx";
import "./styles/tokens.css";
import "./styles/index.css";
import { setQueryClient } from "./shared/lib/queryClientRegistry.js";

// Register the admin API client INSTANCE globally for shared hooks.
// NOTE: pass the axios instance (adminAPI.apiClient), not the adminAPI wrapper
// object — the wrapper has no .get/.post, which would force shared hooks into a
// cookie-less cross-origin fetch to localhost:5001 and cause spurious 401/logout.
setSharedApiClient(adminAPI.apiClient);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

// Register globally for WebSocket event handlers
setQueryClient(queryClient);

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
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AuthProvider>
            <ThemeProvider>
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
                  success: {
                    iconTheme: {
                      primary: "#10b981",
                      secondary: "#fff",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#ef4444",
                      secondary: "#fff",
                    },
                  },
                }}
              />
              <App />
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
        {ReactQueryDevtools && (
          <ReactQueryDevtools
            initialIsOpen={false}
            position="bottom-left"
            buttonPosition="bottom-left"
          />
        )}
      </QueryClientProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Main />);

export default Main;
