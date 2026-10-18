/**
 * React Router v7 future flags, mirroring src/main.jsx.
 *
 * The app opts in at the BrowserRouter; every MemoryRouter/BrowserRouter in the
 * test suite must do the same or React Router re-emits the v7_startTransition /
 * v7_relativeSplatPath deprecation warning on each render.
 */
export const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};
