import { prisma } from "@/lib/prisma";
import { roundMoney, toDecimal } from "@/lib/money";
import { aramaNormalize } from "@/lib/text";
import {
  cariBakiyeEtkisi,
  cariBakiyesiMutabik,
  hesaplaCariBakiyesi,
} from "@/lib/domain/islem";
import {
  cekCariEtkisi,
  ciroHedefEtkisi,
} from "@/lib/domain/cek-senet";
import { odemeCariEtkisi } from "@/lib/domain/odeme";
import type { Tx } from "@/lib/islem";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { CariTipiValue } from "@/lib/validations/cari";

// Saf hesap mantığı lib/domain/ altındadır (Prisma'sız, test edilebilir).
export { hesaplaCariOzeti } from "@/lib/domain/cari";
export type { CariOzet } from "@/lib/domain/cari";

/**
 * Sorgular client'ı parametre olarak alır (varsayılan: uygulama client'ı).
 * Böylece entegrasyon testleri izole bir veritabanı verebilir.
 */
export type Db = PrismaClient;

/** RSC sınırından geçebilmesi için Decimal'ler string'e çevrilir. */
export type CariSatiri = {
  id: string;
  unvan: string;
  vknTckn: string | null;
  tip: CariTipiValue;
  telefon: string | null;
  email: string | null;
  bakiye: string;
  aktif: boolean;
};

export type CariDetay = CariSatiri & {
  vergiDairesi: string | null;
  adres: string | null;
  acilisBakiyesi: string;
  createdAt: Date;
  islemSayisi: number;
  cekSenetSayisi: number;
};

export type CariFiltre = {
  q?: string;
  tip?: CariTipiValue;
  /** Yalnızca bakiyesi sıfır olmayanlar — açık hesap takibi ekranı. */
  sadeceAcikHesap?: boolean;
  /** Pasife alınmış cariler varsayılan olarak gizlenir. */
  pasifleriGoster?: boolean;
};

/** Yazma işlemlerinde ortak alanlar — create/update ayrışmasın. */
export type CariYaziVerisi = {
  unvan: string;
  tip: CariTipiValue;
  vknTckn?: string;
  vergiDairesi?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  acilisBakiyesi: string;
};

function ortakAlanlar(veri: CariYaziVerisi) {
  return {
    unvan: veri.unvan,
    tip: veri.tip,
    vknTckn: veri.vknTckn ?? null,
    vergiDairesi: veri.vergiDairesi ?? null,
    telefon: veri.telefon ?? null,
    email: veri.email ?? null,
    adres: veri.adres ?? null,
    aramaAnahtari: aramaNormalize(veri.unvan),
  };
}

/**
 * Cari yürüyen bakiyesini oluşturan TÜM etkiler.
 *
 * Dört kaynak vardır ve hepsi sayılmalıdır:
 *  1. Satış/alış işlemleri
 *  2. Bu cariye ait çek/senet KAYITLARI — etki çekin alındığı/verildiği anda
 *     doğar, tahsilatta değil (bkz. lib/domain/cek-senet.ts bakiye modeli).
 *     Tahsilat kayıtları bu yüzden burada SAYILMAZ; sayılsaydı aynı para iki
 *     kez düşerdi.
 *  3. BU cariye ciro edilmiş çekler — ciro edilen çekte yalnızca hedef cari
 *     etkilenir; çeki veren müşterinin borcu (2)'de zaten kapanmıştır.
 *  4. DİREKT fatura ödemeleri (nakit/banka).
 *
 * Çek tahsilatından doğan fatura ödemeleri burada SAYILMAZ: o borç (2)'de
 * zaten kapandı, tekrar sayılırsa çift sayım olur. odemeCariEtkisi bu ayrımı
 * yapar ve CEK_TAHSILATI için sıfır döner.
 *
 * Biri unutulursa `bakiye = açılış + Σ etki` değişmezi yanlış alarm verir.
 */
async function cariEtkileri(cariId: string, db: Tx): Promise<string[]> {
  const [islemler, cekler, ciroAlinan, odemeler] = await Promise.all([
    db.islem.findMany({
      where: { cariId },
      select: { tip: true, toplamTutar: true },
    }),
    db.cekSenet.findMany({
      where: { cariId },
      select: { yon: true, durum: true, tutar: true, tahsilEdilen: true },
    }),
    // Başkasından alınıp BU cariye ciro edilen çekler.
    db.cekSenet.findMany({
      where: { ciroEdilenCariId: cariId, durum: "CIRO_EDILDI" },
      select: { tutar: true },
    }),
    db.islemOdeme.findMany({
      where: { islem: { cariId } },
      select: { tutar: true, kaynak: true, islem: { select: { tip: true } } },
    }),
  ]);

  return [
    ...islemler.map((i) => cariBakiyeEtkisi(i.tip, i.toplamTutar.toString())),
    ...cekler.map((c) =>
      cekCariEtkisi(
        c.yon,
        c.durum,
        c.tutar.toString(),
        c.tahsilEdilen.toString()
      )
    ),
    ...ciroAlinan.map((c) => ciroHedefEtkisi(c.tutar.toString())),
    ...odemeler.map((o) =>
      odemeCariEtkisi(o.islem.tip, o.kaynak, o.tutar.toString())
    ),
  ];
}

/**
 * Carinin yürüyen bakiyesini KAYNAKLARDAN yeniden hesaplayıp yazar.
 *
 * Çek/senet tarafındaki her mutasyon bunu çağırır. Alternatifi, her fonksiyonda
 * `bakiye ± x` artımlı aritmetiği yapmaktı; sekiz ayrı yerde tekrarlanan bu
 * yöntem tek bir unutulan durumda sessizce sürüklenir. Yeniden hesaplama
 * mutabakat fonksiyonuyla AYNI kaynağı kullanır, dolayısıyla ikisi tanım gereği
 * ayrışamaz.
 */
export async function cariBakiyesiniYenile(
  cariId: string,
  tx: Tx
): Promise<void> {
  const cari = await tx.cari.findUnique({
    where: { id: cariId },
    select: { acilisBakiyesi: true },
  });
  if (!cari) throw new Error("Cari bulunamadı.");

  const etkiler = await cariEtkileri(cariId, tx);
  await tx.cari.update({
    where: { id: cariId },
    data: {
      bakiye: hesaplaCariBakiyesi(cari.acilisBakiyesi.toString(), etkiler),
    },
  });
}

function aramaKosulu(q: string) {
  // Ünvan araması normalize edilmiş anahtar üzerinden yapılır (bkz. lib/text.ts):
  // "ışık", "IŞIK" ve "isik" aynı kaydı bulur. VKN/TCKN salt rakam olduğu için
  // doğrudan aranır.
  return [
    { aramaAnahtari: { contains: aramaNormalize(q) } },
    { vknTckn: { contains: q.trim() } },
  ];
}

export async function listeleCariler(
  filtre: CariFiltre = {},
  db: Db = prisma
): Promise<CariSatiri[]> {
  const q = filtre.q?.trim();

  const cariler = await db.cari.findMany({
    where: {
      ...(filtre.pasifleriGoster ? {} : { aktif: true }),
      ...(filtre.tip ? { tip: filtre.tip } : {}),
      ...(q ? { OR: aramaKosulu(q) } : {}),
    },
    orderBy: { unvan: "asc" },
    select: {
      id: true,
      unvan: true,
      vknTckn: true,
      tip: true,
      telefon: true,
      email: true,
      bakiye: true,
      aktif: true,
    },
  });

  const satirlar = cariler.map((c) => ({
    ...c,
    bakiye: roundMoney(c.bakiye).toString(),
  }));

  // Bakiye filtresi DB'de Decimal karşılaştırmasına girmesin diye burada
  // uygulanır; sıfır tespiti Decimal ile yapılır.
  return filtre.sadeceAcikHesap
    ? satirlar.filter((c) => !toDecimal(c.bakiye).isZero())
    : satirlar;
}

export async function getCari(
  id: string,
  db: Db = prisma
): Promise<CariDetay | null> {
  const cari = await db.cari.findUnique({
    where: { id },
    include: {
      _count: { select: { islemler: true, cekSenetler: true } },
    },
  });
  if (!cari) return null;

  return {
    id: cari.id,
    unvan: cari.unvan,
    vknTckn: cari.vknTckn,
    tip: cari.tip,
    telefon: cari.telefon,
    email: cari.email,
    vergiDairesi: cari.vergiDairesi,
    adres: cari.adres,
    acilisBakiyesi: roundMoney(cari.acilisBakiyesi).toString(),
    bakiye: roundMoney(cari.bakiye).toString(),
    aktif: cari.aktif,
    createdAt: cari.createdAt,
    islemSayisi: cari._count.islemler,
    cekSenetSayisi: cari._count.cekSenetler,
  };
}

/** Yeni caride henüz işlem yoktur; yürüyen bakiye açılış bakiyesine eşittir. */
export async function cariOlustur(
  veri: CariYaziVerisi,
  db: Db = prisma
): Promise<{ id: string }> {
  const acilis = roundMoney(veri.acilisBakiyesi).toString();
  return db.cari.create({
    data: {
      ...ortakAlanlar(veri),
      acilisBakiyesi: acilis,
      bakiye: acilis,
    },
    select: { id: true },
  });
}

/**
 * Cariyi günceller. Açılış bakiyesi değişirse yürüyen bakiye YENİDEN hesaplanır
 * (açılış + Σ işlem etkileri + Σ tahsilat etkileri) — `bakiye` hiçbir zaman
 * doğrudan yazılmaz, aksi halde değişmez bozulurdu.
 */
export async function cariGuncelle(
  id: string,
  veri: CariYaziVerisi,
  db: Db = prisma
): Promise<void> {
  const acilis = roundMoney(veri.acilisBakiyesi).toString();

  await db.$transaction(async (tx) => {
    const etkiler = await cariEtkileri(id, tx);

    await tx.cari.update({
      where: { id },
      data: {
        ...ortakAlanlar(veri),
        acilisBakiyesi: acilis,
        bakiye: hesaplaCariBakiyesi(acilis, etkiler),
      },
    });
  });
}

/**
 * Muhasebe kuralı: işlem veya çek/senet kaydı olan cari SİLİNEMEZ.
 * Bu kayıtlar cascade ile yok edilemez (şemada onDelete: Restrict);
 * kullanıcının doğru aksiyonu cariyi pasife almaktır.
 */
export async function cariSilinebilirMi(
  id: string,
  db: Db = prisma
): Promise<{
  silinebilir: boolean;
  islemSayisi: number;
  cekSenetSayisi: number;
}> {
  const [islemSayisi, kendiCekleri, ciroEdilenler] = await Promise.all([
    db.islem.count({ where: { cariId: id } }),
    db.cekSenet.count({ where: { cariId: id } }),
    // Bu cariye ciro edilmiş çekler de ona bağlı kayıttır.
    db.cekSenet.count({ where: { ciroEdilenCariId: id } }),
  ]);
  const cekSenetSayisi = kendiCekleri + ciroEdilenler;
  return {
    silinebilir: islemSayisi === 0 && cekSenetSayisi === 0,
    islemSayisi,
    cekSenetSayisi,
  };
}

/**
 * Mutabakat: saklanan yürüyen bakiye, açılış + işlem + tahsilat etkileriyle
 * tutuyor mu? Kasa/Banka'daki hesapBakiyesiniDogrula ile aynı disiplin.
 */
export async function cariBakiyesiniDogrula(
  id: string,
  db: Db = prisma
): Promise<{ mutabik: boolean; saklanan: string; hesaplanan: string }> {
  const cari = await db.cari.findUnique({
    where: { id },
    select: { acilisBakiyesi: true, bakiye: true },
  });
  if (!cari) throw new Error("Cari bulunamadı.");

  const etkiler = await cariEtkileri(id, db);

  return {
    mutabik: cariBakiyesiMutabik(
      cari.bakiye.toString(),
      cari.acilisBakiyesi.toString(),
      etkiler
    ),
    saklanan: roundMoney(cari.bakiye).toString(),
    hesaplanan: hesaplaCariBakiyesi(cari.acilisBakiyesi.toString(), etkiler),
  };
}
