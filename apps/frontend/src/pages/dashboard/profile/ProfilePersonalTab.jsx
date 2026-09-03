import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Calendar,
  Activity,
  LogOut,
  ChevronRight,
  Edit2,
  Save,
  Check,
  Award,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { userAPI } from "../../../shared/lib/dataService";

function ProfilePersonalTab({
  user,
  personalInfo,
  calculateProfileCompletion,
  isEditing,
  setIsEditing,
  editForm,
  editErrors,
  editSuccess,
  saving,
  handleEditChange,
  handleSaveProfile,
  setShowLocationModal,
  setLocationTab,
  setSelectedState,
  setSelectedCity,
  setSelectedPincode,
  logout,
  refreshUser,
}) {
  const navigate = useNavigate();

  if (isEditing) {
    return (
      <div style={{ animation: "fadeIn 0.35s ease both" }}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit Profile
            </h2>
            {editSuccess && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <Check className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => handleEditChange("name", e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border ${editErrors.name ? "border-red-500" : "border-gray-200 dark:border-gray-600"} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              />
              {editErrors.name && (
                <p className="mt-1 text-xs text-red-500">{editErrors.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => handleEditChange("phone", e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border ${editErrors.phone ? "border-red-500" : "border-gray-200 dark:border-gray-600"} bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              />
              {editErrors.phone && (
                <p className="mt-1 text-xs text-red-500">{editErrors.phone}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={
                  editForm.dateOfBirth
                    ? String(editForm.dateOfBirth).split("T")[0]
                    : ""
                }
                onChange={(e) =>
                  handleEditChange("dateOfBirth", e.target.value)
                }
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedState("");
                  setSelectedCity("");
                  setSelectedPincode("");
                  setLocationTab("state");
                  setShowLocationModal(true);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-left hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  {editForm.location || "Select your location"}
                </div>
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Exam Reservation Category
              </label>
              <select
                value={editForm.category || "UR"}
                onChange={(e) => handleEditChange("category", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
              >
                <option value="UR">UR (General / Unreserved)</option>
                <option value="OBC">OBC (Other Backward Classes)</option>
                <option value="EWS">EWS (Economically Weaker Section)</option>
                <option value="SC">SC (Scheduled Caste)</option>
                <option value="ST">ST (Scheduled Tribe)</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Used for category cutoffs and category-wise All-India Rank
                calculations.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Education
              </label>
              <input
                type="text"
                value={editForm.education}
                onChange={(e) => handleEditChange("education", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio
              </label>
              <textarea
                value={editForm.bio}
                onChange={(e) => handleEditChange("bio", e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.35s ease both" }}>
      <div className="space-y-5">
        {personalInfo.bio && (
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-2xl shadow-sm border border-indigo-100/50 dark:border-gray-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <span className="text-white text-lg">💬</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    About Me
                  </h3>
                  <p className="text-xs text-gray-500">Your personal bio</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-1">
                {personalInfo.bio}
              </p>
            </div>
          </div>
        )}

        {/* ── Exam Reservation Category & Cutoff Benchmark Card ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-900/30 dark:to-purple-900/30 px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                  Exam Reservation Category
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Benchmarking for Category Cutoffs & Category All-India Rank
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 hidden sm:inline">
                Active Category:
              </span>
              <span className="px-3 py-1 bg-blue-600 text-white rounded-xl text-xs font-black shadow-xs tracking-wider">
                {user?.category || personalInfo?.category || "UR"}
              </span>
            </div>
          </div>

          <div className="p-5">
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              Select your reservation/social category to enable automatic
              category cutoff clearance tracking and cohort benchmarking across
              all mock tests:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { id: "UR", label: "UR (General)", desc: "Unreserved" },
                { id: "OBC", label: "OBC", desc: "Other Backward Classes" },
                { id: "EWS", label: "EWS", desc: "Economically Weaker" },
                { id: "SC", label: "SC", desc: "Scheduled Caste" },
                { id: "ST", label: "ST", desc: "Scheduled Tribe" },
              ].map((cat) => {
                const isSelected =
                  (user?.category || personalInfo?.category || "UR") === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={async () => {
                      try {
                        await userAPI.updateProfile({ category: cat.id });
                        if (refreshUser) await refreshUser();
                        toast.success(`Category updated to ${cat.id}!`);
                      } catch (err) {
                        toast.error("Failed to update category.");
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 hover:border-blue-300 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black">{cat.id}</span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate font-medium">
                      {cat.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Personal Details
                  </h2>
                  <p className="text-xs text-gray-500">
                    Your basic information
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>
          <div className="p-5">
            <div className="grid md:grid-cols-2 gap-3">
              {[
                {
                  label: "Full Name",
                  val: personalInfo.fullName || "Not set",
                  icon: User,
                  bg: "from-blue-500 to-indigo-600",
                },
                {
                  label: "Email",
                  val: personalInfo.email || "Not set",
                  icon: Mail,
                  bg: "from-green-500 to-emerald-600",
                },
                {
                  label: "Phone",
                  val: personalInfo.phone || "Not set",
                  icon: Phone,
                  bg: "from-orange-500 to-amber-600",
                },
                {
                  label: "Date of Birth",
                  val: personalInfo.dateOfBirth
                    ? !isNaN(new Date(personalInfo.dateOfBirth).getTime())
                      ? new Date(personalInfo.dateOfBirth).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        )
                      : personalInfo.dateOfBirth
                    : "Not set",
                  icon: Calendar,
                  bg: "from-purple-500 to-pink-600",
                },
                {
                  label: "Location",
                  val: personalInfo.location?.split(" -")[0] || "Not set",
                  icon: MapPin,
                  bg: "from-red-500 to-rose-600",
                },
                {
                  label: "Education",
                  val: personalInfo.education || "Not set",
                  icon: GraduationCap,
                  bg: "from-teal-500 to-cyan-600",
                },
                {
                  label: "Category",
                  val:
                    user?.category || personalInfo.category || "UR (General)",
                  icon: Award,
                  bg: "from-amber-500 to-orange-600",
                },
              ].map(({ label, val, icon: Icon, bg }) => (
                <div
                  key={label}
                  className="group relative bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${bg} flex items-center justify-center shadow-sm flex-shrink-0`}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                        {label}
                      </div>
                      <div
                        className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                        title={val}
                      >
                        {val}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white/90">
                  Profile Completion
                </span>
                <span className="text-sm font-bold text-white">
                  {calculateProfileCompletion()}%
                </span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${calculateProfileCompletion()}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-5">
          <button
            onClick={async () => {
              const ok = await window.confirm(
                "Are you sure you want to logout?",
              );
              if (ok) {
                logout();
                navigate("/");
              }
            }}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/50">
              <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                Logout
              </div>
              <div className="text-xs text-gray-400">
                Sign out of your account
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePersonalTab;
