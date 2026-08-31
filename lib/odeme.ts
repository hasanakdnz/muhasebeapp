import { prisma } from "@/lib/prisma";
import { hareketSilTx, hareketYaz } from "@/lib/kasa";
import { odemeHareketYonu } from "@/lib/domain/kasa";
import { roundMoney, toDecimal } from "@/lib/money";
import {
  odemeCariEtkisi,
  odemeKontrol,
  odemeMutabik,
  sonrakiStatus,
  cekDagitilabilirKalan,
  cekDagitimKontrol,
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
  cekDagitilabilirKalan,
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
  /** Kaynak ÇEK ise faturayı kapatan çek/senedin kimliği ve açıklaması. */
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
      cekSenet: { select: { id: true, aciklama: true, vadeTarihi: true } },
    },
  });

  return odemeler.map((o) => ({
    id: o.id,
    tutar: roundMoney(o.tutar).toString(),
    tarih: o.tarih,
    kaynak: o.kaynak,
    aciklama: o.aciklama,
    cekSenetId: o.cekSenet?.id ?? null,
    cekSenetAciklamasi: o.cekSenet?.aciklama ?? null,
  }));
}

export type KullanilabilirCek = {
  cekSenetId: string;
  aciklama: string | null;
  vadeTarihi: Date;
  tutar: string;
  /** Henüz hiçbir faturaya sayılmamış kısım. */
  dagitilabilir: string;
};

/**
 * Bu cariye sayılabilecek çek/senetler — henüz dağıtılmamış kısmı olanlar.
 *
 * İKİ kaynak vardır:
 *  1. Carinin BİZE verdiği (ya da bizim ona verdiğimiz) çekler.
 *  2. Başkasından alınıp BU cariye CİRO EDİLEN çekler. Ciro, tedarikçiye olan
 *     borcu kapatır; o borcun hangi faturaya karşılık geldiği de
 *     işaretlenebilmeli. Yalnızca (1) sayılsaydı ciroyla kapanmış bir alış
 *     faturası sonsuza dek "bekliyor" kalırdı — ölçüldü, borç yaşlandırma
 *     raporu onu 60+ gün gecikmiş gösteriyordu.
 *
 * Karşılıksız çekler DIŞARIDA bırakılır: yanan çek bir faturayı kapatamaz,
 * borç zaten geri gelmiştir.
 *
 * Dağıtılabilir kalan HER TARAF İÇİN AYRI hesaplanır: aynı çek hem veren
 * müşterinin faturasını hem ciro edildiği tedarikçinin faturasını kapatır ve
 * bunlar birbirinin hakkını yemez — çek iki ayrı borcu gerçekten kapatmıştır.
 */
export async function kullanilabilirCekler(
  cariId: string,
  db: Db = prisma
): Promise<KullanilabilirCek[]> {
  const cekler = await db.cekSenet.findMany({
    where: {
      durum: { not: "KARSILIKSIZ" },
      OR: [{ cariId }, { ciroEdilenCariId: cariId, durum: "CIRO_EDILDI" }],
    },
    orderBy: [{ vadeTarihi: "asc" }, { id: "asc" }],
    include: {
      islemOdemeleri: {
        select: { tutar: true, islem: { select: { cariId: true } } },
      },
    },
  });

  return cekler
    .map((c) => ({
      cekSenetId: c.id,
      aciklama: c.aciklama,
      vadeTarihi: c.vadeTarihi,
      tutar: roundMoney(c.tutar).toString(),
      dagitilabilir: cekDagitilabilirKalan(
        c.tutar.toString(),
        c.islemOdemeleri
          .filter((o) => o.islem.cariId === cariId)
          .map((o) => o.tutar.toString())
      ),
    }))
    .filter((c) => toDecimal(c.dagitilabilir).greaterThan(0));
}

export type OdemeYaziVerisi = {
  tutar: string;
  tarih: Date;
  kaynak: OdemeKaynagiValue;
  /** Kaynak CEK ise zorunlu. */
  cekSenetId?: string;
  /**
   * Paranın gireceği/çıkacağı kasa/banka hesabı. YALNIZCA DIREKT ödemede
   * anlamlıdır: çeke bağlanan ödemede para kasaya çek TAHSİL EDİLİRKEN girer,
   * burada da girseydi kasa şişerdi.
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

    if (veri.kaynak === "CEK") {
      if (!veri.cekSenetId) {
        throw new Error("Çek/senet seçin.");
      }
      const cek = await tx.cekSenet.findUnique({
        where: { id: veri.cekSenetId },
        select: {
          tutar: true,
          cariId: true,
          ciroEdilenCariId: true,
          durum: true,
          islemOdemeleri: {
            select: { tutar: true, islem: { select: { cariId: true } } },
          },
        },
      });
      if (!cek) throw new Error("Çek/senet bulunamadı.");

      // Çek ya doğrudan bu cariye aittir ya da bu cariye CİRO EDİLMİŞTİR;
      // ciro, tedarikçiye olan borcu kapattığı için o faturaya da sayılabilir.
      const kendiCeki = cek.cariId === islem.cariId;
      const ciroEdildi =
        cek.durum === "CIRO_EDILDI" && cek.ciroEdilenCariId === islem.cariId;
      if (!kendiCeki && !ciroEdildi) {
        throw new Error("Çek/senet, işlemin carisine ait değil.");
      }
      // Yanan çek bir faturayı kapatamaz; borç zaten geri gelmiştir.
      if (cek.durum === "KARSILIKSIZ") {
        throw new Error("Karşılıksız çek bir faturaya sayılamaz.");
      }

      // Dağıtım sınırı TARAF BAZINDA: aynı çek hem veren müşterinin hem ciro
      // edildiği tedarikçinin faturasını kapatabilir ve bunlar birbirinin
      // hakkını yemez.
      const dagitim = cekDagitimKontrol(
        cek.tutar.toString(),
        cek.islemOdemeleri
          .filter((o) => o.islem.cariId === islem.cariId)
          .map((o) => o.tutar.toString()),
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
        cekSenetId: veri.kaynak === "CEK" ? veri.cekSenetId : null,
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
