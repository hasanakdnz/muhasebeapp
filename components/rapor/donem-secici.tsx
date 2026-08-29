import Link from "next/link";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { YazdirButonu } from "@/components/rapor/yazdir-butonu";
import type { Donem } from "@/lib/donem";

/**
 * Rapor dönem seçici + dışa aktarım.
 *
 * JS gerektirmeyen GET formu — dönem URL'de taşınır, rapor paylaşılabilir ve
 * yer imine eklenebilir. `data-print="gizle"` ile baskı çıktısında görünmez.
 */
export function DonemSecici({
  action,
  donem,
  csvUrl,
}: {
  action: string;
  donem: Donem;
  /** CSV indirme bağlantısı; verilmezse dışa aktarım butonu çıkmaz. */
  csvUrl?: string;
}) {
  return (
    <div
      data-print="gizle"
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <form action={action} className="flex flex-wrap items-end gap-3">
        <Field id="baslangic" label="Başlangıç" className="w-44">
          <Input
            id="baslangic"
            name="baslangic"
            type="date"
            defaultValue={donem.baslangicInput}
          />
        </Field>
        <Field id="bitis" label="Bitiş" className="w-44">
          <Input
            id="bitis"
            name="bitis"
            type="date"
            defaultValue={donem.bitisInput}
          />
        </Field>
        <button type="submit" className={buttonVariants({ variant: "secondary" })}>
          Uygula
        </button>
      </form>

      <div className="flex items-center gap-3">
        {csvUrl && (
          <Link href={csvUrl} className={buttonVariants({ variant: "secondary" })}>
            <Download />
            Excel (CSV)
          </Link>
        )}
        <YazdirButonu />
      </div>
    </div>
  );
}
