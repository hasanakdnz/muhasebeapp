import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import {
  ACILIS_ACIKLAMASI,
  getHesap,
  hareketEkle,
  hareketSil,
  hesapBakiyesiniDogrula,
  hesapOlustur,
  hesapSil,
  hesapSilinebilirMi,
  hesaplaHesapOzeti,
  listeleHareketler,
  listeleHesaplar,
  setHesapAktif,
} from "@/lib/kasa";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 0, g);

describe("Hesap tanımlama", () => {
  it("açılış bakiyesini ayrı bir hareket olarak kaydeder", async () => {
    // Değişmez: bakiye alanı doğrudan yazılmaz, hareketlerden doğar.
    const { id } = await hesapOlustur(
      { ad: "Merkez Kasa", tip: "KASA", acilisBakiyesi: "5000.50", acilisTarihi: gun(1) },
      db.prisma
    );

    const hesap = await getHesap(id, db.prisma);
    expect(hesap?.bakiye).toBe("5000.5");
    expect(hesap?.hareketSayisi).toBe(1);

    const hareketler = await listeleHareketler(id, db.prisma);
    expect(hareketler[0].aciklama).toBe(ACILIS_ACIKLAMASI);
    expect(hareketler[0].tutar).toBe("5000.5");

    const kontrol = await hesapBakiyesiniDogrula(id, db.prisma);
    expect(kontrol.mutabik).toBe(true);
  });

  it("açılış bakiyesi sıfırsa hiç hareket oluşturmaz", async () => {
    const { id } = await hesapOlustur(
      { ad: "Boş Kasa", tip: "KASA", acilisBakiyesi: "0", acilisTarihi: gun(1) },
      db.prisma
    );
    const hesap = await getHesap(id, db.prisma);
    expect(hesap?.bakiye).toBe("0");
    expect(hesap?.hareketSayisi).toBe(0);
    expect((await hesapBakiyesiniDogrula(id, db.prisma)).mutabik).toBe(true);
  });

  it("negatif açılış bakiyesini kabul eder (kasa açığı)", async () => {
    const { id } = await hesapOlustur(
      { ad: "Açık Kasa", tip: "KASA", acilisBakiyesi: "-250.75", acilisTarihi: gun(1) },
      db.prisma
    );
    expect((await getHesap(id, db.prisma))?.bakiye).toBe("-250.75");
    expect((await hesapBakiyesiniDogrula(id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Hareket ekleme — bakiye güncellemesi", () => {
  it("giriş bakiyeyi artırır, çıkış azaltır", async () => {
    const { id } = await hesapOlustur(
      { ad: "İşlem Kasası", tip: "KASA", acilisBakiyesi: "1000", acilisTarihi: gun(1) },
      db.prisma
    );

    await hareketEkle(
      id,
      { yon: "GIRIS", tutar: "500.25", aciklama: "Tahsilat", tarih: gun(2) },
      db.prisma
    );
    expect((await getHesap(id, db.prisma))?.bakiye).toBe("1500.25");

    await hareketEkle(
      id,
      { yon: "CIKIS", tutar: "300.75", aciklama: "Ödeme", tarih: gun(3) },
      db.prisma
    );
    expect((await getHesap(id, db.prisma))?.bakiye).toBe("1199.5");

    expect((await hesapBakiyesiniDogrula(id, db.prisma)).mutabik).toBe(true);
  });

  it("uzun giriş/çıkış dizisinde saklanan bakiye hareket toplamıyla mutabık kalır", async () => {
    const { id } = await hesapOlustur(
      { ad: "Yoğun Hesap", tip: "BANKA", acilisBakiyesi: "0", acilisTarihi: gun(1) },
      db.prisma
    );

    // Kuruşlu, karışık yönlü 40 hareket — float olsaydı kayma birikirdi.
    for (let i = 1; i <= 40; i += 1) {
      await hareketEkle(
        id,
        {
          yon: i % 3 === 0 ? "CIKIS" : "GIRIS",
          tutar: "0.01",
          tarih: gun(1),
        },
        db.prisma
      );
    }

    const kontrol = await hesapBakiyesiniDogrula(id, db.prisma);
    expect(kontrol.mutabik).toBe(true);
    // 27 giriş, 13 çıkış → (27 - 13) * 0.01 = 0.14
    expect(kontrol.saklanan).toBe("0.14");
  });

  it("bakiye negatife düşebilir", async () => {
    const { id } = await hesapOlustur(
      { ad: "Eksiye Düşen", tip: "KASA", acilisBakiyesi: "100", acilisTarihi: gun(1) },
      db.prisma
    );
    await hareketEkle(
      id,
      { yon: "CIKIS", tutar: "450.75", tarih: gun(2) },
      db.prisma
    );
    expect((await getHesap(id, db.prisma))?.bakiye).toBe("-350.75");
    expect((await hesapBakiyesiniDogrula(id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Hareket silme — bakiye geri alma", () => {
  it("silinen hareketin etkisini bakiyeden tam olarak geri alır", async () => {
    const { id } = await hesapOlustur(
      { ad: "Geri Alma Kasası", tip: "KASA", acilisBakiyesi: "2000", acilisTarihi: gun(1) },
      db.prisma
    );

    const hareket = await hareketEkle(
      id,
      { yon: "CIKIS", tutar: "375.25", tarih: gun(2) },
      db.prisma
    );
    expect((await getHesap(id, db.prisma))?.bakiye).toBe("1624.75");

    await hareketSil(hareket.id, db.prisma);
    expect((await getHesap(id, db.prisma))?.bakiye).toBe("2000");
    expect((await hesapBakiyesiniDogrula(id, db.prisma)).mutabik).toBe(true);
  });

  it("tüm hareketler silindiğinde bakiye tam sıfıra döner", async () => {
    const { id } = await hesapOlustur(
      { ad: "Sıfırlanan Hesap", tip: "BANKA", acilisBakiyesi: "0", acilisTarihi: gun(1) },
      db.prisma
    );

    const idler: string[] = [];
    for (const [yon, tutar] of [
      ["GIRIS", "1234.56"],
      ["CIKIS", "0.07"],
      ["GIRIS", "0.01"],
      ["CIKIS", "999.99"],
    ] as const) {
      const h = await hareketEkle(id, { yon, tutar, tarih: gun(2) }, db.prisma);
      idler.push(h.id);
    }

    for (const hid of idler) await hareketSil(hid, db.prisma);

    expect((await getHesap(id, db.prisma))?.bakiye).toBe("0");
    expect((await hesapBakiyesiniDogrula(id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Ekstre — yürüyen bakiye", () => {
  it("hareketleri yeniden eskiye sıralar ve doğru yürüyen bakiye verir", async () => {
    const { id } = await hesapOlustur(
      { ad: "Ekstre Hesabı", tip: "BANKA", acilisBakiyesi: "1000", acilisTarihi: gun(1) },
      db.prisma
    );
    await hareketEkle(id, { yon: "CIKIS", tutar: "250", tarih: gun(5) }, db.prisma);
    await hareketEkle(id, { yon: "GIRIS", tutar: "500", tarih: gun(10) }, db.prisma);

    const ekstre = await listeleHareketler(id, db.prisma);

    // En yeni hareket başta
    expect(ekstre.map((h) => h.tutar)).toEqual(["500", "-250", "1000"]);
    expect(ekstre.map((h) => h.yurutulenBakiye)).toEqual(["1250", "750", "1000"]);
    expect(ekstre.map((h) => h.yon)).toEqual(["GIRIS", "CIKIS", "GIRIS"]);

    // En yeni hareketin yürüyen bakiyesi hesabın güncel bakiyesidir.
    expect(ekstre[0].yurutulenBakiye).toBe(
      (await getHesap(id, db.prisma))?.bakiye
    );
  });
});

describe("Hesap silme ve pasife alma", () => {
  it("hareketi olmayan hesap silinebilir", async () => {
    const { id } = await hesapOlustur(
      { ad: "Silinecek Hesap", tip: "KASA", acilisBakiyesi: "0", acilisTarihi: gun(1) },
      db.prisma
    );
    expect((await hesapSilinebilirMi(id, db.prisma)).silinebilir).toBe(true);

    await hesapSil(id, db.prisma);
    expect(await getHesap(id, db.prisma)).toBeNull();
  });

  it("hareketi olan hesap silinemez — açılış bakiyesi de hareket sayılır", async () => {
    const { id } = await hesapOlustur(
      { ad: "Hareketli Hesap", tip: "KASA", acilisBakiyesi: "100", acilisTarihi: gun(1) },
      db.prisma
    );
    const durum = await hesapSilinebilirMi(id, db.prisma);
    expect(durum.silinebilir).toBe(false);
    expect(durum.hareketSayisi).toBe(1);
  });

  it("pasife alınan hesap varsayılan listede görünmez", async () => {
    const { id } = await hesapOlustur(
      { ad: "Pasif Hesap", tip: "BANKA", acilisBakiyesi: "0", acilisTarihi: gun(1) },
      db.prisma
    );
    await setHesapAktif(id, false, db.prisma);

    const varsayilan = await listeleHesaplar({}, db.prisma);
    expect(varsayilan.some((h) => h.id === id)).toBe(false);

    const hepsi = await listeleHesaplar({ pasifleriGoster: true }, db.prisma);
    expect(hepsi.some((h) => h.id === id)).toBe(true);
  });
});

describe("hesaplaHesapOzeti", () => {
  it("kasa ve banka toplamlarını ayrı ayrı verir", () => {
    const ozet = hesaplaHesapOzeti([
      { id: "1", ad: "K1", tip: "KASA", bakiye: "1000.50", aktif: true, hareketSayisi: 1 },
      { id: "2", ad: "K2", tip: "KASA", bakiye: "-200.25", aktif: true, hareketSayisi: 1 },
      { id: "3", ad: "B1", tip: "BANKA", bakiye: "5000", aktif: true, hareketSayisi: 1 },
    ]);
    expect(ozet.kasaToplami).toBe("800.25");
    expect(ozet.bankaToplami).toBe("5000");
    expect(ozet.genelToplam).toBe("5800.25");
  });
});
