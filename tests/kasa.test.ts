import { describe, expect, it } from "vitest";
import {
  bakiyeMutabik,
  bakiyeUygula,
  hesaplaBakiye,
  hesaplaHareketOzeti,
  isaretliTutar,
  tersTutar,
  tutarinYonu,
  yurutulenBakiyeler,
} from "@/lib/domain/kasa";

// Not: alan katmanı kanonik Decimal alır. Kullanıcının yazdığı Türkçe biçim
// ("1.500,00") daha önce, Zod şemasındaki tutar alanında çözülür — bunun testi
// money.test.ts / parseAmountInput içindedir.
describe("isaretliTutar", () => {
  it("girişi pozitif, çıkışı negatif yapar", () => {
    expect(isaretliTutar("GIRIS", "1500.00")).toBe("1500");
    expect(isaretliTutar("CIKIS", "1500.00")).toBe("-1500");
  });

  it("kullanıcı eksi yazsa bile yön belirleyicidir", () => {
    // "Çıkış" seçip "-500" yazmak çift olumsuzluk yaratıp giriş üretmemeli.
    expect(isaretliTutar("CIKIS", "-500")).toBe("-500");
    expect(isaretliTutar("GIRIS", "-500")).toBe("500");
  });

  it("kuruş hassasiyetine yuvarlar", () => {
    expect(isaretliTutar("GIRIS", "10.005")).toBe("10.01");
    expect(isaretliTutar("CIKIS", "10.004")).toBe("-10");
  });
});

describe("tutarinYonu", () => {
  it("işaretten yönü okur", () => {
    expect(tutarinYonu("100")).toBe("GIRIS");
    expect(tutarinYonu("-100")).toBe("CIKIS");
    expect(tutarinYonu("0")).toBe("GIRIS");
  });
});

describe("hesaplaBakiye — giriş/çıkış kombinasyonları", () => {
  it("boş hesabın bakiyesi sıfırdır", () => {
    expect(hesaplaBakiye([])).toBe("0");
  });

  it("yalnızca girişler", () => {
    expect(hesaplaBakiye(["1000", "250.50", "0.50"])).toBe("1251");
  });

  it("yalnızca çıkışlar", () => {
    expect(hesaplaBakiye(["-1000", "-250.50"])).toBe("-1250.5");
  });

  it("giriş ve çıkış karışık", () => {
    expect(hesaplaBakiye(["5000", "-1200.75", "300.25", "-99.50"])).toBe("4000");
  });

  it("çıkışlar girişleri aşarsa bakiye negatif olur", () => {
    // Kasa negatife düşebilir; uygulama bunu engellemez, doğru gösterir.
    expect(hesaplaBakiye(["100", "-450.75"])).toBe("-350.75");
  });

  it("giriş ve çıkış eşitse bakiye tam sıfırdır", () => {
    expect(hesaplaBakiye(["1234.56", "-1234.56"])).toBe("0");
  });

  it("float toplamı yerine Decimal toplamı yapar", () => {
    // 0.1 + 0.2 - 0.3 float'ta 5.5e-17 eder, Decimal'de tam sıfır.
    expect(hesaplaBakiye(["0.1", "0.2", "-0.3"])).toBe("0");
  });

  it("çok sayıda küçük hareket biriktirmede hata yapmaz", () => {
    // 0.01 x 100 = 1.00 — float ile 0.9999999999999999 çıkardı.
    const yuz = Array.from({ length: 100 }, () => "0.01");
    expect(hesaplaBakiye(yuz)).toBe("1");
  });

  it("giriş/çıkış sırası sonucu değiştirmez", () => {
    const a = hesaplaBakiye(["1000", "-300", "50", "-25.50"]);
    const b = hesaplaBakiye(["-25.50", "50", "-300", "1000"]);
    expect(a).toBe(b);
    expect(a).toBe("724.5");
  });
});

describe("hesaplaHareketOzeti", () => {
  it("giriş ve çıkış toplamlarını ayırır", () => {
    const ozet = hesaplaHareketOzeti(["5000", "-1200.75", "300.25", "-99.50"]);
    expect(ozet.toplamGiris).toBe("5300.25");
    expect(ozet.toplamCikis).toBe("1300.25");
    expect(ozet.bakiye).toBe("4000");
    expect(ozet.hareketSayisi).toBe(4);
  });

  it("boş listede sıfırlar döner", () => {
    const ozet = hesaplaHareketOzeti([]);
    expect(ozet.toplamGiris).toBe("0");
    expect(ozet.toplamCikis).toBe("0");
    expect(ozet.bakiye).toBe("0");
    expect(ozet.hareketSayisi).toBe(0);
  });

  it("özetteki bakiye hesaplaBakiye ile aynı sonucu verir", () => {
    const tutarlar = ["1500.25", "-300", "-1200.25", "10"];
    expect(hesaplaHareketOzeti(tutarlar).bakiye).toBe(hesaplaBakiye(tutarlar));
  });
});

describe("yurutulenBakiyeler", () => {
  it("her hareketten sonraki bakiyeyi sırayla verir", () => {
    expect(yurutulenBakiyeler(["1000", "-250", "500"])).toEqual([
      "1000",
      "750",
      "1250",
    ]);
  });

  it("son yürüyen bakiye toplam bakiyeye eşittir", () => {
    const tutarlar = ["2500.50", "-1000.25", "-99.75", "600"];
    expect(yurutulenBakiyeler(tutarlar).at(-1)).toBe(hesaplaBakiye(tutarlar));
  });

  it("boş listede boş dizi döner", () => {
    expect(yurutulenBakiyeler([])).toEqual([]);
  });

  it("ara bakiye negatife düşebilir", () => {
    expect(yurutulenBakiyeler(["100", "-300", "500"])).toEqual([
      "100",
      "-200",
      "300",
    ]);
  });
});

describe("bakiyeUygula / tersTutar", () => {
  it("mevcut bakiyeye işaretli değişimi ekler", () => {
    expect(bakiyeUygula("1000", "-250.50")).toBe("749.5");
    expect(bakiyeUygula("1000", "250.50")).toBe("1250.5");
  });

  it("hareket silmede ters tutar bakiyeyi eski haline getirir", () => {
    const baslangic = "1000";
    const hareket = isaretliTutar("CIKIS", "375.25");
    const sonrasi = bakiyeUygula(baslangic, hareket);
    expect(sonrasi).toBe("624.75");
    expect(bakiyeUygula(sonrasi, tersTutar(hareket))).toBe(baslangic);
  });

  it("ekle/sil çevrimi kuruş kaydırmaz", () => {
    let bakiye = "0";
    const hareketler = ["0.01", "-0.07", "1234.56", "-0.02"];
    for (const h of hareketler) bakiye = bakiyeUygula(bakiye, h);
    for (const h of hareketler) bakiye = bakiyeUygula(bakiye, tersTutar(h));
    expect(bakiye).toBe("0");
  });
});

describe("bakiyeMutabik", () => {
  it("saklanan bakiye hareketlerin toplamıyla eşleşirse doğrudur", () => {
    expect(
      bakiyeMutabik("4000", ["5000", "-1200.75", "300.25", "-99.50"])
    ).toBe(true);
  });

  it("uyuşmazlığı yakalar", () => {
    expect(bakiyeMutabik("3999.99", ["5000", "-1000"])).toBe(false);
  });

  it("boş hesapta sıfır bakiye mutabıktır", () => {
    expect(bakiyeMutabik("0", [])).toBe(true);
  });
});
