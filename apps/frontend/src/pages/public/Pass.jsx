import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";
import { AnimatedHero } from "../../shared/components";
import { useProPass, getUrgencyColors } from "../../shared/hooks/useProPass";
import {
  Crown,
  Check,
  X,
  Zap,
  Shield,
  Star,
  ArrowRight,
  Gift,
  Clock,
  Users,
  Infinity as InfinityIcon,
  Calendar,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Award,
  BookOpen,
  FileText,
  Target,
  ChevronRight,
  RefreshCw,
  Loader2,
  CreditCard,
  QrCode,
  Smartphone,
  Building,
  CheckCircle2,
  Copy,
  CheckCircle,
  Flame,
  Tag,
} from "lucide-react";
import api from "../../shared/lib/api";
import { useConfirm } from "../../shared/components/common/ConfirmModal";
import { apiClient, getPublicStats } from "../../shared/lib/dataService";
import { toast } from "react-hot-toast";
import { usePublicSettings } from "../../shared/hooks/usePublicSettings";

function Pass() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm, ConfirmDialog } = useConfirm();
  const proPass = useProPass();
  const { isFeatureEnabled: isPublicFeatureEnabled } = usePublicSettings();
  const paymentGatewayEnabled = isPublicFeatureEnabled("paymentGateway");
  const [plans, setPlans] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(null);
  const [expandedPlans, setExpandedPlans] = useState({});
  const [platformStats, setPlatformStats] = useState({
    activeLearners: 0,
    mockTests: 0,
    satisfaction: null,
  });

  // Viewport Upgrade / Plan Modal States
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("pro-yearly");
  const [verifying, setVerifying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // Auto-open modal if requested via URL search (e.g. /pass?upgrade=true)
  useEffect(() => {
    if (
      location.search.includes("upgrade") ||
      location.hash.includes("upgrade")
    ) {
      setPlanModalOpen(true);
    }
  }, [location]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchPlatformStats = async () => {
      try {
        const stats = await getPublicStats();
        if (stats) {
          setPlatformStats({
            activeLearners: stats.activeLearners || 0,
            mockTests: stats.mockTests || 0,
            satisfaction: stats.satisfaction || null,
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch platform stats:", err);
      }
    };
    fetchPlatformStats();
    fetchPlans(false, controller.signal);

    const interval = setInterval(() => {
      fetchPlans(true);
    }, 10000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  // Get urgency colors for pro pass status
  const urgencyColors = getUrgencyColors(proPass.urgencyLevel);

  const fetchPlans = async (isBackground = false, signal) => {
    try {
      if (!isBackground) setLoading(true);
      const response = await api.get("/api/subscriptions/plans", { signal });
      const plansData = response.data?.plans;
      if (Array.isArray(plansData) && plansData.length > 0) {
        const processedPlans = plansData.map((p) => ({
          ...p,
          id: p.planId || p.id || p.plan_id,
          price: Number(p.price || 0),
          originalPrice: p.originalPrice
            ? Number(p.originalPrice)
            : p.original_price
              ? Number(p.original_price)
              : null,
          features: Array.isArray(p.features)
            ? p.features.map((f) =>
                typeof f === "object" ? f : { text: f, included: true },
              )
            : [],
        }));

        // Merge with free and defaults
        const hasFree = processedPlans.some((p) => p.id === "free");
        const merged = hasFree ? processedPlans : processedPlans;
        setPlans(merged);
      } else {
        setPlans([]);
      }
    } catch (error) {
      if (signal?.aborted) return;
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const openUpgradeModal = (planId = "pro-yearly") => {
    if (!isAuthenticated) {
      navigate(
        `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
      return;
    }
    setSelectedPlanId(planId === "free" ? "pro-yearly" : planId);
    setAppliedCoupon(null);
    setCouponInput("");
    setPlanModalOpen(true);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    const currentPlan = plans.find((p) => p.id === selectedPlanId);
    if (!currentPlan) {
      toast.error("Subscription plans are currently unavailable.");
      return;
    }
    try {
      setCouponLoading(true);
      const res = await api.post("/api/payments/apply-coupon", {
        couponCode: couponInput.trim().toUpperCase(),
        amount: currentPlan.price,
        planId: currentPlan.id,
      });
      if (res.data?.success) {
        setAppliedCoupon(res.data.data);
        toast.success(
          `Coupon "${res.data.data.code}" applied! You saved ₹${res.data.data.discount}`,
        );
      } else {
        toast.error(res.data?.message || "Invalid coupon code");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Invalid coupon code");
    } finally {
      setCouponLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleConfirmUpgrade = async () => {
    if (!isAuthenticated) {
      navigate(
        `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    const currentPlan = plans.find((p) => p.id === selectedPlanId);
    if (!currentPlan) {
      toast.error("Subscription plans are currently unavailable.");
      return;
    }
    if (currentPlan.id === "free") return;

    try {
      setVerifying(true);
      // 1. Create order
      const orderRes = await api.post("/api/payments/create-order", {
        planId: currentPlan.id,
        amount: currentPlan.price,
        couponCode: appliedCoupon?.code,
      });

      if (!orderRes.data?.success) {
        throw new Error(orderRes.data?.message || "Failed to create order");
      }

      const orderData = orderRes.data.data;
      const { orderId, keyId, isMock, amount, currency } = orderData;

      // Helper to submit verification payload
      const verifyPaymentPayload = async (payload) => {
        const verifyRes = await api.post("/api/payments/verify", {
          ...payload,
          planId: currentPlan.id,
          couponCode: appliedCoupon?.code,
        });

        if (verifyRes.data?.success) {
          toast.success(
            `🎉 Welcome to Pro Pass! ${currentPlan.name} is now active.`,
          );
          setPlanModalOpen(false);
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          toast.error(
            verifyRes.data?.message ||
              "Payment verification failed. Please try again.",
          );
        }
      };

      // If mock order / development sandbox fallback
      if (
        isMock ||
        !keyId ||
        keyId.includes("mock") ||
        keyId.includes("sandbox")
      ) {
        await verifyPaymentPayload({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_mock_${Date.now()}_${user?.id || 1}`,
          razorpay_signature: `sig_sandbox_${Date.now()}`,
        });
        return;
      }

      // 2. Real Razorpay Modal Integration
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error(
          "Failed to load payment gateway. Please check your internet connection.",
        );
      }

      const options = {
        key: keyId,
        amount: amount,
        currency: currency || "INR",
        name: "Trstprep Exam Platform",
        description: `Pro Pass Subscription (${currentPlan.name})`,
        order_id: orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
          method: paymentMethod || "upi",
        },
        theme: {
          color: "#f59e0b",
        },
        handler: async (response) => {
          try {
            setVerifying(true);
            await verifyPaymentPayload({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
          } catch (err) {
            console.error("Verification error:", err);
            toast.error(
              err.response?.data?.message ||
                err.message ||
                "Payment verification failed.",
            );
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setVerifying(false);
            toast.info("Payment cancelled");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setVerifying(false);
        toast.error(
          response.error?.description || "Payment failed. Please try again.",
        );
      });
      rzp.open();
    } catch (err) {
      console.error("Upgrade verification error:", err);
      const msg = err.response?.data?.message || err.message || "";
      if (
        err.response?.status === 503 ||
        msg.toLowerCase().includes("not configured") ||
        msg.toLowerCase().includes("disabled")
      ) {
        toast(
          "🚀 Online payment gateway is launching soon! You have been added to our VIP early-access priority list.",
          {
            icon: "✨",
            duration: 5000,
          },
        );
        setPlanModalOpen(false);
      } else {
        toast.error(msg || "Payment processing failed. Please try again.");
      }
      setVerifying(false);
    }
  };

  const currentSelectedPlan =
    plans.find((p) => p.id === selectedPlanId) || null;
  // P2 FIX: use server-validated finalAmount when available (includes tax rounding), fallback to client discount calc
  const finalPrice =
    appliedCoupon?.finalAmount != null
      ? Math.max(0, Number(appliedCoupon.finalAmount))
      : appliedCoupon
        ? Math.max(
            0,
            Number(currentSelectedPlan?.price || 0) -
              Number(appliedCoupon.discount || 0),
          )
        : Number(currentSelectedPlan?.price || 0);

  const isMonthlyUser = Boolean(
    user?.subscription_plan === "pro-monthly" ||
    user?.subscription_tier === "monthly" ||
    user?.plan === "monthly",
  );
  const isYearlyUser = Boolean(
    user?.subscription_plan === "pro-yearly" ||
    user?.subscription_tier === "yearly" ||
    user?.plan === "yearly" ||
    (proPass.isActive && !isMonthlyUser && !proPass.isAdmin),
  );
  const isTopTierUser = Boolean(proPass.isAdmin || isYearlyUser);

  const getPlanButtonState = (planId) => {
    if (proPass.isAdmin) {
      return {
        text: "Included in Admin",
        disabled: false,
        onClick: () => navigate("/tests"),
        className:
          "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:opacity-90",
      };
    }

    if (planId === "free") {
      return {
        text: proPass.isProUser ? "Included" : "Current Plan",
        disabled: true,
        onClick: null,
        className: "bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-default",
      };
    }

    if (!paymentGatewayEnabled) {
      return {
        text: "Payment unavailable",
        disabled: true,
        onClick: null,
        className:
          "bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed",
      };
    }

    if (planId === "pro-monthly") {
      if (isYearlyUser && proPass.isActive) {
        return {
          text: "Included in Yearly",
          disabled: true,
          onClick: null,
          className:
            "bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-default",
        };
      }
      if (isMonthlyUser && proPass.isActive) {
        return {
          text: "Current Plan",
          disabled: true,
          onClick: null,
          className:
            "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 cursor-default border border-purple-300",
        };
      }
      return {
        text: "Get Started",
        disabled: false,
        onClick: () => openUpgradeModal("pro-monthly"),
        className:
          "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-glow",
      };
    }

    if (planId === "pro-yearly") {
      if (isYearlyUser && proPass.isActive) {
        return {
          text: "Current Plan",
          disabled: true,
          onClick: null,
          className:
            "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 cursor-default border border-amber-300",
        };
      }
      if (isMonthlyUser && proPass.isActive) {
        return {
          text: "Upgrade to Yearly (Save 80%)",
          disabled: false,
          onClick: () => openUpgradeModal("pro-yearly"),
          className:
            "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg",
        };
      }
      return {
        text: "Get Started",
        disabled: false,
        onClick: () => openUpgradeModal("pro-yearly"),
        className:
          "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg",
      };
    }

    return {
      text: "Select Plan",
      disabled: false,
      onClick: () => openUpgradeModal(planId),
      className: "bg-purple-600 text-white",
    };
  };

  const benefits = [
    {
      icon: InfinityIcon,
      title: "Unlimited Tests",
      desc: `Access ${platformStats.mockTests || 0} tests across all exams`,
    },
    {
      icon: Zap,
      title: "Instant Results",
      desc: "Get detailed analysis immediately",
    },
    {
      icon: Shield,
      title: "All India Rank",
      desc: "Compare with lakhs of students",
    },
    {
      icon: Gift,
      title: "Exclusive Content",
      desc: "Access premium study materials",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 page-transition fade-in">
      {ConfirmDialog}
      <Helmet>
        <title>Pro Pass | Trstprep</title>
        <meta
          name="description"
          content="Upgrade to Trstprep Pro Pass for unlimited access to all test series, live tests, and premium features."
        />
        <meta property="og:title" content="Pro Pass | Trstprep" />
        <meta
          property="og:description"
          content="Upgrade to Trstprep Pro Pass for unlimited access to all test series and premium features."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>

      {/* Hero Section with Animated Background */}
      <AnimatedHero pageType="pass">
        <div className="text-center px-2 sm:px-4 py-2 sm:py-4">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 bg-white/20 backdrop-blur-sm rounded-full mb-3 sm:mb-4 animate-shimmer">
            <Crown className="w-4 h-4 text-amber-300" />
            <span className="font-semibold text-xs sm:text-sm text-white">
              {proPass.isAdmin
                ? "Admin Unlimited Access Active"
                : isYearlyUser && proPass.isActive
                  ? "Pro Pass Yearly Active"
                  : isMonthlyUser && proPass.isActive
                    ? "Pro Pass Monthly Active"
                    : "Trstprep Pro Pass"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-2.5 sm:mb-4 animate-slide-up text-white tracking-tight">
            {proPass.isAdmin
              ? "Welcome, Administrator"
              : isTopTierUser
                ? "Your Pro Pass is Active"
                : isMonthlyUser && proPass.isActive
                  ? "Upgrade to Annual Pro"
                  : "Unlock Your Full Potential"}
          </h1>

          <p
            className="text-white/80 text-xs sm:text-sm md:text-base max-w-xl mx-auto mb-4 sm:mb-6 animate-slide-up leading-relaxed"
            style={{ animationDelay: "0.1s" }}
          >
            {proPass.isAdmin
              ? "You have unrestricted access to all tests, question banks, study materials, and analytics."
              : isTopTierUser
                ? "Enjoy unlimited access to all test series, previous year papers, and premium analytics."
                : isMonthlyUser && proPass.isActive
                  ? "Save 80% with Pro Yearly and unlock uninterrupted practice all year long."
                  : "Get unlimited access to all tests, study materials, and premium features to crack your dream exam."}
          </p>

          <div className="mt-4 sm:mt-6 flex flex-row items-center justify-center gap-2 sm:gap-4 w-full max-w-sm sm:max-w-none mx-auto">
            {isTopTierUser ? (
              <>
                <Link
                  to="/tests"
                  className="flex-1 sm:flex-initial px-3.5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>Explore All Tests</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                </Link>
                <Link
                  to="/practice"
                  className="flex-1 sm:flex-initial px-3.5 sm:px-5 py-2.5 sm:py-3 bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-white/20 backdrop-blur-md transition-all flex items-center justify-center whitespace-nowrap"
                >
                  Practice Lab
                </Link>
              </>
            ) : isMonthlyUser && proPass.isActive ? (
              <button
                onClick={() => openUpgradeModal("pro-yearly")}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                Upgrade to Pro Yearly (Save 80%)
              </button>
            ) : (
              <button
                onClick={() => openUpgradeModal("pro-yearly")}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                Upgrade to Pro Pass
              </button>
            )}
          </div>
        </div>
      </AnimatedHero>

      {/* Benefits */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 -mt-4 sm:-mt-6 lg:-mt-8 relative z-10">
        <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 p-3.5 sm:p-5 lg:p-6 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
          {benefits.map((b, i) => (
            <div key={i} className="text-center p-1 sm:p-2">
              <div className="w-9 h-9 sm:w-11 sm:h-11 mx-auto mb-2 rounded-lg sm:rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                <b.icon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm mb-0.5 sm:mb-1">
                {b.title}
              </h3>
              <p className="text-[10.5px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2 sm:line-clamp-none">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Current Pass Status Section - Show for logged in users */}
      {isAuthenticated && (
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 relative">
          {/* Ambient Glow Background Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl opacity-80 pointer-events-none animate-pulse transition-opacity duration-1000" />

          <div
            className={`relative rounded-2xl sm:rounded-3xl border-2 ${urgencyColors.border} ${urgencyColors.bg} p-4 sm:p-6 md:p-8 backdrop-blur-xl shadow-xl overflow-hidden transition-all duration-500 hover:shadow-purple-500/10`}
          >
            {/* Shimmering Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-shimmer opacity-80" />

            {/* Header with status badge */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 relative z-10">
              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center relative group shadow-md flex-shrink-0 ${
                    proPass.isActive || proPass.isAdmin
                      ? "bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-amber-500/30"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <Crown
                    className={`w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:scale-110 ${
                      proPass.isActive || proPass.isAdmin
                        ? "text-white drop-shadow-md"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">
                      {proPass.isAdmin
                        ? "Admin Access"
                        : proPass.isActive
                          ? "Pro Pass Active"
                          : proPass.isExpired
                            ? "Pro Pass Expired"
                            : "Free Plan"}
                    </h2>
                    {proPass.isAdmin && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-600 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                        Super User
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium">
                    {user?.name || user?.email}
                  </p>
                </div>
              </div>

              {/* Status Pill with Animated Pulse Radar */}
              <div
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm border self-start sm:self-auto ${
                  proPass.isAdmin
                    ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-amber-400/50"
                    : `${urgencyColors.badge} border-white/20`
                }`}
              >
                <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      proPass.isAdmin || proPass.isActive
                        ? "bg-emerald-400"
                        : "bg-red-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 ${
                      proPass.isAdmin || proPass.isActive
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    }`}
                  />
                </span>
                {proPass.isAdmin ? (
                  <span className="flex items-center gap-1 font-extrabold tracking-wide text-xs sm:text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
                    Unlimited Admin Access
                  </span>
                ) : proPass.isActive ? (
                  <span className="flex items-center gap-1 text-xs sm:text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    {proPass.statusText}
                  </span>
                ) : proPass.isExpired ? (
                  <span className="flex items-center gap-1 text-xs sm:text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Expired
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs sm:text-sm">
                    <Target className="w-3.5 h-3.5" />
                    Free Plan
                  </span>
                )}
              </div>
            </div>

            {/* Pass details interactive grid with hover elevation & smooth animation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-4 sm:mb-6 relative z-10">
              {proPass.isActive || proPass.isAdmin ? (
                <>
                  {/* Tile 1: Valid Until */}
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 group">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                      <div className="w-6 h-6 rounded-md sm:rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-300">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                        Valid Until
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight">
                      {proPass.isAdmin ? (
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                          Unlimited (Lifetime)
                        </span>
                      ) : (
                        proPass.formattedExpiry || "N/A"
                      )}
                    </p>
                  </div>

                  {/* Tile 2: Days Remaining */}
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 group">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                      <div className="w-6 h-6 rounded-md sm:rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-300">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                        Days Remaining
                      </span>
                    </div>
                    <p
                      className={`text-sm sm:text-base font-black tracking-tight ${proPass.isAdmin ? "text-amber-500 dark:text-amber-400" : urgencyColors.text}`}
                    >
                      {proPass.isAdmin ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span>Unlimited</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                            No Expiry
                          </span>
                        </span>
                      ) : proPass.remainingDays !== null ? (
                        `${proPass.remainingDays} days remaining`
                      ) : (
                        "Unlimited"
                      )}
                    </p>
                  </div>

                  {/* Tile 3: Plan Type */}
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 group">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                      <div className="w-6 h-6 rounded-md sm:rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                        <Award className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                        Plan Type
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-1.5">
                      {proPass.isAdmin ? (
                        <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent font-black">
                          Admin Unlimited 👑
                        </span>
                      ) : isMonthlyUser ? (
                        "Pro Pass Monthly"
                      ) : (
                        "Pro Pass Yearly ⚡"
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 group">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                      <div className="w-6 h-6 rounded-md sm:rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                        Free Tests
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight">
                      3 Free Attempts
                    </p>
                  </div>
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 group">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                      <div className="w-6 h-6 rounded-md sm:rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-300">
                        <BookOpen className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                        Study Materials
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight">
                      Limited Access
                    </p>
                  </div>
                  <div className="bg-white/75 dark:bg-gray-800/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/40 dark:border-gray-700/50 shadow-sm transition-all duration-300 group">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">
                      <div className="w-6 h-6 rounded-md sm:rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-300">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                        Analytics
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight">
                      Basic Only
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Suggestions & Upgrade CTA - only show if user is on lower plan */}
            {!isTopTierUser && (
              <div className="bg-gradient-to-r from-purple-50 to-amber-50 dark:from-purple-950/40 dark:to-amber-950/40 rounded-xl p-3 sm:p-4 border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm mb-1">
                      {isMonthlyUser
                        ? "Upgrade to Pro Yearly"
                        : "Upgrade to Pro Pass"}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-2.5 leading-relaxed">
                      {isMonthlyUser
                        ? "Save 80% on annual subscription and get uninterrupted test practice all year."
                        : "Unlock unlimited tests, detailed solutions, previous year papers, and premium study materials. Get ahead of the competition with Pro features!"}
                    </p>
                    <div className="flex flex-row gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => openUpgradeModal("pro-yearly")}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm hover:shadow-md transition-all active:scale-95 whitespace-nowrap"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        {isMonthlyUser ? "Upgrade (80% OFF)" : "Upgrade to Pro"}
                      </button>
                      <Link
                        to="/tests"
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 sm:px-3.5 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg sm:rounded-xl font-semibold text-[11px] sm:text-sm hover:bg-gray-50 transition border border-gray-200 dark:border-gray-700 whitespace-nowrap"
                      >
                        Explore Free
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Cards Section */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-1.5 sm:mb-2">
          Choose Your Plan
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 text-xs sm:text-sm max-w-lg mx-auto mb-6 sm:mb-8">
          Select the perfect plan to elevate your test preparation and unlock
          unlimited mock tests and full solutions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          {plans.map((plan) => {
            const btnState = getPlanButtonState(plan.id);
            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-900 rounded-2xl border-2 p-4 sm:p-5 lg:p-6 flex flex-col h-full transition-all ${
                  plan.popular
                    ? "border-amber-400 dark:border-amber-500 shadow-lg ring-2 ring-amber-400/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-purple-500 hover:shadow-md"
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] sm:text-xs font-black tracking-wider uppercase rounded-full shadow-md whitespace-nowrap">
                    MOST POPULAR • 80% OFF
                  </div>
                )}

                {/* Savings Badge */}
                {plan.savings && !plan.popular && (
                  <div className="absolute top-3.5 right-3.5 px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-[10px] sm:text-xs font-bold rounded-lg">
                    {plan.savings}
                  </div>
                )}

                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1.5 sm:mb-2">
                  {plan.name}
                </h3>

                <div className="mb-3 sm:mb-4">
                  {plan.originalPrice && (
                    <span className="text-gray-400 line-through text-xs sm:text-sm mr-1.5 font-medium">
                      ₹{plan.originalPrice}
                    </span>
                  )}
                  <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                    ₹{plan.price}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm ml-1 font-medium">
                    {plan.period}
                  </span>
                </div>

                <div className="mb-4 py-1.5 px-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-lg sm:rounded-xl border border-purple-100 dark:border-purple-900/50 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-bold text-purple-900 dark:text-purple-300">
                    {plan.id === "free"
                      ? "3 Free Test Attempts Allowed"
                      : "Unlimited Test Attempts Allowed"}
                  </span>
                </div>

                <ul className="space-y-2 mb-4 sm:mb-6 flex-1">
                  {(expandedPlans[plan.id]
                    ? plan.features
                    : plan.features.slice(0, 6)
                  ).map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 sm:gap-2">
                      {f.included ? (
                        <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-xs ${f.included ? "text-gray-700 dark:text-gray-300 font-medium" : "text-gray-400 dark:text-gray-600"}`}
                      >
                        {f.text}
                      </span>
                    </li>
                  ))}
                  {plan.features.length > 6 && (
                    <button
                      onClick={() =>
                        setExpandedPlans((prev) => ({
                          ...prev,
                          [plan.id]: !prev[plan.id],
                        }))
                      }
                      className="text-purple-600 dark:text-purple-400 text-xs font-bold mt-1 hover:underline inline-block text-left"
                    >
                      {expandedPlans[plan.id]
                        ? "Show less"
                        : `+ ${plan.features.length - 6} more features`}
                    </button>
                  )}
                </ul>

                <button
                  className={`w-full py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 mt-auto shadow-sm ${btnState.className}`}
                  disabled={btnState.disabled}
                  onClick={btnState.onClick}
                >
                  {btnState.text}
                  {!btnState.disabled && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-white mb-4 sm:mb-6">
          Frequently Asked Questions
        </h2>
        <div className="space-y-2.5 sm:space-y-3.5">
          {[
            {
              q: "What happens after I subscribe?",
              a: "You get instant access to all Pro features. All tests and study materials will be unlocked immediately.",
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes, you can cancel your subscription anytime. Your access will continue until the end of your billing period.",
            },
            {
              q: "Is there a refund policy?",
              a: "Yes, we offer a 7-day money-back guarantee. No questions asked.",
            },
          ].map((faq, i) => (
            <details
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 p-3.5 sm:p-4 group"
            >
              <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer list-none flex items-center justify-between text-xs sm:text-sm">
                {faq.q}
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
              </summary>
              <p className="mt-2 sm:mt-3 text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 VIEWPORT-CENTERED "CHOOSE YOUR PLAN & UPGRADE" MODAL WINDOW           */}
      {/* ========================================================================= */}
      {planModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[94vh] max-h-[94dvh] animate-scale-up">
              {/* Modal Top Header */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner flex-shrink-0">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2">
                      Choose Your Plan
                      {plans.find(
                        (plan) => plan.popular || plan.badge || plan.savings,
                      ) && (
                        <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-black bg-amber-400 text-gray-900 rounded-full uppercase tracking-wider">
                          {plans.find((plan) => plan.popular)?.badge ||
                            plans.find((plan) => plan.popular)?.savings ||
                            plans.find((plan) => plan.badge)?.badge ||
                            plans.find((plan) => plan.savings)?.savings}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-purple-100 line-clamp-1 sm:line-clamp-none">
                      Subscription features and pricing are loaded from the
                      server.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPlanModalOpen(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white flex-shrink-0"
                  title="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Modal Body: Scrollable Plan Selection Grid */}
              <div className="p-3.5 sm:p-5 md:p-6 overflow-y-auto space-y-3.5 sm:space-y-5">
                {/* Plan Cards Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {plans.length > 0 ? (
                    plans.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          selectedPlanId === plan.id
                            ? "border-purple-600 bg-purple-50/40 dark:bg-purple-950/20 shadow-md ring-2 ring-purple-500/30"
                            : "border-gray-200 dark:border-gray-800 hover:border-purple-300"
                        }`}
                      >
                        {(plan.badge || plan.savings) && (
                          <div className="absolute -top-2.5 right-2.5 px-2 py-0.5 bg-purple-600 text-white text-[9px] sm:text-[10px] font-bold rounded-full">
                            {plan.badge || plan.savings}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                            <span className="font-extrabold text-gray-900 dark:text-white text-sm sm:text-base">
                              {plan.name}
                            </span>
                            <input
                              type="radio"
                              name="plan_choice"
                              checked={selectedPlanId === plan.id}
                              onChange={() => setSelectedPlanId(plan.id)}
                              className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                            />
                          </div>
                          <div className="mb-2 sm:mb-3">
                            {plan.originalPrice != null && (
                              <span className="text-gray-400 line-through text-xs mr-1 font-medium">
                                ₹{plan.originalPrice}
                              </span>
                            )}
                            <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                              ₹{plan.price}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 font-medium">
                              {plan.period}
                            </span>
                          </div>
                          {plan.attemptsInfo && (
                            <div className="p-1.5 sm:p-2 bg-purple-100/60 dark:bg-purple-900/40 rounded-lg text-[10px] sm:text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-2.5 sm:mb-3 flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              {plan.attemptsInfo}
                            </div>
                          )}
                          <ul className="space-y-1 text-[11px] sm:text-xs text-gray-700 dark:text-gray-300">
                            {(plan.features || [])
                              .slice(0, 6)
                              .map((feature, index) => (
                                <li
                                  key={index}
                                  className="flex items-center gap-1.5"
                                >
                                  {feature.included === false ? (
                                    <X className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                  )}
                                  {typeof feature === "string"
                                    ? feature
                                    : feature.text}
                                </li>
                              ))}
                          </ul>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPlanId(plan.id)}
                          className="mt-3 w-full py-1.5 sm:py-2 text-xs font-bold rounded-lg sm:rounded-xl bg-purple-600 text-white transition-all"
                        >
                          {selectedPlanId === plan.id
                            ? "Selected Plan"
                            : `Select ${plan.name}`}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="md:col-span-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Subscription plans are currently unavailable.
                    </p>
                  )}
                </div>

                {/* Coupon & Payment Details Bar */}
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700/60 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-center">
                  {/* Coupon Code Input */}
                  <div>
                    <label className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                      Have a Discount Coupon?
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter code (e.g. TRST50)"
                        value={couponInput}
                        onChange={(e) =>
                          setCouponInput(e.target.value.toUpperCase())
                        }
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase font-mono tracking-wider focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="px-3 py-1.5 text-xs font-bold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {couponLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Apply"
                        )}
                      </button>
                    </div>
                    {appliedCoupon && (
                      <div className="text-[10.5px] text-green-600 dark:text-green-400 flex items-center gap-1 font-medium mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Coupon{" "}
                        <strong>{appliedCoupon.code}</strong> applied (-₹
                        {appliedCoupon.discount})
                      </div>
                    )}
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                      Select Preferred Payment Mode
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("upi")}
                        className={`py-1.5 sm:py-2 px-2 rounded-lg sm:rounded-xl border text-center transition-all flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold ${
                          paymentMethod === "upi"
                            ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/20"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" /> UPI/QR
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("card")}
                        className={`py-1.5 sm:py-2 px-2 rounded-lg sm:rounded-xl border text-center transition-all flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold ${
                          paymentMethod === "card"
                            ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/20"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("netbanking")}
                        className={`py-1.5 sm:py-2 px-2 rounded-lg sm:rounded-xl border text-center transition-all flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold ${
                          paymentMethod === "netbanking"
                            ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/20"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                        }`}
                      >
                        <Building className="w-3.5 h-3.5" /> NetBank
                      </button>
                    </div>

                    {/* Dynamic Method Helper / Supported Channels */}
                    <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs">
                      {paymentMethod === "upi" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10.5px] font-semibold text-gray-700 dark:text-gray-300">
                            <span>Supported UPI Apps & QR:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              Zero Fee
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              GPay
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              PhonePe
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              Paytm
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-purple-700 dark:text-purple-300 font-semibold">
                              UPI QR
                            </span>
                          </div>
                        </div>
                      )}

                      {paymentMethod === "card" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10.5px] font-semibold text-gray-700 dark:text-gray-300">
                            <span>Debit &amp; Credit Cards:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              256-Bit SSL
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              Visa
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              MasterCard
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              RuPay
                            </span>
                          </div>
                        </div>
                      )}

                      {paymentMethod === "netbanking" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10.5px] font-semibold text-gray-700 dark:text-gray-300">
                            <span>Popular Indian Banks:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              50+ Banks
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              SBI
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              HDFC
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              ICICI
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-semibold">
                              Axis
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Bottom Action Footer */}
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Shield className="w-3.5 h-3.5 text-green-500" />
                    <span>256-Bit SSL Encrypted</span>
                  </div>
                  <div className="text-right sm:text-left">
                    <span className="text-xs text-gray-500">Total: </span>
                    <span className="text-base sm:text-lg font-black text-purple-700 dark:text-purple-400">
                      ₹{finalPrice}
                    </span>
                    {currentSelectedPlan.originalPrice && (
                      <span className="text-xs text-gray-400 line-through ml-1">
                        ₹{currentSelectedPlan.originalPrice}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPlanModalOpen(false)}
                    className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUpgrade}
                    disabled={verifying}
                    className="flex-1 sm:flex-initial px-5 sm:px-7 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Activating Pro Pass...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay ₹{finalPrice} & Activate Pro</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default Pass;
