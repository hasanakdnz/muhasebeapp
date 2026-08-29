import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { belgeAnahtariKullanimda } from "@/lib/gider";
import { logoAnahtariKullanimda } from "@/lib/firma";
import { anahtarGecerliMi, anahtarMimeTipi, belgeOku } from "@/lib/storage";

/**
 * Yüklenen fiş/dekontları servis eder.
 *
 * Bu belgeler özel finansal evraktır:
 *  - Oturum zorunludur. middleware zaten koruyor, burada ikinci kez
 *    doğrulanıyor — tek bir yapılandırma hatası belgeleri açığa çıkarmamalı.
 *  - Anahtar katı kalıba karşı doğrulanır (dizin geçişi imkânsız).
 *  - Anahtarın gerçekten bir kayda ait olduğu kontrol edilir; depoda kalmış
 *    yetim dosyalar servis edilmez.
 *  - nosniff + kısıtlayıcı CSP: tarayıcı içeriği başka bir tür sanıp
 *    çalıştırmasın.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ anahtar: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Yetkisiz erişim.", { status: 401 });
  }

  const { anahtar } = await params;
  if (!anahtarGecerliMi(anahtar)) {
    return new NextResponse("Geçersiz belge.", { status: 400 });
  }

  // Anahtar ya bir gider belgesine ya da firma logosuna ait olmalı.
  const [giderBelgesi, firmaLogosu] = await Promise.all([
    belgeAnahtariKullanimda(anahtar),
    logoAnahtariKullanimda(anahtar),
  ]);
  if (!giderBelgesi && !firmaLogosu) {
    return new NextResponse("Belge bulunamadı.", { status: 404 });
  }

  const icerik = await belgeOku(anahtar);
  if (!icerik) {
    return new NextResponse("Belge bulunamadı.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(icerik), {
    headers: {
      "Content-Type": anahtarMimeTipi(anahtar),
      "Content-Length": String(icerik.byteLength),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // Özel evrak: paylaşılan önbelleklerde tutulmamalı.
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
