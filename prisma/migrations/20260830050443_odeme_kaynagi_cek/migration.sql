/*
  Warnings:

  - You are about to drop the column `cekSenetTahsilatId` on the `IslemOdeme` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IslemOdeme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islemId" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kaynak" TEXT NOT NULL DEFAULT 'DIREKT',
    "hesapHareketiId" TEXT,
    "cekSenetId" TEXT,
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IslemOdeme_islemId_fkey" FOREIGN KEY ("islemId") REFERENCES "Islem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IslemOdeme_hesapHareketiId_fkey" FOREIGN KEY ("hesapHareketiId") REFERENCES "HesapHareketi" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IslemOdeme_cekSenetId_fkey" FOREIGN KEY ("cekSenetId") REFERENCES "CekSenet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_IslemOdeme" ("aciklama", "createdAt", "hesapHareketiId", "id", "islemId", "kaynak", "tarih", "tutar") SELECT "aciklama", "createdAt", "hesapHareketiId", "id", "islemId", "kaynak", "tarih", "tutar" FROM "IslemOdeme";
DROP TABLE "IslemOdeme";
ALTER TABLE "new_IslemOdeme" RENAME TO "IslemOdeme";
CREATE UNIQUE INDEX "IslemOdeme_hesapHareketiId_key" ON "IslemOdeme"("hesapHareketiId");
CREATE INDEX "IslemOdeme_islemId_idx" ON "IslemOdeme"("islemId");
CREATE INDEX "IslemOdeme_cekSenetId_idx" ON "IslemOdeme"("cekSenetId");
CREATE INDEX "IslemOdeme_tarih_idx" ON "IslemOdeme"("tarih");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
