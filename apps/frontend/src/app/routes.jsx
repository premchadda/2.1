import React from "react";
import RouteErrorBoundary from "../shared/components/common/RouteErrorBoundary.jsx";
import ProtectedRoute from "../shared/components/auth/ProtectedRoute.jsx";
import FeatureGate from "../shared/components/common/FeatureGate.jsx";

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
  // RouteErrorBoundary is always outermost — it must catch chunk errors from
  // lazy-loaded pages even when auth/feature gates reject.
  return <RouteErrorBoundary>{wrapped}</RouteErrorBoundary>;
}

/**
 * Creates a route config object with boundaries already applied.
 * Use to de-duplicate the repetitive `<RouteErrorBoundary><ProtectedRoute><FeatureGate>` nesting.
 * Keeps App.jsx declarative and compact vs 7-line <Route> blocks per entry.
 *
 * @param {string} path - react-router path
 * @param {React.ReactNode} element - page element
 * @param {{ protected?: boolean, featureKey?: string, pageKey?: string }} opts
 * @returns {{ path: string, element: React.ReactNode }}
 */
export function createRoute(path, element, opts) {
  return { path, element: wrapElement(element, opts) };
}

/**
 * Helper to render an array of route configs as <Route> elements.
 * Keeps App.jsx's <Routes> JSX minimal.
 */
export function renderRoutes(routeConfigs) {
  // This is a plain helper re-exported for convenience; callers can also
  // map inline. Keeping it here co-locates route utilities.
  return routeConfigs;
}

export default { wrapElement, createRoute };
