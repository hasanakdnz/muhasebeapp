# Muhasebe

Türkiye'deki KOBİ'ler için finans/ön muhasebe web uygulaması.

Faz bazlı geliştiriliyor — plan için **ROADMAP.md**, görsel dil için **DESIGN.md**,
genel kurallar için **CLAUDE.md**.

## Kurulum

```bash
npm install                 # postinstall Prisma client'ı üretir
cp .env.example .env        # AUTH_SECRET'i doldurun: npx auth secret
npx prisma migrate dev      # SQLite şemasını uygular
npm run db:seed             # geliştirme kullanıcılarını ekler
npm run dev
```

### Geliştirme hesapları (yalnızca yerel)

| E-posta | Şifre | Rol |
| --- | --- | --- |
| `admin@muhasebe.local` | `Admin1234!` | ADMIN |
| `personel@muhasebe.local` | `Personel1234!` | PERSONEL |

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production build — her fazdan sonra hatasız geçmeli |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest test suite |
| `npm run db:migrate` | Şema değişikliklerini uygular |
| `npm run db:seed` | Geliştirme verisini yükler |
| `npm run db:studio` | Prisma Studio |

## Mimari notlar

- **Veritabanı:** SQLite (`prisma/dev.db`). PostgreSQL'e geçiş ROADMAP.md Faz 9.
  Prisma 7 driver adapter zorunlu kıldığı için `@prisma/adapter-better-sqlite3`
  kullanılıyor; geçişte yalnızca `lib/prisma.ts` içindeki adapter değişecek.
- **Auth:** Auth.js v5, Credentials provider, JWT oturum (Credentials veritabanı
  oturumunu desteklemez). Yetki politikası tek yerde: `lib/rbac.ts`.
- **Edge/Node ayrımı:** `middleware.ts` Edge runtime'da çalışır ve Prisma'ya
  dokunamaz; bu yüzden config `lib/auth.config.ts` (edge-safe) ve `lib/auth.ts`
  (provider'lar, Node) olarak ikiye ayrılmıştır.
- **Para birimi:** `lib/money.ts`. Tüm hesap ve biçimlendirme `Decimal` üzerinden
  yapılır, float'a hiç düşülmez — `Intl.NumberFormat` `number` aldığı için
  kullanılmaz. Tutarlar UI'da her zaman `data-numeric` ile gösterilir.
- **Kasa/Banka bakiyesi:** `KasaBanka.bakiye` yürüyen bakiyedir ve HER ZAMAN
  `Σ HesapHareketi.tutar` değerine eşit kalır. Hareket ekleme/silme aynı
  transaction içinde bakiyeyi de günceller; `hesapBakiyesiniDogrula()` mutabakatı
  kontrol eder ve testlerde bu değişmez doğrulanır. Açılış bakiyesi doğrudan
  yazılmaz, bir açılış hareketi olarak kaydedilir.
- **Silme kuralı:** Muhasebe kaydı olan cari/hesap silinemez (şemada
  `onDelete: Restrict`); pasife alınır. Kaydı olmayan kayıtlar kalıcı silinebilir.
- **Tasarım token'ları:** Tek kaynak `app/globals.css` (`@theme`). Radius tek
  değerdir: `rounded-app` (8px), rozetler `rounded-full`.
