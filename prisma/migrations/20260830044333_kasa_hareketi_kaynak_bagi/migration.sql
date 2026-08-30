-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CekSenetTahsilat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cekSenetId" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,
    "hesapHareketiId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CekSenetTahsilat_cekSenetId_fkey" FOREIGN KEY ("cekSenetId") REFERENCES "CekSenet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CekSenetTahsilat_hesapHareketiId_fkey" FOREIGN KEY ("hesapHareketiId") REFERENCES "HesapHareketi" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CekSenetTahsilat" ("aciklama", "cekSenetId", "createdAt", "id", "tarih", "tutar") SELECT "aciklama", "cekSenetId", "createdAt", "id", "tarih", "tutar" FROM "CekSenetTahsilat";
DROP TABLE "CekSenetTahsilat";
ALTER TABLE "new_CekSenetTahsilat" RENAME TO "CekSenetTahsilat";
CREATE UNIQUE INDEX "CekSenetTahsilat_hesapHareketiId_key" ON "CekSenetTahsilat"("hesapHareketiId");
CREATE INDEX "CekSenetTahsilat_cekSenetId_idx" ON "CekSenetTahsilat"("cekSenetId");
CREATE INDEX "CekSenetTahsilat_tarih_idx" ON "CekSenetTahsilat"("tarih");
CREATE TABLE "new_Gider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kategori" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "kdvOrani" DECIMAL NOT NULL DEFAULT 0,
    "kdvTutari" DECIMAL NOT NULL DEFAULT 0,
    "aciklama" TEXT,
    "belgeUrl" TEXT,
    "belgeAdi" TEXT,
    "hesapHareketiId" TEXT,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Gider_hesapHareketiId_fkey" FOREIGN KEY ("hesapHareketiId") REFERENCES "HesapHareketi" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Gider" ("aciklama", "belgeAdi", "belgeUrl", "createdAt", "id", "kategori", "kdvOrani", "kdvTutari", "tarih", "tutar", "updatedAt") SELECT "aciklama", "belgeAdi", "belgeUrl", "createdAt", "id", "kategori", "kdvOrani", "kdvTutari", "tarih", "tutar", "updatedAt" FROM "Gider";
DROP TABLE "Gider";
ALTER TABLE "new_Gider" RENAME TO "Gider";
CREATE UNIQUE INDEX "Gider_hesapHareketiId_key" ON "Gider"("hesapHareketiId");
CREATE INDEX "Gider_kategori_idx" ON "Gider"("kategori");
CREATE INDEX "Gider_tarih_idx" ON "Gider"("tarih");
CREATE TABLE "new_IslemOdeme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islemId" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kaynak" TEXT NOT NULL DEFAULT 'DIREKT',
    "hesapHareketiId" TEXT,
    "cekSenetTahsilatId" TEXT,
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IslemOdeme_islemId_fkey" FOREIGN KEY ("islemId") REFERENCES "Islem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IslemOdeme_hesapHareketiId_fkey" FOREIGN KEY ("hesapHareketiId") REFERENCES "HesapHareketi" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IslemOdeme_cekSenetTahsilatId_fkey" FOREIGN KEY ("cekSenetTahsilatId") REFERENCES "CekSenetTahsilat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_IslemOdeme" ("aciklama", "cekSenetTahsilatId", "createdAt", "id", "islemId", "kaynak", "tarih", "tutar") SELECT "aciklama", "cekSenetTahsilatId", "createdAt", "id", "islemId", "kaynak", "tarih", "tutar" FROM "IslemOdeme";
DROP TABLE "IslemOdeme";
ALTER TABLE "new_IslemOdeme" RENAME TO "IslemOdeme";
CREATE UNIQUE INDEX "IslemOdeme_hesapHareketiId_key" ON "IslemOdeme"("hesapHareketiId");
CREATE INDEX "IslemOdeme_islemId_idx" ON "IslemOdeme"("islemId");
CREATE INDEX "IslemOdeme_cekSenetTahsilatId_idx" ON "IslemOdeme"("cekSenetTahsilatId");
CREATE INDEX "IslemOdeme_tarih_idx" ON "IslemOdeme"("tarih");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
