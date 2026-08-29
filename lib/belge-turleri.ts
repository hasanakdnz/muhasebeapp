/**
 * Belge türü sabitleri.
 *
 * lib/storage.ts Node API'leri (fs, crypto, path) kullanır ve YALNIZCA sunucuda
 * çalışır. Bu sabitler ise dosya seçicide (client component) de gerekiyor;
 * ayrı tutulmazlarsa storage modülü client paketine sürüklenir ve build kırılır.
 */

export type BelgeTuru = {
  mime: string;
  uzanti: string;
  /** Dosyanın başındaki imza baytları — istemcinin bildirdiği MIME'a güvenilmez. */
  imza: number[];
  /** WebP gibi imzası ofsetli türler için. */
  ofset?: number;
};

export const IZINLI_BELGE_TURLERI: BelgeTuru[] = [
  { mime: "image/jpeg", uzanti: "jpg", imza: [0xff, 0xd8, 0xff] },
  {
    mime: "image/png",
    uzanti: "png",
    imza: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  // "WEBP" imzası 8. bayttan başlar ("RIFF" + boyut + "WEBP").
  { mime: "image/webp", uzanti: "webp", imza: [0x57, 0x45, 0x42, 0x50], ofset: 8 },
  { mime: "application/pdf", uzanti: "pdf", imza: [0x25, 0x50, 0x44, 0x46] },
];

export const IZINLI_MIME_TIPLERI = IZINLI_BELGE_TURLERI.map((t) => t.mime);

export const MAKS_BELGE_BOYUTU = 10 * 1024 * 1024; // 10 MB

/** Depo anahtarı: 32 hex karakter + izinli uzantı. Başka hiçbir şey kabul edilmez. */
const ANAHTAR_KALIBI = /^[0-9a-f]{32}\.(jpg|png|webp|pdf)$/;

export function anahtarGecerliMi(anahtar: string): boolean {
  return ANAHTAR_KALIBI.test(anahtar);
}

export function anahtarMimeTipi(anahtar: string): string {
  const uzanti = anahtar.split(".").pop();
  return (
    IZINLI_BELGE_TURLERI.find((t) => t.uzanti === uzanti)?.mime ??
    "application/octet-stream"
  );
}
