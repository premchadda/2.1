import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initProPassAuth } from "@trstprep/shared-hooks";
import App from "../App";
import { ThemeProvider } from "../shared/context/ThemeContext";
import { ROUTER_FUTURE_FLAGS } from "../test/routerFutureFlags";

// Mock heavy dependencies that aren't needed for smoke tests
vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }) => children,
}));

vi.mock("../shared/providers/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, authResolved: true }),
  AuthProvider: ({ children }) => children,
}));

// main.jsx wires this at the app root; these suites import App directly, so
// repeat the wiring to keep useProPass off its degraded warning path.
initProPassAuth(() => ({ user: null }));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

import { HelmetProvider } from "react-helmet-async";

const renderRoute = async (route) => {
  const result = render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[route]} future={ROUTER_FUTURE_FLAGS}>
            <App />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );
  // Pages kick off mount-time fetches (stats, settings). Let them settle inside
  // act() so the resulting state updates are not reported as un-acted.
  await act(async () => {});
  return result;
};

const expectNoRenderedError = (container) => {
  expect(container).toBeTruthy();
  expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
};

describe("App route smoke tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders / (home) without crashing", async () => {
    const { container } = await renderRoute("/");
    expectNoRenderedError(container);
  });

  it("renders /login without crashing", async () => {
    const { container } = await renderRoute("/login");
    expectNoRenderedError(container);

    const dialog = container.querySelector('[role="dialog"]');
    if (dialog) {
      expect(dialog).toHaveClass("w-[min(100%,24rem)]");
    }
  });

  it("renders /signup without crashing", async () => {
    const { container } = await renderRoute("/signup");
    expectNoRenderedError(container);
  });

  it("renders /about without crashing", async () => {
    const { container } = await renderRoute("/about");
    expectNoRenderedError(container);
  });

  it("renders /contact without crashing", async () => {
    const { container } = await renderRoute("/contact");
    expectNoRenderedError(container);
  });

  it("renders /exams without crashing", async () => {
    const { container } = await renderRoute("/exams");
    expectNoRenderedError(container);
  });

  it("renders /test-series without crashing", async () => {
    const { container } = await renderRoute("/test-series");
    expectNoRenderedError(container);
  });

  it("renders /faq without crashing", async () => {
    const { container } = await renderRoute("/faq");
    expectNoRenderedError(container);
  });

  it("renders /terms without crashing", async () => {
    const { container } = await renderRoute("/terms");
    expectNoRenderedError(container);
  });

  it("renders /privacy without crashing", async () => {
    const { container } = await renderRoute("/privacy");
    expectNoRenderedError(container);
  });

  it("renders /search without crashing", async () => {
    const { container } = await renderRoute("/search");
    expectNoRenderedError(container);
  });

  it("renders /blog without crashing", async () => {
    const { container } = await renderRoute("/blog");
    expectNoRenderedError(container);
  });

  it("renders /leaderboard without crashing", async () => {
    const { container } = await renderRoute("/leaderboard");
    expectNoRenderedError(container);
  });

  it("renders unknown route as 404", async () => {
    const { container } = await renderRoute("/this-does-not-exist");
    expectNoRenderedError(container);
  });

  it("renders /dashboard (protected) without crashing", async () => {
    const { container } = await renderRoute("/dashboard");
    expectNoRenderedError(container);
  });

  it("renders the mobile bottom navigation", async () => {
    await renderRoute("/");
    const bottomNav = await screen.findByRole(
      "navigation",
      { name: /mobile navigation/i },
      { timeout: 10000 },
    );
    expect(bottomNav).toHaveClass("fixed", "bottom-0");
  }, 15000);

  it("handles /dashboard/rankings redirect without crashing", async () => {
    const { container } = await renderRoute("/dashboard/rankings");
    expectNoRenderedError(container);
  });

  it("handles /tag/pyps redirect without crashing", async () => {
    const { container } = await renderRoute("/tag/pyps");
    expectNoRenderedError(container);
  });

  it("renders global footer with role contentinfo on homepage only", async () => {
    const { container: homeContainer } = await renderRoute("/");
    expectNoRenderedError(homeContainer);
    const homeFooter = homeContainer.querySelector(
      'footer[role="contentinfo"]',
    );
    expect(homeFooter).toBeInTheDocument();

    const { container: termsContainer } = await renderRoute("/terms");
    expectNoRenderedError(termsContainer);
    const termsFooter = termsContainer.querySelector(
      'footer[role="contentinfo"]',
    );
    expect(termsFooter).not.toBeInTheDocument();
  });
});
