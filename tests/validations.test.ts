import { describe, expect, it } from "vitest";
import { hareketSchema } from "@/lib/validations/kasa";
import { kalemSchema } from "@/lib/validations/islem";
import { odemeSchema } from "@/lib/validations/odeme";

/**
 * Regresyon: decimal.js'te `isPositive()` SIFIR için de true döner (işaretli
 * sıfır). "Sıfırdan büyük olmalı" kontrolleri bu yüzden sıfırı geçiriyordu;
 * sıfır tutarlı hareket ve sıfır miktarlı kalem kaydedilebiliyordu.
 */
describe("pozitif tutar kontrolü — sıfır reddedilmeli", () => {
  it("sıfır tutarlı kasa hareketi reddedilir", () => {
    const r = hareketSchema.safeParse({
      yon: "GIRIS",
      tutar: "0",
      tarih: "2026-08-15",
    });
    expect(r.success).toBe(false);
  });

  it("sıfıra yuvarlanan tutar da reddedilir", () => {
    // 0,004 kuruşa yuvarlanınca 0 eder — geçmemeli.
    const r = hareketSchema.safeParse({
      yon: "GIRIS",
      tutar: "0,004",
      tarih: "2026-08-15",
    });
    expect(r.success).toBe(false);
  });

  it("negatif tutar reddedilir", () => {
    const r = hareketSchema.safeParse({
      yon: "CIKIS",
      tutar: "-100",
      tarih: "2026-08-15",
    });
    expect(r.success).toBe(false);
  });

  it("pozitif tutar kabul edilir", () => {
    const r = hareketSchema.safeParse({
      yon: "GIRIS",
      tutar: "0,01",
      tarih: "2026-08-15",
    });
    expect(r.success).toBe(true);
    expect(r.data?.tutar).toBe("0.01");
  });

  it("sıfır miktarlı işlem kalemi reddedilir", () => {
    const r = kalemSchema.safeParse({
      urunAdi: "Ürün",
      miktar: "0",
      birimFiyat: "100",
      kdvOrani: "20",
    });
    expect(r.success).toBe(false);
  });

  it("sıfır birim fiyatlı işlem kalemi reddedilir", () => {
    const r = kalemSchema.safeParse({
      urunAdi: "Ürün",
      miktar: "1",
      birimFiyat: "0",
      kdvOrani: "20",
    });
    expect(r.success).toBe(false);
  });

  it("geçerli kalem kabul edilir", () => {
    const r = kalemSchema.safeParse({
      urunAdi: "Ürün",
      miktar: "2,5",
      birimFiyat: "12,35",
      kdvOrani: "10",
    });
    expect(r.success).toBe(true);
    expect(r.data?.miktar).toBe("2.5");
    expect(r.data?.birimFiyat).toBe("12.35");
  });
});

/**
 * Regresyon: ödeme paneli tutarı kullanıcı biçiminde ("3.930,00") gönderiyor.
 * Bu araya Zod girmezse alan katmanı Türkçe biçimi çözemez ve
 * "[DecimalError] Invalid argument" ile patlar.
 */
describe("odemeSchema — kullanıcı biçimini kanonik Decimal'e çevirir", () => {
  const temel = { tarih: "2026-08-29", kaynak: "DIREKT" as const };

  it("Türkçe biçimli tutarı çözer", () => {
    const r = odemeSchema.safeParse({ ...temel, tutar: "3.930,00" });
    expect(r.success).toBe(true);
    expect(r.data?.tutar).toBe("3930");
  });

  it("binlik ayraçlı büyük tutarı çözer", () => {
    const r = odemeSchema.safeParse({ ...temel, tutar: "1.234.567,89" });
    expect(r.data?.tutar).toBe("1234567.89");
  });

  it("sıfır ve negatif tutarı reddeder", () => {
    expect(odemeSchema.safeParse({ ...temel, tutar: "0" }).success).toBe(false);
    expect(odemeSchema.safeParse({ ...temel, tutar: "-100" }).success).toBe(false);
  });

  it("çek seçilmeden kaynak CEK olamaz", () => {
    const r = odemeSchema.safeParse({
      tarih: "2026-08-29",
      kaynak: "CEK",
      tutar: "100",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/çek\/senet seçin/i);
  });

  it("çek seçilince kabul eder", () => {
    const r = odemeSchema.safeParse({
      tarih: "2026-08-29",
      kaynak: "CEK",
      tutar: "100",
      cekSenetId: "abc123",
    });
    expect(r.success).toBe(true);
  });
});
