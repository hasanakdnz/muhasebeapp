import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { cariBakiyesiniDogrula, cariOlustur, getCari } from "@/lib/cari";
import {
  cekSenetOlustur,
  cekSenetSil,
  durumDegistir,
  tahsilatEkle,
} from "@/lib/cek-senet";
import { getIslem, islemOlustur } from "@/lib/islem";
import { kullanilabilirCekler, odemeEkle, odemeSil } from "@/lib/odeme";
import { yaslandirmaRaporuGetir } from "@/lib/rapor";

/**
 * Fatura ↔ çek bağlantısı.
 *
 * Çek modeli "alındığı anda işle"ye geçtiğinde cari hesap kapanıyor ama fatura
 * "bekliyor" kalıyordu: iki defter yalnızca `IslemOdeme` üzerinden bağlıydı ve
 * çek böyle bir kayıt üretmiyordu. Sonuç, yaşlandırma raporunun çekle kapanmış
 * bir alacağı açık göstermesiydi.
 *
 * Artık fatura ödemesinin kaynağı doğrudan ÇEKTİR (önceki `CEK_TAHSILATI`
 * kaldırıldı): faturayı kapatan şey çekin kendisidir, tahsilatı değil.
 */

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
    { unvan, tip: "MUSTERI", acilisBakiyesi: "0" },
    db.prisma
  );
}

async function satis(cariId: string, tutar: string, vade?: Date) {
  return islemOlustur(
    {
      tip: "SATIS",
      cariId,
      tarih: gun(1),
      vadeTarihi: vade,
      kalemler: [
        { urunAdi: "Mal", miktar: "1", birimFiyat: tutar, kdvOrani: "0" },
      ],
    },
    db.prisma
  );
}

async function cek(cariId: string, tutar: string) {
  return cekSenetOlustur(
    {
      tip: "CEK",
      yon: "ALINAN",
      cariId,
      tutar,
      tarih: gun(2),
      vadeTarihi: gun(60),
    },
    db.prisma
  );
}

describe("Çek faturayı kapatır — tahsilat beklenmez", () => {
  it("çek eşleştirilince fatura ÖDENDİ olur, bakiye 0'da kalır", async () => {
    const cari = await cariEkle("Çek Eşleştirme");
    const islem = await satis(cari.id, "10000");
    const k = await cek(cari.id, "10000");

    // Çek alındı: cari kapandı ama fatura hâlâ açık.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await getIslem(islem.id, db.prisma))?.status).toBe("BEKLIYOR");

    const musait = await kullanilabilirCekler(cari.id, db.prisma);
    expect(musait).toHaveLength(1);
    expect(musait[0].dagitilabilir).toBe("10000");

    await odemeEkle(
      islem.id,
      { tutar: "10000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );

    // Fatura kapandı — çek TAHSİL EDİLMEDEN.
    expect((await getIslem(islem.id, db.prisma))?.status).toBe("ODENDI");
    // Bakiye ikinci kez düşmedi.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("yaşlandırma raporu çekle kapanmış faturayı göstermez", async () => {
    const cari = await cariEkle("Yaşlandırma Çek");
    const islem = await satis(cari.id, "4000", gun(5));
    const k = await cek(cari.id, "4000");

    const bugun = new Date(2026, 1, 1);

    // Eşleştirmeden ÖNCE: fatura açık ve gecikmiş görünür.
    const once = await yaslandirmaRaporuGetir("SATIS", bugun, db.prisma);
    expect(
      once.satirlar.find((r) => r.cariId === cari.id)?.toplam
    ).toBe("4000");

    await odemeEkle(
      islem.id,
      { tutar: "4000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );

    // Eşleştirmeden SONRA: rapordan düşer.
    const sonra = await yaslandirmaRaporuGetir("SATIS", bugun, db.prisma);
    expect(sonra.satirlar.find((r) => r.cariId === cari.id)).toBeUndefined();
  });

  it("bir çek birden fazla faturaya bölüştürülebilir", async () => {
    const cari = await cariEkle("Bölüştürme");
    const a = await satis(cari.id, "3000");
    const b = await satis(cari.id, "7000");
    const k = await cek(cari.id, "10000");

    await odemeEkle(
      a.id,
      { tutar: "3000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );
    await odemeEkle(
      b.id,
      { tutar: "7000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );

    expect((await getIslem(a.id, db.prisma))?.status).toBe("ODENDI");
    expect((await getIslem(b.id, db.prisma))?.status).toBe("ODENDI");
    // Çek tamamen dağıtıldı; listede kalmaz.
    expect(await kullanilabilirCekler(cari.id, db.prisma)).toHaveLength(0);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
  });

  it("çek tutarından fazlası faturalara dağıtılamaz", async () => {
    const cari = await cariEkle("Aşırı Dağıtım");
    const a = await satis(cari.id, "6000");
    const b = await satis(cari.id, "6000");
    const k = await cek(cari.id, "10000");

    await odemeEkle(
      a.id,
      { tutar: "6000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );

    await expect(
      odemeEkle(
        b.id,
        { tutar: "6000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
        db.prisma
      )
    ).rejects.toThrow(/dağıtılabilecek tutar aşılıyor/i);
  });

  it("başka carinin çeki bu faturaya sayılamaz", async () => {
    const a = await cariEkle("Cari A");
    const b = await cariEkle("Cari B");
    const islem = await satis(a.id, "5000");
    const k = await cek(b.id, "5000");

    await expect(
      odemeEkle(
        islem.id,
        { tutar: "5000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
        db.prisma
      )
    ).rejects.toThrow(/carisine ait değil/i);
  });

  it("karşılıksız çek bir faturaya sayılamaz", async () => {
    const cari = await cariEkle("Yanmış Çek");
    const islem = await satis(cari.id, "5000");
    const k = await cek(cari.id, "5000");
    await durumDegistir(k.id, "KARSILIKSIZ", db.prisma);

    await expect(
      odemeEkle(
        islem.id,
        { tutar: "5000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
        db.prisma
      )
    ).rejects.toThrow(/Karşılıksız çek/i);

    // Listede de görünmez.
    expect(await kullanilabilirCekler(cari.id, db.prisma)).toHaveLength(0);
  });
});

describe("Eşleştirilmiş çek korunur", () => {
  it("faturaya sayılmış çek karşılıksız işaretlenemez", async () => {
    const cari = await cariEkle("Koruma Karşılıksız");
    const islem = await satis(cari.id, "5000");
    const k = await cek(cari.id, "5000");
    await odemeEkle(
      islem.id,
      { tutar: "5000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );

    // İzin verilseydi cari borcu geri döner, fatura "ödendi" kalırdı.
    await expect(
      durumDegistir(k.id, "KARSILIKSIZ", db.prisma)
    ).rejects.toThrow(/eşleştirmesini kaldırın/i);
  });

  it("faturaya sayılmış çek silinemez", async () => {
    const cari = await cariEkle("Koruma Silme");
    const islem = await satis(cari.id, "5000");
    const k = await cek(cari.id, "5000");
    await odemeEkle(
      islem.id,
      { tutar: "5000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );

    await expect(cekSenetSil(k.id, db.prisma)).rejects.toThrow(
      /eşleştirmesini kaldırın/i
    );
  });

  it("eşleştirme kaldırılınca çek yeniden serbest kalır", async () => {
    const cari = await cariEkle("Eşleştirme Kaldırma");
    const islem = await satis(cari.id, "5000");
    const k = await cek(cari.id, "5000");
    const o = await odemeEkle(
      islem.id,
      { tutar: "5000", tarih: gun(2), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );
    expect((await getIslem(islem.id, db.prisma))?.status).toBe("ODENDI");

    await odemeSil(o.id, db.prisma);

    expect((await getIslem(islem.id, db.prisma))?.status).toBe("BEKLIYOR");
    // Bakiye değişmez: borç zaten çek alınınca kapanmıştı.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect(await kullanilabilirCekler(cari.id, db.prisma)).toHaveLength(1);
    // Artık karşılıksız işaretlenebilir.
    await durumDegistir(k.id, "KARSILIKSIZ", db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("5000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Çek tahsilatı faturayı etkilemez", () => {
  it("tahsilat yalnızca kasa olayıdır, fatura durumunu değiştirmez", async () => {
    const cari = await cariEkle("Tahsilat Ayrı");
    const islem = await satis(cari.id, "8000");
    const k = await cek(cari.id, "8000");

    await tahsilatEkle(k.id, { tutar: "8000", tarih: gun(30) }, db.prisma);

    // Tahsilat faturayı kapatmaz — kapatan şey çekin eşleştirilmesidir.
    expect((await getIslem(islem.id, db.prisma))?.status).toBe("BEKLIYOR");
    // Tahsil edilmiş çek yine de faturaya sayılabilir.
    expect(await kullanilabilirCekler(cari.id, db.prisma)).toHaveLength(1);

    await odemeEkle(
      islem.id,
      { tutar: "8000", tarih: gun(30), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );
    expect((await getIslem(islem.id, db.prisma))?.status).toBe("ODENDI");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
  });
});

describe("Ciro edilen çek, devredildiği carinin faturasına da sayılır", () => {
  it("ciroyla kapanan alış faturası ÖDENDİ yapılabilir", async () => {
    const musteri = await cariEkle("Ciro Müşteri");
    const tedarikci = await cariOlustur(
      { unvan: "Ciro Tedarikçi", tip: "TEDARIKCI", acilisBakiyesi: "0" },
      db.prisma
    );

    // Müşteri bize 9.000'lik çek veriyor.
    await satis(musteri.id, "9000");
    const k = await cek(musteri.id, "9000");

    // Tedarikçiden 9.000'lik alış; çeki ona ciro ediyoruz.
    const alis = await islemOlustur(
      {
        tip: "ALIS",
        cariId: tedarikci.id,
        tarih: gun(3),
        kalemler: [
          { urunAdi: "Hammadde", miktar: "1", birimFiyat: "9000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    const { ciroEt } = await import("@/lib/cek-senet");
    await ciroEt(k.id, tedarikci.id, gun(4), db.prisma);

    // Ciro tedarikçiye olan borcu kapattı...
    expect((await getCari(tedarikci.id, db.prisma))?.bakiye).toBe("0");
    // ...ama fatura hâlâ açık. Düzeltmeden önce bunu kapatmanın YOLU YOKTU:
    // çek müşterinin çekiydi ve tedarikçinin listesinde görünmüyordu.
    expect((await getIslem(alis.id, db.prisma))?.status).toBe("BEKLIYOR");

    const secenekler = await kullanilabilirCekler(tedarikci.id, db.prisma);
    expect(secenekler.map((c) => c.cekSenetId)).toContain(k.id);

    await odemeEkle(
      alis.id,
      { tutar: "9000", tarih: gun(4), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );

    expect((await getIslem(alis.id, db.prisma))?.status).toBe("ODENDI");
    // Bakiye ikinci kez etkilenmedi.
    expect((await getCari(tedarikci.id, db.prisma))?.bakiye).toBe("0");
    expect(
      (await cariBakiyesiniDogrula(tedarikci.id, db.prisma)).mutabik
    ).toBe(true);
  });

  it("aynı çek İKİ tarafın da faturasını kapatabilir", async () => {
    const musteri = await cariEkle("Çift Taraf Müşteri");
    const tedarikci = await cariOlustur(
      { unvan: "Çift Taraf Tedarikçi", tip: "TEDARIKCI", acilisBakiyesi: "0" },
      db.prisma
    );

    const satisFaturasi = await satis(musteri.id, "5000");
    const k = await cek(musteri.id, "5000");
    const alisFaturasi = await islemOlustur(
      {
        tip: "ALIS",
        cariId: tedarikci.id,
        tarih: gun(3),
        kalemler: [
          { urunAdi: "Mal", miktar: "1", birimFiyat: "5000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    const { ciroEt } = await import("@/lib/cek-senet");
    await ciroEt(k.id, tedarikci.id, gun(4), db.prisma);

    // Çek gerçekten İKİ borcu birden kapattı: müşteri bize ödedi, biz
    // tedarikçiye ödedik. İki tarafın sınırı birbirinin hakkını yemez.
    await odemeEkle(
      satisFaturasi.id,
      { tutar: "5000", tarih: gun(4), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );
    await odemeEkle(
      alisFaturasi.id,
      { tutar: "5000", tarih: gun(4), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );

    expect((await getIslem(satisFaturasi.id, db.prisma))?.status).toBe("ODENDI");
    expect((await getIslem(alisFaturasi.id, db.prisma))?.status).toBe("ODENDI");
    expect((await getCari(musteri.id, db.prisma))?.bakiye).toBe("0");
    expect((await getCari(tedarikci.id, db.prisma))?.bakiye).toBe("0");
  });

  it("tek taraf içinde çek tutarı yine aşılamaz", async () => {
    const musteri = await cariEkle("Sınır Müşteri");
    const tedarikci = await cariOlustur(
      { unvan: "Sınır Tedarikçi", tip: "TEDARIKCI", acilisBakiyesi: "0" },
      db.prisma
    );
    const k = await cek(musteri.id, "4000");
    const a1 = await islemOlustur(
      { tip: "ALIS", cariId: tedarikci.id, tarih: gun(3),
        kalemler: [{ urunAdi: "A", miktar: "1", birimFiyat: "3000", kdvOrani: "0" }] },
      db.prisma
    );
    const a2 = await islemOlustur(
      { tip: "ALIS", cariId: tedarikci.id, tarih: gun(3),
        kalemler: [{ urunAdi: "B", miktar: "1", birimFiyat: "3000", kdvOrani: "0" }] },
      db.prisma
    );
    const { ciroEt } = await import("@/lib/cek-senet");
    await ciroEt(k.id, tedarikci.id, gun(4), db.prisma);

    await odemeEkle(
      a1.id,
      { tutar: "3000", tarih: gun(4), kaynak: "CEK", cekSenetId: k.id },
      db.prisma
    );
    await expect(
      odemeEkle(
        a2.id,
        { tutar: "3000", tarih: gun(4), kaynak: "CEK", cekSenetId: k.id },
        db.prisma
      )
    ).rejects.toThrow(/dağıtılabilecek tutar aşılıyor/i);
  });
});
