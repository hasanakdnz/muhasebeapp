"use client";

import * as React from "react";
import { Amount } from "@/components/ui/amount";
import { DURATION, prefersReducedMotion, sayimKaresi } from "@/lib/motion";
import type { AmountTone } from "@/lib/money";

// SSR'da useLayoutEffect uyarı verir; tarayıcıda ise ilk boyamadan önce
// çalışması gerekir ki gerçek değer bir kare görünüp sonra sıfıra düşmesin.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/** Animasyon bitmese bile doğru tutara dönmek için tanınan süre. */
const GUVENLIK_PAYI = 250;

/**
 * DESIGN.md "Seçili anlar" — Dashboard rakamları:
 * Sayfa yüklendiğinde büyük özet rakamlar 0'dan hedefe sayarak değişir
 * (`slow`, 500ms, ease-out). Bu, ürünün canlı hissettiği tek an; abartılmaz,
 * yalnızca bu rakamlarda kullanılır.
 *
 * ## Doğruluk animasyondan önce gelir
 * `requestAnimationFrame` gizli sekmede hiç çalışmaz. Güvenlik ağı olmadan
 * rakam "0"da takılır ve kullanıcı YANLIŞ bir tutar görür — finansal bir
 * uygulamada kabul edilemez. Bu yüzden:
 *  - sayfa görünür değilse animasyon hiç başlatılmaz,
 *  - başlatılsa bile bir zamanlayıcı süre sonunda gerçek değeri yazar.
 *
 * `prefers-reduced-motion` açıksa da animasyon çalışmaz, değer anında görünür.
 */
export function SayanTutar({
  value,
  tone,
  className,
}: {
  /** Decimal'in kanonik string gösterimi. */
  value: string;
  tone?: AmountTone | "neutral";
  className?: string;
}) {
  // Sunucuda ve JS çalışmadığında gerçek değer görünür — animasyon bir
  // ilerletmedir, içeriğin ön koşulu değil.
  const [goruntulenen, setGoruntulenen] = React.useState(value);

  useIsoLayoutEffect(() => {
    const hedef = Number(value);
    const animasyonAnlamli =
      !prefersReducedMotion() &&
      !document.hidden &&
      Number.isFinite(hedef) &&
      hedef !== 0;

    if (!animasyonAnlamli) {
      setGoruntulenen(value);
      return;
    }

    let cerceve = 0;
    const baslangic = performance.now();
    setGoruntulenen("0");

    const adim = (simdi: number) => {
      const gecen = simdi - baslangic;
      // Kare değeri saf fonksiyondan gelir (lib/motion.ts) — süre dolduğunda
      // TAM Decimal string'i döner, nihai tutar float'tan geçmez.
      setGoruntulenen(sayimKaresi(value, gecen));
      if (gecen >= DURATION.slow) return;
      cerceve = requestAnimationFrame(adim);
    };
    cerceve = requestAnimationFrame(adim);

    // Güvenlik ağı: sekme animasyon sırasında gizlenir veya kare döngüsü
    // herhangi bir nedenle durursa tutar "0"da kalmaz.
    const guvenlik = window.setTimeout(() => {
      setGoruntulenen(value);
      cancelAnimationFrame(cerceve);
    }, DURATION.slow + GUVENLIK_PAYI);

    return () => {
      cancelAnimationFrame(cerceve);
      window.clearTimeout(guvenlik);
    };
  }, [value]);

  return <Amount value={goruntulenen} tone={tone} className={className} />;
}
