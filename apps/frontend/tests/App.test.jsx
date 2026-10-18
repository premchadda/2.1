import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../src/App";
import { ROUTER_FUTURE_FLAGS } from "../src/test/routerFutureFlags";

vi.mock("../src/shared/providers/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
  AuthProvider: ({ children }) => children,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "../src/shared/context/ThemeContext";

vi.mock("../src/shared/lib/dataService", () => ({
  getTestSeries: vi.fn().mockResolvedValue([]),
  getStudyMaterials: vi.fn().mockResolvedValue([]),
  getTests: vi.fn().mockResolvedValue([]),
  examAPI: {
    getExams: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getCategories: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getPublicStats: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
  testsAPI: {
    getByTag: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
  // usePublicSettings reads `api.get("/api/settings/public")`; without this the
  // mock module has no `api` export and vitest throws inside the queryFn.
  api: {
    get: vi.fn().mockResolvedValue({ data: { data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
  fetchFromAPI: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

describe("App", () => {
  test("renders without throwing", () => {
    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
              <App />
            </MemoryRouter>
          </ThemeProvider>
        </QueryClientProvider>
      </HelmetProvider>,
    );
    expect(document.body).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});
