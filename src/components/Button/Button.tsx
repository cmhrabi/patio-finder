import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "ink" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Span the full width of the parent. */
  block?: boolean;
  /** Icon rendered before the label (treated as decorative). */
  leadingIcon?: ReactNode;
  /** Icon rendered after the label (treated as decorative). */
  trailingIcon?: ReactNode;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    block = false,
    leadingIcon,
    trailingIcon,
    type = "button",
    className,
    children,
    ...rest
  },
  ref,
) {
  const cls = [
    styles.root,
    styles[variant],
    styles[`size_${size}`],
    block && styles.block,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {leadingIcon ? (
        <span className={styles.icon} aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
      {trailingIcon ? (
        <span className={styles.icon} aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});
