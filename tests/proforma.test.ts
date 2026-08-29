import { describe, expect, it } from "vitest";
import {
  donusturulebilirMi,
  duzenlenebilirMi,
  gecerliDurumGecisi,
  proformaNoAyristir,
  proformaNoUret,
  silinebilirMi,
  sonrakiDurumlar,
  sonrakiProformaNo,
  suresiDoldu,
  PROFORMA_DURUMLARI,
} from "@/lib/domain/proforma";

describe("Proforma durum akışı", () => {
  it("taslak yalnızca gönderilebilir veya reddedilebilir", () => {
    expect(gecerliDurumGecisi("TASLAK", "GONDERILDI")).toBe(true);
    expect(gecerliDurumGecisi("TASLAK", "RED")).toBe(true);
    // Gönderilmemiş bir teklif kabul edilmiş olamaz.
    expect(gecerliDurumGecisi("TASLAK", "KABUL")).toBe(false);
    expect(gecerliDurumGecisi("TASLAK", "ISLEME_DONUSTU")).toBe(false);
  });

  it("faturaya dönüşmüş teklif hiçbir duruma geçmez", () => {
    for (const d of PROFORMA_DURUMLARI) {
      expect(gecerliDurumGecisi("ISLEME_DONUSTU", d)).toBe(false);
    }
  });

  it("yanlış işaretlenen kabul/red geri alınabilir", () => {
    expect(gecerliDurumGecisi("KABUL", "GONDERILDI")).toBe(true);
    expect(gecerliDurumGecisi("RED", "GONDERILDI")).toBe(true);
  });

  it("işleme dönüştürme durum menüsünde yer almaz", () => {
    // Ayrı ve onaylı bir aksiyondur; sıradan bir durum değişikliği değil.
    expect(sonrakiDurumlar("KABUL")).toEqual(["GONDERILDI"]);
  });

  it("faturaya dönüşmüş teklif düzenlenemez ve silinemez", () => {
    expect(duzenlenebilirMi("ISLEME_DONUSTU")).toBe(false);
    expect(silinebilirMi("ISLEME_DONUSTU")).toBe(false);
    expect(duzenlenebilirMi("KABUL")).toBe(true);
    expect(silinebilirMi("TASLAK")).toBe(true);
  });

  it("yalnızca kabul edilen teklif faturaya dönüşür", () => {
    expect(donusturulebilirMi("KABUL")).toBe(true);
    for (const d of ["TASLAK", "GONDERILDI", "RED", "ISLEME_DONUSTU"] as const) {
      expect(donusturulebilirMi(d)).toBe(false);
    }
  });
});

describe("Proforma numaralandırma", () => {
  it("yıl bazlı, sıfır dolgulu numara üretir", () => {
    expect(proformaNoUret(2026, 1)).toBe("PRF-2026-0001");
    expect(proformaNoUret(2026, 42)).toBe("PRF-2026-0042");
    // Dört basamağı aşınca kırpılmaz, uzar.
    expect(proformaNoUret(2026, 12345)).toBe("PRF-2026-12345");
  });

  it("numarayı geri ayrıştırır", () => {
    expect(proformaNoAyristir("PRF-2026-0007")).toEqual({ yil: 2026, sira: 7 });
    expect(proformaNoAyristir("FTR-2026-0007")).toBeNull();
    expect(proformaNoAyristir("PRF-26-7")).toBeNull();
  });

  it("yıl değişince sıra 1'e döner", () => {
    const mevcut = ["PRF-2025-0001", "PRF-2025-0002"];
    expect(sonrakiProformaNo(2026, mevcut)).toBe("PRF-2026-0001");
  });

  it("aradan kayıt silinse de kullanılmış numarayı tekrar üretmez", () => {
    // Sayıya göre üretilseydi 3 kayıttan biri silinince "0003" tekrarlanırdı.
    const mevcut = ["PRF-2026-0001", "PRF-2026-0003"];
    expect(sonrakiProformaNo(2026, mevcut)).toBe("PRF-2026-0004");
  });

  it("başka yılın numaralarını hesaba katmaz", () => {
    const mevcut = ["PRF-2025-0099", "PRF-2026-0002"];
    expect(sonrakiProformaNo(2026, mevcut)).toBe("PRF-2026-0003");
  });
});

describe("Teklif geçerliliği", () => {
  const bugun = new Date(2026, 7, 30);

  it("gönderilmiş ve tarihi geçmiş teklif süresi dolmuş sayılır", () => {
    expect(suresiDoldu("GONDERILDI", new Date(2026, 7, 29), bugun)).toBe(true);
  });

  it("son gün henüz dolmuş sayılmaz", () => {
    expect(suresiDoldu("GONDERILDI", new Date(2026, 7, 30), bugun)).toBe(false);
  });

  it("karara bağlanmış teklifte geçerlilik tarihi anlamını yitirir", () => {
    // Kabul edilmiş teklif, tarihi geçse de kabuldür.
    expect(suresiDoldu("KABUL", new Date(2026, 0, 1), bugun)).toBe(false);
    expect(suresiDoldu("RED", new Date(2026, 0, 1), bugun)).toBe(false);
    expect(suresiDoldu("TASLAK", new Date(2026, 0, 1), bugun)).toBe(false);
  });

  it("tarihsiz teklif süresiz kabul edilir", () => {
    expect(suresiDoldu("GONDERILDI", null, bugun)).toBe(false);
  });
});
