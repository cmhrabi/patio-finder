import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import styles from "./Eyebrow.module.css";

export type EyebrowProps = {
  /** Optional accent dot before the label. */
  accent?: boolean;
  children?: ReactNode;
} & HTMLAttributes<HTMLSpanElement>;

export const Eyebrow = forwardRef<HTMLSpanElement, EyebrowProps>(function Eyebrow(
  { accent = false, className, children, ...rest },
  ref,
) {
  const cls = ["type-eyebrow", styles.root, accent && styles.accent, className].filter(Boolean).join(" ");
  return (
    <span ref={ref} className={cls} {...rest}>
      {accent ? <span aria-hidden="true" className={styles.dot} /> : null}
      {children}
    </span>
  );
});
