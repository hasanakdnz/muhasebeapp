import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DonemSecici } from "@/components/rapor/donem-secici";
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
import { donemCoz } from "@/lib/donem";
import { HAREKET_YON_ETIKETI, hesaplaHareketOzeti } from "@/lib/domain/kasa";
import { getHesap, listeleHareketler, listeleHesaplar } from "@/lib/kasa";
import { HESAP_TIP_ETIKETI } from "@/lib/validations/kasa";

export const metadata: Metadata = { title: "Ekstre · Muhasebe" };

export default async function EkstrePage({
  searchParams,
}: {
  searchParams: Promise<{ hesap?: string; baslangic?: string; bitis?: string }>;
}) {
  const sp = await searchParams;
  const donem = donemCoz(sp);
  const hesaplar = await listeleHesaplar({ pasifleriGoster: true });

  if (hesaplar.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Kasa / Banka ekstresi" />
        <EmptyState
          title="Hesap tanımlı değil"
          description="Ekstre için önce bir kasa veya banka hesabı tanımlayın."
          action={
            <Link href="/kasa-banka/yeni" className={buttonVariants()}>
              Yeni hesap
            </Link>
          }
        />
      </div>
    );
  }

  const secilenId = hesaplar.some((h) => h.id === sp.hesap)
    ? sp.hesap!
    : hesaplar[0].id;
  const hesap = await getHesap(secilenId);
  const tumHareketler = await listeleHareketler(secilenId);

  // Dönem filtresi burada uygulanır. Yürüyen bakiye TÜM geçmişten hesaplandığı
  // için dönem başındaki devir bakiyesi de doğru çıkar.
  const donemHareketleri = tumHareketler.filter(
    (h) => h.tarih >= donem.baslangic && h.tarih <= donem.bitis
  );
  const ozet = hesaplaHareketOzeti(donemHareketleri.map((h) => h.tutar));

  // Ekstre eskiden yeniye okunur; listeleHareketler yeniden eskiye döndürür.
  const satirlar = [...donemHareketleri].reverse();
  const devir =
    satirlar.length > 0
      ? Number(satirlar[0].yurutulenBakiye) - Number(satirlar[0].tutar)
      : Number(hesap?.bakiye ?? 0);
  const kapanis =
    satirlar.length > 0
      ? satirlar[satirlar.length - 1].yurutulenBakiye
      : String(devir);

  const csvUrl = `/api/rapor/ekstre?hesap=${secilenId}&baslangic=${donem.baslangicInput}&bitis=${donem.bitisInput}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={hesap ? hesap.ad : "Ekstre"}
        description={`${hesap ? `${HESAP_TIP_ETIKETI[hesap.tip]} · ` : ""}${donem.etiket}`}
      />

      <div data-print="gizle" className="flex flex-wrap items-center gap-2">
        {hesaplar.map((h) => (
          <Link
            key={h.id}
            href={`/raporlar/ekstre?hesap=${h.id}&baslangic=${donem.baslangicInput}&bitis=${donem.bitisInput}`}
            className={buttonVariants({
              variant: h.id === secilenId ? "secondary" : "text",
            })}
          >
            {h.ad}
          </Link>
        ))}
      </div>

      <DonemSecici action="/raporlar/ekstre" donem={donem} csvUrl={csvUrl} />

      <div className="grid gap-6 sm:grid-cols-4">
        <Card data-print="kart">
          <CardLabel>Devir</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={String(devir)} />
          </p>
        </Card>
        <Card data-print="kart">
          <CardLabel>Dönem girişi</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.toplamGiris} tone="positive" />
          </p>
        </Card>
        <Card data-print="kart">
          <CardLabel>Dönem çıkışı</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={ozet.toplamCikis} tone="negative" />
          </p>
        </Card>
        <Card data-print="kart">
          <CardLabel>Kapanış</CardLabel>
          <p className="mt-2 text-display-lg">
            <Amount value={kapanis} colored />
          </p>
        </Card>
      </div>

      {satirlar.length === 0 ? (
        <EmptyState
          title="Bu dönemde hareket yok"
          description="Farklı bir tarih aralığı seçin."
        />
      ) : (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Tarih</LedgerHeadCell>
              <LedgerHeadCell>Açıklama</LedgerHeadCell>
              <LedgerHeadCell>Yön</LedgerHeadCell>
              <LedgerHeadCell numeric>Tutar</LedgerHeadCell>
              <LedgerHeadCell numeric>Bakiye</LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {satirlar.map((h) => (
              <LedgerRow key={h.id}>
                <LedgerCell className="whitespace-nowrap text-muted">
                  {formatTarih(h.tarih)}
                </LedgerCell>
                <LedgerCell>{h.aciklama ?? "—"}</LedgerCell>
                <LedgerCell className="text-muted">
                  {HAREKET_YON_ETIKETI[h.yon]}
                </LedgerCell>
                <LedgerCell numeric>
                  <Amount value={h.tutar} colored signed />
                </LedgerCell>
                <LedgerCell numeric className="text-muted">
                  <Amount value={h.yurutulenBakiye} />
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      )}
    </div>
  );
}
