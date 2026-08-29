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
