/** Henüz uygulanmamış ROADMAP fazları için sakin bir boş durum. */
export function PhasePlaceholder({ faz }: { faz: string }) {
  return (
    <div className="rounded-app bg-surface p-8 text-body-md text-muted">
      Bu ekran <span className="text-ink">{faz}</span> kapsamında geliştirilecek.
    </div>
  );
}
