import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

const ThemeContext = createContext();

function readStoredTheme() {
  // Guarded read — SSR/Node (no window/localStorage) and blocked storage
  // fall back to null (caller then resolves OS preference / default).
  try {
    if (typeof window === "undefined") return null;
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("trstprep_theme");
  } catch (e) {
    return null;
  }
}

function getPreferredTheme() {
  const stored = readStoredTheme();
  if (stored === "dark" || stored === "light") return stored;
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
  } catch (e) {}
  return "light";
}

function applyThemeDom(isDark) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("disable-transitions");
  if (isDark) {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
  try {
    localStorage.setItem("trstprep_theme", isDark ? "dark" : "light");
  } catch (e) {}

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("disable-transitions");
    });
  });
}

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkModeState] = useState(() => {
    if (typeof window === "undefined") return false;
    return getPreferredTheme() === "dark";
  });

  const setIsDarkMode = useCallback((valueOrUpdater) => {
    setIsDarkModeState((prev) => {
      const next =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(prev)
          : valueOrUpdater;
      applyThemeDom(next);
      return next;
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, [setIsDarkMode]);

  useEffect(() => {
    applyThemeDom(isDarkMode);
  }, []);

  // Follow the OS color-scheme while no explicit stored preference exists.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    if (readStoredTheme() === "dark" || readStoredTheme() === "light") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      setIsDarkModeState(e.matches);
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(onChange);
    }
    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", onChange);
      } else if (typeof mq.removeListener === "function") {
        mq.removeListener(onChange);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      isDarkMode,
      setIsDarkMode,
      toggleDarkMode,
    }),
    [isDarkMode, setIsDarkMode, toggleDarkMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export { ThemeContext };
export default ThemeProvider;
