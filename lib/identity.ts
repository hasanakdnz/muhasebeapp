/**
 * VKN / TCKN doğrulaması.
 *
 * TCKN için resmî sağlama algoritması uygulanır — deterministiktir, geçerli
 * her TCKN'yi geçirir. VKN'de yalnızca biçim (10 hane) kontrol edilir:
 * sağlama algoritması bazı eski/kurumsal numaralarda tutmayabiliyor ve
 * finansal bir uygulamada geçerli bir kaydı engellemek, geçersiz bir numarayı
 * kabul etmekten daha kötüdür.
 */

const ONLY_DIGITS = /^\d+$/;

export function isValidTckn(value: string): boolean {
  const v = value.trim();
  if (v.length !== 11 || !ONLY_DIGITS.test(v)) return false;

  const d = [...v].map(Number);
  if (d[0] === 0) return false;

  // 10. hane: (tek sıradakilerin toplamı * 7 - çift sıradakilerin toplamı) mod 10
  const sumOdd = d[0] + d[2] + d[4] + d[6] + d[8];
  const sumEven = d[1] + d[3] + d[5] + d[7];
  const digit10 = (sumOdd * 7 - sumEven) % 10;
  if (((digit10 % 10) + 10) % 10 !== d[9]) return false;

  // 11. hane: ilk 10 hanenin toplamı mod 10
  const sumFirstTen = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return sumFirstTen % 10 === d[10];
}

export function isValidVkn(value: string): boolean {
  const v = value.trim();
  return v.length === 10 && ONLY_DIGITS.test(v);
}

/** Cari kartındaki tek alan hem VKN hem TCKN kabul eder. */
export function isValidVknTckn(value: string): boolean {
  const v = value.trim();
  if (v.length === 10) return isValidVkn(v);
  if (v.length === 11) return isValidTckn(v);
  return false;
}

export function vknTcknTipi(value: string): "VKN" | "TCKN" | null {
  const v = value.trim();
  if (isValidVkn(v)) return "VKN";
  if (isValidTckn(v)) return "TCKN";
  return null;
}
