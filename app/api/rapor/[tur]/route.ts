import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { csvIndirmeBasliklari, csvOlustur, csvTarih, csvTutar } from "@/lib/csv";
import { formatYuzde } from "@/lib/money";
import { formatTarih } from "@/lib/date";
import { HAREKET_YON_ETIKETI } from "@/lib/domain/kasa";
import { ISLEM_TIPLERI, type IslemTipiValue } from "@/lib/domain/islem";
import { donemCoz } from "@/lib/donem";
import { listeleHareketler, listeleHesaplar } from "@/lib/kasa";
import {
  YASLANDIRMA_ETIKETI,
  YASLANDIRMA_KOVALARI,
  kdvRaporuGetir,
  satisPerformansiGetir,
  yaslandirmaRaporuGetir,
} from "@/lib/rapor";

/**
 * Rapor CSV indirmeleri.
 *
 * Raporlar finansal veridir; middleware bu yolu zaten koruyor, burada ikinci
 * kez doğrulanıyor — tek bir yapılandırma hatası raporları açığa çıkarmamalı.
 */
const TURLER = ["kdv", "yaslandirma", "ekstre", "satis"] as const;
type RaporTuru = (typeof TURLER)[number];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tur: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Yetkisiz erişim.", { status: 401 });
  }

  const { tur } = await params;
  if (!TURLER.includes(tur as RaporTuru)) {
    return new NextResponse("Bilinmeyen rapor.", { status: 404 });
  }

  const url = new URL(request.url);
  const sp = {
    baslangic: url.searchParams.get("baslangic") ?? undefined,
    bitis: url.searchParams.get("bitis") ?? undefined,
  };
  const donem = donemCoz(sp);
  const donemEki = `${donem.baslangicInput}_${donem.bitisInput}`;

  if (tur === "kdv") {
    const r = await kdvRaporuGetir(donem);
    const satirlar = [
      { kaynak: "Satışlar (hesaplanan)", adet: r.satisSayisi, matrah: r.satisMatrah, kdv: r.hesaplananKdv },
      { kaynak: "Alışlar (indirilecek)", adet: r.alisSayisi, matrah: r.alisMatrah, kdv: r.alisKdvToplami },
      { kaynak: "Giderler (indirilecek)", adet: r.giderSayisi, matrah: r.giderMatrah, kdv: r.giderKdvToplami },
      { kaynak: "Ödenecek KDV", adet: "", matrah: "", kdv: r.odenecekKdv },
      { kaynak: "Devreden KDV", adet: "", matrah: "", kdv: r.devredenKdv },
    ];
    const csv = csvOlustur(
      [
        { baslik: "Kaynak", deger: (s) => s.kaynak },
        { baslik: "Kayıt", deger: (s) => s.adet },
        { baslik: "Matrah", deger: (s) => (s.matrah === "" ? "" : csvTutar(s.matrah)) },
        { baslik: "KDV", deger: (s) => csvTutar(s.kdv) },
      ],
      satirlar
    );
    return new NextResponse(csv, {
      headers: csvIndirmeBasliklari(`kdv-raporu_${donemEki}.csv`),
    });
  }

  if (tur === "yaslandirma") {
    const tipParam = url.searchParams.get("tip");
    const tip: IslemTipiValue = ISLEM_TIPLERI.includes(tipParam as IslemTipiValue)
      ? (tipParam as IslemTipiValue)
      : "SATIS";
    const bugun = new Date();
    const r = await yaslandirmaRaporuGetir(tip, bugun);

    const csv = csvOlustur(
      [
        { baslik: "Cari", deger: (s: (typeof r.satirlar)[number]) => s.cariUnvan },
        ...YASLANDIRMA_KOVALARI.map((k) => ({
          baslik: YASLANDIRMA_ETIKETI[k],
          deger: (s: (typeof r.satirlar)[number]) => csvTutar(s.kovalar[k]),
        })),
        { baslik: "Toplam", deger: (s: (typeof r.satirlar)[number]) => csvTutar(s.toplam) },
      ],
      r.satirlar
    );
    const ek = tip === "SATIS" ? "alacak" : "borc";
    return new NextResponse(csv, {
      headers: csvIndirmeBasliklari(
        `yaslandirma-${ek}_${formatTarih(bugun).replace(/\./g, "-")}.csv`
      ),
    });
  }

  if (tur === "ekstre") {
    const hesapId = url.searchParams.get("hesap");
    const hesaplar = await listeleHesaplar({ pasifleriGoster: true });
    const secilen = hesaplar.find((h) => h.id === hesapId) ?? hesaplar[0];
    if (!secilen) {
      return new NextResponse("Hesap bulunamadı.", { status: 404 });
    }

    const tumu = await listeleHareketler(secilen.id);
    // Ekstre eskiden yeniye okunur.
    const satirlar = tumu
      .filter((h) => h.tarih >= donem.baslangic && h.tarih <= donem.bitis)
      .reverse();

    const csv = csvOlustur(
      [
        { baslik: "Tarih", deger: (h: (typeof satirlar)[number]) => csvTarih(h.tarih) },
        { baslik: "Açıklama", deger: (h: (typeof satirlar)[number]) => h.aciklama ?? "" },
        { baslik: "Yön", deger: (h: (typeof satirlar)[number]) => HAREKET_YON_ETIKETI[h.yon] },
        { baslik: "Tutar", deger: (h: (typeof satirlar)[number]) => csvTutar(h.tutar) },
        { baslik: "Bakiye", deger: (h: (typeof satirlar)[number]) => csvTutar(h.yurutulenBakiye) },
      ],
      satirlar
    );
    return new NextResponse(csv, {
      headers: csvIndirmeBasliklari(`ekstre-${secilen.ad}_${donemEki}.csv`),
    });
  }

  // satis
  const r = await satisPerformansiGetir(donem);
  const csv = csvOlustur(
    [
      { baslik: "Cari", deger: (s: (typeof r.enIyiCariler)[number]) => s.cariUnvan },
      { baslik: "İşlem", deger: (s: (typeof r.enIyiCariler)[number]) => s.adet },
      { baslik: "Pay (%)", deger: (s: (typeof r.enIyiCariler)[number]) => formatYuzde(s.yuzde) },
      { baslik: "Tutar", deger: (s: (typeof r.enIyiCariler)[number]) => csvTutar(s.toplam) },
    ],
    r.enIyiCariler
  );
  return new NextResponse(csv, {
    headers: csvIndirmeBasliklari(`satis-performansi_${donemEki}.csv`),
  });
}
