import { prisma } from "@/lib/prisma";
import { cariBakiyesiniYenile } from "@/lib/cari";
import { roundMoney } from "@/lib/money";
import {
  ciroKontrol,
  durumDegisikligiKontrol,
  hesaplaTahsilat,
  sonrakiDurum,
  tahsilatKontrol,
  tahsilatMutabik,
  type CekSenetDurumuValue,
  type CekSenetTipiValue,
  type CekSenetYonuValue,
} from "@/lib/domain/cek-senet";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

// Saf tahsilat/durum mantığı lib/domain/cek-senet.ts içindedir.
export {
  hesaplaPortfoyOzeti,
  hesaplaTahsilat,
  tahsilatKontrol,
} from "@/lib/domain/cek-senet";

/** RSC sınırından geçebilmesi için Decimal'ler string'e çevrilir. */
export type CekSenetSatiri = {
  id: string;
  tip: CekSenetTipiValue;
  yon: CekSenetYonuValue;
  cariId: string;
  cariUnvan: string;
  tutar: string;
  tahsilEdilen: string;
  kalan: string;
  /** Çekin alındığı/verildiği tarih (vade değil). */
  tarih: Date;
  vadeTarihi: Date;
  durum: CekSenetDurumuValue;
  aciklama: string | null;
  ciroEdilenCariId: string | null;
  ciroEdilenCariUnvan: string | null;
  ciroTarihi: Date | null;
};

export type TahsilatSatiri = {
  id: string;
  tutar: string;
  tarih: Date;
  aciklama: string | null;
};

export type CekSenetDetay = CekSenetSatiri & {
  tahsilatlar: TahsilatSatiri[];
};

export type CekSenetFiltre = {
  tip?: CekSenetTipiValue;
  yon?: CekSenetYonuValue;
  durum?: CekSenetDurumuValue;
  cariId?: string;
};

function satiraCevir(kayit: {
  id: string;
  tip: CekSenetTipiValue;
  yon: CekSenetYonuValue;
  cariId: string;
  cari: { unvan: string };
  tutar: unknown;
  tahsilEdilen: unknown;
  tarih: Date;
  vadeTarihi: Date;
  durum: CekSenetDurumuValue;
  aciklama: string | null;
  ciroEdilenCariId: string | null;
  ciroEdilenCari: { unvan: string } | null;
  ciroTarihi: Date | null;
}): CekSenetSatiri {
  const tutar = roundMoney(String(kayit.tutar));
  const tahsilEdilen = roundMoney(String(kayit.tahsilEdilen));
  return {
    id: kayit.id,
    tip: kayit.tip,
    yon: kayit.yon,
    cariId: kayit.cariId,
    cariUnvan: kayit.cari.unvan,
    tutar: tutar.toString(),
    tahsilEdilen: tahsilEdilen.toString(),
    kalan: tutar.minus(tahsilEdilen).toString(),
    tarih: kayit.tarih,
    vadeTarihi: kayit.vadeTarihi,
    durum: kayit.durum,
    aciklama: kayit.aciklama,
    ciroEdilenCariId: kayit.ciroEdilenCariId,
    ciroEdilenCariUnvan: kayit.ciroEdilenCari?.unvan ?? null,
    ciroTarihi: kayit.ciroTarihi,
  };
}

export async function listeleCekSenetler(
  filtre: CekSenetFiltre = {},
  db: Db = prisma
): Promise<CekSenetSatiri[]> {
  const kayitlar = await db.cekSenet.findMany({
    where: {
      ...(filtre.tip ? { tip: filtre.tip } : {}),
      ...(filtre.yon ? { yon: filtre.yon } : {}),
      ...(filtre.durum ? { durum: filtre.durum } : {}),
      ...(filtre.cariId ? { cariId: filtre.cariId } : {}),
    },
    orderBy: [{ vadeTarihi: "asc" }, { id: "asc" }],
    include: {
      cari: { select: { unvan: true } },
      ciroEdilenCari: { select: { unvan: true } },
    },
  });
  return kayitlar.map(satiraCevir);
}

export async function getCekSenet(
  id: string,
  db: Db = prisma
): Promise<CekSenetDetay | null> {
  const kayit = await db.cekSenet.findUnique({
    where: { id },
    include: {
      cari: { select: { unvan: true } },
      ciroEdilenCari: { select: { unvan: true } },
      tahsilatlar: { orderBy: [{ tarih: "asc" }, { id: "asc" }] },
    },
  });
  if (!kayit) return null;

  return {
    ...satiraCevir(kayit),
    tahsilatlar: kayit.tahsilatlar.map((t) => ({
      id: t.id,
      tutar: roundMoney(t.tutar).toString(),
      tarih: t.tarih,
      aciklama: t.aciklama,
    })),
  };
}

export type CekSenetYaziVerisi = {
  tip: CekSenetTipiValue;
  yon: CekSenetYonuValue;
  cariId: string;
  tutar: string;
  /** Çekin alındığı/verildiği tarih; verilmezse bugün. */
  tarih?: Date;
  vadeTarihi: Date;
  aciklama?: string;
};

/**
 * Çek/senet kaydeder ve cari bakiyesini AYNI transaction içinde günceller:
 * çek ele geçtiği anda ilgili borç kapanır (bkz. lib/domain/cek-senet.ts).
 */
export async function cekSenetOlustur(
  veri: CekSenetYaziVerisi,
  db: Db = prisma
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const kayit = await tx.cekSenet.create({
      data: {
        tip: veri.tip,
        yon: veri.yon,
        cariId: veri.cariId,
        tutar: roundMoney(veri.tutar).toString(),
        tarih: veri.tarih ?? new Date(),
        vadeTarihi: veri.vadeTarihi,
        aciklama: veri.aciklama ?? null,
      },
      select: { id: true },
    });

    await cariBakiyesiniYenile(veri.cariId, tx);
    return kayit;
  });
}

/**
 * Çek/senedi günceller. Tutar küçültülürse mevcut tahsilatların altına
 * düşemez — aksi halde tahsilEdilen > tutar olur ve kalan negatife geçerdi.
 */
export async function cekSenetGuncelle(
  id: string,
  veri: CekSenetYaziVerisi,
  db: Db = prisma
): Promise<void> {
  await db.$transaction(async (tx) => {
    const mevcut = await tx.cekSenet.findUnique({
      where: { id },
      select: { tahsilEdilen: true, durum: true, cariId: true },
    });
    if (!mevcut) throw new Error("Çek/senet bulunamadı.");

    const yeniTutar = roundMoney(veri.tutar);
    const tahsilEdilen = roundMoney(mevcut.tahsilEdilen);
    if (yeniTutar.lessThan(tahsilEdilen)) {
      throw new Error(
        `Tutar, tahsil edilen tutarın (${tahsilEdilen.toString()}) altına düşürülemez.`
      );
    }

    await tx.cekSenet.update({
      where: { id },
      data: {
        tip: veri.tip,
        yon: veri.yon,
        cariId: veri.cariId,
        tutar: yeniTutar.toString(),
        ...(veri.tarih ? { tarih: veri.tarih } : {}),
        vadeTarihi: veri.vadeTarihi,
        aciklama: veri.aciklama ?? null,
        // Tutar değişince tamamlanma durumu da değişebilir.
        durum: sonrakiDurum(mevcut.durum, yeniTutar, tahsilEdilen),
      },
    });

    // Tutar, yön veya cari değişmiş olabilir; ESKİ cari de yeniden hesaplanır,
    // aksi halde çek başka cariye taşındığında eskisinde etki asılı kalırdı.
    await cariBakiyesiniYenile(veri.cariId, tx);
    if (mevcut.cariId !== veri.cariId) {
      await cariBakiyesiniYenile(mevcut.cariId, tx);
    }
  });
}

/**
 * Tahsilat kaydeder ve AYNI transaction içinde tahsilEdilen, durum ve cari
 * bakiyesini günceller. Fazla tahsilat alan katmanında engellenir.
 */
export async function tahsilatEkle(
  cekSenetId: string,
  veri: { tutar: string; tarih: Date; aciklama?: string },
  db: Db = prisma
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const cekSenet = await tx.cekSenet.findUnique({
      where: { id: cekSenetId },
      select: {
        id: true,
        yon: true,
        cariId: true,
        tutar: true,
        tahsilEdilen: true,
        durum: true,
      },
    });
    if (!cekSenet) throw new Error("Çek/senet bulunamadı.");

    const kontrol = tahsilatKontrol(
      {
        tutar: cekSenet.tutar.toString(),
        tahsilEdilen: cekSenet.tahsilEdilen.toString(),
        durum: cekSenet.durum,
      },
      veri.tutar
    );
    if (!kontrol.gecerli) throw new Error(kontrol.hata);

    const tutar = roundMoney(veri.tutar);
    const tahsilat = await tx.cekSenetTahsilat.create({
      data: {
        cekSenetId,
        tutar: tutar.toString(),
        tarih: veri.tarih,
        aciklama: veri.aciklama ?? null,
      },
      select: { id: true },
    });

    const yeniTahsilEdilen = roundMoney(cekSenet.tahsilEdilen).plus(tutar);
    await tx.cekSenet.update({
      where: { id: cekSenetId },
      data: {
        tahsilEdilen: yeniTahsilEdilen.toString(),
        durum: sonrakiDurum(cekSenet.durum, cekSenet.tutar.toString(), yeniTahsilEdilen),
      },
    });

    // Tahsilat cari bakiyesine DOKUNMAZ: borç, çek ele geçtiğinde zaten
    // kapandı. Yine de yeniden hesaplanır — kayıt KARSILIKSIZ ise etkin tutar
    // tahsil edilene bağlıdır ve tahsilat onu değiştirir.
    await cariBakiyesiniYenile(cekSenet.cariId, tx);

    return tahsilat;
  });
}

/** Tahsilatı siler; tahsilEdilen, durum ve cari bakiyesi geri alınır. */
export async function tahsilatSil(
  tahsilatId: string,
  db: Db = prisma
): Promise<void> {
  await db.$transaction(async (tx) => {
    const tahsilat = await tx.cekSenetTahsilat.findUnique({
      where: { id: tahsilatId },
      select: {
        id: true,
        tutar: true,
        cekSenet: {
          select: {
            id: true,
            yon: true,
            cariId: true,
            tutar: true,
            tahsilEdilen: true,
            durum: true,
          },
        },
      },
    });
    if (!tahsilat) throw new Error("Tahsilat bulunamadı.");

    const { cekSenet } = tahsilat;
    const tutar = roundMoney(tahsilat.tutar);

    await tx.cekSenetTahsilat.delete({ where: { id: tahsilatId } });

    const yeniTahsilEdilen = roundMoney(cekSenet.tahsilEdilen).minus(tutar);
    await tx.cekSenet.update({
      where: { id: cekSenet.id },
      data: {
        tahsilEdilen: yeniTahsilEdilen.toString(),
        durum: sonrakiDurum(cekSenet.durum, cekSenet.tutar.toString(), yeniTahsilEdilen),
      },
    });

    await cariBakiyesiniYenile(cekSenet.cariId, tx);
  });
}

/** Elle durum değişikliği (karşılıksız / ciro edildi / portföye dönüş). */
export async function durumDegistir(
  id: string,
  yeniDurum: CekSenetDurumuValue,
  db: Db = prisma
): Promise<void> {
  await db.$transaction(async (tx) => {
    const cekSenet = await tx.cekSenet.findUnique({
      where: { id },
      select: { tutar: true, tahsilEdilen: true, durum: true, cariId: true },
    });
    if (!cekSenet) throw new Error("Çek/senet bulunamadı.");

    const kontrol = durumDegisikligiKontrol(
      {
        tahsilEdilen: cekSenet.tahsilEdilen.toString(),
        durum: cekSenet.durum,
      },
      yeniDurum
    );
    if (!kontrol.gecerli) throw new Error(kontrol.hata);

    // PORTFOYDE'ye dönüşte, tahsilatlar tamamsa durum yine TAHSIL_EDILDI olur.
    const durum =
      yeniDurum === "PORTFOYDE"
        ? sonrakiDurum(
            "PORTFOYDE",
            cekSenet.tutar.toString(),
            cekSenet.tahsilEdilen.toString()
          )
        : yeniDurum;

    await tx.cekSenet.update({
      where: { id },
      data: {
        durum,
        // Geri dönüş satırının ekstrede sabit bir yeri olsun diye tarih
        // saklanır; updatedAt kullanılsaydı çekin herhangi bir alanı
        // düzenlendiğinde satır yer değiştirirdi.
        karsiliksizTarihi: durum === "KARSILIKSIZ" ? new Date() : null,
      },
    });

    // KARSILIKSIZ'a geçiş tahsil EDİLEMEYEN kısmı borç olarak geri getirir;
    // portföye dönüş bunu yeniden kapatır. İkisi de bakiyeyi değiştirir.
    await cariBakiyesiniYenile(cekSenet.cariId, tx);
  });
}

/**
 * Çek/senedi siler. Tahsilatlar cascade ile silinir; etkilenen carilerin
 * bakiyesi silmeden SONRA kaynaklardan yeniden hesaplanır — cascade bakiyeyi
 * bilmez. Ciro edilmiş çekte hedef cari de etkilenir, o da yenilenir.
 */
export async function cekSenetSil(id: string, db: Db = prisma): Promise<void> {
  await db.$transaction(async (tx) => {
    const cekSenet = await tx.cekSenet.findUnique({
      where: { id },
      select: { id: true, cariId: true, ciroEdilenCariId: true },
    });
    if (!cekSenet) throw new Error("Çek/senet bulunamadı.");

    await tx.cekSenet.delete({ where: { id } });

    await cariBakiyesiniYenile(cekSenet.cariId, tx);
    if (cekSenet.ciroEdilenCariId) {
      await cariBakiyesiniYenile(cekSenet.ciroEdilenCariId, tx);
    }
  });
}

/** Mutabakat: saklanan tahsilEdilen, tahsilat kayıtlarıyla tutuyor mu? */
export async function cekSenetiDogrula(
  id: string,
  db: Db = prisma
): Promise<{
  mutabik: boolean;
  saklanan: string;
  hesaplanan: string;
  durumDogruMu: boolean;
}> {
  const kayit = await db.cekSenet.findUnique({
    where: { id },
    select: {
      tutar: true,
      tahsilEdilen: true,
      durum: true,
      tahsilatlar: { select: { tutar: true } },
    },
  });
  if (!kayit) throw new Error("Çek/senet bulunamadı.");

  const tutarlar = kayit.tahsilatlar.map((t) => t.tutar.toString());
  const ozet = hesaplaTahsilat(kayit.tutar.toString(), tutarlar);
  const beklenenDurum = sonrakiDurum(
    kayit.durum,
    kayit.tutar.toString(),
    kayit.tahsilEdilen.toString()
  );

  return {
    mutabik: tahsilatMutabik(kayit.tahsilEdilen.toString(), tutarlar),
    saklanan: roundMoney(kayit.tahsilEdilen).toString(),
    hesaplanan: ozet.tahsilEdilen,
    durumDogruMu: kayit.durum === beklenenDurum,
  };
}

/**
 * Alınan çeki bir tedarikçiye ciro eder.
 *
 * Ciroda çek elimizden çıkar ve tedarikçiye olan borcumuz azalır. Çeki bize
 * VEREN müşterinin bakiyesi ciroda değişmez — onun borcu çeki verdiği anda
 * zaten kapanmıştı. Yine de her iki cari yeniden hesaplanır: hedef için etki
 * yeni doğar, veren için değişmediğini doğrulamak bedava gelir.
 */
export async function ciroEt(
  cekSenetId: string,
  hedefCariId: string,
  tarih: Date,
  db: Db = prisma
): Promise<void> {
  await db.$transaction(async (tx) => {
    const cekSenet = await tx.cekSenet.findUnique({
      where: { id: cekSenetId },
      select: {
        id: true,
        yon: true,
        durum: true,
        tahsilEdilen: true,
        cariId: true,
        tutar: true,
      },
    });
    if (!cekSenet) throw new Error("Çek/senet bulunamadı.");

    const kontrol = ciroKontrol(
      {
        yon: cekSenet.yon,
        durum: cekSenet.durum,
        tahsilEdilen: cekSenet.tahsilEdilen.toString(),
        cariId: cekSenet.cariId,
      },
      hedefCariId
    );
    if (!kontrol.gecerli) throw new Error(kontrol.hata);

    const alan = await tx.cari.findUnique({
      where: { id: hedefCariId },
      select: { id: true },
    });
    if (!alan) throw new Error("Ciro edilecek cari bulunamadı.");

    await tx.cekSenet.update({
      where: { id: cekSenetId },
      data: {
        durum: "CIRO_EDILDI",
        ciroEdilenCariId: hedefCariId,
        ciroTarihi: tarih,
      },
    });

    await cariBakiyesiniYenile(cekSenet.cariId, tx);
    await cariBakiyesiniYenile(hedefCariId, tx);
  });
}

/** Ciroyu geri alır: çek portföye döner, hedef cariye olan borcumuz geri gelir. */
export async function ciroGeriAl(
  cekSenetId: string,
  db: Db = prisma
): Promise<void> {
  await db.$transaction(async (tx) => {
    const cekSenet = await tx.cekSenet.findUnique({
      where: { id: cekSenetId },
      select: {
        id: true,
        durum: true,
        cariId: true,
        tutar: true,
        tahsilEdilen: true,
        ciroEdilenCariId: true,
      },
    });
    if (!cekSenet) throw new Error("Çek/senet bulunamadı.");
    if (cekSenet.durum !== "CIRO_EDILDI" || !cekSenet.ciroEdilenCariId) {
      throw new Error("Bu çek/senet ciro edilmemiş.");
    }

    const hedefCariId = cekSenet.ciroEdilenCariId;

    await tx.cekSenet.update({
      where: { id: cekSenetId },
      data: {
        durum: sonrakiDurum(
          "PORTFOYDE",
          cekSenet.tutar.toString(),
          cekSenet.tahsilEdilen.toString()
        ),
        ciroEdilenCariId: null,
        ciroTarihi: null,
      },
    });

    await cariBakiyesiniYenile(cekSenet.cariId, tx);
    await cariBakiyesiniYenile(hedefCariId, tx);
  });
}
