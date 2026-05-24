"use client";

import { useEffect, useState, type RefCallback } from "react";

export function useElementHeight<T extends HTMLElement>(): [RefCallback<T>, number | null] {
  const [node, setNode] = useState<T | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const boxSize = entry.borderBoxSize?.[0]?.blockSize;
      const next = boxSize ?? entry.contentRect.height;
      setHeight(Math.round(next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, height];
}
