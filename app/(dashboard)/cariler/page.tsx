import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CariListesi } from "@/components/cari/cari-listesi";
import { CariOzetKartlari } from "@/components/cari/cari-ozet";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hesaplaCariOzeti, listeleCariler } from "@/lib/cari";
import {
  CARI_TIPLERI,
  CARI_TIP_ETIKETI,
  type CariTipiValue,
} from "@/lib/validations/cari";

export const metadata: Metadata = { title: "Cariler · Muhasebe" };

type Params = {
  q?: string;
  tip?: string;
  yeni?: string;
  pasif?: string;
};

export default async function CarilerPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const tip = CARI_TIPLERI.includes(sp.tip as CariTipiValue)
    ? (sp.tip as CariTipiValue)
    : undefined;
  const pasifleriGoster = sp.pasif === "1";

  const cariler = await listeleCariler({ q, tip, pasifleriGoster });
  const ozet = hesaplaCariOzeti(cariler.map((c) => c.bakiye));
  const filtreliMi = Boolean(q || tip || pasifleriGoster);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Cariler"
        description="Müşteri ve tedarikçi hesapları."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/cariler/acik-hesaplar"
              className={buttonVariants({ variant: "secondary" })}
            >
              Açık hesaplar
            </Link>
            <Link href="/cariler/yeni" className={buttonVariants()}>
              <Plus />
              Yeni cari
            </Link>
          </div>
        }
      />

      <CariOzetKartlari ozet={ozet} />

      {/* JS gerektirmeyen GET formu — filtre durumu URL'de taşınır. */}
      <form className="flex flex-wrap items-end gap-3" action="/cariler">
        <div className="min-w-56 flex-1">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Ünvan veya VKN/TCKN ara"
            aria-label="Cari ara"
          />
        </div>
        <Select
          name="tip"
          defaultValue={tip ?? ""}
          aria-label="Cari tipi"
          className="w-48"
        >
          <option value="">Tüm tipler</option>
          {CARI_TIPLERI.map((t) => (
            <option key={t} value={t}>
              {CARI_TIP_ETIKETI[t]}
            </option>
          ))}
        </Select>
        <label className="flex h-11 items-center gap-2 text-body-md text-muted">
          <input
            type="checkbox"
            name="pasif"
            value="1"
            defaultChecked={pasifleriGoster}
            aria-label="Pasifleri göster"
            className="size-4 accent-ink"
          />
          Pasifleri göster
        </label>
        <button type="submit" className={buttonVariants({ variant: "secondary" })}>
          Filtrele
        </button>
        {filtreliMi && (
          <Link href="/cariler" className={buttonVariants({ variant: "text" })}>
            Temizle
          </Link>
        )}
      </form>

      {cariler.length === 0 ? (
        <EmptyState
          title={filtreliMi ? "Eşleşen cari yok" : "Henüz cari yok"}
          description={
            filtreliMi
              ? "Farklı bir arama veya filtre deneyin."
              : "İlk müşteri ya da tedarikçi hesabınızı oluşturun."
          }
          action={
            filtreliMi ? undefined : (
              <Link href="/cariler/yeni" className={buttonVariants()}>
                <Plus />
                Yeni cari
              </Link>
            )
          }
        />
      ) : (
        <CariListesi cariler={cariler} yeniId={sp.yeni} />
      )}
    </div>
  );
}
