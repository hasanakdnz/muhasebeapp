import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CekSenetActions } from "@/components/cek-senet/cek-senet-actions";
import { DurumBadge } from "@/components/cek-senet/durum-badge";
import { TahsilatPaneli } from "@/components/cek-senet/tahsilat-panel";
import { Amount } from "@/components/ui/amount";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { getCekSenet } from "@/lib/cek-senet";
import { formatTarih, toDateInputValue } from "@/lib/date";
import {
  CEK_SENET_TIP_ETIKETI,
  CEK_SENET_YON_ETIKETI,
} from "@/lib/domain/cek-senet";

export const metadata: Metadata = { title: "Çek/Senet · Muhasebe" };

export default async function CekSenetDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kayit = await getCekSenet(id);
  if (!kayit) notFound();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${CEK_SENET_YON_ETIKETI[kayit.yon]} ${CEK_SENET_TIP_ETIKETI[kayit.tip].toLocaleLowerCase("tr")}`}
        description={kayit.cariUnvan}
        actions={
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3">
              <Link
                href={`/cariler/${kayit.cariId}`}
                className={buttonVariants({ variant: "secondary" })}
              >
                Cari kartı
              </Link>
              <Link
                href={`/cek-senet/${kayit.id}/duzenle`}
                className={buttonVariants()}
              >
                <Pencil />
                Düzenle
              </Link>
            </div>
            <CekSenetActions
              id={kayit.id}
              cariId={kayit.cariId}
              durum={kayit.durum}
              tahsilatSayisi={kayit.tahsilatlar.length}
            />
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-4">
        <Card>
          <CardLabel>Tutar</CardLabel>
          <p className="mt-2 text-display-lg">
            <Amount value={kayit.tutar} />
          </p>
        </Card>
        <Card>
          <CardLabel>Tahsil edilen</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={kayit.tahsilEdilen} tone="positive" />
          </p>
        </Card>
        <Card>
          <CardLabel>Kalan</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount
              value={kayit.kalan}
              tone={kayit.yon === "ALINAN" ? "positive" : "negative"}
            />
          </p>
        </Card>
        <Card>
          <CardLabel>Vade</CardLabel>
          <p className="mt-2 text-heading-md text-ink">
            {formatTarih(kayit.vadeTarihi)}
          </p>
          <div className="mt-2">
            <DurumBadge durum={kayit.durum} />
          </div>
        </Card>
      </div>

      {kayit.aciklama && (
        <Card>
          <CardLabel>Açıklama</CardLabel>
          <p className="mt-2 text-body-md text-ink">{kayit.aciklama}</p>
        </Card>
      )}

      <Card className="flex flex-col gap-6">
        <CardTitle>Tahsilatlar</CardTitle>
        <TahsilatPaneli
          cekSenet={kayit}
          bugun={toDateInputValue(new Date())}
        />
      </Card>
    </div>
  );
}
