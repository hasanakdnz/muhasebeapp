import type { NextAuthConfig } from "next-auth";
import { canAccess } from "@/lib/rbac";

/**
 * Edge-safe Auth.js yapılandırması.
 *
 * middleware.ts Edge runtime'da çalışır; Prisma + better-sqlite3 orada
 * çalışamaz. Bu yüzden provider'lar (veritabanına dokunanlar) lib/auth.ts
 * içinde eklenir, middleware yalnızca buradaki callback'leri kullanır.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    // Credentials provider veritabanı oturumlarını desteklemez → JWT.
    strategy: "jwt",
    /**
     * 12 saat. Varsayılan 30 GÜNDÜR; muhasebe verisine erişen bir oturumun
     * bir ay boyunca açık kalması, çalınan ya da ortak bilgisayarda unutulan
     * bir çerezi aynı süre kullanılabilir kılar. Bir iş gününü kapsayacak
     * kadar uzun, bir gecede biteceği kadar kısa.
     */
    maxAge: 12 * 60 * 60,
    // Etkin kullanımda token yenilensin; çalışırken oturum düşmesin.
    updateAge: 60 * 60,
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;
      const isLoginPage = pathname === "/login";

      if (!user) {
        // Giriş sayfası herkese açık; diğer her şey korumalı.
        return isLoginPage;
      }

      if (isLoginPage) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      if (!canAccess(user.role, pathname)) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
