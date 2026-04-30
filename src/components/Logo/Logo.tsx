import { forwardRef, type HTMLAttributes } from "react";
import styles from "./Logo.module.css";

export type LogoVariant = "full" | "mark";

export type LogoProps = {
  /** Mark height in px. Default 28. The wordmark scales proportionally. */
  size?: number;
  variant?: LogoVariant;
  /** Optional accessible label. Defaults to "SunChaser". Pass `""` to mark decorative. */
  title?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "title">;

/**
 * SunChaser logo: a circle whose left half is filled (representing sun + shade),
 * surrounded by 8 rays at 45° intervals — the rays start outside the circle,
 * so the mark reads as a sun even at small sizes.
 *
 * Drawn in a 32×32 viewBox; colour follows `currentColor` so it adapts to the
 * surrounding theme.
 */
export const Logo = forwardRef<HTMLSpanElement, LogoProps>(function Logo(
  { size = 28, variant = "full", title = "SunChaser", className, ...rest },
  ref,
) {
  const decorative = title === "";
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": title };

  // 8 rays at 45° intervals, starting ~1.5px outside the circle (r=8) and 3px long.
  // Centre is (16,16). Each ray is rendered with a stroke of width 1.6.
  const rays = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <span
      ref={ref}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{ height: size }}
      {...a11y}
      {...rest}
    >
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className={styles.mark}
        focusable="false"
        aria-hidden="true"
      >
        <defs>
          {/* Clip path that retains only the left half of the circle. */}
          <clipPath id="sc-half">
            <rect x="0" y="0" width="16" height="32" />
          </clipPath>
        </defs>

        {/* Outline */}
        <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />

        {/* Filled left half */}
        <circle cx="16" cy="16" r="8" fill="currentColor" clipPath="url(#sc-half)" />

        {/* Rays — 8 short strokes at 45° intervals, starting outside the circle. */}
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          {rays.map((deg) => (
            <line
              key={deg}
              x1="16"
              y1="4.5"
              x2="16"
              y2="1.5"
              transform={`rotate(${deg} 16 16)`}
            />
          ))}
        </g>
      </svg>
      {variant === "full" ? (
        <span className={styles.wordmark} style={{ fontSize: size * 0.86 }}>
          SunChaser
        </span>
      ) : null}
    </span>
  );
});
