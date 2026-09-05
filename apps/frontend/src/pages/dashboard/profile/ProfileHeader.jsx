import {
  Crown,
  Camera,
  MapPin,
  Flame,
  Calendar,
  TrendingUp,
  Phone,
  Award,
} from "lucide-react";

function ProfileHeader({
  user,
  personalInfo,
  userStats,
  fileInputRef,
  bannerFileInputRef,
  handlePhotoClick,
  handlePhotoChange,
  handleBannerChange,
}) {
  if (!user) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoChange}
        className="hidden"
      />
      <input
        ref={bannerFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBannerChange}
        className="hidden"
      />

      {/* Hero Section */}
      <div className="relative">
        <div className="md:hidden h-52 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500">
            {user.banner && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${user.banner})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40 backdrop-blur-[2px]" />
              </>
            )}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />
          <button
            onClick={() => bannerFileInputRef.current?.click()}
            className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-xl rounded-xl text-xs font-bold text-white border border-white/30 transition-all shadow-lg hover:scale-105 active:scale-95"
          >
            <Camera className="w-3.5 h-3.5" /> Edit Cover
          </button>
        </div>

        <div className="hidden md:block max-w-5xl mx-auto">
          <div className="h-72 relative overflow-hidden rounded-b-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500">
              {user.banner && (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${user.banner})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40 backdrop-blur-[2px]" />
                </>
              )}
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
              <div className="absolute top-1/2 left-1/4 w-40 h-40 bg-pink-400/8 rounded-full blur-xl" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />
            <button
              onClick={() => bannerFileInputRef.current?.click()}
              className="absolute top-5 right-5 z-20 flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-xl rounded-xl text-sm font-bold text-white border border-white/30 transition-all shadow-lg hover:scale-105 active:scale-95"
            >
              <Camera className="w-4 h-4" /> Edit Cover Photo
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-20 md:-mt-28 relative z-30">
        {/* Mobile */}
        <div className="md:hidden">
          <div className="bg-slate-900/75 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-white/20 shadow-2xl">
            <div className="flex items-start gap-3.5 sm:gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-br from-white/40 to-white/10 shadow-xl">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center">
                    {user.avatar ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={user.avatar}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          if (e.currentTarget.nextSibling) {
                            e.currentTarget.nextSibling.style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={`${user.avatar ? "hidden" : "flex"} w-full h-full items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 text-indigo-600 dark:text-indigo-300 text-xl sm:text-2xl font-black`}
                    >
                      {user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handlePhotoClick}
                  className="absolute -bottom-1 -right-1 p-1.5 sm:p-2 bg-indigo-600 text-white rounded-full shadow-lg border-2 border-white/50 hover:scale-110 active:scale-95 transition-transform"
                  aria-label="Upload photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                    {user.name}
                  </h1>
                  {user.hasProPass && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] sm:text-xs font-black rounded-lg shadow-lg shrink-0">
                      <Crown className="w-3 h-3" /> PRO
                    </div>
                  )}
                </div>
                <p
                  className="text-xs sm:text-sm text-white/80 font-medium mb-2.5 truncate"
                  title={user.email}
                >
                  {user.email}
                </p>

                <div className="flex flex-wrap items-center gap-1.5">
                  {personalInfo.location && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-[11px] font-bold rounded-lg backdrop-blur-sm truncate max-w-[150px]"
                      title={personalInfo.location}
                    >
                      <MapPin className="w-3 h-3 shrink-0" />{" "}
                      <span
                        className="truncate"
                        title={personalInfo.location?.split(" -")[0]}
                      >
                        {personalInfo.location?.split(" -")[0]}
                      </span>
                    </span>
                  )}
                  {userStats.streak > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[11px] font-bold rounded-lg shadow-md shrink-0">
                      <Flame className="w-3 h-3" /> {userStats.streak}d
                    </span>
                  )}
                  {(user.createdAt || user.created_at) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 text-white/80 text-[11px] font-medium rounded-lg backdrop-blur-sm shrink-0">
                      <Calendar className="w-3 h-3" />{" "}
                      {new Date(
                        user.createdAt || user.created_at,
                      ).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {personalInfo.phone && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 text-white/80 text-[11px] font-medium rounded-lg backdrop-blur-sm shrink-0">
                      <Phone className="w-3 h-3 text-white/60" />
                      <span>{personalInfo.phone}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[11px] font-bold rounded-lg backdrop-blur-sm shrink-0 shadow-2xs">
                    <Award className="w-3 h-3 text-blue-300" />
                    <span>
                      Category: {user.category || personalInfo.category || "UR"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2.5 bg-slate-900/75 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-2.5 sm:p-3 border border-white/20 shadow-2xl">
            <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
              {[
                {
                  label: "Tests",
                  value: userStats.testsAttempted,
                  suffix: "",
                  icon: "📝",
                  bg: "bg-blue-500/20",
                },
                {
                  label: "Accuracy",
                  value: userStats.avgAccuracy || 0,
                  suffix: "%",
                  icon: "🎯",
                  bg: "bg-green-500/20",
                },
                {
                  label: "Rank",
                  value: userStats.rank || "--",
                  suffix: "",
                  icon: "🏆",
                  bg: "bg-purple-500/20",
                },
                {
                  label: "Hours",
                  value: userStats.timeSpent,
                  suffix: "h",
                  icon: "⏱️",
                  bg: "bg-orange-500/20",
                },
                {
                  label: "Streak",
                  value: userStats.streak,
                  suffix: "d",
                  icon: "🔥",
                  bg: "bg-red-500/20",
                },
              ].map(({ label, value, suffix, icon, bg }) => (
                <div
                  key={label}
                  className={`text-center p-1 sm:p-1.5 ${bg} rounded-xl backdrop-blur-sm flex flex-col items-center justify-center min-h-[52px]`}
                >
                  <div className="text-xs sm:text-sm mb-0.5">{icon}</div>
                  <div className="text-[11px] sm:text-xs font-black text-white leading-none">
                    {value}
                    {suffix}
                  </div>
                  <div className="text-[8px] sm:text-[9px] font-semibold text-white/70 uppercase tracking-wider mt-0.5 truncate w-full">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden md:block">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 md:p-5 border border-white/20 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full p-1 bg-gradient-to-br from-white/40 via-white/20 to-white/10 shadow-xl">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center">
                      {user.avatar ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={user.avatar}
                          alt="Profile"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            if (e.currentTarget.nextSibling) {
                              e.currentTarget.nextSibling.style.display =
                                "flex";
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className={`${user.avatar ? "hidden" : "flex"} w-full h-full items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 text-indigo-600 dark:text-indigo-300 text-2xl md:text-xl sm:text-2xl lg:text-3xl font-black`}
                      >
                        {user.name?.[0]?.toUpperCase() || "U"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handlePhotoClick}
                    className="absolute -bottom-1 -right-1 p-1.5 md:p-2 bg-indigo-600 text-white rounded-full shadow-lg border-2 border-white/30 hover:scale-110 active:scale-95 transition-transform"
                  >
                    <Camera className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                      {user.name}
                    </h1>
                    {user.hasProPass && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black rounded-md shadow-lg">
                        <Crown className="w-3 h-3" /> PRO
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-white/70 font-medium mb-2">
                    {user.email}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {personalInfo.location && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-lg backdrop-blur-sm">
                        <MapPin className="w-3 h-3" />{" "}
                        {personalInfo.location?.split(" -")[0]}
                      </span>
                    )}
                    {userStats.streak > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold rounded-lg">
                        <Flame className="w-3 h-3" /> {userStats.streak}d
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white/70 text-xs font-medium rounded-lg">
                      <Calendar className="w-3 h-3" />{" "}
                      {user.createdAt || user.created_at
                        ? new Date(
                            user.createdAt || user.created_at,
                          ).toLocaleDateString("en-IN", {
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold rounded-lg backdrop-blur-sm shadow-2xs">
                      <Award className="w-3.5 h-3.5 text-blue-300" /> Category:{" "}
                      {user.category || personalInfo.category || "UR"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                      Accuracy
                    </span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[200px]">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${userStats.avgAccuracy || 0}%`,
                          background: `linear-gradient(90deg, #34C759, ${userStats.avgAccuracy >= 80 ? "#34C759" : userStats.avgAccuracy >= 60 ? "#FF9500" : "#FF3B30"})`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-white">
                      {userStats.avgAccuracy || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-80 xl:w-96 flex-shrink-0 bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-white/90 uppercase tracking-wider">
                  Your Progress
                </h3>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  {
                    label: "Tests",
                    value: userStats.testsAttempted,
                    icon: "📝",
                  },
                  {
                    label: "Accuracy",
                    value: `${userStats.avgAccuracy || 0}%`,
                    icon: "🎯",
                  },
                  {
                    label: "Rank",
                    value: userStats.rank || "--",
                    icon: "🏆",
                  },
                  { label: "Hours", value: userStats.timeSpent, icon: "⏱️" },
                  {
                    label: "Streak",
                    value: `${userStats.streak}d`,
                    icon: "🔥",
                  },
                ].map(({ label, value, icon }) => (
                  <div
                    key={label}
                    className="text-center p-2 bg-white/10 rounded-xl"
                  >
                    <div className="text-lg mb-0.5">{icon}</div>
                    <div className="text-sm font-black text-white">{value}</div>
                    <div className="text-[8px] font-semibold text-white/60 uppercase tracking-wider">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProfileHeader;
