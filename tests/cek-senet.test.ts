import { describe, expect, it } from "vitest";
import {
  cekCariEtkisi,
  durumDegisikligiKontrol,
  hesaplaPortfoyOzeti,
  hesaplaTahsilat,
  sonrakiDurum,
  tahsilatKontrol,
  tahsilatMutabik,
  tersEtki,
} from "@/lib/domain/cek-senet";

describe("hesaplaTahsilat", () => {
  it("hiç tahsilat yokken kalan tutarın tamamıdır", () => {
    const o = hesaplaTahsilat("10000", []);
    expect(o.tahsilEdilen).toBe("0");
    expect(o.kalan).toBe("10000");
    expect(o.tamamlandiMi).toBe(false);
  });

  it("tek kısmi tahsilatı toplar", () => {
    const o = hesaplaTahsilat("10000", ["3500.50"]);
    expect(o.tahsilEdilen).toBe("3500.5");
    expect(o.kalan).toBe("6499.5");
    expect(o.tamamlandiMi).toBe(false);
  });

  it("birden fazla kısmi tahsilatı toplar", () => {
    const o = hesaplaTahsilat("10000", ["2500", "3000.25", "1499.75"]);
    expect(o.tahsilEdilen).toBe("7000");
    expect(o.kalan).toBe("3000");
    expect(o.tahsilatSayisi).toBe(3);
    expect(o.tamamlandiMi).toBe(false);
  });

  it("kısmi tahsilatlar tutarı tamamlayınca bitmiş sayar", () => {
    const o = hesaplaTahsilat("10000", ["2500", "3000.25", "4499.75"]);
    expect(o.tahsilEdilen).toBe("10000");
    expect(o.kalan).toBe("0");
    expect(o.tamamlandiMi).toBe(true);
  });

  it("tek seferde tam tahsilat", () => {
    const o = hesaplaTahsilat("10000", ["10000"]);
    expect(o.kalan).toBe("0");
    expect(o.tamamlandiMi).toBe(true);
  });

  it("kuruşlu çok sayıda tahsilatta float kayması yapmaz", () => {
    // 100 × 0.01 = 1.00; float ile 0.9999999999999999 çıkardı.
    const yuz = Array.from({ length: 100 }, () => "0.01");
    const o = hesaplaTahsilat("1", yuz);
    expect(o.tahsilEdilen).toBe("1");
    expect(o.kalan).toBe("0");
    expect(o.tamamlandiMi).toBe(true);
  });
});

describe("tahsilatKontrol — fazla tahsilat engeli", () => {
  const portfoyde = {
    tutar: "10000",
    tahsilEdilen: "0",
    durum: "PORTFOYDE" as const,
  };

  it("kalan kadar tahsilatı kabul eder", () => {
    expect(tahsilatKontrol(portfoyde, "10000").gecerli).toBe(true);
    expect(tahsilatKontrol(portfoyde, "1").gecerli).toBe(true);
  });

  it("kalandan fazlasını reddeder", () => {
    const r = tahsilatKontrol(portfoyde, "10000.01");
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/kalan tutardan büyük/i);
    // Alan katmanı mesajı ham sayı içermemeli — biçimlendirme arayüzün işi.
    expect(r.gecerli === false && r.hata).not.toMatch(/\d/);
  });

  it("kısmi tahsilat sonrası kalanı doğru hesaplar", () => {
    const kismi = { tutar: "10000", tahsilEdilen: "7000", durum: "PORTFOYDE" as const };
    expect(tahsilatKontrol(kismi, "3000").gecerli).toBe(true);
    expect(tahsilatKontrol(kismi, "3000.01").gecerli).toBe(false);
  });

  it("sıfır ve negatif tutarı reddeder", () => {
    expect(tahsilatKontrol(portfoyde, "0").gecerli).toBe(false);
    expect(tahsilatKontrol(portfoyde, "-100").gecerli).toBe(false);
  });

  it("tamamen tahsil edilmişe yeni tahsilat kabul etmez", () => {
    const bitti = { tutar: "10000", tahsilEdilen: "10000", durum: "TAHSIL_EDILDI" as const };
    const r = tahsilatKontrol(bitti, "1");
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/zaten tamamen tahsil/i);
  });

  it("karşılıksız ve ciro edilmiş çeke tahsilat kabul etmez", () => {
    for (const durum of ["KARSILIKSIZ", "CIRO_EDILDI"] as const) {
      const r = tahsilatKontrol({ tutar: "10000", tahsilEdilen: "0", durum }, "100");
      expect(r.gecerli).toBe(false);
    }
  });
});

describe("sonrakiDurum — durum geçişleri", () => {
  it("kısmi tahsilatta portföyde kalır", () => {
    // Şemada "kısmi tahsil" durumu yok; kısmen tahsil edilmiş kayıt hâlâ portföydedir.
    expect(sonrakiDurum("PORTFOYDE", "10000", "3000")).toBe("PORTFOYDE");
    expect(sonrakiDurum("PORTFOYDE", "10000", "9999.99")).toBe("PORTFOYDE");
  });

  it("tam tahsilatta otomatik TAHSIL_EDILDI olur", () => {
    expect(sonrakiDurum("PORTFOYDE", "10000", "10000")).toBe("TAHSIL_EDILDI");
  });

  it("tahsilat geri alınınca portföye döner", () => {
    expect(sonrakiDurum("TAHSIL_EDILDI", "10000", "6000")).toBe("PORTFOYDE");
    expect(sonrakiDurum("TAHSIL_EDILDI", "10000", "0")).toBe("PORTFOYDE");
  });

  it("karşılıksız ve ciro edilmiş durumları korunur", () => {
    expect(sonrakiDurum("KARSILIKSIZ", "10000", "0")).toBe("KARSILIKSIZ");
    expect(sonrakiDurum("CIRO_EDILDI", "10000", "0")).toBe("CIRO_EDILDI");
  });
});

describe("durumDegisikligiKontrol — elle işaretleme", () => {
  it("portföydeki çek karşılıksız işaretlenebilir", () => {
    expect(
      durumDegisikligiKontrol(
        { tahsilEdilen: "0", durum: "PORTFOYDE" },
        "KARSILIKSIZ"
      ).gecerli
    ).toBe(true);
  });

  it("ciro düz durum değişikliğiyle yapılamaz — hedef cari gerekir", () => {
    // Ciro İKİ cari bakiyesini birden etkiler ve hedef cari bilgisi ister;
    // bu yüzden ayrı bir işlemdir (ciroKontrol / ciroEt).
    const r = durumDegisikligiKontrol(
      { tahsilEdilen: "0", durum: "PORTFOYDE" },
      "CIRO_EDILDI"
    );
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/hedef cariyi/i);
  });

  it("ciro edilmiş çekin durumu önce ciro geri alınmadan değiştirilemez", () => {
    const r = durumDegisikligiKontrol(
      { tahsilEdilen: "0", durum: "CIRO_EDILDI" },
      "PORTFOYDE"
    );
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/ciroyu geri alın/i);
  });

  it("TAHSIL_EDILDI elle seçilemez", () => {
    const r = durumDegisikligiKontrol(
      { tahsilEdilen: "0", durum: "PORTFOYDE" },
      "TAHSIL_EDILDI"
    );
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/elle seçilemez/i);
  });

  it("ciro edilmiş çek karşılıksız işaretlenemez", () => {
    expect(
      durumDegisikligiKontrol(
        { tahsilEdilen: "0", durum: "CIRO_EDILDI" },
        "KARSILIKSIZ"
      ).gecerli
    ).toBe(false);
  });

  it("hatalı işaretleme portföye döndürülerek düzeltilebilir", () => {
    expect(
      durumDegisikligiKontrol(
        { tahsilEdilen: "0", durum: "KARSILIKSIZ" },
        "PORTFOYDE"
      ).gecerli
    ).toBe(true);
  });
});

describe("cekCariEtkisi — cari bakiyeye yansıma", () => {
  it("alınan çek ALINDIĞI ANDA carinin borcunu kapatır (bakiye düşer)", () => {
    expect(cekCariEtkisi("ALINAN", "PORTFOYDE", "3000", "0")).toBe("-3000");
  });

  it("verilen çek VERİLDİĞİ ANDA bizim borcumuzu kapatır (bakiye yükselir)", () => {
    expect(cekCariEtkisi("VERILEN", "PORTFOYDE", "3000", "0")).toBe("3000");
  });

  it("tahsilat etkiyi DEĞİŞTİRMEZ — borç zaten kapanmıştı", () => {
    // Çift sayımın kaynağı buydu: hem çek kaydı hem tahsilat sayılıyordu.
    expect(cekCariEtkisi("ALINAN", "PORTFOYDE", "3000", "0")).toBe(
      cekCariEtkisi("ALINAN", "PORTFOYDE", "3000", "1500")
    );
    expect(cekCariEtkisi("ALINAN", "TAHSIL_EDILDI", "3000", "3000")).toBe("-3000");
  });

  it("karşılıksız çekte borç geri gelir — etki yalnızca tahsil edilen kadardır", () => {
    expect(cekCariEtkisi("ALINAN", "KARSILIKSIZ", "3000", "0")).toBe("0");
    expect(cekCariEtkisi("ALINAN", "KARSILIKSIZ", "3000", "1000")).toBe("-1000");
    expect(cekCariEtkisi("VERILEN", "KARSILIKSIZ", "3000", "1000")).toBe("1000");
  });

  it("ciro edilen çekte veren tarafın etkisi korunur", () => {
    // Müşterinin borcu çeki verdiği anda kapandı; çekin sonradan devredilmesi
    // onu ilgilendirmez.
    expect(cekCariEtkisi("ALINAN", "CIRO_EDILDI", "3000", "0")).toBe("-3000");
  });

  it("kuruşa yuvarlar", () => {
    expect(cekCariEtkisi("ALINAN", "PORTFOYDE", "3000.005", "0")).toBe("-3000.01");
  });

  it("etki geri alınırken ters işaret uygulanır", () => {
    const etki = cekCariEtkisi("ALINAN", "PORTFOYDE", "3000", "0");
    expect(tersEtki(etki)).toBe("3000");
  });
});

describe("tahsilatMutabik", () => {
  it("saklanan toplam tahsilat kayıtlarıyla eşleşirse doğrudur", () => {
    expect(tahsilatMutabik("7000", ["2500", "3000.25", "1499.75"])).toBe(true);
  });

  it("uyuşmazlığı yakalar", () => {
    expect(tahsilatMutabik("7000", ["2500", "3000"])).toBe(false);
  });
});

describe("hesaplaPortfoyOzeti", () => {
  it("tahsil edilecek ve ödenecek tutarları ayırır", () => {
    const ozet = hesaplaPortfoyOzeti([
      { yon: "ALINAN", durum: "PORTFOYDE", tutar: "10000", tahsilEdilen: "3000" },
      { yon: "ALINAN", durum: "PORTFOYDE", tutar: "5000", tahsilEdilen: "0" },
      { yon: "VERILEN", durum: "PORTFOYDE", tutar: "8000", tahsilEdilen: "1000" },
    ]);
    expect(ozet.tahsilEdilecek).toBe("12000"); // 7000 + 5000
    expect(ozet.odenecek).toBe("7000");
  });

  it("tamamlanmış ve ciro edilmiş kayıtları beklenen akıştan çıkarır", () => {
    const ozet = hesaplaPortfoyOzeti([
      { yon: "ALINAN", durum: "TAHSIL_EDILDI", tutar: "10000", tahsilEdilen: "10000" },
      { yon: "ALINAN", durum: "CIRO_EDILDI", tutar: "5000", tahsilEdilen: "0" },
    ]);
    expect(ozet.tahsilEdilecek).toBe("0");
    expect(ozet.odenecek).toBe("0");
  });

  it("karşılıksız kalan tutarı ayrı gösterir", () => {
    const ozet = hesaplaPortfoyOzeti([
      { yon: "ALINAN", durum: "KARSILIKSIZ", tutar: "10000", tahsilEdilen: "2000" },
    ]);
    expect(ozet.karsiliksiz).toBe("8000");
    expect(ozet.tahsilEdilecek).toBe("0");
  });
});
