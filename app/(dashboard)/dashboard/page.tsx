import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NakitAkisi } from "@/components/dashboard/nakit-akisi";
import { SayanTutar } from "@/components/dashboard/sayan-tutar";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { aylikNakitAkisi, dashboardOzeti } from "@/lib/dashboard";
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
  const [ozet, nakitAkisi] = await Promise.all([
    dashboardOzeti(bugun),
    aylikNakitAkisi(bugun),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Genel Bakış"
        description="Kasa, banka, alacak ve borç özetiniz."
      />

      {/* Kart içi yoğunluk düşük, aralar bol — DESIGN.md Layout. */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        <OzetKarti
          etiket="Satış"
          deger={ozet.satis}
          tone="positive"
          aciklama={ozet.donemEtiketi}
        />
        <OzetKarti
          etiket="Alış"
          deger={ozet.alis}
          tone="negative"
          aciklama={ozet.donemEtiketi}
        />
      </div>

      <Card className="flex flex-col gap-6">
        <CardTitle>Nakit akışı</CardTitle>
        <NakitAkisi veriler={nakitAkisi} />
      </Card>
    </div>
  );
}
