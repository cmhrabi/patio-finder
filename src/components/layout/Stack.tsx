import { forwardRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import type { SpaceToken } from "@/tokens/tokens";

export type StackProps = {
  as?: ElementType;
  /** Spacing token (`1`–`10`) → `var(--space-N)`. Default `4`. */
  gap?: SpaceToken;
  direction?: "row" | "column";
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  {
    as,
    gap = "4",
    direction = "column",
    align,
    justify,
    wrap = false,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const Tag = (as ?? "div") as ElementType;
  const merged: CSSProperties = {
    display: "flex",
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? "wrap" : "nowrap",
    gap: `var(--space-${gap})`,
    ...style,
  };
  return (
    <Tag ref={ref} className={className} style={merged} {...rest}>
      {children}
    </Tag>
  );
});
