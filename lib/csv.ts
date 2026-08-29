import { formatAmount, type DecimalLike } from "@/lib/money";
import { formatTarih } from "@/lib/date";

/**
 * Excel uyumlu CSV üretimi.
 *
 * ROADMAP "Excel/PDF dışa aktarım" diyor. Gerçek .xlsx için ek bir kütüphane
 * gerekiyor; Türkçe Excel aşağıdaki iki kurala uyan CSV'yi zaten doğrudan,
 * sütunlara ayrılmış şekilde açar:
 *
 *  1. Ayraç NOKTALI VİRGÜL. Türkçe yerelde ondalık ayracı virgül olduğu için
 *     virgülle ayrılmış dosya tek sütuna düşer.
 *  2. Dosya başında UTF-8 BOM. Olmazsa Excel dosyayı ANSI sanır ve Türkçe
 *     karakterler bozulur (Ş, İ, ğ...).
 *
 * PDF tarafında ayrı bir kütüphane yerine baskı stili kullanılır: rapor
 * sayfaları yazdırılabilir (Ctrl+P → PDF olarak kaydet) ve çıktı DESIGN.md
 * tipografisini korur.
 */

export const CSV_AYRAC = ";";
const BOM = "﻿";

function hucre(deger: string | number | null | undefined): string {
  const metin = deger === null || deger === undefined ? "" : String(deger);
  // Ayraç, tırnak veya satır sonu içeren hücreler tırnaklanır; içteki tırnak ikilenir.
  if (/[";\r\n]/.test(metin)) {
    return `"${metin.replace(/"/g, '""')}"`;
  }
  return metin;
}

export type CsvSutun<T> = {
  baslik: string;
  /** Hücre değerini üretir. Tutarlar için `csvTutar` kullanın. */
  deger: (satir: T) => string | number | null | undefined;
};

export function csvOlustur<T>(sutunlar: CsvSutun<T>[], satirlar: T[]): string {
  const satirlarMetin = [
    sutunlar.map((s) => hucre(s.baslik)).join(CSV_AYRAC),
    ...satirlar.map((satir) =>
      sutunlar.map((s) => hucre(s.deger(satir))).join(CSV_AYRAC)
    ),
  ];
  // \r\n: Excel'in beklediği satır sonu.
  return BOM + satirlarMetin.join("\r\n") + "\r\n";
}

/** Tutarı Türkçe ondalık ayracıyla yazar — Excel sayı olarak tanır. */
export function csvTutar(deger: DecimalLike): string {
  return formatAmount(deger);
}

export function csvTarih(deger: Date | string): string {
  return formatTarih(deger);
}

/**
 * İndirme başlıkları. Dosya adı ASCII'ye indirgenir ve ayrıca UTF-8 olarak
 * `filename*` ile verilir — eski istemciler bozuk ad göstermesin.
 */
export function csvIndirmeBasliklari(dosyaAdi: string): HeadersInit {
  const guvenli = dosyaAdi
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "-");
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${guvenli}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
    "Cache-Control": "private, max-age=0, must-revalidate",
  };
}
