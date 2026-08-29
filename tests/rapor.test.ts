import { describe, expect, it } from "vitest";
import {
  cariPerformansi,
  gecikmeGunu,
  kdvRaporu,
  yaslandir,
  yaslandirmaKovasi,
} from "@/lib/domain/rapor";

const gun = (yil: number, ay: number, g: number) => new Date(yil, ay - 1, g);
const BUGUN = gun(2026, 9, 1);

/** BUGUN'den `n` gün önce (yani n gün gecikmiş vade). */
const gecikmis = (n: number) => new Date(2026, 8, 1 - n);

describe("gecikmeGunu", () => {
  it("gecikmeyi pozitif, vadesi gelmemişi negatif verir", () => {
    expect(gecikmeGunu(gun(2026, 8, 25), BUGUN)).toBe(7);
    expect(gecikmeGunu(gun(2026, 9, 1), BUGUN)).toBe(0);
    expect(gecikmeGunu(gun(2026, 9, 10), BUGUN)).toBe(-9);
  });

  it("günün saatinden etkilenmez", () => {
    expect(gecikmeGunu(gun(2026, 9, 1), new Date(2026, 8, 1, 23, 59))).toBe(0);
  });
});

/**
 * ROADMAP Faz 7 doğrulaması: "Aging raporu kategorilendirme testi
 * (0-30/31-60/60+ gün sınırları)". Sınırlar çakışmamalı ve boşluk bırakmamalı.
 */
describe("yaslandirmaKovasi — kova sınırları", () => {
  it("vadesi gelmemiş kayıt yaşlandırılmaz", () => {
    expect(yaslandirmaKovasi(-1)).toBe("vadesi-gelmemis");
    expect(yaslandirmaKovasi(-100)).toBe("vadesi-gelmemis");
  });

  it("bugün vadesi gelen 0-30 kovasındadır", () => {
    expect(yaslandirmaKovasi(0)).toBe("0-30");
  });

  it("0-30 kovasının üst sınırı 30. gündür", () => {
    expect(yaslandirmaKovasi(29)).toBe("0-30");
    expect(yaslandirmaKovasi(30)).toBe("0-30");
    expect(yaslandirmaKovasi(31)).toBe("31-60");
  });

  it("31-60 kovasının üst sınırı 60. gündür", () => {
    expect(yaslandirmaKovasi(60)).toBe("31-60");
    expect(yaslandirmaKovasi(61)).toBe("60+");
  });

  it("60+ kovası sınırsızdır", () => {
    expect(yaslandirmaKovasi(365)).toBe("60+");
    expect(yaslandirmaKovasi(10000)).toBe("60+");
  });

  it("kovalar çakışmaz ve boşluk bırakmaz", () => {
    // 0'dan 120'ye kadar her gün tam olarak bir kovaya düşmeli.
    const sayac: Record<string, number> = {};
    for (let g = 0; g <= 120; g += 1) {
      const kova = yaslandirmaKovasi(g);
      sayac[kova] = (sayac[kova] ?? 0) + 1;
    }
    expect(sayac["0-30"]).toBe(31); // 0..30
    expect(sayac["31-60"]).toBe(30); // 31..60
    expect(sayac["60+"]).toBe(60); // 61..120
    expect(sayac["vadesi-gelmemis"]).toBeUndefined();
  });
});

describe("yaslandir", () => {
  it("kayıtları doğru kovalara dağıtır", () => {
    const r = yaslandir(
      [
        { cariId: "a", cariUnvan: "A", vadeTarihi: gecikmis(10), kalanTutar: "1000" },
        { cariId: "a", cariUnvan: "A", vadeTarihi: gecikmis(45), kalanTutar: "2000" },
        { cariId: "a", cariUnvan: "A", vadeTarihi: gecikmis(90), kalanTutar: "3000" },
        { cariId: "b", cariUnvan: "B", vadeTarihi: gun(2026, 9, 20), kalanTutar: "500" },
      ],
      BUGUN
    );

    const a = r.satirlar.find((s) => s.cariId === "a")!;
    expect(a.kovalar["0-30"]).toBe("1000");
    expect(a.kovalar["31-60"]).toBe("2000");
    expect(a.kovalar["60+"]).toBe("3000");
    expect(a.toplam).toBe("6000");

    const b = r.satirlar.find((s) => s.cariId === "b")!;
    expect(b.kovalar["vadesi-gelmemis"]).toBe("500");

    expect(r.genelToplam).toBe("6500");
    expect(r.kovaToplamlari["60+"]).toBe("3000");
  });

  it("satırları toplam borca göre büyükten küçüğe sıralar", () => {
    const r = yaslandir(
      [
        { cariId: "kucuk", cariUnvan: "Küçük", vadeTarihi: gecikmis(5), kalanTutar: "100" },
        { cariId: "buyuk", cariUnvan: "Büyük", vadeTarihi: gecikmis(5), kalanTutar: "9000" },
        { cariId: "orta", cariUnvan: "Orta", vadeTarihi: gecikmis(5), kalanTutar: "500" },
      ],
      BUGUN
    );
    expect(r.satirlar.map((s) => s.cariId)).toEqual(["buyuk", "orta", "kucuk"]);
  });

  it("kalanı sıfır olan kayıtları rapora almaz", () => {
    const r = yaslandir(
      [
        { cariId: "a", cariUnvan: "A", vadeTarihi: gecikmis(10), kalanTutar: "0" },
        { cariId: "b", cariUnvan: "B", vadeTarihi: gecikmis(10), kalanTutar: "100" },
      ],
      BUGUN
    );
    expect(r.satirlar).toHaveLength(1);
    expect(r.genelToplam).toBe("100");
  });

  it("kova toplamlarının toplamı genel toplama eşittir", () => {
    const r = yaslandir(
      [
        { cariId: "a", cariUnvan: "A", vadeTarihi: gecikmis(1), kalanTutar: "111.11" },
        { cariId: "b", cariUnvan: "B", vadeTarihi: gecikmis(40), kalanTutar: "222.22" },
        { cariId: "c", cariUnvan: "C", vadeTarihi: gecikmis(80), kalanTutar: "333.33" },
        { cariId: "d", cariUnvan: "D", vadeTarihi: gun(2026, 10, 1), kalanTutar: "444.44" },
      ],
      BUGUN
    );
    const kovaToplami = Object.values(r.kovaToplamlari).reduce(
      (a, v) => a + Number(v),
      0
    );
    expect(kovaToplami).toBeCloseTo(Number(r.genelToplam), 2);
    expect(r.genelToplam).toBe("1111.1");
  });

  it("boş listede boş rapor döner", () => {
    const r = yaslandir([], BUGUN);
    expect(r.satirlar).toEqual([]);
    expect(r.genelToplam).toBe("0");
  });
});

describe("kdvRaporu", () => {
  it("hesaplanan ve indirilecek KDV'yi ayırır", () => {
    const r = kdvRaporu({
      satisKdv: ["2000", "630"],
      alisKdv: ["500"],
      giderKdv: ["200", "590"],
    });
    expect(r.hesaplananKdv).toBe("2630");
    expect(r.indirilecekKdv).toBe("1290");
    expect(r.alisKdvToplami).toBe("500");
    expect(r.giderKdvToplami).toBe("790");
  });

  it("hesaplanan fazlaysa ödenecek KDV çıkar", () => {
    const r = kdvRaporu({ satisKdv: ["2000"], alisKdv: ["500"], giderKdv: [] });
    expect(r.odenecekKdv).toBe("1500");
    expect(r.devredenKdv).toBe("0");
  });

  it("indirilecek fazlaysa sonraki döneme devreder", () => {
    // Türkiye'de devreden KDV iade edilmez, sonraki dönemde indirilir.
    const r = kdvRaporu({ satisKdv: ["500"], alisKdv: ["2000"], giderKdv: [] });
    expect(r.odenecekKdv).toBe("0");
    expect(r.devredenKdv).toBe("1500");
  });

  it("eşitlikte ikisi de sıfırdır", () => {
    const r = kdvRaporu({ satisKdv: ["1000"], alisKdv: ["1000"], giderKdv: [] });
    expect(r.odenecekKdv).toBe("0");
    expect(r.devredenKdv).toBe("0");
  });

  it("boş dönemde sıfır döner", () => {
    const r = kdvRaporu({ satisKdv: [], alisKdv: [], giderKdv: [] });
    expect(r.hesaplananKdv).toBe("0");
    expect(r.indirilecekKdv).toBe("0");
    expect(r.odenecekKdv).toBe("0");
  });

  it("kuruşlu değerlerde float kayması yapmaz", () => {
    const r = kdvRaporu({
      satisKdv: ["0.1", "0.2"],
      alisKdv: ["0.3"],
      giderKdv: [],
    });
    expect(r.hesaplananKdv).toBe("0.3");
    expect(r.odenecekKdv).toBe("0");
    expect(r.devredenKdv).toBe("0");
  });
});

describe("cariPerformansi", () => {
  it("cari bazında toplar, sıralar ve yüzde hesaplar", () => {
    const r = cariPerformansi([
      { cariId: "a", cariUnvan: "A", tutar: "6000" },
      { cariId: "b", cariUnvan: "B", tutar: "3000" },
      { cariId: "a", cariUnvan: "A", tutar: "1000" },
    ]);
    expect(r.map((s) => s.cariId)).toEqual(["a", "b"]);
    expect(r[0].toplam).toBe("7000");
    expect(r[0].adet).toBe(2);
    expect(r[0].yuzde).toBe("70");
    expect(r[1].yuzde).toBe("30");
  });

  it("limit uygular", () => {
    const r = cariPerformansi(
      [
        { cariId: "a", cariUnvan: "A", tutar: "300" },
        { cariId: "b", cariUnvan: "B", tutar: "200" },
        { cariId: "c", cariUnvan: "C", tutar: "100" },
      ],
      2
    );
    expect(r).toHaveLength(2);
    expect(r.map((s) => s.cariId)).toEqual(["a", "b"]);
  });

  it("boş listede boş dizi döner", () => {
    expect(cariPerformansi([])).toEqual([]);
  });
});
