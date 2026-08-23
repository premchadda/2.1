import { Link } from "react-router-dom";
import {
  Crown,
  Sparkles,
  Calendar,
  Clock,
  Award,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Zap,
  Check,
  Download,
  PieChart as PieChartIcon,
  Rocket,
  LineChart,
  FileText,
  BookOpen,
  Target,
  ChevronRight,
  HelpCircle,
  Shield,
} from "lucide-react";

function ProfileProTab({ proPass, user }) {
  return (
    <div className="space-y-4" style={{ animation: "fadeIn 0.35s ease both" }}>
      {/* Main Pro Pass Status Card - Same as Pass page */}
      <div
        className={`rounded-2xl border-2 overflow-hidden ${
          proPass.isActive || proPass.isAdmin
            ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10"
            : proPass.isExpired
              ? "border-red-200 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10"
              : "border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-gray-800"
        }`}
      >
        {/* Header */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  proPass.isActive || proPass.isAdmin
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : proPass.isExpired
                      ? "bg-red-400"
                      : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <Crown
                  className={`w-7 h-7 ${proPass.isActive || proPass.isAdmin ? "text-white" : "text-gray-500 dark:text-gray-300"}`}
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {proPass.isAdmin
                    ? "Admin Access"
                    : proPass.isActive
                      ? "Pro Pass Active"
                      : proPass.isExpired
                        ? "Pro Pass Expired"
                        : "Free Plan"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {user?.name || user?.email}
                </p>
              </div>
            </div>
            <div
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                proPass.isAdmin
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                  : proPass.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : proPass.isExpired
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {proPass.isAdmin ? (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {proPass.statusText}
                </span>
              ) : proPass.isActive ? (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {proPass.statusText}
                </span>
              ) : proPass.isExpired ? (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Expired
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Free Plan
                </span>
              )}
            </div>
          </div>

          {/* Pass Details Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {proPass.isActive || proPass.isAdmin ? (
              <>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Valid Until
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {proPass.formattedExpiry || "N/A"}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Remaining
                    </span>
                  </div>
                  <p
                    className={`text-sm font-bold ${proPass.remainingDays <= 30 ? "text-red-600" : proPass.remainingDays <= 90 ? "text-amber-600" : "text-green-600"}`}
                  >
                    {proPass.isAdmin
                      ? "Unlimited"
                      : proPass.remainingDays !== null
                        ? `${proPass.remainingDays}d`
                        : "N/A"}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Award className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Plan
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {proPass.isAdmin
                      ? "Admin"
                      : proPass.remainingDays > 180
                        ? "Yearly"
                        : proPass.remainingDays > 30
                          ? "Yearly"
                          : "Monthly"}
                  </p>
                </div>
              </>
            ) : proPass.isExpired ? (
              <>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Expired On
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {proPass.formattedExpiry || "N/A"}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Days Ago
                    </span>
                  </div>
                  <p className="text-sm font-bold text-red-600">
                    {proPass.remainingDays !== null
                      ? `${Math.abs(proPass.remainingDays)}d`
                      : "N/A"}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Award className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Was
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Pro Pass
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Tests
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Limited
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Materials
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Basic
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium uppercase">
                      Analytics
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Basic
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Status-specific Actions */}
          {proPass.isActive &&
            !proPass.isAdmin &&
            proPass.isExpiringWithin(30) && (
              <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                      Renewal Suggestion
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                      Your Pro Pass{" "}
                      {proPass.remainingDays <= 7
                        ? "is expiring soon"
                        : "will expire soon"}
                      . Renew now to maintain access.
                    </p>
                    <Link
                      to="/pass"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition"
                    >
                      <RefreshCw className="w-4 h-4" /> Renew Pro Pass
                    </Link>
                  </div>
                </div>
              </div>
            )}

          {proPass.isExpired && (
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                    Pro Pass Expired
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Your Pro Pass has expired. Renew to unlock all premium
                    features.
                  </p>
                  <Link
                    to="/pass"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition"
                  >
                    <Crown className="w-4 h-4" /> Renew Now
                  </Link>
                </div>
              </div>
            </div>
          )}

          {!proPass.isProUser && !proPass.isExpired && (
            <div className="bg-gradient-to-r from-purple-50 to-amber-50 dark:from-purple-900/10 dark:to-amber-900/10 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                    Upgrade to Pro Pass
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Unlock unlimited tests, detailed solutions, PYP bank, and
                    premium study materials.
                  </p>
                  <Link
                    to="/pass"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition"
                  >
                    <Crown className="w-4 h-4" /> Get Pro Pass
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Pro Features Unlocked - Show for active users */}
          {proPass.isActive && !proPass.isExpiringWithin(30) && (
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Pro Features Unlocked
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Check, text: "Unlimited Tests" },
                  { icon: Check, text: "All Live Tests" },
                  { icon: Check, text: "PYP Bank" },
                  { icon: Check, text: "Advanced Analytics" },
                ].map(({ icon: Icon, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <Icon className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-xs font-medium">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pro Benefits */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pro Benefits
            </span>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Unlimited Test Access
              </div>
              <div className="text-xs text-gray-500">
                All premium test series
              </div>
            </div>
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center flex-shrink-0">
              <LineChart className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Advanced Analytics
              </div>
              <div className="text-xs text-gray-500">
                Deep performance insights
              </div>
            </div>
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors opacity-60">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Offline Access
              </div>
              <div className="text-xs text-gray-500">
                Download tests for offline
              </div>
            </div>
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold rounded-full flex-shrink-0">
              Soon
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors opacity-60">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center flex-shrink-0">
              <PieChartIcon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Custom Test Builder
              </div>
              <div className="text-xs text-gray-500">Create your own tests</div>
            </div>
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold rounded-full flex-shrink-0">
              Soon
            </span>
          </div>
        </div>
      </div>

      {/* Billing */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Billing
          </span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Payment Methods
              </div>
              <div className="text-xs text-gray-500">
                Manage payment options
              </div>
            </div>
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold rounded-full">
              Coming Soon
            </span>
          </div>
          <Link
            to="/pass"
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Billing History
              </div>
              <div className="text-xs text-gray-500">View invoices</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        </div>
      </div>

      {/* Help */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Help
          </span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <button
            onClick={() => window.open("https://help.trstprep.com", "_blank")}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Help Center
              </div>
              <div className="text-xs text-gray-500">Get support</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => window.open("/privacy", "_blank")}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Privacy Policy
              </div>
              <div className="text-xs text-gray-500">Read policy</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => window.open("/terms", "_blank")}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Terms of Service
              </div>
              <div className="text-xs text-gray-500">Read terms</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileProTab;
