"use client";

import { forwardRef, useId, useMemo, type HTMLAttributes } from "react";
import styles from "./Sparkline.module.css";

export type SparklineProps = {
  data: number[];
  /** Index of the "current" point to highlight with a dot. */
  currentIndex?: number;
  width?: number;
  height?: number;
  /** Stroke + fill colour. Falls back to var(--sun-400) when omitted. */
  color?: string;
  /** Optional accessible label. */
  "aria-label"?: string;
  /** Hide axis padding so the line touches the edges. */
  flush?: boolean;
} & Omit<HTMLAttributes<HTMLSpanElement>, "aria-label">;

export const Sparkline = forwardRef<HTMLSpanElement, SparklineProps>(function Sparkline(
  {
    data,
    currentIndex,
    width = 120,
    height = 36,
    color = "var(--sun-400)",
    "aria-label": ariaLabel,
    flush = false,
    className,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const gradId = `sparkline-fill-${reactId}`;

  const path = useMemo(() => buildPath(data, width, height, flush), [data, width, height, flush]);

  if (data.length === 0) return null;

  const labelled = ariaLabel ?? `Trend over ${data.length} points`;

  const dotPos =
    currentIndex !== undefined && currentIndex >= 0 && currentIndex < data.length
      ? pointFor(data, currentIndex, width, height, flush)
      : null;

  return (
    <span
      ref={ref}
      className={[styles.root, className].filter(Boolean).join(" ")}
      role="img"
      aria-label={labelled}
      style={{ width, height }}
      {...rest}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={path.area} fill={`url(#${gradId})`} />
        <path d={path.line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {dotPos ? (
          <g>
            <circle cx={dotPos.x} cy={dotPos.y} r="4" fill={color} />
            <circle cx={dotPos.x} cy={dotPos.y} r="6" fill={color} opacity="0.18" />
          </g>
        ) : null}
      </svg>
    </span>
  );
});

function pointFor(data: number[], i: number, w: number, h: number, flush: boolean) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = flush ? 0 : 3;
  const xStep = (w - pad * 2) / Math.max(1, data.length - 1);
  const x = pad + xStep * i;
  const norm = (data[i]! - min) / range;
  const y = h - pad - norm * (h - pad * 2);
  return { x, y };
}

function buildPath(data: number[], w: number, h: number, flush: boolean) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = flush ? 0 : 3;
  const xStep = (w - pad * 2) / Math.max(1, data.length - 1);

  const pts = data.map((v, i) => {
    const x = pad + xStep * i;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });

  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const area =
    `M${pts[0]![0].toFixed(2)} ${h.toFixed(2)} ` +
    pts.map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") +
    ` L${pts[pts.length - 1]![0].toFixed(2)} ${h.toFixed(2)} Z`;

  return { line, area };
}
