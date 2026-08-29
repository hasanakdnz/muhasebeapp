import { describe, expect, it } from "vitest";
import {
  AUDIT_AKSIYONLARI,
  AUDIT_AKSIYON_ETIKETI,
  AUDIT_AKSIYON_TONU,
  detayParcalari,
  hedefEtiketi,
} from "@/lib/domain/audit";
import {
  paylasimKonusu,
  paylasimMetni,
  whatsappNumarasi,
} from "@/lib/domain/proforma";

describe("Denetim kaydı etiketleri", () => {
  it("her aksiyonun etiketi ve tonu tanımlıdır", () => {
    for (const a of AUDIT_AKSIYONLARI) {
      expect(AUDIT_AKSIYON_ETIKETI[a]).toBeTruthy();
      expect(AUDIT_AKSIYON_TONU[a]).toBeTruthy();
    }
  });

  it("yalnızca silme kırmızıdır — para hareketi iyi/kötü haber değildir", () => {
    expect(AUDIT_AKSIYON_TONU.SIL).toBe("negative");
    expect(AUDIT_AKSIYON_TONU.ODEME).toBe("neutral");
    expect(AUDIT_AKSIYON_TONU.TAHSILAT).toBe("neutral");
  });

  it("bilinmeyen hedef tipini olduğu gibi gösterir", () => {
    expect(hedefEtiketi("Islem")).toBe("İşlem");
    expect(hedefEtiketi("YeniModel")).toBe("YeniModel");
  });
});

describe("Denetim detayı biçimlendirme", () => {
  it("tutarı tutar olarak işaretler", () => {
    const p = detayParcalari({ tutar: "1500.50" });
    expect(p).toEqual([{ etiket: "Tutar", deger: "1500.50", tutarMi: true }]);
  });

  it("kimlik alanlarını gizler — cuid kullanıcıya bir şey anlatmaz", () => {
    const p = detayParcalari({
      cariId: "clx123abc",
      islemId: "clx456def",
      unvan: "Öztürk Nakliyat",
    });
    expect(p).toEqual([
      { etiket: "Ünvan", deger: "Öztürk Nakliyat", tutarMi: false },
    ]);
  });

  it("boş ve tanımsız değerleri atlar", () => {
    expect(detayParcalari({ no: "", tip: undefined, kategori: null })).toEqual(
      []
    );
    expect(detayParcalari(null)).toEqual([]);
  });

  it("ham enum değerlerini kullanıcı diline çevirir", () => {
    // Muhasebeci ekranda "KABUL" değil "Kabul edildi" görmeli.
    expect(detayParcalari({ yeniDurum: "KABUL" }, "Proforma")).toEqual([
      { etiket: "Yeni durum", deger: "Kabul edildi", tutarMi: false },
    ]);
    expect(detayParcalari({ tip: "SATIS" }, "Islem")).toEqual([
      { etiket: "Tip", deger: "Satış", tutarMi: false },
    ]);
    expect(detayParcalari({ kaynak: "proforma" }, "Islem")).toEqual([
      { etiket: "Kaynak", deger: "Tekliften dönüştürüldü", tutarMi: false },
    ]);
  });

  it("karşılığı olmayan değeri gizlemez, olduğu gibi gösterir", () => {
    expect(detayParcalari({ yeniDurum: "YENI_DURUM" }, "Proforma")).toEqual([
      { etiket: "Yeni durum", deger: "YENI_DURUM", tutarMi: false },
    ]);
  });

  it("bayrak alanlarını okunur cümleye çevirir", () => {
    expect(detayParcalari({ geriAlindi: true })).toEqual([
      { etiket: "Ciro", deger: "geri alındı", tutarMi: false },
    ]);
  });
});

describe("WhatsApp numarası normalizasyonu", () => {
  it("Türkiye numaralarını ülke koduyla üretir", () => {
    expect(whatsappNumarasi("0532 123 45 67")).toBe("905321234567");
    expect(whatsappNumarasi("(532) 123 45 67")).toBe("905321234567");
    expect(whatsappNumarasi("+90 532 123 45 67")).toBe("905321234567");
    expect(whatsappNumarasi("905321234567")).toBe("905321234567");
  });

  it("tanınmayan numarada null döner — yanlış kişiye teklif gitmez", () => {
    expect(whatsappNumarasi("123")).toBeNull();
    expect(whatsappNumarasi("")).toBeNull();
    expect(whatsappNumarasi(null)).toBeNull();
    expect(whatsappNumarasi("dahili 245")).toBeNull();
  });
});

describe("Teklif paylaşım metni", () => {
  const temel = {
    no: "PRF-2026-0001",
    firmaUnvani: "Akdeniz Ticaret Ltd. Şti.",
    cariUnvan: "Öztürk Nakliyat",
    toplamTutar: "12.000,00 ₺",
    gecerlilikTarihi: "30.09.2026",
  };

  it("teklif no, tutar ve geçerliliği içerir", () => {
    const metin = paylasimMetni(temel);
    expect(metin).toContain("PRF-2026-0001");
    expect(metin).toContain("12.000,00 ₺");
    expect(metin).toContain("30.09.2026");
    expect(metin).toContain("Öztürk Nakliyat");
    expect(metin).toContain("Akdeniz Ticaret Ltd. Şti.");
  });

  it("geçerlilik tarihi yoksa o satırı hiç yazmaz", () => {
    const metin = paylasimMetni({ ...temel, gecerlilikTarihi: null });
    expect(metin).not.toContain("Geçerlilik");
  });

  it("firma ünvanı tanımsızken imza satırı boş kalmaz", () => {
    const metin = paylasimMetni({ ...temel, firmaUnvani: "" });
    expect(metin.trimEnd().endsWith("İyi çalışmalar dileriz.")).toBe(true);
  });

  it("konu satırı firma tanımsızken de anlamlıdır", () => {
    expect(paylasimKonusu("PRF-2026-0001", "")).toBe(
      "PRF-2026-0001 numaralı teklif"
    );
    expect(paylasimKonusu("PRF-2026-0001", "Akdeniz")).toBe(
      "PRF-2026-0001 · Akdeniz teklifi"
    );
  });
});
