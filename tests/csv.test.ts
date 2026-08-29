import { describe, expect, it } from "vitest";
import { CSV_AYRAC, csvOlustur, csvTutar } from "@/lib/csv";

type Satir = { ad: string; tutar: string };

const sutunlar = [
  { baslik: "Ad", deger: (s: Satir) => s.ad },
  { baslik: "Tutar", deger: (s: Satir) => csvTutar(s.tutar) },
];

describe("csvOlustur — Excel uyumluluğu", () => {
  it("UTF-8 BOM ile başlar", () => {
    // BOM olmazsa Excel dosyayı ANSI sanar ve Türkçe karakterler bozulur.
    const csv = csvOlustur(sutunlar, []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("noktalı virgülle ayırır", () => {
    // Türkçe yerelde ondalık ayracı virgül; virgülle ayrılan dosya tek sütuna düşer.
    expect(CSV_AYRAC).toBe(";");
    const csv = csvOlustur(sutunlar, [{ ad: "Test", tutar: "1234.5" }]);
    expect(csv).toContain("Ad;Tutar");
    expect(csv).toContain("Test;1.234,50");
  });

  it("tutarları Türkçe ondalıkla yazar", () => {
    expect(csvTutar("1234567.89")).toBe("1.234.567,89");
    expect(csvTutar("-500")).toBe("-500,00");
  });

  it("ayraç içeren hücreyi tırnaklar", () => {
    const csv = csvOlustur(sutunlar, [{ ad: "Yılmaz; Ortakları", tutar: "0" }]);
    expect(csv).toContain('"Yılmaz; Ortakları"');
  });

  it("içteki tırnağı ikiler", () => {
    const csv = csvOlustur(sutunlar, [{ ad: 'ABC "Ltd"', tutar: "0" }]);
    expect(csv).toContain('"ABC ""Ltd"""');
  });

  it("satır sonu içeren hücreyi tırnaklar", () => {
    const csv = csvOlustur(sutunlar, [{ ad: "Bir\nİki", tutar: "0" }]);
    expect(csv).toContain('"Bir\nİki"');
  });

  it("CRLF satır sonu kullanır", () => {
    const csv = csvOlustur(sutunlar, [{ ad: "A", tutar: "1" }]);
    expect(csv).toContain("\r\n");
  });

  it("Türkçe karakterleri korur", () => {
    const csv = csvOlustur(sutunlar, [{ ad: "Işık Şirketi Ğ Ü Ö Ç", tutar: "0" }]);
    expect(csv).toContain("Işık Şirketi Ğ Ü Ö Ç");
  });

  it("boş listede yalnızca başlık satırı olur", () => {
    const csv = csvOlustur(sutunlar, []);
    expect(csv.replace("\ufeff", "").trim()).toBe("Ad;Tutar");
  });
});
