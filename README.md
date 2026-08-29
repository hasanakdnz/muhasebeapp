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

## Raporlar ve dışa aktarım

Dört rapor: KDV, yaşlandırma (aging), kasa/banka ekstresi, satış performansı.
Dönem URL'de taşınır — rapor paylaşılabilir ve yer imine eklenebilir.

- **Excel:** CSV olarak indirilir. Türkçe Excel'in doğru açması için ayraç
  NOKTALI VİRGÜL ve dosya başında UTF-8 BOM vardır; tutarlar Türkçe ondalık
  ayracıyla yazılır. Gerçek .xlsx ek bir kütüphane gerektirir, gerekirse
  sonradan eklenebilir.
- **PDF:** Ayrı bir PDF kütüphanesi yerine baskı stili kullanılır
  (`@media print`): "PDF / Yazdır" butonu tarayıcı baskısını açar, ekran öğeleri
  (menü, filtreler, butonlar) gizlenir ve çıktı DESIGN.md tipografisini korur.
- **Yaşlandırma kovaları:** 0-30 / 31-60 / 60+ gün. "60+" 60'tan BÜYÜK demektir;
  60. gün 31-60 kovasındadır. Vadesi gelmemiş tutar ayrı gösterilir, yaşlandırılmaz.
  Yaşlandırma tabanı vade tarihidir; vade girilmemişse belge tarihi kullanılır.

## Vade bildirimi (cron)

Vadesi geçen/yaklaşan çek-senetleri yöneticilere bildiren job dış bir
zamanlayıcı tarafından çağrılır. `.env` içindeki `CRON_SECRET` tanımlı değilse
uç nokta devre dışıdır (kapalı başarısız olur).

```bash
curl -H "Authorization: Bearer $CRON_SECRET"   http://localhost:3000/api/cron/vade-bildirimi
```

Gönderim şimdilik konsola yazar (bkz. `lib/bildirim.ts`). Gerçek SMTP eklemek
için yeni bir `BildirimGondericisi` yazıp `aktifGonderici()` içinde seçmek yeterli.

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
- **KDV:** `IslemKalemi.birimFiyat` DAİMA KDV hariç (net) saklanır — şemada
  dahil/hariç bayrağı yok, saklamanın tek anlamı olmalı. Arayüzdeki "KDV dahil
  giriyorum" seçeneği fiyatı kaydetmeden önce net'e çevirir. KDV, e-Fatura
  pratiğindeki gibi SATIR bazında kuruşa yuvarlanır; genel toplam bu yuvarlanmış
  satırlardan üretilir, böylece toplam ekranda görünen satırlarla uyuşur.
- **Cari bakiyesi:** `Cari.bakiye` yürüyen bakiyedir ve HER ZAMAN
  `acilisBakiyesi + Σ(işlem etkisi)` değerine eşittir. Elle düzenlenmez; açılış
  bakiyesi değişirse yeniden hesaplanır. `cariBakiyesiniDogrula()` mutabakatı ölçer.
  Satış bakiyeyi artırır (cari size borçlanır), alış azaltır.
- **Çek/senet ve kısmi tahsilat:** Kayıt cari bakiyesini DEĞİŞTİRMEZ; borç para
  fiilen tahsil edildikçe kapanır. Böylece karşılıksız çıkan çekte düzeltme
  gerekmez — borç zaten azalmamıştır. `ALINAN` tahsil edilince cari bakiyesi
  düşer, `VERILEN` ödenince yükselir. Her tahsilat ayrı kayıttır ve
  `tahsilEdilen = Σ tahsilat` değişmezi `cekSenetiDogrula()` ile ölçülür.
  Kalandan fazla tahsilat engellenir. Şemada "kısmi tahsil" durumu olmadığı için
  kısmen tahsil edilmiş kayıt PORTFOYDE kalır; tutar tamamlanınca otomatik
  TAHSIL_EDILDI olur. `TAHSIL_EDILDI` elle seçilemez.
- **Ciro:** Alınan çek bir tedarikçiye devredilebilir. Ciro İKİ cari bakiyesini
  birden etkiler — çeki veren müşterinin borcu kapanır, çekin devredildiği
  cariye olan borcumuz aynı tutarda azalır. Bu yüzden hedef cari zorunludur ve
  ciro düz bir durum değişikliği değil, ayrı bir işlemdir (`ciroEt` /
  `ciroGeriAl`). Yalnızca portföydeki, hiç tahsil edilmemiş ALINAN çek ciro edilebilir.
- **Fatura ödemeleri ve ÇİFT SAYIM koruması:** `Islem.odenenTutar` = Σ IslemOdeme
  ve `status` bundan türetilir. Ödemenin cari bakiyesine etkisi KAYNAĞINA bağlıdır:
  `DIREKT` (nakit/banka) bakiyeyi düşürür; `CEK_TAHSILATI` kaynaklı ödeme
  bakiyeyi ETKİLEMEZ — o para çek tahsilatı kaydedilirken zaten düşülmüştür,
  tekrar düşülseydi çekle ödenen fatura bakiyeyi iki kez azaltırdı. Bir tahsilat
  birden fazla faturaya bölüştürülebilir; dağıtılan toplam tahsilat tutarını aşamaz.
- **Cari bakiyesinin dört kaynağı vardır:** satış/alış işlemleri ve çek/senet
  tahsilatları, ciro edilen çekler (hem veren hem alan tarafta) ve DİREKT fatura
  ödemeleri. Mutabakat dördünü birden sayar — yeni bir kaynak eklenirse
  `cariEtkileri()` güncellenmeli.
- **Gider ve KDV:** `Gider.tutar` KDV DAHİL toplamdır (fişin üzerindeki rakam);
  KDV bu tutarın İÇİNDEN ayrılır (`tutar × oran / (100 + oran)`). Satış tarafında
  KDV matrahın ÜSTÜNE eklenir — ikisi birbirinin tersidir ve testle sabitlenmiştir.
  KDV daima sunucuda hesaplanır, istemciden gelen değere güvenilmez.
- **Belge deposu:** ROADMAP Faz 5'te S3 yazıyor; CLAUDE.md bulut altyapısını
  kapsam dışı bıraktığı için (SQLite ile aynı gerekçe) yerel dosya sistemi
  kullanılıyor. Tüm erişim `lib/storage.ts` arkasında — S3'e geçiş yalnızca bu
  dosyayı değiştirir. Güvenlik: rastgele depo anahtarı (kullanıcı dosya adı yola
  girmez), içerik imzası (magic bytes) denetimi, dizin geçişine kapalı anahtar
  kalıbı, oturum zorunlu servis rotası, `nosniff` + kısıtlayıcı CSP.
  `lib/storage.ts` `server-only` ile işaretlidir; client'a sızarsa build kırılır.
- **Vade takibi:** Gün karşılaştırması TAKVİM GÜNÜ üzerinden yapılır; vade gün
  başına kaydedildiği için düz zaman damgası karşılaştırması bugün vadesi gelen
  kaydı saat 00:01'den itibaren "gecikmiş" gösterirdi. Vade rozetleri YALNIZCA
  çek/senette gösterilir: `Islem.odenenTutar`/`status` henüz güncellenmediğinden
  fatura bazında ödeme durumu bilinmiyordu. Fatura ödeme eşleştirmesi eklendikten
  sonra bu bilgi mevcut; fatura vade rozetleri Faz 7 raporlarıyla birlikte ele alınacak.
- **Silme kuralı:** Muhasebe kaydı olan cari/hesap silinemez (şemada
  `onDelete: Restrict`); pasife alınır. Kaydı olmayan kayıtlar kalıcı silinebilir.
- **Tasarım token'ları:** Tek kaynak `app/globals.css` (`@theme`). Radius tek
  değerdir: `rounded-app` (8px), rozetler `rounded-full`.
