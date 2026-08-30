import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth-guards";
import { PageHeader } from "@/components/layout/page-header";
import { IslemActions } from "@/components/islem/islem-actions";
import { OdemePaneli } from "@/components/islem/odeme-panel";
import { listeleHesaplar } from "@/lib/kasa";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import { formatTarih, toDateInputValue } from "@/lib/date";
import { ODEME_STATUS_ETIKETI } from "@/lib/domain/odeme";
import { ISLEM_TIP_ETIKETI } from "@/lib/domain/islem";
import { getIslem } from "@/lib/islem";
import { kullanilabilirCekler, listeleOdemeler } from "@/lib/odeme";
import { formatTRY } from "@/lib/money";

export const metadata: Metadata = { title: "İşlem · Muhasebe" };

export default async function IslemDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // İşlemi ve ondan bağımsız olanları birlikte çek; yalnızca cariye bağlı
  // olan sorgu işlemin gelmesini beklemek zorunda.
  const [yonetici, islem, odemeler, hesaplar] = await Promise.all([
    isAdmin(),
    getIslem(id),
    listeleOdemeler(id),
    listeleHesaplar(),
  ]);
  if (!islem) notFound();

  const cekler = await kullanilabilirCekler(islem.cariId);

  const statusVaryanti =
    islem.status === "ODENDI"
      ? ("positive" as const)
      : islem.status === "KISMI_ODENDI"
        ? ("pending" as const)
        : islem.status === "IPTAL"
          ? ("neutral" as const)
          : ("pending" as const);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${ISLEM_TIP_ETIKETI[islem.tip]} ${islem.no}`}
        description={
          islem.belgeNo
            ? `${islem.cariUnvan} · belge no ${islem.belgeNo} · ${formatTarih(islem.tarih)}`
            : `${islem.cariUnvan} · ${formatTarih(islem.tarih)}`
        }
        actions={
          <div className="flex flex-col items-end gap-3">
            <Link
              href={`/cariler/${islem.cariId}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Cari kartına git
            </Link>
            <IslemActions
              yonetici={yonetici}
              id={islem.id}
              cariId={islem.cariId}
              cariUnvan={islem.cariUnvan}
              toplamTutar={formatTRY(islem.toplamTutar)}
            />
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-4">
        <Card>
          <CardLabel>Genel toplam</CardLabel>
          <p className="mt-2 text-display-lg">
            <Amount
              value={islem.toplamTutar}
              tone={islem.tip === "SATIS" ? "positive" : "negative"}
            />
          </p>
        </Card>
        <Card>
          <CardLabel>Matrah</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={islem.matrah} />
          </p>
        </Card>
        <Card>
          <CardLabel>KDV</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={islem.kdvTutari} />
          </p>
        </Card>
        <Card>
          <CardLabel>Kalan</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount
              value={islem.kalanTutar}
              tone={Number(islem.kalanTutar) === 0 ? "neutral" : "negative"}
            />
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={statusVaryanti}>
              {ODEME_STATUS_ETIKETI[islem.status]}
            </Badge>
            {islem.vadeTarihi && (
              <span className="text-body-sm text-muted">
                vade {formatTarih(islem.vadeTarihi)}
              </span>
            )}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-6">
        <CardTitle>Ödemeler</CardTitle>
        <OdemePaneli
          yonetici={yonetici}
          hesaplar={hesaplar}
          islemId={islem.id}
          cariId={islem.cariId}
          kalanTutar={islem.kalanTutar}
          status={islem.status}
          odemeler={odemeler}
          cekler={cekler}
          bugun={toDateInputValue(new Date())}
        />
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-heading-md text-ink">Kalemler</h2>
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Ürün / hizmet</LedgerHeadCell>
              <LedgerHeadCell numeric>Miktar</LedgerHeadCell>
              <LedgerHeadCell numeric>Birim fiyat</LedgerHeadCell>
              <LedgerHeadCell numeric>KDV</LedgerHeadCell>
              <LedgerHeadCell numeric>Matrah</LedgerHeadCell>
              <LedgerHeadCell numeric>KDV tutarı</LedgerHeadCell>
              <LedgerHeadCell numeric>Toplam</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {islem.kalemler.map((kalem) => (
              <LedgerRow key={kalem.id}>
                <LedgerCell>{kalem.urunAdi}</LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <span data-numeric="">{kalem.miktar}</span>
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  {/* Birim fiyat KDV hariçtir ve kuruştan hassas olabilir. */}
                  <Amount value={kalem.birimFiyat} />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <span data-numeric="">%{kalem.kdvOrani}</span>
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={kalem.matrah} />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={kalem.kdv} />
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount value={kalem.brut} />
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      </div>
    </div>
  );
}
