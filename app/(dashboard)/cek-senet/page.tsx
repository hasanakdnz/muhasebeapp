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
import { VadeBadge } from "@/components/ui/vade-badge";
import { formatTarih } from "@/lib/date";
import { hesaplaPortfoyOzeti, listeleCekSenetler } from "@/lib/cek-senet";
import {
  CEK_SENET_TIP_ETIKETI,
  CEK_SENET_YONLERI,
  CEK_SENET_YON_ETIKETI,
  type CekSenetYonuValue,
} from "@/lib/domain/cek-senet";
import { vadeDurumu } from "@/lib/domain/vade";

export const metadata: Metadata = { title: "Çek & Senet · Muhasebe" };

const VADE_FILTRELERI = {
  gecen: "Vadesi geçen",
  yaklasan: "Vadesi yaklaşan",
} as const;
type VadeFiltresi = keyof typeof VADE_FILTRELERI;

export default async function CekSenetPage({
  searchParams,
}: {
  searchParams: Promise<{ yon?: string; vade?: string }>;
}) {
  const sp = await searchParams;
  const yon = CEK_SENET_YONLERI.includes(sp.yon as CekSenetYonuValue)
    ? (sp.yon as CekSenetYonuValue)
    : undefined;
  const vade =
    sp.vade === "gecen" || sp.vade === "yaklasan"
      ? (sp.vade as VadeFiltresi)
      : undefined;

  // "Bugün" sunucuda üretilir; istemcide üretilseydi saat dilimi farkı
  // rozetleri kaydırabilirdi.
  const bugun = new Date();

  const tumu = await listeleCekSenetler({ yon });
  const ozet = hesaplaPortfoyOzeti(tumu);

  // Vade filtresi yalnızca portföydeki kayıtlara uygulanır: tahsil edilmiş,
  // ciro edilmiş veya karşılıksız kaydın vadesi artık beklenen bir olay değil.
  const kayitlar = vade
    ? tumu.filter((k) => {
        if (k.durum !== "PORTFOYDE") return false;
        const d = vadeDurumu(k.vadeTarihi, bugun);
        return vade === "gecen" ? d === "gecti" : d === "bugun" || d === "yaklasiyor";
      })
    : tumu;

  function baglanti(yeni: { yon?: string; vade?: string }) {
    const p = new URLSearchParams();
    const y = yeni.yon ?? yon;
    const v = yeni.vade ?? vade;
    if (y) p.set("yon", y);
    if (v) p.set("vade", v);
    const qs = p.toString();
    return qs ? `/cek-senet?${qs}` : "/cek-senet";
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Çek & Senet"
        description="Portföy, vade ve tahsilat durumu."
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

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={baglanti({ yon: "", vade: vade ?? "" })}
          className={buttonVariants({ variant: yon ? "text" : "secondary" })}
        >
          Tümü
        </Link>
        {CEK_SENET_YONLERI.map((y) => (
          <Link
            key={y}
            href={baglanti({ yon: y })}
            className={buttonVariants({
              variant: yon === y ? "secondary" : "text",
            })}
          >
            {CEK_SENET_YON_ETIKETI[y]}
          </Link>
        ))}

        <span aria-hidden className="mx-2 h-6 w-px bg-border" />

        {(Object.keys(VADE_FILTRELERI) as VadeFiltresi[]).map((v) => (
          <Link
            key={v}
            href={baglanti({ vade: vade === v ? "" : v })}
            className={buttonVariants({
              variant: vade === v ? "secondary" : "text",
            })}
          >
            {VADE_FILTRELERI[v]}
          </Link>
        ))}
      </div>

      {kayitlar.length === 0 ? (
        <EmptyState
          title={
            vade
              ? `${VADE_FILTRELERI[vade]} kayıt yok`
              : yon
                ? "Bu yönde kayıt yok"
                : "Henüz çek/senet yok"
          }
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
                  <span className="flex items-center gap-2">
                    <Link
                      href={`/cek-senet/${kayit.id}`}
                      className="after:absolute after:inset-0"
                    >
                      {formatTarih(kayit.vadeTarihi)}
                    </Link>
                    {/* Vade rozeti yalnızca portföydeki kayıtlarda anlamlı. */}
                    {kayit.durum === "PORTFOYDE" && (
                      <VadeBadge vadeTarihi={kayit.vadeTarihi} bugun={bugun} />
                    )}
                  </span>
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
