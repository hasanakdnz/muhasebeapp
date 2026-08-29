import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { AuditAksiyonu } from "@/lib/domain/audit";

// Etiketler ve detay biçimlendirme saf tarafta: lib/domain/audit.ts
export {
  AUDIT_AKSIYONLARI,
  AUDIT_AKSIYON_ETIKETI,
  AUDIT_AKSIYON_TONU,
  AUDIT_HEDEF_ETIKETI,
  detayParcalari,
  hedefEtiketi,
  type AuditAksiyonu,
} from "@/lib/domain/audit";

export type Db = PrismaClient;

/**
 * Denetim kaydı (audit log).
 *
 * Neyin kaydedildiği: geri alınamaz ya da parasal sonucu olan işlemler —
 * silmeler, ödeme/tahsilat, ciro ve durum değişiklikleri. Sıradan okuma ve
 * form açma gibi olaylar kaydedilmez; her şeyi kaydeden bir log okunmaz olur.
 *
 * ## Sınır (bilinçli)
 * Kayıt, asıl işlem BAŞARILI olduktan sonra action katmanından yazılır; asıl
 * işlemle aynı transaction içinde değildir. Bunun nedeni veri katmanı
 * fonksiyonlarının kendi transaction'larını yönetmesi. Pratik sonucu: log
 * yazımı başarısız olursa kullanıcının işlemi geri alınmaz, hata sunucuya
 * yazılır. Denetim kaydının işlemle atomik olması gerekiyorsa tx'in aşağıya
 * taşınması gerekir — bu, ayrı ve daha geniş bir değişikliktir.
 */

export type AuditKaydi = {
  userId: string;
  aksiyon: AuditAksiyonu;
  hedefTip: string;
  hedefId: string;
  /** Kullanıcıya gösterilecek kısa özet ve varsa tutar. */
  detay?: Record<string, unknown>;
};

/**
 * Denetim kaydını yazar. Hata durumunda asıl işlemi BOZMAZ — kullanıcı
 * silme/ödeme işlemini tamamlamışken log yüzünden hata görmemeli — fakat
 * sessiz de kalmaz, sunucuya yazılır.
 */
export async function auditKaydet(
  veri: AuditKaydi,
  db: Db = prisma
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: veri.userId,
        aksiyon: veri.aksiyon,
        hedefTip: veri.hedefTip,
        hedefId: veri.hedefId,
        // Alan Json — nesne DOĞRUDAN verilir. JSON.stringify ile verilseydi
        // Prisma bir kez daha kodlar, veritabanında çift kodlanmış bir dize
        // kalırdı.
        detay: veri.detay
          ? (veri.detay as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (error) {
    console.error("Denetim kaydı yazılamadı:", { veri, error });
  }
}

export type AuditSatiri = {
  id: string;
  aksiyon: AuditAksiyonu;
  hedefTip: string;
  hedefId: string;
  detay: Record<string, unknown> | null;
  tarih: Date;
  kullaniciAdi: string;
  kullaniciEposta: string;
};

export type AuditFiltre = {
  aksiyon?: AuditAksiyonu;
  hedefTip?: string;
  limit?: number;
};

export async function listeleAuditLog(
  filtre: AuditFiltre = {},
  db: Db = prisma
): Promise<AuditSatiri[]> {
  const kayitlar = await db.auditLog.findMany({
    where: {
      ...(filtre.aksiyon ? { aksiyon: filtre.aksiyon } : {}),
      ...(filtre.hedefTip ? { hedefTip: filtre.hedefTip } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filtre.limit ?? 200,
    include: { user: { select: { name: true, email: true } } },
  });

  return kayitlar.map((k) => ({
    id: k.id,
    aksiyon: k.aksiyon as AuditAksiyonu,
    hedefTip: k.hedefTip,
    hedefId: k.hedefId,
    detay: cozDetay(k.detay),
    tarih: k.createdAt,
    kullaniciAdi: k.user.name,
    kullaniciEposta: k.user.email,
  }));
}

/** SQLite'ta Json alanı string olarak dönebilir; iki durumu da karşılar. */
function cozDetay(deger: unknown): Record<string, unknown> | null {
  if (deger === null || deger === undefined) return null;
  if (typeof deger === "object") return deger as Record<string, unknown>;
  if (typeof deger === "string") {
    try {
      return JSON.parse(deger) as Record<string, unknown>;
    } catch {
      return { not: deger };
    }
  }
  return null;
}
