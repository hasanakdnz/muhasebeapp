import { Badge } from "@/components/ui/badge";
import {
  vadeMetni,
  vadeDurumu,
  vadeRozetVaryanti,
  VARSAYILAN_YAKLASMA_ESIGI,
} from "@/lib/domain/vade";

/**
 * DESIGN.md Faz 6 rozetleri: vadesi geçen `red`, yaklaşan/bugün `amber`.
 * Uzak vadede rozet hiç gösterilmez — renk yalnızca anlam taşıdığında çıkar,
 * her satıra nötr bir rozet koymak gürültü olurdu.
 */
export function VadeBadge({
  vadeTarihi,
  bugun,
  esik = VARSAYILAN_YAKLASMA_ESIGI,
  normaldeGoster = false,
}: {
  vadeTarihi: Date | string;
  bugun: Date | string;
  esik?: number;
  normaldeGoster?: boolean;
}) {
  const durum = vadeDurumu(vadeTarihi, bugun, esik);
  if (durum === "normal" && !normaldeGoster) return null;

  return (
    <Badge variant={vadeRozetVaryanti(durum)}>
      {vadeMetni(vadeTarihi, bugun, esik)}
    </Badge>
  );
}
