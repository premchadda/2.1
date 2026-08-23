import { useState, useEffect, useRef } from "react";
import { ScrollReveal } from "../../../shared/components";
import { Users, Target, BookOpen } from "lucide-react";

function AnimatedCounter({ end, duration = 1500, suffix = "" }) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const countRef = useRef(null);

  useEffect(() => {
    const target = Number(end) || 0;
    if (target === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (countRef.current) observer.observe(countRef.current);
    return () => observer.disconnect();
  }, [end]);

  useEffect(() => {
    if (!hasStarted) return;
    const target = Number(end) || 0;
    let startTimestamp = null;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeProgress * target));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    const rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [hasStarted, end, duration]);

  return (
    <span ref={countRef}>
      {count > 0 ? count.toLocaleString() : hasStarted ? end : 0}
      {suffix}
    </span>
  );
}

function StatsSection({
  totalActiveLearnersCount,
  totalMockTestsCount,
  totalCategoriesCount,
}) {
  return (
    <section
      className="py-8 sm:py-10 md:py-12 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #0f0a1e 0%, #1a1040 50%, #0f0a1e 100%)",
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-48 md:w-72 h-48 md:h-72 bg-brand-start/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 animate-pulse-slow" />
        <div
          className="absolute bottom-0 left-0 w-48 md:w-72 h-48 md:h-72 bg-brand-end/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 animate-pulse-slow"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
        <ScrollReveal>
          <div className="text-center mb-5 sm:mb-7 md:mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white mb-1.5 md:mb-2 tracking-tight">
              Numbers that speak for us
            </h2>
            <p className="text-purple-200/70 text-xs sm:text-sm">
              Join millions of aspirants preparing with Trstprep
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 md:gap-5">
          {[
            {
              value: totalActiveLearnersCount,
              suffix: totalActiveLearnersCount >= 1000 ? "K+" : "+",
              label: "Active Learners",
              icon: Users,
              color: "from-blue-500/20 to-indigo-500/20",
              textGlow: "text-blue-300",
            },
            {
              value: totalMockTestsCount,
              suffix: "+",
              label: "Mock Tests",
              icon: Target,
              color: "from-purple-500/20 to-pink-500/20",
              textGlow: "text-purple-300",
            },
            {
              value: totalCategoriesCount,
              suffix: "+",
              label: "Exam Categories",
              icon: BookOpen,
              color: "from-amber-500/20 to-orange-500/20",
              textGlow: "text-amber-300",
            },
          ].map((stat, i) => (
            <ScrollReveal
              key={i}
              direction="up"
              delay={i * 0.1}
              threshold={0.1}
              className="h-full"
            >
              <div className="group relative bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-xl border border-white/10 hover:border-purple-400/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_25px_rgba(147,51,234,0.25)] flex flex-col items-center justify-between h-full overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
                <div
                  className={`w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br ${stat.color} border border-white/10 flex items-center justify-center mb-1.5 sm:mb-2 group-hover:scale-110 transition-all duration-300 shadow-inner`}
                >
                  <stat.icon
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 ${stat.textGlow}`}
                  />
                </div>
                <div className="text-base sm:text-2xl md:text-3xl font-extrabold text-white mb-0.5 tracking-tight">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-purple-200/80 text-[10px] sm:text-xs font-semibold truncate max-w-full">
                  {stat.label}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default StatsSection;
export { AnimatedCounter };
