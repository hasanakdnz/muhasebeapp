"use client";

import dynamic from "next/dynamic";
import type { AylikNakitAkisi } from "@/lib/dashboard";

/**
 * Grafik GEÇ yüklenir.
 *
 * Recharts tek başına pano paketinin 114 kB'ını oluşturuyordu (diğer sayfalar
 * ~1 kB). Pano giriş sonrası açılan ilk sayfa; kullanıcının önce görmek
 * istediği şey kasa/alacak rakamları, grafik değil. `ssr: false` + dinamik
 * import ile grafik kodu ilk yüklemeden çıkar ve rakamlar beklemeden gelir.
 *
 * Yer tutucu grafikle AYNI yüksekliktedir: yüklenince sayfa zıplamaz.
 * DESIGN.md "Yükleme durumları": spinner değil, içeriğin taslak hâli.
 */
const NakitAkisiGrafik = dynamic(
  () => import("./nakit-akisi").then((m) => m.NakitAkisi),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-64 w-full animate-pulse rounded-app bg-surface-muted motion-reduce:animate-none"
        aria-hidden
      />
    ),
  }
);

export function NakitAkisiYukleyici({
  veriler,
}: {
  veriler: AylikNakitAkisi[];
}) {
  return <NakitAkisiGrafik veriler={veriler} />;
}
