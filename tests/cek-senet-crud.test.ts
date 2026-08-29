import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { cariBakiyesiniDogrula, cariOlustur, getCari } from "@/lib/cari";
import { islemOlustur } from "@/lib/islem";
import {
  cekSenetGuncelle,
  cekSenetOlustur,
  cekSenetSil,
  cekSenetiDogrula,
  durumDegistir,
  getCekSenet,
  tahsilatEkle,
  tahsilatSil,
} from "@/lib/cek-senet";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 3, g);

async function cariEkle(unvan: string, acilis = "0") {
  return cariOlustur(
    { unvan, tip: "HER_IKISI", acilisBakiyesi: acilis },
    db.prisma
  );
}

async function cekEkle(
  cariId: string,
  tutar: string,
  yon: "ALINAN" | "VERILEN" = "ALINAN"
) {
  return cekSenetOlustur(
    { tip: "CEK", yon, cariId, tutar, vadeTarihi: gun(30) },
    db.prisma
  );
}

describe("Çek/senet kaydı", () => {
  it("kayıt cari bakiyesini DEĞİŞTİRMEZ — borç tahsil edildikçe kapanır", async () => {
    const cari = await cariEkle("Kayıt Carisi", "10000");
    await cekEkle(cari.id, "5000");

    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("10000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("yeni kayıt portföyde ve tahsil edilmemiş başlar", async () => {
    const cari = await cariEkle("Portföy Carisi");
    const { id } = await cekEkle(cari.id, "5000");

    const kayit = await getCekSenet(id, db.prisma);
    expect(kayit?.durum).toBe("PORTFOYDE");
    expect(kayit?.tahsilEdilen).toBe("0");
    expect(kayit?.kalan).toBe("5000");
  });
});

describe("Tam tahsilat", () => {
  it("tek seferde tam tahsilat durumu TAHSIL_EDILDI yapar ve borcu kapatır", async () => {
    const cari = await cariEkle("Tam Tahsilat", "12000");
    const cek = await cekEkle(cari.id, "12000");

    await tahsilatEkle(cek.id, { tutar: "12000", tarih: gun(5) }, db.prisma);

    const kayit = await getCekSenet(cek.id, db.prisma);
    expect(kayit?.durum).toBe("TAHSIL_EDILDI");
    expect(kayit?.tahsilEdilen).toBe("12000");
    expect(kayit?.kalan).toBe("0");

    // Alınan çek tahsil edilince carinin borcu kapanır.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
    expect((await cekSenetiDogrula(cek.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Kısmi tahsilat", () => {
  it("kısmi tahsilatta durum PORTFOYDE kalır, bakiye kısmen düşer", async () => {
    const cari = await cariEkle("Kısmi Tahsilat", "10000");
    const cek = await cekEkle(cari.id, "10000");

    await tahsilatEkle(cek.id, { tutar: "3500.50", tarih: gun(5) }, db.prisma);

    const kayit = await getCekSenet(cek.id, db.prisma);
    expect(kayit?.durum).toBe("PORTFOYDE");
    expect(kayit?.tahsilEdilen).toBe("3500.5");
    expect(kayit?.kalan).toBe("6499.5");

    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("6499.5");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("kalandan fazla tahsilat reddedilir ve hiçbir şey değişmez", async () => {
    const cari = await cariEkle("Fazla Tahsilat", "10000");
    const cek = await cekEkle(cari.id, "10000");
    await tahsilatEkle(cek.id, { tutar: "4000", tarih: gun(5) }, db.prisma);

    await expect(
      tahsilatEkle(cek.id, { tutar: "6000.01", tarih: gun(6) }, db.prisma)
    ).rejects.toThrow(/kalan tutardan büyük/i);

    // Reddedilen tahsilat hiçbir yan etki bırakmamalı.
    const kayit = await getCekSenet(cek.id, db.prisma);
    expect(kayit?.tahsilEdilen).toBe("4000");
    expect(kayit?.tahsilatlar).toHaveLength(1);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("6000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Birden fazla kısmi tahsilat", () => {
  it("art arda kısmi tahsilatlar tutarı tamamlayınca TAHSIL_EDILDI olur", async () => {
    const cari = await cariEkle("Çok Parçalı", "10000");
    const cek = await cekEkle(cari.id, "10000");

    await tahsilatEkle(cek.id, { tutar: "2500", tarih: gun(5) }, db.prisma);
    expect((await getCekSenet(cek.id, db.prisma))?.durum).toBe("PORTFOYDE");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("7500");

    await tahsilatEkle(cek.id, { tutar: "3000.25", tarih: gun(10) }, db.prisma);
    expect((await getCekSenet(cek.id, db.prisma))?.durum).toBe("PORTFOYDE");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("4499.75");

    await tahsilatEkle(cek.id, { tutar: "4499.75", tarih: gun(15) }, db.prisma);

    const kayit = await getCekSenet(cek.id, db.prisma);
    expect(kayit?.durum).toBe("TAHSIL_EDILDI");
    expect(kayit?.tahsilEdilen).toBe("10000");
    expect(kayit?.kalan).toBe("0");
    expect(kayit?.tahsilatlar).toHaveLength(3);

    // Parçalı tahsilat, tek seferlik tahsilatla aynı sonucu vermeli.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
    expect((await cekSenetiDogrula(cek.id, db.prisma)).mutabik).toBe(true);
  });

  it("çok sayıda kuruşlu tahsilatta kuruş kaymaz", async () => {
    const cari = await cariEkle("Kuruşlu", "1");
    const cek = await cekEkle(cari.id, "1");

    for (let i = 0; i < 100; i += 1) {
      await tahsilatEkle(cek.id, { tutar: "0.01", tarih: gun(5) }, db.prisma);
    }

    const kayit = await getCekSenet(cek.id, db.prisma);
    expect(kayit?.tahsilEdilen).toBe("1");
    expect(kayit?.durum).toBe("TAHSIL_EDILDI");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cekSenetiDogrula(cek.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Verilen çek — ters yön", () => {
  it("verilen çek ödenince bizim borcumuz azalır (bakiye yükselir)", async () => {
    const cari = await cariEkle("Tedarikçi", "-8000");
    const cek = await cekEkle(cari.id, "8000", "VERILEN");

    await tahsilatEkle(cek.id, { tutar: "3000", tarih: gun(5) }, db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("-5000");

    await tahsilatEkle(cek.id, { tutar: "5000", tarih: gun(10) }, db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await getCekSenet(cek.id, db.prisma))?.durum).toBe("TAHSIL_EDILDI");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Tahsilat geri alma", () => {
  it("silinen tahsilat bakiyeyi ve durumu eski hâline döndürür", async () => {
    const cari = await cariEkle("Geri Alma", "10000");
    const cek = await cekEkle(cari.id, "10000");

    const t1 = await tahsilatEkle(cek.id, { tutar: "4000", tarih: gun(5) }, db.prisma);
    await tahsilatEkle(cek.id, { tutar: "6000", tarih: gun(6) }, db.prisma);
    expect((await getCekSenet(cek.id, db.prisma))?.durum).toBe("TAHSIL_EDILDI");

    await tahsilatSil(t1.id, db.prisma);

    const kayit = await getCekSenet(cek.id, db.prisma);
    expect(kayit?.tahsilEdilen).toBe("6000");
    // Tamamlanmış kayıt, tahsilat geri alınınca portföye döner.
    expect(kayit?.durum).toBe("PORTFOYDE");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("4000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("tüm tahsilatlar silinince bakiye başlangıca döner", async () => {
    const cari = await cariEkle("Tam Geri Alma", "10000");
    const cek = await cekEkle(cari.id, "10000");

    const idler: string[] = [];
    for (const tutar of ["1234.56", "0.07", "8765.37"]) {
      const t = await tahsilatEkle(cek.id, { tutar, tarih: gun(5) }, db.prisma);
      idler.push(t.id);
    }
    for (const id of idler) await tahsilatSil(id, db.prisma);

    expect((await getCekSenet(cek.id, db.prisma))?.tahsilEdilen).toBe("0");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("10000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Durum değişiklikleri", () => {
  it("portföydeki çek karşılıksız işaretlenebilir, tahsilata kapanır", async () => {
    const cari = await cariEkle("Karşılıksız", "5000");
    const cek = await cekEkle(cari.id, "5000");

    await durumDegistir(cek.id, "KARSILIKSIZ", db.prisma);
    expect((await getCekSenet(cek.id, db.prisma))?.durum).toBe("KARSILIKSIZ");

    await expect(
      tahsilatEkle(cek.id, { tutar: "100", tarih: gun(5) }, db.prisma)
    ).rejects.toThrow();

    // Karşılıksız çekte borç açık kalır — hiç tahsilat olmadığı için
    // bakiyede düzeltme gerekmez.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("5000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("kısmen tahsil edilmiş çek ciro edilemez", async () => {
    const cari = await cariEkle("Ciro Denemesi", "5000");
    const cek = await cekEkle(cari.id, "5000");
    await tahsilatEkle(cek.id, { tutar: "1000", tarih: gun(5) }, db.prisma);

    await expect(durumDegistir(cek.id, "CIRO_EDILDI", db.prisma)).rejects.toThrow(
      /ciro edilemez/i
    );
  });

  it("TAHSIL_EDILDI elle seçilemez", async () => {
    const cari = await cariEkle("Elle Tahsil");
    const cek = await cekEkle(cari.id, "5000");
    await expect(
      durumDegistir(cek.id, "TAHSIL_EDILDI", db.prisma)
    ).rejects.toThrow(/elle seçilemez/i);
  });

  it("portföye döndürülen tamamlanmış kayıt yine TAHSIL_EDILDI olur", async () => {
    const cari = await cariEkle("Geri Dönüş", "5000");
    const cek = await cekEkle(cari.id, "5000");
    await tahsilatEkle(cek.id, { tutar: "5000", tarih: gun(5) }, db.prisma);

    await durumDegistir(cek.id, "PORTFOYDE", db.prisma);
    // Tahsilatlar tam olduğu için durum kendiliğinden yeniden TAHSIL_EDILDI olur.
    expect((await getCekSenet(cek.id, db.prisma))?.durum).toBe("TAHSIL_EDILDI");
  });
});

describe("Çek/senet güncelleme ve silme", () => {
  it("tutar, tahsil edilenin altına düşürülemez", async () => {
    const cari = await cariEkle("Tutar Düşürme", "10000");
    const cek = await cekEkle(cari.id, "10000");
    await tahsilatEkle(cek.id, { tutar: "6000", tarih: gun(5) }, db.prisma);

    await expect(
      cekSenetGuncelle(
        cek.id,
        {
          tip: "CEK",
          yon: "ALINAN",
          cariId: cari.id,
          tutar: "5000",
          vadeTarihi: gun(30),
        },
        db.prisma
      )
    ).rejects.toThrow(/altına düşürülemez/i);
  });

  it("tutar tahsil edilene eşitlenince durum TAHSIL_EDILDI olur", async () => {
    const cari = await cariEkle("Tutar Eşitleme", "10000");
    const cek = await cekEkle(cari.id, "10000");
    await tahsilatEkle(cek.id, { tutar: "6000", tarih: gun(5) }, db.prisma);

    await cekSenetGuncelle(
      cek.id,
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "6000",
        vadeTarihi: gun(30),
      },
      db.prisma
    );
    expect((await getCekSenet(cek.id, db.prisma))?.durum).toBe("TAHSIL_EDILDI");
  });

  it("silinen çek/senedin tahsilat etkileri cari bakiyesinden geri alınır", async () => {
    const cari = await cariEkle("Silinecek Çek", "10000");
    const cek = await cekEkle(cari.id, "10000");
    await tahsilatEkle(cek.id, { tutar: "2500", tarih: gun(5) }, db.prisma);
    await tahsilatEkle(cek.id, { tutar: "1500", tarih: gun(6) }, db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("6000");

    await cekSenetSil(cek.id, db.prisma);

    expect(await getCekSenet(cek.id, db.prisma)).toBeNull();
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("10000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Uçtan uca: satış → çek → kısmi tahsilatlar", () => {
  it("satıştan doğan borç, kısmi tahsilatlarla tam olarak kapanır", async () => {
    const cari = await cariEkle("Uçtan Uca", "0");

    // 10.000 matrah + %20 KDV = 12.000 borç
    await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Hizmet", miktar: "1", birimFiyat: "10000", kdvOrani: "20" },
        ],
      },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("12000");

    // Müşteri 12.000'lik çek veriyor — borç henüz kapanmaz.
    const cek = await cekEkle(cari.id, "12000");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("12000");

    await tahsilatEkle(cek.id, { tutar: "5000", tarih: gun(10) }, db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("7000");

    await tahsilatEkle(cek.id, { tutar: "7000", tarih: gun(20) }, db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");

    expect((await getCekSenet(cek.id, db.prisma))?.durum).toBe("TAHSIL_EDILDI");
    // Bakiyenin iki kaynağı da (işlem + tahsilat) mutabakata dahil.
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});
