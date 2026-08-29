import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import {
  getGider,
  giderGuncelle,
  giderOlustur,
  giderSil,
  hesaplaGiderOzeti,
  listeleGiderler,
} from "@/lib/gider";
import { belgeKaydet, belgeOku, belgeSil } from "@/lib/storage";

let db: TestDb;
let depoKlasoru: string;

beforeAll(async () => {
  db = await createTestDb();
  depoKlasoru = fs.mkdtempSync(path.join(os.tmpdir(), "muhasebe-belge-"));
  process.env.UPLOAD_DIR = depoKlasoru;
});

afterAll(async () => {
  await db.cleanup();
  fs.rmSync(depoKlasoru, { recursive: true, force: true });
});

const gun = (g: number) => new Date(2026, 5, g);

/** Geçerli bir PNG: imza baytları + biraz gövde. */
function pngDosyasi(ad = "fis.png") {
  const imza = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return new File([new Uint8Array([...imza, 1, 2, 3, 4])], ad, {
    type: "image/png",
  });
}

describe("Gider — KDV sunucuda hesaplanır", () => {
  it("KDV dahil tutardan KDV'yi ayırıp saklar", async () => {
    const { id } = await giderOlustur(
      { kategori: "Yakıt", tutar: "1200", kdvOrani: "20", tarih: gun(1) },
      undefined,
      db.prisma
    );

    const gider = await getGider(id, db.prisma);
    expect(gider?.tutar).toBe("1200");
    expect(gider?.kdvTutari).toBe("200");
    expect(gider?.matrah).toBe("1000");
  });

  it("%0'da KDV sıfırdır", async () => {
    const { id } = await giderOlustur(
      { kategori: "Vergi / Harç", tutar: "500", kdvOrani: "0", tarih: gun(1) },
      undefined,
      db.prisma
    );
    const gider = await getGider(id, db.prisma);
    expect(gider?.kdvTutari).toBe("0");
    expect(gider?.matrah).toBe("500");
  });

  it("tutar veya oran değişince KDV yeniden hesaplanır", async () => {
    const { id } = await giderOlustur(
      { kategori: "Kira", tutar: "1200", kdvOrani: "20", tarih: gun(1) },
      undefined,
      db.prisma
    );

    await giderGuncelle(
      id,
      { kategori: "Kira", tutar: "1100", kdvOrani: "10", tarih: gun(2) },
      undefined,
      db.prisma
    );

    const gider = await getGider(id, db.prisma);
    expect(gider?.tutar).toBe("1100");
    expect(gider?.kdvTutari).toBe("100");
    expect(gider?.matrah).toBe("1000");
  });

  it("kuruşlu tutarda matrah + KDV toplamı bozulmaz", async () => {
    const { id } = await giderOlustur(
      { kategori: "Ofis giderleri", tutar: "33.33", kdvOrani: "20", tarih: gun(1) },
      undefined,
      db.prisma
    );
    const gider = await getGider(id, db.prisma);
    expect(Number(gider!.matrah) + Number(gider!.kdvTutari)).toBeCloseTo(33.33, 2);
  });
});

describe("Gider — listeleme ve özet", () => {
  it("kategoriye göre filtreler", async () => {
    await giderOlustur(
      { kategori: "Nakliye", tutar: "100", kdvOrani: "20", tarih: gun(3) },
      undefined,
      db.prisma
    );
    const sonuc = await listeleGiderler({ kategori: "Nakliye" }, db.prisma);
    expect(sonuc.length).toBeGreaterThan(0);
    expect(sonuc.every((g) => g.kategori === "Nakliye")).toBe(true);
  });

  it("tarihe göre yeniden eskiye sıralar", async () => {
    const liste = await listeleGiderler({}, db.prisma);
    for (let i = 1; i < liste.length; i += 1) {
      expect(liste[i - 1].tarih.getTime()).toBeGreaterThanOrEqual(
        liste[i].tarih.getTime()
      );
    }
  });

  it("özet, saklanan KDV'lerin toplamını verir", async () => {
    const liste = await listeleGiderler({}, db.prisma);
    const ozet = hesaplaGiderOzeti(liste);
    const elleToplam = liste.reduce(
      (a, g) => a + Math.round(Number(g.kdvTutari) * 100),
      0
    );
    expect(Math.round(Number(ozet.toplamKdv) * 100)).toBe(elleToplam);
  });
});

describe("Belge deposu", () => {
  it("geçerli PNG'yi kaydeder ve geri okur", async () => {
    const sonuc = await belgeKaydet(pngDosyasi());
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;

    // Anahtar rastgeledir; kullanıcının dosya adı yola girmez.
    expect(sonuc.anahtar).toMatch(/^[0-9a-f]{32}\.png$/);
    expect(sonuc.ad).toBe("fis.png");

    const icerik = await belgeOku(sonuc.anahtar);
    expect(icerik).not.toBeNull();
    await belgeSil(sonuc.anahtar);
    expect(await belgeOku(sonuc.anahtar)).toBeNull();
  });

  it("uzantısı değiştirilmiş dosyayı içerik imzasından yakalar", async () => {
    // İstemci "image/png" diyor ve adı .png ama içerik PNG değil.
    const sahte = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "kotu.png", {
      type: "image/png",
    });
    const sonuc = await belgeKaydet(sahte);
    expect(sonuc.ok).toBe(false);
    expect(sonuc.ok === false && sonuc.hata).toMatch(/JPEG, PNG, WebP veya PDF/);
  });

  it("boş dosyayı reddeder", async () => {
    const bos = new File([], "bos.png", { type: "image/png" });
    const sonuc = await belgeKaydet(bos);
    expect(sonuc.ok).toBe(false);
  });

  it("dizin geçişi içeren anahtarla dosya okunamaz", async () => {
    expect(await belgeOku("../../.env")).toBeNull();
    expect(await belgeOku("..\\..\\prisma\\dev.db")).toBeNull();
  });
});

describe("Gider — belge yaşam döngüsü", () => {
  it("gider silinince belgesi de depodan silinir", async () => {
    const yukleme = await belgeKaydet(pngDosyasi("silinecek.png"));
    expect(yukleme.ok).toBe(true);
    if (!yukleme.ok) return;

    const { id } = await giderOlustur(
      { kategori: "Diğer", tutar: "100", kdvOrani: "20", tarih: gun(4) },
      { anahtar: yukleme.anahtar, ad: yukleme.ad },
      db.prisma
    );
    expect(await belgeOku(yukleme.anahtar)).not.toBeNull();

    await giderSil(id, db.prisma);

    expect(await getGider(id, db.prisma)).toBeNull();
    // Yetim dosya bırakılmamalı.
    expect(await belgeOku(yukleme.anahtar)).toBeNull();
  });

  it("belge değiştirilince eskisi depodan silinir", async () => {
    const eski = await belgeKaydet(pngDosyasi("eski.png"));
    const yeni = await belgeKaydet(pngDosyasi("yeni.png"));
    expect(eski.ok && yeni.ok).toBe(true);
    if (!eski.ok || !yeni.ok) return;

    const { id } = await giderOlustur(
      { kategori: "Diğer", tutar: "100", kdvOrani: "20", tarih: gun(5) },
      { anahtar: eski.anahtar, ad: eski.ad },
      db.prisma
    );

    await giderGuncelle(
      id,
      { kategori: "Diğer", tutar: "100", kdvOrani: "20", tarih: gun(5) },
      { anahtar: yeni.anahtar, ad: yeni.ad },
      db.prisma
    );

    const gider = await getGider(id, db.prisma);
    expect(gider?.belgeUrl).toBe(yeni.anahtar);
    expect(await belgeOku(eski.anahtar)).toBeNull();
    expect(await belgeOku(yeni.anahtar)).not.toBeNull();
  });
});
