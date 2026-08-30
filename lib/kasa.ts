import { prisma } from "@/lib/prisma";
import type { Tx } from "@/lib/islem";
import { roundMoney } from "@/lib/money";
import {
  bakiyeMutabik,
  bakiyeUygula,
  hesaplaBakiye,
  isaretliTutar,
  tersTutar,
  tutarinYonu,
  yurutulenBakiyeler,
  type HareketYonu,
} from "@/lib/domain/kasa";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { HesapTipiValue } from "@/lib/validations/kasa";

export type Db = PrismaClient;

// Saf hesap mantığı lib/domain/kasa.ts içindedir (Prisma'sız, test edilebilir).
export {
  hesaplaBakiye,
  hesaplaHareketOzeti,
  yurutulenBakiyeler,
} from "@/lib/domain/kasa";
export type { HareketOzeti } from "@/lib/domain/kasa";

export const ACILIS_ACIKLAMASI = "Açılış bakiyesi";

/** RSC sınırından geçebilmesi için Decimal'ler string'e çevrilir. */
export type HesapSatiri = {
  id: string;
  ad: string;
  tip: HesapTipiValue;
  bakiye: string;
  aktif: boolean;
  hareketSayisi: number;
};

export type HareketSatiri = {
  id: string;
  /** İşaretli tutar: pozitif giriş, negatif çıkış. */
  tutar: string;
  yon: HareketYonu;
  aciklama: string | null;
  tarih: Date;
  /** Bu hareketten SONRAKİ bakiye (ekstre görünümü için). */
  yurutulenBakiye: string;
  /**
   * Hareketi üreten bir kayıt (tahsilat / fatura ödemesi / gider) var mı?
   * Varsa hareket tek başına silinemez; arayüz düğmeyi kapatır.
   */
  kaynakEtiketi: string | null;
};

export type HesapFiltre = {
  tip?: HesapTipiValue;
  pasifleriGoster?: boolean;
};

export async function listeleHesaplar(
  filtre: HesapFiltre = {},
  db: Db = prisma
): Promise<HesapSatiri[]> {
  const hesaplar = await db.kasaBanka.findMany({
    where: {
      ...(filtre.pasifleriGoster ? {} : { aktif: true }),
      ...(filtre.tip ? { tip: filtre.tip } : {}),
    },
    orderBy: [{ tip: "asc" }, { ad: "asc" }],
    include: { _count: { select: { hareketler: true } } },
  });

  return hesaplar.map((h) => ({
    id: h.id,
    ad: h.ad,
    tip: h.tip as HesapTipiValue,
    bakiye: roundMoney(h.bakiye).toString(),
    aktif: h.aktif,
    hareketSayisi: h._count.hareketler,
  }));
}

export async function getHesap(
  id: string,
  db: Db = prisma
): Promise<HesapSatiri | null> {
  const hesap = await db.kasaBanka.findUnique({
    where: { id },
    include: { _count: { select: { hareketler: true } } },
  });
  if (!hesap) return null;

  return {
    id: hesap.id,
    ad: hesap.ad,
    tip: hesap.tip as HesapTipiValue,
    bakiye: roundMoney(hesap.bakiye).toString(),
    aktif: hesap.aktif,
    hareketSayisi: hesap._count.hareketler,
  };
}

/**
 * Hesap ekstresi. Yürüyen bakiye eskiden yeniye hesaplanır, sonuç ise
 * ekranda okunaklı olsun diye yeniden eskiye döner.
 */
export async function listeleHareketler(
  hesapId: string,
  db: Db = prisma
): Promise<HareketSatiri[]> {
  const hareketler = await db.hesapHareketi.findMany({
    where: { hesapId },
    // Aynı tarihli hareketlerde sıra kaymasın diye id ikincil sıralama.
    orderBy: [{ tarih: "asc" }, { id: "asc" }],
    include: {
      odeme: { select: { id: true } },
      tahsilat: { select: { id: true } },
      gider: { select: { id: true } },
    },
  });

  const tutarlar = hareketler.map((h) => roundMoney(h.tutar).toString());
  const yuruyen = yurutulenBakiyeler(tutarlar);

  return hareketler
    .map((h, i) => ({
      id: h.id,
      tutar: tutarlar[i],
      yon: tutarinYonu(tutarlar[i]),
      aciklama: h.aciklama,
      tarih: h.tarih,
      yurutulenBakiye: yuruyen[i],
      kaynakEtiketi: h.odeme
        ? "fatura ödemesi"
        : h.tahsilat
          ? "çek/senet tahsilatı"
          : h.gider
            ? "gider kaydı"
            : null,
    }))
    .reverse();
}

/**
 * Hesap oluşturur. Açılış bakiyesi varsa DOĞRUDAN `bakiye` alanına yazılmaz;
 * bir açılış hareketi olarak kaydedilir. Böylece
 * `bakiye = Σ hareket.tutar` değişmezi ilk andan itibaren geçerlidir.
 */
export async function hesapOlustur(
  veri: {
    ad: string;
    tip: HesapTipiValue;
    acilisBakiyesi: string;
    acilisTarihi: Date;
  },
  db: Db = prisma
): Promise<{ id: string }> {
  const acilis = roundMoney(veri.acilisBakiyesi);

  return db.$transaction(async (tx) => {
    const hesap = await tx.kasaBanka.create({
      data: { ad: veri.ad, tip: veri.tip, bakiye: "0" },
      select: { id: true },
    });

    if (!acilis.isZero()) {
      await tx.hesapHareketi.create({
        data: {
          hesapId: hesap.id,
          tutar: acilis.toString(),
          aciklama: ACILIS_ACIKLAMASI,
          tarih: veri.acilisTarihi,
        },
      });
      await tx.kasaBanka.update({
        where: { id: hesap.id },
        data: { bakiye: acilis.toString() },
      });
    }

    return hesap;
  });
}

export async function hesapGuncelle(
  id: string,
  veri: { ad: string; tip: HesapTipiValue },
  db: Db = prisma
): Promise<void> {
  await db.kasaBanka.update({
    where: { id },
    data: { ad: veri.ad, tip: veri.tip },
  });
}

/**
 * Hareket ekler ve hesap bakiyesini AYNI transaction içinde günceller.
 * Bakiye, mevcut değere işaretli tutar eklenerek Decimal ile hesaplanır —
 * SQL SUM() kullanılmaz, çünkü SQLite'ta float aritmetiğine düşer.
 */
export type HareketGirdisi = {
  yon: HareketYonu;
  tutar: string;
  aciklama?: string;
  tarih: Date;
};

/**
 * Hareket yazımının transaction İÇİ gövdesi.
 *
 * Ayrı durmasının nedeni: tahsilat, fatura ödemesi ve gider kendi
 * transaction'larında hem kendi kaydını hem kasa hareketini yazmak zorunda.
 * Prisma'da transaction iç içe açılamadığı için `hareketEkle` doğrudan
 * çağrılamıyordu. Mantık burada tek yerde durur; tüm çağıranlar aynı işaret ve
 * bakiye kurallarını kullanır.
 */
export async function hareketYaz(
  tx: Tx,
  hesapId: string,
  veri: HareketGirdisi
): Promise<{ id: string }> {
  const tutar = isaretliTutar(veri.yon, veri.tutar);

  const hesap = await tx.kasaBanka.findUnique({
    where: { id: hesapId },
    select: { bakiye: true },
  });
  if (!hesap) throw new Error("Hesap bulunamadı.");

  const hareket = await tx.hesapHareketi.create({
    data: {
      hesapId,
      tutar,
      aciklama: veri.aciklama ?? null,
      tarih: veri.tarih,
    },
    select: { id: true },
  });

  await tx.kasaBanka.update({
    where: { id: hesapId },
    data: { bakiye: bakiyeUygula(hesap.bakiye, tutar) },
  });

  return hareket;
}

/**
 * Kaynak kaydına bağlı hareketi siler ve bakiyeyi geri alır.
 * `hareketId` boşsa (kullanıcı hesap seçmemişti) hiçbir şey yapmaz.
 */
export async function hareketSilTx(
  tx: Tx,
  hareketId: string | null | undefined
): Promise<void> {
  if (!hareketId) return;

  const hareket = await tx.hesapHareketi.findUnique({
    where: { id: hareketId },
    select: { tutar: true, hesapId: true },
  });
  if (!hareket) return;

  const hesap = await tx.kasaBanka.findUnique({
    where: { id: hareket.hesapId },
    select: { bakiye: true },
  });
  if (!hesap) throw new Error("Hesap bulunamadı.");

  await tx.hesapHareketi.delete({ where: { id: hareketId } });
  await tx.kasaBanka.update({
    where: { id: hareket.hesapId },
    data: {
      bakiye: bakiyeUygula(hesap.bakiye, tersTutar(hareket.tutar.toString())),
    },
  });
}

export async function hareketEkle(
  hesapId: string,
  veri: HareketGirdisi,
  db: Db = prisma
): Promise<{ id: string }> {
  return db.$transaction((tx) => hareketYaz(tx, hesapId, veri));
}

/**
 * Elle girilen hareketi siler ve bakiyeye ters tutarı uygular.
 *
 * Kaynağı olan hareket (tahsilat, fatura ödemesi, gider) buradan SİLİNEMEZ:
 * silinseydi tahsilat kaydı dururken parası kasadan kaybolur, hesap bakiyesi
 * ile kaynak kayıtlar ayrışırdı. Doğru aksiyon, kaynağın kendisini silmektir.
 */
export async function hareketSil(
  hareketId: string,
  db: Db = prisma
): Promise<void> {
  await db.$transaction(async (tx) => {
    const hareket = await tx.hesapHareketi.findUnique({
      where: { id: hareketId },
      select: {
        id: true,
        tutar: true,
        hesapId: true,
        odeme: { select: { id: true } },
        tahsilat: { select: { id: true } },
        gider: { select: { id: true } },
      },
    });
    if (!hareket) throw new Error("Hareket bulunamadı.");

    const kaynak = hareket.odeme
      ? "fatura ödemesinden"
      : hareket.tahsilat
        ? "çek/senet tahsilatından"
        : hareket.gider
          ? "gider kaydından"
          : null;
    if (kaynak) {
      throw new Error(
        `Bu hareket ${kaynak} doğdu ve tek başına silinemez; ilgili kaydı silin.`
      );
    }

    const hesap = await tx.kasaBanka.findUnique({
      where: { id: hareket.hesapId },
      select: { bakiye: true },
    });
    if (!hesap) throw new Error("Hesap bulunamadı.");

    await tx.hesapHareketi.delete({ where: { id: hareketId } });
    await tx.kasaBanka.update({
      where: { id: hareket.hesapId },
      data: {
        bakiye: bakiyeUygula(hesap.bakiye, tersTutar(hareket.tutar.toString())),
      },
    });
  });
}

/**
 * Muhasebe kuralı: hareketi olan hesap SİLİNEMEZ (şemada onDelete: Restrict);
 * doğru aksiyon pasife almaktır — Cari ile aynı kural.
 */
export async function hesapSilinebilirMi(
  id: string,
  db: Db = prisma
): Promise<{ silinebilir: boolean; hareketSayisi: number }> {
  const hareketSayisi = await db.hesapHareketi.count({ where: { hesapId: id } });
  return { silinebilir: hareketSayisi === 0, hareketSayisi };
}

export async function hesapSil(id: string, db: Db = prisma): Promise<void> {
  await db.kasaBanka.delete({ where: { id } });
}

export async function setHesapAktif(
  id: string,
  aktif: boolean,
  db: Db = prisma
): Promise<void> {
  await db.kasaBanka.update({ where: { id }, data: { aktif } });
}

/**
 * Mutabakat: saklanan bakiye, hareketlerden yeniden hesaplananla aynı mı?
 * Bakiye ayrı bir alanda tutulduğu için sapma ihtimali vardır; bu fonksiyon
 * sapmayı görünür kılar ve testlerde değişmezin doğrulanmasını sağlar.
 */
export async function hesapBakiyesiniDogrula(
  id: string,
  db: Db = prisma
): Promise<{ mutabik: boolean; saklanan: string; hesaplanan: string }> {
  const [hesap, hareketler] = await Promise.all([
    db.kasaBanka.findUnique({ where: { id }, select: { bakiye: true } }),
    db.hesapHareketi.findMany({ where: { hesapId: id }, select: { tutar: true } }),
  ]);
  if (!hesap) throw new Error("Hesap bulunamadı.");

  const tutarlar = hareketler.map((h) => h.tutar.toString());
  return {
    mutabik: bakiyeMutabik(hesap.bakiye.toString(), tutarlar),
    saklanan: roundMoney(hesap.bakiye).toString(),
    hesaplanan: hesaplaBakiye(tutarlar),
  };
}

/** Tüm hesapların toplam bakiyesi — kasa ve banka ayrı ayrı. */
export function hesaplaHesapOzeti(hesaplar: HesapSatiri[]) {
  const kasa = hesaplar.filter((h) => h.tip === "KASA").map((h) => h.bakiye);
  const banka = hesaplar.filter((h) => h.tip === "BANKA").map((h) => h.bakiye);
  return {
    kasaToplami: hesaplaBakiye(kasa),
    bankaToplami: hesaplaBakiye(banka),
    genelToplam: hesaplaBakiye(hesaplar.map((h) => h.bakiye)),
  };
}
