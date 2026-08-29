import { describe, expect, it } from "vitest";
import { anahtarGecerliMi, anahtarMimeTipi } from "@/lib/belge-turleri";

/**
 * Depo anahtarı doğrulaması güvenlik kritiktir: belge servis eden rota bu
 * kontrolün arkasında dosya okuyor. Dizin geçişi buradan geçmemeli.
 */
describe("anahtarGecerliMi", () => {
  const gecerli = "0123456789abcdef0123456789abcdef.jpg";

  it("üretilen biçimi kabul eder", () => {
    expect(anahtarGecerliMi(gecerli)).toBe(true);
    for (const uzanti of ["jpg", "png", "webp", "pdf"]) {
      expect(
        anahtarGecerliMi(`0123456789abcdef0123456789abcdef.${uzanti}`)
      ).toBe(true);
    }
  });

  it("dizin geçişi denemelerini reddeder", () => {
    for (const kotu of [
      "../../.env",
      "..%2F..%2F.env",
      "0123456789abcdef0123456789abcdef.jpg/../../.env",
      "/etc/passwd",
      "C:\\Windows\\win.ini",
      "..\\..\\prisma\\dev.db",
      "./0123456789abcdef0123456789abcdef.jpg",
    ]) {
      expect(anahtarGecerliMi(kotu), kotu).toBe(false);
    }
  });

  it("izinsiz uzantıları reddeder", () => {
    for (const uzanti of ["exe", "js", "html", "svg", "sh", "db"]) {
      expect(
        anahtarGecerliMi(`0123456789abcdef0123456789abcdef.${uzanti}`)
      ).toBe(false);
    }
  });

  it("yanlış uzunluk veya karakter içeren anahtarı reddeder", () => {
    expect(anahtarGecerliMi("kisa.jpg")).toBe(false);
    expect(anahtarGecerliMi("0123456789ABCDEF0123456789ABCDEF.jpg")).toBe(false);
    expect(anahtarGecerliMi("0123456789abcdef0123456789abcdeg.jpg")).toBe(false);
    expect(anahtarGecerliMi("")).toBe(false);
    expect(anahtarGecerliMi("0123456789abcdef0123456789abcdef")).toBe(false);
  });
});

describe("anahtarMimeTipi", () => {
  it("uzantıya göre doğru MIME tipini verir", () => {
    expect(anahtarMimeTipi("0123456789abcdef0123456789abcdef.jpg")).toBe(
      "image/jpeg"
    );
    expect(anahtarMimeTipi("0123456789abcdef0123456789abcdef.pdf")).toBe(
      "application/pdf"
    );
  });

  it("bilinmeyen uzantıda genel tip döner", () => {
    expect(anahtarMimeTipi("dosya.xyz")).toBe("application/octet-stream");
  });
});
