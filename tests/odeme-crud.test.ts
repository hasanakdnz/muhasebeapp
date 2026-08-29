import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { cariBakiyesiniDogrula, cariOlustur, getCari } from "@/lib/cari";
import { cekSenetOlustur, tahsilatEkle } from "@/lib/cek-senet";
import { getIslem, islemOlustur, islemSil } from "@/lib/islem";
import {
  islemOdemesiniDogrula,
  kullanilabilirTahsilatlar,
  listeleOdemeler,
  odemeEkle,
  odemeSil,
} from "@/lib/odeme";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.cleanup();
});

const gun = (g: number) => new Date(2026, 6, g);

async function cariEkle(unvan: string, acilis = "0") {
  return cariOlustur(
    { unvan, tip: "HER_IKISI", acilisBakiyesi: acilis },
    db.prisma
  );
}

/** 12.000 TL'lik satış (10.000 matrah + %20 KDV). */
async function satisEkle(cariId: string) {
  return islemOlustur(
    {
      tip: "SATIS",
      cariId,
      tarih: gun(1),
      kalemler: [
        { urunAdi: "Hizmet", miktar: "1", birimFiyat: "10000", kdvOrani: "20" },
      ],
    },
    db.prisma
  );
}

describe("Direkt ödeme", () => {
  it("fatura durumunu ve cari bakiyesini birlikte günceller", async () => {
    const cari = await cariEkle("Direkt Ödeme");
    const islem = await satisEkle(cari.id);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("12000");

    await odemeEkle(
      islem.id,
      { tutar: "5000", tarih: gun(5), kaynak: "DIREKT" },
      db.prisma
    );

    const sonra = await getIslem(islem.id, db.prisma);
    expect(sonra?.odenenTutar).toBe("5000");
    expect(sonra?.kalanTutar).toBe("7000");
    expect(sonra?.status).toBe("KISMI_ODENDI");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("7000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("tam ödemede fatura ODENDI olur ve borç kapanır", async () => {
    const cari = await cariEkle("Tam Ödeme");
    const islem = await satisEkle(cari.id);

    await odemeEkle(
      islem.id,
      { tutar: "12000", tarih: gun(5), kaynak: "DIREKT" },
      db.prisma
    );

    expect((await getIslem(islem.id, db.prisma))?.status).toBe("ODENDI");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await islemOdemesiniDogrula(islem.id, db.prisma)).mutabik).toBe(true);
  });

  it("kalandan fazla ödeme reddedilir ve yan etki bırakmaz", async () => {
    const cari = await cariEkle("Fazla Ödeme");
    const islem = await satisEkle(cari.id);
    await odemeEkle(
      islem.id,
      { tutar: "4000", tarih: gun(5), kaynak: "DIREKT" },
      db.prisma
    );

    await expect(
      odemeEkle(
        islem.id,
        { tutar: "8000.01", tarih: gun(6), kaynak: "DIREKT" },
        db.prisma
      )
    ).rejects.toThrow(/kalan tutardan büyük/i);

    expect((await getIslem(islem.id, db.prisma))?.odenenTutar).toBe("4000");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("8000");
  });

  it("alışta direkt ödeme bizim borcumuzu azaltır", async () => {
    const cari = await cariEkle("Tedarikçi");
    const islem = await islemOlustur(
      {
        tip: "ALIS",
        cariId: cari.id,
        tarih: gun(1),
        kalemler: [
          { urunAdi: "Hammadde", miktar: "1", birimFiyat: "5000", kdvOrani: "0" },
        ],
      },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("-5000");

    await odemeEkle(
      islem.id,
      { tutar: "5000", tarih: gun(5), kaynak: "DIREKT" },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("ödeme silinince fatura durumu ve bakiye geri döner", async () => {
    const cari = await cariEkle("Geri Alma");
    const islem = await satisEkle(cari.id);
    const odeme = await odemeEkle(
      islem.id,
      { tutar: "12000", tarih: gun(5), kaynak: "DIREKT" },
      db.prisma
    );
    expect((await getIslem(islem.id, db.prisma))?.status).toBe("ODENDI");

    await odemeSil(odeme.id, db.prisma);

    const sonra = await getIslem(islem.id, db.prisma);
    expect(sonra?.odenenTutar).toBe("0");
    expect(sonra?.status).toBe("BEKLIYOR");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("12000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Çek tahsilatının faturaya eşleştirilmesi — ÇİFT SAYIM koruması", () => {
  it("çekten gelen ödeme faturayı kapatır ama bakiyeyi TEKRAR düşürmez", async () => {
    // Bu, tüm eşleştirme mekanizmasının varlık sebebi.
    const cari = await cariEkle("Çekle Ödeyen");
    const islem = await satisEkle(cari.id);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("12000");

    // Müşteri 12.000'lik çek veriyor ve çek tahsil ediliyor.
    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "12000",
        vadeTarihi: gun(20),
      },
      db.prisma
    );
    await tahsilatEkle(cek.id, { tutar: "12000", tarih: gun(20) }, db.prisma);

    // Tahsilat bakiyeyi kapattı; fatura ise hâlâ "bekliyor".
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await getIslem(islem.id, db.prisma))?.status).toBe("BEKLIYOR");

    // Şimdi tahsilat faturaya eşleştiriliyor.
    const musait = await kullanilabilirTahsilatlar(cari.id, db.prisma);
    expect(musait).toHaveLength(1);
    expect(musait[0].dagitilabilir).toBe("12000");

    await odemeEkle(
      islem.id,
      {
        tutar: "12000",
        tarih: gun(20),
        kaynak: "CEK_TAHSILATI",
        cekSenetTahsilatId: musait[0].tahsilatId,
      },
      db.prisma
    );

    // Fatura kapandı...
    expect((await getIslem(islem.id, db.prisma))?.status).toBe("ODENDI");
    // ...ama bakiye SIFIRDA KALDI, -12.000'e düşmedi.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });

  it("bir tahsilat birden fazla faturaya bölüştürülebilir", async () => {
    const cari = await cariEkle("İki Faturalı");
    const islem1 = await satisEkle(cari.id); // 12.000
    const islem2 = await satisEkle(cari.id); // 12.000

    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "20000",
        vadeTarihi: gun(20),
      },
      db.prisma
    );
    await tahsilatEkle(cek.id, { tutar: "20000", tarih: gun(20) }, db.prisma);

    const [musait] = await kullanilabilirTahsilatlar(cari.id, db.prisma);

    await odemeEkle(
      islem1.id,
      {
        tutar: "12000",
        tarih: gun(20),
        kaynak: "CEK_TAHSILATI",
        cekSenetTahsilatId: musait.tahsilatId,
      },
      db.prisma
    );
    await odemeEkle(
      islem2.id,
      {
        tutar: "8000",
        tarih: gun(20),
        kaynak: "CEK_TAHSILATI",
        cekSenetTahsilatId: musait.tahsilatId,
      },
      db.prisma
    );

    expect((await getIslem(islem1.id, db.prisma))?.status).toBe("ODENDI");
    expect((await getIslem(islem2.id, db.prisma))?.status).toBe("KISMI_ODENDI");
    expect((await getIslem(islem2.id, db.prisma))?.kalanTutar).toBe("4000");

    // Tahsilat tamamen dağıtıldı.
    const kalanMusait = await kullanilabilirTahsilatlar(cari.id, db.prisma);
    expect(kalanMusait).toHaveLength(0);
  });

  it("tahsilattan dağıtılabilecek tutar aşılamaz", async () => {
    const cari = await cariEkle("Aşım Denemesi");
    const islem = await satisEkle(cari.id);

    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "5000",
        vadeTarihi: gun(20),
      },
      db.prisma
    );
    await tahsilatEkle(cek.id, { tutar: "5000", tarih: gun(20) }, db.prisma);
    const [musait] = await kullanilabilirTahsilatlar(cari.id, db.prisma);

    await expect(
      odemeEkle(
        islem.id,
        {
          tutar: "5000.01",
          tarih: gun(20),
          kaynak: "CEK_TAHSILATI",
          cekSenetTahsilatId: musait.tahsilatId,
        },
        db.prisma
      )
    ).rejects.toThrow(/dağıtılabilecek tutar/i);
  });

  it("başka carinin tahsilatı bu faturaya eşleştirilemez", async () => {
    const cariA = await cariEkle("Cari A");
    const cariB = await cariEkle("Cari B");
    const islemA = await satisEkle(cariA.id);

    const cekB = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cariB.id,
        tutar: "5000",
        vadeTarihi: gun(20),
      },
      db.prisma
    );
    await tahsilatEkle(cekB.id, { tutar: "5000", tarih: gun(20) }, db.prisma);
    const [musaitB] = await kullanilabilirTahsilatlar(cariB.id, db.prisma);

    await expect(
      odemeEkle(
        islemA.id,
        {
          tutar: "5000",
          tarih: gun(20),
          kaynak: "CEK_TAHSILATI",
          cekSenetTahsilatId: musaitB.tahsilatId,
        },
        db.prisma
      )
    ).rejects.toThrow(/carisine ait değil/i);
  });

  it("çek kaynaklı ödeme silinince bakiye yine etkilenmez", async () => {
    const cari = await cariEkle("Çek Ödeme Silme");
    const islem = await satisEkle(cari.id);
    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "12000",
        vadeTarihi: gun(20),
      },
      db.prisma
    );
    await tahsilatEkle(cek.id, { tutar: "12000", tarih: gun(20) }, db.prisma);
    const [musait] = await kullanilabilirTahsilatlar(cari.id, db.prisma);

    const odeme = await odemeEkle(
      islem.id,
      {
        tutar: "12000",
        tarih: gun(20),
        kaynak: "CEK_TAHSILATI",
        cekSenetTahsilatId: musait.tahsilatId,
      },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");

    await odemeSil(odeme.id, db.prisma);

    expect((await getIslem(islem.id, db.prisma))?.status).toBe("BEKLIYOR");
    // Eşleştirme kalktı ama para hâlâ tahsil edilmiş durumda.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});

describe("Karışık senaryo", () => {
  it("kısmen nakit, kısmen çekle ödenen fatura doğru kapanır", async () => {
    const cari = await cariEkle("Karışık Ödeme");
    const islem = await satisEkle(cari.id); // 12.000

    // 4.000 nakit
    await odemeEkle(
      islem.id,
      { tutar: "4000", tarih: gun(5), kaynak: "DIREKT" },
      db.prisma
    );
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("8000");

    // Kalan 8.000 için çek alınıp tahsil ediliyor
    const cek = await cekSenetOlustur(
      {
        tip: "CEK",
        yon: "ALINAN",
        cariId: cari.id,
        tutar: "8000",
        vadeTarihi: gun(20),
      },
      db.prisma
    );
    await tahsilatEkle(cek.id, { tutar: "8000", tarih: gun(20) }, db.prisma);
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");

    const [musait] = await kullanilabilirTahsilatlar(cari.id, db.prisma);
    await odemeEkle(
      islem.id,
      {
        tutar: "8000",
        tarih: gun(20),
        kaynak: "CEK_TAHSILATI",
        cekSenetTahsilatId: musait.tahsilatId,
      },
      db.prisma
    );

    const sonra = await getIslem(islem.id, db.prisma);
    expect(sonra?.status).toBe("ODENDI");
    expect(sonra?.kalanTutar).toBe("0");
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("0");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);

    const odemeler = await listeleOdemeler(islem.id, db.prisma);
    expect(odemeler.map((o) => o.kaynak)).toEqual(["DIREKT", "CEK_TAHSILATI"]);
  });

  it("işlem silinince direkt ödemelerin bakiye etkisi de geri alınır", async () => {
    const cari = await cariEkle("Silinen Fatura", "1000");
    const islem = await satisEkle(cari.id);
    await odemeEkle(
      islem.id,
      { tutar: "5000", tarih: gun(5), kaynak: "DIREKT" },
      db.prisma
    );
    // 1000 açılış + 12000 satış - 5000 ödeme
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("8000");

    await islemSil(islem.id, db.prisma);

    // Fatura da ödemesi de yok oldu; yalnızca açılış kaldı.
    expect((await getCari(cari.id, db.prisma))?.bakiye).toBe("1000");
    expect((await cariBakiyesiniDogrula(cari.id, db.prisma)).mutabik).toBe(true);
  });
});
