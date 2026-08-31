import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { NakitAkisiYukleyici } from "@/components/dashboard/nakit-akisi-yukleyici";
import { SayanTutar } from "@/components/dashboard/sayan-tutar";
import { Amount } from "@/components/ui/amount";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { aylikNakitAkisi, dashboardOzeti } from "@/lib/dashboard";
import { vadePanosu } from "@/lib/vade";
import type { AmountTone } from "@/lib/money";

export const metadata: Metadata = { title: "Genel Bakış · Muhasebe" };

function OzetKarti({
  etiket,
  deger,
  tone,
  aciklama,
}: {
  etiket: string;
  deger: string;
  tone?: AmountTone | "neutral";
  aciklama?: string;
}) {
  return (
    <Card>
      <CardLabel>{etiket}</CardLabel>
      {/* DESIGN.md: özet rakamlar display-lg + data-numeric, sayarak belirir. */}
      <p className="mt-2 text-display-lg">
        <SayanTutar value={deger} tone={tone} />
      </p>
      {aciklama && <p className="mt-1 text-body-sm text-muted">{aciklama}</p>}
    </Card>
  );
}

export default async function DashboardPage() {
  const bugun = new Date();
  const [ozet, nakitAkisi, vade] = await Promise.all([
    dashboardOzeti(bugun),
    aylikNakitAkisi(bugun),
    vadePanosu(bugun),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Genel Bakış"
        description="Durumunuz ve bu ayki hareketleriniz."
      />

      {/*
        Kartlar ANLAMINA göre iki bloğa ayrılır: "Durum" birikmiş bir andır
        (şu an ne kadar param var, kim bana ne kadar borçlu), "Bu ay" ise bir
        akıştır. Tek yığın hâlinde altı kart, farklı türden iki rakamı aynı
        şeymiş gibi gösteriyordu. DESIGN.md: bir ekranda 3-4 net blok.
      */}
      <section className="flex flex-col gap-4">
        <h2 className="text-heading-md text-ink">Durum</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <OzetKarti etiket="Kasa" deger={ozet.kasa} tone="positive" />
          <OzetKarti etiket="Banka" deger={ozet.banka} tone="positive" />
          <OzetKarti
            etiket="Alacak"
            deger={ozet.alacak}
            tone="positive"
            aciklama="Carilerin size borcu"
          />
          <OzetKarti
            etiket="Borç"
            deger={ozet.borc}
            tone="negative"
            aciklama="Carilere borcunuz"
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-heading-md text-ink">{ozet.donemEtiketi}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <OzetKarti etiket="Satış" deger={ozet.satis} tone="positive" />
          <OzetKarti etiket="Alış" deger={ozet.alis} tone="negative" />
          <OzetKarti
            etiket="Gider"
            deger={ozet.gider}
            tone="negative"
            aciklama="Masraf kayıtları"
          />
        </div>

        {/*
          Uyarı yalnızca gerçekten eksik bir şey varsa görünür. Gider
          kaydedilirken hesap seçilmemişse para kasadan çıkmamıştır: kullanıcı
          harcamayı yapmıştır ama Kasa rakamı eski hâlinde kalır ve bunu fark
          etmesinin başka bir yolu yoktur.
        */}
        {ozet.hesabaIslenmemisGider > 0 && (
          <p className="text-body-sm text-amber">
            {ozet.hesabaIslenmemisGider} gider kasa/banka hesabına işlenmemiş —
            bu tutarlar Kasa bakiyesine yansımıyor.{" "}
            <Link
              href="/giderler?hesapsiz=1"
              className="underline underline-offset-2"
            >
              Listele
            </Link>
          </p>
        )}
      </section>

      {/* Vade uyarısı yalnızca dikkat gerektiren bir şey varsa görünür —
          sürekli duran nötr bir kart göz ardı edilmeye başlanır. */}
      {(vade.gecen > 0 || vade.bugunVadeli > 0 || vade.yaklasan > 0) && (
        <Card className="flex flex-col gap-4">
          <CardTitle>Vade takibi</CardTitle>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <CardLabel>
                Vadesi geçen ({vade.gecen})
              </CardLabel>
              <p className="mt-2 text-display-md">
                <Amount value={vade.gecenTutar} tone="negative" />
              </p>
            </div>
            <div>
              <CardLabel>
                Yaklaşan ({vade.bugunVadeli + vade.yaklasan})
              </CardLabel>
              <p className="mt-2 text-display-md">
                <Amount value={vade.yaklasanTutar} />
              </p>
            </div>
          </div>
          <div>
            <Link
              href="/cek-senet?vade=gecen"
              className={buttonVariants({ variant: "secondary" })}
            >
              Vadesi geçenleri gör
            </Link>
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-6">
        <CardTitle>Nakit akışı</CardTitle>
        <NakitAkisiYukleyici veriler={nakitAkisi} />
      </Card>
    </div>
  );
}
