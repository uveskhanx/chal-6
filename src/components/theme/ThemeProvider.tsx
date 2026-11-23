"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "saansai-theme";

/**
 * Script injected synchronously into <head> to prevent Flash of Unstyled Content (FOUC).
 */
export function ThemeScript() {
  const code = `(function() {
    try {
      var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
      var theme = stored || "light";
      var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      if (isDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch (e) {}
  })()`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Apply theme to document element
  const applyTheme = useCallback((targetTheme: Theme) => {
    const root = document.documentElement;
    let isDark = false;

    if (targetTheme === "dark") {
      isDark = true;
    } else if (targetTheme === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      isDark = false;
    }

    if (isDark) {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
      setResolvedTheme("dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
      setResolvedTheme("light");
    }
  }, []);

  // Initialize from localStorage or default on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const initial = stored || "light";
      setThemeState(initial);
      applyTheme(initial);
    } catch (error) {
      console.debug("[ThemeProvider] LocalStorage read failed, falling back to light theme:", error);
      applyTheme("light");
    }
    setMounted(true);
  }, [applyTheme]);

  // Listen to system preference changes when in 'system' mode
  useEffect(() => {
    if (!mounted || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme("system");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, mounted, applyTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      // Storage restricted or unavailable (e.g. sandboxed iframe)
      console.debug("[ThemeProvider] LocalStorage write restricted:", error);
    }
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
