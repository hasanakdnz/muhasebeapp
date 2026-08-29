import { describe, expect, it } from "vitest";
import { hareketSchema } from "@/lib/validations/kasa";
import { kalemSchema } from "@/lib/validations/islem";

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
