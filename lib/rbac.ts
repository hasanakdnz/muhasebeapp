import type { Role } from "@/lib/generated/prisma/enums";

/**
 * Rol bazlı erişim (CLAUDE.md: Admin / Personel).
 *
 * Yetki politikası tek yerde tutulur; yeni sayfa eklenince yalnızca bu tablo
 * güncellenir. Burada listelenmeyen dashboard sayfaları her iki role de açıktır.
 */
// Denetim kaydı kimin ne yaptığını gösterir — yalnızca yönetici görür.
export const ADMIN_ONLY_PREFIXES = ["/ayarlar", "/kayitlar"] as const;

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function canAccess(role: Role | undefined, pathname: string): boolean {
  if (!role) return false;
  if (isAdminOnlyPath(pathname)) return role === "ADMIN";
  return true;
}
