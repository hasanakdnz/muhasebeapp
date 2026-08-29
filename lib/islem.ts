import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/money";
import {
  cariBakiyeEtkisi,
  hesaplaIslemToplamlari,
  tersEtki,
  type IslemTipiValue,
} from "@/lib/domain/islem";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

// Saf KDV/bakiye mantığı lib/domain/islem.ts içindedir.
export {
  hesaplaIslemToplamlari,
  hesaplaKalem,
  cariBakiyeEtkisi,
} from "@/lib/domain/islem";

/** RSC sınırından geçebilmesi için Decimal'ler string'e çevrilir. */
export type IslemSatiri = {
  id: string;
  tip: IslemTipiValue;
  cariId: string;
  cariUnvan: string;
  tarih: Date;
  vadeTarihi: Date | null;
  toplamTutar: string;
  kdvTutari: string;
  /** toplamTutar - kdvTutari */
  matrah: string;
  kalemSayisi: number;
};

export type IslemKalemSatiri = {
  id: string;
  urunAdi: string;
  miktar: string;
  birimFiyat: string;
  kdvOrani: string;
  matrah: string;
  kdv: string;
  brut: string;
};

export type IslemDetay = IslemSatiri & {
  kalemler: IslemKalemSatiri[];
};

export type IslemYaziVerisi = {
  tip: IslemTipiValue;
  cariId: string;
  tarih: Date;
  vadeTarihi?: Date;
  kalemler: Array<{
    urunAdi: string;
    miktar: string;
    /** KDV hariç net birim fiyat. */
    birimFiyat: string;
    kdvOrani: string;
  }>;
};

export type IslemFiltre = {
  tip?: IslemTipiValue;
  cariId?: string;
  baslangic?: Date;
  bitis?: Date;
};

export async function listeleIslemler(
  filtre: IslemFiltre = {},
  db: Db = prisma
): Promise<IslemSatiri[]> {
  const islemler = await db.islem.findMany({
    where: {
      ...(filtre.tip ? { tip: filtre.tip } : {}),
      ...(filtre.cariId ? { cariId: filtre.cariId } : {}),
      ...(filtre.baslangic || filtre.bitis
        ? {
            tarih: {
              ...(filtre.baslangic ? { gte: filtre.baslangic } : {}),
              ...(filtre.bitis ? { lte: filtre.bitis } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ tarih: "desc" }, { id: "desc" }],
    include: {
      cari: { select: { unvan: true } },
      _count: { select: { kalemler: true } },
    },
  });

  return islemler.map((i) => {
    const toplam = roundMoney(i.toplamTutar);
    const kdv = roundMoney(i.kdvTutari);
    return {
      id: i.id,
      tip: i.tip,
      cariId: i.cariId,
      cariUnvan: i.cari.unvan,
      tarih: i.tarih,
      vadeTarihi: i.vadeTarihi,
      toplamTutar: toplam.toString(),
      kdvTutari: kdv.toString(),
      matrah: toplam.minus(kdv).toString(),
      kalemSayisi: i._count.kalemler,
    };
  });
}

export async function getIslem(
  id: string,
  db: Db = prisma
): Promise<IslemDetay | null> {
  const islem = await db.islem.findUnique({
    where: { id },
    include: {
      cari: { select: { unvan: true } },
      kalemler: { orderBy: { id: "asc" } },
    },
  });
  if (!islem) return null;

  const toplam = roundMoney(islem.toplamTutar);
  const kdv = roundMoney(islem.kdvTutari);

  return {
    id: islem.id,
    tip: islem.tip,
    cariId: islem.cariId,
    cariUnvan: islem.cari.unvan,
    tarih: islem.tarih,
    vadeTarihi: islem.vadeTarihi,
    toplamTutar: toplam.toString(),
    kdvTutari: kdv.toString(),
    matrah: toplam.minus(kdv).toString(),
    kalemSayisi: islem.kalemler.length,
    kalemler: islem.kalemler.map((k) => {
      const girdi = {
        miktar: k.miktar.toString(),
        birimFiyat: k.birimFiyat.toString(),
        kdvOrani: k.kdvOrani.toString(),
      };
      const [hesap] = hesaplaIslemToplamlari([girdi]).kalemler;
      return {
        id: k.id,
        urunAdi: k.urunAdi,
        miktar: k.miktar.toString(),
        birimFiyat: k.birimFiyat.toString(),
        kdvOrani: k.kdvOrani.toString(),
        matrah: hesap.matrah,
        kdv: hesap.kdv,
        brut: hesap.brut,
      };
    }),
  };
}

/**
 * İşlemi ve kalemlerini oluşturur, cari bakiyesini AYNI transaction içinde
 * günceller. Bakiye mevcut değere işlem etkisi eklenerek Decimal ile bulunur —
 * SQL SUM() kullanılmaz (SQLite'ta float aritmetiğine düşer).
 */
export async function islemOlustur(
  veri: IslemYaziVerisi,
  db: Db = prisma
): Promise<{ id: string }> {
  if (veri.kalemler.length === 0) {
    throw new Error("İşlemde en az bir kalem olmalı.");
  }

  const toplamlar = hesaplaIslemToplamlari(veri.kalemler);
  const etki = cariBakiyeEtkisi(veri.tip, toplamlar.toplamTutar);

  return db.$transaction(async (tx) => {
    const cari = await tx.cari.findUnique({
      where: { id: veri.cariId },
      select: { bakiye: true },
    });
    if (!cari) throw new Error("Cari bulunamadı.");

    const islem = await tx.islem.create({
      data: {
        tip: veri.tip,
        cariId: veri.cariId,
        tarih: veri.tarih,
        vadeTarihi: veri.vadeTarihi ?? null,
        toplamTutar: toplamlar.toplamTutar,
        kdvTutari: toplamlar.kdvTutari,
        kalemler: {
          create: veri.kalemler.map((k) => ({
            urunAdi: k.urunAdi,
            miktar: k.miktar,
            birimFiyat: k.birimFiyat,
            kdvOrani: k.kdvOrani,
          })),
        },
      },
      select: { id: true },
    });

    await tx.cari.update({
      where: { id: veri.cariId },
      data: { bakiye: roundMoney(cari.bakiye).plus(etki).toString() },
    });

    return islem;
  });
}

/** İşlemi siler ve cari bakiyesine ters etkiyi uygulayarak geri alır. */
export async function islemSil(id: string, db: Db = prisma): Promise<void> {
  await db.$transaction(async (tx) => {
    const islem = await tx.islem.findUnique({
      where: { id },
      select: { id: true, tip: true, cariId: true, toplamTutar: true },
    });
    if (!islem) throw new Error("İşlem bulunamadı.");

    const cari = await tx.cari.findUnique({
      where: { id: islem.cariId },
      select: { bakiye: true },
    });
    if (!cari) throw new Error("Cari bulunamadı.");

    const etki = cariBakiyeEtkisi(islem.tip, islem.toplamTutar.toString());

    // Kalemler şemada onDelete: Cascade — işlemle birlikte silinirler.
    await tx.islem.delete({ where: { id } });
    await tx.cari.update({
      where: { id: islem.cariId },
      data: {
        bakiye: roundMoney(cari.bakiye).plus(tersEtki(etki)).toString(),
      },
    });
  });
}

export type DonemToplami = {
  satis: string;
  alis: string;
  satisKdv: string;
  alisKdv: string;
  islemSayisi: number;
};

/** Dashboard için dönemsel satış/alış toplamları. */
export async function donemselToplamlar(
  aralik: { baslangic: Date; bitis: Date },
  db: Db = prisma
): Promise<DonemToplami> {
  const islemler = await db.islem.findMany({
    where: { tarih: { gte: aralik.baslangic, lte: aralik.bitis } },
    select: { tip: true, toplamTutar: true, kdvTutari: true },
  });

  let satis = roundMoney(0);
  let alis = roundMoney(0);
  let satisKdv = roundMoney(0);
  let alisKdv = roundMoney(0);

  for (const i of islemler) {
    const tutar = roundMoney(i.toplamTutar);
    const kdv = roundMoney(i.kdvTutari);
    if (i.tip === "SATIS") {
      satis = satis.plus(tutar);
      satisKdv = satisKdv.plus(kdv);
    } else {
      alis = alis.plus(tutar);
      alisKdv = alisKdv.plus(kdv);
    }
  }

  return {
    satis: satis.toString(),
    alis: alis.toString(),
    satisKdv: satisKdv.toString(),
    alisKdv: alisKdv.toString(),
    islemSayisi: islemler.length,
  };
}
