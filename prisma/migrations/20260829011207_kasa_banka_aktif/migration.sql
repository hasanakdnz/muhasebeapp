-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KasaBanka" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ad" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "bakiye" DECIMAL NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_KasaBanka" ("ad", "bakiye", "createdAt", "id", "tip", "updatedAt") SELECT "ad", "bakiye", "createdAt", "id", "tip", "updatedAt" FROM "KasaBanka";
DROP TABLE "KasaBanka";
ALTER TABLE "new_KasaBanka" RENAME TO "KasaBanka";
CREATE INDEX "KasaBanka_tip_idx" ON "KasaBanka"("tip");
CREATE INDEX "KasaBanka_aktif_idx" ON "KasaBanka"("aktif");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
