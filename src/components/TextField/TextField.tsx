"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./TextField.module.css";

export type TextFieldVariant = "form" | "search";
export type TextFieldSize = "md" | "lg";

export type TextFieldProps = {
  variant?: TextFieldVariant;
  size?: TextFieldSize;
  /** Label text. Visually hidden when `hideLabel` is true. */
  label?: string;
  hideLabel?: boolean;
  /** Inline help text rendered under the input. */
  hint?: string;
  /** Error message — when present, the field is marked invalid. */
  error?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "size">;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    variant = "form",
    size = "md",
    label,
    hideLabel = false,
    hint,
    error,
    leadingIcon,
    trailingIcon,
    id,
    className,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? `tf-${reactId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  const cls = [
    styles.field,
    styles[variant],
    styles[`size_${size}`],
    error && styles.invalid,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.root}>
      {label ? (
        <label
          htmlFor={inputId}
          className={[styles.label, hideLabel && styles.srOnly].filter(Boolean).join(" ")}
        >
          {label}
        </label>
      ) : null}
      <div className={cls}>
        {leadingIcon ? (
          <span className={styles.icon} aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        />
        {trailingIcon ? (
          <span className={styles.icon} aria-hidden="true">
            {trailingIcon}
          </span>
        ) : null}
      </div>
      {hint && !error ? (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
});
