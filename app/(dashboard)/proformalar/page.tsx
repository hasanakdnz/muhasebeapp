import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import {
  PROFORMA_DURUMLARI,
  PROFORMA_DURUM_ETIKETI,
  PROFORMA_DURUM_TONU,
  type ProformaDurumuValue,
} from "@/lib/domain/proforma";
import { listeleProformalar } from "@/lib/proforma";

export const metadata: Metadata = { title: "Teklifler · Muhasebe" };

export default async function ProformalarPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const sp = await searchParams;
  const durum = PROFORMA_DURUMLARI.includes(sp.durum as ProformaDurumuValue)
    ? (sp.durum as ProformaDurumuValue)
    : undefined;

  const proformalar = await listeleProformalar({ durum });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Teklifler"
        description="Proforma faturalar. Kabul edilene kadar muhasebeye işlenmez."
        actions={
          <Link href="/proformalar/yeni" className={buttonVariants()}>
            <Plus />
            Yeni teklif
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/proformalar"
          className={buttonVariants({ variant: durum ? "text" : "secondary" })}
        >
          Tümü
        </Link>
        {PROFORMA_DURUMLARI.map((d) => (
          <Link
            key={d}
            href={`/proformalar?durum=${d}`}
            className={buttonVariants({
              variant: durum === d ? "secondary" : "text",
            })}
          >
            {PROFORMA_DURUM_ETIKETI[d]}
          </Link>
        ))}
      </div>

      {proformalar.length === 0 ? (
        <EmptyState
          title={durum ? "Bu durumda teklif yok" : "Henüz teklif yok"}
          description="Müşterinize göndereceğiniz ilk proformayı oluşturun."
          action={
            <Link href="/proformalar/yeni" className={buttonVariants()}>
              <Plus />
              Yeni teklif
            </Link>
          }
        />
      ) : (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Teklif no</LedgerHeadCell>
              <LedgerHeadCell>Tarih</LedgerHeadCell>
              <LedgerHeadCell>Cari</LedgerHeadCell>
              <LedgerHeadCell>Durum</LedgerHeadCell>
              <LedgerHeadCell numeric>Matrah</LedgerHeadCell>
              <LedgerHeadCell numeric>KDV</LedgerHeadCell>
              <LedgerHeadCell numeric>Toplam</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {proformalar.map((p) => (
              <LedgerRow key={p.id}>
                <LedgerCell className="whitespace-nowrap">
                  <Link
                    href={`/proformalar/${p.id}`}
                    className="after:absolute after:inset-0"
                  >
                    <span data-numeric="">{p.no}</span>
                  </Link>
                </LedgerCell>
                <LedgerCell className="whitespace-nowrap text-muted">
                  {formatTarih(p.tarih)}
                </LedgerCell>
                <LedgerCell>{p.cariUnvan}</LedgerCell>
                <LedgerCell>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant={PROFORMA_DURUM_TONU[p.durum]}>
                      {PROFORMA_DURUM_ETIKETI[p.durum]}
                    </Badge>
                    {p.suresiDoldu && (
                      <Badge variant="negative">Süresi doldu</Badge>
                    )}
                  </span>
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={p.matrah} />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={p.kdvTutari} />
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount value={p.toplamTutar} />
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      )}
    </div>
  );
}
