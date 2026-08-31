import type { Metadata } from "next";
import Link from "next/link";
import { Paperclip, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
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
import { GIDER_KATEGORILERI } from "@/lib/domain/gider";
import {
  hesaplaGiderOzeti,
  kategoriDagilimi,
  listeleGiderler,
} from "@/lib/gider";
import { formatYuzde } from "@/lib/money";

export const metadata: Metadata = { title: "Giderler · Muhasebe" };

export default async function GiderlerPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; hesapsiz?: string }>;
}) {
  const sp = await searchParams;
  const yalnizHesapsiz = sp.hesapsiz === "1";
  const kategori = GIDER_KATEGORILERI.includes(
    sp.kategori as (typeof GIDER_KATEGORILERI)[number]
  )
    ? sp.kategori
    : undefined;

  const [giderler, tumGiderler] = await Promise.all([
    listeleGiderler({ kategori }),
    // Kategori dağılımı her zaman TÜM giderler üzerinden gösterilir; filtre
    // yalnızca listeyi daraltır.
    listeleGiderler(),
  ]);

  // Hesaba işlenmemiş gider, parası kasadan çıkmamış giderdir; panodan
  // buraya bağlantı verilir (bkz. app/(dashboard)/dashboard/page.tsx).
  const gosterilen = yalnizHesapsiz
    ? giderler.filter((g) => g.hesapId === null)
    : giderler;

  const ozet = hesaplaGiderOzeti(gosterilen);
  const dagilim = kategoriDagilimi(tumGiderler);
  const hesapsizSayisi = tumGiderler.filter((g) => g.hesapId === null).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Giderler"
        description="Masraf kayıtları ve kategoriler."
        actions={
          <Link href="/giderler/yeni" className={buttonVariants()}>
            <Plus />
            Yeni gider
          </Link>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardLabel>Toplam gider</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.toplam} tone="negative" />
          </p>
          {kategori && (
            <p className="mt-1 text-body-sm text-muted">{kategori}</p>
          )}
        </Card>
        <Card>
          <CardLabel>KDV hariç</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.toplamMatrah} />
          </p>
        </Card>
        <Card>
          <CardLabel>İndirilecek KDV</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.toplamKdv} />
          </p>
        </Card>
      </div>

      {dagilim.length > 0 && (
        <Card className="flex flex-col gap-6">
          <CardTitle>Kategori dağılımı</CardTitle>
          <dl className="flex flex-col">
            {dagilim.map((d) => (
              <div
                key={d.kategori}
                className="flex items-baseline justify-between gap-6 border-b border-border py-3 last:border-b-0"
              >
                <dt className="text-body-md text-ink">
                  {d.kategori}
                  <span className="ml-2 text-body-sm text-muted">
                    {d.adet} kayıt
                  </span>
                </dt>
                <dd className="flex items-baseline gap-4">
                  <span className="text-body-sm text-muted" data-numeric="">
                    %{formatYuzde(d.yuzde)}
                  </span>
                  <Amount value={d.toplam} />
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/giderler"
          className={buttonVariants({
            variant: kategori || yalnizHesapsiz ? "text" : "secondary",
          })}
        >
          Tümü
        </Link>
        {hesapsizSayisi > 0 && (
          <Link
            href="/giderler?hesapsiz=1"
            className={buttonVariants({
              variant: yalnizHesapsiz ? "secondary" : "text",
            })}
          >
            Hesaba işlenmemiş ({hesapsizSayisi})
          </Link>
        )}
        {dagilim.map((d) => (
          <Link
            key={d.kategori}
            href={`/giderler?kategori=${encodeURIComponent(d.kategori)}`}
            className={buttonVariants({
              variant: kategori === d.kategori ? "secondary" : "text",
            })}
          >
            {d.kategori}
          </Link>
        ))}
      </div>

      {gosterilen.length === 0 ? (
        <EmptyState
          title={
            yalnizHesapsiz
              ? "Hesaba işlenmemiş gider yok"
              : kategori
                ? "Bu kategoride gider yok"
                : "Henüz gider yok"
          }
          description="İlk masraf kaydınızı oluşturun."
          action={
            <Link href="/giderler/yeni" className={buttonVariants()}>
              <Plus />
              Yeni gider
            </Link>
          }
        />
      ) : (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Tarih</LedgerHeadCell>
              <LedgerHeadCell>Kategori</LedgerHeadCell>
              <LedgerHeadCell>Açıklama</LedgerHeadCell>
              <LedgerHeadCell>Belge</LedgerHeadCell>
              <LedgerHeadCell numeric>Matrah</LedgerHeadCell>
              <LedgerHeadCell numeric>KDV</LedgerHeadCell>
              <LedgerHeadCell numeric>Toplam</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {gosterilen.map((gider) => (
              <LedgerRow key={gider.id}>
                <LedgerCell className="whitespace-nowrap text-muted">
                  <Link
                    href={`/giderler/${gider.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {formatTarih(gider.tarih)}
                  </Link>
                </LedgerCell>
                <LedgerCell>
                  <span className="flex flex-wrap items-center gap-2">
                    {gider.kategori}
                    {gider.hesapId === null && (
                      <Badge variant="pending">hesaba işlenmemiş</Badge>
                    )}
                  </span>
                </LedgerCell>
                <LedgerCell className="text-muted">
                  {gider.aciklama ?? "—"}
                </LedgerCell>
                <LedgerCell className="text-muted">
                  {gider.belgeUrl ? (
                    <Paperclip
                      className="size-4 stroke-[1.5]"
                      aria-label="Belge yüklü"
                    />
                  ) : (
                    "—"
                  )}
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={gider.matrah} />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={gider.kdvTutari} />
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount value={gider.tutar} tone="negative" />
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      )}
    </div>
  );
}
