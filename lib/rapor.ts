import { prisma } from "@/lib/prisma";
import { roundMoney, toDecimal } from "@/lib/money";
import {
  cariPerformansi,
  kdvRaporu,
  yaslandir,
  type KdvRaporu,
  type YaslandirmaRaporu,
} from "@/lib/domain/rapor";
import type { IslemTipiValue } from "@/lib/domain/islem";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

export {
  YASLANDIRMA_KOVALARI,
  YASLANDIRMA_ETIKETI,
  cariPerformansi,
  gecikmeGunu,
  kdvRaporu,
  yaslandir,
  yaslandirmaKovasi,
} from "@/lib/domain/rapor";
export type {
  KdvRaporu,
  YaslandirmaKovasi,
  YaslandirmaRaporu,
  CariPerformansSatiri,
} from "@/lib/domain/rapor";

export type DonemAraligi = { baslangic: Date; bitis: Date };

/* ------------------------------------------------------------------ */
/* KDV raporu                                                          */
/* ------------------------------------------------------------------ */

export type KdvRaporSonucu = KdvRaporu & {
  satisMatrah: string;
  alisMatrah: string;
  giderMatrah: string;
  satisSayisi: number;
  alisSayisi: number;
  giderSayisi: number;
};

export async function kdvRaporuGetir(
  aralik: DonemAraligi,
  db: Db = prisma
): Promise<KdvRaporSonucu> {
  const [islemler, giderler] = await Promise.all([
    db.islem.findMany({
      where: { tarih: { gte: aralik.baslangic, lte: aralik.bitis } },
      select: { tip: true, toplamTutar: true, kdvTutari: true },
    }),
    db.gider.findMany({
      where: { tarih: { gte: aralik.baslangic, lte: aralik.bitis } },
      select: { tutar: true, kdvTutari: true },
    }),
  ]);

  const satislar = islemler.filter((i) => i.tip === "SATIS");
  const alislar = islemler.filter((i) => i.tip === "ALIS");

  const matrah = (
    kayitlar: Array<{ toplamTutar?: unknown; tutar?: unknown; kdvTutari: unknown }>
  ) => {
    let t = toDecimal(0);
    for (const k of kayitlar) {
      const brut = roundMoney(String(k.toplamTutar ?? k.tutar));
      t = t.plus(brut.minus(roundMoney(String(k.kdvTutari))));
    }
    return t.toString();
  };

  const rapor = kdvRaporu({
    satisKdv: satislar.map((s) => s.kdvTutari.toString()),
    alisKdv: alislar.map((a) => a.kdvTutari.toString()),
    giderKdv: giderler.map((g) => g.kdvTutari.toString()),
  });

  return {
    ...rapor,
    satisMatrah: matrah(satislar),
    alisMatrah: matrah(alislar),
    giderMatrah: matrah(giderler),
    satisSayisi: satislar.length,
    alisSayisi: alislar.length,
    giderSayisi: giderler.length,
  };
}

/* ------------------------------------------------------------------ */
/* Yaşlandırma                                                         */
/* ------------------------------------------------------------------ */

/**
 * Açık faturaların yaşlandırması.
 *
 * Yaşlandırma tabanı vade tarihidir; vade girilmemişse belge tarihi kullanılır
 * (standart muhasebe pratiği — vadesiz fatura, düzenlendiği anda muaccel sayılır).
 * Yalnızca ödenmemiş kısım (toplamTutar - odenenTutar) yaşlandırılır; bu bilgi
 * fatura ödeme eşleştirmesi sayesinde kayıt bazında mevcuttur.
 */
export async function yaslandirmaRaporuGetir(
  tip: IslemTipiValue,
  bugun: Date,
  db: Db = prisma
): Promise<YaslandirmaRaporu> {
  const islemler = await db.islem.findMany({
    where: { tip, status: { in: ["BEKLIYOR", "KISMI_ODENDI"] } },
    select: {
      cariId: true,
      tarih: true,
      vadeTarihi: true,
      toplamTutar: true,
      odenenTutar: true,
      cari: { select: { unvan: true } },
    },
  });

  return yaslandir(
    islemler.map((i) => ({
      cariId: i.cariId,
      cariUnvan: i.cari.unvan,
      vadeTarihi: i.vadeTarihi ?? i.tarih,
      kalanTutar: roundMoney(i.toplamTutar)
        .minus(roundMoney(i.odenenTutar))
        .toString(),
    })),
    bugun
  );
}

/* ------------------------------------------------------------------ */
/* Satış performansı                                                   */
/* ------------------------------------------------------------------ */

export type SatisPerformansi = {
  satisToplami: string;
  alisToplami: string;
  net: string;
  satisSayisi: number;
  enIyiCariler: ReturnType<typeof cariPerformansi>;
  aylik: Array<{ ay: string; etiket: string; satis: string; alis: string }>;
};

const AY_ETIKETI = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  year: "2-digit",
});

export async function satisPerformansiGetir(
  aralik: DonemAraligi,
  db: Db = prisma
): Promise<SatisPerformansi> {
  const islemler = await db.islem.findMany({
    where: { tarih: { gte: aralik.baslangic, lte: aralik.bitis } },
    select: {
      tip: true,
      tarih: true,
      cariId: true,
      toplamTutar: true,
      cari: { select: { unvan: true } },
    },
    orderBy: { tarih: "asc" },
  });

  const satislar = islemler.filter((i) => i.tip === "SATIS");
  const alislar = islemler.filter((i) => i.tip === "ALIS");

  const toplam = (kayitlar: typeof islemler) => {
    let t = toDecimal(0);
    for (const k of kayitlar) t = t.plus(roundMoney(k.toplamTutar));
    return t;
  };

  const satisToplami = toplam(satislar);
  const alisToplami = toplam(alislar);

  // Aylık kırılım — boş aylar da görünsün diye kovalar önceden açılır.
  const kovalar = new Map<string, { satis: ReturnType<typeof toDecimal>; alis: ReturnType<typeof toDecimal> }>();
  const sira: Array<{ ay: string; etiket: string }> = [];
  const imlec = new Date(
    aralik.baslangic.getFullYear(),
    aralik.baslangic.getMonth(),
    1
  );
  while (imlec <= aralik.bitis) {
    const anahtar = `${imlec.getFullYear()}-${`${imlec.getMonth() + 1}`.padStart(2, "0")}`;
    kovalar.set(anahtar, { satis: toDecimal(0), alis: toDecimal(0) });
    sira.push({ ay: anahtar, etiket: AY_ETIKETI.format(imlec) });
    imlec.setMonth(imlec.getMonth() + 1);
  }

  for (const i of islemler) {
    const d = new Date(i.tarih);
    const anahtar = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
    const kova = kovalar.get(anahtar);
    if (!kova) continue;
    const tutar = roundMoney(i.toplamTutar);
    if (i.tip === "SATIS") kova.satis = kova.satis.plus(tutar);
    else kova.alis = kova.alis.plus(tutar);
  }

  return {
    satisToplami: satisToplami.toString(),
    alisToplami: alisToplami.toString(),
    net: satisToplami.minus(alisToplami).toString(),
    satisSayisi: satislar.length,
    enIyiCariler: cariPerformansi(
      satislar.map((s) => ({
        cariId: s.cariId,
        cariUnvan: s.cari.unvan,
        tutar: s.toplamTutar.toString(),
      })),
      10
    ),
    aylik: sira.map(({ ay, etiket }) => {
      const k = kovalar.get(ay)!;
      return {
        ay,
        etiket,
        satis: k.satis.toString(),
        alis: k.alis.toString(),
      };
    }),
  };
}
