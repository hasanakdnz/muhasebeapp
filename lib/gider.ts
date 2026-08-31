import { prisma } from "@/lib/prisma";
import { hareketSilTx, hareketYaz } from "@/lib/kasa";
import { GIDER_HAREKET_YONU } from "@/lib/domain/kasa";
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
  /** Paranın çıktığı hesap; kasa hareketi oluşmadıysa null. */
  hesapId: string | null;
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
  hesapHareketi?: { hesapId: string } | null;
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
    hesapId: g.hesapHareketi?.hesapId ?? null,
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
    // hesapHareketi olmadan satiraCevir hesapId'yi HER satırda null döndürür;
    // "hesaba işlenmemiş" rozeti de her gideri işaretlerdi.
    include: { hesapHareketi: { select: { hesapId: true } } },
  });
  return giderler.map(satiraCevir);
}

export async function getGider(
  id: string,
  db: Db = prisma
): Promise<GiderSatiri | null> {
  const gider = await db.gider.findUnique({
    where: { id },
    include: { hesapHareketi: { select: { hesapId: true } } },
  });
  return gider ? satiraCevir(gider) : null;
}

export type GiderYaziVerisi = {
  kategori: string;
  /** KDV DAHİL tutar. */
  tutar: string;
  kdvOrani: string;
  aciklama?: string;
  tarih: Date;
  /** Paranın çıkacağı kasa/banka hesabı. Seçilmezse kasa hareketi oluşmaz. */
  hesapId?: string;
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

  return db.$transaction(async (tx) => {
    // Gider parası AYNI transaction'da kasadan çıkar; ayrı yazılsaydı biri
    // başarısız olduğunda gider kaydı ile kasa bakiyesi ayrışırdı.
    const hareket = veri.hesapId
      ? await hareketYaz(tx, veri.hesapId, {
          yon: GIDER_HAREKET_YONU,
          tutar: ayrim.brut,
          tarih: veri.tarih,
          aciklama: veri.aciklama ?? veri.kategori,
        })
      : null;

    return tx.gider.create({
      data: {
        kategori: veri.kategori,
        tutar: ayrim.brut,
        kdvOrani: veri.kdvOrani,
        kdvTutari: ayrim.kdv,
        aciklama: veri.aciklama ?? null,
        tarih: veri.tarih,
        belgeUrl: belge?.anahtar ?? null,
        belgeAdi: belge?.ad ?? null,
        hesapHareketiId: hareket?.id ?? null,
      },
      select: { id: true },
    });
  });
}

/**
 * Gideri günceller. Yeni belge yüklendiyse eskisi depodan silinir — yetim
 * dosya bırakmamak için.
 *
 * Kasa hareketi SİL-YENİDEN YAZ yöntemiyle güncellenir: tutar, tarih ve hesap
 * hepsi değişebilir, üstelik hesap eklenmiş ya da kaldırılmış olabilir. Tek
 * tek karşılaştırmak dört ayrı durum demekti; sil-yaz hepsini aynı yoldan
 * doğru sonuca götürür. Yerinde güncellenmeseydi tutarı değiştirilen giderin
 * kasadaki karşılığı eski tutarda kalır, bakiye sessizce yanlış olurdu.
 */
export async function giderGuncelle(
  id: string,
  veri: GiderYaziVerisi,
  belge: { anahtar: string; ad: string } | undefined,
  db: Db = prisma
): Promise<void> {
  const mevcut = await db.gider.findUnique({
    where: { id },
    select: { belgeUrl: true, hesapHareketiId: true },
  });
  if (!mevcut) throw new Error("Gider bulunamadı.");

  const ayrim = kdvAyir(veri.tutar, veri.kdvOrani);

  await db.$transaction(async (tx) => {
    await hareketSilTx(tx, mevcut.hesapHareketiId);

    const hareket = veri.hesapId
      ? await hareketYaz(tx, veri.hesapId, {
          yon: GIDER_HAREKET_YONU,
          tutar: ayrim.brut,
          tarih: veri.tarih,
          aciklama: veri.aciklama ?? veri.kategori,
        })
      : null;

    await tx.gider.update({
      where: { id },
      data: {
        kategori: veri.kategori,
        tutar: ayrim.brut,
        kdvOrani: veri.kdvOrani,
        kdvTutari: ayrim.kdv,
        aciklama: veri.aciklama ?? null,
        tarih: veri.tarih,
        hesapHareketiId: hareket?.id ?? null,
        ...(belge ? { belgeUrl: belge.anahtar, belgeAdi: belge.ad } : {}),
      },
    });
  });

  if (belge && mevcut.belgeUrl && mevcut.belgeUrl !== belge.anahtar) {
    await belgeSil(mevcut.belgeUrl);
  }
}

/** Gideri ve varsa belgesini siler. */
export async function giderSil(id: string, db: Db = prisma): Promise<void> {
  const gider = await db.gider.findUnique({
    where: { id },
    select: { belgeUrl: true, hesapHareketiId: true },
  });
  if (!gider) throw new Error("Gider bulunamadı.");

  await db.$transaction(async (tx) => {
    await tx.gider.delete({ where: { id } });
    // Kasadan çıkan para geri gelir; aksi halde gider kalkarken bakiye eksik
    // kalırdı.
    await hareketSilTx(tx, gider.hesapHareketiId);
  });

  // Dosya silme transaction DIŞINDA: geri alınamaz ve veritabanı işlemi
  // başarılı olmadan dokunulmamalı.
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

/**
 * Hesaba işlenmemiş gider sayısı.
 *
 * Gider kaydederken kasa/banka hesabı seçmek OPSİYONELDİR (hesap tanımlamamış
 * kullanıcı gider giremesin diye). Boş bırakılırsa gider KDV ve raporlara
 * girer ama kasadan para ÇIKMAZ: kullanıcı parayı harcamıştır, pano eski
 * rakamı gösterir ve bunu fark etmesinin bir yolu yoktur. Bu sayı o sessiz
 * eksiği görünür kılar.
 */
export async function hesabaIslenmemisGiderSayisi(
  db: Db = prisma
): Promise<number> {
  return db.gider.count({ where: { hesapHareketiId: null } });
}
