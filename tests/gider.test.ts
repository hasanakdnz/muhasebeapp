import { describe, expect, it } from "vitest";
import {
  hesaplaGiderOzeti,
  kategoriDagilimi,
  kdvAyir,
} from "@/lib/domain/gider";
import { hesaplaKalem } from "@/lib/domain/islem";

describe("kdvAyir — KDV dahil tutardan KDV ayırma", () => {
  it("%20 KDV'yi içinden ayırır", () => {
    expect(kdvAyir("120", "20")).toEqual({
      matrah: "100",
      kdv: "20",
      brut: "120",
    });
  });

  it("%10 ve %1 oranlarında da doğru ayırır", () => {
    expect(kdvAyir("110", "10")).toEqual({ matrah: "100", kdv: "10", brut: "110" });
    expect(kdvAyir("101", "1")).toEqual({ matrah: "100", kdv: "1", brut: "101" });
  });

  it("%0'da KDV yoktur, matrah brüte eşittir", () => {
    expect(kdvAyir("250.75", "0")).toEqual({
      matrah: "250.75",
      kdv: "0",
      brut: "250.75",
    });
  });

  it("KDV eklemenin TERSİDİR — gidiş dönüş aynı tutara döner", () => {
    // Satış tarafında KDV matrahın üstüne eklenir; giderde brütün içinden
    // ayrılır. İkisi birbirini götürmeli.
    for (const [matrah, oran] of [
      ["100", "20"],
      ["1000", "10"],
      ["250.50", "1"],
    ] as const) {
      const kalem = hesaplaKalem({ miktar: "1", birimFiyat: matrah, kdvOrani: oran });
      const ayrim = kdvAyir(kalem.brut, oran);
      expect(ayrim.matrah).toBe(kalem.matrah);
      expect(ayrim.kdv).toBe(kalem.kdv);
    }
  });

  it("matrah + kdv her zaman brüte eşittir", () => {
    for (const brut of ["33.33", "0.05", "1234.56", "99999.99"]) {
      for (const oran of ["0", "1", "10", "20"]) {
        const a = kdvAyir(brut, oran);
        expect(Number(a.matrah) + Number(a.kdv)).toBeCloseTo(Number(a.brut), 2);
      }
    }
  });

  it("kuruşa yarım yukarı yuvarlar", () => {
    // 33.33 × 20 / 120 = 5.555 → 5.56
    expect(kdvAyir("33.33", "20")).toEqual({
      matrah: "27.77",
      kdv: "5.56",
      brut: "33.33",
    });
  });

  it("float yerine Decimal aritmetiği kullanır", () => {
    expect(kdvAyir("0.3", "0").matrah).toBe("0.3");
  });
});

describe("hesaplaGiderOzeti", () => {
  it("brüt, KDV ve matrah toplamlarını ayırır", () => {
    const ozet = hesaplaGiderOzeti([
      { tutar: "120", kdvTutari: "20" },
      { tutar: "110", kdvTutari: "10" },
      { tutar: "50", kdvTutari: "0" },
    ]);
    expect(ozet.toplam).toBe("280");
    expect(ozet.toplamKdv).toBe("30");
    expect(ozet.toplamMatrah).toBe("250");
    expect(ozet.giderSayisi).toBe(3);
  });

  it("boş listede sıfır döner", () => {
    const ozet = hesaplaGiderOzeti([]);
    expect(ozet.toplam).toBe("0");
    expect(ozet.toplamKdv).toBe("0");
    expect(ozet.giderSayisi).toBe(0);
  });

  it("çok sayıda kuruşlu giderde kayma olmaz", () => {
    const yuz = Array.from({ length: 100 }, () => ({
      tutar: "0.01",
      kdvTutari: "0",
    }));
    expect(hesaplaGiderOzeti(yuz).toplam).toBe("1");
  });
});

describe("kategoriDagilimi", () => {
  it("kategori bazında toplar ve yüksekten düşüğe sıralar", () => {
    const dagilim = kategoriDagilimi([
      { kategori: "Kira", tutar: "5000" },
      { kategori: "Yakıt", tutar: "1500" },
      { kategori: "Kira", tutar: "5000" },
      { kategori: "Ofis giderleri", tutar: "500" },
    ]);

    expect(dagilim.map((d) => d.kategori)).toEqual([
      "Kira",
      "Yakıt",
      "Ofis giderleri",
    ]);
    expect(dagilim[0].toplam).toBe("10000");
    expect(dagilim[0].adet).toBe(2);
  });

  it("yüzdeleri doğru hesaplar ve toplamları 100 eder", () => {
    const dagilim = kategoriDagilimi([
      { kategori: "A", tutar: "750" },
      { kategori: "B", tutar: "250" },
    ]);
    expect(dagilim[0].yuzde).toBe("75");
    expect(dagilim[1].yuzde).toBe("25");
    const toplamYuzde = dagilim.reduce((a, d) => a + Number(d.yuzde), 0);
    expect(toplamYuzde).toBeCloseTo(100, 1);
  });

  it("toplam sıfırsa yüzdeler sıfırdır (sıfıra bölme yok)", () => {
    const dagilim = kategoriDagilimi([{ kategori: "A", tutar: "0" }]);
    expect(dagilim[0].yuzde).toBe("0");
  });

  it("boş listede boş dizi döner", () => {
    expect(kategoriDagilimi([])).toEqual([]);
  });
});
