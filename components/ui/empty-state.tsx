import * as React from "react";

/** Sakin boş durum — spinner/uyarı rengi yok, sadece nötr metin. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-app bg-surface px-6 py-16 text-center">
      <p className="text-body-lg text-ink">{title}</p>
      {description && <p className="text-body-md text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
