import { Link } from "react-router-dom";

export default function Footer({ isLeftNavMode = false }) {
  return (
    <footer
      role="contentinfo"
      className={`bg-gray-900 border-t border-gray-800 text-gray-400 pt-10 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-10 transition-all duration-300 ${
        isLeftNavMode ? "lg:ml-[260px]" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Links Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Brand Column */}
          <div className="col-span-2 sm:col-span-2 md:col-span-4 lg:col-span-1 mb-2 lg:mb-0">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-start to-brand-end flex items-center justify-center text-white font-black text-sm shadow-md">
                ⚡
              </div>
              <span className="text-white font-extrabold text-lg tracking-tight">
                Trstprep
              </span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed max-w-sm mb-3">
              India&apos;s high-yield AI test preparation platform for SSC,
              Railways, Banking, and State Government exams.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-900/40 border border-indigo-700/40 text-[11px] font-semibold text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Mock System Active
            </div>
          </div>

          {/* Tests & Practice */}
          <div>
            <h4 className="text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
              Tests &amp; Practice
            </h4>
            <ul className="space-y-2 text-[11px] md:text-xs">
              <li>
                <Link
                  to="/test-series"
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  Test Series{" "}
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1 rounded">
                    PRO
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/live-tests"
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  Live Tests{" "}
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                </Link>
              </li>
              <li>
                <Link to="/pyps" className="hover:text-white transition-colors">
                  Previous Year Papers
                </Link>
              </li>
              <li>
                <Link
                  to="/practice"
                  className="hover:text-white transition-colors"
                >
                  Practice Lab
                </Link>
              </li>
              <li>
                <Link
                  to="/leaderboard"
                  className="hover:text-white transition-colors"
                >
                  All-India Leaderboard
                </Link>
              </li>
              <li>
                <Link
                  to="/pass"
                  className="hover:text-amber-300 transition-colors text-amber-400 font-semibold flex items-center gap-1"
                >
                  👑 Trstprep Pass
                </Link>
              </li>
            </ul>
          </div>

          {/* Study Materials */}
          <div>
            <h4 className="text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
              Study Resources
            </h4>
            <ul className="space-y-2 text-[11px] md:text-xs">
              <li>
                <Link
                  to="/study"
                  className="hover:text-white transition-colors"
                >
                  Study Materials &amp; Notes
                </Link>
              </li>
              <li>
                <Link
                  to="/videos"
                  className="hover:text-white transition-colors"
                >
                  Video Lectures
                </Link>
              </li>
              <li>
                <Link
                  to="/current-affairs"
                  className="hover:text-white transition-colors"
                >
                  Daily Current Affairs
                </Link>
              </li>
              <li>
                <Link
                  to="/exams"
                  className="hover:text-white transition-colors"
                >
                  Exams &amp; Syllabus
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-white transition-colors">
                  Articles &amp; Prep Guides
                </Link>
              </li>
            </ul>
          </div>

          {/* Exam Categories */}
          <div>
            <h4 className="text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
              Exam Categories
            </h4>
            <ul className="space-y-2 text-[11px] md:text-xs">
              <li>
                <Link
                  to="/exams?category=ssc"
                  className="hover:text-white transition-colors"
                >
                  SSC (CGL, CHSL, GD)
                </Link>
              </li>
              <li>
                <Link
                  to="/exams?category=railways"
                  className="hover:text-white transition-colors"
                >
                  Railways (NTPC, Group D)
                </Link>
              </li>
              <li>
                <Link
                  to="/exams?category=banking"
                  className="hover:text-white transition-colors"
                >
                  Banking (IBPS, SBI, PO)
                </Link>
              </li>
              <li>
                <Link
                  to="/exams?category=upsc"
                  className="hover:text-white transition-colors"
                >
                  UPSC &amp; State PSCs
                </Link>
              </li>
              <li>
                <Link
                  to="/exams"
                  className="hover:text-indigo-400 transition-colors font-medium"
                >
                  View All Categories →
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div>
            <h4 className="text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
              Support &amp; Legal
            </h4>
            <ul className="space-y-2 text-[11px] md:text-xs">
              <li>
                <Link
                  to="/about"
                  className="hover:text-white transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="hover:text-white transition-colors"
                >
                  Contact &amp; Support
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-white transition-colors">
                  FAQs &amp; Help
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="hover:text-white transition-colors"
                >
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link
                  to="/refund"
                  className="hover:text-white transition-colors"
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-gray-800/80 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] md:text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>
              © {new Date().getFullYear()} Trstprep Technologies. All rights
              reserved.
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-4 text-gray-400">
            <Link
              to="/privacy"
              className="hover:text-gray-200 transition-colors"
            >
              Privacy
            </Link>
            <span className="text-gray-700">•</span>
            <Link to="/terms" className="hover:text-gray-200 transition-colors">
              Terms
            </Link>
            <span className="text-gray-700">•</span>
            <Link
              to="/refund"
              className="hover:text-gray-200 transition-colors"
            >
              Refunds
            </Link>
            <span className="text-gray-700">•</span>
            <Link
              to="/contact"
              className="hover:text-gray-200 transition-colors"
            >
              Support
            </Link>
          </div>
          <p className="flex items-center gap-1">
            Made with <span className="text-red-500">❤️</span> for Indian
            Aspirants
          </p>
        </div>
      </div>
    </footer>
  );
}
