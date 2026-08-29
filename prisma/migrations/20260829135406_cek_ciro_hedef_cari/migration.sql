-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CekSenet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tip" TEXT NOT NULL,
    "yon" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "ciroEdilenCariId" TEXT,
    "ciroTarihi" DATETIME,
    "tutar" DECIMAL NOT NULL,
    "tahsilEdilen" DECIMAL NOT NULL DEFAULT 0,
    "vadeTarihi" DATETIME NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'PORTFOYDE',
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CekSenet_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CekSenet_ciroEdilenCariId_fkey" FOREIGN KEY ("ciroEdilenCariId") REFERENCES "Cari" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CekSenet" ("aciklama", "cariId", "createdAt", "durum", "id", "tahsilEdilen", "tip", "tutar", "updatedAt", "vadeTarihi", "yon") SELECT "aciklama", "cariId", "createdAt", "durum", "id", "tahsilEdilen", "tip", "tutar", "updatedAt", "vadeTarihi", "yon" FROM "CekSenet";
DROP TABLE "CekSenet";
ALTER TABLE "new_CekSenet" RENAME TO "CekSenet";
CREATE INDEX "CekSenet_cariId_idx" ON "CekSenet"("cariId");
CREATE INDEX "CekSenet_durum_idx" ON "CekSenet"("durum");
CREATE INDEX "CekSenet_vadeTarihi_idx" ON "CekSenet"("vadeTarihi");
CREATE INDEX "CekSenet_yon_idx" ON "CekSenet"("yon");
CREATE INDEX "CekSenet_ciroEdilenCariId_idx" ON "CekSenet"("ciroEdilenCariId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
