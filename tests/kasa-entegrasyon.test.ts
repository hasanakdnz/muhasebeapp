import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { cariBakiyesiniDogrula, cariOlustur, getCari } from "@/lib/cari";
import { cekSenetOlustur, tahsilatEkle, tahsilatSil } from "@/lib/cek-senet";
import { giderOlustur, giderSil } from "@/lib/gider";
import { islemOlustur } from "@/lib/islem";
import {
  getHesap,
  hareketEkle,
  hareketSil,
  hesapBakiyesiniDogrula,
  hesapOlustur,
  listeleHareketler,
} from "@/lib/kasa";
import { odemeEkle, odemeSil } from "@/lib/odeme";

/**
 * Kasa/Banka entegrasyonu.
 *
 * Önce tahsilat, fatura ödemesi ve gider cari/fatura tarafını güncelliyor ama
 * kasaya HİÇ dokunmuyordu: kullanıcı aynı parayı iki kez girmek zorundaydı ve
 * nakit akışı raporu gerçeği yansıtmıyordu. Bu dosya paranın tek girişle hem
 * cariye hem kasaya işlendiğini ve geri alındığında ikisinden birden
 * çıktığını sabitler.
 */

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 0, g);

async function cariEkle(unvan: string) {
  return cariOlustur(
    { unvan, tip: "HER_IKISI", acilisBakiyesi: "0" },
    db.prisma
  );
}

async function kasaEkle(ad: string, acilis = "0") {
  return hesapOlustur(
    { ad, tip: "KASA", acilisBakiyesi: acilis, acilisTarihi: gun(1) },
    db.prisma
  );
}

async function satis(cariId: string, tutar: string) {
  return islemOlustur(
    {
      tip: "SATIS",
      cariId,
      tarih: gun(1),
      kalemler: [
        { urunAdi: "Mal", miktar: "1", birimFiyat: tutar, kdvOrani: "0" },
      ],
    },
    db.prisma
  );
}

describe("Çek tahsilatı kasaya girer", () => {
  it("alınan çek tahsil edilince para hesaba GİRER", async () => {
    const cari = await cariEkle("Tahsilat Kasa");
    const kasa = await kasaEkle("Merkez Kasa");
    await satis(cari.id, "10000");

    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "10000",
        tarih: gun(2),
        vadeTarihi: gun(30),
      },
      db.prisma
    );

    // Çek alındı: cari kapandı ama para henüz kasada değil.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("0");

    await tahsilatEkle(
      cek.id,
      { tutar: "10000", tarih: gun(20), hesapId: kasa.id },
      db.prisma
    );

    // Para artık kasada.
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("10000");
    // Cari bir kez daha etkilenmedi.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");

    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("verilen çek ödenince para hesaptan ÇIKAR", async () => {
    const cari = await cariEkle("Verilen Çek Kasa");
    const kasa = await kasaEkle("Ödeme Kasası", "20000");

    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "VERILEN",
        cariId: cari.id,
        tutar: "8000",
        tarih: gun(2),
        vadeTarihi: gun(30),
      },
      db.prisma
    );
    await tahsilatEkle(
      cek.id,
      { tutar: "8000", tarih: gun(20), hesapId: kasa.id },
      db.prisma
    );

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("12000");
    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
  });

  it("tahsilat silinince parası kasadan da çıkar", async () => {
    const cari = await cariEkle("Tahsilat Geri Al");
    const kasa = await kasaEkle("Geri Alma Kasası");
    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "5000",
        tarih: gun(2),
        vadeTarihi: gun(30),
      },
      db.prisma
    );
    const t = await tahsilatEkle(
      cek.id,
      { tutar: "5000", tarih: gun(10), hesapId: kasa.id },
      db.prisma
    );
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("5000");

    await tahsilatSil(t.id, db.prisma);

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("0");
    expect(await listeleHareketler(kasa.id, db.prisma)).toHaveLength(0);
    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
  });

  it("hesap seçilmezse kasa hareketi oluşmaz — eski davranış korunur", async () => {
    const cari = await cariEkle("Hesapsız Tahsilat");
    const kasa = await kasaEkle("Dokunulmayan Kasa");
    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "3000",
        tarih: gun(2),
        vadeTarihi: gun(30),
      },
      db.prisma
    );
    await tahsilatEkle(cek.id, { tutar: "3000", tarih: gun(10) }, db.prisma);

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("0");
    expect(await listeleHareketler(kasa.id, db.prisma)).toHaveLength(0);
  });
});

describe("Fatura ödemesi kasaya girer", () => {
  it("satış faturası ödemesi hesaba GİRİŞ yazar", async () => {
    const cari = await cariEkle("Fatura Ödeme Kasa");
    const kasa = await kasaEkle("Fatura Kasası");
    const islem = await satis(cari.id, "6000");

    await odemeEkle(
      islem.id,
      { tutar: "2500", tarih: gun(5), kaynak: "DIREKT", hesapId: kasa.id },
      db.prisma
    );

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("2500");
    // Cari borcu da azaldı — tek giriş, iki defter.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("3500");
    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("alış faturası ödemesi hesaptan ÇIKIŞ yazar", async () => {
    const cari = await cariEkle("Alış Ödeme Kasa");
    const kasa = await kasaEkle("Alış Kasası", "10000");
    const islem = await islemOlustur(
      {
        tip: "ALIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Hammadde", miktar: "1", birimFiyat: "4000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );

    await odemeEkle(
      islem.id,
      { tutar: "4000", tarih: gun(5), kaynak: "DIREKT", hesapId: kasa.id },
      db.prisma
    );

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("6000");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
  });

  it("ödeme silinince parası kasadan da çıkar", async () => {
    const cari = await cariEkle("Ödeme Geri Al");
    const kasa = await kasaEkle("Ödeme Geri Alma");
    const islem = await satis(cari.id, "6000");
    const o = await odemeEkle(
      islem.id,
      { tutar: "6000", tarih: gun(5), kaynak: "DIREKT", hesapId: kasa.id },
      db.prisma
    );
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("6000");

    await odemeSil(o.id, db.prisma);

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("0");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("6000");
    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
  });

  it("çek tahsilatından doğan ödeme kasaya İKİNCİ kez para sokmaz", async () => {
    const cari = await cariEkle("Çift Kasa Girişi");
    const kasa = await kasaEkle("Çift Giriş Kasası");
    const islem = await satis(cari.id, "7000");
    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "7000",
        tarih: gun(2),
        vadeTarihi: gun(30),
      },
      db.prisma
    );
    await tahsilatEkle(
      cek.id,
      { tutar: "7000", tarih: gun(10), hesapId: kasa.id },
      db.prisma
    );
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("7000");

    // Aynı parayı faturaya sayıyoruz — kasaya tekrar girmemeli.
    await odemeEkle(
      islem.id,
      {
        tutar: "7000",
        tarih: gun(10),
        kaynak: "CEK",
        cekSenetId: cek.id,
        hesapId: kasa.id,
      },
      db.prisma
    );

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("7000");
    expect(await listeleHareketler(kasa.id, db.prisma)).toHaveLength(1);
  });
});

describe("Gider kasadan çıkar", () => {
  it("gider kaydı hesaba ÇIKIŞ yazar", async () => {
    const kasa = await kasaEkle("Gider Kasası", "5000");

    await giderOlustur(
      {
        kategori: "Kira",
        tutar: "1200",
        kdvOrani: "20",
        tarih: gun(3),
        hesapId: kasa.id,
      },
      undefined,
      db.prisma
    );

    // Gider KDV DAHİL tutardır; kasadan çıkan da brüt tutardır.
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("3800");
    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
  });

  it("gider silinince parası kasaya geri döner", async () => {
    const kasa = await kasaEkle("Gider Geri Alma", "5000");
    const g = await giderOlustur(
      {
        kategori: "Yakıt",
        tutar: "800",
        kdvOrani: "20",
        tarih: gun(3),
        hesapId: kasa.id,
      },
      undefined,
      db.prisma
    );
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("4200");

    await giderSil(g.id, db.prisma);

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("5000");
    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Kaynağı olan hareket kasa ekranından silinemez", () => {
  it("tahsilattan doğan hareket için okunur hata verir", async () => {
    const cari = await cariEkle("Korumalı Hareket");
    const kasa = await kasaEkle("Korumalı Kasa");
    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "2000",
        tarih: gun(2),
        vadeTarihi: gun(30),
      },
      db.prisma
    );
    await tahsilatEkle(
      cek.id,
      { tutar: "2000", tarih: gun(10), hesapId: kasa.id },
      db.prisma
    );

    const [hareket] = await listeleHareketler(kasa.id, db.prisma);
    await expect(hareketSil(hareket.id, db.prisma)).rejects.toThrow(
      /tahsilatından doğdu/i
    );

    // Reddedilen silme hiçbir yan etki bırakmamalı.
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("2000");
  });

  it("elle girilen hareket silinebilir", async () => {
    const kasa = await kasaEkle("Elle Hareket Kasası");
    const h = await hareketEkle(
      kasa.id,
      { yon: "GIRIS", tutar: "500", tarih: gun(4) },
      db.prisma
    );
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("500");

    await hareketSil(h.id, db.prisma);
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("0");
  });
});

describe("Gider güncellenince kasa hareketi de güncellenir", () => {
  it("tutar değişince kasadaki karşılığı da değişir", async () => {
    const kasa = await kasaEkle("Gider Güncelleme", "10000");
    const g = await giderOlustur(
      {
        kategori: "Kira",
        tutar: "1000",
        kdvOrani: "0",
        tarih: gun(3),
        hesapId: kasa.id,
      },
      undefined,
      db.prisma
    );
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("9000");

    const { giderGuncelle } = await import("@/lib/gider");
    await giderGuncelle(
      g.id,
      {
        kategori: "Kira",
        tutar: "2500",
        kdvOrani: "0",
        tarih: gun(3),
        hesapId: kasa.id,
      },
      undefined,
      db.prisma
    );

    // Eski 1.000 geri geldi, yeni 2.500 çıktı.
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("7500");
    // Açılış bakiyesi de bir harekettir; gider hareketi çoğalmamalı (1 + 1).
    expect(await listeleHareketler(kasa.id, db.prisma)).toHaveLength(2);
    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
  });

  it("hesap değişince para doğru hesaptan çıkar", async () => {
    const eski = await kasaEkle("Eski Hesap", "5000");
    const yeni = await kasaEkle("Yeni Hesap", "5000");
    const g = await giderOlustur(
      {
        kategori: "Yakıt",
        tutar: "1000",
        kdvOrani: "0",
        tarih: gun(3),
        hesapId: eski.id,
      },
      undefined,
      db.prisma
    );
    expect((await getHesap(eski.id, db.prisma))?.bakiye).toBe("4000");

    const { giderGuncelle } = await import("@/lib/gider");
    await giderGuncelle(
      g.id,
      {
        kategori: "Yakıt",
        tutar: "1000",
        kdvOrani: "0",
        tarih: gun(3),
        hesapId: yeni.id,
      },
      undefined,
      db.prisma
    );

    expect((await getHesap(eski.id, db.prisma))?.bakiye).toBe("5000");
    expect((await getHesap(yeni.id, db.prisma))?.bakiye).toBe("4000");
  });

  it("hesap kaldırılınca kasa hareketi de kalkar", async () => {
    const kasa = await kasaEkle("Hesap Kaldırma", "5000");
    const g = await giderOlustur(
      {
        kategori: "Nakliye",
        tutar: "700",
        kdvOrani: "0",
        tarih: gun(3),
        hesapId: kasa.id,
      },
      undefined,
      db.prisma
    );
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("4300");

    const { giderGuncelle } = await import("@/lib/gider");
    await giderGuncelle(
      g.id,
      { kategori: "Nakliye", tutar: "700", kdvOrani: "0", tarih: gun(3) },
      undefined,
      db.prisma
    );

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("5000");
    // Geriye yalnızca açılış bakiyesi hareketi kalır.
    expect(await listeleHareketler(kasa.id, db.prisma)).toHaveLength(1);
    expect((await hesapBakiyesiniDogrula(kasa.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Hareket satırı kaynağını bildirir", () => {
  it("kaynağı olan ve olmayan hareketler ayırt edilir", async () => {
    const cari = await cariEkle("Kaynak Etiketi");
    const kasa = await kasaEkle("Etiket Kasası");

    await hareketEkle(
      kasa.id,
      { yon: "GIRIS", tutar: "100", tarih: gun(4), aciklama: "Elle" },
      db.prisma
    );

    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "900",
        tarih: gun(2),
        vadeTarihi: gun(30),
      },
      db.prisma
    );
    await tahsilatEkle(
      cek.id,
      { tutar: "900", tarih: gun(5), hesapId: kasa.id },
      db.prisma
    );

    const islem = await satis(cari.id, "300");
    await odemeEkle(
      islem.id,
      { tutar: "300", tarih: gun(6), kaynak: "DIREKT", hesapId: kasa.id },
      db.prisma
    );

    await giderOlustur(
      {
        kategori: "Kira",
        tutar: "50",
        kdvOrani: "0",
        tarih: gun(7),
        hesapId: kasa.id,
      },
      undefined,
      db.prisma
    );

    const hareketler = await listeleHareketler(kasa.id, db.prisma);
    // Sırayla değil, kümeyle karşılaştırılır: varsayılan sort() null değerini
    // "null" dizesi gibi sıralar ve Türkçe karakterlerle sıra öngörülemez olur.
    const etiketler = new Set(hareketler.map((h) => h.kaynakEtiketi));

    expect(etiketler).toEqual(
      new Set(["fatura ödemesi", "gider kaydı", "çek/senet tahsilatı", null])
    );
    expect(hareketler).toHaveLength(4);
    expect(
      hareketler.filter((h) => h.kaynakEtiketi === null)
    ).toHaveLength(1);
  });
});

describe("Hesaba işlenmemiş gider görünür kılınır", () => {
  it("hesapsız gider kasaya yansımaz ve sayılır", async () => {
    const { hesabaIslenmemisGiderSayisi } = await import("@/lib/gider");
    const kasa = await kasaEkle("Uyarı Kasası", "5000");
    const oncekiSayi = await hesabaIslenmemisGiderSayisi(db.prisma);

    // Hesap SEÇİLMEDEN kaydedilen gider: para kasadan çıkmaz.
    await giderOlustur(
      { kategori: "Kira", tutar: "900", kdvOrani: "0", tarih: gun(3) },
      undefined,
      db.prisma
    );

    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("5000");
    expect(await hesabaIslenmemisGiderSayisi(db.prisma)).toBe(oncekiSayi + 1);

    // Hesap seçilen gider sayılmaz.
    await giderOlustur(
      {
        kategori: "Kira",
        tutar: "900",
        kdvOrani: "0",
        tarih: gun(3),
        hesapId: kasa.id,
      },
      undefined,
      db.prisma
    );
    expect(await hesabaIslenmemisGiderSayisi(db.prisma)).toBe(oncekiSayi + 1);
    expect((await getHesap(kasa.id, db.prisma))?.bakiye).toBe("4100");
  });

  it("listede hesapId dolu gelir — rozet her satırı işaretlemesin", async () => {
    const { listeleGiderler } = await import("@/lib/gider");
    const kasa = await kasaEkle("Liste Kasası", "5000");
    await giderOlustur(
      {
        kategori: "Yakıt",
        tutar: "300",
        kdvOrani: "0",
        tarih: gun(9),
        aciklama: "hesapli-kayit",
        hesapId: kasa.id,
      },
      undefined,
      db.prisma
    );

    const liste = await listeleGiderler({}, db.prisma);
    const kayit = liste.find((g) => g.aciklama === "hesapli-kayit");
    // include unutulursa hesapId null döner ve gider "işlenmemiş" görünürdü.
    expect(kayit?.hesapId).toBe(kasa.id);
  });
});
