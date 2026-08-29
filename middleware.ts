import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Prisma'ya dokunmayan edge-safe config — bkz. lib/auth.config.ts
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Statik dosyalar ve Auth.js API rotaları hariç her şey korumalı.
  // api/cron da muaftır: zamanlayıcının oturumu yoktur, bunun yerine
  // paylaşılan bir sırla korunur (bkz. app/api/cron/.../route.ts).
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
