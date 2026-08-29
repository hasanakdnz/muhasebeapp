import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProformaActions } from "@/components/proforma/proforma-actions";
import { ProformaPaylas } from "@/components/proforma/proforma-paylas";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Card, CardLabel } from "@/components/ui/card";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import { isAdmin } from "@/lib/auth-guards";
import { formatTarih, toDateInputValue } from "@/lib/date";
import {
  PROFORMA_DURUM_ETIKETI,
  PROFORMA_DURUM_TONU,
} from "@/lib/domain/proforma";
import { firmaGetir } from "@/lib/firma";
import { formatTRY, formatYuzde } from "@/lib/money";
import { proformaGetir } from "@/lib/proforma";

export const metadata: Metadata = { title: "Teklif · Muhasebe" };

export default async function ProformaDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Silme yalnızca yöneticide; personel düğmeyi hiç görmez (lib/rbac.ts).
  const [proforma, firma, yonetici] = await Promise.all([
    proformaGetir(id),
    firmaGetir(),
    isAdmin(),
  ]);
  if (!proforma) notFound();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Teklif ${proforma.no}`}
        description={proforma.cariUnvan}
        actions={
          <ProformaActions
            id={proforma.id}
            no={proforma.no}
            durum={proforma.durum}
            bugun={toDateInputValue(new Date())}
            yonetici={yonetici}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={PROFORMA_DURUM_TONU[proforma.durum]}>
          {PROFORMA_DURUM_ETIKETI[proforma.durum]}
        </Badge>
        {proforma.suresiDoldu && <Badge variant="negative">Süresi doldu</Badge>}
        {proforma.islemId && (
          <Link
            href={`/islemler/${proforma.islemId}`}
            className="text-body-sm text-muted underline underline-offset-4 hover:text-ink"
          >
            Oluşan faturayı görüntüle
          </Link>
        )}
      </div>

      <ProformaPaylas
        id={proforma.id}
        no={proforma.no}
        cariUnvan={proforma.cariUnvan}
        cariEmail={proforma.cariEmail}
        cariTelefon={proforma.cariTelefon}
        firmaUnvani={firma.unvan}
        toplamTutar={formatTRY(proforma.toplamTutar)}
        gecerlilikTarihi={
          proforma.gecerlilikTarihi
            ? formatTarih(proforma.gecerlilikTarihi)
            : null
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardLabel>Teklif tarihi</CardLabel>
          <p className="mt-2 text-body-lg text-ink">
            {formatTarih(proforma.tarih)}
          </p>
        </Card>
        <Card>
          <CardLabel>Geçerlilik</CardLabel>
          <p className="mt-2 text-body-lg text-ink">
            {proforma.gecerlilikTarihi
              ? formatTarih(proforma.gecerlilikTarihi)
              : "Süresiz"}
          </p>
        </Card>
        <Card>
          <CardLabel>KDV</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={proforma.kdvTutari} />
          </p>
        </Card>
        <Card>
          <CardLabel>Genel toplam</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={proforma.toplamTutar} />
          </p>
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
              <LedgerHeadCell numeric>Toplam</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {proforma.kalemler.map((k) => (
              <LedgerRow key={k.id}>
                <LedgerCell>{k.urunAdi}</LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <span data-numeric="">{k.miktar}</span>
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={k.birimFiyat} />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <span data-numeric="">%{formatYuzde(k.kdvOrani, 0)}</span>
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={k.matrah} />
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount value={k.brut} />
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      </div>

      {proforma.notlar && (
        <Card className="max-w-2xl">
          <CardLabel>Notlar</CardLabel>
          <p className="mt-2 whitespace-pre-line text-body-md text-ink">
            {proforma.notlar}
          </p>
        </Card>
      )}
    </div>
  );
}
