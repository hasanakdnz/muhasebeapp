import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import {
  cariBakiyesiniDogrula,
  cariGuncelle,
  cariOlustur,
  cariSilinebilirMi,
  getCari,
} from "@/lib/cari";
import {
  donemselToplamlar,
  getIslem,
  islemOlustur,
  islemSil,
  listeleIslemler,
} from "@/lib/islem";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 2, g);

async function cariEkle(unvan: string, acilis = "0") {
  return cariOlustur(
    { unvan, tip: "HER_IKISI", acilisBakiyesi: acilis },
    db.prisma
  );
}

/** 1 adet × 1000 TL, %20 KDV → toplam 1200 TL. */
const bin_yirmi = [
  { urunAdi: "Danışmanlık", miktar: "1", birimFiyat: "1000", kdvOrani: "20" },
];

describe("İşlem oluşturma — cari bakiye güncelleme", () => {
  it("satış cari bakiyesini işlem tutarı kadar ARTIRIR", async () => {
    const cari = await cariEkle("Satış Müşterisi", "500");

    await islemOlustur(
      { tip: "SATIS", cariId: cari.id, tarih: gun(1), kalemler: bin_yirmi },
      db.prisma
    );

    // 500 açılış + 1200 satış
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("1700");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("alış cari bakiyesini işlem tutarı kadar AZALTIR", async () => {
    const cari = await cariEkle("Alış Tedarikçisi", "500");

    await islemOlustur(
      { tip: "ALIS", cariId: cari.id, tarih: gun(1), kalemler: bin_yirmi },
      db.prisma
    );

    // 500 açılış - 1200 alış
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("-700");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("KDV'yi ve matrahı işlem üzerinde doğru saklar", async () => {
    const cari = await cariEkle("KDV Müşterisi");
    const { id } = await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(2),
        kalemler: [
          { urunAdi: "Ürün A", miktar: "2", birimFiyat: "500", kdvOrani: "20" },
          { urunAdi: "Ürün B", miktar: "3", birimFiyat: "100", kdvOrani: "10" },
        ],
      },
      db.prisma
    );

    const islem = await getIslem(id, db.prisma);
    // matrah 1000 + 300 = 1300, kdv 200 + 30 = 230
    expect(islem?.matrah).toBe("1300");
    expect(islem?.kdvTutari).toBe("230");
    expect(islem?.toplamTutar).toBe("1530");
    expect(islem?.kalemler).toHaveLength(2);
    expect(islem?.kalemler[0]).toMatchObject({
      urunAdi: "Ürün A",
      matrah: "1000",
      kdv: "200",
      brut: "1200",
    });
  });

  it("birden fazla işlemde bakiye mutabık kalır", async () => {
    const cari = await cariEkle("Yoğun Cari", "1000");

    await islemOlustur(
      { tip: "SATIS", cariId: cari.id, tarih: gun(1), kalemler: bin_yirmi },
      db.prisma
    );
    await islemOlustur(
      { tip: "ALIS", cariId: cari.id, tarih: gun(2), kalemler: bin_yirmi },
      db.prisma
    );
    await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(3),
        kalemler: [
          { urunAdi: "Kuruşlu", miktar: "3", birimFiyat: "33.33", kdvOrani: "20" },
        ],
      },
      db.prisma
    );

    // 1000 + 1200 - 1200 + (99.99 + 20) = 1119.99
    const kontrol = await cariBakiyesiniDogrula(cari.id, db.prisma);
    expect(kontrol.mutabik).toBe(true);
    expect(kontrol.saklanan).toBe("1119.99");
  });

  it("kalemsiz işlem oluşturulamaz", async () => {
    const cari = await cariEkle("Kalemsiz");
    await expect(
      islemOlustur(
        { tip: "SATIS", cariId: cari.id, tarih: gun(1), kalemler: [] },
        db.prisma
      )
    ).rejects.toThrow();
  });

  it("olmayan cariye işlem yazılamaz ve bakiye bozulmaz", async () => {
    await expect(
      islemOlustur(
        { tip: "SATIS", cariId: "yok-boyle-bir-id", tarih: gun(1), kalemler: bin_yirmi },
        db.prisma
      )
    ).rejects.toThrow();
  });
});

describe("İşlem silme — bakiye geri alma", () => {
  it("silinen işlemin etkisini cari bakiyesinden tam olarak geri alır", async () => {
    const cari = await cariEkle("Geri Alma Carisi", "2000");

    const islem = await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Hizmet", miktar: "7", birimFiyat: "12.35", kdvOrani: "10" },
        ],
      },
      db.prisma
    );
    // matrah 86.45 + kdv 8.65 = 95.10
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("2095.1");

    await islemSil(islem.id, db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("2000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("tüm işlemler silindiğinde bakiye açılışa döner", async () => {
    const cari = await cariEkle("Sıfırlanan Cari", "750.25");

    const idler: string[] = [];
    for (const tip of ["SATIS", "ALIS", "SATIS"] as const) {
      const i = await islemOlustur(
        { tip, cariId: cari.id, tarih: gun(1), kalemler: bin_yirmi },
        db.prisma
      );
      idler.push(i.id);
    }
    for (const id of idler) await islemSil(id, db.prisma);

    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("750.25");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("işlemi olan cari silinemez", async () => {
    const cari = await cariEkle("İşlemli Cari");
    await islemOlustur(
      { tip: "SATIS", cariId: cari.id, tarih: gun(1), kalemler: bin_yirmi },
      db.prisma
    );

    const durum = await cariSilinebilirMi(cari.id, db.prisma);
    expect(durum.silinebilir).toBe(false);
    expect(durum.islemSayisi).toBe(1);
  });
});

describe("Açılış bakiyesi düzenleme", () => {
  it("açılış değişince yürüyen bakiye işlem etkileriyle yeniden hesaplanır", async () => {
    // Bu, `bakiye` alanının elle yazılmadığının kanıtı: açılış güncellenince
    // yürüyen bakiye açılış + Σ(işlem) formülünden yeniden doğar.
    const cari = await cariEkle("Açılışı Düzelen", "1000");
    await islemOlustur(
      { tip: "SATIS", cariId: cari.id, tarih: gun(1), kalemler: bin_yirmi },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("2200");

    await cariGuncelle(
      cari.id,
      { unvan: "Açılışı Düzelen", tip: "HER_IKISI", acilisBakiyesi: "2500" },
      db.prisma
    );

    // 2500 açılış + 1200 satış
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("3700");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Listeleme ve dönemsel toplamlar", () => {
  it("işlemleri tarihe göre yeniden eskiye sıralar", async () => {
    const cari = await cariEkle("Sıralama Carisi");
    await islemOlustur(
      { tip: "SATIS", cariId: cari.id, tarih: gun(10), kalemler: bin_yirmi },
      db.prisma
    );
    await islemOlustur(
      { tip: "SATIS", cariId: cari.id, tarih: gun(20), kalemler: bin_yirmi },
      db.prisma
    );

    const liste = await listeleIslemler({ cariId: cari.id }, db.prisma);
    expect(liste).toHaveLength(2);
    expect(liste[0].tarih.getTime()).toBeGreaterThan(liste[1].tarih.getTime());
    expect(liste[0].cariUnvan).toBe("Sıralama Carisi");
  });

  it("tipe göre filtreler", async () => {
    const cari = await cariEkle("Filtre Carisi");
    await islemOlustur(
      { tip: "ALIS", cariId: cari.id, tarih: gun(5), kalemler: bin_yirmi },
      db.prisma
    );
    const sonuc = await listeleIslemler(
      { cariId: cari.id, tip: "ALIS" },
      db.prisma
    );
    expect(sonuc.every((i) => i.tip === "ALIS")).toBe(true);
  });

  it("dönemsel satış/alış toplamlarını ayırır", async () => {
    const cari = await cariEkle("Dönem Carisi");
    await islemOlustur(
      { tip: "SATIS", cariId: cari.id, tarih: new Date(2027, 5, 10), kalemler: bin_yirmi },
      db.prisma
    );
    await islemOlustur(
      { tip: "ALIS", cariId: cari.id, tarih: new Date(2027, 5, 20), kalemler: bin_yirmi },
      db.prisma
    );
    // Dönem dışı — toplamlara girmemeli
    await islemOlustur(
      { tip: "SATIS", cariId: cari.id, tarih: new Date(2027, 7, 1), kalemler: bin_yirmi },
      db.prisma
    );

    const toplam = await donemselToplamlar(
      { baslangic: new Date(2027, 5, 1), bitis: new Date(2027, 5, 30) },
      db.prisma
    );
    expect(toplam.satis).toBe("1200");
    expect(toplam.alis).toBe("1200");
    expect(toplam.satisKdv).toBe("200");
    expect(toplam.islemSayisi).toBe(2);
  });
});
