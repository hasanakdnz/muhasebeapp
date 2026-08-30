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
| `npm run db:bakiye-yenile` | Cari bakiyelerini kaynak kayıtlardan yeniden hesaplar |
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

## Teklif (proforma)

Teklif satış ÖNCESİ bir belgedir, muhasebe kaydı değildir: kaydedilmesi cari
bakiyesini, KDV raporunu ve vade takibini **etkilemez**. İşlem olarak
saklansaydı gerçekleşmemiş bir satış deftere yazılır, müşterinin borcu haksız
yere artar ve beyan edilmemiş KDV rapora girerdi.

```
TASLAK ──► GONDERILDI ──► KABUL ──► ISLEME_DONUSTU  (kilitli)
   │            └──────► RED
   └──────────────────► RED
```

- Muhasebe **yalnızca** "Faturaya dönüştür" adımında başlar: teklif kalemleri
  bir SATIŞ işlemine yazılır ve cari bakiyesi o anda değişir. Fatura oluşturma
  ile teklifin kilitlenmesi TEK transaction'dadır — aksi halde ya bakiyesi
  artmış sahipsiz bir fatura ya da iki kez faturalanabilen bir teklif kalırdı.
- `ISLEME_DONUSTU` uç durumdur: teklif artık düzenlenemez ve silinemez.
- Numara yıl bazlıdır (`PRF-2026-0001`). Sıra, kayıt sayısından değil mevcut
  numaraların EN BÜYÜĞÜNDEN üretilir; aradan bir teklif silinince daha önce
  kullanılmış bir numara tekrar verilmez.
- KDV hesabı faturayla aynı fonksiyonları kullanır (`hesaplaIslemToplamlari`,
  `kdvDahilNete`), böylece teklifte görünen tutar ile faturaya dönüşünce oluşan
  tutar ayrışamaz.

**Çıktı ve paylaşım.** Belge `/(dashboard)/proformalar/[id]/yazdir` altında
HTML olarak üretilir, PDF tarayıcının "PDF olarak kaydet" çıktısıyla alınır —
raporlarla aynı gerekçe (aşağıya bakınız). WhatsApp ve e-posta bağlantıları
teklifi özetleyen hazır bir mesaj açar, PDF'i kullanıcı o mesaja ekler:
uygulama dışarıya dosya sunmadığı için hiçbir finansal evrak izinsiz bir dış
servise yüklenmez. Telefon numarası uluslararası biçime çevrilir; tanınmazsa
alıcısız bağlantı üretilir — yanlış kişiye teklif göndermektense alıcıyı
kullanıcının seçmesi daha güvenlidir.

Firma künyesi (ünvan, VKN, adres, IBAN, logo) **Ayarlar** ekranından girilir ve
teklif çıktısının başlığını oluşturur.

## İşlem kaydı (audit log)

Yöneticiye özel `/kayitlar` ekranı, geri alınamaz ve parasal sonucu olan
işlemleri gösterir: silmeler, ödeme/tahsilat, ciro ve durum değişiklikleri.
Sıradan okuma kaydedilmez — her şeyi kaydeden bir log okunmaz olur.

Kayıt, asıl işlem başarılı olduktan sonra action katmanından yazılır; asıl
işlemle aynı transaction'da **değildir** (veri katmanı fonksiyonları kendi
transaction'larını yönetiyor). Pratik sonucu: log yazımı başarısız olursa
kullanıcının işlemi geri alınmaz, hata sunucuya yazılır. Atomik denetim kaydı
gerekirse transaction'ın aşağıya taşınması gerekir.

## Roller (RBAC)

| | Personel | Yönetici |
|---|---|---|
| Kayıt girme, düzenleme, ödeme/tahsilat | ✓ | ✓ |
| **Silme** (cari, işlem, ödeme, çek/senet, tahsilat, hareket, gider, teklif) | — | ✓ |
| Ayarlar (firma künyesi) | — | ✓ |
| İşlem kaydı | — | ✓ |

Silme yönetici işidir: personel kayıt girer, hatayı yönetici temizler. Yetki iki
katmanda uygulanır — düğme personelde hiç render edilmez (`isAdmin()`), server
action ayrıca `adminVeyaHata()` ile doğrular. Guard hata FIRLATMAZ, action
sözleşmesine uyan bir sonuç döner; aksi halde personel silme düğmesine basınca
çökme ekranı görürdü.

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
- **Çek/senet — bakiye ÇEK ALINDIĞI ANDA işlenir:** Türkiye'deki standart
  uygulama (`101 Alınan Çekler / 120 Alıcılar`): müşteri borcuna karşılık çeki
  verdiğinde cari hesabı KAPANIR, risk çek portföyüne taşınır. `ALINAN` çek
  bakiyeyi düşürür, `VERILEN` çek yükseltir. **Tahsilat cari bakiyesine
  DOKUNMAZ** — o borç çek ele geçtiğinde zaten kapanmıştı; tahsilat parayı
  portföyden kasaya alan ayrı bir olaydır.

  Karşılıksız (`KARSILIKSIZ`) çıkan çekte borç GERİ GELİR: net etki yalnızca
  fiilen tahsil edilen kadardır. Kısmen tahsil edilip sonra yanan çekte de
  doğru sonucu verir — tahsil edilemeyen kısım borç olarak döner. Kayıt
  `PORTFOYDE`'ye geri alınırsa borç yeniden kapanır.

  > **Neden değişti.** Önceki sürümde etki tahsilat anında işleniyordu. O model
  > karşılıksız çekte düzeltme gerektirmemesi için seçilmişti, ama nadir durumu
  > kolaylaştırırken sık durumu bozuyordu: müşterinin çekle kapanmış borcu hem
  > cari alacağında hem çek portföyünde görünüyor, alacak ÇİFT SAYILIYORDU
  > (10.000'lik alacak panoda 20.000 çıkıyordu). Regresyon testleri
  > `tests/cek-cift-sayim.test.ts` içinde.

  Her tahsilat ayrı kayıttır ve `tahsilEdilen = Σ tahsilat` değişmezi
  `cekSenetiDogrula()` ile ölçülür. Kalandan fazla tahsilat engellenir. Şemada
  "kısmi tahsil" durumu olmadığı için kısmen tahsil edilmiş kayıt PORTFOYDE
  kalır; tutar tamamlanınca otomatik TAHSIL_EDILDI olur. `TAHSIL_EDILDI` elle
  seçilemez.
- **Ciro:** Alınan çek bir tedarikçiye devredilebilir. Ciro yalnızca HEDEF
  cariyi etkiler: ona olan borcumuz çekin tutarı kadar azalır. Çeki bize veren
  müşterinin bakiyesi ciroda DEĞİŞMEZ — onun borcu çeki verdiği anda zaten
  kapanmıştı. Hedef cari zorunludur ve ciro düz bir durum değişikliği değil,
  ayrı bir işlemdir (`ciroEt` / `ciroGeriAl`). Yalnızca portföydeki, hiç tahsil
  edilmemiş ALINAN çek ciro edilebilir.
- **Fatura ödemeleri ve ÇİFT SAYIM koruması:** `Islem.odenenTutar` = Σ IslemOdeme
  ve `status` bundan türetilir. Ödemenin cari bakiyesine etkisi KAYNAĞINA bağlıdır:
  `DIREKT` (nakit/banka) bakiyeyi düşürür; `CEK` kaynaklı ödeme bakiyeyi
  ETKİLEMEZ — o borç çek alındığında zaten kapanmıştı, tekrar düşülseydi çekle
  ödenen fatura bakiyeyi iki kez azaltırdı. Bir çek birden fazla faturaya
  bölüştürülebilir; dağıtılan toplam çek tutarını aşamaz.

  **Faturayı kapatan şey ÇEKİN KENDİSİDİR, tahsilatı değil.** Önceki
  `CEK_TAHSILATI` kaynağı bu yüzden kaldırıldı: çek modeli "alındığı anda işle"ye
  geçtiğinde cari hesap kapanıyor ama fatura, çek tahsil edilene kadar
  "bekliyor" kalıyordu — yaşlandırma raporu çekle kapanmış bir alacağı gecikmiş
  gösteriyordu. Artık çek doğrudan faturaya sayılır; tahsilat yalnızca kasa
  olayıdır.

  Eşleştirilmiş çek korunur: faturaya sayılmış bir çek karşılıksız
  işaretlenemez ve silinemez (önce eşleştirme kaldırılmalı). İzin verilseydi
  borç cariye geri dönerken fatura "ödendi" kalır, iki defter ayrışırdı.
- **Kasa/Banka entegrasyonu:** Çek tahsilatı, DİREKT fatura ödemesi ve gider,
  seçilen hesapta AYNI transaction içinde bir `HesapHareketi` üretir. Önce
  hiçbiri kasaya dokunmuyordu; kullanıcı aynı parayı iki kez girmek zorundaydı
  ve nakit akışı raporu gerçeği yansıtmıyordu.

  Yön tek yerde belirlenir (`lib/domain/kasa.ts`): alınan çek tahsilatı ve
  satış faturası ödemesi GİRİŞ, verilen çek ödemesi ve alış faturası ödemesi
  ÇIKIŞ, gider daima ÇIKIŞ. Üç modülde tekrarlansaydı biri ters yazıldığında
  sessizce yanlış bakiye oluşurdu.

  Hesap seçimi **opsiyoneldir**: boş bırakılırsa kasa hareketi oluşmaz ve eski
  davranış korunur. Zorunlu olsaydı hesap tanımlamamış kullanıcı hiçbir tahsilat
  giremezdi.

  Kaynak kaydı silinince kasa hareketi de aynı transaction'da silinir; tersi
  yönde, kaynağı olan bir hareket kasa ekranından **silinemez** (düğme kapalı,
  sunucu da reddeder) — silinseydi tahsilat kaydı dururken parası kasadan
  kaybolurdu. Gider güncellenirken hareket sil-yeniden yaz yöntemiyle
  yenilenir: tutar, tarih ve hesap hepsi değişebilir, hesap eklenmiş ya da
  kaldırılmış olabilir; tek tek karşılaştırmak dört ayrı durum demekti.

  Çek tahsilatından doğan fatura ödemesi kasaya İKİNCİ kez para sokmaz — o para
  tahsilat kaydedilirken zaten girmişti.
- **Cari ekstresi:** Cari kartı bakiyeyi oluşturan HER hareketi kronolojik ve
  yürüyen bakiyeyle gösterir (`cariEkstresiGetir`). Ekstre ile bakiye AYNI
  kaynaktan (`cariHareketleri`) türer — iki ayrı sorgu olsaydı biri güncellenip
  diğeri unutulduğunda sessizce ayrışırlardı. Ekstrenin son yürüyen bakiyesi
  saklanan bakiyeyle tutmazsa ekranda uyarı basılır (`ekstreMutabik`).
  Karşılıksız çek ekstrede İKİ satırdır — "çek alındı" (tam tutar) ve
  "karşılıksız çıktı" (tahsil edilemeyen kısım geri döner); tek satırlık net
  etki olan biteni anlatmazdı. CSV olarak indirilebilir.
- **Çekin ALINMA tarihi ayrı bir alandır** (`CekSenet.tarih`), vade değil: cari
  bakiyesi o anda değiştiği için ekstre buna göre sıralanır. Kayıt zamanı
  (`createdAt`) kullanılsaydı geriye dönük girilen çek ekstrede giriş gününe
  düşerdi. Aynı gerekçeyle karşılıksız işaretleme tarihi de saklanır
  (`karsiliksizTarihi`); `updatedAt` kullanılsaydı çekin herhangi bir alanı
  düzenlendiğinde ekstredeki geri dönüş satırı yer değiştirirdi.

- **Cari bakiyesinin dört kaynağı vardır:** satış/alış işlemleri, bu cariye ait
  çek/senet KAYITLARI, bu cariye ciro edilmiş çekler ve DİREKT fatura ödemeleri.
  Mutabakat dördünü birden sayar — yeni bir kaynak eklenirse `cariEtkileri()`
  güncellenmeli. Çek tarafındaki her mutasyon bakiyeyi artımlı aritmetikle
  değil `cariBakiyesiniYenile()` ile KAYNAKLARDAN yeniden hesaplar; böylece
  mutabakat fonksiyonuyla aynı kaynağı kullanır ve ikisi tanım gereği ayrışamaz.

  Bakiye kuralı değişirse mevcut kayıtlar eski kurala göre hesaplanmış kalır;
  `npm run db:bakiye-yenile` hepsini yeniden hesaplar ve sonucu mutabakatla
  doğrular. Kaynak kayıtlara dokunmaz, tekrar çalıştırmak zararsızdır.
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
- **Fatura yazımı tek yerde:** `islemYaz(tx, veri)` transaction İÇİ gövdedir;
  `islemOlustur` onu kendi transaction'ında sarar, proforma dönüşümü ise kendi
  transaction'ında çağırır. Prisma'da transaction iç içe açılamadığı için
  ayrıldı — iki çağıran da aynı KDV ve bakiye kurallarını kullanır.
- **Denetim detayı:** `AuditLog.detay` bir `Json` alanıdır; nesne DOĞRUDAN
  yazılır. `JSON.stringify` ile verilseydi Prisma bir kez daha kodlar ve
  veritabanında çift kodlanmış bir dize kalırdı. Ekranda ham enum gösterilmez
  (`KABUL` değil "Kabul edildi"); karşılığı bilinmeyen değer olduğu gibi
  gösterilir, kayıt hiçbir zaman gizlenmez.
- **Silme kuralı:** Muhasebe kaydı olan cari/hesap silinemez (şemada
  `onDelete: Restrict`); pasife alınır. Kaydı olmayan kayıtlar kalıcı silinebilir.
- **Tasarım token'ları:** Tek kaynak `app/globals.css` (`@theme`). Radius tek
  değerdir: `rounded-app` (8px), rozetler `rounded-full`.
