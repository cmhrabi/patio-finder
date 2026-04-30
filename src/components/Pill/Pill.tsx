import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import styles from "./Pill.module.css";

export type PillVariant = "default" | "accent" | "sun" | "ink" | "ghost-light";

export type PillProps = {
  variant?: PillVariant;
  /** Icon rendered before the label. */
  leadingIcon?: ReactNode;
  children?: ReactNode;
} & HTMLAttributes<HTMLSpanElement>;

export const Pill = forwardRef<HTMLSpanElement, PillProps>(function Pill(
  { variant = "default", leadingIcon, className, children, ...rest },
  ref,
) {
  const cls = [styles.root, styles[variant], "type-body-sm", className].filter(Boolean).join(" ");
  return (
    <span ref={ref} className={cls} {...rest}>
      {leadingIcon ? <span className={styles.icon} aria-hidden="true">{leadingIcon}</span> : null}
      <span className={styles.label}>{children}</span>
    </span>
  );
});
