import type { NextConfig } from "next";

/**
 * Güvenlik başlıkları.
 *
 * En kritiği `frame-ancestors 'none'` (+ eski tarayıcılar için
 * X-Frame-Options): uygulama bir iframe'e gömülemez. Gömülebilseydi saldırgan
 * kendi sayfasında görünmez bir iframe açıp yöneticiyi "Sil" düğmesine
 * tıklatabilirdi (clickjacking) — silme işlemleri geri alınamaz olduğu için
 * bu finansal bir uygulamada gerçek bir risktir.
 *
 * CSP burada `script-src` içermiyor: Next.js hidrasyon için satır içi script
 * enjekte eder, bunu güvenle kısıtlamak middleware'de nonce üretmeyi gerektirir
 * ve yanlış yapılırsa uygulama sessizce kırılır. Şimdilik çerçeveleme,
 * MIME tahmini ve referrer sızıntısı kapatıldı; nonce tabanlı tam CSP ayrı bir
 * iştir. (Yüklenen belgeler zaten kendi rotasında katı CSP ile servis ediliyor
 * — bkz. app/api/belge/[anahtar]/route.ts.)
 */
const guvenlikBasliklari = [
  // Clickjacking: sayfa hiçbir yere gömülemez.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // Tarayıcı içerik türünü tahmin etmeye çalışmasın.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Dış sitelere tam URL sızmasın; cari/fatura id'leri yolda görünür.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Uygulamanın ihtiyacı olmayan cihaz izinleri kapalı.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Fiş/dekont yüklemesi server action üzerinden gider; varsayılan 1 MB
      // limiti 10 MB'lık belgeyi reddederdi (bkz. lib/storage.ts).
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: guvenlikBasliklari }];
  },
};

export default nextConfig;
