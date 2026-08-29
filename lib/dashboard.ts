import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/money";
import { hesaplaCariOzeti } from "@/lib/domain/cari";
import { hesaplaHareketOzeti } from "@/lib/domain/kasa";
import { donemselToplamlar } from "@/lib/islem";
import { hesaplaHesapOzeti, listeleHesaplar } from "@/lib/kasa";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

export type DashboardOzeti = {
  kasa: string;
  banka: string;
  alacak: string;
  borc: string;
  satis: string;
  alis: string;
  /** Satış/alış rakamlarının kapsadığı dönem etiketi. */
  donemEtiketi: string;
};

export type AylikNakitAkisi = {
  ay: string;
  /** Ay etiketi — "Oca 26" gibi. */
  etiket: string;
  /** Çizim için sayı. Çıkış, sıfır çizgisinin altına düşsün diye negatiftir. */
  giris: number;
  cikis: number;
  /** Tooltip'te gösterilecek TAM tutarlar (Decimal string) — çizim
   *  hassasiyeti gösterilen rakamı etkilemez. */
  girisTam: string;
  cikisTam: string;
};

export function ayBasi(tarih: Date): Date {
  return new Date(tarih.getFullYear(), tarih.getMonth(), 1);
}

export function aySonu(tarih: Date): Date {
  return new Date(
    tarih.getFullYear(),
    tarih.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
}

const AY_ETIKETI = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  year: "2-digit",
});

export async function dashboardOzeti(
  bugun: Date,
  db: Db = prisma
): Promise<DashboardOzeti> {
  const [hesaplar, cariler, donem] = await Promise.all([
    listeleHesaplar({}, db),
    db.cari.findMany({ where: { aktif: true }, select: { bakiye: true } }),
    donemselToplamlar(
      { baslangic: ayBasi(bugun), bitis: aySonu(bugun) },
      db
    ),
  ]);

  const hesapOzeti = hesaplaHesapOzeti(hesaplar);
  const cariOzeti = hesaplaCariOzeti(cariler.map((c) => c.bakiye.toString()));

  return {
    kasa: hesapOzeti.kasaToplami,
    banka: hesapOzeti.bankaToplami,
    alacak: cariOzeti.toplamAlacak,
    borc: cariOzeti.toplamBorc,
    satis: donem.satis,
    alis: donem.alis,
    donemEtiketi: "Bu ay",
  };
}

/**
 * Son `aySayisi` ayın kasa/banka giriş-çıkışı.
 *
 * Grafik için sayıya çevrilir (Recharts float ile çizer); toplamlar ve
 * gösterilen tutarlar Decimal'den gelir — çizim hassasiyeti finansal
 * doğruluğu etkilemez.
 */
export async function aylikNakitAkisi(
  bugun: Date,
  aySayisi = 6,
  db: Db = prisma
): Promise<AylikNakitAkisi[]> {
  const baslangic = new Date(
    bugun.getFullYear(),
    bugun.getMonth() - (aySayisi - 1),
    1
  );
  const bitis = aySonu(bugun);

  const hareketler = await db.hesapHareketi.findMany({
    where: { tarih: { gte: baslangic, lte: bitis } },
    select: { tutar: true, tarih: true },
  });

  // Boş aylar da grafikte yer alsın diye tüm kovalar önceden oluşturulur.
  const kovalar = new Map<string, string[]>();
  const sira: Array<{ ay: string; etiket: string }> = [];
  for (let i = 0; i < aySayisi; i += 1) {
    const d = new Date(bugun.getFullYear(), bugun.getMonth() - (aySayisi - 1 - i), 1);
    const anahtar = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
    kovalar.set(anahtar, []);
    sira.push({ ay: anahtar, etiket: AY_ETIKETI.format(d) });
  }

  for (const h of hareketler) {
    const d = new Date(h.tarih);
    const anahtar = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
    kovalar.get(anahtar)?.push(roundMoney(h.tutar).toString());
  }

  return sira.map(({ ay, etiket }) => {
    const ozet = hesaplaHareketOzeti(kovalar.get(ay) ?? []);
    return {
      ay,
      etiket,
      giris: Number(ozet.toplamGiris),
      // Çıkış sıfır çizgisinin ALTINA çizilir: konum, renkten bağımsız bir
      // ikincil kodlamadır (yeşil/kırmızı çifti renk körlüğünde ayrışmaz).
      cikis: -Number(ozet.toplamCikis),
      girisTam: ozet.toplamGiris,
      cikisTam: ozet.toplamCikis,
    };
  });
}
