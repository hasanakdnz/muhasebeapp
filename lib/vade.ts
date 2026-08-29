import { prisma } from "@/lib/prisma";
import { roundMoney, toDecimal } from "@/lib/money";
import {
  VARSAYILAN_YAKLASMA_ESIGI,
  hesaplaVadeOzeti,
  kalanGun,
  vadeDurumu,
  type VadeDurumu,
} from "@/lib/domain/vade";
import type { CekSenetYonuValue } from "@/lib/domain/cek-senet";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

export {
  VARSAYILAN_YAKLASMA_ESIGI,
  hesaplaVadeOzeti,
  vadeDurumu,
  vadeMetni,
  vadeRozetVaryanti,
} from "@/lib/domain/vade";
export type { VadeDurumu } from "@/lib/domain/vade";

/**
 * Vade takibi YALNIZCA çek/senet üzerinden yapılır.
 *
 * Neden işlem (fatura) dahil değil: `Islem.odenenTutar` ve `status` alanları
 * henüz hiçbir yerde güncellenmiyor — bir faturanın ödenip ödenmediği kayıt
 * bazında bilinmiyor (müşteri çekle ödediğinde tahsilat çek kaydına işleniyor,
 * faturaya değil). Bu durumda faturaya "vadesi geçti" rozeti koymak, parasını
 * almış olduğunuz faturaları da gecikmiş gösterirdi. Çek/senette ise kalan
 * tutar (tutar - tahsilEdilen) kayıt bazında kesin bilindiği için rozet
 * güvenilirdir.
 */
export type VadeliCekSenet = {
  id: string;
  tip: string;
  yon: CekSenetYonuValue;
  cariUnvan: string;
  vadeTarihi: Date;
  /** Henüz tahsil edilmemiş tutar. */
  kalan: string;
  durum: VadeDurumu;
  kalanGun: number;
};

export type VadeFiltre = {
  bugun: Date;
  esik?: number;
  /** Yalnızca gecikmiş ve yaklaşanlar (bildirim ve özet için). */
  sadeceDikkatGerekenler?: boolean;
};

/**
 * Vadesi izlenen çek/senetler: yalnızca PORTFOYDE olanlar. Tahsil edilmiş,
 * ciro edilmiş veya karşılıksız kayıtların vadesi artık beklenen bir olay
 * değildir.
 */
export async function listeleVadeliCekSenetler(
  filtre: VadeFiltre,
  db: Db = prisma
): Promise<VadeliCekSenet[]> {
  const esik = filtre.esik ?? VARSAYILAN_YAKLASMA_ESIGI;

  const kayitlar = await db.cekSenet.findMany({
    where: { durum: "PORTFOYDE" },
    orderBy: [{ vadeTarihi: "asc" }, { id: "asc" }],
    include: { cari: { select: { unvan: true } } },
  });

  const satirlar = kayitlar
    .map((k) => {
      const kalan = roundMoney(k.tutar).minus(roundMoney(k.tahsilEdilen));
      return {
        id: k.id,
        tip: k.tip,
        yon: k.yon,
        cariUnvan: k.cari.unvan,
        vadeTarihi: k.vadeTarihi,
        kalan: kalan.toString(),
        durum: vadeDurumu(k.vadeTarihi, filtre.bugun, esik),
        kalanGun: kalanGun(k.vadeTarihi, filtre.bugun),
      };
    })
    // Kalanı sıfır olan kayıt portföyde görünse bile beklenen bir tahsilat değildir.
    .filter((s) => !toDecimal(s.kalan).isZero());

  return filtre.sadeceDikkatGerekenler
    ? satirlar.filter((s) => s.durum !== "normal")
    : satirlar;
}

export type VadePanosu = {
  gecen: number;
  bugunVadeli: number;
  yaklasan: number;
  /** Gecikmiş kayıtların tahsil edilmemiş toplamı. */
  gecenTutar: string;
  /** Bugün + eşik içindeki kayıtların toplamı. */
  yaklasanTutar: string;
};

export async function vadePanosu(
  bugun: Date,
  esik: number = VARSAYILAN_YAKLASMA_ESIGI,
  db: Db = prisma
): Promise<VadePanosu> {
  const kayitlar = await listeleVadeliCekSenetler({ bugun, esik }, db);
  const sayilar = hesaplaVadeOzeti(
    kayitlar.map((k) => k.vadeTarihi),
    bugun,
    esik
  );

  let gecenTutar = toDecimal(0);
  let yaklasanTutar = toDecimal(0);
  for (const k of kayitlar) {
    if (k.durum === "gecti") gecenTutar = gecenTutar.plus(k.kalan);
    else if (k.durum === "bugun" || k.durum === "yaklasiyor") {
      yaklasanTutar = yaklasanTutar.plus(k.kalan);
    }
  }

  return {
    ...sayilar,
    gecenTutar: gecenTutar.toString(),
    yaklasanTutar: yaklasanTutar.toString(),
  };
}
