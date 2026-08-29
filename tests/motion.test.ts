import { describe, expect, it } from "vitest";
import { DURATION, easeOutProgress, sayimKaresi } from "@/lib/motion";

describe("motion token'ları", () => {
  it("DESIGN.md'deki süreleri taşır", () => {
    expect(DURATION.fast).toBe(120);
    expect(DURATION.base).toBe(200);
    expect(DURATION.slow).toBe(500);
  });
});

describe("easeOutProgress", () => {
  it("uçlarda 0 ve 1 döner", () => {
    expect(easeOutProgress(0)).toBe(0);
    expect(easeOutProgress(1)).toBe(1);
  });

  it("aralık dışını kırpar", () => {
    expect(easeOutProgress(-1)).toBe(0);
    expect(easeOutProgress(2)).toBe(1);
  });

  it("monoton artar ve ease-out'tur (başta hızlı)", () => {
    expect(easeOutProgress(0.25)).toBeGreaterThan(0.25);
    expect(easeOutProgress(0.5)).toBeGreaterThan(easeOutProgress(0.25));
    expect(easeOutProgress(0.75)).toBeGreaterThan(easeOutProgress(0.5));
  });
});

describe("sayimKaresi — dashboard sayma animasyonu", () => {
  it("başlangıçta sıfırdan başlar", () => {
    expect(Number(sayimKaresi("1000", 0))).toBe(0);
  });

  it("süre dolduğunda hedef değeri TAM olarak döner", () => {
    // En kritik özellik: nihai tutar float'tan geçmemeli.
    expect(sayimKaresi("9007199254740993.45", DURATION.slow)).toBe(
      "9007199254740993.45"
    );
    expect(sayimKaresi("1234.56", DURATION.slow)).toBe("1234.56");
    expect(sayimKaresi("1234.56", DURATION.slow + 1000)).toBe("1234.56");
  });

  it("ara karelerde hedefe doğru monoton ilerler", () => {
    const kareler = [0, 100, 200, 300, 400].map((t) =>
      Number(sayimKaresi("1000", t))
    );
    for (let i = 1; i < kareler.length; i += 1) {
      expect(kareler[i]).toBeGreaterThan(kareler[i - 1]);
    }
    expect(kareler.at(-1)!).toBeLessThan(1000);
  });

  it("negatif hedefte de doğru yönde ilerler", () => {
    expect(Number(sayimKaresi("-1000", 250))).toBeLessThan(0);
    expect(sayimKaresi("-1000", DURATION.slow)).toBe("-1000");
  });

  it("sayıya çevrilemeyen değeri olduğu gibi döndürür", () => {
    expect(sayimKaresi("abc", 100)).toBe("abc");
  });
});
