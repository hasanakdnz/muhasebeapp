import { prisma } from "@/lib/prisma";
import { hesaplaIslemToplamlari, kdvDahilNete } from "@/lib/domain/islem";
import {
  donusturulebilirMi,
  duzenlenebilirMi,
  gecerliDurumGecisi,
  silinebilirMi,
  sonrakiProformaNo,
  suresiDoldu,
  PROFORMA_DURUM_ETIKETI,
  type ProformaDurumuValue,
} from "@/lib/domain/proforma";
import { islemYaz } from "@/lib/islem";
import type { ProformaOutput } from "@/lib/validations/proforma";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

/**
 * Proforma (teklif) veri katmanı.
 *
 * Buradaki hiçbir işlem cari bakiyesine dokunmaz — teklif muhasebe kaydı
 * değildir (gerekçe: lib/domain/proforma.ts). Bakiye yalnızca teklif faturaya
 * dönüştüğünde, `islemYaz` üzerinden ve İŞLEM kuralları ile değişir.
 */

/** RSC sınırından geçebilmesi için Decimal'ler string'e çevrilir. */
export type ProformaSatiri = {
  id: string;
  no: string;
  cariId: string;
  cariUnvan: string;
  tarih: Date;
  gecerlilikTarihi: Date | null;
  durum: ProformaDurumuValue;
  toplamTutar: string;
  kdvTutari: string;
  /** toplamTutar - kdvTutari */
  matrah: string;
  kalemSayisi: number;
  islemId: string | null;
  /** Gönderilmiş ve geçerlilik tarihi geçmiş mi? */
  suresiDoldu: boolean;
};

export type ProformaKalemSatiri = {
  id: string;
  urunAdi: string;
  miktar: string;
  birimFiyat: string;
  kdvOrani: string;
  matrah: string;
  kdv: string;
  brut: string;
};

export type ProformaDetay = ProformaSatiri & {
  notlar: string | null;
  cariVknTckn: string | null;
  cariVergiDairesi: string | null;
  cariAdres: string | null;
  cariEmail: string | null;
  cariTelefon: string | null;
  kalemler: ProformaKalemSatiri[];
};

export type ProformaFiltre = {
  durum?: ProformaDurumuValue;
  cariId?: string;
};

const KAYIT_ICERIGI = {
  cari: {
    select: {
      id: true,
      unvan: true,
      vknTckn: true,
      vergiDairesi: true,
      adres: true,
      email: true,
      telefon: true,
    },
  },
  kalemler: { orderBy: { id: "asc" } },
} as const;

type KayitTipi = Awaited<
  ReturnType<
    typeof prisma.proforma.findFirstOrThrow<{ include: typeof KAYIT_ICERIGI }>
  >
>;

function satiraCevir(k: KayitTipi, bugun: Date): ProformaSatiri {
  const toplam = k.toplamTutar.toString();
  const kdv = k.kdvTutari.toString();
  return {
    id: k.id,
    no: k.no,
    cariId: k.cariId,
    cariUnvan: k.cari.unvan,
    tarih: k.tarih,
    gecerlilikTarihi: k.gecerlilikTarihi,
    durum: k.durum as ProformaDurumuValue,
    toplamTutar: toplam,
    kdvTutari: kdv,
    matrah: k.toplamTutar.minus(k.kdvTutari).toString(),
    kalemSayisi: k.kalemler.length,
    islemId: k.islemId,
    suresiDoldu: suresiDoldu(
      k.durum as ProformaDurumuValue,
      k.gecerlilikTarihi,
      bugun
    ),
  };
}

export async function listeleProformalar(
  filtre: ProformaFiltre = {},
  bugun: Date = new Date(),
  db: Db = prisma
): Promise<ProformaSatiri[]> {
  const kayitlar = await db.proforma.findMany({
    where: {
      ...(filtre.durum ? { durum: filtre.durum } : {}),
      ...(filtre.cariId ? { cariId: filtre.cariId } : {}),
    },
    include: KAYIT_ICERIGI,
    orderBy: [{ tarih: "desc" }, { no: "desc" }],
  });
  return kayitlar.map((k) => satiraCevir(k, bugun));
}

export async function proformaGetir(
  id: string,
  bugun: Date = new Date(),
  db: Db = prisma
): Promise<ProformaDetay | null> {
  const k = await db.proforma.findUnique({
    where: { id },
    include: KAYIT_ICERIGI,
  });
  if (!k) return null;

  // Satır tutarları saklanmaz, kaydedilenle AYNI fonksiyondan üretilir —
  // ekranda görünen kırılım ile toplam ayrışamaz.
  const toplamlar = hesaplaIslemToplamlari(
    k.kalemler.map((kl) => ({
      miktar: kl.miktar.toString(),
      birimFiyat: kl.birimFiyat.toString(),
      kdvOrani: kl.kdvOrani.toString(),
    }))
  );

  return {
    ...satiraCevir(k, bugun),
    notlar: k.notlar,
    cariVknTckn: k.cari.vknTckn,
    cariVergiDairesi: k.cari.vergiDairesi,
    cariAdres: k.cari.adres,
    cariEmail: k.cari.email,
    cariTelefon: k.cari.telefon,
    kalemler: k.kalemler.map((kl, i) => ({
      id: kl.id,
      urunAdi: kl.urunAdi,
      miktar: kl.miktar.toString(),
      birimFiyat: kl.birimFiyat.toString(),
      kdvOrani: kl.kdvOrani.toString(),
      matrah: toplamlar.kalemler[i].matrah,
      kdv: toplamlar.kalemler[i].kdv,
      brut: toplamlar.kalemler[i].brut,
    })),
  };
}

/** Formdaki kalemleri, KDV dahil girildiyse net'e çevirerek normalize eder. */
function kalemleriNormalize(veri: ProformaOutput) {
  return veri.kalemler.map((k) => ({
    urunAdi: k.urunAdi,
    miktar: k.miktar,
    // Veritabanına DAİMA KDV hariç (net) fiyat yazılır — işlemle aynı kural.
    birimFiyat: veri.kdvDahil
      ? kdvDahilNete(k.birimFiyat, k.kdvOrani)
      : k.birimFiyat,
    kdvOrani: k.kdvOrani,
  }));
}

export async function proformaOlustur(
  veri: ProformaOutput,
  db: Db = prisma
): Promise<{ id: string; no: string }> {
  const kalemler = kalemleriNormalize(veri);
  const toplamlar = hesaplaIslemToplamlari(kalemler);
  const yil = veri.tarih.getFullYear();

  return db.$transaction(async (tx) => {
    const cari = await tx.cari.findUnique({
      where: { id: veri.cariId },
      select: { id: true },
    });
    if (!cari) throw new Error("Cari bulunamadı.");

    // Numara transaction içinde üretilir; iki eşzamanlı kayıt aynı numarayı
    // almasın. `no` alanı ayrıca @unique — yarış olursa veritabanı reddeder.
    const mevcut = await tx.proforma.findMany({
      where: { no: { startsWith: `PRF-${yil}-` } },
      select: { no: true },
    });
    const no = sonrakiProformaNo(
      yil,
      mevcut.map((m) => m.no)
    );

    return tx.proforma.create({
      data: {
        no,
        cariId: veri.cariId,
        tarih: veri.tarih,
        gecerlilikTarihi: veri.gecerlilikTarihi ?? null,
        notlar: veri.notlar ?? null,
        toplamTutar: toplamlar.toplamTutar,
        kdvTutari: toplamlar.kdvTutari,
        kalemler: { create: kalemler },
      },
      select: { id: true, no: true },
    });
  });
}

export async function proformaGuncelle(
  id: string,
  veri: ProformaOutput,
  db: Db = prisma
): Promise<void> {
  const kalemler = kalemleriNormalize(veri);
  const toplamlar = hesaplaIslemToplamlari(kalemler);

  await db.$transaction(async (tx) => {
    const mevcut = await tx.proforma.findUnique({
      where: { id },
      select: { durum: true },
    });
    if (!mevcut) throw new Error("Teklif bulunamadı.");
    if (!duzenlenebilirMi(mevcut.durum as ProformaDurumuValue)) {
      throw new Error(
        "Faturaya dönüşmüş teklif düzenlenemez; değişiklik için faturayı güncelleyin."
      );
    }

    // Kalemler tamamen yenilenir: satır eşleştirmesi yerine sil-yaz, çünkü
    // teklif kalemlerine bağlı başka bir kayıt yok.
    await tx.proformaKalemi.deleteMany({ where: { proformaId: id } });
    await tx.proforma.update({
      where: { id },
      data: {
        cariId: veri.cariId,
        tarih: veri.tarih,
        gecerlilikTarihi: veri.gecerlilikTarihi ?? null,
        notlar: veri.notlar ?? null,
        toplamTutar: toplamlar.toplamTutar,
        kdvTutari: toplamlar.kdvTutari,
        kalemler: { create: kalemler },
      },
    });
  });
}

export async function proformaSil(id: string, db: Db = prisma): Promise<void> {
  const mevcut = await db.proforma.findUnique({
    where: { id },
    select: { durum: true },
  });
  if (!mevcut) throw new Error("Teklif bulunamadı.");
  if (!silinebilirMi(mevcut.durum as ProformaDurumuValue)) {
    throw new Error(
      "Faturaya dönüşmüş teklif silinemez; oluşan fatura kaydı buna bağlıdır."
    );
  }
  await db.proforma.delete({ where: { id } });
}

export async function proformaDurumDegistir(
  id: string,
  yeni: ProformaDurumuValue,
  db: Db = prisma
): Promise<void> {
  const mevcut = await db.proforma.findUnique({
    where: { id },
    select: { durum: true },
  });
  if (!mevcut) throw new Error("Teklif bulunamadı.");

  const eski = mevcut.durum as ProformaDurumuValue;
  if (eski === yeni) return;
  if (!gecerliDurumGecisi(eski, yeni)) {
    throw new Error(
      `"${PROFORMA_DURUM_ETIKETI[eski]}" durumundan "${PROFORMA_DURUM_ETIKETI[yeni]}" durumuna geçilemez.`
    );
  }

  await db.proforma.update({ where: { id }, data: { durum: yeni } });
}

/**
 * Kabul edilen teklifi gerçek bir SATIŞ işlemine dönüştürür.
 *
 * Muhasebe burada başlar: cari bakiyesi ilk kez bu adımda değişir. Fatura
 * oluşturma ve teklifin kilitlenmesi TEK transaction'dadır — biri olup diğeri
 * olmasaydı ya bakiyesi artmış sahipsiz bir fatura ya da iki kez faturalanabilen
 * bir teklif kalırdı.
 */
export async function proformayiIsleDonustur(
  id: string,
  secenek: { tarih?: Date; vadeTarihi?: Date } = {},
  db: Db = prisma
): Promise<{ islemId: string }> {
  return db.$transaction(async (tx) => {
    const p = await tx.proforma.findUnique({
      where: { id },
      include: { kalemler: { orderBy: { id: "asc" } } },
    });
    if (!p) throw new Error("Teklif bulunamadı.");

    if (!donusturulebilirMi(p.durum as ProformaDurumuValue)) {
      throw new Error(
        "Yalnızca kabul edilen teklif faturaya dönüştürülebilir."
      );
    }
    if (p.islemId) {
      throw new Error("Bu teklif zaten faturalandırılmış.");
    }
    if (p.kalemler.length === 0) {
      throw new Error("Kalemsiz teklif faturaya dönüştürülemez.");
    }

    const islem = await islemYaz(tx, {
      // Teklif her zaman bizim müşterimize verilir → SATIS.
      tip: "SATIS",
      cariId: p.cariId,
      tarih: secenek.tarih ?? new Date(),
      vadeTarihi: secenek.vadeTarihi,
      kalemler: p.kalemler.map((k) => ({
        urunAdi: k.urunAdi,
        miktar: k.miktar.toString(),
        birimFiyat: k.birimFiyat.toString(),
        kdvOrani: k.kdvOrani.toString(),
      })),
    });

    await tx.proforma.update({
      where: { id },
      data: { durum: "ISLEME_DONUSTU", islemId: islem.id },
    });

    return { islemId: islem.id };
  });
}
