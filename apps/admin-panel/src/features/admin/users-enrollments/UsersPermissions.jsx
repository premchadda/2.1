import { lazy, Suspense } from "react";
import { useSearchParams, useLocation } from "react-router-dom";

const UsersManager = lazy(() => import("./UsersManager"));
const RolePermissionsManager = lazy(() => import("./RolePermissionsManager"));

export default function UsersPermissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const defaultTab = location.pathname.includes("roles-permissions")
    ? "roles"
    : "users";
  const activeTab = searchParams.get("tab") || defaultTab;

  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="space-y-0">
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
    </div>
  );
}
