import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../providers/AuthContext";
import { TrstprepLoading } from "../common/TrstprepLoading";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, authResolved } = useAuth();
  const location = useLocation();

  // Only block if we do NOT have an existing/cached user session
  // and initial authentication resolution is still in flight.
  // When a user session exists from cache, children render in 1ms while /me revalidates.
  if (!user && (loading || !authResolved)) {
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
  if (adminOnly && (!user.role || user.role !== "admin")) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
