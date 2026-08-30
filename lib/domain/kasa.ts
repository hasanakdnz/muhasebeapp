import { roundMoney, toDecimal, type DecimalLike } from "@/lib/money";

/**
 * Kasa/Banka bakiye mantığı — saf, Prisma'sız, doğrudan test edilebilir.
 *
 * Saklama kuralı (ROADMAP şeması): HesapHareketi.tutar İŞARETLİ tutulur —
 * pozitif giriş, negatif çıkış. Kullanıcı arayüzde daima pozitif bir tutar +
 * yön girer; işaret bu modülde tek noktadan uygulanır.
 */

export const HAREKET_YONLERI = ["GIRIS", "CIKIS"] as const;
export type HareketYonu = (typeof HAREKET_YONLERI)[number];

export const HAREKET_YON_ETIKETI: Record<HareketYonu, string> = {
  GIRIS: "Giriş",
  CIKIS: "Çıkış",
};

/**
 * Kullanıcının girdiği pozitif tutarı yöne göre işaretler.
 * Girdi negatifse mutlak değeri alınır — yön tek doğruluk kaynağıdır,
 * böylece "çıkış" seçip eksi yazmak çift olumsuzluk yaratamaz.
 */
export function isaretliTutar(yon: HareketYonu, tutar: DecimalLike): string {
  const mutlak = roundMoney(toDecimal(tutar).abs());
  return (yon === "CIKIS" ? mutlak.negated() : mutlak).toString();
}

/** İşaretli tutardan yönü okur. Sıfır, giriş sayılır (nötr). */
export function tutarinYonu(tutar: DecimalLike): HareketYonu {
  return toDecimal(tutar).isNegative() ? "CIKIS" : "GIRIS";
}

/** İşaretli hareket tutarlarının toplamı = hesap bakiyesi. */
export function hesaplaBakiye(tutarlar: DecimalLike[]): string {
  let toplam = toDecimal(0);
  for (const t of tutarlar) toplam = toplam.plus(roundMoney(t));
  return toplam.toString();
}

export type HareketOzeti = {
  toplamGiris: string;
  toplamCikis: string;
  bakiye: string;
  hareketSayisi: number;
};

/** Giriş ve çıkış toplamlarını ayrı ayrı verir; bakiye = giriş - çıkış. */
export function hesaplaHareketOzeti(tutarlar: DecimalLike[]): HareketOzeti {
  let giris = toDecimal(0);
  let cikis = toDecimal(0);

  for (const ham of tutarlar) {
    const tutar = roundMoney(ham);
    if (tutar.isNegative()) {
      cikis = cikis.plus(tutar.abs());
    } else {
      giris = giris.plus(tutar);
    }
  }

  return {
    toplamGiris: giris.toString(),
    toplamCikis: cikis.toString(),
    bakiye: giris.minus(cikis).toString(),
    hareketSayisi: tutarlar.length,
  };
}

/**
 * Ekstre için yürüyen bakiye. Tutarlar ESKİDEN YENİYE sıralı verilmelidir;
 * dönen dizi aynı sırada, her hareketten SONRAKİ bakiyeyi içerir.
 */
export function yurutulenBakiyeler(tutarlar: DecimalLike[]): string[] {
  const sonuc: string[] = [];
  let toplam = toDecimal(0);
  for (const t of tutarlar) {
    toplam = toplam.plus(roundMoney(t));
    sonuc.push(toplam.toString());
  }
  return sonuc;
}

/**
 * Mevcut bakiyeye bir değişim uygular. Hareket ekleme/silmede bakiye
 * güncellemesi tek noktadan geçsin diye ayrı fonksiyon.
 */
export function bakiyeUygula(mevcut: DecimalLike, degisim: DecimalLike): string {
  return roundMoney(toDecimal(mevcut).plus(toDecimal(degisim))).toString();
}

/** Bir hareketin geri alınması için uygulanacak ters tutar. */
export function tersTutar(tutar: DecimalLike): string {
  return roundMoney(toDecimal(tutar)).negated().toString();
}

/** Saklanan bakiye ile hareketlerden hesaplanan bakiye tutuyor mu? */
export function bakiyeMutabik(
  saklananBakiye: DecimalLike,
  hareketTutarlari: DecimalLike[]
): boolean {
  return roundMoney(saklananBakiye).equals(
    toDecimal(hesaplaBakiye(hareketTutarlari))
  );
}

/* ------------------------------------------------------------------ */
/* Otomatik hareketler — tahsilat / ödeme / gider                      */
/* ------------------------------------------------------------------ */

/**
 * Para hareketi ÜRETEN kayıtlar ve yönleri.
 *
 * Bu kayıtlar cari/fatura tarafını zaten güncelliyordu ama kasaya hiç
 * dokunmuyordu; kullanıcı aynı parayı iki kez girmek zorundaydı ve nakit akışı
 * raporu gerçeği yansıtmıyordu. Yön burada TEK yerde belirlenir — üç ayrı
 * modülde tekrar edilseydi biri ters yazıldığında sessizce yanlış bakiye
 * oluşurdu.
 */

/** Çek/senet tahsilatı: alınan çekte para GİRER, verilen çekte ÇIKAR. */
export function tahsilatHareketYonu(
  cekYonu: "ALINAN" | "VERILEN"
): HareketYonu {
  return cekYonu === "ALINAN" ? "GIRIS" : "CIKIS";
}

/** Fatura ödemesi: satış faturasında para GİRER, alış faturasında ÇIKAR. */
export function odemeHareketYonu(islemTipi: "SATIS" | "ALIS"): HareketYonu {
  return islemTipi === "SATIS" ? "GIRIS" : "CIKIS";
}

/** Gider her zaman kasadan ÇIKIŞTIR. */
export const GIDER_HAREKET_YONU: HareketYonu = "CIKIS";
