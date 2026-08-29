-- CreateTable
CREATE TABLE "Firma" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'firma',
    "unvan" TEXT NOT NULL DEFAULT '',
    "vknTckn" TEXT,
    "vergiDairesi" TEXT,
    "adres" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "iban" TEXT,
    "logoUrl" TEXT,
    "logoAdi" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Proforma" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "no" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gecerlilikTarihi" DATETIME,
    "durum" TEXT NOT NULL DEFAULT 'TASLAK',
    "notlar" TEXT,
    "toplamTutar" DECIMAL NOT NULL DEFAULT 0,
    "kdvTutari" DECIMAL NOT NULL DEFAULT 0,
    "islemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proforma_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProformaKalemi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proformaId" TEXT NOT NULL,
    "urunAdi" TEXT NOT NULL,
    "miktar" DECIMAL NOT NULL,
    "birimFiyat" DECIMAL NOT NULL,
    "kdvOrani" DECIMAL NOT NULL,
    CONSTRAINT "ProformaKalemi_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "Proforma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Proforma_no_key" ON "Proforma"("no");

-- CreateIndex
CREATE UNIQUE INDEX "Proforma_islemId_key" ON "Proforma"("islemId");

-- CreateIndex
CREATE INDEX "Proforma_cariId_idx" ON "Proforma"("cariId");

-- CreateIndex
CREATE INDEX "Proforma_durum_idx" ON "Proforma"("durum");

-- CreateIndex
CREATE INDEX "Proforma_tarih_idx" ON "Proforma"("tarih");

-- CreateIndex
CREATE INDEX "ProformaKalemi_proformaId_idx" ON "ProformaKalemi"("proformaId");
