"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function PhotoDialog({
  title,
  onClose,
  children,
  variant = "drawer",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: "drawer" | "viewer" | "confirm";
}) {
  const root = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const label = useId();
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ) ?? []),
      ];
      const first = controls[0],
        last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === root.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === root.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  useEffect(() => { root.current?.focus(); }, [variant]);
  return (
    <div className={`photo-layer photo-layer--${variant}`}>
      <div className="photo-backdrop" onClick={onClose} aria-hidden="true" />
      <section
        className={`photo-dialog photo-dialog--${variant}`}
        ref={root}
        role={variant === "confirm" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={label}
        tabIndex={-1}
      >
        <header className="photo-dialog__header">
          <h2 id={label}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close photo dialog"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
