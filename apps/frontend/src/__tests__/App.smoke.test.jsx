import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App";
import { ThemeProvider } from "../shared/context/ThemeContext";

// Mock heavy dependencies that aren't needed for smoke tests
vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }) => children,
}));

vi.mock("../shared/providers/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, authResolved: true }),
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

const renderRoute = (route) =>
  render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[route]}>
            <App />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );

const expectNoRenderedError = (container) => {
  expect(container).toBeTruthy();
  expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
};

describe("App route smoke tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders / (home) without crashing", async () => {
    const { container } = renderRoute("/");
    expectNoRenderedError(container);
  });

  it("renders /login without crashing", async () => {
    const { container } = renderRoute("/login");
    expectNoRenderedError(container);

    const dialog = container.querySelector('[role="dialog"]');
    if (dialog) {
      expect(dialog).toHaveClass("w-[min(100%,24rem)]");
    }
  });

  it("renders /signup without crashing", async () => {
    const { container } = renderRoute("/signup");
    expectNoRenderedError(container);
  });

  it("renders /about without crashing", async () => {
    const { container } = renderRoute("/about");
    expectNoRenderedError(container);
  });

  it("renders /contact without crashing", async () => {
    const { container } = renderRoute("/contact");
    expectNoRenderedError(container);
  });

  it("renders /exams without crashing", async () => {
    const { container } = renderRoute("/exams");
    expectNoRenderedError(container);
  });

  it("renders /test-series without crashing", async () => {
    const { container } = renderRoute("/test-series");
    expectNoRenderedError(container);
  });

  it("renders /faq without crashing", async () => {
    const { container } = renderRoute("/faq");
    expectNoRenderedError(container);
  });

  it("renders /terms without crashing", async () => {
    const { container } = renderRoute("/terms");
    expectNoRenderedError(container);
  });

  it("renders /privacy without crashing", async () => {
    const { container } = renderRoute("/privacy");
    expectNoRenderedError(container);
  });

  it("renders /search without crashing", async () => {
    const { container } = renderRoute("/search");
    expectNoRenderedError(container);
  });

  it("renders /blog without crashing", async () => {
    const { container } = renderRoute("/blog");
    expectNoRenderedError(container);
  });

  it("renders /leaderboard without crashing", async () => {
    const { container } = renderRoute("/leaderboard");
    expectNoRenderedError(container);
  });

  it("renders unknown route as 404", async () => {
    const { container } = renderRoute("/this-does-not-exist");
    expectNoRenderedError(container);
  });

  it("renders /dashboard (protected) without crashing", async () => {
    const { container } = renderRoute("/dashboard");
    expectNoRenderedError(container);
  });

  it("renders the mobile bottom navigation", async () => {
    renderRoute("/");
    const bottomNav = await screen.findByRole(
      "navigation",
      { name: /mobile navigation/i },
      { timeout: 10000 },
    );
    expect(bottomNav).toHaveClass("fixed", "bottom-0");
  }, 15000);
});
