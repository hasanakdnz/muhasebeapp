import { roundMoney, toDecimal, type DecimalLike } from "@/lib/money";

/**
 * Çek/Senet ve kısmi tahsilat mantığı — saf, Prisma'sız, doğrudan test edilebilir.
 *
 * ## Bakiye modeli
 * Çek cari bakiyesini ELE GEÇTİĞİ ANDA etkiler; tahsilat cariye DOKUNMAZ.
 * Türkiye'deki standart uygulama budur (`101 Alınan Çekler / 120 Alıcılar`):
 * müşteri borcuna karşılık çeki verdiğinde cari hesabı kapanır, risk çek
 * portföyüne taşınır.
 *
 *  - ALINAN  (müşteriden): çek alınınca carinin bize borcu KAPANIR → bakiye düşer.
 *  - VERILEN (tedarikçiye): çek verilince bizim borcumuz KAPANIR → bakiye yükselir.
 *
 * Önceki sürümde etki tahsilat anında işleniyordu. O model, karşılıksız çekte
 * düzeltme gerektirmemesi için seçilmişti; ama nadir durumu kolaylaştırırken
 * sık durumu bozuyordu: müşterinin kapanmış borcu hem cari alacağında hem çek
 * portföyünde görünüyor, alacak ÇİFT SAYILIYORDU (10.000'lik alacak 20.000
 * gösteriliyordu).
 *
 * Karşılıksız çıkan çekte borç geri gelir: net etki yalnızca FİİLEN tahsil
 * edilen kadardır. Kısmen tahsil edilip sonra yanan çekte de bu doğru sonucu
 * verir — tahsil edilemeyen kısım borç olarak geri döner.
 *
 * ## Durum geçişleri
 * Şemada "kısmi tahsil edildi" diye bir durum YOK. Bu yüzden:
 *  - tahsilEdilen < tutar  → PORTFOYDE (kısmen tahsil edilmiş olsa bile)
 *  - tahsilEdilen = tutar  → TAHSIL_EDILDI (otomatik)
 *  - CIRO_EDILDI ve KARSILIKSIZ elle işaretlenir ve tahsilata kapalıdır.
 */

export const CEK_SENET_TIPLERI = ["CEK", "SENET"] as const;
export type CekSenetTipiValue = (typeof CEK_SENET_TIPLERI)[number];

export const CEK_SENET_YONLERI = ["ALINAN", "VERILEN"] as const;
export type CekSenetYonuValue = (typeof CEK_SENET_YONLERI)[number];

export const CEK_SENET_DURUMLARI = [
  "PORTFOYDE",
  "CIRO_EDILDI",
  "TAHSIL_EDILDI",
  "KARSILIKSIZ",
] as const;
export type CekSenetDurumuValue = (typeof CEK_SENET_DURUMLARI)[number];

export const CEK_SENET_TIP_ETIKETI: Record<CekSenetTipiValue, string> = {
  CEK: "Çek",
  SENET: "Senet",
};

export const CEK_SENET_YON_ETIKETI: Record<CekSenetYonuValue, string> = {
  ALINAN: "Alınan",
  VERILEN: "Verilen",
};

export const CEK_SENET_DURUM_ETIKETI: Record<CekSenetDurumuValue, string> = {
  PORTFOYDE: "portföyde",
  CIRO_EDILDI: "ciro edildi",
  TAHSIL_EDILDI: "tahsil edildi",
  KARSILIKSIZ: "karşılıksız",
};

/** Tahsilata kapalı durumlar — bu durumlarda yeni tahsilat kaydedilemez. */
export const TAHSILATA_KAPALI_DURUMLAR: CekSenetDurumuValue[] = [
  "CIRO_EDILDI",
  "KARSILIKSIZ",
];

export type TahsilatOzeti = {
  tahsilEdilen: string;
  kalan: string;
  tamamlandiMi: boolean;
  tahsilatSayisi: number;
};

/** Tahsilat kayıtlarından toplamı ve kalanı çıkarır. */
export function hesaplaTahsilat(
  tutar: DecimalLike,
  tahsilatlar: DecimalLike[]
): TahsilatOzeti {
  const toplamTutar = roundMoney(tutar);
  let tahsil = toDecimal(0);
  for (const t of tahsilatlar) tahsil = tahsil.plus(roundMoney(t));

  const kalan = toplamTutar.minus(tahsil);
  return {
    tahsilEdilen: tahsil.toString(),
    kalan: kalan.toString(),
    // "Tam tahsilat" kuruşuna kadar eşitlik demektir; fazlası zaten engellenir.
    tamamlandiMi: kalan.isZero(),
    tahsilatSayisi: tahsilatlar.length,
  };
}

/**
 * Tahsilat sonrası durum. Yalnızca PORTFOYDE ↔ TAHSIL_EDILDI ekseninde
 * otomatiktir; CIRO_EDILDI ve KARSILIKSIZ elle konur ve korunur.
 */
export function sonrakiDurum(
  mevcutDurum: CekSenetDurumuValue,
  tutar: DecimalLike,
  tahsilEdilen: DecimalLike
): CekSenetDurumuValue {
  if (TAHSILATA_KAPALI_DURUMLAR.includes(mevcutDurum)) return mevcutDurum;
  return roundMoney(tutar).equals(roundMoney(tahsilEdilen))
    ? "TAHSIL_EDILDI"
    : "PORTFOYDE";
}

export type TahsilatKontrolu =
  | { gecerli: true }
  | { gecerli: false; hata: string };

/**
 * Yeni bir tahsilatın kabul edilip edilemeyeceği.
 * Fazla tahsilat kesinlikle engellenir — kalandan büyük tutar, cari bakiyesini
 * ters yöne geçirir ve mutabakatı bozar.
 */
export function tahsilatKontrol(
  cekSenet: {
    tutar: DecimalLike;
    tahsilEdilen: DecimalLike;
    durum: CekSenetDurumuValue;
  },
  yeniTutar: DecimalLike
): TahsilatKontrolu {
  const tutar = roundMoney(yeniTutar);

  // decimal.js: isPositive() sıfır için de true döner (işaretli sıfır),
  // bu yüzden "sıfırdan büyük" kontrolü greaterThan(0) ile yapılır.
  if (!tutar.greaterThan(0)) {
    return { gecerli: false, hata: "Tahsilat tutarı sıfırdan büyük olmalı." };
  }

  if (TAHSILATA_KAPALI_DURUMLAR.includes(cekSenet.durum)) {
    return {
      gecerli: false,
      hata: `Durumu "${CEK_SENET_DURUM_ETIKETI[cekSenet.durum]}" olan çek/senede tahsilat kaydedilemez.`,
    };
  }

  const kalan = roundMoney(cekSenet.tutar).minus(roundMoney(cekSenet.tahsilEdilen));
  if (kalan.isZero()) {
    return { gecerli: false, hata: "Bu çek/senet zaten tamamen tahsil edilmiş." };
  }
  if (tutar.greaterThan(kalan)) {
    // Mesaj ham sayı içermez: alan katmanı biçimlendirme bilmez, arayüz kalan
    // tutarı zaten Türkçe biçimde (₺, binlik ayraç) gösteriyor.
    return { gecerli: false, hata: "Tahsilat kalan tutardan büyük olamaz." };
  }

  return { gecerli: true };
}

export type DurumDegisikligiKontrolu =
  | { gecerli: true }
  | { gecerli: false; hata: string };

/**
 * Elle durum değişikliği kuralları.
 *
 * - KARSILIKSIZ: yalnızca portföydeyken işaretlenir. Önceki tahsilatlar GERİ
 *   ALINMAZ — o para fiilen tahsil edilmiştir; kalan borç zaten cari üzerinde
 *   açık durduğu için ek düzeltme gerekmez.
 * - CIRO_EDILDI: yalnızca hiç tahsilat yapılmamışken. Kısmen tahsil edilmiş bir
 *   çek ciro edilemez.
 * - PORTFOYDE'ye dönüş: hatalı işaretlemeyi düzeltmek için serbest.
 * - TAHSIL_EDILDI elle konmaz; tahsilat kayıtlarından doğar.
 */
export function durumDegisikligiKontrol(
  cekSenet: { tahsilEdilen: DecimalLike; durum: CekSenetDurumuValue },
  yeniDurum: CekSenetDurumuValue
): DurumDegisikligiKontrolu {
  if (yeniDurum === cekSenet.durum) return { gecerli: true };

  if (yeniDurum === "TAHSIL_EDILDI") {
    return {
      gecerli: false,
      hata: "Tahsil edildi durumu elle seçilemez; tahsilat kaydedin.",
    };
  }

  // Ciro iki cari bakiyesini birden etkilediği ve hedef cari bilgisi
  // gerektirdiği için düz bir durum değişikliği değildir; ciroEt/ciroGeriAl
  // üzerinden yapılır.
  if (yeniDurum === "CIRO_EDILDI") {
    return {
      gecerli: false,
      hata: "Ciro için hedef cariyi seçmeniz gerekir.",
    };
  }

  if (cekSenet.durum === "CIRO_EDILDI") {
    return {
      gecerli: false,
      hata: "Ciro edilmiş çekin durumu için önce ciroyu geri alın.",
    };
  }

  return { gecerli: true };
}

/**
 * Bir çek/senet KAYDININ cari bakiyesine etkisi.
 *
 * Etki çekin varlığından doğar, tahsilatından değil. Karşılıksız çıkan çekte
 * tahsil edilemeyen kısım borç olarak geri döner; bu yüzden KARSILIKSIZ
 * durumunda etkin tutar, fiilen tahsil edilen kadardır.
 *
 * CIRO_EDILDI durumunda etki DEĞİŞMEZ: çeki veren müşterinin borcu çeki
 * verdiği anda kapanmıştı, çekin sonradan başkasına devredilmesi onu
 * ilgilendirmez (cironun karşı taraf etkisi için `ciroHedefEtkisi`).
 */
export function cekCariEtkisi(
  yon: CekSenetYonuValue,
  durum: CekSenetDurumuValue,
  tutar: DecimalLike,
  tahsilEdilen: DecimalLike
): string {
  const etkin =
    durum === "KARSILIKSIZ" ? roundMoney(tahsilEdilen) : roundMoney(tutar);
  return (yon === "ALINAN" ? etkin.negated() : etkin).toString();
}

/** Bir tahsilatın geri alınması için uygulanacak ters etki. */
export function tersEtki(etki: DecimalLike): string {
  return roundMoney(etki).negated().toString();
}

/** Saklanan tahsilEdilen, tahsilat kayıtlarının toplamıyla tutuyor mu? */
export function tahsilatMutabik(
  saklananTahsilEdilen: DecimalLike,
  tahsilatlar: DecimalLike[]
): boolean {
  let toplam = toDecimal(0);
  for (const t of tahsilatlar) toplam = toplam.plus(roundMoney(t));
  return roundMoney(saklananTahsilEdilen).equals(toplam);
}

/** Portföy özeti: tahsil edilecek ve ödenecek toplamlar. */
export function hesaplaPortfoyOzeti(
  kayitlar: Array<{
    yon: CekSenetYonuValue;
    durum: CekSenetDurumuValue;
    tutar: DecimalLike;
    tahsilEdilen: DecimalLike;
  }>
) {
  let tahsilEdilecek = toDecimal(0);
  let odenecek = toDecimal(0);
  let karsiliksiz = toDecimal(0);

  for (const k of kayitlar) {
    const kalan = roundMoney(k.tutar).minus(roundMoney(k.tahsilEdilen));
    if (k.durum === "KARSILIKSIZ") {
      karsiliksiz = karsiliksiz.plus(kalan);
      continue;
    }
    // Ciro edilmiş ve tamamen tahsil edilmiş kayıtlar beklenen akışta değildir.
    if (k.durum !== "PORTFOYDE" || kalan.isZero()) continue;
    if (k.yon === "ALINAN") {
      tahsilEdilecek = tahsilEdilecek.plus(kalan);
    } else {
      odenecek = odenecek.plus(kalan);
    }
  }

  return {
    tahsilEdilecek: tahsilEdilecek.toString(),
    odenecek: odenecek.toString(),
    karsiliksiz: karsiliksiz.toString(),
  };
}

export type CiroKontrolu = { gecerli: true } | { gecerli: false; hata: string };

/**
 * Ciro edilebilirlik kuralları.
 *
 * Ciro, bize verilmiş bir çeki bir tedarikçiye devretmektir. Bu yüzden:
 *  - Yalnızca ALINAN çek ciro edilebilir; VERILEN çek zaten bizde değildir.
 *  - Kısmen tahsil edilmiş çek ciro edilemez — çek tek parça bir senettir,
 *    bir kısmını bozdurup kalanını devretmek mümkün değildir.
 *  - Hedef cari zorunludur: ciro İKİ bakiyeyi birden etkiler, hedef
 *    bilinmeden etki hesaplanamaz.
 */
export function ciroKontrol(
  cekSenet: {
    yon: CekSenetYonuValue;
    durum: CekSenetDurumuValue;
    tahsilEdilen: DecimalLike;
    cariId: string;
  },
  hedefCariId: string
): CiroKontrolu {
  if (cekSenet.yon !== "ALINAN") {
    return {
      gecerli: false,
      hata: "Yalnızca alınan çek/senet ciro edilebilir.",
    };
  }
  if (cekSenet.durum !== "PORTFOYDE") {
    return {
      gecerli: false,
      hata: "Yalnızca portföydeki çek/senet ciro edilebilir.",
    };
  }
  if (!roundMoney(cekSenet.tahsilEdilen).isZero()) {
    return {
      gecerli: false,
      hata: "Kısmen tahsil edilmiş çek/senet ciro edilemez.",
    };
  }
  if (!hedefCariId.trim()) {
    return { gecerli: false, hata: "Ciro edilecek cariyi seçin." };
  }
  if (hedefCariId === cekSenet.cariId) {
    return {
      gecerli: false,
      hata: "Çek, kendisini veren cariye ciro edilemez.",
    };
  }
  return { gecerli: true };
}

/**
 * Cironun HEDEF cariye etkisi.
 *
 * Ciroda çek elimizden çıkar ve tedarikçiye olan borcumuz azalır → hedef
 * carinin bakiyesi yükselir.
 *
 * Çeki bize VEREN müşteri burada yer almaz: onun borcu çeki verdiği anda
 * `cekCariEtkisi` ile zaten kapanmıştı. Eski (tahsilat bazlı) modelde ciro
 * iki taraflıydı, çünkü veren tarafın borcu o ana kadar açık duruyordu.
 */
export function ciroHedefEtkisi(tutar: DecimalLike): string {
  return roundMoney(tutar).toString();
}
