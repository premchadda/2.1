import { Helmet } from "react-helmet-async";

export default function Privacy() {
  const supportEmail =
    import.meta.env.VITE_SUPPORT_EMAIL || "support@trstprep.com";
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <Helmet>
        <title>Privacy Policy | Trstprep</title>
        <meta
          name="description"
          content="Trstprep privacy policy - how we collect, use, and protect your personal information."
        />
        <meta property="og:title" content="Privacy Policy | Trstprep" />
        <meta
          property="og:description"
          content="Trstprep privacy policy - how we collect, use, and protect your personal information."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-8">
          Privacy Policy
        </h1>
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              1. Information We Collect
            </h2>
            <p className="text-gray-600">
              We collect personal information such as name, email, phone number,
              and payment information when you register or make a purchase.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              2. How We Use Your Information
            </h2>
            <p className="text-gray-600">
              Your information is used to provide our services, process
              payments, and communicate with you about your account.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              3. Data Protection
            </h2>
            <p className="text-gray-600">
              We implement appropriate security measures to protect your
              personal information against unauthorized access.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              4. Third-Party Services
            </h2>
            <p className="text-gray-600">
              We may share data with third-party payment processors for
              transaction processing only.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Your Rights
            </h2>
            <p className="text-gray-600">
              You have the right to access, correct, or delete your personal
              information. Contact us to exercise these rights.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. Contact
            </h2>
            <p className="text-gray-600">
              For questions about this policy, contact us at {supportEmail}
            </p>
          </section>
          <p className="text-sm text-gray-500 pt-4">
            Last updated: February 17, 2026
          </p>
        </div>
      </div>
    </div>
  );
}
