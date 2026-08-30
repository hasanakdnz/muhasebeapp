-- Islem.no (ic referans numarasi) ve Islem.belgeNo (karsi tarafin belge no'su).
--
-- `no` NOT NULL ve UNIQUE oldugu icin mevcut satirlar bos birakilamaz. Prisma'nin
-- urettigi INSERT bu sutunu atliyordu; asagida numaralar tip ve yil bazinda
-- ROW_NUMBER ile uretiliyor. Siralama tarih + id: numaralar kronolojiyi izler ve
-- ayni tarihli kayitlarda deterministik kalir.
--
-- Tipe gore AYRI sayac: satis faturasi serisi kesintisiz olmalidir, alis
-- kayitlari o seride bosluk acmamalidir.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Islem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "no" TEXT NOT NULL,
    "belgeNo" TEXT,
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
INSERT INTO "new_Islem" ("no", "cariId", "createdAt", "id", "kdvTutari", "odenenTutar", "status", "tarih", "tip", "toplamTutar", "updatedAt", "vadeTarihi")
SELECT
    (CASE "tip" WHEN 'SATIS' THEN 'FTR' ELSE 'ALS' END)
      || '-' || strftime('%Y', "tarih")
      || '-' || printf('%04d', ROW_NUMBER() OVER (
           PARTITION BY "tip", strftime('%Y', "tarih")
           ORDER BY "tarih", "id"
         )),
    "cariId", "createdAt", "id", "kdvTutari", "odenenTutar", "status", "tarih", "tip", "toplamTutar", "updatedAt", "vadeTarihi"
FROM "Islem";
DROP TABLE "Islem";
ALTER TABLE "new_Islem" RENAME TO "Islem";
CREATE UNIQUE INDEX "Islem_no_key" ON "Islem"("no");
CREATE INDEX "Islem_cariId_idx" ON "Islem"("cariId");
CREATE INDEX "Islem_status_idx" ON "Islem"("status");
CREATE INDEX "Islem_tarih_idx" ON "Islem"("tarih");
CREATE INDEX "Islem_belgeNo_idx" ON "Islem"("belgeNo");
CREATE INDEX "Islem_vadeTarihi_idx" ON "Islem"("vadeTarihi");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
