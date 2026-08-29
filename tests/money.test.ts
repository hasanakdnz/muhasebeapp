import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  amountTone,
  formatAmount,
  formatSignedTRY,
  formatTRY,
  parseAmountInput,
  roundMoney,
  toDecimal,
  formatYuzde,
} from "@/lib/money";

describe("toDecimal", () => {
  it("Prisma'nın Decimal'i gibi toString() veren nesneleri kabul eder", () => {
    // Prisma'nın Decimal sınıfı ile decimal.js'inki ayrı sınıflar olabilir;
    // sınırda string üzerinden normalize edilmeli.
    const prismaLike = { toString: () => "1234.56" };
    expect(toDecimal(prismaLike).toString()).toBe("1234.56");
  });

  it("string, number ve Decimal girdilerini kabul eder", () => {
    expect(toDecimal("10.5").toString()).toBe("10.5");
    expect(toDecimal(10.5).toString()).toBe("10.5");
    expect(toDecimal(new Decimal("10.5")).toString()).toBe("10.5");
  });

  it("geçersiz girdide hata fırlatır", () => {
    expect(() => toDecimal("abc")).toThrow();
    expect(() => toDecimal("")).toThrow();
    expect(() => toDecimal(Number.NaN)).toThrow();
  });
});

describe("roundMoney", () => {
  it("kuruş hassasiyetine yarım yukarı yuvarlar", () => {
    expect(roundMoney("1.005").toString()).toBe("1.01");
    expect(roundMoney("2.675").toString()).toBe("2.68");
    expect(roundMoney("1.004").toString()).toBe("1");
  });

  it("float yuvarlama hatasına düşmez", () => {
    // 0.1 + 0.2 float'ta 0.30000000000000004 eder; Decimal'de etmez.
    const sum = toDecimal("0.1").plus(toDecimal("0.2"));
    expect(sum.toString()).toBe("0.3");
    expect(roundMoney(sum).toString()).toBe("0.3");
  });
});

describe("formatAmount", () => {
  it("binlik ayracı nokta, ondalık ayracı virgül kullanır", () => {
    expect(formatAmount("1234567.891")).toBe("1.234.567,89");
    expect(formatAmount("1234.5")).toBe("1.234,50");
    expect(formatAmount("0")).toBe("0,00");
    expect(formatAmount("999")).toBe("999,00");
    expect(formatAmount("1000")).toBe("1.000,00");
  });

  it("negatif tutarları eksi ile gösterir", () => {
    expect(formatAmount("-1234.56")).toBe("-1.234,56");
  });

  it("yuvarlama sonrası negatif sıfırı eksisiz gösterir", () => {
    expect(formatAmount("-0.001")).toBe("0,00");
    expect(formatAmount("-0")).toBe("0,00");
  });

  it("float'ın taşıyamayacağı büyüklükte tutarı bozmadan biçimlendirir", () => {
    // Number(...) bu değeri kaybederdi — Intl.NumberFormat kullanılmamasının nedeni.
    expect(formatAmount("9007199254740993.45")).toBe("9.007.199.254.740.993,45");
  });
});

describe("formatTRY / formatSignedTRY", () => {
  it("sembolü Türkçe kullanımdaki gibi sona koyar", () => {
    expect(formatTRY("1234.56")).toBe("1.234,56 ₺");
  });

  it("ledger tabloları için işaret ekler", () => {
    expect(formatSignedTRY("1234.56")).toBe("+1.234,56 ₺");
    expect(formatSignedTRY("-1234.56")).toBe("-1.234,56 ₺");
    expect(formatSignedTRY("0")).toBe("0,00 ₺");
  });
});

describe("amountTone", () => {
  it("pozitif / negatif / sıfır ayrımı yapar", () => {
    expect(amountTone("10")).toBe("positive");
    expect(amountTone("-10")).toBe("negative");
    expect(amountTone("0")).toBe("zero");
  });

  it("kuruş altı değerleri sıfır sayar", () => {
    expect(amountTone("0.001")).toBe("zero");
    expect(amountTone("-0.001")).toBe("zero");
  });
});

describe("parseAmountInput", () => {
  it("Türkçe biçimi çözer", () => {
    expect(parseAmountInput("1.234,56")?.toString()).toBe("1234.56");
    expect(parseAmountInput("1.234.567,89")?.toString()).toBe("1234567.89");
    expect(parseAmountInput("1234,56")?.toString()).toBe("1234.56");
  });

  it("nokta ondalıklı yabancı biçimi de çözer", () => {
    expect(parseAmountInput("1234.56")?.toString()).toBe("1234.56");
    expect(parseAmountInput("1,234.56")?.toString()).toBe("1234.56");
  });

  it("tek noktalı belirsiz girdide 3 basamak kuralını uygular", () => {
    // "1.234" Türkçe yazımda bin iki yüz otuz dörttür.
    expect(parseAmountInput("1.234")?.toString()).toBe("1234");
    // "1.23" ise ondalıktır.
    expect(parseAmountInput("1.23")?.toString()).toBe("1.23");
  });

  it("para birimi ve boşlukları yok sayar", () => {
    expect(parseAmountInput(" 1.234,56 ₺ ")?.toString()).toBe("1234.56");
    expect(parseAmountInput("1234 TL")?.toString()).toBe("1234");
  });

  it("negatif tutarı korur", () => {
    expect(parseAmountInput("-1.234,56")?.toString()).toBe("-1234.56");
  });

  it("geçersiz girdide null döner", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("12abc")).toBeNull();
  });
});

describe("formatAmount → parseAmountInput gidiş-dönüşü", () => {
  it("biçimlendirilmiş tutar kayıpsız geri okunur", () => {
    // Düzenleme formu bakiyeyi biçimlendirilmiş gösterir; kaydederken aynı
    // değere geri dönmesi şart.
    for (const ham of [
      "0",
      "1500.5",
      "-15200.4",
      "1234567.89",
      "-0.01",
      "999999999.99",
    ]) {
      const gosterim = formatAmount(ham);
      const geri = parseAmountInput(gosterim);
      expect(geri, `girdi: ${ham} → "${gosterim}"`).not.toBeNull();
      expect(roundMoney(geri!).toString(), `girdi: ${ham}`).toBe(
        roundMoney(ham).toString()
      );
    }
  });
});

describe("formatYuzde", () => {
  it("Türkçe ondalık ayracı kullanır", () => {
    // Decimal.toString() nokta üretir; ekranda ve Excel'de yanlış okunur.
    expect(formatYuzde("75.02")).toBe("75,02");
    expect(formatYuzde("100")).toBe("100,00");
    expect(formatYuzde("0")).toBe("0,00");
  });

  it("basamak sayısı ayarlanabilir", () => {
    expect(formatYuzde("33.333", 1)).toBe("33,3");
    expect(formatYuzde("33.333", 0)).toBe("33");
  });
});
