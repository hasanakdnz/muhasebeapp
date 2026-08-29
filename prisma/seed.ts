import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/password";

/**
 * Geliştirme verisi: RBAC'i (Admin / Personel) denemek için iki kullanıcı.
 * Şifreler yalnızca yerel geliştirme içindir.
 */
const SEED_USERS = [
  {
    email: "admin@muhasebe.local",
    name: "Ahmet Yılmaz",
    role: "ADMIN" as const,
    password: "Admin1234!",
  },
  {
    email: "personel@muhasebe.local",
    name: "Zeynep Kaya",
    role: "PERSONEL" as const,
    password: "Personel1234!",
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tanımlı değil.");

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });

  try {
    for (const user of SEED_USERS) {
      const passwordHash = await hashPassword(user.password);
      await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, role: user.role, passwordHash },
        create: {
          email: user.email,
          name: user.name,
          role: user.role,
          passwordHash,
        },
      });
      console.log(`  ✓ ${user.email} (${user.role})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
