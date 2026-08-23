import { useLocation, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import LeftSidebar from "./LeftSidebar";
import BottomNav from "./BottomNav";
import { useAuth } from "../../providers/AuthContext";
import PageTransition from "../animations/PageTransition.jsx";

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [navMode, setNavMode] = useState("left");
  const location = useLocation();
  const { user, loading: _loading } = useAuth();

  // Hydration guard: only access window/localStorage after mount (SSR-safe)
  useEffect(() => {
    setIsHydrated(true);
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth < 768);
      const saved = localStorage.getItem("trstprep_navMode");
      setNavMode(saved || "left");
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    const savedNavMode = localStorage.getItem("trstprep_navMode");
    if (savedNavMode) {
      setNavMode(savedNavMode);
    } else {
      setNavMode("left");
    }
  }, [user, isHydrated]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Announce route changes to screen readers (H22: no aria-live region).
  const [routeAnnouncement, setRouteAnnouncement] = useState("");

  useEffect(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const label =
      segments.length === 0
        ? "Home"
        : segments[segments.length - 1]
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
    setRouteAnnouncement(`Navigated to ${label}`);
  }, [location.pathname]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const toggleNavMode = () => {
    const newMode = navMode === "top" ? "left" : "top";
    setNavMode(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("trstprep_navMode", newMode);
    }
  };

  // Auth pages (login, signup, etc.) should never render the desktop left sidebar layout
  const isAuthPage = [
    "/login",
    "/signup",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
  ].includes(location.pathname);

  // Left nav mode applies on desktop whenever navMode is 'left' for authenticated users on app routes
  // Guarded by isHydrated to avoid SSR mismatch from window/localStorage access
  const isLeftNavMode =
    isHydrated && navMode === "left" && !isMobile && !isAuthPage && !!user;

  return (
    <div
      className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-full max-w-full ${isLeftNavMode ? "desktop-left-nav-mode" : ""}`}
    >
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Screen-reader route change announcements (H22) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {routeAnnouncement}
      </div>
      {/* Top Navbar */}
      <header role="banner">
        <Navbar
          onMenuClick={toggleSidebar}
          isLeftNavMode={isLeftNavMode}
          onNavModeToggle={toggleNavMode}
        />
      </header>

      {/* Desktop Left Sidebar */}
      {isLeftNavMode && <LeftSidebar />}

      {/* Mobile Sidebar (Right Side) */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isMobile={isMobile}
        isLeftNavMode={false}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className={`
           pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0
           ${isLeftNavMode ? "lg:ml-[260px]" : ""}
         `}
      >
        <PageTransition className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </PageTransition>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Content information */}
      <footer role="contentinfo"></footer>
    </div>
  );
}

export default Layout;
