-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PERSONEL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Cari" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unvan" TEXT NOT NULL,
    "vknTckn" TEXT,
    "vergiDairesi" TEXT,
    "tip" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "adres" TEXT,
    "bakiye" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Islem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tip" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "toplamTutar" DECIMAL NOT NULL,
    "kdvTutari" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "odenenTutar" DECIMAL NOT NULL DEFAULT 0,
    "vadeTarihi" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Islem_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IslemKalemi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "islemId" TEXT NOT NULL,
    "urunAdi" TEXT NOT NULL,
    "miktar" DECIMAL NOT NULL,
    "birimFiyat" DECIMAL NOT NULL,
    "kdvOrani" DECIMAL NOT NULL,
    CONSTRAINT "IslemKalemi_islemId_fkey" FOREIGN KEY ("islemId") REFERENCES "Islem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KasaBanka" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ad" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "bakiye" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HesapHareketi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hesapId" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "aciklama" TEXT,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HesapHareketi_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "KasaBanka" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CekSenet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tip" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "tahsilEdilen" DECIMAL NOT NULL DEFAULT 0,
    "vadeTarihi" DATETIME NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'PORTFOYDE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CekSenet_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "Cari" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kategori" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "aciklama" TEXT,
    "belgeUrl" TEXT,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "aksiyon" TEXT NOT NULL,
    "hedefTip" TEXT NOT NULL,
    "hedefId" TEXT NOT NULL,
    "detay" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Cari_unvan_idx" ON "Cari"("unvan");

-- CreateIndex
CREATE INDEX "Cari_tip_idx" ON "Cari"("tip");

-- CreateIndex
CREATE INDEX "Islem_cariId_idx" ON "Islem"("cariId");

-- CreateIndex
CREATE INDEX "Islem_status_idx" ON "Islem"("status");

-- CreateIndex
CREATE INDEX "Islem_vadeTarihi_idx" ON "Islem"("vadeTarihi");

-- CreateIndex
CREATE INDEX "IslemKalemi_islemId_idx" ON "IslemKalemi"("islemId");

-- CreateIndex
CREATE INDEX "HesapHareketi_hesapId_idx" ON "HesapHareketi"("hesapId");

-- CreateIndex
CREATE INDEX "HesapHareketi_tarih_idx" ON "HesapHareketi"("tarih");

-- CreateIndex
CREATE INDEX "CekSenet_cariId_idx" ON "CekSenet"("cariId");

-- CreateIndex
CREATE INDEX "CekSenet_durum_idx" ON "CekSenet"("durum");

-- CreateIndex
CREATE INDEX "CekSenet_vadeTarihi_idx" ON "CekSenet"("vadeTarihi");

-- CreateIndex
CREATE INDEX "Gider_kategori_idx" ON "Gider"("kategori");

-- CreateIndex
CREATE INDEX "Gider_tarih_idx" ON "Gider"("tarih");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_hedefTip_hedefId_idx" ON "AuditLog"("hedefTip", "hedefId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
