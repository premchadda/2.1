import { useState, useEffect } from "react";
import {
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  Globe,
  Shield,
  Users,
  CreditCard,
  Bell,
  Mail,
  Key,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Wrench,
  Clock,
  Radio,
} from "lucide-react";
import { apiClient } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";

export default function SiteSettingsManager() {
  const [settings, setSettings] = useState({
    siteName: "Trstprep",
    siteDescription:
      "Comprehensive test preparation platform for government exams",
    siteLogo: "",
    siteFavicon: "",
    siteUrl: "https://trstprep.com",
    metaTitle: "Trstprep - SSC & Railway Test Series",
    metaDescription:
      "Best online test series for SSC, Railway, Banking and other government exams",
    keywords:
      "ssc, railway, banking, government exams, test series, mock tests",
    contactEmail: "",
    contactPhone: "",
    address: "123 Education Street, City, State 123456",
    socialLinks: {
      facebook: "",
      twitter: "",
      instagram: "",
      linkedin: "",
      youtube: "",
    },
    features: {
      userRegistration: true,
      emailVerification: true,
      smsNotifications: false,
      paymentGateway: true,
      analytics: true,
      seoEnabled: true,
      demoMode: false,
      botProtection: true,
      blockDisposableEmails: true,
      verifyEmailMx: true,
      enforceDomainAllowlist: false,
    },
    maintenance: {
      enabled: false,
      message:
        "We're performing scheduled maintenance to improve your experience.",
      endTime: "",
      allowAdminAccess: true,
      estimatedDowntime: "30 minutes",
    },
    comingSoon: {
      // Page-level
      liveTests: {
        enabled: false,
        title: "Live Tests",
        message: "We're preparing exciting live tests for you!",
        estimatedTime: "Coming in 2 weeks",
        icon: "Radio",
        type: "page",
      },
      practiceQuestions: {
        enabled: false,
        title: "Practice Questions",
        message: "Our question bank is being updated with latest patterns.",
        estimatedTime: "Available soon",
        icon: "Target",
        type: "page",
      },
      videos: {
        enabled: false,
        title: "Video Lectures",
        message: "High-quality video lectures are being recorded.",
        estimatedTime: "Coming in 1 month",
        icon: "Video",
        type: "page",
      },
      currentAffairs: {
        enabled: false,
        title: "Current Affairs",
        message: "Daily current affairs will be available here.",
        estimatedTime: "Available daily at 8 AM",
        icon: "Newspaper",
        type: "page",
      },
      doubtForum: {
        enabled: false,
        title: "Doubt Forum",
        message: "Community doubt resolution feature coming soon!",
        estimatedTime: "Coming in 3 weeks",
        icon: "MessageCircle",
        type: "page",
      },
      studyGroups: {
        enabled: false,
        title: "Study Groups",
        message: "Join study groups and learn together.",
        estimatedTime: "Coming in 1 month",
        icon: "Users",
        type: "page",
      },
      achievements: {
        enabled: false,
        title: "Achievements & Badges",
        message: "Earn badges for your accomplishments!",
        estimatedTime: "Available now",
        icon: "Award",
        type: "page",
      },
      referAndEarn: {
        enabled: false,
        title: "Refer & Earn",
        message: "Invite friends and earn rewards.",
        estimatedTime: "Coming soon",
        icon: "Gift",
        type: "page",
      },
      // Section-level (within a page)
      "leaderboard:performance": {
        enabled: false,
        title: "Performance Rankings",
        message: "Performance rankings are being calculated.",
        estimatedTime: "Available soon",
        icon: "Trophy",
        type: "section",
      },
      "analysis:difficulty": {
        enabled: false,
        title: "Difficulty Analysis",
        message: "Difficulty breakdown is being analyzed.",
        estimatedTime: "Available soon",
        icon: "Gauge",
        type: "section",
      },
      "analysis:speedMatrix": {
        enabled: false,
        title: "Speed Matrix",
        message: "Speed vs accuracy matrix coming soon.",
        estimatedTime: "Available soon",
        icon: "Wind",
        type: "section",
      },
      "community:discussions": {
        enabled: false,
        title: "Group Discussions",
        message: "Discussions feature is being built.",
        estimatedTime: "Coming soon",
        icon: "FileText",
        type: "section",
      },
      "dashboard:aiPlanner": {
        enabled: false,
        title: "AI Study Planner",
        message: "AI-powered study planner is being configured.",
        estimatedTime: "Coming soon",
        icon: "Brain",
        type: "section",
      },
      "profile:customTests": {
        enabled: false,
        title: "Custom Test Builder",
        message: "Create your own tests — coming soon.",
        estimatedTime: "Coming soon",
        icon: "PieChart",
        type: "section",
      },
    },
    appearance: {
      primaryColor: "#667eea",
      secondaryColor: "#764ba2",
      theme: "light",
      fontFamily: "Inter, sans-serif",
      logoPosition: "left",
    },
    security: {
      passwordMinLength: 8,
      passwordComplexity: true,
      twoFactorAuth: false,
      ipWhitelist: [],
      maxLoginAttempts: 5,
      // 0 = use server default (3-day idle timeout)
      sessionTimeout: 0,
      allowedEmailDomains:
        "gmail.com, outlook.com, hotmail.com, yahoo.com, yahoo.co.in, icloud.com, proton.me, protonmail.com, zoho.com, rediffmail.com, *.edu, *.ac.in, *.edu.in, *.res.in, *.gov.in",
    },
    email: {
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUsername: "",
      smtpPassword: "",
      fromEmail: "noreply@trstprep.com",
      fromName: "Trstprep",
      encryption: "tls",
    },
    payment: {
      stripePublicKey: "",
      stripeSecretKey: "",
      razorpayKeyId: "",
      razorpayKeySecret: "",
      paypalClientId: "",
      paypalClientSecret: "",
      currency: "INR",
      taxEnabled: false,
      taxRate: 0,
    },
    notifications: {
      emailOnRegistration: true,
      emailOnPayment: true,
      smsOnOrder: false,
      pushNotifications: true,
      notificationFrequency: "instant",
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("general");
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState(null);
  const [showPassword, setShowPassword] = useState({});
  const [maskedFields, setMaskedFields] = useState({});

  const SENSITIVE_FIELD_PATTERNS = [
    "secret",
    "password",
    "token",
    "apikey",
    "keyid",
    "keysecret",
    "publickey",
    "privatekey",
  ];

  const isSensitiveField = (fieldName) => {
    const fn = fieldName.toLowerCase();
    if (fn === "keywords" || fn === "seokeywords") return false;
    return SENSITIVE_FIELD_PATTERNS.some((pattern) => fn.includes(pattern));
  };

  const maskSecret = (value) => {
    if (!value || value.length <= 4) return "••••";
    return "••••" + value.slice(-4);
  };

  const maskSettingsSecrets = (obj, prefix = "") => {
    const masked = {};
    const maskedPaths = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const { result, paths } = maskSettingsSecrets(value, fullPath);
        masked[key] = result;
        Object.assign(maskedPaths, paths);
      } else if (typeof value === "string" && isSensitiveField(key) && value) {
        masked[key] = maskSecret(value);
        maskedPaths[fullPath] = true;
      } else {
        masked[key] = value;
      }
    }
    return { result: masked, paths: maskedPaths };
  };

  const stripUnchangedSecrets = (settingsToSave) => {
    const cleaned = structuredClone(settingsToSave);
    for (const path of Object.keys(maskedFields)) {
      const keys = path.split(".");
      let current = cleaned;
      let found = true;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          found = false;
          break;
        }
        current = current[keys[i]];
      }
      if (found && current[keys[keys.length - 1]]) {
        const val = current[keys[keys.length - 1]];
        if (val && val.startsWith("••••")) {
          delete current[keys[keys.length - 1]];
        }
      }
    }
    return cleaned;
  };

  const handleTestEmail = async () => {
    try {
      setTestingEmail(true);
      setEmailTestResult(null);
      const response = await apiClient.post("/admin/settings/test-email", {
        testTo: settings.email.fromEmail,
      });
      setEmailTestResult({
        success: true,
        message: response.data.message || "Test email sent successfully",
      });
    } catch (error) {
      setEmailTestResult({
        success: false,
        message: error.response?.data?.message || "Failed to send test email",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/admin/settings");
      if (response.data.success && response.data.data) {
        const fetchedSettings = response.data.data;
        // Normalize snake_case feature keys to camelCase to match defaults
        const fetchedFeatures = fetchedSettings.features || {};
        const normalizedFeatures = {};
        const snakeToCamel = (s) =>
          s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        for (const [key, value] of Object.entries(fetchedFeatures)) {
          normalizedFeatures[snakeToCamel(key)] = value;
        }
        const { result: maskedSettings, paths: maskedPaths } =
          maskSettingsSecrets(fetchedSettings);
        setMaskedFields(maskedPaths);
        setSettings((prev) => ({
          ...prev,
          ...maskedSettings,
          // Reverse of the save mapping: backend persists seoTitle/
          // seoDescription/seoKeywords; form binds metaTitle/metaDescription/keywords
          metaTitle: maskedSettings.seoTitle ?? prev.metaTitle,
          metaDescription:
            maskedSettings.seoDescription ?? prev.metaDescription,
          keywords: maskedSettings.seoKeywords ?? prev.keywords,
          socialLinks: {
            ...prev.socialLinks,
            ...(maskedSettings.socialLinks || {}),
          },
          features: { ...prev.features, ...normalizedFeatures },
          maintenance: {
            ...prev.maintenance,
            ...(maskedSettings.maintenance || {}),
          },
          comingSoon: {
            ...prev.comingSoon,
            ...(maskedSettings.comingSoon || maskedSettings.coming_soon || {}),
          },
          appearance: {
            ...prev.appearance,
            ...(maskedSettings.appearance || {}),
          },
          security: { ...prev.security, ...(maskedSettings.security || {}) },
          email: { ...prev.email, ...(maskedSettings.email || {}) },
          payment: { ...prev.payment, ...(maskedSettings.payment || {}) },
          notifications: {
            ...prev.notifications,
            ...(maskedSettings.notifications || {}),
          },
        }));
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);

      // Flatten nested settings objects to match the backend's flat whitelist.
      // The backend (admin-settings.js) accepts top-level keys like `smtpHost`,
      // `razorpayKeyId`, `seoTitle`, `maxLoginAttempts` — NOT nested objects.
      // Also maps frontend field names to backend field names:
      //   metaTitle → seoTitle, metaDescription → seoDescription, keywords → seoKeywords
      const cleaned = stripUnchangedSecrets(settings);
      const payload = {
        // Top-level flat fields
        siteName: cleaned.siteName,
        siteDescription: cleaned.siteDescription,
        siteUrl: cleaned.siteUrl,
        contactEmail: cleaned.contactEmail,
        contactPhone: cleaned.contactPhone,
        address: cleaned.address,
        // SEO — frontend uses metaTitle/metaDescription/keywords, backend uses seoTitle/seoDescription/seoKeywords
        seoTitle: cleaned.metaTitle,
        seoDescription: cleaned.metaDescription,
        seoKeywords: cleaned.keywords,
        // Tab objects sent in full
        socialLinks: cleaned.socialLinks,
        features: cleaned.features,
        maintenance: cleaned.maintenance || settings.maintenance,
        comingSoon: cleaned.comingSoon || settings.comingSoon,
        appearance: cleaned.appearance,
        security: cleaned.security,
        email: cleaned.email,
        payment: cleaned.payment,
        notifications: cleaned.notifications,
        allowedEmailDomains: cleaned.security?.allowedEmailDomains,
        // Frontend stores siteLogo/siteFavicon; backend keys are logoUrl/faviconUrl
        ...(settings.siteLogo ? { logoUrl: settings.siteLogo } : {}),
        ...(settings.siteFavicon ? { faviconUrl: settings.siteFavicon } : {}),
        // Flatten email.* → top-level smtp* fields for backward compatibility
        smtpHost: cleaned.email?.smtpHost,
        smtpPort: cleaned.email?.smtpPort
          ? Number(cleaned.email.smtpPort)
          : undefined,
        smtpUsername: cleaned.email?.smtpUsername,
        smtpPassword: cleaned.email?.smtpPassword,
        smtpSecure:
          cleaned.email?.encryption === "tls" ||
          cleaned.email?.encryption === "ssl",
        fromEmail: cleaned.email?.fromEmail,
        fromName: cleaned.email?.fromName,
        // Flatten payment.* → top-level razorpay* / google* fields
        razorpayKeyId: cleaned.payment?.razorpayKeyId,
        razorpayKeySecret: cleaned.payment?.razorpayKeySecret,
        currency: cleaned.payment?.currency,
        taxRate: cleaned.payment?.taxRate,
        // Flatten security.* → top-level security fields
        maxLoginAttempts: cleaned.security?.maxLoginAttempts,
        sessionTimeout: cleaned.security?.sessionTimeout,
        twoFactorAuth: cleaned.security?.twoFactorAuth,
        // Flatten maintenance.* → top-level maintenanceMode
        maintenanceMode: cleaned.maintenance?.enabled,
        // Flatten notifications.* → top-level feature flags
        allowRegistrations: cleaned.features?.userRegistration,
        requireEmailVerification: cleaned.features?.emailVerification,
      };

      // Remove undefined values
      Object.keys(payload).forEach(
        (k) => payload[k] === undefined && delete payload[k],
      );

      const response = await apiClient.put("/admin/settings", payload);
      if (response.data?.success) {
        toast.success("Settings saved successfully");
        setSaveStatus("success");
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (path, value) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
      const keys = path.split(".");
      let current = newSettings;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  // Boolean toggles auto-save immediately (optimistic update, revert on
  // failure) so admins don't need to press Save for switches. Save/Discard
  // remain for text/number/select inputs only.
  const handleToggleChange = async (path, value) => {
    const parts = path.split(".");
    let patch;
    if (parts[0] === "features") {
      // Backend's normalizeFeatures resets omitted flags to defaults — always
      // send the full feature map with only this key changed.
      patch = { features: { ...settings.features, [parts[1]]: value } };
    } else if (parts[0] === "comingSoon") {
      // Backend replaces the whole comingSoon section when provided — send it
      // complete with only this entry's enabled flag mutated.
      const key = parts[1];
      patch = {
        comingSoon: {
          ...settings.comingSoon,
          [key]: { ...settings.comingSoon?.[key], enabled: value },
        },
      };
    } else {
      // security/maintenance/payment/notifications sections merge partially
      // on the backend — a single-key fragment is safe.
      const [section, key] = parts;
      patch = { [section]: { [key]: value } };
    }

    handleInputChange(path, value); // optimistic
    try {
      await apiClient.put("/admin/settings", patch);
      toast.success("Saved");
    } catch (err) {
      console.error(`Auto-save failed for ${path}:`, err);
      toast.error(
        err.response?.data?.message || "Could not save setting — reverted",
      );
      handleInputChange(path, !value); // revert
    }
  };

  const handleSocialLinkChange = (platform, value) => {
    setSettings((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [platform]: value,
      },
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const tabs = [
    { id: "general", label: "General", icon: Globe },
    { id: "features", label: "Features", icon: Zap },
    { id: "appearance", label: "Appearance", icon: Eye },
    { id: "security", label: "Security", icon: Shield },
    { id: "email", label: "Email", icon: Mail },
    { id: "payment", label: "Payment", icon: CreditCard },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white border-b-2 border-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Settings Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {activeTab === "general" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={settings.siteName}
                    onChange={(e) =>
                      handleInputChange("siteName", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Site URL
                  </label>
                  <input
                    type="url"
                    value={settings.siteUrl}
                    onChange={(e) =>
                      handleInputChange("siteUrl", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Site Description
                  </label>
                  <textarea
                    value={settings.siteDescription}
                    onChange={(e) =>
                      handleInputChange("siteDescription", e.target.value)
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) =>
                      handleInputChange("contactEmail", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={settings.contactPhone}
                    onChange={(e) =>
                      handleInputChange("contactPhone", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                SEO Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={settings.metaTitle}
                    onChange={(e) =>
                      handleInputChange("metaTitle", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Meta Description
                  </label>
                  <textarea
                    value={settings.metaDescription}
                    onChange={(e) =>
                      handleInputChange("metaDescription", e.target.value)
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Keywords (comma separated)
                  </label>
                  <input
                    type="text"
                    value={settings.keywords}
                    onChange={(e) =>
                      handleInputChange("keywords", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Social Links
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(settings.socialLinks).map((platform) => (
                  <div key={platform}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                      {platform} URL
                    </label>
                    <input
                      type="url"
                      value={settings.socialLinks[platform]}
                      onChange={(e) =>
                        handleSocialLinkChange(platform, e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder={`https://${platform}.com/username`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "features" && (
          <div className="space-y-6">
            {/* Feature Toggles */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-500" />
                Feature Toggles
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Enable or disable platform features. Changes take effect
                immediately on the frontend.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(settings.features).map(([key, value]) => {
                  const FEATURE_META = {
                    userRegistration: {
                      label: "User Registration",
                      desc: "Allow new users to sign up",
                    },
                    emailVerification: {
                      label: "Email Verification",
                      desc: "Require email confirmation on signup",
                    },
                    smsNotifications: {
                      label: "SMS Notifications",
                      desc: "Send SMS alerts (Requires SMS gateway service)",
                    },
                    paymentGateway: {
                      label: "Payment Gateway",
                      desc: "Enable Razorpay checkout",
                    },
                    analytics: {
                      label: "Analytics",
                      desc: "Track user engagement and metrics",
                    },
                    seoEnabled: {
                      label: "SEO Enabled",
                      desc: "Serve meta tags and sitemap",
                    },
                    demoMode: {
                      label: "Demo Mode (Sandbox Testing)",
                      desc: "Enables simulated test checkout and sandboxed verification",
                    },
                    botProtection: {
                      label: "Bot Protection (Honeypot & Heuristics)",
                      desc: "Block automated bots on login and registration forms",
                    },
                    blockDisposableEmails: {
                      label: "Block Disposable Emails",
                      desc: "Reject temporary/throwaway email domains (mailinator, tempmail, etc.)",
                    },
                    verifyEmailMx: {
                      label: "DNS MX Email Verification",
                      desc: "Verify email domain exists and has active mail servers capable of receiving mail",
                    },
                    enforceDomainAllowlist: {
                      label: "Enforce Allowed Email Domains",
                      desc: "Restrict registrations exclusively to specified webmail providers and university domains",
                    },
                  };
                  const meta = FEATURE_META[key] || {
                    label: key.replace(/([A-Z])/g, " $1").trim(),
                    desc: "",
                  };
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-3 rounded-lg border ${value ? "bg-indigo-50/50 border-indigo-100" : "bg-gray-50 dark:bg-gray-900 border-gray-100"}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {meta.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {meta.desc}
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={value}
                        onChange={(val) =>
                          handleToggleChange(`features.${key}`, val)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Maintenance Mode */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                Maintenance Mode
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                When enabled, the entire site shows a maintenance page. Admins
                can still access the admin panel.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Enable Maintenance Mode
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Blocks all frontend pages for non-admin users
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={settings.maintenance.enabled}
                    onChange={(val) =>
                      handleToggleChange("maintenance.enabled", val)
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Maintenance Message
                    </label>
                    <textarea
                      value={settings.maintenance.message}
                      onChange={(e) =>
                        handleInputChange("maintenance.message", e.target.value)
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Estimated Downtime
                    </label>
                    <input
                      type="text"
                      value={settings.maintenance.estimatedDowntime}
                      onChange={(e) =>
                        handleInputChange(
                          "maintenance.estimatedDowntime",
                          e.target.value,
                        )
                      }
                      placeholder="e.g., 30 minutes"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Expected End Time
                    </label>
                    <input
                      type="datetime-local"
                      value={
                        settings.maintenance.endTime
                          ? new Date(settings.maintenance.endTime)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        handleInputChange(
                          "maintenance.endTime",
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : "",
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-amber-100">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      Allow Admin Access During Maintenance
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Admin users can bypass the maintenance page
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={settings.maintenance.allowAdminAccess}
                    onChange={(val) =>
                      handleToggleChange("maintenance.allowAdminAccess", val)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Coming Soon — Pages */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-500" />
                Coming Soon — Pages
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Toggle which <b>entire pages</b> show a "Coming Soon"
                placeholder instead of their real content.
              </p>
              <div className="space-y-3">
                {Object.entries(settings.comingSoon)
                  .filter(([, c]) => (c.type || "page") === "page")
                  .map(([key, config]) => (
                    <ComingSoonCard
                      key={key}
                      keyName={key}
                      config={config}
                      onToggle={(val) =>
                        handleToggleChange(`comingSoon.${key}.enabled`, val)
                      }
                      onChange={(field, val) =>
                        handleInputChange(`comingSoon.${key}.${field}`, val)
                      }
                    />
                  ))}
              </div>
            </div>

            {/* Coming Soon — Sections */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Clock className="w-5 h-5 text-pink-500" />
                Coming Soon — Sections
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Toggle which <b>sections within a page</b> show a "Coming Soon"
                placeholder. The rest of the page remains visible.
              </p>
              <div className="space-y-3">
                {Object.entries(settings.comingSoon)
                  .filter(([, c]) => c.type === "section")
                  .map(([key, config]) => (
                    <ComingSoonCard
                      key={key}
                      keyName={key}
                      config={config}
                      onToggle={(val) =>
                        handleToggleChange(`comingSoon.${key}.enabled`, val)
                      }
                      onChange={(field, val) =>
                        handleInputChange(`comingSoon.${key}.${field}`, val)
                      }
                      showPageHint
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Theme Colors
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.appearance.primaryColor}
                      onChange={(e) =>
                        handleInputChange(
                          "appearance.primaryColor",
                          e.target.value,
                        )
                      }
                      className="w-12 h-12 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.appearance.primaryColor}
                      onChange={(e) =>
                        handleInputChange(
                          "appearance.primaryColor",
                          e.target.value,
                        )
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings.appearance.secondaryColor}
                      onChange={(e) =>
                        handleInputChange(
                          "appearance.secondaryColor",
                          e.target.value,
                        )
                      }
                      className="w-12 h-12 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.appearance.secondaryColor}
                      onChange={(e) =>
                        handleInputChange(
                          "appearance.secondaryColor",
                          e.target.value,
                        )
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Theme Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Theme
                  </label>
                  <select
                    value={settings.appearance.theme}
                    onChange={(e) =>
                      handleInputChange("appearance.theme", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Font Family
                  </label>
                  <select
                    value={settings.appearance.fontFamily}
                    onChange={(e) =>
                      handleInputChange("appearance.fontFamily", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="Roboto, sans-serif">Roboto</option>
                    <option value="Open Sans, sans-serif">Open Sans</option>
                    <option value="Montserrat, sans-serif">Montserrat</option>
                    <option value="system-ui, sans-serif">System UI</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Password Policy
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Minimum Password Length
                  </label>
                  <input
                    type="number"
                    value={settings.security.passwordMinLength}
                    onChange={(e) =>
                      handleInputChange(
                        "security.passwordMinLength",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    min="6"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security.passwordComplexity}
                      onChange={(e) =>
                        handleToggleChange(
                          "security.passwordComplexity",
                          e.target.checked,
                        )
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-800 after:border-gray-300 dark:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Require Complex Password
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Include special characters, numbers, etc.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-500" />
                Login Security
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    value={settings.security.maxLoginAttempts}
                    onChange={(e) =>
                      handleInputChange(
                        "security.maxLoginAttempts",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    min="1"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Session Timeout (seconds)
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      0 = server default (3 days)
                    </span>
                  </label>
                  <input
                    type="number"
                    value={settings.security.sessionTimeout}
                    onChange={(e) =>
                      handleInputChange(
                        "security.sessionTimeout",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    min="0"
                    max="86400"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Two-Factor Authentication
              </h3>
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.security.twoFactorAuth}
                    onChange={(e) =>
                      handleToggleChange(
                        "security.twoFactorAuth",
                        e.target.checked,
                      )
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-800 after:border-gray-300 dark:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Enable 2FA
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Require SMS or authenticator app verification
                  </p>
                </div>
              </div>
            </div>

            {/* Allowed Email Domains */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-500" />
                Allowed Email Domains
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Specify trusted email domains permitted for registration when
                the{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Enforce Allowed Email Domains
                </span>{" "}
                feature toggle is enabled. Comma or space separated. Supports
                wildcards like{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                  *.ac.in
                </code>{" "}
                and{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                  *.edu
                </code>
                .
              </p>
              <textarea
                rows={4}
                value={settings.security.allowedEmailDomains || ""}
                onChange={(e) =>
                  handleInputChange(
                    "security.allowedEmailDomains",
                    e.target.value,
                  )
                }
                placeholder="gmail.com, outlook.com, yahoo.com, *.ac.in, *.edu"
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-200"
              />
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-gray-500">
                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                  Tip: Use *.ac.in for all Indian University domains
                </span>
                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                  Tip: Use *.edu for academic institutions
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "email" && (
          <div className="space-y-6">
            {emailTestResult && (
              <div
                className={`p-3 rounded-lg text-sm ${emailTestResult.success ? "bg-green-50 dark:bg-green-900/20 text-green-800 border border-green-200" : "bg-red-50 dark:bg-red-900/20 text-red-800 border border-red-200"}`}
              >
                {emailTestResult.message}
              </div>
            )}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Test Email Configuration
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Send a test email to verify SMTP settings
                </p>
              </div>
              <button
                onClick={handleTestEmail}
                disabled={testingEmail}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingEmail ? "Sending..." : "Send Test Email"}
              </button>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                SMTP Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={settings.email.smtpHost}
                    onChange={(e) =>
                      handleInputChange("email.smtpHost", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={settings.email.smtpPort}
                    onChange={(e) =>
                      handleInputChange(
                        "email.smtpPort",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={settings.email.smtpUsername}
                    onChange={(e) =>
                      handleInputChange("email.smtpUsername", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.smtpPassword ? "text" : "password"}
                      value={settings.email.smtpPassword}
                      onChange={(e) =>
                        handleInputChange("email.smtpPassword", e.target.value)
                      }
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("smtpPassword")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400"
                    >
                      {showPassword.smtpPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Encryption
                  </label>
                  <select
                    value={settings.email.encryption}
                    onChange={(e) =>
                      handleInputChange("email.encryption", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Default Sender
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={settings.email.fromEmail}
                    onChange={(e) =>
                      handleInputChange("email.fromEmail", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={settings.email.fromName}
                    onChange={(e) =>
                      handleInputChange("email.fromName", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "payment" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Stripe Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Public Key
                  </label>
                  <input
                    type="text"
                    value={settings.payment.stripePublicKey}
                    onChange={(e) =>
                      handleInputChange(
                        "payment.stripePublicKey",
                        e.target.value,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.stripeSecretKey ? "text" : "password"}
                      value={settings.payment.stripeSecretKey}
                      onChange={(e) =>
                        handleInputChange(
                          "payment.stripeSecretKey",
                          e.target.value,
                        )
                      }
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        togglePasswordVisibility("stripeSecretKey")
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400"
                    >
                      {showPassword.stripeSecretKey ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Razorpay Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Key ID
                  </label>
                  <input
                    type="text"
                    value={settings.payment.razorpayKeyId}
                    onChange={(e) =>
                      handleInputChange("payment.razorpayKeyId", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Key Secret
                  </label>
                  <div className="relative">
                    <input
                      type={
                        showPassword.razorpayKeySecret ? "text" : "password"
                      }
                      value={settings.payment.razorpayKeySecret}
                      onChange={(e) =>
                        handleInputChange(
                          "payment.razorpayKeySecret",
                          e.target.value,
                        )
                      }
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        togglePasswordVisibility("razorpayKeySecret")
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400"
                    >
                      {showPassword.razorpayKeySecret ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                PayPal Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={settings.payment.paypalClientId}
                    onChange={(e) =>
                      handleInputChange(
                        "payment.paypalClientId",
                        e.target.value,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.paypalSecret ? "text" : "password"}
                      value={settings.payment.paypalClientSecret}
                      onChange={(e) =>
                        handleInputChange(
                          "payment.paypalClientSecret",
                          e.target.value,
                        )
                      }
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("paypalSecret")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400"
                    >
                      {showPassword.paypalSecret ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Currency Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Currency
                  </label>
                  <select
                    value={settings.payment.currency}
                    onChange={(e) =>
                      handleInputChange("payment.currency", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.payment.taxEnabled}
                      onChange={(e) =>
                        handleToggleChange(
                          "payment.taxEnabled",
                          e.target.checked,
                        )
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-800 after:border-gray-300 dark:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Enable Tax
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Apply tax to payments
                    </p>
                  </div>
                </div>
                {settings.payment.taxEnabled && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      value={settings.payment.taxRate}
                      onChange={(e) =>
                        handleInputChange(
                          "payment.taxRate",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Notification Types
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(settings.notifications).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {key.replace(/([A-Z])/g, " $1").trim()} notifications
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) =>
                          handleToggleChange(
                            `notifications.${key}`,
                            e.target.checked,
                          )
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-800 after:border-gray-300 dark:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Notification Frequency
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Frequency
                  </label>
                  <select
                    value={settings.notifications.notificationFrequency}
                    onChange={(e) =>
                      handleInputChange(
                        "notifications.notificationFrequency",
                        e.target.value,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="instant">Instant</option>
                    <option value="daily">Daily Digest</option>
                    <option value="weekly">Weekly Digest</option>
                    <option value="monthly">Monthly Summary</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {saveStatus === "success" && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {saveStatus === "error" && (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {saveStatus === "success"
                ? "Saved successfully"
                : saveStatus === "error"
                  ? "Error saving"
                  : ""}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => fetchSettings()}
              title="Discard unsaved changes and reload settings from the server"
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition"
            >
              <X className="w-4 h-4" />
              Discard Changes
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-800 after:border-gray-300 dark:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
    </label>
  );
}

function ComingSoonCard({ keyName, config, onToggle, onChange, showPageHint }) {
  const pageName = keyName.includes(":") ? keyName.split(":")[0] : null;
  const sectionName = keyName.includes(":") ? keyName.split(":")[1] : null;

  return (
    <div
      className={`rounded-lg border p-4 ${config.enabled ? "border-purple-200 bg-purple-50/30" : "border-gray-100 bg-gray-50 dark:bg-gray-900"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
              {config.title}
            </p>
            {showPageHint && pageName && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                on{" "}
                <span className="font-mono font-bold text-gray-500 dark:text-gray-400">
                  /{pageName}
                </span>{" "}
                page → <span className="font-mono">{sectionName}</span> section
              </p>
            )}
          </div>
        </div>
        <ToggleSwitch checked={config.enabled} onChange={onToggle} />
      </div>
      {config.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Message
            </label>
            <input
              type="text"
              value={config.message}
              onChange={(e) => onChange("message", e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Estimated Time
            </label>
            <input
              type="text"
              value={config.estimatedTime}
              onChange={(e) => onChange("estimatedTime", e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Icon (Lucide name)
            </label>
            <input
              type="text"
              value={config.icon}
              onChange={(e) => onChange("icon", e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
