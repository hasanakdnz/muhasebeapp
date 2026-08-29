import { Badge } from "@/components/ui/badge";
import {
  CEK_SENET_DURUM_ETIKETI,
  type CekSenetDurumuValue,
} from "@/lib/domain/cek-senet";

/**
 * DESIGN.md "Status Badges" — durum rozetleri.
 * Renk yalnızca anlam taşır: tahsil edilen yeşil, karşılıksız kırmızı,
 * portföydeki (bekleyen) amber, ciro edilmiş nötr.
 */
const DURUM_VARYANTI: Record<
  CekSenetDurumuValue,
  "positive" | "negative" | "pending" | "neutral"
> = {
  TAHSIL_EDILDI: "positive",
  KARSILIKSIZ: "negative",
  PORTFOYDE: "pending",
  CIRO_EDILDI: "neutral",
};

export function DurumBadge({ durum }: { durum: CekSenetDurumuValue }) {
  return (
    <Badge variant={DURUM_VARYANTI[durum]}>
      {CEK_SENET_DURUM_ETIKETI[durum]}
    </Badge>
  );
}
