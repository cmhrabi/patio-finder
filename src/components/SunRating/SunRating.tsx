import { forwardRef, type HTMLAttributes } from "react";
import styles from "./SunRating.module.css";

export type SunRatingProps = {
  /** 0–100 sun-exposure score. Values outside the range are clamped. */
  value: number;
  /** Total dot count. Default 5. */
  total?: number;
  /** Dot diameter in px. Default 14. */
  size?: number;
  /** Optional accessible label override (defaults to a sensible string). */
  "aria-label"?: string;
  /** Hide the visually-hidden text label. */
  hideLabel?: boolean;
} & Omit<HTMLAttributes<HTMLSpanElement>, "aria-label">;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Renders 5 dots filled proportionally to a 0–100 score. Each dot represents 20 points;
 * a partial dot is rendered with a width-based foreground overlay so we get fractional fills.
 */
export const SunRating = forwardRef<HTMLSpanElement, SunRatingProps>(function SunRating(
  { value, total = 5, size = 14, "aria-label": ariaLabel, hideLabel = false, className, ...rest },
  ref,
) {
  const v = clamp(value, 0, 100);
  const perDot = 100 / total;
  const label = ariaLabel ?? `Sun exposure: ${Math.round(v)} out of 100`;

  return (
    <span
      ref={ref}
      className={[styles.root, className].filter(Boolean).join(" ")}
      role="img"
      aria-label={label}
      {...rest}
    >
      <span className={styles.track} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const start = i * perDot;
          const fillPct = clamp(((v - start) / perDot) * 100, 0, 100);
          return (
            <span
              key={i}
              className={styles.dot}
              style={{ width: size, height: size }}
            >
              <span
                className={styles.fill}
                style={{ width: `${fillPct}%`, height: size }}
              />
            </span>
          );
        })}
      </span>
      {!hideLabel ? <span className={styles.srOnly}>{label}</span> : null}
    </span>
  );
});
