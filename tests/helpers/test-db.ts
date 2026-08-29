import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Her entegrasyon testi için izole, geçici bir SQLite veritabanı.
 *
 * Şema, prisma/migrations altındaki GERÇEK migration SQL'leri sırayla
 * çalıştırılarak kurulur. Böylece test şeması üretimdekiyle birebir aynı olur
 * ve migration'ların kendisi de dolaylı olarak doğrulanmış olur.
 * (better-sqlite3 `exec()` çoklu statement çalıştırır — SQL'i elle parse etmeye
 * gerek yoktur.)
 */
export type TestDb = {
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
};

function migrationDosyalari(): string[] {
  const kok = path.join(process.cwd(), "prisma", "migrations");
  return fs
    .readdirSync(kok)
    .map((ad) => path.join(kok, ad, "migration.sql"))
    .filter((p) => fs.existsSync(p))
    // Klasör adları zaman damgasıyla başlar; alfabetik sıralama = uygulama sırası.
    .sort();
}

export async function createTestDb(): Promise<TestDb> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "muhasebe-test-"));
  const file = path.join(dir, "test.db");

  const raw = new Database(file);
  try {
    raw.pragma("foreign_keys = ON");
    for (const dosya of migrationDosyalari()) {
      raw.exec(fs.readFileSync(dosya, "utf8"));
    }
  } finally {
    raw.close();
  }

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${file}` }),
  });

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
