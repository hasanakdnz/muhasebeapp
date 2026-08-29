import { cn } from "@/lib/utils";

/** Hiyerarşi tipografi ağırlığı ve boşlukla kurulur — kutu/çizgi ile değil. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-lg text-ink">{title}</h1>
        {description && (
          <p className="text-body-md text-muted">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
