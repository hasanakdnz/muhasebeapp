/**
 * Türkçe arama normalizasyonu.
 *
 * SQLite'ın LIKE'ı yalnızca ASCII harflerde büyük/küçük ayrımını yok sayar;
 * "Işık" ile "ışık" eşleşmez. Ayrıca kullanıcılar çoğu zaman şapkasız/noktasız
 * yazar ("isik"). Bu yüzden aranabilir bir anahtar üretilip DB'de saklanır.
 */

const KATLAMA: Record<string, string> = {
  ı: "i",
  ş: "s",
  ğ: "g",
  ü: "u",
  ö: "o",
  ç: "c",
  â: "a",
  î: "i",
  û: "u",
};

export function aramaNormalize(deger: string): string {
  return deger
    .toLocaleLowerCase("tr") // İ→i, I→ı, Ş→ş ...
    .replace(/[ışğüöçâîû]/g, (ch) => KATLAMA[ch] ?? ch)
    .replace(/\s+/g, " ")
    .trim();
}
