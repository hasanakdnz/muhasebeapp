import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DurumBadge } from "@/components/cek-senet/durum-badge";
import { Amount } from "@/components/ui/amount";
import { buttonVariants } from "@/components/ui/button";
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
import { formatTarih } from "@/lib/date";
import { hesaplaPortfoyOzeti, listeleCekSenetler } from "@/lib/cek-senet";
import {
  CEK_SENET_TIP_ETIKETI,
  CEK_SENET_YONLERI,
  CEK_SENET_YON_ETIKETI,
  type CekSenetYonuValue,
} from "@/lib/domain/cek-senet";

export const metadata: Metadata = { title: "Çek & Senet · Muhasebe" };

export default async function CekSenetPage({
  searchParams,
}: {
  searchParams: Promise<{ yon?: string }>;
}) {
  const sp = await searchParams;
  const yon = CEK_SENET_YONLERI.includes(sp.yon as CekSenetYonuValue)
    ? (sp.yon as CekSenetYonuValue)
    : undefined;

  const kayitlar = await listeleCekSenetler({ yon });
  const ozet = hesaplaPortfoyOzeti(kayitlar);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Çek & Senet"
        description="Portföy ve tahsilat durumu."
        actions={
          <Link href="/cek-senet/yeni" className={buttonVariants()}>
            <Plus />
            Yeni kayıt
          </Link>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardLabel>Tahsil edilecek</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.tahsilEdilecek} tone="positive" />
          </p>
        </Card>
        <Card>
          <CardLabel>Ödenecek</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.odenecek} tone="negative" />
          </p>
        </Card>
        <Card>
          <CardLabel>Karşılıksız</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.karsiliksiz} tone="negative" />
          </p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/cek-senet"
          className={buttonVariants({ variant: yon ? "text" : "secondary" })}
        >
          Tümü
        </Link>
        {CEK_SENET_YONLERI.map((y) => (
          <Link
            key={y}
            href={`/cek-senet?yon=${y}`}
            className={buttonVariants({
              variant: yon === y ? "secondary" : "text",
            })}
          >
            {CEK_SENET_YON_ETIKETI[y]}
          </Link>
        ))}
      </div>

      {kayitlar.length === 0 ? (
        <EmptyState
          title={yon ? "Bu yönde kayıt yok" : "Henüz çek/senet yok"}
          description="İlk çek veya senet kaydınızı oluşturun."
          action={
            <Link href="/cek-senet/yeni" className={buttonVariants()}>
              <Plus />
              Yeni kayıt
            </Link>
          }
        />
      ) : (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Vade</LedgerHeadCell>
              <LedgerHeadCell>Tip</LedgerHeadCell>
              <LedgerHeadCell>Yön</LedgerHeadCell>
              <LedgerHeadCell>Cari</LedgerHeadCell>
              <LedgerHeadCell>Durum</LedgerHeadCell>
              <LedgerHeadCell numeric>Tutar</LedgerHeadCell>
              <LedgerHeadCell numeric>Tahsil edilen</LedgerHeadCell>
              <LedgerHeadCell numeric>Kalan</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {kayitlar.map((kayit) => (
              <LedgerRow key={kayit.id}>
                <LedgerCell className="whitespace-nowrap text-muted">
                  <Link
                    href={`/cek-senet/${kayit.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {formatTarih(kayit.vadeTarihi)}
                  </Link>
                </LedgerCell>
                <LedgerCell className="text-muted">
                  {CEK_SENET_TIP_ETIKETI[kayit.tip]}
                </LedgerCell>
                <LedgerCell className="text-muted">
                  {CEK_SENET_YON_ETIKETI[kayit.yon]}
                </LedgerCell>
                <LedgerCell>
                  {kayit.cariUnvan}
                  {kayit.ciroEdilenCariUnvan && (
                    <span className="block text-body-sm text-muted">
                      → {kayit.ciroEdilenCariUnvan}
                    </span>
                  )}
                </LedgerCell>
                <LedgerCell>
                  <DurumBadge durum={kayit.durum} />
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount value={kayit.tutar} />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={kayit.tahsilEdilen} />
                </LedgerCell>
                <LedgerCell numeric>
                  {/* Kalan yalnızca PORTFOYDE kayıtlarda renklidir: ciro
                      edilmiş veya karşılıksız bir kayıtta kalan tutar artık
                      beklenen bir tahsilat/ödeme değildir, renk anlam taşımaz. */}
                  <Amount
                    value={kayit.kalan}
                    tone={
                      kayit.durum !== "PORTFOYDE"
                        ? "neutral"
                        : kayit.yon === "ALINAN"
                          ? "positive"
                          : "negative"
                    }
                  />
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      )}
    </div>
  );
}
