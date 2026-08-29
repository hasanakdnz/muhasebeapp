"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Tek gerçek "yüzen" katman (DESIGN.md Elevation): yumuşak, düşük opaklıklı
 * gölge. Native <dialog> kullanılır — odak tuzağı ve Esc davranışı tarayıcıdan
 * gelir, ek bağımlılık gerekmez.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className={[
        "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-app bg-surface p-8",
        "text-ink shadow-float backdrop:bg-ink/20",
      ].join(" ")}
    >
      <h2 className="text-heading-md">{title}</h2>
      <p className="mt-2 text-body-md text-muted">{description}</p>
      <div className="mt-8 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Vazgeç
        </Button>
        <Button onClick={onConfirm} disabled={pending}>
          {pending ? "İşleniyor…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
