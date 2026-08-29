import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CariListesi } from "@/components/cari/cari-listesi";
import { CariOzetKartlari } from "@/components/cari/cari-ozet";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hesaplaCariOzeti, listeleCariler } from "@/lib/cari";

export const metadata: Metadata = { title: "Açık Hesaplar · Muhasebe" };

/** ROADMAP Faz 1 "Açık hesap takibi ekranı": bakiyesi sıfır olmayan cariler. */
export default async function AcikHesaplarPage() {
  const cariler = await listeleCariler({ sadeceAcikHesap: true });
  const ozet = hesaplaCariOzeti(cariler.map((c) => c.bakiye));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Açık hesaplar"
        description="Bakiyesi kapanmamış cariler."
        actions={
          <Link href="/cariler" className={buttonVariants({ variant: "secondary" })}>
            Tüm cariler
          </Link>
        }
      />

      <CariOzetKartlari ozet={ozet} />

      {cariler.length === 0 ? (
        <EmptyState
          title="Açık hesap yok"
          description="Tüm cari bakiyeleri sıfır."
        />
      ) : (
        <CariListesi cariler={cariler} />
      )}
    </div>
  );
}
