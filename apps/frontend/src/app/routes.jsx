import React from "react";
import { Navigate } from "react-router-dom";
import RouteErrorBoundary from "../shared/components/common/RouteErrorBoundary.jsx";
import ProtectedRoute from "../shared/components/auth/ProtectedRoute.jsx";
import FeatureGate from "../shared/components/common/FeatureGate.jsx";
import { PageSkeleton } from "../shared/components/common/LoadingSkeleton.jsx";
import { useAuth } from "../shared/providers/AuthContext";

// Landing paths that resolve identity-aware: / and its /home alias.
const LANDING_PATHS = new Set(["/", "/home"]);

/**
 * Root route resolver — decides destination synchronously, on the first paint.
 *
 * Decision order (no waiting, no flash):
 *  1. `user`            → already validated/optimistic profile → /dashboard.
 *  2. `hasSessionHint`  → a session marker/token/cached profile exists, so the
 *                         visitor is (almost certainly) logged in → /dashboard
 *                         immediately, while `/api/auth/me` revalidates in the
 *                         background. ProtectedRoute shows the brief
 *                         "Verifying session" state if the profile is not yet
 *                         cached — the public Home is never rendered.
 *  3. anonymous         → render the public landing page at once (no pointless
 *                         loader): there is no session evidence to wait for.
 *
 * Previously this only checked `user`, which is null on a fresh tab when the
 * session lives in httpOnly cookies — so `/me` produced
 * loading → public Home → /dashboard (the flash this fixes).
 */
function RootRoute({ element }) {
  const { user, isAuthenticated, hasSessionHint } = useAuth();
  if (user || isAuthenticated || hasSessionHint) {
    return <Navigate to="/dashboard" replace />;
  }
  return element;
}

/**
 * Wraps a page element with the standard route boundaries.
 * Every route is wrapped in <RouteErrorBoundary> for chunk-load recovery.
 * Optional auth and feature gating are composed inside the boundary so the
 * error fallback still renders even when the gate redirects.
 *
 * @param {React.ReactNode} element - Page component to render
 * @param {{ protected?: boolean, featureKey?: string, pageKey?: string }} opts
 */
export function wrapElement(element, opts = {}) {
  const { protected: isProtected, featureKey, pageKey } = opts;
  let wrapped = element;
  if (featureKey || pageKey) {
    const gateProps = featureKey ? { featureKey } : { pageKey };
    wrapped = <FeatureGate {...gateProps}>{wrapped}</FeatureGate>;
  }
  if (isProtected) {
    wrapped = <ProtectedRoute>{wrapped}</ProtectedRoute>;
  }
  if (!React.isValidElement(wrapped)) {
    return (
      <RouteErrorBoundary>
        <PageSkeleton type="default" />
      </RouteErrorBoundary>
    );
  }
  return <RouteErrorBoundary>{wrapped}</RouteErrorBoundary>;
}

/**
 * Creates a route config object with boundaries already applied.
 * The root path gets a small auth-aware resolver so authenticated users never
 * briefly render the public Home page before being sent to the dashboard.
 */
export function createRoute(path, element, opts) {
  const routeElement = LANDING_PATHS.has(path) ? (
    <RootRoute element={element} />
  ) : (
    element
  );
  return { path, element: wrapElement(routeElement, opts) };
}

/**
 * Helper to render an array of route configs as <Route> elements.
 */
export function renderRoutes(routeConfigs) {
  return routeConfigs;
}

export default { wrapElement, createRoute };
