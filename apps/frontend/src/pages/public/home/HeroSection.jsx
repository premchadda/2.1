import { Link } from "react-router-dom";
import { AnimatedHero } from "../../../shared/components";
import {
  ArrowRight,
  Play,
  Sparkles,
  Star,
  Users,
  Crown,
  User,
} from "lucide-react";

function HeroSection({
  user,
  isMobile,
  mousePos,
  popularSeries,
  studyMaterials,
  totalMockTestsCount,
  totalCategoriesCount,
  getSubjectEmoji,
}) {
  return (
    <AnimatedHero pageType="home">
      {user ? (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-center gap-4">
            <Link
              to="/profile"
              className="relative group block shrink-0"
              title="View Profile"
            >
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white shadow-lg group-hover:scale-105 group-hover:border-white/80 transition-all duration-300">
                {user.avatar || user.avatarUrl || user.photoURL ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={user.avatar || user.avatarUrl || user.photoURL}
                    alt={user.name || "User"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      if (e.currentTarget.nextSibling) {
                        e.currentTarget.nextSibling.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div
                  className={`${user.avatar || user.avatarUrl || user.photoURL ? "hidden" : "flex"} w-full h-full items-center justify-center bg-white/20 backdrop-blur-sm`}
                >
                  <User className="w-7 h-7 md:w-8 md:h-8 text-white/90" />
                </div>
              </div>
            </Link>
            <div className="text-white">
              <h1 className="text-xl md:text-2xl font-bold animate-slide-in-right truncate">
                Welcome {user.name?.trim().split(/\s+/)[0] || "Student"} 👋
              </h1>
              <p
                className="text-purple-100 text-sm md:text-base mt-1 animate-slide-in-right"
                style={{ animationDelay: "0.1s" }}
              >
                Continue your preparation journey
              </p>
            </div>
          </div>
          {user.hasProPass && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400/20 backdrop-blur-sm rounded-full text-amber-100 border border-amber-400/30 animate-shimmer">
              <Crown className="w-4 h-4" />
              <span className="text-xs md:text-sm font-bold">PRO Member</span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-4 sm:gap-6 items-center md:py-10">
            {/* Text content */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-full mb-4 md:mb-6 animate-slide-up">
                <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-yellow-300" />
                <span className="text-xs md:text-sm font-semibold text-white/90">
                  Your All-in-One Test Preparation Platform
                </span>
              </div>

              <h1
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 md:mb-5 leading-tight animate-slide-up"
                style={{
                  animationDelay: "0.1s",
                  textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                Crack Your
                <span className="relative inline-block">
                  <span className="relative z-10 text-yellow-300 animate-pulse">
                    {" "}
                    Dream Exam
                  </span>
                  <span className="absolute bottom-0.5 md:bottom-1 left-0 w-full h-1.5 md:h-2 bg-yellow-400/30 rounded-full" />
                </span>
                <br />
                <span className="text-white/90">With Confidence 🎯</span>
              </h1>

              <p
                className="text-sm md:text-lg lg:text-xl text-purple-100 mb-5 md:mb-8 max-w-md md:max-w-lg leading-relaxed animate-slide-up"
                style={{ animationDelay: "0.2s" }}
              >
                {totalMockTestsCount}+ mock tests, AI analytics & real-time
                leaderboards. Trusted by aspirants across India.
              </p>

              <div
                className="flex flex-row items-center gap-2.5 sm:gap-4 mb-6 md:mb-10 w-full sm:w-auto animate-slide-up"
                style={{ animationDelay: "0.3s" }}
              >
                <Link
                  to="/signup"
                  className="flex-1 sm:flex-initial group justify-center px-3.5 py-2.5 sm:px-8 sm:py-4 bg-white text-brand-start font-bold rounded-xl md:rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 btn-animated inline-flex items-center text-xs sm:text-base text-center whitespace-nowrap"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1.5 sm:ml-2 inline group-hover:translate-x-1 transition-transform shrink-0" />
                </Link>
                <Link
                  to="/test-series"
                  className="flex-1 sm:flex-initial justify-center px-3.5 py-2.5 sm:px-8 sm:py-4 bg-white/10 text-white border border-white/30 font-semibold rounded-xl md:rounded-2xl hover:bg-white/20 transition-all duration-300 hover:scale-105 inline-flex items-center text-xs sm:text-base backdrop-blur-sm text-center whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
                  <span>Explore Tests</span>
                </Link>
              </div>

              {/* Trust indicators - hidden on small mobile */}
              <div
                className="hidden sm:flex flex-wrap items-center gap-4 md:gap-6 text-xs md:text-sm text-purple-200 animate-slide-up"
                style={{ animationDelay: "0.35s" }}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-green-300" />
                  <span>No card required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Detailed solutions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-300" />
                  <span>All-India rankings</span>
                </div>
              </div>
            </div>

            {/* 3D floating card — desktop only */}
            {!isMobile && (
              <div
                className="relative hidden lg:block"
                style={{ perspective: "1200px" }}
              >
                <div
                  className="absolute -top-4 right-8 z-30 transition-transform duration-500"
                  style={{
                    transform: `translate3d(${(mousePos.x / window.innerWidth - 0.5) * 16}px, ${(mousePos.y / window.innerHeight - 0.5) * 16}px, 0)`,
                    transition: "transform 0.4s cubic-bezier(0.23,1,0.32,1)",
                  }}
                >
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-3 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white text-lg shadow-lg">
                        🎯
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">
                          Daily Target
                        </div>
                        <div className="text-purple-200 text-xs">
                          50 questions
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute bottom-10 -left-6 z-30 transition-transform duration-700"
                  style={{
                    transform: `translate3d(${(mousePos.x / window.innerWidth - 0.5) * 12}px, ${(mousePos.y / window.innerHeight - 0.5) * 12}px, 0)`,
                    transition: "transform 0.6s cubic-bezier(0.23,1,0.32,1)",
                  }}
                >
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-3 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center text-xl shadow-lg">
                        📈
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">
                          AI Insights
                        </div>
                        <div className="text-purple-200 text-xs">
                          Updated daily
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main 3D card */}
                <div
                  className="relative z-10 bg-white/8 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 md:p-7 shadow-2xl transition-transform duration-500"
                  style={{
                    transform: `rotateY(${(mousePos.x / window.innerWidth - 0.5) * 8}deg) rotateX(${-(mousePos.y / window.innerHeight - 0.5) * 8}deg)`,
                    boxShadow:
                      "0 40px 100px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      TP
                    </div>
                    <div className="min-w-0 max-w-[200px]">
                      <div className="text-white font-bold text-sm">
                        Your Study Dashboard
                      </div>
                      <div className="text-purple-300 text-xs font-medium truncate">
                        {popularSeries[0]?.title
                          ? `${popularSeries[0].title}`
                          : "SSC CGL Tier-1 — Full Mock"}
                      </div>
                    </div>
                    <div className="ml-auto bg-green-500/20 text-green-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-400/30">
                      Live preview
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-purple-200 mb-1.5">
                      <span>Question 18 of 25</span>
                      <span className="text-white font-bold">02:14 left</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-start to-brand-end rounded-full"
                        style={{
                          width: "72%",
                          animation: "progressShine 2.5s ease-in-out infinite",
                          backgroundSize: "200% 100%",
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {(studyMaterials.length > 0
                      ? studyMaterials.slice(0, 3)
                      : [
                          {
                            title: "Quantitative Aptitude",
                            topics: 8,
                            chapters: 3,
                          },
                          {
                            title: "English Language",
                            topics: 7,
                            chapters: 2,
                          },
                          {
                            title: "General Intelligence",
                            topics: 10,
                            chapters: 4,
                          },
                        ]
                    ).map((s, i) => {
                      const emoji = getSubjectEmoji(s);
                      const bgs = [
                        "bg-red-500/10",
                        "bg-blue-500/10",
                        "bg-emerald-500/10",
                      ];
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2.5 ${bgs[i % bgs.length]} rounded-xl px-3 py-2 border border-white/5`}
                        >
                          <div className="text-xl">{emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white/90 text-xs font-semibold truncate">
                              {s.title || s.name}
                            </div>
                            <div className="text-purple-300/80 text-[10px]">
                              {s.chapters || 0} ch • {s.topics || 0} topics
                            </div>
                          </div>
                          <div className="text-xs font-bold text-green-300">
                            Section {i + 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Compact hero stats — 2-col on mobile, 4-col on tablet/desktop */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            {[
              { value: `${totalMockTestsCount}+`, label: "Mock Tests" },
              { value: `${totalCategoriesCount}+`, label: "Exam Categories" },
              { value: "24×7", label: "Doubt Support" },
              { value: "100%", label: "Detailed Solutions" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/8 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 text-center transition-all duration-300 hover:bg-white/12 hover:scale-[1.02]"
              >
                <div className="text-lg sm:text-2xl font-extrabold text-white">
                  {stat.value}
                </div>
                <div className="text-purple-200/80 text-[10px] sm:text-xs font-medium mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AnimatedHero>
  );
}

export default HeroSection;
