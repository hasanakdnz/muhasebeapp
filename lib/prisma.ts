import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 driver adapter zorunlu kılıyor; SQLite için better-sqlite3 kullanılır.
// PostgreSQL'e geçişte (ROADMAP.md Faz 9) yalnızca bu adapter değişecek.
function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL tanımlı değil. .env dosyasını .env.example'a bakarak oluşturun."
    );
  }
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

// Next.js geliştirme modunda hot reload her seferinde yeni bağlantı açmasın diye
// client global'de saklanır.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
