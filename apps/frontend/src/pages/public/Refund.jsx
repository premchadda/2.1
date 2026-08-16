import { Helmet } from 'react-helmet-async'

export default function Refund() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@trstprep.com'
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <Helmet>
        <title>Refund Policy | Trstprep</title>
        <meta name="description" content="Trstprep refund policy - 7-day money-back guarantee and refund terms." />
        <meta property="og:title" content="Refund Policy | Trstprep" />
        <meta property="og:description" content="Trstprep refund policy - 7-day money-back guarantee and refund terms." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Refund Policy</h1>
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Subscription Refunds</h2>
            <p className="text-gray-600">We offer a 7-day money-back guarantee for all new subscriptions. If you're not satisfied, contact us within 7 days of purchase for a full refund.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Test Series Purchases</h2>
            <p className="text-gray-600">Test series purchases can be refunded within 3 days if no tests have been attempted. Once you've started a test, no refunds are available.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How to Request a Refund</h2>
            <p className="text-gray-600">To request a refund, contact our support team at {supportEmail} with your order details. Refunds are processed within 5-7 business days.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Cancellation</h2>
            <p className="text-gray-600">You can cancel your subscription at any time. Cancellations take effect at the end of your current billing period.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Contact</h2>
            <p className="text-gray-600">For refund inquiries, email {supportEmail}</p>
          </section>
          <p className="text-sm text-gray-500 pt-4">Last updated: February 17, 2026</p>
        </div>
      </div>
    </div>
  )
}
