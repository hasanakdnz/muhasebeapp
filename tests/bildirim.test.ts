import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { vadeBildirimiOlustur, type BildirimKaydi } from "@/lib/domain/bildirim";
import {
  konsolGondericisi,
  vadeBildirimiGonder,
  type BildirimGondericisi,
} from "@/lib/bildirim";
import { cariOlustur } from "@/lib/cari";
import { cekSenetOlustur, tahsilatEkle } from "@/lib/cek-senet";
import { listeleVadeliCekSenetler, vadePanosu } from "@/lib/vade";
import { hashPassword } from "@/lib/password";

const gun = (yil: number, ay: number, g: number) => new Date(yil, ay - 1, g);
const BUGUN = gun(2026, 8, 29);

function kayit(over: Partial<BildirimKaydi> = {}): BildirimKaydi {
  return {
    tip: "CEK",
    yon: "ALINAN",
    cariUnvan: "Test Cari",
    vadeTarihi: gun(2026, 8, 20),
    kalan: "1000",
    durum: "gecti",
    kalanGun: -9,
    ...over,
  };
}

describe("vadeBildirimiOlustur", () => {
  it("gönderilecek bir şey yoksa null döner", () => {
    // Boş "her şey yolunda" postası bildirimleri değersizleştirir.
    expect(vadeBildirimiOlustur([], BUGUN)).toBeNull();
  });

  it("konuda durumların sayısını özetler", () => {
    const b = vadeBildirimiOlustur(
      [
        kayit({ durum: "gecti", kalanGun: -9 }),
        kayit({ durum: "gecti", kalanGun: -2 }),
        kayit({ durum: "bugun", kalanGun: 0 }),
        kayit({ durum: "yaklasiyor", kalanGun: 3 }),
      ],
      BUGUN
    );
    expect(b?.konu).toBe("Vade takibi — 2 gecikmiş, 1 bugün, 1 yaklaşan");
  });

  it("yalnızca var olan bölümleri yazar", () => {
    const b = vadeBildirimiOlustur([kayit({ durum: "gecti" })], BUGUN);
    expect(b?.metin).toContain("Vadesi geçmiş:");
    expect(b?.metin).not.toContain("Bugün vadeli:");
    expect(b?.metin).not.toContain("Vadesi yaklaşan:");
  });

  it("satırlarda cari, tutar ve gecikme bilgisi bulunur", () => {
    const b = vadeBildirimiOlustur(
      [
        kayit({
          cariUnvan: "Yılmaz Gıda",
          kalan: "12500.5",
          durum: "gecti",
          kalanGun: -5,
        }),
      ],
      BUGUN
    );
    expect(b?.metin).toContain("Yılmaz Gıda");
    expect(b?.metin).toContain("12.500,50 ₺");
    expect(b?.metin).toContain("5 gün gecikti");
    expect(b?.metin).toContain("tahsilat");
  });

  it("verilen çekte ödeme dili kullanılır", () => {
    const b = vadeBildirimiOlustur(
      [kayit({ yon: "VERILEN", durum: "bugun", kalanGun: 0 })],
      BUGUN
    );
    expect(b?.metin).toContain("ödeme");
    expect(b?.metin).toContain("bugün vadeli");
  });
});

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

async function cekEkle(cariId: string, tutar: string, vade: Date) {
  return cekSenetOlustur(
    { tip: "CEK", yon: "ALINAN", cariId, tutar, vadeTarihi: vade },
    db.prisma
  );
}

describe("Vade takibi — veri katmanı", () => {
  it("yalnızca portföydeki ve kalanı olan kayıtları izler", async () => {
    const cari = await cariOlustur(
      { unvan: "Vade Carisi", tip: "MUSTERI", acilisBakiyesi: "0" },
      db.prisma
    );

    await cekEkle(cari.id, "1000", gun(2026, 8, 20)); // gecikmiş
    await cekEkle(cari.id, "2000", gun(2026, 8, 29)); // bugün
    await cekEkle(cari.id, "3000", gun(2026, 9, 2)); // yaklaşan
    await cekEkle(cari.id, "4000", gun(2026, 12, 1)); // normal

    // Tamamen tahsil edilmiş kayıt izlenmemeli.
    const tahsilEdilmis = await cekEkle(cari.id, "5000", gun(2026, 8, 21));
    await tahsilatEkle(
      tahsilEdilmis.id,
      { tutar: "5000", tarih: gun(2026, 8, 21) },
      db.prisma
    );

    const hepsi = await listeleVadeliCekSenetler({ bugun: BUGUN }, db.prisma);
    expect(hepsi).toHaveLength(4);
    expect(hepsi.map((h) => h.durum)).toEqual([
      "gecti",
      "bugun",
      "yaklasiyor",
      "normal",
    ]);
  });

  it("dikkat gerektirenler filtresi uzak vadeleri eler", async () => {
    const dikkat = await listeleVadeliCekSenetler(
      { bugun: BUGUN, sadeceDikkatGerekenler: true },
      db.prisma
    );
    expect(dikkat.every((d) => d.durum !== "normal")).toBe(true);
    expect(dikkat).toHaveLength(3);
  });

  it("pano sayıları ve tutarları doğrudur", async () => {
    const pano = await vadePanosu(BUGUN, 7, db.prisma);
    expect(pano.gecen).toBe(1);
    expect(pano.bugunVadeli).toBe(1);
    expect(pano.yaklasan).toBe(1);
    expect(pano.gecenTutar).toBe("1000");
    // bugün (2000) + yaklaşan (3000)
    expect(pano.yaklasanTutar).toBe("5000");
  });

  it("kısmi tahsilat sonrası kalan tutar izlenir", async () => {
    const cari = await cariOlustur(
      { unvan: "Kısmi Vade", tip: "MUSTERI", acilisBakiyesi: "0" },
      db.prisma
    );
    const cek = await cekEkle(cari.id, "10000", gun(2026, 8, 10));
    await tahsilatEkle(cek.id, { tutar: "4000", tarih: gun(2026, 8, 15) }, db.prisma);

    const kayitlar = await listeleVadeliCekSenetler({ bugun: BUGUN }, db.prisma);
    const bizim = kayitlar.find((k) => k.id === cek.id);
    expect(bizim?.kalan).toBe("6000");
    expect(bizim?.durum).toBe("gecti");
  });
});

describe("vadeBildirimiGonder", () => {
  it("yönetici yoksa gönderim yapılmaz", async () => {
    const sonuc = await vadeBildirimiGonder(BUGUN, 7, db.prisma, konsolGondericisi);
    expect(sonuc.gonderildi).toBe(false);
    expect(sonuc.neden).toMatch(/yönetici/i);
  });

  it("yönetici e-postalarına gönderir", async () => {
    await db.prisma.user.create({
      data: {
        email: "yonetici@test.local",
        name: "Yönetici",
        role: "ADMIN",
        passwordHash: await hashPassword("Test1234!"),
      },
    });
    await db.prisma.user.create({
      data: {
        email: "personel@test.local",
        name: "Personel",
        role: "PERSONEL",
        passwordHash: await hashPassword("Test1234!"),
      },
    });

    const gonderilenler: Array<{ alicilar: string[]; konu: string }> = [];
    const sahteGonderici: BildirimGondericisi = {
      ad: "test",
      async gonder(alicilar, bildirim) {
        gonderilenler.push({ alicilar, konu: bildirim.konu });
        return { ok: true };
      },
    };

    const sonuc = await vadeBildirimiGonder(BUGUN, 7, db.prisma, sahteGonderici);

    expect(sonuc.gonderildi).toBe(true);
    expect(gonderilenler).toHaveLength(1);
    // Yalnızca yöneticiler — personel bildirim almaz.
    expect(gonderilenler[0].alicilar).toEqual(["yonetici@test.local"]);
    expect(gonderilenler[0].konu).toMatch(/^Vade takibi —/);
  });

  it("gönderici hata verirse sonuç başarısız döner", async () => {
    const hataliGonderici: BildirimGondericisi = {
      ad: "hatali",
      async gonder() {
        return { ok: false, hata: "SMTP bağlantısı kurulamadı." };
      },
    };
    const sonuc = await vadeBildirimiGonder(BUGUN, 7, db.prisma, hataliGonderici);
    expect(sonuc.gonderildi).toBe(false);
    expect(sonuc.neden).toMatch(/SMTP/);
  });

  it("dikkat gerektiren vade yoksa bildirim üretilmez", async () => {
    // Çok ileri bir tarihte hiçbir kayıt "dikkat" kapsamında değildir.
    const cokEski = gun(2020, 1, 1);
    const sonuc = await vadeBildirimiGonder(cokEski, 7, db.prisma, konsolGondericisi);
    expect(sonuc.gonderildi).toBe(false);
    expect(sonuc.neden).toMatch(/vade yok/i);
  });
});
