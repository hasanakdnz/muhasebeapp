import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
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
import { ODEME_STATUS_ETIKETI } from "@/lib/domain/odeme";
import {
  ISLEM_TIPLERI,
  ISLEM_TIP_ETIKETI,
  type IslemTipiValue,
} from "@/lib/domain/islem";
import { hesaplaBakiye } from "@/lib/domain/kasa";
import { listeleIslemler } from "@/lib/islem";

export const metadata: Metadata = { title: "İşlemler · Muhasebe" };

export default async function IslemlerPage({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string }>;
}) {
  const sp = await searchParams;
  const tip = ISLEM_TIPLERI.includes(sp.tip as IslemTipiValue)
    ? (sp.tip as IslemTipiValue)
    : undefined;

  const islemler = await listeleIslemler({ tip });

  const satisToplami = hesaplaBakiye(
    islemler.filter((i) => i.tip === "SATIS").map((i) => i.toplamTutar)
  );
  const alisToplami = hesaplaBakiye(
    islemler.filter((i) => i.tip === "ALIS").map((i) => i.toplamTutar)
  );
  const kdvToplami = hesaplaBakiye(islemler.map((i) => i.kdvTutari));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="İşlemler"
        description="Satış ve alış kayıtları."
        actions={
          <Link href="/islemler/yeni" className={buttonVariants()}>
            <Plus />
            Yeni işlem
          </Link>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardLabel>Satış toplamı</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={satisToplami} tone="positive" />
          </p>
        </Card>
        <Card>
          <CardLabel>Alış toplamı</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={alisToplami} tone="negative" />
          </p>
        </Card>
        <Card>
          <CardLabel>Toplam KDV</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={kdvToplami} />
          </p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/islemler"
          className={buttonVariants({ variant: tip ? "text" : "secondary" })}
        >
          Tümü
        </Link>
        {ISLEM_TIPLERI.map((t) => (
          <Link
            key={t}
            href={`/islemler?tip=${t}`}
            className={buttonVariants({
              variant: tip === t ? "secondary" : "text",
            })}
          >
            {ISLEM_TIP_ETIKETI[t]}
          </Link>
        ))}
      </div>

      {islemler.length === 0 ? (
        <EmptyState
          title={tip ? "Bu tipte işlem yok" : "Henüz işlem yok"}
          description="İlk satış veya alış kaydınızı oluşturun."
          action={
            <Link href="/islemler/yeni" className={buttonVariants()}>
              <Plus />
              Yeni işlem
            </Link>
          }
        />
      ) : (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Belge no</LedgerHeadCell>
              <LedgerHeadCell>Tarih</LedgerHeadCell>
              <LedgerHeadCell>Tip</LedgerHeadCell>
              <LedgerHeadCell>Cari</LedgerHeadCell>
              <LedgerHeadCell>Vade</LedgerHeadCell>
              <LedgerHeadCell>Durum</LedgerHeadCell>
              <LedgerHeadCell numeric>Toplam</LedgerHeadCell>
              <LedgerHeadCell numeric>Ödenen</LedgerHeadCell>
              <LedgerHeadCell numeric>Kalan</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {islemler.map((islem) => (
              <LedgerRow key={islem.id}>
                <LedgerCell className="whitespace-nowrap">
                  <Link
                    href={`/islemler/${islem.id}`}
                    className="after:absolute after:inset-0"
                  >
                    <span data-numeric="">{islem.no}</span>
                  </Link>
                </LedgerCell>
                <LedgerCell className="whitespace-nowrap text-muted">
                  <Link
                    href={`/islemler/${islem.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {formatTarih(islem.tarih)}
                  </Link>
                </LedgerCell>
                <LedgerCell>
                  <Badge variant="neutral">
                    {ISLEM_TIP_ETIKETI[islem.tip]}
                  </Badge>
                </LedgerCell>
                <LedgerCell>{islem.cariUnvan}</LedgerCell>
                <LedgerCell className="whitespace-nowrap text-muted">
                  {islem.vadeTarihi ? formatTarih(islem.vadeTarihi) : "—"}
                </LedgerCell>
                <LedgerCell>
                  <Badge
                    variant={
                      islem.status === "ODENDI"
                        ? "positive"
                        : islem.status === "IPTAL"
                          ? "neutral"
                          : "pending"
                    }
                  >
                    {ODEME_STATUS_ETIKETI[islem.status]}
                  </Badge>
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount
                    value={islem.toplamTutar}
                    tone={islem.tip === "SATIS" ? "positive" : "negative"}
                  />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={islem.odenenTutar} />
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount
                    value={islem.kalanTutar}
                    tone={Number(islem.kalanTutar) === 0 ? "neutral" : "negative"}
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
