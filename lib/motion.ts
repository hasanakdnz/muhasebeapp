/**
 * DESIGN.md "Motion & Interaction" token'ları.
 *
 * Hareket süslemeyle değil anlamla sınırlı: bir şeyin değiştiğini, yüklendiğini
 * veya seçildiğini hissettirir. CSS tarafındaki karşılıkları app/globals.css
 * içindedir; buradaki değerler JS ile sürülen animasyonlar (dashboard sayma
 * animasyonu gibi) için tek kaynaktır.
 */

export const DURATION = {
  /** hover, basma, küçük durum değişiklikleri */
  fast: 120,
  /** panel açılma/kapanma, sekme geçişleri, badge durum değişimi */
  base: 200,
  /** dashboard rakamlarının sayarak değişmesi */
  slow: 500,
} as const;

export const EASING = {
  /** girişler */
  enter: "cubic-bezier(0, 0, 0.2, 1)",
  /** çıkışlar */
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/** DESIGN.md: bu tercih açıksa sayma animasyonu dahil tüm hareketler anında olur. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Sayma animasyonu için ilerleme eğrisi (ease-out). t: 0..1 → 0..1.
 * Zıplama/bounce yok — bu sistemin ciddiyetiyle çelişir.
 */
export function easeOutProgress(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

/**
 * Sayma animasyonunun tek bir karesinde gösterilecek değer.
 *
 * KRİTİK: süre dolduğunda hedef Decimal string'i OLDUĞU GİBİ döner. Ara kareler
 * float'tır (yalnızca çizim için), fakat kullanıcının okuduğu nihai tutar asla
 * float'tan geçmez — büyük tutarlarda hassasiyet kaybı yaşanmaz.
 */
export function sayimKaresi(hedefDeger: string, gecenSure: number): string {
  if (gecenSure >= DURATION.slow) return hedefDeger;
  const hedef = Number(hedefDeger);
  if (!Number.isFinite(hedef)) return hedefDeger;
  return String(hedef * easeOutProgress(gecenSure / DURATION.slow));
}
