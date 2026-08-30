import { describe, expect, it } from "vitest";
import {
  CARI_HAREKET_ETIKETI,
  CARI_HAREKET_TURLERI,
  cariEkstresi,
  ekstreMutabik,
  ekstreOzeti,
  ekstreSonBakiye,
  type CariHareketi,
} from "@/lib/domain/cari-ekstre";

const gun = (g: number) => new Date(2026, 8, g);

function hareket(
  tarih: Date,
  tur: CariHareketi["tur"],
  etki: string
): CariHareketi {
  return { tarih, tur, etki, aciklama: null, href: null };
}

describe("cariEkstresi", () => {
  it("yürüyen bakiyeyi açılıştan başlatır", () => {
    const satirlar = cariEkstresi("1000", [
      hareket(gun(1), "SATIS", "5000"),
      hareket(gun(2), "ODEME", "-2000"),
    ]);

    expect(satirlar.map((s) => s.yurutulenBakiye)).toEqual(["6000", "4000"]);
  });

  it("hareket yoksa son bakiye açılış bakiyesidir", () => {
    const satirlar = cariEkstresi("1500", []);
    expect(satirlar).toEqual([]);
    expect(ekstreSonBakiye("1500", satirlar)).toBe("1500");
  });

  it("hareketleri tarihe göre sıralar — giriş sırası önemsiz", () => {
    const satirlar = cariEkstresi("0", [
      hareket(gun(10), "ODEME", "-300"),
      hareket(gun(1), "SATIS", "1000"),
      hareket(gun(5), "SATIS", "500"),
    ]);

    expect(satirlar.map((s) => s.yurutulenBakiye)).toEqual([
      "1000",
      "1500",
      "1200",
    ]);
  });

  it("aynı gün: fatura çekten ÖNCE gelir", () => {
    // Aksi halde ekstre "önce çek geldi sonra fatura kesildi" gibi okunurdu.
    const satirlar = cariEkstresi("0", [
      hareket(gun(3), "CEK_ALINAN", "-1000"),
      hareket(gun(3), "SATIS", "1000"),
    ]);

    expect(satirlar.map((s) => s.tur)).toEqual(["SATIS", "CEK_ALINAN"]);
    expect(satirlar.map((s) => s.yurutulenBakiye)).toEqual(["1000", "0"]);
  });

  it("kuruş hareketlerinde sapma birikmez", () => {
    const satirlar = cariEkstresi(
      "0",
      Array.from({ length: 100 }, () => hareket(gun(1), "SATIS", "0.01"))
    );
    expect(ekstreSonBakiye("0", satirlar)).toBe("1");
  });

  it("negatif bakiyede de doğru yürür", () => {
    const satirlar = cariEkstresi("0", [
      hareket(gun(1), "ALIS", "-8000"),
      hareket(gun(2), "CEK_VERILEN", "8000"),
    ]);
    expect(satirlar.map((s) => s.yurutulenBakiye)).toEqual(["-8000", "0"]);
  });
});

describe("Karşılıksız çek ekstrede iki satır", () => {
  it("alma ve geri dönüş ayrı görünür, net etki doğru kalır", () => {
    // 5.000'lik çek alındı, 2.000 tahsil edildi, kalan 3.000 yandı.
    const satirlar = cariEkstresi("5000", [
      hareket(gun(1), "CEK_ALINAN", "-5000"),
      hareket(gun(9), "CEK_KARSILIKSIZ", "3000"),
    ]);

    expect(satirlar.map((s) => s.yurutulenBakiye)).toEqual(["0", "3000"]);
    // Net etki: yalnızca fiilen tahsil edilen 2.000 kadar borç kapandı.
    expect(ekstreSonBakiye("5000", satirlar)).toBe("3000");
  });
});

describe("ekstreMutabik", () => {
  it("son bakiye saklanan bakiyeyle eşitse doğrudur", () => {
    const satirlar = cariEkstresi("0", [hareket(gun(1), "SATIS", "1200")]);
    expect(ekstreMutabik("1200", "0", satirlar)).toBe(true);
  });

  it("eksik kaynağı yakalar", () => {
    // Ekstrede olmayan bir hareket bakiyeye yansımışsa uyuşmazlık çıkmalı.
    const satirlar = cariEkstresi("0", [hareket(gun(1), "SATIS", "1200")]);
    expect(ekstreMutabik("1500", "0", satirlar)).toBe(false);
  });

  it("hareketsiz caride açılış bakiyesiyle karşılaştırır", () => {
    expect(ekstreMutabik("750", "750", [])).toBe(true);
    expect(ekstreMutabik("0", "750", [])).toBe(false);
  });
});

describe("ekstreOzeti", () => {
  it("bakiyeyi artıran ve azaltan hareketleri ayırır", () => {
    const satirlar = cariEkstresi("0", [
      hareket(gun(1), "SATIS", "10000"),
      hareket(gun(2), "CEK_ALINAN", "-6000"),
      hareket(gun(3), "ODEME", "-1000"),
      hareket(gun(4), "SATIS", "500"),
    ]);

    const o = ekstreOzeti(satirlar);
    expect(o.toplamAlacak).toBe("10500");
    expect(o.toplamBorc).toBe("7000");
    expect(o.hareketSayisi).toBe(4);
  });

  it("etkisiz satır iki tarafa da yazılmaz", () => {
    // Çek tahsilatından doğan fatura ödemesi bakiyeyi etkilemez.
    const satirlar = cariEkstresi("0", [hareket(gun(1), "ODEME", "0")]);
    const o = ekstreOzeti(satirlar);
    expect(o.toplamAlacak).toBe("0");
    expect(o.toplamBorc).toBe("0");
    expect(o.hareketSayisi).toBe(1);
  });
});

describe("Etiket bütünlüğü", () => {
  it("her hareket türünün Türkçe karşılığı tanımlı", () => {
    for (const t of CARI_HAREKET_TURLERI) {
      expect(CARI_HAREKET_ETIKETI[t]).toBeTruthy();
    }
  });
});
