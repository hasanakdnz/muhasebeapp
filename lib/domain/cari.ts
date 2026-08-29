import { roundMoney, toDecimal, type DecimalLike } from "@/lib/money";

/**
 * Cari hesap saf iş mantığı.
 *
 * Bu modül BİLEREK Prisma'ya bağımlı değildir: finansal hesaplar veritabanı
 * olmadan, doğrudan birim testle doğrulanabilmelidir (CLAUDE.md).
 */

export type CariOzet = {
  /** Bize borçlu olanların toplamı (pozitif bakiyeler). */
  toplamAlacak: string;
  /** Bizim borçlu olduklarımızın toplamı (negatif bakiyelerin mutlak değeri). */
  toplamBorc: string;
  /** alacak - borç */
  net: string;
  acikHesapSayisi: number;
};

/**
 * Cari bakiyelerinden özet çıkarır. Tamamen Decimal ile çalışır, hiçbir
 * aşamada float'a düşmez.
 *
 * Bakiye işareti (ROADMAP şeması): pozitif = alacak, negatif = borç.
 * Kuruş altında kalan bakiyeler kapalı hesap sayılır.
 */
export function hesaplaCariOzeti(bakiyeler: DecimalLike[]): CariOzet {
  let alacak = toDecimal(0);
  let borc = toDecimal(0);
  let acik = 0;

  for (const ham of bakiyeler) {
    const bakiye = roundMoney(ham);
    if (bakiye.isZero()) continue;
    acik += 1;
    if (bakiye.isPositive()) {
      alacak = alacak.plus(bakiye);
    } else {
      borc = borc.plus(bakiye.abs());
    }
  }

  return {
    toplamAlacak: alacak.toString(),
    toplamBorc: borc.toString(),
    net: alacak.minus(borc).toString(),
    acikHesapSayisi: acik,
  };
}
