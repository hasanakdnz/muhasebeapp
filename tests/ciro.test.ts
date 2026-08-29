import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { ciroEtkileri, ciroKontrol } from "@/lib/domain/cek-senet";
import {
  cariBakiyesiniDogrula,
  cariOlustur,
  cariSilinebilirMi,
  getCari,
} from "@/lib/cari";
import { islemOlustur } from "@/lib/islem";
import {
  cekSenetOlustur,
  cekSenetSil,
  ciroEt,
  ciroGeriAl,
  getCekSenet,
  tahsilatEkle,
} from "@/lib/cek-senet";

describe("ciroKontrol", () => {
  const portfoyde = {
    yon: "ALINAN" as const,
    durum: "PORTFOYDE" as const,
    tahsilEdilen: "0",
    cariId: "musteri-1",
  };

  it("portföydeki, hiç tahsil edilmemiş alınan çek ciro edilebilir", () => {
    expect(ciroKontrol(portfoyde, "tedarikci-1").gecerli).toBe(true);
  });

  it("verilen çek ciro edilemez — zaten bizde değildir", () => {
    const r = ciroKontrol({ ...portfoyde, yon: "VERILEN" }, "tedarikci-1");
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/yalnızca alınan/i);
  });

  it("kısmen tahsil edilmiş çek ciro edilemez", () => {
    // Çek tek parça bir senettir; bir kısmını bozdurup kalanını devretmek olmaz.
    const r = ciroKontrol({ ...portfoyde, tahsilEdilen: "1000" }, "tedarikci-1");
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/kısmen tahsil/i);
  });

  it("portföyde olmayan çek ciro edilemez", () => {
    for (const durum of ["TAHSIL_EDILDI", "KARSILIKSIZ", "CIRO_EDILDI"] as const) {
      expect(ciroKontrol({ ...portfoyde, durum }, "tedarikci-1").gecerli).toBe(
        false
      );
    }
  });

  it("hedef cari zorunludur", () => {
    const r = ciroKontrol(portfoyde, "  ");
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/cariyi seçin/i);
  });

  it("çek, kendisini veren cariye ciro edilemez", () => {
    const r = ciroKontrol(portfoyde, "musteri-1");
    expect(r.gecerli).toBe(false);
    expect(r.gecerli === false && r.hata).toMatch(/kendisini veren/i);
  });
});

describe("ciroEtkileri", () => {
  it("iki tarafa zıt işaretli, eşit büyüklükte etki üretir", () => {
    const e = ciroEtkileri("10000");
    // Çeki veren müşterinin borcu kapanır → bakiyesi düşer.
    expect(e.verenCari).toBe("-10000");
    // Çeki devrettiğimiz tedarikçiye borcumuz azalır → bakiyesi yükselir.
    expect(e.alanCari).toBe("10000");
  });

  it("etkilerin toplamı sıfırdır — değer sistemden çıkmaz, taraf değiştirir", () => {
    const e = ciroEtkileri("1234.56");
    expect(Number(e.verenCari) + Number(e.alanCari)).toBe(0);
  });

  it("kuruşa yuvarlar", () => {
    expect(ciroEtkileri("1000.005").alanCari).toBe("1000.01");
  });
});

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 4, g);

async function cariEkle(unvan: string, acilis = "0") {
  return cariOlustur(
    { unvan, tip: "HER_IKISI", acilisBakiyesi: acilis },
    db.prisma
  );
}

describe("Ciro — uçtan uca", () => {
  it("müşterinin borcu kapanır, tedarikçiye borcumuz azalır", async () => {
    // Senaryo: Ahmet Bey bizden 10.000 mal aldı ve karşılığında çek verdi.
    // Mehmet Bey'e de 10.000 borcumuz var. Ahmet'in çekini Mehmet'e ciro
    // ediyoruz — gerçekte iki hesap da kapanır.
    const ahmet = await cariEkle("Ahmet Bey");
    const mehmet = await cariEkle("Mehmet Bey");

    await islemOlustur(
      {
        tip: "SATIS",
        cariId: ahmet.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Mal", miktar: "1", birimFiyat: "10000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    await islemOlustur(
      {
        tip: "ALIS",
        cariId: mehmet.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Hammadde", miktar: "1", birimFiyat: "10000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );

    expect((await getCari(ahmet.id, db.prisma))?.bakiye).toBe("10000");
    expect((await getCari(mehmet.id, db.prisma))?.bakiye).toBe("-10000");

    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: ahmet.id,
        tutar: "10000",
        vadeTarihi: gun(30),
      },
      db.prisma
    );
    // Çek kaydı tek başına hiçbir bakiyeyi değiştirmez.
    expect((await getCari(ahmet.id, db.prisma))?.bakiye).toBe("10000");

    await ciroEt(cek.id, mehmet.id, gun(5), db.prisma);

    // Ciro sonrası iki hesap da kapanmalı.
    expect((await getCari(ahmet.id, db.prisma))?.bakiye).toBe("0");
    expect((await getCari(mehmet.id, db.prisma))?.bakiye).toBe("0");

    const kayit = await getCekSenet(cek.id, db.prisma);
    expect(kayit?.durum).toBe("CIRO_EDILDI");
    expect(kayit?.ciroEdilenCariId).toBe(mehmet.id);
    expect(kayit?.ciroEdilenCariUnvan).toBe("Mehmet Bey");
    expect(kayit?.ciroTarihi).not.toBeNull();

    // Mutabakat ciro etkilerini de saymalı — iki tarafta da.
    expect((await cariBakiyesiniDogrula(ahmet.id, db.prisma)).mutabik).toBe(true);
    expect((await cariBakiyesiniDogrula(mehmet.id, db.prisma)).mutabik).toBe(true);
  });

  it("ciro geri alınınca iki bakiye de eski hâline döner", async () => {
    const musteri = await cariEkle("Geri Alma Müşterisi", "5000");
    const tedarikci = await cariEkle("Geri Alma Tedarikçisi", "-5000");

    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: musteri.id,
        tutar: "5000",
        vadeTarihi: gun(30),
      },
      db.prisma
    );

    await ciroEt(cek.id, tedarikci.id, gun(5), db.prisma);
    expect((await getCari(musteri.id, db.prisma))?.bakiye).toBe("0");
    expect((await getCari(tedarikci.id, db.prisma))?.bakiye).toBe("0");

    await ciroGeriAl(cek.id, db.prisma);

    expect((await getCari(musteri.id, db.prisma))?.bakiye).toBe("5000");
    expect((await getCari(tedarikci.id, db.prisma))?.bakiye).toBe("-5000");

    const kayit = await getCekSenet(cek.id, db.prisma);
    expect(kayit?.durum).toBe("PORTFOYDE");
    expect(kayit?.ciroEdilenCariId).toBeNull();
    expect(kayit?.ciroTarihi).toBeNull();

    expect((await cariBakiyesiniDogrula(musteri.id, db.prisma)).mutabik).toBe(true);
    expect((await cariBakiyesiniDogrula(tedarikci.id, db.prisma)).mutabik).toBe(
      true
    );
  });

  it("ciro edilmiş çeke tahsilat kaydedilemez", async () => {
    const m = await cariEkle("Tahsilat Denemesi M");
    const t = await cariEkle("Tahsilat Denemesi T");
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: m.id, tutar: "3000", vadeTarihi: gun(30) },
      db.prisma
    );
    await ciroEt(cek.id, t.id, gun(5), db.prisma);

    await expect(
      tahsilatEkle(cek.id, { tutar: "100", tarih: gun(6) }, db.prisma)
    ).rejects.toThrow();
  });

  it("kısmen tahsil edilmiş çek ciro edilemez", async () => {
    const m = await cariEkle("Kısmi M", "5000");
    const t = await cariEkle("Kısmi T");
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: m.id, tutar: "5000", vadeTarihi: gun(30) },
      db.prisma
    );
    await tahsilatEkle(cek.id, { tutar: "1000", tarih: gun(5) }, db.prisma);

    await expect(ciroEt(cek.id, t.id, gun(6), db.prisma)).rejects.toThrow(
      /kısmen tahsil/i
    );
    // Reddedilen ciro hiçbir yan etki bırakmamalı.
    expect((await getCari(m.id, db.prisma))?.bakiye).toBe("4000");
    expect((await getCari(t.id, db.prisma))?.bakiye).toBe("0");
  });

  it("verilen çek ciro edilemez", async () => {
    const t1 = await cariEkle("Verilen Çek T1");
    const t2 = await cariEkle("Verilen Çek T2");
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "VERILEN", cariId: t1.id, tutar: "2000", vadeTarihi: gun(30) },
      db.prisma
    );
    await expect(ciroEt(cek.id, t2.id, gun(5), db.prisma)).rejects.toThrow(
      /yalnızca alınan/i
    );
  });

  it("ciro edilmiş çek silinince iki bakiye de geri alınır", async () => {
    const m = await cariEkle("Silme M", "7000");
    const t = await cariEkle("Silme T", "-7000");
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: m.id, tutar: "7000", vadeTarihi: gun(30) },
      db.prisma
    );
    await ciroEt(cek.id, t.id, gun(5), db.prisma);
    expect((await getCari(m.id, db.prisma))?.bakiye).toBe("0");
    expect((await getCari(t.id, db.prisma))?.bakiye).toBe("0");

    await cekSenetSil(cek.id, db.prisma);

    expect((await getCari(m.id, db.prisma))?.bakiye).toBe("7000");
    expect((await getCari(t.id, db.prisma))?.bakiye).toBe("-7000");
    expect((await cariBakiyesiniDogrula(m.id, db.prisma)).mutabik).toBe(true);
    expect((await cariBakiyesiniDogrula(t.id, db.prisma)).mutabik).toBe(true);
  });

  it("kendisine çek ciro edilmiş cari silinemez", async () => {
    const m = await cariEkle("Koruma M");
    const t = await cariEkle("Koruma T");
    const cek = await cekSenetOlustur(
      { tip: "CEK", yon: "ALINAN", cariId: m.id, tutar: "1000", vadeTarihi: gun(30) },
      db.prisma
    );
    await ciroEt(cek.id, t.id, gun(5), db.prisma);

    const durum = await cariSilinebilirMi(t.id, db.prisma);
    expect(durum.silinebilir).toBe(false);
    expect(durum.cekSenetSayisi).toBe(1);
  });
});
