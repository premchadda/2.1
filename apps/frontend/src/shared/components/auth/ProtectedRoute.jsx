import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../providers/AuthContext";
import { TrstprepLoading } from "../common/TrstprepLoading";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, authResolved } = useAuth();
  const location = useLocation();

  // Gate on the AUTHORITATIVE resolution (`authResolved`), never on the
  // presence of a cached user.
  //
  // `user` is seeded from storage by AuthProvider's getInitialUser() as an
  // optimistic hint — AuthProvider's own comment says a cached user is only a
  // hint and protected routes must wait for /api/auth/me. The old condition
  // (`!user && (loading || !authResolved)`) short-circuited on that hint, so
  // when the server session had died but the profile was still cached the full
  // protected shell rendered under the dead user's identity — a burst of doomed
  // protected API calls, then a pop to /login.
  //
  // `authResolved` flips true exactly once /api/auth/me settles (or a login
  // completes), which is the only trustworthy "should I render protected UI?"
  // answer available.
  if (!authResolved) {
    return (
      <TrstprepLoading
        fullscreen
        message="Verifying session..."
        subtext="Securely restoring your learning workspace"
      />
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for admin access if required
  if (adminOnly && user.role !== "admin" && user.isAdmin !== true) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
