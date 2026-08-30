import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/generated/prisma/enums";

export type SessionUser = {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
};

/**
 * Server action'lar dışarıdan çağrılabilen uç noktalardır — middleware'in
 * sayfayı koruması yeterli değildir, her action kendi yetkisini doğrular.
 *
 * ## Yetki neden VERİTABANINDAN okunur
 * Oturum JWT'dir ve `id` ile `role` alanlarını GİRİŞ ANINDAKİ hâliyle taşır.
 * Token'ın kendisi imzalıdır, ama içeriği zamanla gerçeklikten kopar:
 *
 *  - Kullanıcı silinirse token süresi dolana kadar geçerli kalır.
 *  - Yönetici, personele düşürülürse eski token ADMIN demeye devam eder ve
 *    kişi silme gibi yönetici işlemlerini yapmayı sürdürür.
 *
 * Bu yüzden her yetki kontrolü kullanıcıyı birincil anahtarla yeniden okur.
 * Maliyeti tek bir indeksli sorgudur; karşılığında yetki değişikliği ANINDA
 * geçerli olur.
 */
export async function requireUser(): Promise<SessionUser> {
  const guncel = await gecerliKullanici();
  if (!guncel) {
    throw new Error(
      "Oturumunuz geçersiz. Lütfen yeniden giriş yapın."
    );
  }
  return guncel;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Bu işlem için yönetici yetkisi gerekiyor.");
  }
  return user;
}

export const YONETICI_GEREKLI = "Bu işlem için yönetici yetkisi gerekiyor.";

/**
 * Silme gibi yönetici işlemleri için. requireAdmin() hata FIRLATIR ve bu,
 * server action'da kullanıcıya çökme ekranı olarak yansır; burada bunun
 * yerine action sözleşmesine uyan bir sonuç döner, kullanıcı okunur bir
 * uyarı görür. Yetki kontrolünün kendisi aynı — sadece sunumu farklı.
 */
export async function adminVeyaHata(): Promise<
  { ok: true; user: SessionUser } | { ok: false; error: string }
> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { ok: false, error: YONETICI_GEREKLI };
  return { ok: true, user };
}

/**
 * Oturumu açık kullanıcı — yoksa veya artık veritabanında yoksa null.
 * Sayfa katmanı bunu kullanır; action katmanı `requireUser` ile hata fırlatır.
 *
 * `cache()` ile SARILI: tek bir istek içinde kaç kez çağrılırsa çağrılsın
 * oturum bir kez çözülür ve kullanıcı bir kez okunur. Sarılmadan önce layout
 * bir, sayfa bir daha çağırıyordu ve detay sayfaları liste sayfalarının 5
 * katı sürüyordu (ölçüm: 580ms / 100ms).
 */
export const gecerliKullanici = cache(
  async (): Promise<SessionUser | null> => {
    const session = await auth();
    if (!session?.user?.id) return null;

    return prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, name: true, email: true },
    });
  }
);

/** Sayfaların yönetici-özel UI'ı gizlemesi için. */
export async function isAdmin(): Promise<boolean> {
  const user = await gecerliKullanici();
  return user?.role === "ADMIN";
}

/**
 * Yönetici sayfaları için kapı.
 *
 * middleware yalnızca JWT'deki role bakar ve JWT giriş anındaki rolü taşır;
 * yetkisi düşürülen kullanıcı eski token'ıyla yönetici sayfasını doğrudan
 * AÇABİLİYORDU (ölçüldü: /kayitlar ve /ayarlar 200 dönüyordu). Sayfa da
 * rolü veritabanından doğrular.
 *
 * middleware kaldırılmadı: o, oturumsuz isteği ucuza eler; bu ise yetkiyi
 * kesinleştirir.
 */
export async function requireAdminSayfa(): Promise<SessionUser> {
  const kullanici = await gecerliKullanici();
  if (!kullanici) redirect("/login");
  if (kullanici.role !== "ADMIN") redirect("/dashboard");
  return kullanici;
}
