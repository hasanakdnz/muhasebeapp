import { describe, expect, it } from "vitest";
import {
  hesaplaOdeme,
  odemeCariEtkisi,
  odemeKontrol,
  odemeMutabik,
  sonrakiStatus,
  tahsilatDagitilabilirKalan,
  tahsilatDagitimKontrol,
} from "@/lib/domain/odeme";

describe("hesaplaOdeme", () => {
  it("ödeme yokken kalan tutarın tamamıdır", () => {
    const o = hesaplaOdeme("11800", []);
    expect(o.odenen).toBe("0");
    expect(o.kalan).toBe("11800");
    expect(o.tamamlandiMi).toBe(false);
  });

  it("birden fazla kısmi ödemeyi toplar", () => {
    const o = hesaplaOdeme("11800", ["5000", "3000.50", "1000"]);
    expect(o.odenen).toBe("9000.5");
    expect(o.kalan).toBe("2799.5");
    expect(o.odemeSayisi).toBe(3);
  });

  it("tamamlanınca kalan tam sıfırdır", () => {
    const o = hesaplaOdeme("11800", ["5000", "6800"]);
    expect(o.kalan).toBe("0");
    expect(o.tamamlandiMi).toBe(true);
  });

  it("kuruşlu çok sayıda ödemede kayma olmaz", () => {
    const yuz = Array.from({ length: 100 }, () => "0.01");
    expect(hesaplaOdeme("1", yuz).kalan).toBe("0");
  });
});

describe("sonrakiStatus", () => {
  it("hiç ödeme yoksa BEKLIYOR", () => {
    expect(sonrakiStatus("BEKLIYOR", "1000", "0")).toBe("BEKLIYOR");
  });

  it("kısmi ödemede KISMI_ODENDI", () => {
    expect(sonrakiStatus("BEKLIYOR", "1000", "400")).toBe("KISMI_ODENDI");
    expect(sonrakiStatus("BEKLIYOR", "1000", "999.99")).toBe("KISMI_ODENDI");
  });

  it("tam ödemede ODENDI", () => {
    expect(sonrakiStatus("KISMI_ODENDI", "1000", "1000")).toBe("ODENDI");
  });

  it("ödeme geri alınınca duruma geri döner", () => {
    expect(sonrakiStatus("ODENDI", "1000", "600")).toBe("KISMI_ODENDI");
    expect(sonrakiStatus("ODENDI", "1000", "0")).toBe("BEKLIYOR");
  });

  it("IPTAL durumu korunur", () => {
    expect(sonrakiStatus("IPTAL", "1000", "1000")).toBe("IPTAL");
    expect(sonrakiStatus("IPTAL", "1000", "0")).toBe("IPTAL");
  });
});

describe("odemeKontrol — fazla ödeme engeli", () => {
  const bekleyen = {
    toplamTutar: "11800",
    odenenTutar: "0",
    status: "BEKLIYOR" as const,
  };

  it("kalan kadar ödemeyi kabul eder", () => {
    expect(odemeKontrol(bekleyen, "11800").gecerli).toBe(true);
    expect(odemeKontrol(bekleyen, "0.01").gecerli).toBe(true);
  });

  it("kalandan fazlasını reddeder", () => {
    const r = odemeKontrol(bekleyen, "11800.01");
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/kalan tutardan büyük/i);
  });

  it("kısmi ödeme sonrası kalanı doğru hesaplar", () => {
    const kismi = {
      toplamTutar: "11800",
      odenenTutar: "9000",
      status: "KISMI_ODENDI" as const,
    };
    expect(odemeKontrol(kismi, "2800").gecerli).toBe(true);
    expect(odemeKontrol(kismi, "2800.01").gecerli).toBe(false);
  });

  it("sıfır ve negatif tutarı reddeder", () => {
    // decimal.js isPositive() sıfır için true döner — regresyon koruması.
    expect(odemeKontrol(bekleyen, "0").gecerli).toBe(false);
    expect(odemeKontrol(bekleyen, "0.004").gecerli).toBe(false);
    expect(odemeKontrol(bekleyen, "-100").gecerli).toBe(false);
  });

  it("tamamen ödenmişe yeni ödeme kabul etmez", () => {
    const bitti = {
      toplamTutar: "11800",
      odenenTutar: "11800",
      status: "ODENDI" as const,
    };
    expect(odemeKontrol(bitti, "1").gecerli).toBe(false);
  });

  it("iptal edilmiş işleme ödeme kabul etmez", () => {
    const iptal = {
      toplamTutar: "11800",
      odenenTutar: "0",
      status: "IPTAL" as const,
    };
    expect(odemeKontrol(iptal, "100").gecerli).toBe(false);
  });
});

describe("tahsilat dağıtımı", () => {
  it("dağıtılabilir kalanı hesaplar", () => {
    expect(tahsilatDagitilabilirKalan("5000", [])).toBe("5000");
    expect(tahsilatDagitilabilirKalan("5000", ["2000", "1500"])).toBe("1500");
    expect(tahsilatDagitilabilirKalan("5000", ["5000"])).toBe("0");
  });

  it("tahsilat tutarını aşan dağıtımı reddeder", () => {
    const r = tahsilatDagitimKontrol("5000", ["3000"], "2000.01");
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/dağıtılabilecek tutar/i);
  });

  it("kalan kadar dağıtımı kabul eder", () => {
    expect(tahsilatDagitimKontrol("5000", ["3000"], "2000").gecerli).toBe(true);
  });
});

describe("odemeCariEtkisi — ÇİFT SAYIM koruması", () => {
  it("çek tahsilatından gelen ödeme bakiyeyi ETKİLEMEZ", () => {
    // O para, çek tahsilatı kaydedilirken bakiyeden zaten düşüldü.
    // Burada da düşülseydi fatura bakiyeyi iki kez azaltırdı.
    expect(odemeCariEtkisi("SATIS", "CEK_TAHSILATI", "5000")).toBe("0");
    expect(odemeCariEtkisi("ALIS", "CEK_TAHSILATI", "5000")).toBe("0");
  });

  it("direkt ödeme satışta bakiyeyi düşürür", () => {
    expect(odemeCariEtkisi("SATIS", "DIREKT", "5000")).toBe("-5000");
  });

  it("direkt ödeme alışta bakiyeyi yükseltir", () => {
    // Tedarikçiye ödeme yaptık; ona borcumuz azaldı.
    expect(odemeCariEtkisi("ALIS", "DIREKT", "5000")).toBe("5000");
  });

  it("kuruşa yuvarlar", () => {
    expect(odemeCariEtkisi("SATIS", "DIREKT", "5000.005")).toBe("-5000.01");
  });
});

describe("odemeMutabik", () => {
  it("saklanan toplam ödeme kayıtlarıyla eşleşirse doğrudur", () => {
    expect(odemeMutabik("9000.5", ["5000", "3000.50", "1000"])).toBe(true);
  });

  it("uyuşmazlığı yakalar", () => {
    expect(odemeMutabik("9000", ["5000", "3000"])).toBe(false);
  });
});
