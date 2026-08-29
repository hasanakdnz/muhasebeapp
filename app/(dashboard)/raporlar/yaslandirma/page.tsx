import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { YazdirButonu } from "@/components/rapor/yazdir-butonu";
import { Amount } from "@/components/ui/amount";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import {
  ISLEM_TIPLERI,
  type IslemTipiValue,
} from "@/lib/domain/islem";
import {
  YASLANDIRMA_ETIKETI,
  YASLANDIRMA_KOVALARI,
  yaslandirmaRaporuGetir,
} from "@/lib/rapor";
import { formatTarih } from "@/lib/date";

export const metadata: Metadata = { title: "Yaşlandırma Raporu · Muhasebe" };

const TIP_BASLIGI: Record<IslemTipiValue, string> = {
  SATIS: "Alacak yaşlandırması",
  ALIS: "Borç yaşlandırması",
};

export default async function YaslandirmaPage({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string }>;
}) {
  const sp = await searchParams;
  const tip = ISLEM_TIPLERI.includes(sp.tip as IslemTipiValue)
    ? (sp.tip as IslemTipiValue)
    : "SATIS";

  const bugun = new Date();
  const rapor = await yaslandirmaRaporuGetir(tip, bugun);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={TIP_BASLIGI[tip]}
        description={`${formatTarih(bugun)} tarihine göre açık faturalar`}
      />

      <div
        data-print="gizle"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2">
          {ISLEM_TIPLERI.map((t) => (
            <Link
              key={t}
              href={`/raporlar/yaslandirma?tip=${t}`}
              className={buttonVariants({
                variant: tip === t ? "secondary" : "text",
              })}
            >
              {TIP_BASLIGI[t]}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/api/rapor/yaslandirma?tip=${tip}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <Download />
            Excel (CSV)
          </Link>
          <YazdirButonu />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {YASLANDIRMA_KOVALARI.map((kova) => (
          <Card key={kova} data-print="kart">
            <CardLabel>{YASLANDIRMA_ETIKETI[kova]}</CardLabel>
            <p className="mt-2 text-display-md">
              {/* Yalnızca gerçekten gecikmiş kovalar kırmızı; vadesi gelmemiş
                  tutar bir sorun değildir, renk anlam taşımaz. */}
              <Amount
                value={rapor.kovaToplamlari[kova]}
                tone={kova === "vadesi-gelmemis" ? "neutral" : "negative"}
              />
            </p>
          </Card>
        ))}
      </div>

      {rapor.satirlar.length === 0 ? (
        <EmptyState
          title="Açık fatura yok"
          description={
            tip === "SATIS"
              ? "Tahsil edilmemiş satış faturanız bulunmuyor."
              : "Ödenmemiş alış faturanız bulunmuyor."
          }
        />
      ) : (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Cari</LedgerHeadCell>
              {YASLANDIRMA_KOVALARI.map((k) => (
                <LedgerHeadCell key={k} numeric>
                  {YASLANDIRMA_ETIKETI[k]}
                </LedgerHeadCell>
              ))}
              <LedgerHeadCell numeric>Toplam</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {rapor.satirlar.map((satir) => (
              <LedgerRow key={satir.cariId}>
                <LedgerCell>
                  <Link
                    href={`/cariler/${satir.cariId}`}
                    className="after:absolute after:inset-0"
                  >
                    {satir.cariUnvan}
                  </Link>
                </LedgerCell>
                {YASLANDIRMA_KOVALARI.map((k) => (
                  <LedgerCell key={k} numeric className="text-muted">
                    {Number(satir.kovalar[k]) === 0 ? (
                      "—"
                    ) : (
                      <Amount value={satir.kovalar[k]} />
                    )}
                  </LedgerCell>
                ))}
                <LedgerCell numeric>
                  <Amount value={satir.toplam} />
                </LedgerCell>
              </LedgerRow>
            ))}
            <LedgerRow className="font-medium">
              <LedgerCell>Genel toplam</LedgerCell>
              {YASLANDIRMA_KOVALARI.map((k) => (
                <LedgerCell key={k} numeric>
                  <Amount value={rapor.kovaToplamlari[k]} />
                </LedgerCell>
              ))}
              <LedgerCell numeric>
                <Amount value={rapor.genelToplam} />
              </LedgerCell>
            </LedgerRow>
          </LedgerBody>
        </LedgerTable>
      )}
    </div>
  );
}
