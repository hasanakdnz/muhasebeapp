import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { cariBakiyesiniDogrula, cariOlustur, getCari } from "@/lib/cari";
import { getIslem } from "@/lib/islem";
import {
  listeleProformalar,
  proformaDurumDegistir,
  proformaGetir,
  proformaGuncelle,
  proformaOlustur,
  proformaSil,
  proformayiIsleDonustur,
} from "@/lib/proforma";
import type { ProformaOutput } from "@/lib/validations/proforma";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 7, g);

async function cariEkle(unvan: string) {
  return cariOlustur(
    { unvan, tip: "MUSTERI", acilisBakiyesi: "0" },
    db.prisma
  );
}

/** 12.000 TL'lik teklif (10.000 matrah + %20 KDV). */
function teklif(cariId: string, ek: Partial<ProformaOutput> = {}) {
  return {
    cariId,
    tarih: gun(1),
    gecerlilikTarihi: undefined,
    notlar: undefined,
    kdvDahil: false,
    kalemler: [
      { urunAdi: "Danışmanlık", miktar: "1", birimFiyat: "10000", kdvOrani: "20" },
    ],
    ...ek,
  } as ProformaOutput;
}

describe("Proforma oluşturma", () => {
  it("KDV'yi işlemle aynı kuralla hesaplar", async () => {
    const cari = await cariEkle("Teklif A");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);

    const detay = await proformaGetir(p.id, gun(1), db.prisma);
    expect(detay?.matrah).toBe("10000");
    expect(detay?.kdvTutari).toBe("2000");
    expect(detay?.toplamTutar).toBe("12000");
    expect(detay?.durum).toBe("TASLAK");
  });

  it("cari bakiyesine DOKUNMAZ — teklif muhasebe kaydı değildir", async () => {
    const cari = await cariEkle("Teklif B");
    await proformaOlustur(teklif(cari.id), db.prisma);

    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect(await cariBakiyesiniDogrula(cari.id, db.prisma)).toMatchObject({
      mutabik: true,
    });
  });

  it("KDV dahil girilen fiyatı net'e çevirerek saklar", async () => {
    const cari = await cariEkle("Teklif C");
    const p = await proformaOlustur(
      teklif(cari.id, {
        kdvDahil: true,
        kalemler: [
          { urunAdi: "Ürün", miktar: "1", birimFiyat: "1200", kdvOrani: "20" },
        ],
      }),
      db.prisma
    );

    const detay = await proformaGetir(p.id, gun(1), db.prisma);
    expect(detay?.kalemler[0].birimFiyat).toBe("1000");
    expect(detay?.toplamTutar).toBe("1200");
  });

  it("numarayı sırayla verir", async () => {
    const cari = await cariEkle("Teklif D");
    const a = await proformaOlustur(teklif(cari.id), db.prisma);
    const b = await proformaOlustur(teklif(cari.id), db.prisma);

    const ayristir = (no: string) => Number(no.split("-")[2]);
    expect(ayristir(b.no)).toBe(ayristir(a.no) + 1);
    expect(a.no).toMatch(/^PRF-2026-\d{4}$/);
  });

  it("olmayan cariye teklif yazılamaz", async () => {
    await expect(
      proformaOlustur(teklif("yok-boyle-bir-cari"), db.prisma)
    ).rejects.toThrow("Cari bulunamadı");
  });
});

describe("Proforma durum geçişleri", () => {
  it("geçersiz geçişi reddeder", async () => {
    const cari = await cariEkle("Durum A");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);

    await expect(
      proformaDurumDegistir(p.id, "KABUL", db.prisma)
    ).rejects.toThrow("geçilemez");
  });

  it("taslak → gönderildi → kabul akışını uygular", async () => {
    const cari = await cariEkle("Durum B");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);

    await proformaDurumDegistir(p.id, "GONDERILDI", db.prisma);
    await proformaDurumDegistir(p.id, "KABUL", db.prisma);

    expect((await proformaGetir(p.id, gun(1), db.prisma))?.durum).toBe("KABUL");
  });
});

describe("Teklifin faturaya dönüşmesi", () => {
  it("kabul edilen teklif işlem üretir ve bakiyeyi O ANDA değiştirir", async () => {
    const cari = await cariEkle("Dönüşüm A");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);

    // Teklif aşamasında bakiye sıfır.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");

    await proformaDurumDegistir(p.id, "GONDERILDI", db.prisma);
    await proformaDurumDegistir(p.id, "KABUL", db.prisma);
    const { islemId } = await proformayiIsleDonustur(
      p.id,
      { tarih: gun(10), vadeTarihi: gun(40) },
      db.prisma
    );

    const islem = await getIslem(islemId, db.prisma);
    expect(islem?.tip).toBe("SATIS");
    expect(islem?.toplamTutar).toBe("12000");
    expect(islem?.kdvTutari).toBe("2000");
    expect(islem?.kalemler).toHaveLength(1);

    // Muhasebe burada başlar.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("12000");
    expect(await cariBakiyesiniDogrula(cari.id, db.prisma)).toMatchObject({
      mutabik: true,
    });

    const detay = await proformaGetir(p.id, gun(10), db.prisma);
    expect(detay?.durum).toBe("ISLEME_DONUSTU");
    expect(detay?.islemId).toBe(islemId);
  });

  it("aynı teklif iki kez faturalandırılamaz", async () => {
    const cari = await cariEkle("Dönüşüm B");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);
    await proformaDurumDegistir(p.id, "GONDERILDI", db.prisma);
    await proformaDurumDegistir(p.id, "KABUL", db.prisma);
    await proformayiIsleDonustur(p.id, { tarih: gun(10) }, db.prisma);

    await expect(
      proformayiIsleDonustur(p.id, { tarih: gun(11) }, db.prisma)
    ).rejects.toThrow("Yalnızca kabul edilen");

    // Tek fatura, tek bakiye etkisi.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("12000");
  });

  it("kabul edilmemiş teklif faturaya dönüşmez ve bakiyeyi etkilemez", async () => {
    const cari = await cariEkle("Dönüşüm C");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);
    await proformaDurumDegistir(p.id, "GONDERILDI", db.prisma);

    await expect(
      proformayiIsleDonustur(p.id, {}, db.prisma)
    ).rejects.toThrow("Yalnızca kabul edilen");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
  });

  it("faturalanmış teklif düzenlenemez ve silinemez", async () => {
    const cari = await cariEkle("Dönüşüm D");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);
    await proformaDurumDegistir(p.id, "GONDERILDI", db.prisma);
    await proformaDurumDegistir(p.id, "KABUL", db.prisma);
    await proformayiIsleDonustur(p.id, {}, db.prisma);

    await expect(
      proformaGuncelle(p.id, teklif(cari.id), db.prisma)
    ).rejects.toThrow("düzenlenemez");
    await expect(proformaSil(p.id, db.prisma)).rejects.toThrow("silinemez");
  });
});

describe("Proforma güncelleme ve silme", () => {
  it("kalemler değişince toplamlar yeniden hesaplanır", async () => {
    const cari = await cariEkle("Güncelle A");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);

    await proformaGuncelle(
      p.id,
      teklif(cari.id, {
        kalemler: [
          { urunAdi: "Ürün", miktar: "2", birimFiyat: "500", kdvOrani: "10" },
        ],
      }),
      db.prisma
    );

    const detay = await proformaGetir(p.id, gun(1), db.prisma);
    expect(detay?.kalemler).toHaveLength(1);
    expect(detay?.matrah).toBe("1000");
    expect(detay?.kdvTutari).toBe("100");
    expect(detay?.toplamTutar).toBe("1100");
  });

  it("silinen teklif listeden çıkar, cari bakiyesi etkilenmez", async () => {
    const cari = await cariEkle("Sil A");
    const p = await proformaOlustur(teklif(cari.id), db.prisma);

    await proformaSil(p.id, db.prisma);

    const liste = await listeleProformalar({ cariId: cari.id }, gun(1), db.prisma);
    expect(liste).toHaveLength(0);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
  });
});

describe("Süresi dolan teklif", () => {
  it("listede süresi dolmuş olarak işaretlenir", async () => {
    const cari = await cariEkle("Süre A");
    const p = await proformaOlustur(
      teklif(cari.id, { gecerlilikTarihi: gun(5) }),
      db.prisma
    );
    await proformaDurumDegistir(p.id, "GONDERILDI", db.prisma);

    const [once] = await listeleProformalar({ cariId: cari.id }, gun(5), db.prisma);
    expect(once.suresiDoldu).toBe(false);

    const [sonra] = await listeleProformalar({ cariId: cari.id }, gun(6), db.prisma);
    expect(sonra.suresiDoldu).toBe(true);
  });
});
