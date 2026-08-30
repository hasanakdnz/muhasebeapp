import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { SAHTE_HASH, verifyPassword } from "@/lib/password";
import { authConfig } from "@/lib/auth.config";
import {
  basariliGirisTemizle,
  basarisizGirisKaydet,
  girisAnahtarlari,
  girisDenenebilirMi,
} from "@/lib/giris-limiti";
import { kilitMesaji } from "@/lib/domain/giris-limiti";
import { loginSchema } from "@/lib/validations/auth";

/** Kilit mesajını kullanıcıya taşıyabilmek için özel hata sınıfı. */
export class GirisKilitliHatasi extends CredentialsSignin {
  constructor(mesaj: string) {
    super(mesaj);
    this.code = mesaj;
  }
}

/** İstekten istemci IP'sini okur; ters vekil arkasında X-Forwarded-For gelir. */
function istemciIp(request: Request | undefined): string | null {
  if (!request) return null;
  const iletilen = request.headers.get("x-forwarded-for");
  // Virgülle ayrılmış zincirde İLK adres istemcidir.
  if (iletilen) return iletilen.split(",")[0]!.trim() || null;
  return request.headers.get("x-real-ip");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials, request) {
        // Server tarafında da aynı Zod şeması ile doğrulanır (CLAUDE.md kuralı).
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const eposta = parsed.data.email.toLowerCase();
        const anahtarlar = girisAnahtarlari(eposta, istemciIp(request));

        const limit = girisDenenebilirMi(anahtarlar);
        if (!limit.izinli) {
          throw new GirisKilitliHatasi(kilitMesaji(limit.kalanSaniye));
        }

        const user = await prisma.user.findUnique({ where: { email: eposta } });

        // KULLANICI YOKKEN DE bcrypt çalıştırılır. Aksi halde "kullanıcı yok"
        // dalı anında dönerdi ve saldırgan yanıt süresinden hangi e-postaların
        // kayıtlı olduğunu okuyabilirdi (ölçüldü: ~200ms fark).
        const valid = await verifyPassword(
          parsed.data.password,
          user?.passwordHash ?? SAHTE_HASH
        );

        if (!user || !valid) {
          basarisizGirisKaydet(anahtarlar);
          return null;
        }

        basariliGirisTemizle(anahtarlar);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
