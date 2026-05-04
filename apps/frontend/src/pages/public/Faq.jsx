import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, HelpCircle, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../../shared/lib/api'
import { AnimatedHero, Breadcrumb } from '../../shared/components'
import PageComingSoon from '../../shared/components/common/PageComingSoon'

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0)

  // Fetch FAQ data from real API - NO HARDCODED FALLBACK
  const { data: faqs = [], isLoading, error, isError } = useQuery({
    queryKey: ['public-faqs'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/faqs')
        const data = response.data?.data || response.data || []
        
        // Transform API response to standard format if needed
        return data.map(item => ({
          q: item.question || item.q || item.title,
          a: item.answer || item.a || item.content,
          id: item.id || item._id
        }))
      } catch (err) {
        // Log error but don't use fallback - let the UI handle empty state
        console.error('FAQ API error:', err.message)
        throw err // Re-throw to trigger error state
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2, // Retry twice before showing error
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Breadcrumb 
            items={[
              { label: 'Home', path: '/' },
              { label: 'FAQs' }
            ]}
          />
        </div>
      </div>

      <AnimatedHero
        pageType="faqs"
        title="Frequently Asked Questions"
        subtitle="Find answers to common questions about Trstprep features, accounts, and payments."
        compact={true}
      />

      <div className="max-w-3xl mx-auto px-4 py-16">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-brand-start animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Loading answers...</p>
          </div>
        ) : isError || faqs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">FAQs Coming Soon</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              We're preparing comprehensive FAQs for you. Our admin team is still adding questions and answers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/contact" 
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                Ask a Question
              </a>
              <a 
                href="/" 
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Go Home
              </a>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Admin: Add FAQs in <code className="bg-gray-100 px-2 py-1 rounded">/admin/faqs</code>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                  openIndex === idx ? 'border-brand-start shadow-xl shadow-brand-start/5' : 'border-gray-100 shadow-sm hover:border-brand-start/30'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === idx ? -1 : idx)}
                  className="w-full flex items-center justify-between p-5 md:p-6 text-left"
                >
                  <span className={`font-bold text-sm md:text-base transition-colors ${
                    openIndex === idx ? 'text-brand-start' : 'text-gray-900'
                  }`}>
                    {faq.q || faq.question}
                  </span>
                  <div className={`p-1.5 rounded-lg transition-colors ${
                    openIndex === idx ? 'bg-brand-start text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {openIndex === idx ? (
                      <ChevronUp className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </div>
                </button>
                <div 
                  className={`transition-all duration-300 ease-in-out ${
                    openIndex === idx ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="p-6 pt-0 text-gray-600 text-sm md:text-base leading-relaxed border-t border-gray-50">
                    {faq.a || faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-20 p-8 rounded-3xl bg-indigo-600 text-center relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl -mr-10 -mt-10" />
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-2">Still have questions?</h3>
            <p className="text-indigo-100 mb-8 max-w-lg mx-auto">Can't find the answer you're looking for? Our support team is here to help you 24/7.</p>
            <a href="/contact" className="inline-flex items-center gap-2 bg-white text-indigo-700 px-8 py-3.5 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all shadow-xl shadow-black/10">
              Get in Touch
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
