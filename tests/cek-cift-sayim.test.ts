import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { cariBakiyesiniDogrula, cariOlustur, getCari } from "@/lib/cari";
import {
  cekSenetOlustur,
  durumDegistir,
  listeleCekSenetler,
  tahsilatEkle,
} from "@/lib/cek-senet";
import { hesaplaPortfoyOzeti } from "@/lib/domain/cek-senet";
import { islemOlustur } from "@/lib/islem";
import { kullanilabilirCekler, odemeEkle } from "@/lib/odeme";

/**
 * Regresyon: cari bakiyesi ile çek portföyü AYNI parayı iki kez göstermemeli.
 *
 * Eski modelde çekin etkisi tahsilat anında işleniyordu; bu yüzden müşteri
 * borcunu çekle kapattığında borç hem cari alacağında hem çek portföyünde
 * duruyor, patronun gördüğü alacak iki katına çıkıyordu (10.000'lik alacak
 * 20.000 görünüyordu). Bu dosya o hatanın geri gelmesini engeller.
 */

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 8, g);

async function cariEkle(unvan: string, acilis = "0") {
  return cariOlustur(
    { unvan, tip: "HER_IKISI", acilisBakiyesi: acilis },
    db.prisma
  );
}

async function portfoy() {
  const kayitlar = await listeleCekSenetler({}, db.prisma);
  return hesaplaPortfoyOzeti(
    kayitlar.map((c) => ({
      yon: c.yon,
      durum: c.durum,
      tutar: c.tutar,
      tahsilEdilen: c.tahsilEdilen,
    }))
  );
}

describe("Müşteri borcunu çekle kapattığında", () => {
  it("alacak çift sayılmaz: cari 0, portföy 10.000", async () => {
    const cari = await cariEkle("Çift Sayım Müşterisi");

    await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Mal", miktar: "1", birimFiyat: "10000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("10000");

    await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "10000",
        vadeTarihi: gun(30),
      },
      db.prisma
    );

    const bakiye = (await getCari(cari.id, db.prisma))?.bakiye;
    const ozet = await portfoy();

    expect(bakiye).toBe("0");
    expect(ozet.tahsilEdilecek).toBe("10000");
    // Asıl kural: ikisinin toplamı gerçek alacağı aşmamalı.
    expect(Number(bakiye) + Number(ozet.tahsilEdilecek)).toBe(10000);
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Tedarikçiye çek verildiğinde", () => {
  it("borç çift sayılmaz: cari 0, portföy 8.000", async () => {
    const cari = await cariEkle("Çift Sayım Tedarikçisi");

    await islemOlustur(
      {
        tip: "ALIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Hammadde", miktar: "1", birimFiyat: "8000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("-8000");

    await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "VERILEN",
        cariId: cari.id,
        tutar: "8000",
        vadeTarihi: gun(30),
      },
      db.prisma
    );

    const bakiye = (await getCari(cari.id, db.prisma))?.bakiye;
    const ozet = await portfoy();

    expect(bakiye).toBe("0");
    expect(Number(ozet.odenecek)).toBe(8000);
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Karşılıksız çek", () => {
  it("hiç tahsil edilmemişse borcun TAMAMI geri gelir", async () => {
    const cari = await cariEkle("Karşılıksız Tam");
    await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Mal", miktar: "1", birimFiyat: "5000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: cari.id, tutar: "5000", vadeTarihi: gun(30) },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");

    await durumDegistir(cek.id, "KARSILIKSIZ", db.prisma);

    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("5000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("kısmen tahsil edilmişse yalnızca TAHSİL EDİLEMEYEN kısım geri gelir", async () => {
    const cari = await cariEkle("Karşılıksız Kısmi");
    await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Mal", miktar: "1", birimFiyat: "5000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: cari.id, tutar: "5000", vadeTarihi: gun(30) },
      db.prisma
    );
    await tahsilatEkle(cek.id, { tutar: "2000", tarih: gun(5) }, db.prisma);

    await durumDegistir(cek.id, "KARSILIKSIZ", db.prisma);

    // 2.000 tahsil edildi, 3.000 yandı → müşteri 3.000 borçlu kalmalı.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("3000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("portföye geri döndürülünce borç yeniden kapanır", async () => {
    const cari = await cariEkle("Karşılıksız Geri Dönüş");
    await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Mal", miktar: "1", birimFiyat: "5000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: cari.id, tutar: "5000", vadeTarihi: gun(30) },
      db.prisma
    );

    await durumDegistir(cek.id, "KARSILIKSIZ", db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("5000");

    await durumDegistir(cek.id, "PORTFOYDE", db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Çek başka cariye taşınırsa", () => {
  it("eski caride etki asılı kalmaz", async () => {
    const eski = await cariEkle("Eski Cari");
    const yeni = await cariEkle("Yeni Cari");

    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: eski.id, tutar: "4000", vadeTarihi: gun(30) },
      db.prisma
    );
    expect((await getCari(eski.id, db.prisma))?.bakiye).toBe("-4000");

    const { cekSenetGuncelle } = await import("@/lib/cek-senet");
    await cekSenetGuncelle(
      cek.id,
      { tip: "CEK", yon: "ALINAN", cariId: yeni.id, tutar: "4000", vadeTarihi: gun(30) },
      db.prisma
    );

    expect((await getCari(eski.id, db.prisma))?.bakiye).toBe("0");
    expect((await getCari(yeni.id, db.prisma))?.bakiye).toBe("-4000");
    expect((await cariBakiyesiniDogrula(eski.id, db.prisma)).mutabik).toBe(true);
    expect((await cariBakiyesiniDogrula(yeni.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Fatura ödemesi çek tahsilatına bağlanınca", () => {
  it("borç ikinci kez düşmez", async () => {
    const cari = await cariEkle("Fatura + Çek");

    const islem = await islemOlustur(
      {
        tip: "SATIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Mal", miktar: "1", birimFiyat: "6000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: cari.id, tutar: "6000", vadeTarihi: gun(30) },
      db.prisma
    );
    // Çek alındı → cari kapandı.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");

    await tahsilatEkle(cek.id, { tutar: "6000", tarih: gun(10) }, db.prisma);

    const secenekler = await kullanilabilirCekler(cari.id, db.prisma);
    expect(secenekler).toHaveLength(1);

    await odemeEkle(
      islem.id,
      {
        tutar: "6000",
        tarih: gun(10),
        kaynak: "CEK",
        cekSenetId: secenekler[0].cekSenetId,
      },
      db.prisma
    );

    // Fatura kapanır ama bakiye 0'da kalır — para bir kez sayıldı.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});
