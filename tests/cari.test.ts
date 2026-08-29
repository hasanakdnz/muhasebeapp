import { describe, expect, it } from "vitest";
import { hesaplaCariOzeti } from "@/lib/domain/cari";

describe("hesaplaCariOzeti", () => {
  it("pozitif bakiyeleri alacak, negatifleri borç sayar", () => {
    // Şema kuralı: pozitif = alacak, negatif = borç.
    const ozet = hesaplaCariOzeti(["1500.50", "-2000.25", "300"]);
    expect(ozet.toplamAlacak).toBe("1800.5");
    expect(ozet.toplamBorc).toBe("2000.25");
    expect(ozet.net).toBe("-199.75");
    expect(ozet.acikHesapSayisi).toBe(3);
  });

  it("sıfır bakiyeleri açık hesap saymaz", () => {
    const ozet = hesaplaCariOzeti(["0", "100", "0.00", "-50"]);
    expect(ozet.acikHesapSayisi).toBe(2);
    expect(ozet.toplamAlacak).toBe("100");
    expect(ozet.toplamBorc).toBe("50");
  });

  it("kuruş altı bakiyeyi kapalı hesap sayar", () => {
    // Yuvarlandığında sıfır olan bakiye açık hesap değildir.
    const ozet = hesaplaCariOzeti(["0.004", "-0.001"]);
    expect(ozet.acikHesapSayisi).toBe(0);
    expect(ozet.net).toBe("0");
  });

  it("boş listede sıfır döner", () => {
    const ozet = hesaplaCariOzeti([]);
    expect(ozet.toplamAlacak).toBe("0");
    expect(ozet.toplamBorc).toBe("0");
    expect(ozet.net).toBe("0");
    expect(ozet.acikHesapSayisi).toBe(0);
  });

  it("float toplamı yerine Decimal toplamı yapar", () => {
    // 0.1 + 0.2 float'ta 0.30000000000000004 eder.
    const ozet = hesaplaCariOzeti(["0.1", "0.2"]);
    expect(ozet.toplamAlacak).toBe("0.3");
    expect(ozet.net).toBe("0.3");
  });

  it("çok büyük tutarlarda hassasiyet kaybetmez", () => {
    const ozet = hesaplaCariOzeti([
      "9007199254740993.45",
      "9007199254740993.45",
    ]);
    expect(ozet.toplamAlacak).toBe("18014398509481986.9");
  });

  it("alacak ve borç eşitse net sıfırdır", () => {
    const ozet = hesaplaCariOzeti(["1234.56", "-1234.56"]);
    expect(ozet.net).toBe("0");
    expect(ozet.acikHesapSayisi).toBe(2);
  });
});
