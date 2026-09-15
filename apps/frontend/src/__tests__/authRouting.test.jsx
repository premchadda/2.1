import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mutable auth state so each test can describe a different bootstrap scenario.
const auth = vi.hoisted(() => ({
  current: {
    user: null,
    loading: false,
    authResolved: true,
    hasSessionHint: false,
  },
}));

vi.mock("../shared/providers/AuthContext", () => ({
  useAuth: () => auth.current,
  AuthProvider: ({ children }) => children,
}));

import { createRoute } from "../app/routes.jsx";
import {
  markSessionHint,
  hasStoredSessionHint,
  getInitialSessionHint,
  clearAuthTokens,
  saveUserCache,
  prefersPersistentStorage,
} from "../shared/providers/authSession.js";

const LandingStub = () => <div data-testid="home-stub">public home</div>;
const DashboardStub = () => <div data-testid="dashboard-stub">dashboard</div>;

/** Renders a landing route through the real createRoute() resolver (the one App.jsx uses), with /dashboard stubbed so we can assert where the visitor was sent. */
function renderLanding(path = "/") {
  const route = createRoute(path, <LandingStub />);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route.path} element={route.element} />
        <Route path="/dashboard" element={<DashboardStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("identity resolution on first paint (RootRoute)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    auth.current = {
      user: null,
      loading: false,
      authResolved: true,
      hasSessionHint: false,
    };
  });

  it("sends a session-hinted returning user straight to /dashboard (no public-home flash)", () => {
    // The reported production bug: cookie-only session, `user` not yet known.
    auth.current = {
      user: null,
      loading: true,
      authResolved: false,
      hasSessionHint: true,
    };

    renderLanding("/");

    expect(screen.getByTestId("dashboard-stub")).toBeTruthy();
    expect(screen.queryByTestId("home-stub")).toBeNull();
  });

  it("sends an already-validated user to /dashboard", () => {
    auth.current = {
      user: { id: 1, name: "Anita" },
      loading: false,
      authResolved: true,
      hasSessionHint: true,
    };

    renderLanding("/");

    expect(screen.getByTestId("dashboard-stub")).toBeTruthy();
    expect(screen.queryByTestId("home-stub")).toBeNull();
  });

  it("renders the public landing immediately for a visitor with no session evidence", () => {
    renderLanding("/");

    expect(screen.getByTestId("home-stub")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-stub")).toBeNull();
  });

  it("keeps rendering the public landing for a resolved anonymous visitor", () => {
    auth.current = {
      user: null,
      loading: false,
      authResolved: true,
      hasSessionHint: false,
    };

    renderLanding("/");

    expect(screen.getByTestId("home-stub")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-stub")).toBeNull();
  });

  it("/home resolves exactly like / (previously it fell through to the 404 page)", () => {
    auth.current = {
      user: null,
      loading: true,
      authResolved: false,
      hasSessionHint: true,
    };
    renderLanding("/home");
    expect(screen.getByTestId("dashboard-stub")).toBeTruthy();

    sessionStorage.clear();
    localStorage.clear();
    auth.current = {
      user: null,
      loading: false,
      authResolved: true,
      hasSessionHint: false,
    };
    renderLanding("/home");
    expect(screen.getAllByTestId("home-stub").length).toBeGreaterThan(0);
  });
});

describe("session hint persistence (authSession)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("records a hint in both storages and reports it synchronously", () => {
    expect(hasStoredSessionHint()).toBe(false);

    markSessionHint();

    expect(hasStoredSessionHint()).toBe(true);
    expect(sessionStorage.getItem("trstprep_has_session")).toBe("1");
    expect(localStorage.getItem("trstprep_has_session")).toBe("1");
    expect(getInitialSessionHint()).toBe(true);
  });

  it("clears the hint through clearAuthTokens() so logout cannot bounce to /dashboard", () => {
    markSessionHint();
    expect(getInitialSessionHint()).toBe(true);

    clearAuthTokens();

    expect(hasStoredSessionHint()).toBe(false);
    expect(getInitialSessionHint()).toBe(false);
  });

  it("preserves a remember-me profile instead of downgrading it to sessionStorage", () => {
    const user = { id: 7, name: "Ravi" };

    saveUserCache(user, true); // remember me
    expect(prefersPersistentStorage()).toBe(true);

    // A later /api/auth/me revalidation must keep the localStorage choice.
    saveUserCache(user, prefersPersistentStorage());
    expect(localStorage.getItem("trstprep_user_profile")).toBeTruthy();
    expect(sessionStorage.getItem("trstprep_user_profile")).toBeNull();
    expect(getInitialSessionHint()).toBe(true);
  });
});
