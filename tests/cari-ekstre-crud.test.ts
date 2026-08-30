import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { cariEkstresiGetir, cariOlustur, getCari } from "@/lib/cari";
import {
  cekSenetOlustur,
  ciroEt,
  durumDegistir,
  tahsilatEkle,
} from "@/lib/cek-senet";
import { islemOlustur } from "@/lib/islem";
import { odemeEkle } from "@/lib/odeme";

/**
 * Ekstrenin ASIL değişmezi: son yürüyen bakiye, saklanan `Cari.bakiye` ile
 * aynı olmalı. İkisi de `cariHareketleri` üzerinden türediği için ayrışmaları
 * ancak bir kaynak unutulursa mümkün — bu dosya onu yakalar.
 */

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

// Tarihler GEÇMİŞTE seçildi: karşılıksız işareti "şimdi" damgalanır, kurgusal
// tarihler gelecekte olsaydı geri dönüş satırı ekstrenin başına düşerdi.
const gun = (g: number) => new Date(2026, 0, g);

async function cariEkle(unvan: string, acilis = "0") {
  return cariOlustur(
    { unvan, tip: "HER_IKISI", acilisBakiyesi: acilis },
    db.prisma
  );
}

async function satis(cariId: string, tutar: string, g = 1) {
  return islemOlustur(
    {
      tip: "SATIS",
      cariId,
      tarih: gun(g),
      kalemler: [
        { urunAdi: "Mal", miktar: "1", birimFiyat: tutar, kdvOrani: "0" },
      ],
    },
    db.prisma
  );
}

async function cek(
  cariId: string,
  tutar: string,
  yon: "ALINAN" | "VERILEN" = "ALINAN",
  g = 2
) {
  return cekSenetOlustur(
    { tip: "CEK", yon, cariId, tutar, tarih: gun(g), vadeTarihi: gun(30) },
    db.prisma
  );
}

describe("Ekstre ile bakiye ayrışmaz", () => {
  it("boş caride açılış bakiyesini gösterir", async () => {
    const cari = await cariEkle("Boş Ekstre", "2500");
    const e = await cariEkstresiGetir(cari.id, db.prisma);

    expect(e?.satirlar).toHaveLength(0);
    expect(e?.acilisBakiyesi).toBe("2500");
    expect(e?.sonBakiye).toBe("2500");
    expect(e?.mutabik).toBe(true);
  });

  it("satış + çek + tahsilat akışını satır satır gösterir", async () => {
    const cari = await cariEkle("Akış Ekstresi");
    await satis(cari.id, "10000", 1);
    const k = await cek(cari.id, "10000");
    await tahsilatEkle(k.id, { tutar: "10000", tarih: gun(20) }, db.prisma);

    const e = await cariEkstresiGetir(cari.id, db.prisma);

    // Tahsilat cari hesabı etkilemediği için ekstrede AYRI satır yok:
    // satış (+10.000) ve çek alma (−10.000).
    expect(e?.satirlar.map((s) => s.tur)).toEqual(["SATIS", "CEK_ALINAN"]);
    expect(e?.satirlar.map((s) => s.etki)).toEqual(["10000", "-10000"]);
    expect(e?.satirlar.map((s) => s.yurutulenBakiye)).toEqual(["10000", "0"]);
    expect(e?.sonBakiye).toBe("0");
    expect(e?.mutabik).toBe(true);
  });

  it("karşılıksız çek iki satır olarak görünür", async () => {
    const cari = await cariEkle("Karşılıksız Ekstre");
    await satis(cari.id, "5000", 1);
    const k = await cek(cari.id, "5000");
    await tahsilatEkle(k.id, { tutar: "2000", tarih: gun(5) }, db.prisma);
    await durumDegistir(k.id, "KARSILIKSIZ", db.prisma);

    const e = await cariEkstresiGetir(cari.id, db.prisma);

    expect(e?.satirlar.map((s) => s.tur)).toEqual([
      "SATIS",
      "CEK_ALINAN",
      "CEK_KARSILIKSIZ",
    ]);
    expect(e?.satirlar.map((s) => s.etki)).toEqual(["5000", "-5000", "3000"]);
    // Net: yalnızca tahsil edilen 2.000 borcu kapattı.
    expect(e?.sonBakiye).toBe("3000");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("3000");
    expect(e?.mutabik).toBe(true);
  });

  it("ciro ile devralınan çek hedef carinin ekstresinde görünür", async () => {
    const musteri = await cariEkle("Ciro Veren");
    const tedarikci = await cariEkle("Ciro Alan");
    await satis(musteri.id, "7000", 1);
    const k = await cek(musteri.id, "7000");

    await islemOlustur(
      {
        tip: "ALIS",
        cariId: tedarikci.id,
        tarih: gun(2),
        kalemler: [
          { urunAdi: "Hammadde", miktar: "1", birimFiyat: "7000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    await ciroEt(k.id, tedarikci.id, gun(6), db.prisma);

    const veren = await cariEkstresiGetir(musteri.id, db.prisma);
    const alan = await cariEkstresiGetir(tedarikci.id, db.prisma);

    // Veren tarafta ciro AYRI satır değil: borcu çek alınınca kapanmıştı.
    expect(veren?.satirlar.map((s) => s.tur)).toEqual(["SATIS", "CEK_ALINAN"]);
    expect(veren?.sonBakiye).toBe("0");

    expect(alan?.satirlar.map((s) => s.tur)).toEqual(["ALIS", "CIRO_ALINAN"]);
    expect(alan?.satirlar.map((s) => s.etki)).toEqual(["-7000", "7000"]);
    expect(alan?.sonBakiye).toBe("0");

    expect(veren?.mutabik).toBe(true);
    expect(alan?.mutabik).toBe(true);
  });

  it("direkt fatura ödemesi ekstrede yer alır", async () => {
    const cari = await cariEkle("Direkt Ödeme Ekstresi");
    const islem = await satis(cari.id, "4000", 1);
    await odemeEkle(
      islem.id,
      { tutar: "1500", tarih: gun(8), kaynak: "DIREKT" },
      db.prisma
    );

    const e = await cariEkstresiGetir(cari.id, db.prisma);

    expect(e?.satirlar.map((s) => s.tur)).toEqual(["SATIS", "ODEME"]);
    expect(e?.satirlar.map((s) => s.etki)).toEqual(["4000", "-1500"]);
    expect(e?.sonBakiye).toBe("2500");
    expect(e?.mutabik).toBe(true);
  });

  it("verilen çek tedarikçi ekstresinde borcu kapatır", async () => {
    const cari = await cariEkle("Tedarikçi Ekstresi");
    await islemOlustur(
      {
        tip: "ALIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Hammadde", miktar: "1", birimFiyat: "9000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    await cek(cari.id, "9000", "VERILEN", 2);

    const e = await cariEkstresiGetir(cari.id, db.prisma);
    expect(e?.satirlar.map((s) => s.tur)).toEqual(["ALIS", "CEK_VERILEN"]);
    expect(e?.satirlar.map((s) => s.yurutulenBakiye)).toEqual(["-9000", "0"]);
    expect(e?.mutabik).toBe(true);
  });

  it("açılış bakiyesi olan caride yürüyen bakiye ondan başlar", async () => {
    const cari = await cariEkle("Açılışlı", "3000");
    await satis(cari.id, "2000", 4);

    const e = await cariEkstresiGetir(cari.id, db.prisma);
    expect(e?.acilisBakiyesi).toBe("3000");
    expect(e?.satirlar[0].yurutulenBakiye).toBe("5000");
    expect(e?.mutabik).toBe(true);
  });

  it("özet, hareketleri alacak ve borç yönünde ayırır", async () => {
    const cari = await cariEkle("Özet Ekstresi");
    await satis(cari.id, "10000", 1);
    await cek(cari.id, "6000");

    const e = await cariEkstresiGetir(cari.id, db.prisma);
    expect(e?.toplamAlacak).toBe("10000");
    expect(e?.toplamBorc).toBe("6000");
    expect(e?.hareketSayisi).toBe(2);
    expect(e?.sonBakiye).toBe("4000");
  });

  it("olmayan cari için null döner", async () => {
    expect(await cariEkstresiGetir("yok-boyle-bir-cari", db.prisma)).toBeNull();
  });
});
