import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { DonemSecici } from "@/components/rapor/donem-secici";
import { Amount } from "@/components/ui/amount";
import { Card, CardLabel } from "@/components/ui/card";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import { donemCoz } from "@/lib/donem";
import { kdvRaporuGetir } from "@/lib/rapor";

export const metadata: Metadata = { title: "KDV Raporu · Muhasebe" };

export default async function KdvRaporuPage({
  searchParams,
}: {
  searchParams: Promise<{ baslangic?: string; bitis?: string }>;
}) {
  const sp = await searchParams;
  const donem = donemCoz(sp);
  const rapor = await kdvRaporuGetir(donem);

  const csvUrl = `/api/rapor/kdv?baslangic=${donem.baslangicInput}&bitis=${donem.bitisInput}`;
  const odenecekVar = Number(rapor.odenecekKdv) > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="KDV raporu" description={donem.etiket} />
      <DonemSecici action="/raporlar/kdv" donem={donem} csvUrl={csvUrl} />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card data-print="kart">
          <CardLabel>Hesaplanan KDV</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={rapor.hesaplananKdv} />
          </p>
          <p className="mt-1 text-body-sm text-muted">Satışlardan</p>
        </Card>
        <Card data-print="kart">
          <CardLabel>İndirilecek KDV</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={rapor.indirilecekKdv} />
          </p>
          <p className="mt-1 text-body-sm text-muted">Alışlar + giderler</p>
        </Card>
        <Card data-print="kart">
          <CardLabel>{odenecekVar ? "Ödenecek KDV" : "Devreden KDV"}</CardLabel>
          <p className="mt-2 text-display-lg">
            <Amount
              value={odenecekVar ? rapor.odenecekKdv : rapor.devredenKdv}
              tone={odenecekVar ? "negative" : "neutral"}
            />
          </p>
          <p className="mt-1 text-body-sm text-muted">
            {odenecekVar
              ? "Bu dönem ödenecek"
              : "Sonraki döneme devreder"}
          </p>
        </Card>
      </div>

      <LedgerTable>
        <LedgerHead>
          <tr>
            <LedgerHeadCell>Kaynak</LedgerHeadCell>
            <LedgerHeadCell numeric>Kayıt</LedgerHeadCell>
            <LedgerHeadCell numeric>Matrah</LedgerHeadCell>
            <LedgerHeadCell numeric>KDV</LedgerHeadCell>
          </tr>
        </LedgerHead>
        <LedgerBody>
          <LedgerRow>
            <LedgerCell>Satışlar (hesaplanan)</LedgerCell>
            <LedgerCell numeric className="text-muted">
              <span data-numeric="">{rapor.satisSayisi}</span>
            </LedgerCell>
            <LedgerCell numeric className="text-muted">
              <Amount value={rapor.satisMatrah} />
            </LedgerCell>
            <LedgerCell numeric>
              <Amount value={rapor.hesaplananKdv} />
            </LedgerCell>
          </LedgerRow>
          <LedgerRow>
            <LedgerCell>Alışlar (indirilecek)</LedgerCell>
            <LedgerCell numeric className="text-muted">
              <span data-numeric="">{rapor.alisSayisi}</span>
            </LedgerCell>
            <LedgerCell numeric className="text-muted">
              <Amount value={rapor.alisMatrah} />
            </LedgerCell>
            <LedgerCell numeric>
              <Amount value={rapor.alisKdvToplami} />
            </LedgerCell>
          </LedgerRow>
          <LedgerRow>
            <LedgerCell>Giderler (indirilecek)</LedgerCell>
            <LedgerCell numeric className="text-muted">
              <span data-numeric="">{rapor.giderSayisi}</span>
            </LedgerCell>
            <LedgerCell numeric className="text-muted">
              <Amount value={rapor.giderMatrah} />
            </LedgerCell>
            <LedgerCell numeric>
              <Amount value={rapor.giderKdvToplami} />
            </LedgerCell>
          </LedgerRow>
        </LedgerBody>
      </LedgerTable>
    </div>
  );
}
