import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../lib/dataService";
import { Check, Crown, Zap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function ProPassCard({ onClose: _onClose }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await apiClient.get("/api/subscriptions/plans");
      setPlans(response.data.plans || []);
    } catch (err) {
      console.error("Error fetching plans:", err);
      setError("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    "All mock tests and test series",
    "Chapter-wise & sectional tests",
    "Previous year papers",
    "Live tests access",
    "Unlimited reattempts",
    "Retry wrong & unattempted questions",
    "Smart improvement tests",
    "Advanced analytics",
    "Weak topic detection",
    "Rank prediction",
    "PDF downloads",
    "Offline access",
    "Priority support",
    "Early access to new tests",
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const monthlyPlan = plans.find((p) => p.period === "monthly");
  const yearlyPlan = plans.find((p) => p.period === "yearly");

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className="w-8 h-8 text-yellow-300" />
          <h2 className="text-2xl font-bold text-white">Pro Pass</h2>
        </div>
        <p className="text-purple-100">Unlock Your Full Potential</p>
      </div>

      {/* Pricing */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Monthly Plan */}
          <div
            className={`border-2 rounded-xl p-4 ${!monthlyPlan?.popular ? "border-gray-200" : "border-purple-300"}`}
          >
            <p className="text-sm text-gray-500 mb-1">Monthly</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-400 line-through">
                ₹{monthlyPlan?.originalPrice || 999}
              </span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600">
                ₹{monthlyPlan?.price || 299}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">per month</p>
          </div>

          {/* Yearly Plan */}
          <div className="border-2 border-green-400 rounded-xl p-4 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              Most Popular
            </div>
            <p className="text-sm text-gray-500 mb-1">Yearly</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-400 line-through">
                ₹{yearlyPlan?.originalPrice || 4999}
              </span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
                ₹{yearlyPlan?.price || 999}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">per year (Save 80%)</p>
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="px-6 pb-6">
        <h3 className="font-semibold text-gray-900 mb-3">What's Included:</h3>
        <div className="grid grid-cols-1 gap-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Button */}
      <div className="px-6 pb-6">
        <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:from-purple-700 hover:to-indigo-700 transition-all">
          Get Pro Pass <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-center text-xs text-gray-500 mt-3">
          7-day money-back guarantee
        </p>
      </div>
    </div>
  );
}

export function ProPassUpgrade({ feature, onClose }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 animate-modal-pop">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-8 text-center">
          <Zap className="w-12 h-12 text-white mx-auto mb-2 animate-bounce" />
          <h2 className="text-xl font-bold text-white">Pro Pass Required</h2>
          <p className="text-white/80 text-sm mt-1">
            Unlock this feature with Pro Pass
          </p>
        </div>

        <div className="p-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-4 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>{feature}</strong> is available for Pro Pass users only.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              to="/pass"
              className="block w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-center shadow-lg transition-all"
              onClick={onClose}
            >
              Upgrade to Pro Pass
            </Link>
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SubscriptionBadge({ isProUser, _expiryDate }) {
  if (!isProUser) return null;

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-medium rounded-full">
      <Crown className="w-3 h-3" />
      Pro
    </div>
  );
}
