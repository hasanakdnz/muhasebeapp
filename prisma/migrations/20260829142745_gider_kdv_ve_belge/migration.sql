-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Gider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kategori" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "kdvOrani" DECIMAL NOT NULL DEFAULT 0,
    "kdvTutari" DECIMAL NOT NULL DEFAULT 0,
    "aciklama" TEXT,
    "belgeUrl" TEXT,
    "belgeAdi" TEXT,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Gider" ("aciklama", "belgeUrl", "createdAt", "id", "kategori", "tarih", "tutar", "updatedAt") SELECT "aciklama", "belgeUrl", "createdAt", "id", "kategori", "tarih", "tutar", "updatedAt" FROM "Gider";
DROP TABLE "Gider";
ALTER TABLE "new_Gider" RENAME TO "Gider";
CREATE INDEX "Gider_kategori_idx" ON "Gider"("kategori");
CREATE INDEX "Gider_tarih_idx" ON "Gider"("tarih");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
