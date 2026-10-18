import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import App from "../src/App";

// Minimal test wrapper that mocks just enough context
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

// Mock the AuthContext so App doesn't throw
vi.mock("../src/shared/providers/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: () => {},
    logout: () => {},
  }),
  AuthProvider: ({ children }) => children,
}));

describe("App", () => {
  test("renders without throwing", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(document.body).toBeInTheDocument();
  });
});
