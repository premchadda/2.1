import { useState, useEffect } from "react";

/**
 * Dynamic Floating Anti-Piracy Watermark
 * Slightly more visible than before: text-white/30 vs /20
 */
export default function DynamicWatermark({ user }) {
  const [pos, setPos] = useState({ top: "20%", left: "25%" });

  useEffect(() => {
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 65 + 10) + "%";
      const left = Math.floor(Math.random() * 65 + 10) + "%";
      setPos({ top, left });
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const label =
    user?.email ||
    user?.name ||
    (user?.id ? `UID: ${user.id}` : "Trstprep Secured");

  return (
    <div
      className="pointer-events-none select-none absolute z-30 transform -rotate-12 transition-all duration-1000 ease-in-out font-mono font-bold text-[10px] sm:text-xs text-white/30 tracking-wider flex flex-col items-center drop-shadow-sm"
      style={{ top: pos.top, left: pos.left }}
      aria-hidden="true"
    >
      <span>{label}</span>
      <span className="text-[8px] opacity-70">AES-256 Protected</span>
    </div>
  );
}
