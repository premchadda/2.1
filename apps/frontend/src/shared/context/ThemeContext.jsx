import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

const ThemeContext = createContext();

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
    const savedTheme = localStorage.getItem("trstprep_theme");
    return savedTheme === "dark";
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
