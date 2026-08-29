import { auth } from "@/lib/auth";
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
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Bu işlem için oturum açmanız gerekiyor.");
  }
  return session.user;
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

/** Sayfaların yönetici-özel UI'ı gizlemesi için. */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}
