import { useState, useEffect, useCallback } from "react";
import { adminAPI } from "../../../shared/lib/dataService";
import { toast } from "react-hot-toast";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Users,
  Key,
  RefreshCw,
  Check,
  XCircle,
} from "lucide-react";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import { useAuth } from "../../../shared/providers/AuthContext";

const ALL_PERMISSIONS = [
  { resource: "users", actions: ["read", "write", "delete", "export"] },
  { resource: "tests", actions: ["read", "write", "delete", "export"] },
  { resource: "questions", actions: ["read", "write", "delete", "export"] },
  { resource: "content", actions: ["read", "write", "delete", "export"] },
  { resource: "media", actions: ["read", "write", "delete"] },
  { resource: "analytics", actions: ["read", "export"] },
  { resource: "settings", actions: ["read", "write"] },
  { resource: "roles", actions: ["read", "write", "delete"] },
  { resource: "audit_logs", actions: ["read", "export"] },
];

export default function RolePermissionsManager({
  activeTab: parentTab = "roles",
  setActiveTab: setParentTab,
}) {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    permissions: [],
    isSystem: false,
  });
  const [activeTab, setActiveTab] = useState("roles");

  const userPerms = user?.permissions || [];
  const isSuperPerms = userPerms.includes("*");
  const isAdminRole = user?.role === "admin" || user?.role === "super_admin";
  const canManage =
    isSuperPerms ||
    user?.role === "super_admin" ||
    userPerms.includes("roles:write");

  const fetchData = useCallback(async (signal) => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.allSettled([
        adminAPI.apiClient.get("/admin/roles", { signal }),
        adminAPI.apiClient.get("/admin/permissions", { signal }),
      ]);
      if (signal.aborted) return;
      if (rolesRes.status === "fulfilled") {
        const rData = rolesRes.value.data?.data;
        setRoles(Array.isArray(rData) ? rData : rData?.roles || []);
      }
      if (permsRes.status === "fulfilled") {
        const pData = permsRes.value.data?.data;
        setPermissions(
          Array.isArray(pData) ? pData : pData?.permissions || ALL_PERMISSIONS,
        );
      }
    } catch (error) {
      if (signal.aborted) return;
      console.error("Error fetching roles/permissions:", error);
      toast.error("Failed to load data");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  if (!isAdminRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <Shield className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Access Denied
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Only administrators can view roles and permissions.
        </p>
      </div>
    );
  }

  const handleCreate = () => {
    if (!canManage) {
      toast.error("Only super admins (roles:write) can manage roles");
      return;
    }
    setEditingId("new");
    setFormData({
      name: "",
      displayName: "",
      description: "",
      permissions: [],
      isSystem: false,
    });
  };

  const handleEdit = (role) => {
    if (!canManage) {
      toast.error("Only super admins (roles:write) can manage roles");
      return;
    }
    const roleId = role.id || role._id;
    setEditingId(roleId);
    const normalizedPerms = (role.permissions || [])
      .map((p) => {
        if (typeof p === "string") return p;
        if (p?.name) return p.name;
        if (p?.resource && p?.action) return `${p.resource}:${p.action}`;
        return "";
      })
      .filter(Boolean);

    setFormData({
      name: role.name || "",
      displayName: role.displayName || role.name || "",
      description: role.description || "",
      permissions: normalizedPerms,
      isSystem: role.isSystem || false,
    });
  };

  const togglePermission = (perm) => {
    const fullPerm = `${perm}`;
    setFormData((prev) => {
      const perms = prev.permissions || [];
      if (perms.includes(fullPerm)) {
        return { ...prev, permissions: perms.filter((p) => p !== fullPerm) };
      } else {
        return { ...prev, permissions: [...perms, fullPerm] };
      }
    });
  };

  const toggleAllForResource = (resource, actions) => {
    const resourcePerms = actions.map((a) => `${resource}:${a}`);
    setFormData((prev) => {
      const perms = prev.permissions || [];
      const allSelected = resourcePerms.every((p) => perms.includes(p));
      if (allSelected) {
        return {
          ...prev,
          permissions: perms.filter((p) => !resourcePerms.includes(p)),
        };
      } else {
        return {
          ...prev,
          permissions: [...new Set([...perms, ...resourcePerms])],
        };
      }
    });
  };

  const handleSave = async () => {
    try {
      if (!formData.name) {
        toast.error("Role name is required");
        return;
      }
      if (!canManage) {
        toast.error("Only super admins (roles:write) can manage roles");
        return;
      }
      const payload = {
        name: formData.name.trim().toLowerCase(),
        description: formData.description || null,
        permissions: formData.permissions,
      };
      if (editingId === "new") {
        const res = await adminAPI.apiClient.post("/admin/roles", payload);
        const newRole = res.data?.data ||
          res.data?.role || { id: Date.now(), ...payload };
        setRoles((prev) => [...prev, newRole]);
        toast.success("Role created");
      } else {
        const res = await adminAPI.apiClient.put(
          `/admin/roles/${editingId}`,
          payload,
        );
        const updatedRole = res.data?.data ||
          res.data?.role || {
            ...roles.find((r) => (r.id || r._id) === editingId),
            ...payload,
          };
        setRoles((prev) =>
          prev.map((r) => ((r.id || r._id) === editingId ? updatedRole : r)),
        );
        toast.success("Role updated");
      }
      setEditingId(null);
      fetchData();
    } catch (error) {
      console.error("Error saving role:", error);
      toast.error(error.response?.data?.message || "Failed to save role");
    }
  };

  const renderRoleForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Role name (e.g., content_manager)"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
            }))
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
        <input
          type="text"
          placeholder="Display name (e.g., Content Manager)"
          value={formData.displayName}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, displayName: e.target.value }))
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <input
        type="text"
        placeholder="Description"
        value={formData.description}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, description: e.target.value }))
        }
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      />

      {/* Permission Checkboxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_PERMISSIONS.map(({ resource, actions }) => {
          const resourcePerms = actions.map((a) => `${resource}:${a}`);
          const allSelected = resourcePerms.every((p) =>
            (formData.permissions || []).includes(p),
          );
          const someSelected = resourcePerms.some((p) =>
            (formData.permissions || []).includes(p),
          );
          return (
            <div
              key={resource}
              className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium capitalize">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => toggleAllForResource(resource, actions)}
                    className="rounded"
                  />
                  {resource}
                </label>
              </div>
              <div className="flex flex-wrap gap-1">
                {actions.map((action) => {
                  const perm = `${resource}:${action}`;
                  const isSelected = (formData.permissions || []).includes(
                    perm,
                  );
                  return (
                    <button
                      key={action}
                      onClick={() => togglePermission(perm)}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        isSelected
                          ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                          : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {action}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setEditingId(null)}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          <Save className="w-4 h-4" /> Save
        </button>
      </div>
    </div>
  );

  const handleDelete = async (id) => {
    if (!canManage) {
      toast.error("Only super admins (roles:write) can manage roles");
      return;
    }
    const confirmed = await confirmOnce({
      title: "Delete Role",
      message:
        "Delete this role? Users with this role will need to be reassigned.",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await adminAPI.apiClient.delete(`/admin/roles/${id}`);
      setRoles((prev) => prev.filter((r) => (r.id || r._id) !== id));
      toast.success("Role deleted");
    } catch (error) {
      toast.error("Failed to delete role");
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading roles and permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3.5">
      {/* 1. Unified Single-Row Top Bar (Tabs on Left + Actions on Right) */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        {/* Left: Parent Tab Switcher */}
        <div className="inline-flex items-center gap-1 p-1 bg-white dark:bg-gray-800/90 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-700/80">
          <button
            onClick={() => setParentTab && setParentTab("users")}
            className={`relative flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 tap-feedback ${
              parentTab === "users"
                ? "text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            }`}
          >
            {parentTab === "users" && (
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl shadow-sm" />
            )}
            <span className="relative flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Users
            </span>
          </button>

          <button
            onClick={() => setParentTab && setParentTab("roles")}
            className={`relative flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 tap-feedback ${
              parentTab === "roles"
                ? "text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            }`}
          >
            {parentTab === "roles" && (
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl shadow-sm" />
            )}
            <span className="relative flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Roles & Permissions
            </span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchData(new AbortController().signal)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all tap-feedback"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          {canManage && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all tap-feedback"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Role</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs (Roles List vs Matrix) */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {[
          { id: "roles", label: "Roles List", icon: Shield },
          { id: "permissions", label: "Permissions Matrix", icon: Key },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all tap-feedback ${
              activeTab === tab.id
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          {editingId === "new" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Create New Role
              </h3>
              {renderRoleForm()}
            </div>
          )}
          {roles.map((role) => {
            const roleId = role.id || role._id;
            return (
              <div
                key={roleId}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
              >
                {editingId === roleId ? (
                  renderRoleForm()
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${role.isSystem ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600"}`}
                      >
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {role.displayName || role.name}
                          </h3>
                          {role.isSystem && (
                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded">
                              System
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {role.description || "No description"}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(role.permissions || [])
                            .slice(0, 8)
                            .map((perm, idx) => {
                              const permName =
                                typeof perm === "string"
                                  ? perm
                                  : perm.name ||
                                    `${perm.resource}:${perm.action}`;
                              return (
                                <span
                                  key={`${permName}-${idx}`}
                                  className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded"
                                >
                                  {permName}
                                </span>
                              );
                            })}
                          {(role.permissions || []).length > 8 && (
                            <span className="text-xs text-gray-400">
                              +{(role.permissions || []).length - 8} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canManage && !role.isSystem && (
                        <>
                          <button
                            onClick={() => handleEdit(role)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(roleId)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Permissions Matrix Tab */}
      {activeTab === "permissions" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.id || role._id}
                      className="px-4 py-3 text-center font-medium text-gray-500"
                    >
                      {role.displayName || role.name}
                      {role.isSystem && (
                        <span className="ml-1 text-purple-500">*</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map(({ resource, actions }) =>
                  actions.map((action) => (
                    <tr
                      key={`${resource}:${action}`}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white capitalize">
                        {resource}:{action}
                      </td>
                      {roles.map((role) => {
                        const perms = role.permissions || [];
                        const hasPerm = perms.some((p) => {
                          if (typeof p === "string")
                            return p === `${resource}:${action}` || p === "*";
                          return (
                            p?.name === `${resource}:${action}` ||
                            (p?.resource === resource && p?.action === action)
                          );
                        });
                        return (
                          <td
                            key={role.id || role._id}
                            className="px-4 py-2 text-center"
                          >
                            {hasPerm ? (
                              <Check className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
