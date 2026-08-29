/*
  Warnings:

  - Added the required column `yon` to the `CekSenet` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "CekSenetTahsilat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cekSenetId" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CekSenetTahsilat_cekSenetId_fkey" FOREIGN KEY ("cekSenetId") REFERENCES "CekSenet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CekSenet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tip" TEXT NOT NULL,
    "yon" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "tahsilEdilen" DECIMAL NOT NULL DEFAULT 0,
    "vadeTarihi" DATETIME NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'PORTFOYDE',
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CekSenet_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- `yon` yeni ve zorunlu bir alan. Mevcut kayıtlar için ALINAN varsayılır
-- (portföydeki çek/senet tipik olarak müşteriden alınandır); bu sayede
-- verisi olan bir kurulumda migration kırılmaz.
INSERT INTO "new_CekSenet" ("cariId", "createdAt", "durum", "id", "tahsilEdilen", "tip", "tutar", "updatedAt", "vadeTarihi", "yon") SELECT "cariId", "createdAt", "durum", "id", "tahsilEdilen", "tip", "tutar", "updatedAt", "vadeTarihi", 'ALINAN' FROM "CekSenet";
DROP TABLE "CekSenet";
ALTER TABLE "new_CekSenet" RENAME TO "CekSenet";
CREATE INDEX "CekSenet_cariId_idx" ON "CekSenet"("cariId");
CREATE INDEX "CekSenet_durum_idx" ON "CekSenet"("durum");
CREATE INDEX "CekSenet_vadeTarihi_idx" ON "CekSenet"("vadeTarihi");
CREATE INDEX "CekSenet_yon_idx" ON "CekSenet"("yon");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CekSenetTahsilat_cekSenetId_idx" ON "CekSenetTahsilat"("cekSenetId");

-- CreateIndex
CREATE INDEX "CekSenetTahsilat_tarih_idx" ON "CekSenetTahsilat"("tarih");
