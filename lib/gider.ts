import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/money";
import { kdvAyir } from "@/lib/domain/gider";
import { belgeSil } from "@/lib/storage";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

// Saf hesap mantığı lib/domain/gider.ts içindedir (Prisma'sız, test edilebilir).
export {
  hesaplaGiderOzeti,
  kategoriDagilimi,
  kdvAyir,
} from "@/lib/domain/gider";
export type { GiderOzeti, KategoriToplami } from "@/lib/domain/gider";

/** RSC sınırından geçebilmesi için Decimal'ler string'e çevrilir. */
export type GiderSatiri = {
  id: string;
  kategori: string;
  /** KDV dahil tutar. */
  tutar: string;
  kdvOrani: string;
  kdvTutari: string;
  /** tutar - kdvTutari */
  matrah: string;
  aciklama: string | null;
  belgeUrl: string | null;
  belgeAdi: string | null;
  tarih: Date;
};

export type GiderFiltre = {
  kategori?: string;
  baslangic?: Date;
  bitis?: Date;
};

function satiraCevir(g: {
  id: string;
  kategori: string;
  tutar: unknown;
  kdvOrani: unknown;
  kdvTutari: unknown;
  aciklama: string | null;
  belgeUrl: string | null;
  belgeAdi: string | null;
  tarih: Date;
}): GiderSatiri {
  const tutar = roundMoney(String(g.tutar));
  const kdvTutari = roundMoney(String(g.kdvTutari));
  return {
    id: g.id,
    kategori: g.kategori,
    tutar: tutar.toString(),
    kdvOrani: String(g.kdvOrani),
    kdvTutari: kdvTutari.toString(),
    matrah: tutar.minus(kdvTutari).toString(),
    aciklama: g.aciklama,
    belgeUrl: g.belgeUrl,
    belgeAdi: g.belgeAdi,
    tarih: g.tarih,
  };
}

export async function listeleGiderler(
  filtre: GiderFiltre = {},
  db: Db = prisma
): Promise<GiderSatiri[]> {
  const giderler = await db.gider.findMany({
    where: {
      ...(filtre.kategori ? { kategori: filtre.kategori } : {}),
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
  });
  return giderler.map(satiraCevir);
}

export async function getGider(
  id: string,
  db: Db = prisma
): Promise<GiderSatiri | null> {
  const gider = await db.gider.findUnique({ where: { id } });
  return gider ? satiraCevir(gider) : null;
}

export type GiderYaziVerisi = {
  kategori: string;
  /** KDV DAHİL tutar. */
  tutar: string;
  kdvOrani: string;
  aciklama?: string;
  tarih: Date;
};

/**
 * KDV tutarı DAİMA sunucuda hesaplanır (tutar ve orandan türetilir); istemciden
 * gelen bir KDV değerine güvenilmez. Saklanır çünkü oranlar zamanla değişir ve
 * geçmiş kayıt kendi dönemindeki KDV'sini korumalıdır.
 */
export async function giderOlustur(
  veri: GiderYaziVerisi,
  belge?: { anahtar: string; ad: string },
  db: Db = prisma
): Promise<{ id: string }> {
  const ayrim = kdvAyir(veri.tutar, veri.kdvOrani);
  return db.gider.create({
    data: {
      kategori: veri.kategori,
      tutar: ayrim.brut,
      kdvOrani: veri.kdvOrani,
      kdvTutari: ayrim.kdv,
      aciklama: veri.aciklama ?? null,
      tarih: veri.tarih,
      belgeUrl: belge?.anahtar ?? null,
      belgeAdi: belge?.ad ?? null,
    },
    select: { id: true },
  });
}

/**
 * Gideri günceller. Yeni belge yüklendiyse eskisi depodan silinir — yetim
 * dosya bırakmamak için.
 */
export async function giderGuncelle(
  id: string,
  veri: GiderYaziVerisi,
  belge: { anahtar: string; ad: string } | undefined,
  db: Db = prisma
): Promise<void> {
  const mevcut = await db.gider.findUnique({
    where: { id },
    select: { belgeUrl: true },
  });
  if (!mevcut) throw new Error("Gider bulunamadı.");

  const ayrim = kdvAyir(veri.tutar, veri.kdvOrani);
  await db.gider.update({
    where: { id },
    data: {
      kategori: veri.kategori,
      tutar: ayrim.brut,
      kdvOrani: veri.kdvOrani,
      kdvTutari: ayrim.kdv,
      aciklama: veri.aciklama ?? null,
      tarih: veri.tarih,
      ...(belge ? { belgeUrl: belge.anahtar, belgeAdi: belge.ad } : {}),
    },
  });

  if (belge && mevcut.belgeUrl && mevcut.belgeUrl !== belge.anahtar) {
    await belgeSil(mevcut.belgeUrl);
  }
}

/** Gideri ve varsa belgesini siler. */
export async function giderSil(id: string, db: Db = prisma): Promise<void> {
  const gider = await db.gider.findUnique({
    where: { id },
    select: { belgeUrl: true },
  });
  if (!gider) throw new Error("Gider bulunamadı.");

  await db.gider.delete({ where: { id } });
  if (gider.belgeUrl) await belgeSil(gider.belgeUrl);
}

/** Yalnızca belgeyi kaldırır, gider kaydı kalır. */
export async function giderBelgesiniKaldir(
  id: string,
  db: Db = prisma
): Promise<void> {
  const gider = await db.gider.findUnique({
    where: { id },
    select: { belgeUrl: true },
  });
  if (!gider) throw new Error("Gider bulunamadı.");

  await db.gider.update({
    where: { id },
    data: { belgeUrl: null, belgeAdi: null },
  });
  if (gider.belgeUrl) await belgeSil(gider.belgeUrl);
}

/** Belgeyi servis etmeden önce, kaydın gerçekten bu anahtara sahip olduğunu doğrular. */
export async function belgeAnahtariKullanimda(
  anahtar: string,
  db: Db = prisma
): Promise<boolean> {
  const sayi = await db.gider.count({ where: { belgeUrl: anahtar } });
  return sayi > 0;
}
