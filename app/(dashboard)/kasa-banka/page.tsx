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
import { hesaplaHesapOzeti, listeleHesaplar } from "@/lib/kasa";
import { HESAP_TIP_ETIKETI } from "@/lib/validations/kasa";

export const metadata: Metadata = { title: "Kasa & Banka · Muhasebe" };

export default async function KasaBankaPage({
  searchParams,
}: {
  searchParams: Promise<{ pasif?: string }>;
}) {
  const sp = await searchParams;
  const pasifleriGoster = sp.pasif === "1";

  const hesaplar = await listeleHesaplar({ pasifleriGoster });
  const ozet = hesaplaHesapOzeti(hesaplar);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Kasa & Banka"
        description="Hesap tanımları ve bakiyeler."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href={pasifleriGoster ? "/kasa-banka" : "/kasa-banka?pasif=1"}
              className={buttonVariants({ variant: "secondary" })}
            >
              {pasifleriGoster ? "Pasifleri gizle" : "Pasifleri göster"}
            </Link>
            <Link href="/kasa-banka/yeni" className={buttonVariants()}>
              <Plus />
              Yeni hesap
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardLabel>Kasa toplamı</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.kasaToplami} colored />
          </p>
        </Card>
        <Card>
          <CardLabel>Banka toplamı</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.bankaToplami} colored />
          </p>
        </Card>
        <Card>
          <CardLabel>Genel toplam</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.genelToplam} colored />
          </p>
        </Card>
      </div>

      {hesaplar.length === 0 ? (
        <EmptyState
          title="Henüz hesap yok"
          description="İlk kasa veya banka hesabınızı tanımlayın."
          action={
            <Link href="/kasa-banka/yeni" className={buttonVariants()}>
              <Plus />
              Yeni hesap
            </Link>
          }
        />
      ) : (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Hesap</LedgerHeadCell>
              <LedgerHeadCell>Tip</LedgerHeadCell>
              <LedgerHeadCell numeric>Hareket</LedgerHeadCell>
              <LedgerHeadCell numeric>Bakiye</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {hesaplar.map((hesap) => (
              <LedgerRow key={hesap.id}>
                <LedgerCell>
                  <span className="flex items-center gap-2">
                    <Link
                      href={`/kasa-banka/${hesap.id}`}
                      className="after:absolute after:inset-0"
                    >
                      {hesap.ad}
                    </Link>
                    {!hesap.aktif && <Badge variant="neutral">pasif</Badge>}
                  </span>
                </LedgerCell>
                <LedgerCell className="text-muted">
                  {HESAP_TIP_ETIKETI[hesap.tip]}
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <span data-numeric="">{hesap.hareketSayisi}</span>
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount value={hesap.bakiye} colored />
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      )}
    </div>
  );
}
