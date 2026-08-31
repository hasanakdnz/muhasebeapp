import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { cariOlustur } from "@/lib/cari";
import {
  cekSenetOlustur,
  ciroEt,
  durumDegistir,
  tahsilatEkle,
} from "@/lib/cek-senet";
import { firmaKaydet } from "@/lib/firma";
import { giderOlustur } from "@/lib/gider";
import { islemOlustur } from "@/lib/islem";
import { hesapOlustur } from "@/lib/kasa";
import { odemeEkle } from "@/lib/odeme";
import {
  proformaDurumDegistir,
  proformaOlustur,
  proformayiIsleDonustur,
} from "@/lib/proforma";

/**
 * Gerçekçi demo verisi.
 *
 * Kayıtlar HAM SQL ile değil, uygulamanın kendi veri katmanı fonksiyonlarıyla
 * üretilir. Böylece script aynı zamanda uçtan uca bir dumandan geçirme
 * (smoke test) işlevi görür: bakiye, KDV, çek ve ödeme kuralları gerçekten
 * çalışmıyorsa burada patlar. Ham SQL ile üretilseydi tutarsız bir veri
 * sessizce oluşur ve mutabakat sonradan yanlış alarm verirdi.
 *
 * Kullanıcı hesapları KORUNUR (seed ayrı). Yalnızca işlem verisi silinir.
 *
 * Çalıştırma:  npm run db:demo
 */

const gun = (ay: number, g: number) => new Date(2026, ay - 1, g);

async function temizle() {
  // Silme sırası yabancı anahtarları izler: bağımlı kayıtlar önce.
  await prisma.islemOdeme.deleteMany();
  await prisma.cekSenetTahsilat.deleteMany();
  await prisma.proformaKalemi.deleteMany();
  await prisma.proforma.deleteMany();
  await prisma.islemKalemi.deleteMany();
  await prisma.islem.deleteMany();
  await prisma.cekSenet.deleteMany();
  await prisma.gider.deleteMany();
  await prisma.hesapHareketi.deleteMany();
  await prisma.kasaBanka.deleteMany();
  await prisma.cari.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.firma.deleteMany();
  console.log("  · mevcut işlem verisi silindi (kullanıcılar korundu)");
}

async function main() {
  console.log("Demo verisi kuruluyor…");
  await temizle();

  /* ---------------------------------------------------------- FİRMA */
  await firmaKaydet({
    unvan: "Akdeniz Ticaret Ltd. Şti.",
    vknTckn: "1234567890",
    vergiDairesi: "Kadıköy",
    adres: "Bağdat Cad. No: 120\nKadıköy / İstanbul",
    telefon: "0216 555 12 34",
    email: "info@akdenizticaret.com.tr",
    iban: "TR120006100519786457841326",
  });

  /* -------------------------------------------------------- HESAPLAR */
  const kasa = await hesapOlustur({
    ad: "Merkez Kasa",
    tip: "KASA",
    acilisBakiyesi: "25000",
    acilisTarihi: gun(1, 2),
  });
  const banka = await hesapOlustur({
    ad: "Ziraat Bankası · TR12",
    tip: "BANKA",
    acilisBakiyesi: "150000",
    acilisTarihi: gun(1, 2),
  });

  /* --------------------------------------------------------- CARİLER */
  const yilmaz = await cariOlustur({
    unvan: "Yılmaz Gıda San. Tic. A.Ş.",
    tip: "MUSTERI",
    vknTckn: "2345678901",
    vergiDairesi: "Ümraniye",
    telefon: "0216 444 22 11",
    email: "muhasebe@yilmazgida.com.tr",
    acilisBakiyesi: "0",
  });
  const ozturk = await cariOlustur({
    unvan: "Öztürk Nakliyat",
    tip: "MUSTERI",
    vknTckn: "3456789012",
    telefon: "0532 111 22 33",
    acilisBakiyesi: "0",
  });
  const isik = await cariOlustur({
    unvan: "Işık Mühendislik Ltd. Şti.",
    tip: "MUSTERI",
    vknTckn: "4567890123",
    email: "info@isikmuhendislik.com",
    acilisBakiyesi: "0",
  });
  const anadolu = await cariOlustur({
    unvan: "Anadolu Ambalaj",
    tip: "TEDARIKCI",
    vknTckn: "5678901234",
    acilisBakiyesi: "0",
  });
  const ege = await cariOlustur({
    unvan: "Ege Hammadde Ltd.",
    tip: "TEDARIKCI",
    vknTckn: "6789012345",
    acilisBakiyesi: "0",
  });
  const deniz = await cariOlustur({
    unvan: "Deniz Lojistik",
    tip: "HER_IKISI",
    vknTckn: "7890123456",
    acilisBakiyesi: "0",
  });

  /* ---------------------------------------------- 1) NAKİT TAHSİLATLI SATIŞ */
  // Yılmaz Gıda'ya satış, aynı ay banka havalesiyle tahsil edildi.
  const s1 = await islemOlustur({
    tip: "SATIS",
    cariId: yilmaz.id,
    tarih: gun(2, 10),
    vadeTarihi: gun(3, 10),
    kalemler: [
      { urunAdi: "Ayçiçek yağı 5 L", miktar: "200", birimFiyat: "180", kdvOrani: "10" },
      { urunAdi: "Nakliye bedeli", miktar: "1", birimFiyat: "2500", kdvOrani: "20" },
    ],
  });
  await odemeEkle(s1.id, {
    tutar: "42600",
    tarih: gun(3, 8),
    kaynak: "DIREKT",
    hesapId: banka.id,
    aciklama: "Havale",
  });

  /* ------------------------------------------------ 2) ÇEKLE KAPANAN SATIŞ */
  // Satış → müşteri çek veriyor → çek faturaya sayılıyor → çek tahsil ediliyor.
  const s2 = await islemOlustur({
    tip: "SATIS",
    cariId: yilmaz.id,
    tarih: gun(3, 15),
    vadeTarihi: gun(5, 15),
    kalemler: [
      { urunAdi: "Zeytinyağı 2 L", miktar: "150", birimFiyat: "320", kdvOrani: "10" },
    ],
  });
  const cek1 = await cekSenetOlustur({
    tip: "CEK",
    yon: "ALINAN",
    cariId: yilmaz.id,
    tutar: "52800",
    tarih: gun(3, 20),
    vadeTarihi: gun(6, 20),
    aciklama: "Ziraat / 445120",
  });
  await odemeEkle(s2.id, {
    tutar: "52800",
    tarih: gun(3, 20),
    kaynak: "CEK",
    cekSenetId: cek1.id,
  });
  await tahsilatEkle(cek1.id, {
    tutar: "52800",
    tarih: gun(6, 20),
    hesapId: banka.id,
    aciklama: "Çek tahsili",
  });

  /* ------------------------------------------- 3) KISMİ TAHSİLATLI ÇEK */
  const s3 = await islemOlustur({
    tip: "SATIS",
    cariId: ozturk.id,
    tarih: gun(4, 5),
    vadeTarihi: gun(6, 5),
    kalemler: [
      { urunAdi: "Palet taşıma hizmeti", miktar: "30", birimFiyat: "750", kdvOrani: "20" },
    ],
  });
  const cek2 = await cekSenetOlustur({
    tip: "CEK",
    yon: "ALINAN",
    cariId: ozturk.id,
    tutar: "27000",
    tarih: gun(4, 12),
    vadeTarihi: gun(7, 12),
    aciklama: "Garanti / 778901",
  });
  await odemeEkle(s3.id, {
    tutar: "27000",
    tarih: gun(4, 12),
    kaynak: "CEK",
    cekSenetId: cek2.id,
  });
  // Kısmen tahsil edildi; kalanı henüz gelmedi.
  await tahsilatEkle(cek2.id, {
    tutar: "15000",
    tarih: gun(7, 12),
    hesapId: banka.id,
  });

  /* ---------------------------------------------------- 4) KARŞILIKSIZ ÇEK */
  const s4 = await islemOlustur({
    tip: "SATIS",
    cariId: isik.id,
    tarih: gun(5, 3),
    vadeTarihi: gun(7, 3),
    kalemler: [
      { urunAdi: "Pano montajı", miktar: "1", birimFiyat: "18000", kdvOrani: "20" },
    ],
  });
  const cek3 = await cekSenetOlustur({
    tip: "CEK",
    yon: "ALINAN",
    cariId: isik.id,
    tutar: "21600",
    tarih: gun(5, 10),
    vadeTarihi: gun(8, 10),
    aciklama: "Vakıfbank / 330277",
  });
  // Çek faturaya SAYILMADAN yanıyor: eşleştirilmiş çek karşılıksız
  // işaretlenemez (bkz. lib/cek-senet.ts), borç cariye geri dönmeli.
  await durumDegistir(cek3.id, "KARSILIKSIZ");
  void s4;

  /* --------------------------------------------------- 5) AÇIK, VADESİ GEÇMİŞ */
  await islemOlustur({
    tip: "SATIS",
    cariId: isik.id,
    tarih: gun(6, 18),
    vadeTarihi: gun(7, 18),
    kalemler: [
      { urunAdi: "Bakım sözleşmesi", miktar: "3", birimFiyat: "4000", kdvOrani: "20" },
    ],
  });

  /* -------------------------------------------------------- 6) ALIŞLAR */
  const a1 = await islemOlustur({
    tip: "ALIS",
    cariId: anadolu.id,
    tarih: gun(2, 20),
    vadeTarihi: gun(3, 20),
    belgeNo: "ANA2026000451",
    kalemler: [
      { urunAdi: "Koli 40x30", miktar: "5000", birimFiyat: "6.5", kdvOrani: "20" },
    ],
  });
  await odemeEkle(a1.id, {
    tutar: "39000",
    tarih: gun(3, 18),
    kaynak: "DIREKT",
    hesapId: banka.id,
    aciklama: "EFT",
  });

  // Tedarikçiye KENDİ çekimizi veriyoruz; borç çek verildiği anda kapanır.
  const a2 = await islemOlustur({
    tip: "ALIS",
    cariId: ege.id,
    tarih: gun(4, 22),
    vadeTarihi: gun(7, 22),
    belgeNo: "EGE-A-009812",
    kalemler: [
      { urunAdi: "Granül hammadde", miktar: "1200", birimFiyat: "45", kdvOrani: "20" },
    ],
  });
  const cek4 = await cekSenetOlustur({
    tip: "CEK",
    yon: "VERILEN",
    cariId: ege.id,
    tutar: "64800",
    tarih: gun(4, 25),
    vadeTarihi: gun(7, 25),
    aciklama: "Kendi çekimiz / 100455",
  });
  await odemeEkle(a2.id, {
    tutar: "64800",
    tarih: gun(4, 25),
    kaynak: "CEK",
    cekSenetId: cek4.id,
  });
  await tahsilatEkle(cek4.id, {
    tutar: "64800",
    tarih: gun(7, 25),
    hesapId: banka.id,
    aciklama: "Çek ödendi",
  });

  /* ------------------------------------------------------------ 7) CİRO */
  // Deniz Lojistik'ten alınan çeki Anadolu Ambalaj'a devrediyoruz.
  const s5 = await islemOlustur({
    tip: "SATIS",
    cariId: deniz.id,
    tarih: gun(5, 6),
    kalemler: [
      { urunAdi: "Depo kirası", miktar: "1", birimFiyat: "15000", kdvOrani: "20" },
    ],
  });
  const cek5 = await cekSenetOlustur({
    tip: "CEK",
    yon: "ALINAN",
    cariId: deniz.id,
    tutar: "18000",
    tarih: gun(5, 12),
    vadeTarihi: gun(9, 12),
    aciklama: "İş Bankası / 552144",
  });
  const a3 = await islemOlustur({
    tip: "ALIS",
    cariId: anadolu.id,
    tarih: gun(5, 14),
    belgeNo: "ANA2026000622",
    kalemler: [
      { urunAdi: "Streç film", miktar: "300", birimFiyat: "50", kdvOrani: "20" },
    ],
  });

  // Çek, Deniz'in bize olan borcunu kapatır.
  await odemeEkle(s5.id, {
    tutar: "18000",
    tarih: gun(5, 12),
    kaynak: "CEK",
    cekSenetId: cek5.id,
  });

  await ciroEt(cek5.id, anadolu.id, gun(5, 20));

  // AYNI çek, ciro edildiği için Anadolu'ya olan borcumuzu da kapatır.
  // İki taraf birbirinin dağıtım hakkını yemez (bkz. lib/odeme.ts).
  await odemeEkle(a3.id, {
    tutar: "18000",
    tarih: gun(5, 20),
    kaynak: "CEK",
    cekSenetId: cek5.id,
  });

  /* --------------------------------------------------------- 8) GİDERLER */
  await giderOlustur(
    { kategori: "Kira", tutar: "18000", kdvOrani: "20", tarih: gun(7, 1), aciklama: "Temmuz ofis kirası", hesapId: banka.id },
    undefined
  );
  await giderOlustur(
    { kategori: "Yakıt", tutar: "3400", kdvOrani: "20", tarih: gun(7, 9), aciklama: "Araç yakıt", hesapId: kasa.id },
    undefined
  );
  await giderOlustur(
    { kategori: "Elektrik / Su / Doğalgaz", tutar: "5250", kdvOrani: "20", tarih: gun(8, 4), aciklama: "Temmuz elektrik", hesapId: banka.id },
    undefined
  );
  // BİLEREK hesapsız: panodaki "hesaba işlenmemiş gider" uyarısı görünsün.
  await giderOlustur(
    { kategori: "Ofis giderleri", tutar: "1250", kdvOrani: "20", tarih: gun(8, 12), aciklama: "Kırtasiye (hesap seçilmedi)" },
    undefined
  );

  /* --------------------------------------------------------- 9) TEKLİFLER */
  await proformaOlustur({
    cariId: isik.id,
    tarih: gun(8, 20),
    gecerlilikTarihi: gun(9, 20),
    notlar: "Teslim süresi: sipariş onayından itibaren 15 iş günü.",
    kdvDahil: false,
    kalemler: [
      { urunAdi: "Elektrik panosu", miktar: "2", birimFiyat: "22000", kdvOrani: "20" },
    ],
  });

  const p2 = await proformaOlustur({
    cariId: ozturk.id,
    tarih: gun(8, 22),
    gecerlilikTarihi: gun(9, 22),
    notlar: undefined,
    kdvDahil: false,
    kalemler: [
      { urunAdi: "Aylık taşıma paketi", miktar: "1", birimFiyat: "36000", kdvOrani: "20" },
    ],
  });
  await proformaDurumDegistir(p2.id, "GONDERILDI");

  // Kabul edilip faturaya dönüşen teklif: muhasebe o anda başlar.
  const p3 = await proformaOlustur({
    cariId: yilmaz.id,
    tarih: gun(8, 5),
    gecerlilikTarihi: gun(9, 5),
    notlar: "Peşin ödemede %2 iskonto.",
    kdvDahil: false,
    kalemler: [
      { urunAdi: "Sızma zeytinyağı 1 L", miktar: "400", birimFiyat: "260", kdvOrani: "10" },
    ],
  });
  await proformaDurumDegistir(p3.id, "GONDERILDI");
  await proformaDurumDegistir(p3.id, "KABUL");
  await proformayiIsleDonustur(p3.id, {
    tarih: gun(8, 14),
    vadeTarihi: gun(9, 14),
  });

  /* ------------------------------------------------------------ ÖZET */
  const [cariSayisi, islemSayisi, cekSayisi, giderSayisi, proformaSayisi] =
    await Promise.all([
      prisma.cari.count(),
      prisma.islem.count(),
      prisma.cekSenet.count(),
      prisma.gider.count(),
      prisma.proforma.count(),
    ]);

  console.log(
    `  · ${cariSayisi} cari · ${islemSayisi} işlem · ${cekSayisi} çek/senet · ` +
      `${giderSayisi} gider · ${proformaSayisi} teklif · 2 hesap`
  );
  console.log("Demo verisi hazır.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
