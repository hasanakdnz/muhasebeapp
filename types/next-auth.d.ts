import type { Role } from "@/lib/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

// next-auth/jwt yalnızca `export * from "@auth/core/jwt"` yapar; re-export
// modülüne yapılan augmentation JWT arayüzüyle BİRLEŞMEZ, yenisini tanımlar.
// Bu yüzden tip genişletmesi kaynağa uygulanır.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
