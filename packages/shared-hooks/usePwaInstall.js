import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "trstprep_pwa_dismissed";

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showMacGuide, setShowMacGuide] = useState(false);
  const [platform, setPlatform] = useState({
    isIOS: false,
    isSafari: false,
    isMacSafari: false,
    isAndroid: false,
    isChromium: false,
    isFirefox: false,
  });

  // Check standalone mode and platform once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if running in standalone mode (already installed as PWA)
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;
      const isNavigatorStandalone = window.navigator?.standalone === true;
      const isAndroidApp = document.referrer?.includes("android-app://");
      const standalone =
        isStandaloneMedia || isNavigatorStandalone || isAndroidApp;
      setIsStandalone(standalone);
      return standalone;
    };

    checkStandalone();

    // Detect browser and OS
    const ua = window.navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(ua) && !isIOS;
    const isAndroid = /Android/i.test(ua);
    const isFirefox = /Firefox/i.test(ua);
    const isEdge = /Edg/i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !isEdge && !/OPR\//.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isMacSafari = isMac && isSafari && !isChrome && !isFirefox && !isEdge;
    const isChromium =
      isChrome || isEdge || /OPR|Brave|Vivaldi|SamsungBrowser/i.test(ua);

    setPlatform({
      isIOS,
      isSafari,
      isMacSafari,
      isAndroid,
      isChromium,
      isFirefox,
    });

    // Check dismiss status from localStorage
    try {
      const dismissedUntil = localStorage.getItem(STORAGE_KEY);
      if (dismissedUntil) {
        const expiry = parseInt(dismissedUntil, 10);
        if (!isNaN(expiry) && Date.now() < expiry) {
          setIsDismissed(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setIsDismissed(false);
        }
      } else {
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }

    // Listen for standalone display-mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e) => {
      setIsStandalone(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleDisplayModeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    // Listen for Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent browser mini-infobar default
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleDisplayModeChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  // Install trigger action
  const installApp = useCallback(async () => {
    if (deferredPrompt) {
      // Standard Chromium PWA install
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
        return choiceResult.outcome;
      } catch (err) {
        console.error("Error triggering PWA install prompt:", err);
        return "failed";
      }
    } else if (platform.isIOS) {
      // iOS Safari Add-to-Home-Screen guide
      setShowIosGuide(true);
      return "ios_guide";
    } else if (platform.isMacSafari) {
      setShowMacGuide(true);
      return "mac_guide";
    } else {
      return "unsupported";
    }
  }, [deferredPrompt, platform]);

  // Dismiss banner action with configurable snooze duration in days
  const dismissPrompt = useCallback((days = 7) => {
    try {
      const expiry = Date.now() + days * 24 * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEY, expiry.toString());
    } catch {}
    setIsDismissed(true);
    setShowIosGuide(false);
    setShowMacGuide(false);
  }, []);

  const resetDismissed = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setIsDismissed(false);
  }, []);

  // Whether installation is supported/available
  const isInstallable =
    !isStandalone &&
    (!!deferredPrompt || (platform.isIOS && platform.isSafari));

  return {
    isInstallable,
    isStandalone,
    isDismissed,
    platform,
    hasNativePrompt: !!deferredPrompt,
    showIosGuide,
    setShowIosGuide,
    showMacGuide,
    setShowMacGuide,
    installApp,
    dismissPrompt,
    resetDismissed,
  };
}

export default usePwaInstall;
