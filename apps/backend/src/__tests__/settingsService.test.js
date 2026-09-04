import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: {},
  }),
);

const { saveSettings, getFullSettings } =
  await import("../services/SettingsService.js");

const EXISTING_CONFIG = {
  siteName: "Old Name",
  smtpHost: "smtp.old.example",
  maintenance: {
    enabled: true,
    message: "Existing maintenance message",
    endTime: null,
    allowAdminAccess: true,
    estimatedDowntime: "30 minutes",
  },
  comingSoon: {
    videos: {
      enabled: true,
      title: "Existing Videos",
      message: "keep me",
      estimatedTime: "soon",
      icon: "Video",
      type: "page",
    },
  },
  features: {
    userRegistration: true,
    emailVerification: true,
    smsNotifications: true,
    paymentGateway: true,
    analytics: true,
    seoEnabled: true,
    demoMode: false,
  },
};

function captureWrittenConfig() {
  const updateCall = mockPoolQuery.mock.calls.find(
    ([sql]) => typeof sql === "string" && sql.includes("UPDATE app_settings"),
  );
  return JSON.parse(updateCall[1][0]);
}

describe("SettingsService.saveSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it("persists every whitelisted flat key into site_config", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({
      siteName: "Trstprep",
      siteUrl: "https://trstprep.com",
      siteDescription: "Test prep platform",
      contactEmail: "support@example.com",
      contactPhone: "1800-000-0000",
      supportUrl: "https://support.example.com",
      seoTitle: "SEO Title",
      seoDescription: "SEO Desc",
      seoKeywords: "ssc, railway",
      analyticsTrackingId: "G-XXXX",
      facebookPixelId: "FB-PIXEL",
      defaultRole: "student",
      maxLoginAttempts: 5,
      lockoutDuration: 15,
      allowRegistrations: true,
      requireEmailVerification: false,
      socialLinks: { facebook: "https://fb.com/trstprep" },
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpUsername: "mailer",
      smtpPassword: "super-secret-pass",
      smtpSecure: true,
      fromEmail: "no-reply@example.com",
      fromName: "Trstprep Mailer",
      razorpayKeyId: "rzp_live_key_id",
      razorpayKeySecret: "rzp_live_secret",
      googleClientId: "google-client-id.apps.googleusercontent.com",
      googleClientSecret: "google-client-secret",
    });

    const written = captureWrittenConfig();
    expect(written.siteName).toBe("Trstprep");
    expect(written.siteUrl).toBe("https://trstprep.com");
    expect(written.siteDescription).toBe("Test prep platform");
    expect(written.contactEmail).toBe("support@example.com");
    expect(written.contactPhone).toBe("1800-000-0000");
    expect(written.supportUrl).toBe("https://support.example.com");
    expect(written.seoTitle).toBe("SEO Title");
    expect(written.seoDescription).toBe("SEO Desc");
    expect(written.seoKeywords).toBe("ssc, railway");
    expect(written.analyticsTrackingId).toBe("G-XXXX");
    expect(written.facebookPixelId).toBe("FB-PIXEL");
    expect(written.defaultRole).toBe("student");
    expect(written.maxLoginAttempts).toBe(5);
    expect(written.lockoutDuration).toBe(15);
    expect(written.allowRegistrations).toBe(true);
    expect(written.requireEmailVerification).toBe(false);
    expect(written.socialLinks).toEqual({
      facebook: "https://fb.com/trstprep",
    });
    expect(written.smtpHost).toBe("smtp.example.com");
    expect(written.smtpPort).toBe(587);
    expect(written.smtpUsername).toBe("mailer");
    expect(written.smtpPassword).toBe("super-secret-pass");
    expect(written.smtpSecure).toBe(true);
    expect(written.fromEmail).toBe("no-reply@example.com");
    expect(written.fromName).toBe("Trstprep Mailer");
    expect(written.razorpayKeyId).toBe("rzp_live_key_id");
    expect(written.razorpayKeySecret).toBe("rzp_live_secret");
    expect(written.googleClientId).toBe(
      "google-client-id.apps.googleusercontent.com",
    );
    expect(written.googleClientSecret).toBe("google-client-secret");
  });

  it("never persists masked placeholder secrets", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({
      siteName: "New Name",
      smtpPassword: "••••••••",
      razorpayKeySecret: "••••••••",
      googleClientSecret: "••••••••",
    });

    const written = captureWrittenConfig();
    expect(written.siteName).toBe("New Name");
    expect(written.smtpPassword).toBeUndefined();
    expect(written.razorpayKeySecret).toBeUndefined();
    expect(written.googleClientSecret).toBeUndefined();
  });

  it("maps flat maintenanceMode toggle into nested maintenance.enabled", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({ maintenanceMode: false, siteName: "Toggle Off" });

    const written = captureWrittenConfig();
    expect(written.maintenance.enabled).toBe(false);
    expect(written.maintenance.message).toBe("Existing maintenance message");
    expect(written.maintenanceMode).toBeUndefined();
  });

  it("round-trips: GET reflects what PUT persisted for maintenance", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({ maintenanceMode: true });
    const written = captureWrittenConfig();

    mockPoolQuery.mockResolvedValueOnce({ rows: [{ site_config: written }] });
    const full = await getFullSettings();
    expect(full.maintenance.enabled).toBe(true);
  });

  it("keeps existing features, maintenance and comingSoon when the payload omits them", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({ siteName: "Only Name Change" });

    const written = captureWrittenConfig();
    expect(written.features.smsNotifications).toBe(true);
    expect(written.features.userRegistration).toBe(true);
    expect(written.maintenance.enabled).toBe(true);
    expect(written.maintenance.message).toBe("Existing maintenance message");
    expect(written.comingSoon.videos.title).toBe("Existing Videos");
  });

  it("updates comingSoon when provided in the payload", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({
      comingSoon: {
        videos: { enabled: false, title: "New Videos", estimated_time: "TBD" },
      },
    });

    const written = captureWrittenConfig();
    expect(written.comingSoon.videos.enabled).toBe(false);
    expect(written.comingSoon.videos.title).toBe("New Videos");
    expect(written.comingSoon.videos.estimatedTime).toBe("TBD");
    expect(written.comingSoon.videos.type).toBe("page");
  });

  it("updates features when provided and normalizes snake_case keys", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({
      features: { sms_notifications: false, demo_mode: true },
    });

    const written = captureWrittenConfig();
    expect(written.features.smsNotifications).toBe(false);
    expect(written.features.demoMode).toBe(true);
    expect(written.features.userRegistration).toBe(true);
  });

  it("accepts a whole-body payload like the legacy admin.js caller", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({
      ...EXISTING_CONFIG,
      features: { ...EXISTING_CONFIG.features, demoMode: true },
      maintenance: {
        ...EXISTING_CONFIG.maintenance,
        message: "Updated via legacy",
      },
      smtpHost: "smtp.legacy.example",
      maintenanceMode: false,
    });

    const written = captureWrittenConfig();
    expect(written.features.demoMode).toBe(true);
    expect(written.maintenance.message).toBe("Updated via legacy");
    expect(written.maintenance.enabled).toBe(false);
    expect(written.smtpHost).toBe("smtp.legacy.example");
  });

  it("accepts snake_case flat keys as produced by normalizeFields", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({
      site_name: "Snake Case Name",
      smtp_host: "smtp.snake.example",
      razorpay_key_secret: "rzp-snake-secret",
      maintenance_mode: true,
    });

    const written = captureWrittenConfig();
    expect(written.siteName).toBe("Snake Case Name");
    expect(written.smtpHost).toBe("smtp.snake.example");
    expect(written.razorpayKeySecret).toBe("rzp-snake-secret");
    expect(written.maintenance.enabled).toBe(true);
  });

  it("normalizes persisted feature and payment toggle values before runtime reads", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          site_config: {
            features: { demo_mode: "false", sms_notifications: "true" },
            payment: { tax_enabled: "true", tax_rate: "18" },
          },
        },
      ],
    });

    const full = await getFullSettings();

    expect(full.features.demoMode).toBe(false);
    expect(full.features.smsNotifications).toBe(true);
    expect(full.payment.taxEnabled).toBe(true);
    expect(full.payment.taxRate).toBe(18);
  });

  it("persists and retrieves all botProtection, disposable email, MX verification, and domain allowlist toggles", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({
      features: {
        botProtection: false,
        blockDisposableEmails: false,
        verifyEmailMx: false,
        enforceDomainAllowlist: true,
      },
      security: {
        passwordComplexity: true,
        twoFactorAuth: true,
        allowedEmailDomains: "gmail.com, *.ac.in",
      },
      appearance: { theme: "dark", primaryColor: "#4f46e5" },
      payment: { taxEnabled: true, taxRate: 18 },
      notifications: { emailNotifications: true, systemAlerts: false },
    });

    const written = captureWrittenConfig();
    expect(written.features.botProtection).toBe(false);
    expect(written.features.blockDisposableEmails).toBe(false);
    expect(written.features.verifyEmailMx).toBe(false);
    expect(written.features.enforceDomainAllowlist).toBe(true);
    expect(written.security.twoFactorAuth).toBe(true);
    expect(written.security.allowedEmailDomains).toBe("gmail.com, *.ac.in");
    expect(written.appearance.theme).toBe("dark");
    expect(written.payment.taxEnabled).toBe(true);
    expect(written.notifications.systemAlerts).toBe(false);
  });

  it("camelizes snake_case nested sections (legacy admin.js router path) so security readers see them", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    // Shape produced when the LEGACY admin.js monolith router (which runs
    // normalizeFields recursively) handles PUT /settings. The live modular
    // router sends camelCase; saveSettings must tolerate BOTH.
    await saveSettings({
      security: {
        password_min_length: 10,
        password_complexity: false,
        two_factor_auth: true,
        max_login_attempts: 3,
        session_timeout: 7200,
        allowed_email_domains: "gmail.com",
      },
      email: { smtp_host: "smtp.new.example", smtp_port: 587 },
      appearance: { primary_color: "#4f46e5" },
      notifications: { system_alerts: true },
    });

    const written = captureWrittenConfig();
    // Readers (getRuntimeSecuritySettings, 2FA gate, lockout middleware) all
    // consume camelCase — snake_case keys here would silently disable toggles.
    expect(written.security.sessionTimeout).toBe(7200);
    expect(written.security.twoFactorAuth).toBe(true);
    expect(written.security.maxLoginAttempts).toBe(3);
    expect(written.security.passwordMinLength).toBe(10);
    expect(written.security.passwordComplexity).toBe(false);
    expect(written.security.allowedEmailDomains).toBe("gmail.com");
    expect(written.email.smtpHost).toBe("smtp.new.example");
    expect(written.appearance.primaryColor).toBe("#4f46e5");
    expect(written.notifications.systemAlerts).toBe(true);

    // And getFullSettings must surface them to runtime readers
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ site_config: written }] });
    const full = await getFullSettings();
    expect(full.security.sessionTimeout).toBe(7200);
    expect(full.security.twoFactorAuth).toBe(true);
    expect(full.security.maxLoginAttempts).toBe(3);
  });

  it("maps legacy flat security toggles into the nested security section", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ site_config: EXISTING_CONFIG }],
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    await saveSettings({
      session_timeout: 900,
      two_factor_auth: true,
      max_login_attempts: 7,
    });

    const written = captureWrittenConfig();
    expect(written.security.sessionTimeout).toBe(900);
    expect(written.security.twoFactorAuth).toBe(true);
    expect(written.security.maxLoginAttempts).toBe(7);
  });
});
