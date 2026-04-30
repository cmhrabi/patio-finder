"use client";

import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./Star.module.css";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export type StarProps = {
  /** Controlled state. Omit to use uncontrolled. */
  pressed?: boolean;
  /** Uncontrolled initial state. */
  defaultPressed?: boolean;
  onChange?: (next: boolean) => void;
  size?: number;
  /** Accessible name when toggled off. Defaults to "Save". */
  labelOff?: ReactNode;
  /** Accessible name when toggled on. Defaults to "Saved". */
  labelOn?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">;

export const Star = forwardRef<HTMLButtonElement, StarProps>(function Star(
  {
    pressed,
    defaultPressed = false,
    onChange,
    size = 22,
    labelOff = "Save",
    labelOn = "Saved",
    className,
    onClick,
    ...rest
  },
  ref,
) {
  const reduce = usePrefersReducedMotion();
  const isControlled = pressed !== undefined;
  const [internal, setInternal] = useState(defaultPressed);
  const isOn = isControlled ? pressed! : internal;
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => {
    if (!bouncing) return;
    const t = window.setTimeout(() => setBouncing(false), 220);
    return () => window.clearTimeout(t);
  }, [bouncing]);

  const handleClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = (e) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    const next = !isOn;
    if (!isControlled) setInternal(next);
    onChange?.(next);
    if (!reduce) setBouncing(true);
  };

  const cls = [styles.root, isOn && styles.on, bouncing && !reduce && styles.bounce, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-pressed={isOn}
      aria-label={typeof (isOn ? labelOn : labelOff) === "string" ? String(isOn ? labelOn : labelOff) : undefined}
      className={cls}
      onClick={handleClick}
      style={{ width: size + 12, height: size + 12 }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        className={styles.icon}
      >
        <path
          d="M12 17.27l-6.18 3.73 1.64-7.03L2 9.24l7.19-.62L12 2l2.81 6.62 7.19.62-5.46 4.73 1.64 7.03L12 17.27z"
          fill={isOn ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
});
