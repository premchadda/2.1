import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import FeatureGate from "./FeatureGate";

const settingsMock = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  isComingSoon: vi.fn(() => false),
  getComingSoonConfig: vi.fn(() => ({})),
  isLoading: false,
}));

vi.mock("../../hooks/usePublicSettings", () => ({
  usePublicSettings: () => settingsMock,
}));

vi.mock("../../providers/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

describe("FeatureGate", () => {
  beforeEach(() => settingsMock.isFeatureEnabled.mockReset());

  it("shows the feature when enabled", () => {
    settingsMock.isFeatureEnabled.mockReturnValue(true);
    render(
      <MemoryRouter>
        <FeatureGate featureKey="analytics">
          <span>Analytics</span>
        </FeatureGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("blocks the feature when disabled", () => {
    settingsMock.isFeatureEnabled.mockReturnValue(false);
    render(
      <MemoryRouter>
        <FeatureGate featureKey="analytics">
          <span>Analytics</span>
        </FeatureGate>
      </MemoryRouter>,
    );
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
    expect(screen.getByText("Feature unavailable")).toBeInTheDocument();
  });
});
