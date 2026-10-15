"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function GuestDialog({ title, onClose, children, confirmation = false }: { title: string; onClose: () => void; children: ReactNode; confirmation?: boolean }) {
  const root = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) { event.preventDefault(); root.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);
  return <div className={`guest-dialog-layer${confirmation ? " guest-dialog-layer--confirmation" : ""}`}>
    <div className="guest-dialog-backdrop" onClick={onClose} aria-hidden="true" />
    <section aria-modal="true" aria-labelledby="guest-dialog-title" className={`guest-dialog${confirmation ? " guest-dialog--confirmation" : ""}`} ref={root} role={confirmation ? "alertdialog" : "dialog"} tabIndex={-1}>
      <header className="guest-dialog__header"><h2 id="guest-dialog-title">{title}</h2><button className="icon-button" aria-label="Close guest dialog" onClick={onClose} type="button"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header>
      {children}
    </section>
  </div>;
}
