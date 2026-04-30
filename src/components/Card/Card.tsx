import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import styles from "./Card.module.css";
import type { CardStyle } from "@/theme/types";

export type CardProps = {
  /** Override the active card style for just this card. Defaults to the provider value. */
  cardStyle?: CardStyle;
  /** Hover lift + cursor pointer when true. */
  interactive?: boolean;
  as?: "div" | "article" | "li" | "a";
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

type CardComponent = ReturnType<typeof forwardRef<HTMLDivElement, CardProps>> & {
  Media: typeof CardMedia;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

const CardRoot = forwardRef<HTMLDivElement, CardProps>(function Card(
  { cardStyle, interactive = false, as = "div", className, children, ...rest },
  ref,
) {
  const Tag = as as "div";
  const cls = [styles.root, interactive && styles.interactive, className].filter(Boolean).join(" ");
  // The data-card-style attribute scopes the CSS variables to this subtree
  // so individual cards can override the global setting from <ThemeProvider>.
  const dataAttrs = cardStyle ? { "data-card-style": cardStyle } : undefined;
  return (
    <Tag ref={ref} className={cls} {...dataAttrs} {...rest}>
      {children}
    </Tag>
  );
});

export type CardMediaProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };
const CardMedia = forwardRef<HTMLDivElement, CardMediaProps>(function CardMedia(
  { className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={[styles.media, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
});

export type CardBodyProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };
const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(function CardBody(
  { className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={[styles.body, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
});

export type CardFooterProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };
const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter(
  { className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={[styles.footer, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
});

const Card = CardRoot as CardComponent;
Card.Media = CardMedia;
Card.Body = CardBody;
Card.Footer = CardFooter;

export { Card };
