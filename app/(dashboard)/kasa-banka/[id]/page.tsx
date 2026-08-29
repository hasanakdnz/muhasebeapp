import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { isAdmin } from "@/lib/auth-guards";
import { PageHeader } from "@/components/layout/page-header";
import { HareketForm } from "@/components/kasa/hareket-form";
import { HareketListesi } from "@/components/kasa/hareket-listesi";
import { HesapActions } from "@/components/kasa/hesap-actions";
import { Amount } from "@/components/ui/amount";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toDateInputValue } from "@/lib/date";
import {
  getHesap,
  hesapSilinebilirMi,
  hesaplaHareketOzeti,
  listeleHareketler,
} from "@/lib/kasa";
import { HESAP_TIP_ETIKETI } from "@/lib/validations/kasa";

export const metadata: Metadata = { title: "Hesap · Muhasebe" };

export default async function HesapDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Silme yalnızca yöneticide; personel düğmeyi hiç görmez (lib/rbac.ts).
  const yonetici = await isAdmin();
  const hesap = await getHesap(id);
  if (!hesap) notFound();

  const [hareketler, { silinebilir }] = await Promise.all([
    listeleHareketler(hesap.id),
    hesapSilinebilirMi(hesap.id),
  ]);
  const ozet = hesaplaHareketOzeti(hareketler.map((h) => h.tutar));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={hesap.ad}
        description={HESAP_TIP_ETIKETI[hesap.tip]}
        actions={
          <div className="flex flex-col items-end gap-3">
            <Link
              href={`/kasa-banka/${hesap.id}/duzenle`}
              className={buttonVariants()}
            >
              <Pencil />
              Düzenle
            </Link>
            <HesapActions
              yonetici={yonetici}
              id={hesap.id}
              ad={hesap.ad}
              aktif={hesap.aktif}
              silinebilir={silinebilir}
            />
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardLabel>Bakiye</CardLabel>
          <p className="mt-2 text-display-lg">
            <Amount value={hesap.bakiye} colored />
          </p>
        </Card>
        <Card>
          <CardLabel>Toplam giriş</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.toplamGiris} tone="positive" />
          </p>
        </Card>
        <Card>
          <CardLabel>Toplam çıkış</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.toplamCikis} tone="negative" />
          </p>
        </Card>
      </div>

      <Card className="flex flex-col gap-6">
        <CardTitle>Yeni hareket</CardTitle>
        <HareketForm hesapId={hesap.id} bugun={toDateInputValue(new Date())} />
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-heading-md text-ink">Hesap hareketleri</h2>
        {hareketler.length === 0 ? (
          <EmptyState
            title="Henüz hareket yok"
            description="Yukarıdaki formdan ilk giriş veya çıkışı kaydedin."
          />
        ) : (
          <HareketListesi hesapId={hesap.id} hareketler={hareketler} yonetici={yonetici} />
        )}
      </div>
    </div>
  );
}
