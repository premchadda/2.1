import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App";
import { ThemeProvider } from "../shared/context/ThemeContext";
import { HelmetProvider } from "react-helmet-async";

vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }) => children,
}));

vi.mock("../shared/providers/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, authResolved: true }),
  AuthProvider: ({ children }) => children,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

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

// Every static route from App.jsx (params filled with plausible sample values)
const staticRoutes = [
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/dashboard",
  "/dashboard/ai-planner",
  "/ai-tutor",
  "/dashboard/insights",
  "/dashboard/rankings",
  "/test-series",
  "/tests",
  "/live-tests",
  "/live",
  "/pricing",
  "/results",
  "/test-series/123",
  "/test-series/123/my",
  "/ssc/test-series/my",
  "/ssc/test-series/123",
  "/test-series/1/leaderboard",
  "/study",
  "/study/1",
  "/study/1/2",
  "/exams",
  "/exams-old",
  "/exams/category/1",
  "/exams/category/1/exam/2",
  "/exams/category/1/exam/2/year/2024",
  "/exam/2",
  "/exam-old/2",
  "/exam/2/updates",
  "/exam/2/year/2024",
  "/exam/2/compare",
  "/tag/current-affairs",
  "/videos",
  "/videos/phy/ch1/v1",
  "/videos/1",
  "/analysis",
  "/attempted-tests",
  "/pass",
  "/profile",
  "/settings",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/refund",
  "/faq",
  "/search",
  "/forgot-password",
  "/reset-password",
  "/spaced-repetition",
  "/current-affairs",
  "/current-affairs/1",
  "/previous-year-papers",
  "/pyps",
  "/pyps/ssc",
  "/pyps/ssc/ssc-cgl",
  "/tag/pyps",
  "/tag/pyq",
  "/tag/previous-year-papers",
  "/leaderboard",
  "/refer-and-earn",
  "/practice",
  "/quizzes",
  "/blog",
  "/blog/1",
  "/community",
  "/community/groups/1",
  "/notifications",
  "/bookmarks",
  "/achievements",
  "/error-500",
  "/this-route-does-not-exist",
];

describe("Full route audit: every static route renders or redirects without crashing", () => {
  // jsdom lacks matchMedia/scrollTo used by layout components
  beforeAll(() => {
    window.matchMedia =
      window.matchMedia ||
      (() => ({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
    window.scrollTo = () => {};
    Element.prototype.scrollIntoView =
      Element.prototype.scrollIntoView || (() => {});
    if (!window.ResizeObserver) {
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  it.each(staticRoutes)(
    "route %s mounts without error boundary",
    async (route) => {
      const { container } = renderRoute(route);
      expect(container).toBeTruthy();
      // RouteErrorBoundary renders this text on chunk failure / render crash
      expect(
        screen.queryByText(/something went wrong/i),
      ).not.toBeInTheDocument();
    },
    30000,
  );
});
