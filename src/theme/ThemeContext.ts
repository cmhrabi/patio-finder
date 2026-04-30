"use client";

import { createContext } from "react";
import type { ThemeName, CardStyle } from "./types";

export type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggle: () => void;
  cardStyle: CardStyle;
  setCardStyle: (s: CardStyle) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
