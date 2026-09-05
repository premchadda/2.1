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
              5. Your Rights under DPDP Act 2023
            </h2>
            <p className="text-gray-600 mb-2">
              In accordance with the Digital Personal Data Protection (DPDP) Act
              2023, you have the following statutory rights as a Data Principal:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>
                <strong className="text-gray-800">Right to Access:</strong> You
                can request a summary of personal data being processed and the
                processing activities.
              </li>
              <li>
                <strong className="text-gray-800">
                  Right to Correction and Erasure:
                </strong>{" "}
                You can request correction of inaccurate data, completion of
                incomplete data, or erasure of personal data no longer necessary
                for the purpose it was collected.
              </li>
              <li>
                <strong className="text-gray-800">
                  Right of Grievance Redressal:
                </strong>{" "}
                You have the right to register a grievance with our Data
                Protection / Grievance Officer.
              </li>
              <li>
                <strong className="text-gray-800">Right to Nominate:</strong>{" "}
                You may nominate another individual to exercise your rights in
                the event of death or incapacity.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. Grievance Redressal & Contact
            </h2>
            <p className="text-gray-600">
              For privacy requests or DPDP grievances, you may contact our
              designated Grievance Officer at{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="text-indigo-600 hover:underline font-medium"
              >
                {supportEmail}
              </a>
              . All grievances are acknowledged within 24 hours and addressed
              within 7 business days.
            </p>
          </section>
          <p className="text-sm text-gray-500 pt-4 border-t border-gray-100">
            Last updated: September 2026 • Compliant with DPDP Act 2023
          </p>
        </div>
      </div>
    </div>
  );
}
