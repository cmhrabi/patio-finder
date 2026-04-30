"use client";

import { forwardRef, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./Toggle.module.css";

export type ToggleProps = {
  /** Controlled on state. */
  checked?: boolean;
  /** Uncontrolled initial state. */
  defaultChecked?: boolean;
  onChange?: (next: boolean) => void;
  /** Visible label rendered alongside the switch. */
  label?: ReactNode;
  /** Accessible name when no visible label is rendered. */
  "aria-label"?: string;
  disabled?: boolean;
  size?: "sm" | "md";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">;

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    checked,
    defaultChecked = false,
    onChange,
    label,
    disabled,
    size = "md",
    id,
    className,
    "aria-label": ariaLabel,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const switchId = id ?? `tg-${reactId}`;
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = isControlled ? checked! : internal;

  const handleClick = () => {
    if (disabled) return;
    const next = !isOn;
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const cls = [styles.root, styles[`size_${size}`], isOn && styles.on, disabled && styles.disabled, className]
    .filter(Boolean)
    .join(" ");

  const switchEl = (
    <button
      {...rest}
      ref={ref}
      id={switchId}
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      className={cls}
    >
      <span className={styles.thumb} aria-hidden="true" />
    </button>
  );

  if (!label) return switchEl;

  return (
    <label className={styles.row} htmlFor={switchId}>
      {switchEl}
      <span className={styles.label}>{label}</span>
    </label>
  );
});
