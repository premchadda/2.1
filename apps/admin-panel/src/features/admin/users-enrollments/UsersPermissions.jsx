import { lazy, Suspense } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import ErrorBoundary from "../../../shared/components/common/ErrorBoundary";

const UsersManager = lazy(() => import("./UsersManager"));
const RolePermissionsManager = lazy(() => import("./RolePermissionsManager"));

const VALID_TABS = ["users", "roles"];

export default function UsersPermissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const defaultTab = location.pathname.includes("roles-permissions")
    ? "roles"
    : "users";
  const rawTab = searchParams.get("tab") || defaultTab;
  // Validate tab param — fall back to the route default for unknown values.
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : defaultTab;

  const setActiveTab = (tabId) => {
    // Preserve sibling query params (e.g. ?search=, ?page=) when switching.
    const next = new URLSearchParams(searchParams);
    next.set("tab", tabId);
    setSearchParams(next);
  };

  const retryKey = `${activeTab}`;
  return (
    <div className="space-y-0">
      <ErrorBoundary key={retryKey}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-indigo-500 border-t-transparent"></div>
            </div>
          }
        >
          <div className="animate-page-transit">
            {activeTab === "users" && (
              <UsersManager activeTab={activeTab} setActiveTab={setActiveTab} />
            )}
            {activeTab === "roles" && (
              <RolePermissionsManager
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            )}
          </div>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
