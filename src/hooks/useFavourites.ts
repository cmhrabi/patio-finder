"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "sc-favs";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage may be disabled (private mode, etc) — silently no-op.
  }
}

export function useFavourites() {
  const [favourites, setFavourites] = useState<Set<string>>(() => read());

  // Sync across tabs.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFavourites(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      write(next);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => favourites.has(id), [favourites]);

  const clear = useCallback(() => {
    setFavourites(() => {
      const next = new Set<string>();
      write(next);
      return next;
    });
  }, []);

  return { favourites, toggle, has, clear };
}
