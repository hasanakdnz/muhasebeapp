import { describe, expect, it } from "vitest";
import {
  cariBakiyeEtkisi,
  cariBakiyesiMutabik,
  hesaplaCariBakiyesi,
  hesaplaIslemToplamlari,
  hesaplaKalem,
  kdvDahilNete,
  neteKdvEkle,
  tersEtki,
} from "@/lib/domain/islem";
import { islemSchema } from "@/lib/validations/islem";

describe("hesaplaKalem — farklı KDV oranları", () => {
  it("%20 KDV", () => {
    expect(hesaplaKalem({ miktar: "1", birimFiyat: "1000", kdvOrani: "20" })).toEqual(
      { matrah: "1000", kdv: "200", brut: "1200" }
    );
  });

  it("%10 KDV", () => {
    expect(hesaplaKalem({ miktar: "1", birimFiyat: "1000", kdvOrani: "10" })).toEqual(
      { matrah: "1000", kdv: "100", brut: "1100" }
    );
  });

  it("%1 KDV", () => {
    expect(hesaplaKalem({ miktar: "1", birimFiyat: "1000", kdvOrani: "1" })).toEqual(
      { matrah: "1000", kdv: "10", brut: "1010" }
    );
  });

  it("%0 KDV (istisna)", () => {
    expect(hesaplaKalem({ miktar: "3", birimFiyat: "250.50", kdvOrani: "0" })).toEqual(
      { matrah: "751.5", kdv: "0", brut: "751.5" }
    );
  });

  it("miktarı fiyatla çarpar", () => {
    expect(hesaplaKalem({ miktar: "7", birimFiyat: "12.35", kdvOrani: "20" })).toEqual(
      { matrah: "86.45", kdv: "17.29", brut: "103.74" }
    );
  });

  it("ondalıklı miktarı destekler (kg, saat vb.)", () => {
    expect(
      hesaplaKalem({ miktar: "2.5", birimFiyat: "40", kdvOrani: "10" })
    ).toEqual({ matrah: "100", kdv: "10", brut: "110" });
  });

  it("KDV'yi kuruşa yarım yukarı yuvarlar", () => {
    // 33.33 × 0.20 = 6.666 → 6.67
    expect(hesaplaKalem({ miktar: "1", birimFiyat: "33.33", kdvOrani: "20" })).toEqual(
      { matrah: "33.33", kdv: "6.67", brut: "40" }
    );
    // 0.05 × 0.10 = 0.005 → 0.01
    expect(hesaplaKalem({ miktar: "1", birimFiyat: "0.05", kdvOrani: "10" })).toEqual(
      { matrah: "0.05", kdv: "0.01", brut: "0.06" }
    );
  });

  it("float yerine Decimal aritmetiği kullanır", () => {
    // 0.1 × 3 float'ta 0.30000000000000004 eder.
    expect(
      hesaplaKalem({ miktar: "3", birimFiyat: "0.1", kdvOrani: "0" }).matrah
    ).toBe("0.3");
  });

  it("büyük tutarlarda hassasiyet kaybetmez", () => {
    expect(
      hesaplaKalem({ miktar: "1000000", birimFiyat: "1234.56", kdvOrani: "20" })
    ).toEqual({
      matrah: "1234560000",
      kdv: "246912000",
      brut: "1481472000",
    });
  });
});

describe("hesaplaIslemToplamlari", () => {
  it("tek kalemli işlemi toplar", () => {
    const t = hesaplaIslemToplamlari([
      { miktar: "2", birimFiyat: "500", kdvOrani: "20" },
    ]);
    expect(t.toplamMatrah).toBe("1000");
    expect(t.kdvTutari).toBe("200");
    expect(t.toplamTutar).toBe("1200");
  });

  it("farklı KDV oranlı kalemleri birlikte toplar", () => {
    const t = hesaplaIslemToplamlari([
      { miktar: "1", birimFiyat: "1000", kdvOrani: "20" }, // 1000 + 200
      { miktar: "2", birimFiyat: "250", kdvOrani: "10" }, //  500 +  50
      { miktar: "5", birimFiyat: "100", kdvOrani: "1" }, //   500 +   5
      { miktar: "1", birimFiyat: "300", kdvOrani: "0" }, //   300 +   0
    ]);
    expect(t.toplamMatrah).toBe("2300");
    expect(t.kdvTutari).toBe("255");
    expect(t.toplamTutar).toBe("2555");
  });

  it("toplam, satır brütlerinin toplamına eşittir", () => {
    // Yuvarlama satır bazında yapıldığı için genel toplam ekranda görünen
    // satırlarla uyuşmalı — muhasebede en sık şikâyet edilen tutarsızlık budur.
    const kalemler = [
      { miktar: "3", birimFiyat: "33.33", kdvOrani: "20" },
      { miktar: "7", birimFiyat: "12.35", kdvOrani: "10" },
      { miktar: "1", birimFiyat: "0.05", kdvOrani: "1" },
    ];
    const t = hesaplaIslemToplamlari(kalemler);
    const satirToplami = t.kalemler.reduce(
      (acc, k) => acc + Math.round(Number(k.brut) * 100),
      0
    );
    expect(Math.round(Number(t.toplamTutar) * 100)).toBe(satirToplami);
  });

  it("boş kalem listesinde sıfır döner", () => {
    const t = hesaplaIslemToplamlari([]);
    expect(t.toplamMatrah).toBe("0");
    expect(t.kdvTutari).toBe("0");
    expect(t.toplamTutar).toBe("0");
    expect(t.kalemler).toEqual([]);
  });

  it("çok sayıda küçük kalemde kuruş kaymaz", () => {
    const kalemler = Array.from({ length: 100 }, () => ({
      miktar: "1",
      birimFiyat: "0.01",
      kdvOrani: "0",
    }));
    expect(hesaplaIslemToplamlari(kalemler).toplamTutar).toBe("1");
  });
});

describe("kdvDahilNete / neteKdvEkle", () => {
  it("KDV dahil fiyatı net'e çevirir", () => {
    expect(kdvDahilNete("120", "20")).toBe("100");
    expect(kdvDahilNete("110", "10")).toBe("100");
    expect(kdvDahilNete("101", "1")).toBe("100");
  });

  it("%0'da fiyatı değiştirmez", () => {
    expect(kdvDahilNete("100", "0")).toBe("100");
  });

  it("bölünemeyen fiyatta 4 basamak hassasiyet tutar", () => {
    // 100 / 1.20 = 83.3333...
    expect(kdvDahilNete("100", "20")).toBe("83.3333");
  });

  it("net → dahil → net gidiş dönüşü fiyatı korur", () => {
    for (const [net, oran] of [
      ["100", "20"],
      ["12.35", "10"],
      ["0.05", "1"],
    ] as const) {
      expect(kdvDahilNete(neteKdvEkle(net, oran), oran)).toBe(net);
    }
  });

  it("KDV dahil girişte 4 basamak, kuruş sapmasını önler", () => {
    // 10 adet × KDV dahil 100 TL, %20 → beklenen brüt toplam 1000 TL.
    const net = kdvDahilNete("100", "20"); // 83.3333
    const t = hesaplaIslemToplamlari([
      { miktar: "10", birimFiyat: net, kdvOrani: "20" },
    ]);
    expect(t.toplamTutar).toBe("1000");
  });
});

describe("cariBakiyeEtkisi", () => {
  it("satış cariyi bize borçlandırır (bakiye artar)", () => {
    expect(cariBakiyeEtkisi("SATIS", "1200")).toBe("1200");
  });

  it("alış bizi tedarikçiye borçlandırır (bakiye azalır)", () => {
    expect(cariBakiyeEtkisi("ALIS", "1200")).toBe("-1200");
  });

  it("kuruşa yuvarlar", () => {
    expect(cariBakiyeEtkisi("SATIS", "1200.005")).toBe("1200.01");
  });
});

describe("hesaplaCariBakiyesi — cari bakiye güncelleme", () => {
  it("açılış bakiyesine işlem etkilerini ekler", () => {
    const etkiler = [
      cariBakiyeEtkisi("SATIS", "1200"),
      cariBakiyeEtkisi("ALIS", "500"),
      cariBakiyeEtkisi("SATIS", "300.50"),
    ];
    expect(hesaplaCariBakiyesi("1000", etkiler)).toBe("2000.5");
  });

  it("işlemi olmayan caride bakiye açılışa eşittir", () => {
    expect(hesaplaCariBakiyesi("1500.75", [])).toBe("1500.75");
  });

  it("alışlar satışları aşarsa bakiye negatife (borca) döner", () => {
    const etkiler = [
      cariBakiyeEtkisi("SATIS", "500"),
      cariBakiyeEtkisi("ALIS", "2000"),
    ];
    expect(hesaplaCariBakiyesi("0", etkiler)).toBe("-1500");
  });

  it("işlem silindiğinde ters etki bakiyeyi eski hâline döndürür", () => {
    const etki = cariBakiyeEtkisi("SATIS", "1234.56");
    const sonra = hesaplaCariBakiyesi("1000", [etki]);
    expect(sonra).toBe("2234.56");
    expect(hesaplaCariBakiyesi(sonra, [tersEtki(etki)])).toBe("1000");
  });

  it("float toplamı yerine Decimal toplamı yapar", () => {
    expect(hesaplaCariBakiyesi("0", ["0.1", "0.2", "-0.3"])).toBe("0");
  });
});

describe("cariBakiyesiMutabik", () => {
  it("saklanan bakiye açılış + etkilerle eşleşirse doğrudur", () => {
    expect(cariBakiyesiMutabik("2000.5", "1000", ["1200", "-500", "300.5"])).toBe(
      true
    );
  });

  it("uyuşmazlığı yakalar", () => {
    expect(cariBakiyesiMutabik("2000", "1000", ["1200"])).toBe(false);
  });
});

describe("vade tarihi alanı", () => {
  it("boş bırakılan vade bugüne düşmez, undefined kalır", () => {
    // Aksi halde vade takibinde (Faz 6) her işlem bugün vadeli görünür ve
    // yanlış gecikme uyarısı üretirdi.
    const r = islemSchema.safeParse({
      tip: "SATIS",
      cariId: "c1",
      tarih: "2026-08-15",
      vadeTarihi: "",
      kdvDahil: false,
      kalemler: [
        { urunAdi: "X", miktar: "1", birimFiyat: "100", kdvOrani: "20" },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.data?.vadeTarihi).toBeUndefined();
  });

  it("girilen vadeyi doğru okur", () => {
    const r = islemSchema.safeParse({
      tip: "SATIS",
      cariId: "c1",
      tarih: "2026-08-15",
      vadeTarihi: "2026-09-30",
      kdvDahil: false,
      kalemler: [
        { urunAdi: "X", miktar: "1", birimFiyat: "100", kdvOrani: "20" },
      ],
    });
    expect(r.data?.vadeTarihi?.getFullYear()).toBe(2026);
    expect(r.data?.vadeTarihi?.getMonth()).toBe(8); // Eylül
    expect(r.data?.vadeTarihi?.getDate()).toBe(30);
  });

  it("işlem tarihi boş bırakılırsa bugüne düşer (zorunlu alan)", () => {
    const r = islemSchema.safeParse({
      tip: "SATIS",
      cariId: "c1",
      tarih: "",
      kdvDahil: false,
      kalemler: [
        { urunAdi: "X", miktar: "1", birimFiyat: "100", kdvOrani: "20" },
      ],
    });
    expect(r.data?.tarih).toBeInstanceOf(Date);
  });
});
