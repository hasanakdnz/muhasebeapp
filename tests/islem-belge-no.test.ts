import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import {
  ISLEM_NO_ONEKI,
  islemNoUret,
  sonrakiIslemNo,
} from "@/lib/domain/islem";
import {
  belgeNoAyristir,
  belgeNoUret,
  sonrakiBelgeNo,
} from "@/lib/domain/belge-no";
import { cariOlustur } from "@/lib/cari";
import { getIslem, islemOlustur, listeleIslemler } from "@/lib/islem";
import { cariEkstresiGetir } from "@/lib/cari";

describe("belgeNoUret / sonrakiBelgeNo — ortak kural", () => {
  it("önek, yıl ve sıfır dolgulu sıra üretir", () => {
    expect(belgeNoUret("FTR", 2026, 1)).toBe("FTR-2026-0001");
    expect(belgeNoUret("PRF", 2026, 42)).toBe("PRF-2026-0042");
    // Dört basamağı aşınca kırpılmaz, uzar.
    expect(belgeNoUret("ALS", 2026, 12345)).toBe("ALS-2026-12345");
  });

  it("yalnızca kendi önekini ayrıştırır", () => {
    expect(belgeNoAyristir("FTR", "FTR-2026-0007")).toEqual({
      yil: 2026,
      sira: 7,
    });
    // Başka önek bu sayacı etkilememeli.
    expect(belgeNoAyristir("FTR", "ALS-2026-0007")).toBeNull();
  });

  it("sıra kayıt sayısından değil EN BÜYÜK numaradan üretilir", () => {
    // Aradan silme olsa da kullanılmış numara tekrar verilmez.
    expect(sonrakiBelgeNo("FTR", 2026, ["FTR-2026-0001", "FTR-2026-0003"])).toBe(
      "FTR-2026-0004"
    );
  });

  it("yıl değişince sıra 1'e döner", () => {
    expect(sonrakiBelgeNo("FTR", 2027, ["FTR-2026-0009"])).toBe("FTR-2027-0001");
  });
});

describe("İşlem numarası tipe göre ayrı sayaç kullanır", () => {
  it("satış FTR, alış ALS önekini alır", () => {
    expect(ISLEM_NO_ONEKI.SATIS).toBe("FTR");
    expect(ISLEM_NO_ONEKI.ALIS).toBe("ALS");
    expect(islemNoUret("SATIS", 2026, 1)).toBe("FTR-2026-0001");
    expect(islemNoUret("ALIS", 2026, 1)).toBe("ALS-2026-0001");
  });

  it("alış kaydı satış serisinde boşluk açmaz", () => {
    // Satış faturası serisi kesintisiz olmalıdır.
    const mevcut = ["FTR-2026-0001", "ALS-2026-0001", "ALS-2026-0002"];
    expect(sonrakiIslemNo("SATIS", 2026, mevcut)).toBe("FTR-2026-0002");
    expect(sonrakiIslemNo("ALIS", 2026, mevcut)).toBe("ALS-2026-0003");
  });
});

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 0, g);

async function cariEkle(unvan: string) {
  return cariOlustur(
    { unvan, tip: "HER_IKISI", acilisBakiyesi: "0" },
    db.prisma
  );
}

async function islem(
  cariId: string,
  tip: "SATIS" | "ALIS",
  tutar: string,
  ek: { belgeNo?: string; tarih?: Date } = {}
) {
  return islemOlustur(
    {
      tip,
      cariId,
      tarih: ek.tarih ?? gun(1),
      belgeNo: ek.belgeNo,
      kalemler: [
        { urunAdi: "Mal", miktar: "1", birimFiyat: tutar, kdvOrani: "0" },
      ],
    },
    db.prisma
  );
}

describe("Numara kayıtta üretilir", () => {
  it("art arda satışlar sırayla numaralanır", async () => {
    const cari = await cariEkle("Numara Sırası");
    const a = await islem(cari.id, "SATIS", "100");
    const b = await islem(cari.id, "SATIS", "200");

    const ilk = await getIslem(a.id, db.prisma);
    const ikinci = await getIslem(b.id, db.prisma);

    expect(ilk?.no).toMatch(/^FTR-2026-\d{4}$/);
    const sira = (n: string) => Number(n.split("-")[2]);
    expect(sira(ikinci!.no)).toBe(sira(ilk!.no) + 1);
  });

  it("alış ve satış sayaçları birbirini etkilemez", async () => {
    const cari = await cariEkle("Ayrı Sayaç");
    const s = await islem(cari.id, "SATIS", "100");
    const a = await islem(cari.id, "ALIS", "100");

    expect((await getIslem(s.id, db.prisma))?.no).toMatch(/^FTR-/);
    expect((await getIslem(a.id, db.prisma))?.no).toMatch(/^ALS-/);
  });

  it("farklı yıllarda sıra baştan başlar", async () => {
    const cari = await cariEkle("Yıl Değişimi");
    const y2027 = await islem(cari.id, "SATIS", "100", {
      tarih: new Date(2027, 2, 5),
    });
    expect((await getIslem(y2027.id, db.prisma))?.no).toBe("FTR-2027-0001");
  });

  it("numara benzersizdir", async () => {
    const cari = await cariEkle("Benzersizlik");
    const kayitlar = await Promise.all([
      islem(cari.id, "SATIS", "10"),
      islem(cari.id, "SATIS", "20"),
      islem(cari.id, "SATIS", "30"),
    ]);
    const nolar = await Promise.all(
      kayitlar.map(async (k) => (await getIslem(k.id, db.prisma))!.no)
    );
    expect(new Set(nolar).size).toBe(nolar.length);
  });
});

describe("Karşı tarafın belge numarası", () => {
  it("alış faturasında tedarikçinin numarası saklanır", async () => {
    const cari = await cariEkle("Tedarikçi Belge No");
    const a = await islem(cari.id, "ALIS", "500", { belgeNo: "ABC2026000123" });

    const kayit = await getIslem(a.id, db.prisma);
    expect(kayit?.belgeNo).toBe("ABC2026000123");
    // İç numara yine de üretilir — kayda kendi referansımızla ulaşabilmeliyiz.
    expect(kayit?.no).toMatch(/^ALS-2026-\d{4}$/);
  });

  it("boş bırakılabilir", async () => {
    const cari = await cariEkle("Belge No Yok");
    const a = await islem(cari.id, "SATIS", "500");
    expect((await getIslem(a.id, db.prisma))?.belgeNo).toBeNull();
  });
});

describe("Numara listede ve ekstrede görünür", () => {
  it("işlem listesi numarayı taşır", async () => {
    const cari = await cariEkle("Liste Numarası");
    await islem(cari.id, "SATIS", "750");

    const liste = await listeleIslemler({ cariId: cari.id }, db.prisma);
    expect(liste[0].no).toMatch(/^FTR-/);
  });

  it("cari ekstresinde açıklama numarayla başlar", async () => {
    const cari = await cariEkle("Ekstre Numarası");
    await islem(cari.id, "SATIS", "900", { belgeNo: "XYZ-77" });

    const e = await cariEkstresiGetir(cari.id, db.prisma);
    const satir = e!.satirlar[0];
    // Mutabakatta aranan bilgi ürün adı değil, numaradır.
    expect(satir.aciklama).toMatch(/^FTR-2026-\d{4} · XYZ-77 · Mal$/);
  });
});
