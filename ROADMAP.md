# ROADMAP.md — Faz Planı ve Teknik Detaylar

> Bu dosya otomatik yüklenmez. Her faza başlarken Claude Code'a şu şekilde
> referans ver: **"ROADMAP.md dosyasındaki Faz 1'i uygula."**
> Genel proje kuralları için CLAUDE.md dosyasına bakılır.
> Görsel tasarım için DESIGN.md dosyasına bakılır (CLAUDE.md'de otomatik import edilir).

---

## Veritabanı Şeması (Prisma taslağı — çekirdek modeller)

```prisma
enum Role {
  ADMIN
  PERSONEL
}

enum CariTipi {
  MUSTERI
  TEDARIKCI
  HER_IKISI
}

enum IslemTipi {
  SATIS
  ALIS
}

enum OdemeStatusu {
  ODENDI
  KISMI_ODENDI
  BEKLIYOR
  IPTAL
}

enum CekSenetTipi {
  CEK
  SENET
}

enum CekSenetDurumu {
  PORTFOYDE
  CIRO_EDILDI
  TAHSIL_EDILDI
  KARSILIKSIZ
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role     @default(PERSONEL)
  createdAt DateTime @default(now())
  auditLogs AuditLog[]
}

model Cari {
  id           String   @id @default(cuid())
  unvan        String
  vknTckn      String?
  vergiDairesi String?
  tip          CariTipi
  telefon      String?
  email        String?
  adres        String?
  bakiye       Decimal  @default(0) // pozitif: alacak, negatif: borç
  islemler     Islem[]
  cekSenetler  CekSenet[]
  createdAt    DateTime @default(now())
}

model Islem {
  id          String        @id @default(cuid())
  tip         IslemTipi
  cariId      String
  cari        Cari          @relation(fields: [cariId], references: [id])
  kalemler    IslemKalemi[]
  toplamTutar Decimal
  kdvTutari   Decimal
  status      OdemeStatusu  @default(BEKLIYOR)
  odenenTutar Decimal       @default(0)
  vadeTarihi  DateTime?
  createdAt   DateTime      @default(now())
}

model IslemKalemi {
  id       String  @id @default(cuid())
  islemId  String
  islem    Islem   @relation(fields: [islemId], references: [id])
  urunAdi  String
  miktar   Decimal
  birimFiyat Decimal
  kdvOrani Decimal
}

model KasaBanka {
  id       String   @id @default(cuid())
  ad       String
  tip      String   // "KASA" | "BANKA"
  bakiye   Decimal  @default(0)
  hareketler HesapHareketi[]
}

model HesapHareketi {
  id          String     @id @default(cuid())
  hesapId     String
  hesap       KasaBanka  @relation(fields: [hesapId], references: [id])
  tutar       Decimal    // + giriş, - çıkış
  aciklama    String?
  tarih       DateTime   @default(now())
}

model CekSenet {
  id          String          @id @default(cuid())
  tip         CekSenetTipi
  cariId      String
  cari        Cari            @relation(fields: [cariId], references: [id])
  tutar       Decimal
  tahsilEdilen Decimal        @default(0)
  vadeTarihi  DateTime
  durum       CekSenetDurumu  @default(PORTFOYDE)
  createdAt   DateTime        @default(now())
}

model Gider {
  id         String   @id @default(cuid())
  kategori   String
  tutar      Decimal
  aciklama   String?
  belgeUrl   String?  // fiş/dekont görseli
  tarih      DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  aksiyon   String   // "DELETE", "UPDATE", "PARTIAL_PAYMENT" vb.
  hedefTip  String   // "Islem", "CekSenet" vb.
  hedefId   String
  detay     Json?
  createdAt DateTime @default(now())
}
```

Bu şema başlangıç noktası — ilerledikçe genişletilecek (Proforma modeli,
Bildirim modeli, RolYetkisi tablosu vb.).

---

## Proje Klasör Yapısı

```
/app
  /(auth)/login
  /(dashboard)/dashboard
  /(dashboard)/cariler
  /(dashboard)/islemler        # satış/alış
  /(dashboard)/kasa-banka
  /(dashboard)/cek-senet
  /(dashboard)/giderler
  /(dashboard)/raporlar
  /(dashboard)/ayarlar
  /api/...
/components
  /ui                          # shadcn bileşenleri (DESIGN.md token'larına göre özelleştirilmiş)
  /layout                      # ink-renkli sidebar, header
  /dashboard
  /cari
  /islem
/lib
  /prisma.ts
  /auth.ts
  /validations                 # zod şemaları
/prisma
  schema.prisma
  seed.ts
```

---

## Faz 0 — Temel Kurulum

- Next.js + TypeScript + Tailwind + shadcn/ui kurulumu
- **Tailwind config'e DESIGN.md'deki renk/tipografi/spacing/radius token'larını işle**
  (Fraunces, IBM Plex Sans, IBM Plex Mono fontlarını `next/font/google` ile ekle)
- **Veritabanı: SQLite ile başla** (`prisma/schema.prisma` içinde `provider = "sqlite"`,
  `.env`'de `DATABASE_URL="file:./dev.db"`). Bulut ortamında ekstra kurulum/şifre
  gerektirmediği için geliştirme fazında bu varsayılan. PostgreSQL'e geçiş ileride
  ayrı bir adımda yapılacak, şimdi konu edilmeyecek.
- Prisma migration (yukarıdaki şema)
- Auth.js ile giriş sistemi + RBAC (Admin/Personel)
- Sidebar (açık/paper renginde, 232px, DESIGN.md layout kurallarına göre) + header
- DESIGN.md'deki Motion & Interaction bölümündeki süre/easing token'larını Tailwind
  config'e veya bir animasyon yardımcı dosyasına (`lib/motion.ts`) işle
- **Test altyapısı:** Vitest kur (`npm install -D vitest`), `package.json`'a
  `"test": "vitest run"` script'i ekle
- **Typecheck script:** `package.json`'a `"typecheck": "tsc --noEmit"` script'i ekle

**Doğrulama:** `npm run build`, `npm run typecheck` ve `npm test` (boş de olsa) hatasız
çalışmalı; giriş yapıp boş dashboard'u görebilmeli; sidebar ve temel renkler DESIGN.md'ye
uygun görünmeli (fintech mavisi değil, ink/paper/ledger-green paleti).

## Faz 1 — Cari Hesap Yönetimi

- Cari CRUD (liste, detay, ekle/düzenle)
- Cari kartı: iletişim bilgileri, VKN/TCKN, bakiye
- Açık hesap takibi ekranı
- Bakiye gösterimlerinde `data-numeric` (Plex Mono) kullan

**Doğrulama:** Cari ekle → düzenle → sil işlemleri için test yaz ve çalıştır.

## Faz 2 — Kasa/Banka Temel Takip

- Kasa/Banka hesap tanımlama
- Manuel giriş/çıkış hareketleri
- Bakiye hesaplama mantığı

**Doğrulama:** Bakiye hesaplama için birim test (giriş/çıkış kombinasyonları).

## Faz 3 — Satış/Alış İşlemleri + Dashboard

- Hızlı işlem kaydı formu (ürün/hizmet, KDV hesaplama)
- Dashboard özet kartları (Kasa, Banka, Alacak, Borç, Satış, Alış) — sade, tek
  büyük rakam + etiket, DESIGN.md kart stiline göre
- **Özet kart rakamları DESIGN.md'deki "sayarak değişme" animasyonuyla gösterilir**
  (sayfa yüklendiğinde 0'dan hedefe, `prefers-reduced-motion` durumunda anında)
- Nakit akışı grafiği

**Doğrulama:** KDV hesaplama için test (farklı oranlarla), cari bakiye güncelleme testi.

## Faz 4 — Çek/Senet Yönetimi

- Çek/senet CRUD ve durum takibi — durumlar DESIGN.md'deki "Status Badge" bileşeniyle gösterilecek
- **Kısmi tahsilat/ödeme mantığı — kritik iş kuralı, mutlaka test kapsamında**

**Doğrulama:** Kısmi tahsilat senaryoları için test yaz: tam tahsilat, kısmi tahsilat,
birden fazla kısmi tahsilat, cari bakiyeye yansıma. Bu faz finansal doğruluk
açısından en riskli faz — testler geçmeden bir sonraki faza geçilmemeli.

## Faz 5 — Masraf Yönetimi

- Gider CRUD, kategorizasyon
- Belge/dekont yükleme (S3)
- (İleri faz) OCR entegrasyonu

## Faz 6 — Vade Takibi ve Bildirimler

- Görsel rozetler (vadesi yaklaşan/geçen) — Status Badge bileşeni, `red`/`amber`
- E-posta bildirim cron job'u

## Faz 7 — Raporlar

- KDV raporu, Aging (yaşlandırma) raporu
- Kasa/Banka ekstresi, satış performans raporu
- Excel/PDF dışa aktarım
- Tüm tablo görünümleri "Ledger Table" bileşenini kullanmalı (DESIGN.md)

**Doğrulama:** Aging raporu kategorilendirme testi (0-30/31-60/60+ gün sınırları).

## Faz 8 — Proforma, Audit Log, Cilalama

- PDF proforma şablonu (logo/kaşe alanı içerir, ancak PDF şablonunun kendisi de
  DESIGN.md'nin sade/az renkli diline uygun olmalı — gösterişli çerçeve/motif yok)
- WhatsApp/e-posta paylaşım
- Audit log ekranı
- RBAC ince ayarları, genel UI cilası

## Faz 9 — (İleri Faz) PostgreSQL'e Geçiş

- SQLite'tan PostgreSQL'e geçiş — Neon.tech veya benzeri bulut PostgreSQL servisi
- `prisma/schema.prisma`'da provider değişikliği, migration'ların yeniden çalıştırılması
- Bu faz sadece uygulama işlevsel olarak tamamlandıktan sonra, üretime hazırlanırken ele alınacak
