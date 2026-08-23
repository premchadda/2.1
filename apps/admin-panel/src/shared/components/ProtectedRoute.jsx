import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthContext";
import { getResourceFromPath, hasPermission } from "../lib/rbac";

function Forbidden({
  message = "Access denied. You do not have permission to view this page.",
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-2.99l-7.07-12.14a2 2 0 00-3.48 0L3.19 16.01A2 2 0 004.93 19z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
            aria-label="Sign in with admin account"
          >
            Sign in with Admin Account
          </button>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({
  children,
  adminOnly = false,
  requireAnyPermission,
  requireAllPermissions,
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check admin role
  const isAdminRole =
    user.role === "admin" ||
    user.role === "super_admin" ||
    user.isAdmin === true;
  if (adminOnly && !isAdminRole) {
    return <Forbidden />;
  }

  // Fixed P1: do not grant default perms when backend returns empty array (was privilege escalation) - backend must provide perms
  const userPerms = Array.isArray(user.permissions) ? user.permissions : [];

  const isSuper =
    userPerms.includes("*") ||
    user.role === "super_admin" ||
    user.isSuperAdmin === true ||
    user.is_super_admin === true ||
    (user.role === "admin" && userPerms.length === 0) ||
    (user.isAdmin === true && userPerms.length === 0);

  const checkPerm = (requiredPerm) =>
    hasPermission(userPerms, requiredPerm, isSuper);

  if (adminOnly && !isSuper) {
    const resource = getResourceFromPath(location.pathname);

    const hasAccess =
      checkPerm(`${resource}:view`) ||
      checkPerm(`${resource}:read`) ||
      (resource === "content" && checkPerm("content:read"));
    if (!hasAccess) {
      return (
        <Forbidden message="You do not have permission to view this admin section." />
      );
    }
  }

  // Check fine-grained permissions (accepts requireAnyPermission or requireAllPermissions).
  if (requireAnyPermission && !isSuper) {
    const required = Array.isArray(requireAnyPermission)
      ? requireAnyPermission
      : [requireAnyPermission];
    const hasAny = required.some((p) => checkPerm(p));
    if (!hasAny) {
      return <Forbidden />;
    }
  }
  if (requireAllPermissions && !isSuper) {
    const required = Array.isArray(requireAllPermissions)
      ? requireAllPermissions
      : [requireAllPermissions];
    const hasAll = required.every((p) => checkPerm(p));
    if (!hasAll) {
      return <Forbidden />;
    }
  }

  return children;
}

export { Forbidden };
export default ProtectedRoute;
