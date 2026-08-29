import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { IslemActions } from "@/components/islem/islem-actions";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import { formatTarih } from "@/lib/date";
import { ISLEM_TIP_ETIKETI } from "@/lib/domain/islem";
import { getIslem } from "@/lib/islem";
import { formatTRY } from "@/lib/money";

export const metadata: Metadata = { title: "İşlem · Muhasebe" };

export default async function IslemDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const islem = await getIslem(id);
  if (!islem) notFound();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${ISLEM_TIP_ETIKETI[islem.tip]} · ${formatTarih(islem.tarih)}`}
        description={islem.cariUnvan}
        actions={
          <div className="flex flex-col items-end gap-3">
            <Link
              href={`/cariler/${islem.cariId}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              Cari kartına git
            </Link>
            <IslemActions
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
          <CardLabel>Vade</CardLabel>
          <p className="mt-2 text-heading-md text-ink">
            {islem.vadeTarihi ? formatTarih(islem.vadeTarihi) : "—"}
          </p>
          {islem.vadeTarihi && (
            <Badge variant="pending" className="mt-2">
              bekliyor
            </Badge>
          )}
        </Card>
      </div>

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
