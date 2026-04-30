"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./Modal.module.css";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Optional description rendered under the title and announced to AT. */
  description?: ReactNode;
  /** Hide the built-in close button. The modal still dismisses via Esc / backdrop click. */
  hideCloseButton?: boolean;
  /** Disable click-on-backdrop dismissal. */
  dismissOnBackdrop?: boolean;
  /** Width preset. Default `md` (440px). */
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    open,
    onClose,
    title,
    description,
    hideCloseButton = false,
    dismissOnBackdrop = true,
    size = "md",
    children,
  },
  ref,
) {
  const reduce = usePrefersReducedMotion();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const reactId = useId();
  const titleId = title ? `modal-title-${reactId}` : undefined;
  const descId = description ? `modal-desc-${reactId}` : undefined;

  // Capture the previously focused element so we can restore on close.
  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    // Focus the first focusable element inside, or the dialog itself.
    queueMicrotask(() => {
      const root = dialogRef.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? root).focus();
    });

    return () => {
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Esc to close + scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const onTrapKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
    );
    if (items.length === 0) {
      e.preventDefault();
      root.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!dismissOnBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={[styles.backdrop, reduce && styles.noMotion].filter(Boolean).join(" ")}
      onClick={onBackdropClick}
      data-testid="modal-backdrop"
    >
      <div
        ref={(node) => {
          dialogRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={[styles.dialog, styles[`size_${size}`]].join(" ")}
        onKeyDown={onTrapKeyDown}
      >
        {title || !hideCloseButton ? (
          <header className={styles.header}>
            {title ? (
              <h2 id={titleId} className={["type-display-sm", styles.title].join(" ")}>
                {title}
              </h2>
            ) : (
              <span />
            )}
            {!hideCloseButton ? (
              <button
                type="button"
                className={styles.close}
                aria-label="Close"
                onClick={onClose}
              >
                <X size={18} aria-hidden="true" />
              </button>
            ) : null}
          </header>
        ) : null}
        {description ? (
          <p id={descId} className={["type-body-md", styles.description].join(" ")}>
            {description}
          </p>
        ) : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
});
