import "server-only";

import { prisma } from "@/lib/prisma";
import { vadeBildirimiOlustur, type Bildirim } from "@/lib/domain/bildirim";
import { VARSAYILAN_YAKLASMA_ESIGI, listeleVadeliCekSenetler } from "@/lib/vade";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type Db = PrismaClient;

export { vadeBildirimiOlustur } from "@/lib/domain/bildirim";
export type { Bildirim } from "@/lib/domain/bildirim";

/**
 * Bildirim gönderim katmanı.
 *
 * ROADMAP Faz 6 "e-posta bildirim cron job'u" diyor. Gerçek SMTP, kimlik
 * bilgisi ve dış servis gerektiriyor — CLAUDE.md bunu şimdilik kapsam dışı
 * bırakıyor (S3 ve PostgreSQL kararlarıyla aynı gerekçe). Bu yüzden gönderim
 * bir ARAYÜZÜN arkasında: geliştirmede konsola yazar, SMTP'ye geçmek yalnızca
 * yeni bir gönderici eklemek ve `aktifGonderici`yi değiştirmektir.
 */
export type BildirimGondericisi = {
  ad: string;
  gonder(
    alicilar: string[],
    bildirim: Bildirim
  ): Promise<{ ok: true } | { ok: false; hata: string }>;
};

export const konsolGondericisi: BildirimGondericisi = {
  ad: "konsol",
  async gonder(alicilar, bildirim) {
    // Geliştirmede bildirimin gerçekten üretildiğini ve içeriğini görmek için.
    console.info(
      [
        "── Vade bildirimi ──",
        `Alıcılar: ${alicilar.join(", ") || "(alıcı yok)"}`,
        `Konu: ${bildirim.konu}`,
        "",
        bildirim.metin,
        "────────────────────",
      ].join("\n")
    );
    return { ok: true };
  },
};

export function aktifGonderici(): BildirimGondericisi {
  // SMTP eklendiğinde burada seçim yapılacak (örn. process.env.SMTP_HOST varsa).
  return konsolGondericisi;
}

export type BildirimSonucu = {
  gonderildi: boolean;
  /** Bildirim üretilmediyse neden. */
  neden?: string;
  aliciSayisi: number;
  kayitSayisi: number;
  konu?: string;
};

/**
 * Vade bildirimini üretir ve gönderir.
 *
 * Alıcılar yönetici kullanıcılardır; vade takibi bir yönetim bilgisidir.
 * Gönderilecek kayıt yoksa hiç bildirim çıkmaz.
 */
export async function vadeBildirimiGonder(
  bugun: Date,
  esik: number = VARSAYILAN_YAKLASMA_ESIGI,
  db: Db = prisma,
  gonderici: BildirimGondericisi = aktifGonderici()
): Promise<BildirimSonucu> {
  const kayitlar = await listeleVadeliCekSenetler(
    { bugun, esik, sadeceDikkatGerekenler: true },
    db
  );

  const bildirim = vadeBildirimiOlustur(
    kayitlar.map((k) => ({
      tip: k.tip,
      yon: k.yon,
      cariUnvan: k.cariUnvan,
      vadeTarihi: k.vadeTarihi,
      kalan: k.kalan,
      durum: k.durum,
      kalanGun: k.kalanGun,
    })),
    bugun
  );

  if (!bildirim) {
    return {
      gonderildi: false,
      neden: "Dikkat gerektiren vade yok.",
      aliciSayisi: 0,
      kayitSayisi: 0,
    };
  }

  const yoneticiler = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  const alicilar = yoneticiler.map((y) => y.email);

  if (alicilar.length === 0) {
    return {
      gonderildi: false,
      neden: "Bildirim gönderilecek yönetici kullanıcı yok.",
      aliciSayisi: 0,
      kayitSayisi: kayitlar.length,
      konu: bildirim.konu,
    };
  }

  const sonuc = await gonderici.gonder(alicilar, bildirim);
  if (!sonuc.ok) {
    return {
      gonderildi: false,
      neden: sonuc.hata,
      aliciSayisi: alicilar.length,
      kayitSayisi: kayitlar.length,
      konu: bildirim.konu,
    };
  }

  return {
    gonderildi: true,
    aliciSayisi: alicilar.length,
    kayitSayisi: kayitlar.length,
    konu: bildirim.konu,
  };
}
