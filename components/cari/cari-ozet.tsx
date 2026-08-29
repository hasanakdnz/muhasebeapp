import { Amount } from "@/components/ui/amount";
import { Card, CardLabel } from "@/components/ui/card";
import type { CariOzet } from "@/lib/domain/cari";

/** Az öğe, bol boşluk, kart içi yoğunluk düşük (DESIGN.md Layout). */
export function CariOzetKartlari({ ozet }: { ozet: CariOzet }) {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <Card>
        <CardLabel>Toplam alacak</CardLabel>
        <p className="mt-2 text-display-md">
          <Amount value={ozet.toplamAlacak} tone="positive" />
        </p>
      </Card>
      <Card>
        <CardLabel>Toplam borç</CardLabel>
        <p className="mt-2 text-display-md">
          <Amount value={ozet.toplamBorc} tone="negative" />
        </p>
      </Card>
      <Card>
        <CardLabel>Net</CardLabel>
        <p className="mt-2 text-display-md">
          <Amount value={ozet.net} colored />
        </p>
      </Card>
    </div>
  );
}
