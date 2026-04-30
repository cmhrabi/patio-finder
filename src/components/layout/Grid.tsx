import { forwardRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import type { SpaceToken } from "@/tokens/tokens";

export type GridProps = {
  as?: ElementType;
  /** Number of equal columns, or a custom grid-template-columns string. Default `1`. */
  columns?: number | string;
  gap?: SpaceToken;
  /** Min track size when columns is a number. Pass to use `repeat(auto-fill, minmax(min, 1fr))`. */
  minColumnWidth?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export const Grid = forwardRef<HTMLElement, GridProps>(function Grid(
  { as, columns = 1, gap = "4", minColumnWidth, className, style, children, ...rest },
  ref,
) {
  const Tag = (as ?? "div") as ElementType;
  const template =
    typeof columns === "string"
      ? columns
      : minColumnWidth
        ? `repeat(auto-fill, minmax(${minColumnWidth}, 1fr))`
        : `repeat(${columns}, minmax(0, 1fr))`;
  const merged: CSSProperties = {
    display: "grid",
    gridTemplateColumns: template,
    gap: `var(--space-${gap})`,
    ...style,
  };
  return (
    <Tag ref={ref} className={className} style={merged} {...rest}>
      {children}
    </Tag>
  );
});
