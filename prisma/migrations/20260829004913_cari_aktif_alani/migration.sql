-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cari" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unvan" TEXT NOT NULL,
    "vknTckn" TEXT,
    "vergiDairesi" TEXT,
    "tip" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "adres" TEXT,
    "bakiye" DECIMAL NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Cari" ("adres", "bakiye", "createdAt", "email", "id", "telefon", "tip", "unvan", "updatedAt", "vergiDairesi", "vknTckn") SELECT "adres", "bakiye", "createdAt", "email", "id", "telefon", "tip", "unvan", "updatedAt", "vergiDairesi", "vknTckn" FROM "Cari";
DROP TABLE "Cari";
ALTER TABLE "new_Cari" RENAME TO "Cari";
CREATE INDEX "Cari_unvan_idx" ON "Cari"("unvan");
CREATE INDEX "Cari_tip_idx" ON "Cari"("tip");
CREATE INDEX "Cari_aktif_idx" ON "Cari"("aktif");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
