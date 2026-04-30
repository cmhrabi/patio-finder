import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import styles from "./Heading.module.css";

export type HeadingSize =
  | "display-xl"
  | "display-lg"
  | "display-md"
  | "display-sm";

export type HeadingProps = {
  as?: ElementType;
  size?: HeadingSize;
  /** When true, renders the heading in `--theme-text-mute` (used for secondary headings). */
  muted?: boolean;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLHeadingElement>, "color">;

const defaultTagFor: Record<HeadingSize, ElementType> = {
  "display-xl": "h1",
  "display-lg": "h1",
  "display-md": "h2",
  "display-sm": "h3",
};

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { as, size = "display-md", muted = false, className, children, ...rest },
  ref,
) {
  const Tag = (as ?? defaultTagFor[size]) as ElementType;
  const cls = [`type-${size}`, styles.heading, muted && styles.muted, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag ref={ref} className={cls} {...rest}>
      {children}
    </Tag>
  );
});
