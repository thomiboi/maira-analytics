"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ThemeValue = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeValue;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const THEME_STORAGE_KEY = "maira-theme-preference";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getSystemTheme = (): ThemeValue => {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

function applyTheme(theme: ThemeValue) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const body = document.body;

  root.dataset.theme = theme;
  body.dataset.theme = theme;
  root.style.colorScheme = theme;
  body.style.colorScheme = theme;

  if (theme === "dark") {
    root.classList.add("dark");
    body.classList.add("dark");
  } else {
    root.classList.remove("dark");
    body.classList.remove("dark");
  }

  body.style.backgroundColor = "var(--background)";
  body.style.color = "var(--foreground)";
}

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [preference, setPreferenceInternal] = useState<ThemePreference>(() => "light");
  const [theme, setTheme] = useState<ThemeValue>(() => "light");

  // Load stored preference on first client render
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as
      | ThemePreference
      | null;

    if (stored === "light" || stored === "dark" || stored === "system") {
  setPreferenceInternal(stored);
    }
  }, []);

  // Sync with system theme when preference is system
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const systemTheme = getSystemTheme();

    if (preference === "system") {
      setTheme(systemTheme);
      applyTheme(systemTheme);
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const nextSystemTheme = mediaQuery.matches ? "dark" : "light";
      if (preference === "system") {
        setTheme(nextSystemTheme);
        applyTheme(nextSystemTheme);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [preference]);

  // Apply preference changes
  useEffect(() => {
    if (preference === "system") {
      const systemTheme = getSystemTheme();
      setTheme(systemTheme);
      applyTheme(systemTheme);
    } else {
      setTheme(preference);
      applyTheme(preference);
    }
  }, [preference]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
  setPreferenceInternal(nextPreference);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    }
  }, []);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
    }),
    [theme, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
