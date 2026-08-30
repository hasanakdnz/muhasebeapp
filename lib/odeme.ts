import { prisma } from "@/lib/prisma";
import { hareketSilTx, hareketYaz } from "@/lib/kasa";
import { odemeHareketYonu } from "@/lib/domain/kasa";
import { roundMoney, toDecimal } from "@/lib/money";
import {
  odemeCariEtkisi,
  odemeKontrol,
  odemeMutabik,
  sonrakiStatus,
  tahsilatDagitilabilirKalan,
  tahsilatDagitimKontrol,
  type OdemeKaynagiValue,
  type OdemeStatusuValue,
} from "@/lib/domain/odeme";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

export {
  hesaplaOdeme,
  odemeCariEtkisi,
  odemeKontrol,
  sonrakiStatus,
  tahsilatDagitilabilirKalan,
  ODEME_KAYNAKLARI,
  ODEME_KAYNAK_ETIKETI,
  ODEME_STATUS_ETIKETI,
} from "@/lib/domain/odeme";
export type { OdemeKaynagiValue, OdemeStatusuValue } from "@/lib/domain/odeme";

export type OdemeSatiri = {
  id: string;
  tutar: string;
  tarih: Date;
  kaynak: OdemeKaynagiValue;
  aciklama: string | null;
  /** Kaynak çek tahsilatıysa ilgili çek/senedin kimliği ve açıklaması. */
  cekSenetId: string | null;
  cekSenetAciklamasi: string | null;
};

export async function listeleOdemeler(
  islemId: string,
  db: Db = prisma
): Promise<OdemeSatiri[]> {
  const odemeler = await db.islemOdeme.findMany({
    where: { islemId },
    orderBy: [{ tarih: "asc" }, { id: "asc" }],
    include: {
      cekSenetTahsilat: {
        select: {
          cekSenet: { select: { id: true, aciklama: true, vadeTarihi: true } },
        },
      },
    },
  });

  return odemeler.map((o) => ({
    id: o.id,
    tutar: roundMoney(o.tutar).toString(),
    tarih: o.tarih,
    kaynak: o.kaynak,
    aciklama: o.aciklama,
    cekSenetId: o.cekSenetTahsilat?.cekSenet.id ?? null,
    cekSenetAciklamasi: o.cekSenetTahsilat?.cekSenet.aciklama ?? null,
  }));
}

export type KullanilabilirTahsilat = {
  tahsilatId: string;
  cekSenetId: string;
  cekSenetAciklamasi: string | null;
  tahsilatTarihi: Date;
  tahsilatTutari: string;
  /** Henüz hiçbir faturaya sayılmamış kısım. */
  dagitilabilir: string;
};

/**
 * Bu cariye ait çek tahsilatlarından, henüz faturalara dağıtılmamış kısmı
 * olanlar. Fatura ödemesini çek tahsilatına bağlarken kullanılır.
 */
export async function kullanilabilirTahsilatlar(
  cariId: string,
  db: Db = prisma
): Promise<KullanilabilirTahsilat[]> {
  const tahsilatlar = await db.cekSenetTahsilat.findMany({
    where: { cekSenet: { cariId } },
    orderBy: [{ tarih: "desc" }, { id: "desc" }],
    include: {
      cekSenet: { select: { id: true, aciklama: true } },
      islemOdemeleri: { select: { tutar: true } },
    },
  });

  return tahsilatlar
    .map((t) => ({
      tahsilatId: t.id,
      cekSenetId: t.cekSenet.id,
      cekSenetAciklamasi: t.cekSenet.aciklama,
      tahsilatTarihi: t.tarih,
      tahsilatTutari: roundMoney(t.tutar).toString(),
      dagitilabilir: tahsilatDagitilabilirKalan(
        t.tutar.toString(),
        t.islemOdemeleri.map((o) => o.tutar.toString())
      ),
    }))
    .filter((t) => toDecimal(t.dagitilabilir).greaterThan(0));
}

export type OdemeYaziVerisi = {
  tutar: string;
  tarih: Date;
  kaynak: OdemeKaynagiValue;
  /** Kaynak CEK_TAHSILATI ise zorunlu. */
  cekSenetTahsilatId?: string;
  /**
   * Paranın gireceği/çıkacağı kasa/banka hesabı. YALNIZCA DIREKT ödemede
   * anlamlıdır: çek tahsilatından doğan ödemede para kasaya tahsilat
   * kaydedilirken zaten girmiştir, ikinci kez girseydi kasa şişerdi.
   */
  hesapId?: string;
  aciklama?: string;
};

/**
 * Fatura ödemesi kaydeder.
 *
 * AYNI transaction içinde:
 *  1. Ödeme kaydı oluşturulur,
 *  2. Islem.odenenTutar ve status güncellenir,
 *  3. Cari bakiyesi — YALNIZCA kaynak DIREKT ise — güncellenir.
 *
 * (3)'teki koşul kritiktir: çek tahsilatından gelen para bakiyeden zaten
 * düşülmüştür, burada tekrar düşülseydi çift sayım olurdu.
 */
export async function odemeEkle(
  islemId: string,
  veri: OdemeYaziVerisi,
  db: Db = prisma
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const islem = await tx.islem.findUnique({
      where: { id: islemId },
      select: {
        id: true,
        tip: true,
        cariId: true,
        toplamTutar: true,
        odenenTutar: true,
        status: true,
      },
    });
    if (!islem) throw new Error("İşlem bulunamadı.");

    const kontrol = odemeKontrol(
      {
        toplamTutar: islem.toplamTutar.toString(),
        odenenTutar: islem.odenenTutar.toString(),
        status: islem.status,
      },
      veri.tutar
    );
    if (!kontrol.gecerli) throw new Error(kontrol.hata);

    if (veri.kaynak === "CEK_TAHSILATI") {
      if (!veri.cekSenetTahsilatId) {
        throw new Error("Çek tahsilatı seçin.");
      }
      const tahsilat = await tx.cekSenetTahsilat.findUnique({
        where: { id: veri.cekSenetTahsilatId },
        select: {
          tutar: true,
          cekSenet: { select: { cariId: true } },
          islemOdemeleri: { select: { tutar: true } },
        },
      });
      if (!tahsilat) throw new Error("Tahsilat bulunamadı.");
      if (tahsilat.cekSenet.cariId !== islem.cariId) {
        throw new Error("Tahsilat, işlemin carisine ait değil.");
      }

      const dagitim = tahsilatDagitimKontrol(
        tahsilat.tutar.toString(),
        tahsilat.islemOdemeleri.map((o) => o.tutar.toString()),
        veri.tutar
      );
      if (!dagitim.gecerli) throw new Error(dagitim.hata);
    }

    const tutar = roundMoney(veri.tutar);

    // Kasa hareketi yalnızca DIREKT ödemede oluşur — çek tahsilatından doğan
    // ödemede para kasaya tahsilat anında girmişti.
    const hareket =
      veri.kaynak === "DIREKT" && veri.hesapId
        ? await hareketYaz(tx, veri.hesapId, {
            yon: odemeHareketYonu(islem.tip),
            tutar: tutar.toString(),
            tarih: veri.tarih,
            aciklama: veri.aciklama ?? "Fatura ödemesi",
          })
        : null;

    const odeme = await tx.islemOdeme.create({
      data: {
        islemId,
        tutar: tutar.toString(),
        tarih: veri.tarih,
        kaynak: veri.kaynak,
        cekSenetTahsilatId:
          veri.kaynak === "CEK_TAHSILATI" ? veri.cekSenetTahsilatId : null,
        hesapHareketiId: hareket?.id ?? null,
        aciklama: veri.aciklama ?? null,
      },
      select: { id: true },
    });

    const yeniOdenen = roundMoney(islem.odenenTutar).plus(tutar);
    await tx.islem.update({
      where: { id: islemId },
      data: {
        odenenTutar: yeniOdenen.toString(),
        status: sonrakiStatus(
          islem.status,
          islem.toplamTutar.toString(),
          yeniOdenen
        ),
      },
    });

    const etki = odemeCariEtkisi(islem.tip, veri.kaynak, tutar);
    if (!toDecimal(etki).isZero()) {
      const cari = await tx.cari.findUnique({
        where: { id: islem.cariId },
        select: { bakiye: true },
      });
      if (!cari) throw new Error("Cari bulunamadı.");
      await tx.cari.update({
        where: { id: islem.cariId },
        data: { bakiye: roundMoney(cari.bakiye).plus(etki).toString() },
      });
    }

    return odeme;
  });
}

/** Ödemeyi siler; fatura durumu ve (direkt ödemeyse) cari bakiyesi geri alınır. */
export async function odemeSil(
  odemeId: string,
  db: Db = prisma
): Promise<void> {
  await db.$transaction(async (tx) => {
    const odeme = await tx.islemOdeme.findUnique({
      where: { id: odemeId },
      select: {
        id: true,
        tutar: true,
        kaynak: true,
        hesapHareketiId: true,
        islem: {
          select: {
            id: true,
            tip: true,
            cariId: true,
            toplamTutar: true,
            odenenTutar: true,
            status: true,
          },
        },
      },
    });
    if (!odeme) throw new Error("Ödeme bulunamadı.");

    const { islem } = odeme;
    const tutar = roundMoney(odeme.tutar);

    await tx.islemOdeme.delete({ where: { id: odemeId } });
    // Kasadaki karşılığı da gider.
    await hareketSilTx(tx, odeme.hesapHareketiId);

    const yeniOdenen = roundMoney(islem.odenenTutar).minus(tutar);
    await tx.islem.update({
      where: { id: islem.id },
      data: {
        odenenTutar: yeniOdenen.toString(),
        status: sonrakiStatus(
          islem.status,
          islem.toplamTutar.toString(),
          yeniOdenen
        ),
      },
    });

    const etki = odemeCariEtkisi(islem.tip, odeme.kaynak, tutar);
    if (!toDecimal(etki).isZero()) {
      const cari = await tx.cari.findUnique({
        where: { id: islem.cariId },
        select: { bakiye: true },
      });
      if (!cari) throw new Error("Cari bulunamadı.");
      // Ters etki uygulanır.
      await tx.cari.update({
        where: { id: islem.cariId },
        data: {
          bakiye: roundMoney(cari.bakiye).minus(etki).toString(),
        },
      });
    }
  });
}

/** Mutabakat: saklanan odenenTutar ve status, ödeme kayıtlarıyla tutuyor mu? */
export async function islemOdemesiniDogrula(
  islemId: string,
  db: Db = prisma
): Promise<{
  mutabik: boolean;
  saklanan: string;
  hesaplanan: string;
  statusDogruMu: boolean;
  status: OdemeStatusuValue;
}> {
  const islem = await db.islem.findUnique({
    where: { id: islemId },
    select: {
      toplamTutar: true,
      odenenTutar: true,
      status: true,
      odemeler: { select: { tutar: true } },
    },
  });
  if (!islem) throw new Error("İşlem bulunamadı.");

  const tutarlar = islem.odemeler.map((o) => o.tutar.toString());
  let toplam = toDecimal(0);
  for (const t of tutarlar) toplam = toplam.plus(roundMoney(t));

  const beklenenStatus = sonrakiStatus(
    islem.status,
    islem.toplamTutar.toString(),
    islem.odenenTutar.toString()
  );

  return {
    mutabik: odemeMutabik(islem.odenenTutar.toString(), tutarlar),
    saklanan: roundMoney(islem.odenenTutar).toString(),
    hesaplanan: toplam.toString(),
    statusDogruMu: islem.status === beklenenStatus,
    status: islem.status,
  };
}
