import { describe, expect, it } from "vitest";
import { cariSchema } from "@/lib/validations/cari";

const gecerli = {
  unvan: "Yılmaz Ticaret Ltd. Şti.",
  tip: "MUSTERI" as const,
  vknTckn: "1234567890",
  vergiDairesi: "Kadıköy",
  telefon: "0216 555 44 33",
  email: "info@yilmaz.com.tr",
  adres: "Caferağa Mah. No:1",
  bakiye: "1.500,50",
};

describe("cariSchema", () => {
  it("geçerli kaydı kabul eder ve tutarı normalize eder", () => {
    const r = cariSchema.safeParse(gecerli);
    expect(r.success).toBe(true);
    expect(r.data?.bakiye).toBe("1500.5");
    expect(r.data?.unvan).toBe("Yılmaz Ticaret Ltd. Şti.");
  });

  it("boş metin alanlarını undefined'a çevirir", () => {
    const r = cariSchema.safeParse({
      ...gecerli,
      vknTckn: "",
      vergiDairesi: "  ",
      telefon: "",
      email: "",
      adres: "",
    });
    expect(r.success).toBe(true);
    expect(r.data?.vknTckn).toBeUndefined();
    expect(r.data?.vergiDairesi).toBeUndefined();
    expect(r.data?.email).toBeUndefined();
  });

  it("bakiye boşsa sıfır kabul eder", () => {
    const r = cariSchema.safeParse({ ...gecerli, bakiye: "" });
    expect(r.success).toBe(true);
    expect(r.data?.bakiye).toBe("0");
  });

  it("negatif açılış bakiyesini korur (borç)", () => {
    const r = cariSchema.safeParse({ ...gecerli, bakiye: "-2.000,25" });
    expect(r.data?.bakiye).toBe("-2000.25");
  });

  it("kuruş altını yuvarlar", () => {
    const r = cariSchema.safeParse({ ...gecerli, bakiye: "10,005" });
    expect(r.data?.bakiye).toBe("10.01");
  });

  it("kısa ünvanı reddeder", () => {
    const r = cariSchema.safeParse({ ...gecerli, unvan: "A" });
    expect(r.success).toBe(false);
  });

  it("geçersiz VKN/TCKN'yi reddeder", () => {
    expect(cariSchema.safeParse({ ...gecerli, vknTckn: "123" }).success).toBe(false);
    // 11 hane → TCKN sağlaması uygulanır
    expect(
      cariSchema.safeParse({ ...gecerli, vknTckn: "12345678901" }).success
    ).toBe(false);
    expect(
      cariSchema.safeParse({ ...gecerli, vknTckn: "10000000146" }).success
    ).toBe(true);
  });

  it("geçersiz e-postayı ve tutarı reddeder", () => {
    expect(cariSchema.safeParse({ ...gecerli, email: "abc" }).success).toBe(false);
    expect(cariSchema.safeParse({ ...gecerli, bakiye: "abc" }).success).toBe(false);
  });

  it("geçersiz cari tipini reddeder", () => {
    expect(cariSchema.safeParse({ ...gecerli, tip: "BILINMEYEN" }).success).toBe(
      false
    );
  });
});
