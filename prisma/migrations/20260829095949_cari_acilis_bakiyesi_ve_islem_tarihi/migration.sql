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
    "aramaAnahtari" TEXT NOT NULL DEFAULT '',
    "acilisBakiyesi" DECIMAL NOT NULL DEFAULT 0,
    "bakiye" DECIMAL NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Cari" ("adres", "aktif", "aramaAnahtari", "bakiye", "createdAt", "email", "id", "telefon", "tip", "unvan", "updatedAt", "vergiDairesi", "vknTckn") SELECT "adres", "aktif", "aramaAnahtari", "bakiye", "createdAt", "email", "id", "telefon", "tip", "unvan", "updatedAt", "vergiDairesi", "vknTckn" FROM "Cari";
DROP TABLE "Cari";
ALTER TABLE "new_Cari" RENAME TO "Cari";
CREATE INDEX "Cari_unvan_idx" ON "Cari"("unvan");
CREATE INDEX "Cari_tip_idx" ON "Cari"("tip");
CREATE INDEX "Cari_aktif_idx" ON "Cari"("aktif");
CREATE INDEX "Cari_aramaAnahtari_idx" ON "Cari"("aramaAnahtari");
CREATE TABLE "new_Islem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tip" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "toplamTutar" DECIMAL NOT NULL,
    "kdvTutari" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "odenenTutar" DECIMAL NOT NULL DEFAULT 0,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vadeTarihi" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Islem_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Islem" ("cariId", "createdAt", "id", "kdvTutari", "odenenTutar", "status", "tip", "toplamTutar", "updatedAt", "vadeTarihi") SELECT "cariId", "createdAt", "id", "kdvTutari", "odenenTutar", "status", "tip", "toplamTutar", "updatedAt", "vadeTarihi" FROM "Islem";
DROP TABLE "Islem";
ALTER TABLE "new_Islem" RENAME TO "Islem";
CREATE INDEX "Islem_cariId_idx" ON "Islem"("cariId");
CREATE INDEX "Islem_status_idx" ON "Islem"("status");
CREATE INDEX "Islem_tarih_idx" ON "Islem"("tarih");
CREATE INDEX "Islem_vadeTarihi_idx" ON "Islem"("vadeTarihi");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Geri dolgu: bu migration'dan önce hiç İşlem kaydı yoktu, dolayısıyla mevcut
-- yürüyen bakiye tamamen açılıştan gelir. Değişmez (bakiye = açılış + Σ işlem)
-- eski satırlar için de bu şekilde sağlanır.
UPDATE "Cari" SET "acilisBakiyesi" = "bakiye";

-- Belge tarihi geriye dönük olarak kayıt anına eşitlenir.
UPDATE "Islem" SET "tarih" = "createdAt";
