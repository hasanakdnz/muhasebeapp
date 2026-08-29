import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Prisma'ya dokunmayan edge-safe config — bkz. lib/auth.config.ts
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Statik dosyalar ve Auth.js API rotaları hariç her şey korumalı.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
