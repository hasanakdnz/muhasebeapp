-- CreateTable
CREATE TABLE "IslemOdeme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islemId" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kaynak" TEXT NOT NULL DEFAULT 'DIREKT',
    "cekSenetTahsilatId" TEXT,
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IslemOdeme_islemId_fkey" FOREIGN KEY ("islemId") REFERENCES "Islem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IslemOdeme_cekSenetTahsilatId_fkey" FOREIGN KEY ("cekSenetTahsilatId") REFERENCES "CekSenetTahsilat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IslemOdeme_islemId_idx" ON "IslemOdeme"("islemId");

-- CreateIndex
CREATE INDEX "IslemOdeme_cekSenetTahsilatId_idx" ON "IslemOdeme"("cekSenetTahsilatId");

-- CreateIndex
CREATE INDEX "IslemOdeme_tarih_idx" ON "IslemOdeme"("tarih");
