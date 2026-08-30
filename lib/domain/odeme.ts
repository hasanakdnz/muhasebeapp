import { roundMoney, toDecimal, type DecimalLike } from "@/lib/money";

/**
 * Fatura ödemesi mantığı — saf, Prisma'sız, doğrudan test edilebilir.
 *
 * ## Çift sayım tehlikesi (bu modülün varlık sebebi)
 * Cari bakiyesi çek ALINDIĞINDA zaten değişiyor. Eğer o çeke bağlanan fatura
 * ödemesi de bakiyeyi düşürseydi, çekle kapanan bir fatura bakiyeyi İKİ KEZ
 * azaltırdı. Bu yüzden:
 *
 *  - `DIREKT` ödeme (nakit/banka): cari bakiyesini DÜŞÜRÜR.
 *  - `CEK` kaynaklı ödeme: bakiyeyi ETKİLEMEZ; yalnızca "bu çek hangi
 *    faturayı kapattı" bilgisidir (dağıtım/eşleştirme kaydı).
 *
 * Faturayı kapatan şey ÇEKİN KENDİSİDİR, tahsilatı değil: çek ele geçtiğinde
 * cari hesap kapanır, tahsilat sonradan gelen bir kasa olayıdır. Önceki
 * `CEK_TAHSILATI` kaynağı bu yüzden kaldırıldı — aksi halde fatura, çek
 * tahsil edilene kadar "bekliyor" kalır ve yaşlandırma raporu çekle kapanmış
 * bir alacağı gecikmiş gösterirdi.
 */

export const ODEME_KAYNAKLARI = ["DIREKT", "CEK"] as const;
export type OdemeKaynagiValue = (typeof ODEME_KAYNAKLARI)[number];

export const ODEME_KAYNAK_ETIKETI: Record<OdemeKaynagiValue, string> = {
  DIREKT: "Nakit / Banka",
  CEK: "Çek / Senet",
};

export const ODEME_STATUSLERI = [
  "ODENDI",
  "KISMI_ODENDI",
  "BEKLIYOR",
  "IPTAL",
] as const;
export type OdemeStatusuValue = (typeof ODEME_STATUSLERI)[number];

export const ODEME_STATUS_ETIKETI: Record<OdemeStatusuValue, string> = {
  ODENDI: "ödendi",
  KISMI_ODENDI: "kısmi ödendi",
  BEKLIYOR: "bekliyor",
  IPTAL: "iptal",
};

export type OdemeOzeti = {
  odenen: string;
  kalan: string;
  tamamlandiMi: boolean;
  odemeSayisi: number;
};

export function hesaplaOdeme(
  toplamTutar: DecimalLike,
  odemeler: DecimalLike[]
): OdemeOzeti {
  const toplam = roundMoney(toplamTutar);
  let odenen = toDecimal(0);
  for (const o of odemeler) odenen = odenen.plus(roundMoney(o));

  const kalan = toplam.minus(odenen);
  return {
    odenen: odenen.toString(),
    kalan: kalan.toString(),
    tamamlandiMi: kalan.isZero(),
    odemeSayisi: odemeler.length,
  };
}

/**
 * Ödeme durumu, ödeme kayıtlarından TÜRETİLİR; elle konmaz.
 * IPTAL bu eksende yer almaz — ayrı bir yaşam döngüsü durumudur ve korunur.
 */
export function sonrakiStatus(
  mevcutStatus: OdemeStatusuValue,
  toplamTutar: DecimalLike,
  odenenTutar: DecimalLike
): OdemeStatusuValue {
  if (mevcutStatus === "IPTAL") return "IPTAL";

  const toplam = roundMoney(toplamTutar);
  const odenen = roundMoney(odenenTutar);

  if (odenen.isZero()) return "BEKLIYOR";
  return toplam.equals(odenen) ? "ODENDI" : "KISMI_ODENDI";
}

export type OdemeKontrolu = { gecerli: true } | { gecerli: false; hata: string };

/**
 * Yeni bir fatura ödemesinin kabul edilip edilemeyeceği.
 * Fazla ödeme engellenir: kalandan büyük tutar, faturayı "aşırı ödenmiş"
 * gösterir ve yaşlandırma raporunu bozar.
 */
export function odemeKontrol(
  islem: {
    toplamTutar: DecimalLike;
    odenenTutar: DecimalLike;
    status: OdemeStatusuValue;
  },
  yeniTutar: DecimalLike
): OdemeKontrolu {
  const tutar = roundMoney(yeniTutar);

  // decimal.js: isPositive() sıfır için de true döner — greaterThan(0) şart.
  if (!tutar.greaterThan(0)) {
    return { gecerli: false, hata: "Ödeme tutarı sıfırdan büyük olmalı." };
  }
  if (islem.status === "IPTAL") {
    return { gecerli: false, hata: "İptal edilmiş işleme ödeme kaydedilemez." };
  }

  const kalan = roundMoney(islem.toplamTutar).minus(roundMoney(islem.odenenTutar));
  if (kalan.isZero()) {
    return { gecerli: false, hata: "Bu işlem zaten tamamen ödenmiş." };
  }
  if (tutar.greaterThan(kalan)) {
    // Mesaj ham sayı içermez; arayüz kalan tutarı biçimli gösterir.
    return { gecerli: false, hata: "Ödeme kalan tutardan büyük olamaz." };
  }

  return { gecerli: true };
}

/**
 * Bir çekten faturalara dağıtılabilecek kalan tutar.
 * Çekin faturalara sayılan toplamı, çek tutarını aşamaz.
 */
export function cekDagitilabilirKalan(
  cekTutari: DecimalLike,
  dagitilanlar: DecimalLike[]
): string {
  let dagitilan = toDecimal(0);
  for (const d of dagitilanlar) dagitilan = dagitilan.plus(roundMoney(d));
  return roundMoney(cekTutari).minus(dagitilan).toString();
}

export function cekDagitimKontrol(
  cekTutari: DecimalLike,
  dagitilanlar: DecimalLike[],
  yeniTutar: DecimalLike
): OdemeKontrolu {
  const kalan = toDecimal(cekDagitilabilirKalan(cekTutari, dagitilanlar));
  if (roundMoney(yeniTutar).greaterThan(kalan)) {
    return {
      gecerli: false,
      hata: "Bu çekten faturalara dağıtılabilecek tutar aşılıyor.",
    };
  }
  return { gecerli: true };
}

/**
 * Bir ödemenin cari bakiyesine etkisi.
 *
 * KRİTİK: yalnızca DIREKT ödemeler bakiyeyi etkiler. Çeke bağlanan ödeme bir
 * dağıtım kaydıdır; borç, çek ele geçtiğinde zaten kapanmıştı (bkz.
 * lib/domain/cek-senet.ts cekCariEtkisi).
 */
export function odemeCariEtkisi(
  islemTipi: "SATIS" | "ALIS",
  kaynak: OdemeKaynagiValue,
  tutar: DecimalLike
): string {
  if (kaynak !== "DIREKT") return "0";

  const t = roundMoney(tutar);
  // SATIS: müşteri ödedi → bize borcu azalır → bakiye DÜŞER.
  // ALIS:  biz ödedik → tedarikçiye borcumuz azalır → bakiye YÜKSELİR.
  return (islemTipi === "SATIS" ? t.negated() : t).toString();
}

/** Saklanan odenenTutar, ödeme kayıtlarının toplamıyla tutuyor mu? */
export function odemeMutabik(
  saklananOdenen: DecimalLike,
  odemeler: DecimalLike[]
): boolean {
  let toplam = toDecimal(0);
  for (const o of odemeler) toplam = toplam.plus(roundMoney(o));
  return roundMoney(saklananOdenen).equals(toplam);
}
