import { describe, expect, it } from "vitest";
import {
  hesaplaVadeOzeti,
  kalanGun,
  vadeDurumu,
  vadeMetni,
  vadeRozetVaryanti,
  vadeyeGoreSirala,
} from "@/lib/domain/vade";

/** Vade tarihleri gün başına kaydedilir (bkz. lib/validations/common.ts). */
const gun = (yil: number, ay: number, g: number) => new Date(yil, ay - 1, g);

describe("kalanGun — takvim günü farkı", () => {
  it("aynı gün sıfır döner", () => {
    expect(kalanGun(gun(2026, 8, 29), gun(2026, 8, 29))).toBe(0);
  });

  it("günün saati sonucu DEĞİŞTİRMEZ", () => {
    // Vade gece yarısı, "şimdi" akşam 23:59 — hâlâ bugün vadeli.
    const vade = gun(2026, 8, 29);
    const gecVakit = new Date(2026, 7, 29, 23, 59, 59);
    expect(kalanGun(vade, gecVakit)).toBe(0);

    const erkenVakit = new Date(2026, 7, 29, 0, 0, 1);
    expect(kalanGun(vade, erkenVakit)).toBe(0);
  });

  it("gelecek ve geçmiş günleri doğru sayar", () => {
    expect(kalanGun(gun(2026, 8, 30), gun(2026, 8, 29))).toBe(1);
    expect(kalanGun(gun(2026, 9, 5), gun(2026, 8, 29))).toBe(7);
    expect(kalanGun(gun(2026, 8, 28), gun(2026, 8, 29))).toBe(-1);
    expect(kalanGun(gun(2026, 7, 29), gun(2026, 8, 29))).toBe(-31);
  });

  it("ay ve yıl sınırlarını aşar", () => {
    expect(kalanGun(gun(2027, 1, 1), gun(2026, 12, 31))).toBe(1);
    expect(kalanGun(gun(2026, 3, 1), gun(2026, 2, 28))).toBe(1);
  });
});

describe("vadeDurumu — sınır davranışı", () => {
  const bugun = gun(2026, 8, 29);

  it("bugün vadeli kayıt GECİKMİŞ sayılmaz", () => {
    // En kritik sınır: bugün vadesi gelen bir çek, günün herhangi bir saatinde
    // "gecikti" görünmemeli.
    expect(vadeDurumu(gun(2026, 8, 29), new Date(2026, 7, 29, 18, 30))).toBe(
      "bugun"
    );
  });

  it("dün vadeli kayıt gecikmiştir", () => {
    expect(vadeDurumu(gun(2026, 8, 28), bugun)).toBe("gecti");
  });

  it("eşik içindeki kayıt yaklaşıyordur", () => {
    expect(vadeDurumu(gun(2026, 8, 30), bugun)).toBe("yaklasiyor");
    expect(vadeDurumu(gun(2026, 9, 5), bugun)).toBe("yaklasiyor"); // tam 7 gün
  });

  it("eşiğin bir gün ötesi normaldir", () => {
    expect(vadeDurumu(gun(2026, 9, 6), bugun)).toBe("normal"); // 8 gün
  });

  it("eşik değiştirilebilir", () => {
    expect(vadeDurumu(gun(2026, 9, 5), bugun, 3)).toBe("normal");
    expect(vadeDurumu(gun(2026, 9, 1), bugun, 3)).toBe("yaklasiyor");
  });
});

describe("vadeRozetVaryanti", () => {
  it("DESIGN.md renk kuralına uyar", () => {
    // Geçmiş kırmızı, bekleyen amber, uzak vade nötr.
    expect(vadeRozetVaryanti("gecti")).toBe("negative");
    expect(vadeRozetVaryanti("bugun")).toBe("pending");
    expect(vadeRozetVaryanti("yaklasiyor")).toBe("pending");
    expect(vadeRozetVaryanti("normal")).toBe("neutral");
  });
});

describe("vadeMetni", () => {
  const bugun = gun(2026, 8, 29);

  it("gecikmeyi gün sayısıyla anlatır", () => {
    expect(vadeMetni(gun(2026, 8, 24), bugun)).toBe("5 gün gecikti");
  });

  it("bugün vadeliyi ayrı belirtir", () => {
    expect(vadeMetni(gun(2026, 8, 29), bugun)).toBe("bugün vadeli");
  });

  it("kalan günü söyler", () => {
    expect(vadeMetni(gun(2026, 9, 2), bugun)).toBe("4 gün kaldı");
  });
});

describe("vadeyeGoreSirala", () => {
  const bugun = gun(2026, 8, 29);

  it("en çok gecikmiş en üstte, en uzak vade en altta", () => {
    const sirali = vadeyeGoreSirala(
      [
        { kayit: "yakin", vadeTarihi: gun(2026, 9, 1) },
        { kayit: "cokGecikmis", vadeTarihi: gun(2026, 8, 1) },
        { kayit: "bugun", vadeTarihi: gun(2026, 8, 29) },
        { kayit: "azGecikmis", vadeTarihi: gun(2026, 8, 27) },
      ],
      bugun
    );
    expect(sirali.map((s) => s.kayit)).toEqual([
      "cokGecikmis",
      "azGecikmis",
      "bugun",
      "yakin",
    ]);
    expect(sirali[0].durum).toBe("gecti");
    expect(sirali[2].durum).toBe("bugun");
  });

  it("boş listede boş dizi döner", () => {
    expect(vadeyeGoreSirala([], bugun)).toEqual([]);
  });
});

describe("hesaplaVadeOzeti", () => {
  const bugun = gun(2026, 8, 29);

  it("durumlara göre sayar", () => {
    const ozet = hesaplaVadeOzeti(
      [
        gun(2026, 8, 20), // gecti
        gun(2026, 8, 28), // gecti
        gun(2026, 8, 29), // bugün
        gun(2026, 9, 2), // yaklaşıyor
        gun(2026, 12, 1), // normal
      ],
      bugun
    );
    expect(ozet).toEqual({ gecen: 2, bugunVadeli: 1, yaklasan: 1 });
  });

  it("boş listede sıfırlar döner", () => {
    expect(hesaplaVadeOzeti([], bugun)).toEqual({
      gecen: 0,
      bugunVadeli: 0,
      yaklasan: 0,
    });
  });
});
