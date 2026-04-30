import { forwardRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import type { SpaceToken } from "@/tokens/tokens";

export type ClusterProps = {
  as?: ElementType;
  gap?: SpaceToken;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/** Wrap-friendly horizontal grouping. Children flow left-to-right and wrap as needed. */
export const Cluster = forwardRef<HTMLElement, ClusterProps>(function Cluster(
  { as, gap = "3", align = "center", justify, className, style, children, ...rest },
  ref,
) {
  const Tag = (as ?? "div") as ElementType;
  const merged: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: align,
    justifyContent: justify,
    gap: `var(--space-${gap})`,
    ...style,
  };
  return (
    <Tag ref={ref} className={className} style={merged} {...rest}>
      {children}
    </Tag>
  );
});
