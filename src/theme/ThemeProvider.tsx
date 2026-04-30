"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext } from "./ThemeContext";
import type { CardStyle, ThemeName } from "./types";

export type ThemeProviderProps = {
  /** Initial / controlled theme. */
  theme?: ThemeName;
  /** Initial / controlled card visual style. */
  cardStyle?: CardStyle;
  /** When true, the provider mutates `<html data-theme>` so the cascade reaches the whole document.
   *  Default true. Set false in Storybook decorators that wrap a sub-tree. */
  applyToDocument?: boolean;
  children: ReactNode;
};

export function ThemeProvider({
  theme: themeProp,
  cardStyle: cardStyleProp,
  applyToDocument = true,
  children,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeName>(themeProp ?? "cream");
  const [cardStyle, setCardStyle] = useState<CardStyle>(cardStyleProp ?? "soft");

  // Track external theme prop changes (e.g. from Storybook toolbar).
  useEffect(() => {
    if (themeProp) setTheme(themeProp);
  }, [themeProp]);
  useEffect(() => {
    if (cardStyleProp) setCardStyle(cardStyleProp);
  }, [cardStyleProp]);

  useEffect(() => {
    if (!applyToDocument || typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.cardStyle = cardStyle;
  }, [theme, cardStyle, applyToDocument]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "cream" ? "map" : "cream"));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggle, cardStyle, setCardStyle }),
    [theme, toggle, cardStyle],
  );

  // Always render a wrapper that scopes the data-attrs. This means useTheme
  // works even in tests where `document` is shared between renders.
  return (
    <ThemeContext.Provider value={value}>
      <div data-theme={theme} data-card-style={cardStyle} style={{ display: "contents" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
