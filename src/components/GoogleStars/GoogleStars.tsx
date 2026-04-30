"use client";

import { forwardRef, useId, type HTMLAttributes } from "react";
import styles from "./GoogleStars.module.css";

export type GoogleStarsProps = {
  /** Rating in the 0..5 range, half-stars supported. */
  value: number;
  /** Optional review count rendered alongside the rating. */
  reviews?: number;
  /** Star size in px. Default 14. */
  size?: number;
  /** Hide the numeric rating + count badge. */
  hideMeta?: boolean;
} & HTMLAttributes<HTMLSpanElement>;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function formatReviewCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

const StarPath =
  "M12 2.25l3.09 6.26 6.91.59-5.25 4.55 1.59 6.85L12 16.77 5.66 20.5l1.59-6.85L2 9.1l6.91-.59L12 2.25z";

export const GoogleStars = forwardRef<HTMLSpanElement, GoogleStarsProps>(function GoogleStars(
  { value, reviews, size = 14, hideMeta = false, className, ...rest },
  ref,
) {
  const v = clamp(value, 0, 5);
  const reactId = useId();
  const clipId = `gs-clip-${reactId}`;
  const widthPct = (v / 5) * 100;
  const reviewLabel = reviews !== undefined ? ` (${formatReviewCount(reviews)} reviews)` : "";
  const ariaLabel = `${v.toFixed(1)} of 5 stars${reviewLabel}`;

  return (
    <span
      ref={ref}
      className={[styles.root, className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
      {...rest}
    >
      <span
        className={styles.stars}
        aria-hidden="true"
        style={{ width: size * 5 + 4 * 2, height: size }}
      >
        <svg
          viewBox={`0 0 ${24 * 5 + 4 * 2 * (24 / size)} 24`}
          preserveAspectRatio="none"
          className={styles.layer}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={`${widthPct}%`} height="24" />
            </clipPath>
          </defs>
          {/* Background row: 5 outline stars */}
          <g className={styles.bgRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <g
                key={i}
                transform={`translate(${i * (24 + 4 * (24 / size))} 0)`}
              >
                <path d={StarPath} fill="none" stroke="currentColor" strokeWidth="1.5" />
              </g>
            ))}
          </g>
          {/* Foreground row: same stars filled, clipped to widthPct */}
          <g className={styles.fgRow} clipPath={`url(#${clipId})`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <g
                key={i}
                transform={`translate(${i * (24 + 4 * (24 / size))} 0)`}
              >
                <path d={StarPath} fill="currentColor" />
              </g>
            ))}
          </g>
        </svg>
      </span>
      {!hideMeta ? (
        <span className={styles.meta}>
          <span className={styles.value}>{v.toFixed(1)}</span>
          {reviews !== undefined ? (
            <span className={styles.count}>· {formatReviewCount(reviews)}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
});
