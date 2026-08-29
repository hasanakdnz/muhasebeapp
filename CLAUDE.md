@DESIGN.md

# Proje

Türkiye'deki KOBİ'ler için finans/ön muhasebe web uygulaması. Cari hesap, satış/alış,
kasa-banka, çek-senet, gider takibi, raporlama ve rol bazlı yetkilendirme içerir.

Faz bazlı geliştiriliyor — detaylı plan, veritabanı şeması ve klasör yapısı için
**ROADMAP.md** dosyasına bak. Her fazı ayrı iste: *"ROADMAP.md dosyasındaki Faz 2'yi uygula."*

# Teknoloji

- Next.js 15 (App Router, TypeScript)
- **Veritabanı: SQLite (geliştirme)** — PostgreSQL'e geçiş ayrı bir ileri faz (Faz 9),
  şimdilik gündeme getirilmeyecek, ekstra kurulum/şifre gerektirmez
- Prisma
- Auth.js (RBAC: Admin / Personel)
- Tailwind CSS + shadcn/ui (token'lar DESIGN.md'den — bkz. yukarıdaki import)
- Zod + React Hook Form
- Recharts (grafikler)

# Komutlar

```
npm run dev          # geliştirme sunucusu
npm run build         # production build — her fazdan sonra hatasız geçmeli
npm run typecheck      # TypeScript kontrolü
npm test               # test suite
npx prisma migrate dev # şema değişikliklerini uygula
```

# Kod Stili

- Server Component'leri varsayılan kullan, sadece etkileşim gereken yerlerde `"use client"`
- Form validasyonu her zaman Zod şeması ile, hem client hem server tarafında
- Para birimi hesaplamalarında `Decimal` tipini kullan, `number`/float ile çarpma-bölme yapma
  (yuvarlama hataları finansal veri için kabul edilemez)
- Türkçe UI metni, İngilizce değişken/fonksiyon isimleri
- Finansal tutarlar UI'da HER ZAMAN `data-numeric` (IBM Plex Mono) stiliyle gösterilir —
  bkz. DESIGN.md. Marka rengi (ink) asla para tutarlarının rengi olarak kullanılmaz;
  sadece green (pozitif) / red (negatif) / amber (bekleyen) — hepsi mat/kısık tonlarda,
  büyük renkli bloklar değil küçük yüzeylerde (metin, ikon, ince rozet)

# Workflow ve Doğrulama

- Her faz sonunda `npm run build` ve `npm run typecheck` çalıştır, hata varsa düzelt
- **Finansal mantık için (KDV hesaplama, kısmi tahsilat, bakiye güncelleme) mutlaka
  test yaz ve `npm test` ile çalıştır — testler geçmeden faz tamamlanmış sayılmaz.**
  Bu, ROADMAP.md'de her faz için ayrıca not edilmiştir.
- Kısmi tahsilat gibi kritik mantığı değiştiren fazlarda, işi bitirdikten sonra
  ayrı bir subagent ile diff'i ROADMAP.md'deki ilgili faza karşı gözden geçirt
  (örn: *"Bir subagent kullanarak Faz 4 diff'ini ROADMAP.md'deki gereksinimlere göre incele"*)
- Commit mesajları açıklayıcı olsun; her faz kendi commit'i / PR'ı olsun

# Notlar

- Bu bir muhasebe/finans uygulaması — veri bütünlüğü UI cilasından önemli.
  Belirsiz bir iş kuralıyla karşılaşırsan (örn. kısmi ödeme sonrası durum geçişi)
  varsayım yapıp geçme, sor.
- PostgreSQL, bulut veritabanı, connection string veya benzeri altyapı konuları şu an
  gündemde değil — SQLite yeterli. Bu konu açılırsa ROADMAP.md Faz 9'a ertelenmeli.
