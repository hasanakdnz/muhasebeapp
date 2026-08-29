import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DonemSecici } from "@/components/rapor/donem-secici";
import { Amount } from "@/components/ui/amount";
import { Card, CardLabel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import { donemCoz } from "@/lib/donem";
import { formatYuzde } from "@/lib/money";
import { satisPerformansiGetir } from "@/lib/rapor";

export const metadata: Metadata = { title: "Satış Performansı · Muhasebe" };

export default async function SatisPerformansiPage({
  searchParams,
}: {
  searchParams: Promise<{ baslangic?: string; bitis?: string }>;
}) {
  const sp = await searchParams;
  const donem = donemCoz(sp);
  const rapor = await satisPerformansiGetir(donem);

  const csvUrl = `/api/rapor/satis?baslangic=${donem.baslangicInput}&bitis=${donem.bitisInput}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Satış performansı" description={donem.etiket} />
      <DonemSecici action="/raporlar/satis" donem={donem} csvUrl={csvUrl} />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card data-print="kart">
          <CardLabel>Satış</CardLabel>
          <p className="mt-2 text-display-lg">
            <Amount value={rapor.satisToplami} tone="positive" />
          </p>
          <p className="mt-1 text-body-sm text-muted">
            {rapor.satisSayisi} işlem
          </p>
        </Card>
        <Card data-print="kart">
          <CardLabel>Alış</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={rapor.alisToplami} tone="negative" />
          </p>
        </Card>
        <Card data-print="kart">
          <CardLabel>Net</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={rapor.net} colored />
          </p>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-heading-md text-ink">Aylık kırılım</h2>
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Ay</LedgerHeadCell>
              <LedgerHeadCell numeric>Satış</LedgerHeadCell>
              <LedgerHeadCell numeric>Alış</LedgerHeadCell>
              <LedgerHeadCell numeric>Net</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {rapor.aylik.map((a) => (
              <LedgerRow key={a.ay}>
                <LedgerCell className="text-muted">{a.etiket}</LedgerCell>
                <LedgerCell numeric>
                  <Amount value={a.satis} />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={a.alis} />
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount
                    value={String(Number(a.satis) - Number(a.alis))}
                    colored
                  />
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-heading-md text-ink">
          En çok satış yapılan cariler
        </h2>
        {rapor.enIyiCariler.length === 0 ? (
          <EmptyState
            title="Bu dönemde satış yok"
            description="Farklı bir tarih aralığı seçin."
          />
        ) : (
          <LedgerTable>
            <LedgerHead>
              <tr>
                <LedgerHeadCell>Cari</LedgerHeadCell>
                <LedgerHeadCell numeric>İşlem</LedgerHeadCell>
                <LedgerHeadCell numeric>Pay</LedgerHeadCell>
                <LedgerHeadCell numeric>Tutar</LedgerHeadCell>
              </tr>
            </LedgerHead>
            <LedgerBody>
              {rapor.enIyiCariler.map((c) => (
                <LedgerRow key={c.cariId}>
                  <LedgerCell>
                    <Link
                      href={`/cariler/${c.cariId}`}
                      className="after:absolute after:inset-0"
                    >
                      {c.cariUnvan}
                    </Link>
                  </LedgerCell>
                  <LedgerCell numeric className="text-muted">
                    <span data-numeric="">{c.adet}</span>
                  </LedgerCell>
                  <LedgerCell numeric className="text-muted">
                    <span data-numeric="">%{formatYuzde(c.yuzde)}</span>
                  </LedgerCell>
                  <LedgerCell numeric>
                    <Amount value={c.toplam} />
                  </LedgerCell>
                </LedgerRow>
              ))}
            </LedgerBody>
          </LedgerTable>
        )}
      </div>
    </div>
  );
}
