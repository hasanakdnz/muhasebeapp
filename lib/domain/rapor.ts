import { roundMoney, toDecimal, type DecimalLike } from "@/lib/money";
import { kalanGun } from "@/lib/domain/vade";

/**
 * Rapor hesapları — saf, Prisma'sız, doğrudan test edilebilir.
 */

/* ------------------------------------------------------------------ */
/* Yaşlandırma (aging)                                                 */
/* ------------------------------------------------------------------ */

export const YASLANDIRMA_KOVALARI = [
  "vadesi-gelmemis",
  "0-30",
  "31-60",
  "60+",
] as const;
export type YaslandirmaKovasi = (typeof YASLANDIRMA_KOVALARI)[number];

export const YASLANDIRMA_ETIKETI: Record<YaslandirmaKovasi, string> = {
  "vadesi-gelmemis": "Vadesi gelmemiş",
  "0-30": "0-30 gün",
  "31-60": "31-60 gün",
  "60+": "60+ gün",
};

/**
 * Vadeden bu yana geçen gün. Pozitif = gecikmiş, negatif = henüz vadesi gelmemiş.
 *
 * Argümanlar bilerek ters verilir: `-kalanGun(...)` yazmak, vadesi bugün olan
 * kayıtta `-0` üretirdi. İşlevsel bir fark yaratmasa da (-0 < 0 yanlıştır,
 * kova doğru seçilir) sayı karşılaştırmalarında sürprize yol açar.
 */
export function gecikmeGunu(
  vadeTarihi: Date | string,
  bugun: Date | string
): number {
  return kalanGun(bugun, vadeTarihi);
}

/**
 * Gecikme gününü yaşlandırma kovasına yerleştirir.
 *
 * Sınırlar (ROADMAP Faz 7): 0-30 / 31-60 / 60+.
 * "60+" etiketi 60'tan BÜYÜK demektir; 60. gün 31-60 kovasındadır. Kovalar
 * çakışmaz ve boşluk bırakmaz. Vadesi gelmemiş kayıt yaşlandırılmaz —
 * gecikmemiş bir alacağı "0-30 gün" saymak raporu yanıltır.
 */
export function yaslandirmaKovasi(gecikme: number): YaslandirmaKovasi {
  if (gecikme < 0) return "vadesi-gelmemis";
  if (gecikme <= 30) return "0-30";
  if (gecikme <= 60) return "31-60";
  return "60+";
}

export type YaslandirmaKaydi = {
  cariId: string;
  cariUnvan: string;
  /** Vade yoksa belge tarihi kullanılır. */
  vadeTarihi: Date;
  /** Faturanın ödenmemiş kısmı. */
  kalanTutar: DecimalLike;
};

export type YaslandirmaSatiri = {
  cariId: string;
  cariUnvan: string;
  kovalar: Record<YaslandirmaKovasi, string>;
  toplam: string;
};

export type YaslandirmaRaporu = {
  satirlar: YaslandirmaSatiri[];
  kovaToplamlari: Record<YaslandirmaKovasi, string>;
  genelToplam: string;
};

function bosKovalar(): Record<YaslandirmaKovasi, ReturnType<typeof toDecimal>> {
  return {
    "vadesi-gelmemis": toDecimal(0),
    "0-30": toDecimal(0),
    "31-60": toDecimal(0),
    "60+": toDecimal(0),
  };
}

/**
 * Açık kayıtları cari bazında yaşlandırır. Satırlar toplam borca göre
 * büyükten küçüğe sıralanır — raporun ilk bakışta söylemesi gereken şey
 * "en çok kimden alacağım var".
 */
export function yaslandir(
  kayitlar: YaslandirmaKaydi[],
  bugun: Date
): YaslandirmaRaporu {
  const cariler = new Map<
    string,
    {
      unvan: string;
      kovalar: ReturnType<typeof bosKovalar>;
      toplam: ReturnType<typeof toDecimal>;
    }
  >();
  const genelKovalar = bosKovalar();
  let genelToplam = toDecimal(0);

  for (const k of kayitlar) {
    const tutar = roundMoney(k.kalanTutar);
    if (tutar.isZero()) continue;

    const kova = yaslandirmaKovasi(gecikmeGunu(k.vadeTarihi, bugun));

    const mevcut = cariler.get(k.cariId) ?? {
      unvan: k.cariUnvan,
      kovalar: bosKovalar(),
      toplam: toDecimal(0),
    };
    mevcut.kovalar[kova] = mevcut.kovalar[kova].plus(tutar);
    mevcut.toplam = mevcut.toplam.plus(tutar);
    cariler.set(k.cariId, mevcut);

    genelKovalar[kova] = genelKovalar[kova].plus(tutar);
    genelToplam = genelToplam.plus(tutar);
  }

  const satirlar = [...cariler.entries()]
    .map(([cariId, v]) => ({
      cariId,
      cariUnvan: v.unvan,
      kovalar: {
        "vadesi-gelmemis": v.kovalar["vadesi-gelmemis"].toString(),
        "0-30": v.kovalar["0-30"].toString(),
        "31-60": v.kovalar["31-60"].toString(),
        "60+": v.kovalar["60+"].toString(),
      },
      toplam: v.toplam.toString(),
    }))
    .sort((a, b) => Number(b.toplam) - Number(a.toplam));

  return {
    satirlar,
    kovaToplamlari: {
      "vadesi-gelmemis": genelKovalar["vadesi-gelmemis"].toString(),
      "0-30": genelKovalar["0-30"].toString(),
      "31-60": genelKovalar["31-60"].toString(),
      "60+": genelKovalar["60+"].toString(),
    },
    genelToplam: genelToplam.toString(),
  };
}

/* ------------------------------------------------------------------ */
/* KDV raporu                                                          */
/* ------------------------------------------------------------------ */

export type KdvGirdisi = {
  /** Satışlardan doğan KDV. */
  satisKdv: DecimalLike[];
  /** Alışlardan doğan KDV. */
  alisKdv: DecimalLike[];
  /** Giderlerden doğan KDV. */
  giderKdv: DecimalLike[];
};

export type KdvRaporu = {
  hesaplananKdv: string;
  indirilecekKdv: string;
  /** Hesaplanan > indirilecek ise ödenecek tutar, aksi halde sıfır. */
  odenecekKdv: string;
  /** İndirilecek > hesaplanan ise sonraki döneme devreden tutar. */
  devredenKdv: string;
  alisKdvToplami: string;
  giderKdvToplami: string;
};

function topla(degerler: DecimalLike[]) {
  let t = toDecimal(0);
  for (const d of degerler) t = t.plus(roundMoney(d));
  return t;
}

/**
 * KDV beyanı özeti.
 *
 * Hesaplanan KDV satışlardan, indirilecek KDV alışlar VE giderlerden gelir.
 * Fark pozitifse ödenecek, negatifse sonraki döneme devreder — Türkiye'de
 * devreden KDV iade edilmez, bir sonraki dönemde indirim olarak kullanılır.
 */
export function kdvRaporu(girdi: KdvGirdisi): KdvRaporu {
  const hesaplanan = topla(girdi.satisKdv);
  const alis = topla(girdi.alisKdv);
  const gider = topla(girdi.giderKdv);
  const indirilecek = alis.plus(gider);
  const fark = hesaplanan.minus(indirilecek);

  return {
    hesaplananKdv: hesaplanan.toString(),
    indirilecekKdv: indirilecek.toString(),
    odenecekKdv: fark.isPositive() && !fark.isZero() ? fark.toString() : "0",
    devredenKdv: fark.isNegative() ? fark.abs().toString() : "0",
    alisKdvToplami: alis.toString(),
    giderKdvToplami: gider.toString(),
  };
}

/* ------------------------------------------------------------------ */
/* Satış performansı                                                   */
/* ------------------------------------------------------------------ */

export type CariPerformansGirdisi = {
  cariId: string;
  cariUnvan: string;
  tutar: DecimalLike;
};

export type CariPerformansSatiri = {
  cariId: string;
  cariUnvan: string;
  toplam: string;
  adet: number;
  /** Toplam içindeki pay, yüzde (iki basamak). */
  yuzde: string;
};

/** Cari bazında satış performansı — büyükten küçüğe sıralı. */
export function cariPerformansi(
  girdiler: CariPerformansGirdisi[],
  limit?: number
): CariPerformansSatiri[] {
  const kovalar = new Map<
    string,
    { unvan: string; toplam: ReturnType<typeof toDecimal>; adet: number }
  >();
  let genel = toDecimal(0);

  for (const g of girdiler) {
    const tutar = roundMoney(g.tutar);
    const mevcut = kovalar.get(g.cariId);
    if (mevcut) {
      mevcut.toplam = mevcut.toplam.plus(tutar);
      mevcut.adet += 1;
    } else {
      kovalar.set(g.cariId, { unvan: g.cariUnvan, toplam: tutar, adet: 1 });
    }
    genel = genel.plus(tutar);
  }

  const satirlar = [...kovalar.entries()]
    .map(([cariId, v]) => ({
      cariId,
      cariUnvan: v.unvan,
      toplam: v.toplam.toString(),
      adet: v.adet,
      yuzde: genel.isZero()
        ? "0"
        : v.toplam.times(100).dividedBy(genel).toDecimalPlaces(2).toString(),
    }))
    .sort((a, b) => Number(b.toplam) - Number(a.toplam));

  return limit ? satirlar.slice(0, limit) : satirlar;
}
