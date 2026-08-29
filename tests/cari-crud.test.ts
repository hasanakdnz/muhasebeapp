import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import {
  cariBakiyesiniDogrula,
  cariGuncelle,
  cariOlustur,
  cariSilinebilirMi,
  getCari,
  listeleCariler,
} from "@/lib/cari";
import { cariSchema } from "@/lib/validations/cari";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

/** Server action'ın yaptığı doğrulama + kayıt adımının aynısı. */
async function cariEkle(girdi: Record<string, unknown>) {
  const parsed = cariSchema.parse(girdi);
  return cariOlustur(parsed, db.prisma);
}

describe("Cari — ekle", () => {
  it("doğrulanmış kaydı oluşturur ve tutarı bozmadan saklar", async () => {
    const cari = await cariEkle({
      unvan: "Yılmaz Ticaret Ltd. Şti.",
      tip: "MUSTERI",
      vknTckn: "1234567890",
      telefon: "0216 555 44 33",
      email: "info@yilmaz.com.tr",
      acilisBakiyesi: "1.500,50",
    });

    const kayit = await getCari(cari.id, db.prisma);
    expect(kayit?.unvan).toBe("Yılmaz Ticaret Ltd. Şti.");
    expect(kayit?.acilisBakiyesi).toBe("1500.5");
    // İşlemi olmayan caride yürüyen bakiye açılışa eşittir.
    expect(kayit?.bakiye).toBe("1500.5");
    expect(kayit?.aktif).toBe(true);
    expect(kayit?.islemSayisi).toBe(0);
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("boş bırakılan alanları NULL olarak saklar", async () => {
    const cari = await cariEkle({
      unvan: "Boş Alanlı Cari",
      tip: "TEDARIKCI",
      vknTckn: "",
      telefon: "",
      email: "",
      acilisBakiyesi: "",
    });

    const kayit = await getCari(cari.id, db.prisma);
    expect(kayit?.vknTckn).toBeNull();
    expect(kayit?.telefon).toBeNull();
    expect(kayit?.bakiye).toBe("0");
  });

  it("gerçekçi büyüklükteki tutarı hassasiyet kaybetmeden saklar", async () => {
    const cari = await cariEkle({
      unvan: "Büyük Bakiye A.Ş.",
      tip: "MUSTERI",
      acilisBakiyesi: "1.234.567.890.123,45", // ~1,2 trilyon TL
    });
    const kayit = await getCari(cari.id, db.prisma);
    expect(kayit?.bakiye).toBe("1234567890123.45");
  });

  it("SQLite'ın Decimal saklama sınırını belgeler", async () => {
    // SQLite'ta DECIMAL sütunu REAL (float64) olarak saklanır. ~15 anlamlı
    // basamağa kadar tam round-trip olur; ötesinde yuvarlanır. Uygulamadaki
    // TÜM aritmetik Decimal ile yapıldığı için hata birikmez, sınır yalnızca
    // saklamadadır. PostgreSQL'e geçişte (ROADMAP Faz 9) native NUMERIC ile
    // bu sınır tamamen kalkar. Bu test sınırı görünür tutar.
    const cari = await cariEkle({
      unvan: "Sınır Testi",
      tip: "MUSTERI",
      acilisBakiyesi: "9007199254740993,45", // 18 anlamlı basamak — gerçekçi değil
    });
    const kayit = await getCari(cari.id, db.prisma);
    expect(kayit?.bakiye).not.toBe("9007199254740993.45");
  });
});

describe("Cari — düzenle", () => {
  it("alanları ve bakiyeyi günceller", async () => {
    const cari = await cariEkle({
      unvan: "Eski Ünvan",
      tip: "MUSTERI",
      acilisBakiyesi: "100",
    });

    const parsed = cariSchema.parse({
      unvan: "Yeni Ünvan A.Ş.",
      tip: "HER_IKISI",
      vknTckn: "10000000146",
      acilisBakiyesi: "-2.500,75",
    });
    await cariGuncelle(cari.id, parsed, db.prisma);

    const kayit = await getCari(cari.id, db.prisma);
    expect(kayit?.unvan).toBe("Yeni Ünvan A.Ş.");
    expect(kayit?.tip).toBe("HER_IKISI");
    expect(kayit?.vknTckn).toBe("10000000146");
    expect(kayit?.bakiye).toBe("-2500.75");
  });

  it("pasife alınan cari varsayılan listede görünmez", async () => {
    const cari = await cariEkle({
      unvan: "Pasif Olacak Cari",
      tip: "MUSTERI",
      acilisBakiyesi: "0",
    });

    await db.prisma.cari.update({
      where: { id: cari.id },
      data: { aktif: false },
    });

    const varsayilan = await listeleCariler({}, db.prisma);
    expect(varsayilan.some((c) => c.id === cari.id)).toBe(false);

    const hepsi = await listeleCariler({ pasifleriGoster: true }, db.prisma);
    expect(hepsi.some((c) => c.id === cari.id)).toBe(true);
  });
});

describe("Cari — sil", () => {
  it("muhasebe kaydı olmayan cariyi siler", async () => {
    const cari = await cariEkle({
      unvan: "Silinecek Cari",
      tip: "MUSTERI",
      acilisBakiyesi: "0",
    });

    const durum = await cariSilinebilirMi(cari.id, db.prisma);
    expect(durum.silinebilir).toBe(true);

    await db.prisma.cari.delete({ where: { id: cari.id } });
    expect(await getCari(cari.id, db.prisma)).toBeNull();
  });

  it("işlemi olan cari silinemez — kural tespit edilir", async () => {
    const cari = await cariEkle({
      unvan: "İşlemli Cari",
      tip: "MUSTERI",
      acilisBakiyesi: "500",
    });

    await db.prisma.islem.create({
      data: {
        tip: "SATIS",
        cariId: cari.id,
        toplamTutar: "1180",
        kdvTutari: "180",
      },
    });

    const durum = await cariSilinebilirMi(cari.id, db.prisma);
    expect(durum.silinebilir).toBe(false);
    expect(durum.islemSayisi).toBe(1);
    expect(durum.cekSenetSayisi).toBe(0);

    // Kayıt hâlâ yerinde — cascade ile sessizce yok edilmedi.
    expect(await getCari(cari.id, db.prisma)).not.toBeNull();
  });

  it("çek/senedi olan cari silinemez", async () => {
    const cari = await cariEkle({
      unvan: "Çekli Cari",
      tip: "MUSTERI",
      acilisBakiyesi: "0",
    });

    await db.prisma.cekSenet.create({
      data: {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "5000",
        vadeTarihi: new Date("2026-12-31"),
      },
    });

    const durum = await cariSilinebilirMi(cari.id, db.prisma);
    expect(durum.silinebilir).toBe(false);
    expect(durum.cekSenetSayisi).toBe(1);
  });
});

describe("Cari — listeleme ve filtreler", () => {
  it("açık hesap filtresi sıfır bakiyelileri eler", async () => {
    await cariEkle({ unvan: "Sıfır Bakiye", tip: "MUSTERI", acilisBakiyesi: "0" });
    await cariEkle({ unvan: "Açık Bakiye", tip: "MUSTERI", acilisBakiyesi: "250,25" });

    const acik = await listeleCariler({ sadeceAcikHesap: true }, db.prisma);
    expect(acik.some((c) => c.unvan === "Sıfır Bakiye")).toBe(false);
    expect(acik.some((c) => c.unvan === "Açık Bakiye")).toBe(true);
  });

  it("ünvana göre arar (Türkçe büyük/küçük harf dahil)", async () => {
    await cariEkle({ unvan: "Işık Mühendislik", tip: "TEDARIKCI", acilisBakiyesi: "0" });

    const küçük = await listeleCariler({ q: "ışık" }, db.prisma);
    expect(küçük.some((c) => c.unvan === "Işık Mühendislik")).toBe(true);

    const büyük = await listeleCariler({ q: "IŞIK" }, db.prisma);
    expect(büyük.some((c) => c.unvan === "Işık Mühendislik")).toBe(true);

    // Kullanıcı şapkasız/noktasız yazsa da bulmalı.
    const sade = await listeleCariler({ q: "isik muh" }, db.prisma);
    expect(sade.some((c) => c.unvan === "Işık Mühendislik")).toBe(true);
  });

  it("VKN'ye göre arar", async () => {
    await cariEkle({
      unvan: "Vergi Numaralı Cari",
      tip: "MUSTERI",
      vknTckn: "9876543210",
      acilisBakiyesi: "0",
    });
    const sonuc = await listeleCariler({ q: "9876543210" }, db.prisma);
    expect(sonuc.some((c) => c.unvan === "Vergi Numaralı Cari")).toBe(true);
  });

  it("tipe göre filtreler", async () => {
    const sonuc = await listeleCariler({ tip: "TEDARIKCI" }, db.prisma);
    expect(sonuc.length).toBeGreaterThan(0);
    expect(sonuc.every((c) => c.tip === "TEDARIKCI")).toBe(true);
  });
});
