/**
 * Runtime a11y regression check for the label-codemod sweep.
 *
 * Static AST analysis cannot prove a screen reader can find the label, so
 * this renders the pages the codemod touched and runs axe-core against the
 * real DOM. Targets the label/ WCAG 1.3.1 + 4.1.2 rules specifically.
 *
 * Run: pnpm vitest run src/__tests__/a11y.labels.test.jsx
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ROUTER_FUTURE_FLAGS } from "../test/routerFutureFlags";
import axe from "axe-core";

afterEach(() => {
  cleanup();
});

const mockApi = {
  get: vi.fn().mockResolvedValue({ data: { data: [] } }),
  post: vi.fn().mockResolvedValue({ data: { data: {} } }),
  put: vi.fn().mockResolvedValue({ data: { data: {} } }),
  patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
  delete: vi.fn().mockResolvedValue({ data: { data: {} } }),
};

vi.mock("../../shared/lib/dataService", () => ({
  api: mockApi,
  default: { api: mockApi },
  getExams: vi.fn().mockResolvedValue([]),
  getTestSeries: vi.fn().mockResolvedValue([]),
  getTestCategories: vi.fn().mockResolvedValue([]),
  getExamCategories: vi.fn().mockResolvedValue([]),
  getTests: vi.fn().mockResolvedValue([]),
  getTestSeriesById: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock("../../shared/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const runAxe = async (container) =>
  axe.run(container, {
    runOnly: { type: "rule", values: ["label", "form-field-multiple-labels"] },
  });

describe("label association (axe, runtime)", { timeout: 15000 }, () => {
  it("ForgotPassword: every control has a real accessible name", async () => {
    const { default: ForgotPassword } =
      await import("../pages/auth/ForgotPassword.jsx");
    const { container } = render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <ForgotPassword />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText(/email address/i);
    expect(input).toBeTruthy();

    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });

  it("ResetPassword: password + confirm fields are labelled", async () => {
    const { default: ResetPassword } =
      await import("../pages/auth/ResetPassword.jsx");
    const { container } = render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <ResetPassword />
      </MemoryRouter>,
    );
    const pw = screen.getByLabelText(/new password/i);
    const confirm = screen.getByLabelText(/confirm password/i);
    expect(pw).toBeTruthy();
    expect(confirm).toBeTruthy();
    expect(pw.id).not.toBe(confirm.id);

    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });

  it("Contact: all fields labelled and axe-clean", async () => {
    const { default: Contact } = await import("../pages/public/Contact.jsx");
    const { container } = render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <HelmetProvider>
          <Contact />
        </HelmetProvider>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/^name/i)).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/message/i)).toBeTruthy();

    // Contact fetches its contact-info block on mount; let that settle inside
    // act() before axe snapshots the DOM.
    await act(async () => {});

    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });

  it("YearSelector: the year <select> is named", async () => {
    const { default: YearSelector } =
      await import("../components/exams/YearSelector.jsx");
    const { container } = render(
      <YearSelector
        years={[2024, 2025, 2026]}
        selectedYear={2025}
        onSelect={() => {}}
      />,
    );
    const results = await runAxe(container);
    const labelViolations = results.violations.filter((v) => v.id === "label");
    expect(labelViolations).toEqual([]);
  });
});
