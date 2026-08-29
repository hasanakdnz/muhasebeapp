import { prisma } from "@/lib/prisma";
import { roundMoney, toDecimal } from "@/lib/money";
import { aramaNormalize } from "@/lib/text";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { CariTipiValue } from "@/lib/validations/cari";

// Saf hesap mantığı lib/domain/cari.ts içindedir (Prisma'sız, test edilebilir).
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

function aramaKosulu(q: string) {
  // Ünvan araması normalize edilmiş anahtar üzerinden yapılır (bkz. lib/text.ts):
  // "ışık", "IŞIK" ve "isik" aynı kaydı bulur. VKN/TCKN salt rakam olduğu için
  // doğrudan aranır.
  return [
    { aramaAnahtari: { contains: aramaNormalize(q) } },
    { vknTckn: { contains: q.trim() } },
  ];
}

/** Yazma işlemlerinde Cari alanlarını tek yerden üretir — create/update ayrışmasın. */
export function cariVerisiHazirla(veri: {
  unvan: string;
  tip: CariTipiValue;
  vknTckn?: string;
  vergiDairesi?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  bakiye: string;
}) {
  return {
    unvan: veri.unvan,
    tip: veri.tip,
    vknTckn: veri.vknTckn ?? null,
    vergiDairesi: veri.vergiDairesi ?? null,
    telefon: veri.telefon ?? null,
    email: veri.email ?? null,
    adres: veri.adres ?? null,
    bakiye: veri.bakiye,
    aramaAnahtari: aramaNormalize(veri.unvan),
  };
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
    bakiye: roundMoney(cari.bakiye).toString(),
    aktif: cari.aktif,
    createdAt: cari.createdAt,
    islemSayisi: cari._count.islemler,
    cekSenetSayisi: cari._count.cekSenetler,
  };
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
  const [islemSayisi, cekSenetSayisi] = await Promise.all([
    db.islem.count({ where: { cariId: id } }),
    db.cekSenet.count({ where: { cariId: id } }),
  ]);
  return {
    silinebilir: islemSayisi === 0 && cekSenetSayisi === 0,
    islemSayisi,
    cekSenetSayisi,
  };
}
