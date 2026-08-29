import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/money";
import {
  cariEtkisi,
  ciroEtkileri,
  ciroKontrol,
  durumDegisikligiKontrol,
  hesaplaTahsilat,
  sonrakiDurum,
  tahsilatKontrol,
  tahsilatMutabik,
  tersEtki,
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
  vadeTarihi: Date;
  aciklama?: string;
};

/**
 * Çek/senet kaydı cari bakiyesini DEĞİŞTİRMEZ — borç, para fiilen tahsil
 * edildikçe kapanır (bkz. lib/domain/cek-senet.ts bakiye modeli).
 */
export async function cekSenetOlustur(
  veri: CekSenetYaziVerisi,
  db: Db = prisma
): Promise<{ id: string }> {
  return db.cekSenet.create({
    data: {
      tip: veri.tip,
      yon: veri.yon,
      cariId: veri.cariId,
      tutar: roundMoney(veri.tutar).toString(),
      vadeTarihi: veri.vadeTarihi,
      aciklama: veri.aciklama ?? null,
    },
    select: { id: true },
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
      select: { tahsilEdilen: true, durum: true },
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
        vadeTarihi: veri.vadeTarihi,
        aciklama: veri.aciklama ?? null,
        // Tutar değişince tamamlanma durumu da değişebilir.
        durum: sonrakiDurum(mevcut.durum, yeniTutar, tahsilEdilen),
      },
    });
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

    const cari = await tx.cari.findUnique({
      where: { id: cekSenet.cariId },
      select: { bakiye: true },
    });
    if (!cari) throw new Error("Cari bulunamadı.");

    await tx.cari.update({
      where: { id: cekSenet.cariId },
      data: {
        bakiye: roundMoney(cari.bakiye)
          .plus(cariEtkisi(cekSenet.yon, tutar))
          .toString(),
      },
    });

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

    const cari = await tx.cari.findUnique({
      where: { id: cekSenet.cariId },
      select: { bakiye: true },
    });
    if (!cari) throw new Error("Cari bulunamadı.");

    await tx.cari.update({
      where: { id: cekSenet.cariId },
      data: {
        bakiye: roundMoney(cari.bakiye)
          .plus(tersEtki(cariEtkisi(cekSenet.yon, tutar)))
          .toString(),
      },
    });
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
      select: { tutar: true, tahsilEdilen: true, durum: true },
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

    await tx.cekSenet.update({ where: { id }, data: { durum } });
  });
}

/**
 * Çek/senedi siler. Tahsilatlar cascade ile silinir, fakat cari bakiyesine
 * yaptıkları etki ELLE geri alınmalıdır — cascade bakiyeyi bilmez.
 */
export async function cekSenetSil(id: string, db: Db = prisma): Promise<void> {
  await db.$transaction(async (tx) => {
    const cekSenet = await tx.cekSenet.findUnique({
      where: { id },
      select: {
        id: true,
        yon: true,
        cariId: true,
        tutar: true,
        durum: true,
        ciroEdilenCariId: true,
        tahsilatlar: { select: { tutar: true } },
      },
    });
    if (!cekSenet) throw new Error("Çek/senet bulunamadı.");

    const cari = await tx.cari.findUnique({
      where: { id: cekSenet.cariId },
      select: { bakiye: true },
    });
    if (!cari) throw new Error("Cari bulunamadı.");

    let bakiye = roundMoney(cari.bakiye);
    for (const t of cekSenet.tahsilatlar) {
      bakiye = bakiye.plus(tersEtki(cariEtkisi(cekSenet.yon, t.tutar.toString())));
    }

    // Ciro edilmiş çek siliniyorsa cironun HER İKİ tarafındaki etki de geri
    // alınmalı — cascade yalnızca satırları siler, bakiyeleri bilmez.
    if (cekSenet.durum === "CIRO_EDILDI" && cekSenet.ciroEdilenCariId) {
      const etkiler = ciroEtkileri(cekSenet.tutar.toString());
      bakiye = bakiye.plus(tersEtki(etkiler.verenCari));

      const hedef = await tx.cari.findUnique({
        where: { id: cekSenet.ciroEdilenCariId },
        select: { bakiye: true },
      });
      if (hedef) {
        await tx.cari.update({
          where: { id: cekSenet.ciroEdilenCariId },
          data: {
            bakiye: roundMoney(hedef.bakiye)
              .plus(tersEtki(etkiler.alanCari))
              .toString(),
          },
        });
      }
    }

    await tx.cekSenet.delete({ where: { id } });
    await tx.cari.update({
      where: { id: cekSenet.cariId },
      data: { bakiye: bakiye.toString() },
    });
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
 * Ciro edilen çek hiç tahsil edilmez ama değeri kullanılmıştır; bu yüzden
 * AYNI transaction içinde İKİ cari bakiyesi birden güncellenir:
 *  - çeki bize veren müşterinin borcu kapanır,
 *  - çeki devrettiğimiz tedarikçiye olan borcumuz azalır.
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

    const [veren, alan] = await Promise.all([
      tx.cari.findUnique({
        where: { id: cekSenet.cariId },
        select: { bakiye: true },
      }),
      tx.cari.findUnique({
        where: { id: hedefCariId },
        select: { bakiye: true },
      }),
    ]);
    if (!veren) throw new Error("Cari bulunamadı.");
    if (!alan) throw new Error("Ciro edilecek cari bulunamadı.");

    const etkiler = ciroEtkileri(cekSenet.tutar.toString());

    await tx.cekSenet.update({
      where: { id: cekSenetId },
      data: {
        durum: "CIRO_EDILDI",
        ciroEdilenCariId: hedefCariId,
        ciroTarihi: tarih,
      },
    });

    await tx.cari.update({
      where: { id: cekSenet.cariId },
      data: {
        bakiye: roundMoney(veren.bakiye).plus(etkiler.verenCari).toString(),
      },
    });
    await tx.cari.update({
      where: { id: hedefCariId },
      data: {
        bakiye: roundMoney(alan.bakiye).plus(etkiler.alanCari).toString(),
      },
    });
  });
}

/** Ciroyu geri alır: her iki cari bakiyesi de eski hâline döner. */
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

    const [veren, alan] = await Promise.all([
      tx.cari.findUnique({
        where: { id: cekSenet.cariId },
        select: { bakiye: true },
      }),
      tx.cari.findUnique({
        where: { id: cekSenet.ciroEdilenCariId },
        select: { bakiye: true },
      }),
    ]);
    if (!veren || !alan) throw new Error("Cari bulunamadı.");

    const etkiler = ciroEtkileri(cekSenet.tutar.toString());

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

    await tx.cari.update({
      where: { id: cekSenet.cariId },
      data: {
        bakiye: roundMoney(veren.bakiye)
          .plus(tersEtki(etkiler.verenCari))
          .toString(),
      },
    });
    await tx.cari.update({
      where: { id: cekSenet.ciroEdilenCariId },
      data: {
        bakiye: roundMoney(alan.bakiye)
          .plus(tersEtki(etkiler.alanCari))
          .toString(),
      },
    });
  });
}
