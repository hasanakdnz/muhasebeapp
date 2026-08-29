import { formatTRY, type DecimalLike } from "@/lib/money";
import { formatTarih } from "@/lib/date";
import type { VadeDurumu } from "@/lib/domain/vade";

/**
 * Vade bildirimi metni — saf, Prisma'sız ve gönderim katmanından bağımsız.
 * Ne zaman bildirim GÖNDERİLECEĞİ ve içeriğinin ne olacağı burada belirlenir;
 * nasıl gönderileceği lib/bildirim.ts'in işidir.
 */

export type BildirimKaydi = {
  tip: string;
  yon: "ALINAN" | "VERILEN";
  cariUnvan: string;
  vadeTarihi: Date;
  kalan: DecimalLike;
  durum: VadeDurumu;
  kalanGun: number;
};

export type Bildirim = {
  konu: string;
  metin: string;
};

function satirMetni(k: BildirimKaydi): string {
  const yonEtiketi = k.yon === "ALINAN" ? "tahsilat" : "ödeme";
  const durumMetni =
    k.durum === "gecti"
      ? `${Math.abs(k.kalanGun)} gün gecikti`
      : k.durum === "bugun"
        ? "bugün vadeli"
        : `${k.kalanGun} gün kaldı`;

  return `  • ${formatTarih(k.vadeTarihi)} — ${k.cariUnvan} — ${formatTRY(k.kalan)} (${yonEtiketi}, ${durumMetni})`;
}

/**
 * Dikkat gerektiren kayıtlardan bildirim üretir.
 *
 * Gönderilecek bir şey yoksa `null` döner — boş bildirim gönderilmez, aksi
 * halde günlük "her şey yolunda" postası bildirimleri değersizleştirir.
 */
export function vadeBildirimiOlustur(
  kayitlar: BildirimKaydi[],
  bugun: Date
): Bildirim | null {
  const gecen = kayitlar.filter((k) => k.durum === "gecti");
  const bugunVadeli = kayitlar.filter((k) => k.durum === "bugun");
  const yaklasan = kayitlar.filter((k) => k.durum === "yaklasiyor");

  if (gecen.length === 0 && bugunVadeli.length === 0 && yaklasan.length === 0) {
    return null;
  }

  const konuParcalari: string[] = [];
  if (gecen.length > 0) konuParcalari.push(`${gecen.length} gecikmiş`);
  if (bugunVadeli.length > 0) konuParcalari.push(`${bugunVadeli.length} bugün`);
  if (yaklasan.length > 0) konuParcalari.push(`${yaklasan.length} yaklaşan`);

  const bolumler: string[] = [
    `${formatTarih(bugun)} tarihli vade durumu:`,
    "",
  ];

  if (gecen.length > 0) {
    bolumler.push("Vadesi geçmiş:", ...gecen.map(satirMetni), "");
  }
  if (bugunVadeli.length > 0) {
    bolumler.push("Bugün vadeli:", ...bugunVadeli.map(satirMetni), "");
  }
  if (yaklasan.length > 0) {
    bolumler.push("Vadesi yaklaşan:", ...yaklasan.map(satirMetni), "");
  }

  bolumler.push("Bu e-posta Muhasebe uygulaması tarafından otomatik gönderildi.");

  return {
    konu: `Vade takibi — ${konuParcalari.join(", ")}`,
    metin: bolumler.join("\n"),
  };
}
