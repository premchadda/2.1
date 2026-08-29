import React from "react";
import { Navigate } from "react-router-dom";
import RouteErrorBoundary from "../shared/components/common/RouteErrorBoundary.jsx";
import ProtectedRoute from "../shared/components/auth/ProtectedRoute.jsx";
import FeatureGate from "../shared/components/common/FeatureGate.jsx";
import { PageSkeleton } from "../shared/components/common/LoadingSkeleton.jsx";
import { useAuth } from "../shared/providers/AuthContext";

/**
 * Root route resolver: do not render the public Home page while authentication
 * is still being resolved. This prevents the Home -> Dashboard flash on
 * revisits when the existing session is restored asynchronously.
 */
function RootRoute({ element }) {
  const { isAuthenticated, authResolved } = useAuth();
  if (!authResolved) return <PageSkeleton />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : element;
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
  return <RouteErrorBoundary>{wrapped}</RouteErrorBoundary>;
}

/**
 * Creates a route config object with boundaries already applied.
 * The root path gets a small auth-aware resolver so authenticated users never
 * briefly render the public Home page before being sent to the dashboard.
 */
export function createRoute(path, element, opts) {
  const routeElement = path === "/" ? <RootRoute element={element} /> : element;
  return { path, element: wrapElement(routeElement, opts) };
}

/**
 * Helper to render an array of route configs as <Route> elements.
 */
export function renderRoutes(routeConfigs) {
  return routeConfigs;
}

export default { wrapElement, createRoute };
