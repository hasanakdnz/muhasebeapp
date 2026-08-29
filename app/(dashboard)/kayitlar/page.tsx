import type { Metadata } from "next";
import Link from "next/link";
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
import {
  AUDIT_AKSIYONLARI,
  AUDIT_AKSIYON_ETIKETI,
  AUDIT_AKSIYON_TONU,
  detayParcalari,
  hedefEtiketi,
  listeleAuditLog,
  type AuditAksiyonu,
} from "@/lib/audit";
import { formatTarihSaat } from "@/lib/date";

export const metadata: Metadata = { title: "İşlem Kaydı · Muhasebe" };

/**
 * Denetim kaydı ekranı — yalnızca yönetici (lib/rbac.ts).
 *
 * Kaydedilenler: silmeler ve parasal sonucu olan işlemler. Sıradan okuma
 * kaydedilmez; her şeyi kaydeden bir log okunmaz olur.
 */
export default async function KayitlarPage({
  searchParams,
}: {
  searchParams: Promise<{ aksiyon?: string }>;
}) {
  const sp = await searchParams;
  const aksiyon = AUDIT_AKSIYONLARI.includes(sp.aksiyon as AuditAksiyonu)
    ? (sp.aksiyon as AuditAksiyonu)
    : undefined;

  const kayitlar = await listeleAuditLog({ aksiyon });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="İşlem kaydı"
        description="Silme ve para hareketlerinin kim tarafından, ne zaman yapıldığı."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/kayitlar"
          className={buttonVariants({ variant: aksiyon ? "text" : "secondary" })}
        >
          Tümü
        </Link>
        {AUDIT_AKSIYONLARI.map((a) => (
          <Link
            key={a}
            href={`/kayitlar?aksiyon=${a}`}
            className={buttonVariants({
              variant: aksiyon === a ? "secondary" : "text",
            })}
          >
            {AUDIT_AKSIYON_ETIKETI[a]}
          </Link>
        ))}
      </div>

      {kayitlar.length === 0 ? (
        <EmptyState
          title={aksiyon ? "Bu türde kayıt yok" : "Henüz kayıt yok"}
          description="Bir silme veya para hareketi yapıldığında burada görünür."
        />
      ) : (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Tarih</LedgerHeadCell>
              <LedgerHeadCell>Kullanıcı</LedgerHeadCell>
              <LedgerHeadCell>Aksiyon</LedgerHeadCell>
              <LedgerHeadCell>Kayıt</LedgerHeadCell>
              <LedgerHeadCell>Detay</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {kayitlar.map((k) => {
              const parcalar = detayParcalari(k.detay, k.hedefTip);
              return (
                <LedgerRow key={k.id}>
                  <LedgerCell className="whitespace-nowrap text-muted">
                    <span data-numeric="">{formatTarihSaat(k.tarih)}</span>
                  </LedgerCell>
                  <LedgerCell>
                    {k.kullaniciAdi}
                    <span className="ml-2 text-body-sm text-muted">
                      {k.kullaniciEposta}
                    </span>
                  </LedgerCell>
                  <LedgerCell>
                    <Badge
                      variant={AUDIT_AKSIYON_TONU[k.aksiyon]}
                      className="whitespace-nowrap"
                    >
                      {AUDIT_AKSIYON_ETIKETI[k.aksiyon]}
                    </Badge>
                  </LedgerCell>
                  <LedgerCell className="text-muted">
                    {hedefEtiketi(k.hedefTip)}
                  </LedgerCell>
                  <LedgerCell className="text-muted">
                    {parcalar.length === 0 ? (
                      "—"
                    ) : (
                      <span className="flex flex-wrap gap-x-4 gap-y-1">
                        {parcalar.map((p) => (
                          <span key={p.etiket} className="whitespace-nowrap">
                            <span className="text-body-sm">{p.etiket}: </span>
                            {p.tutarMi ? (
                              <Amount value={p.deger} />
                            ) : (
                              <span className="text-ink">{p.deger}</span>
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                  </LedgerCell>
                </LedgerRow>
              );
            })}
          </LedgerBody>
        </LedgerTable>
      )}
    </div>
  );
}
