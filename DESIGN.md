---
name: Defter — Sakin ve Sade
colors:
  ink: '#14171C'
  ink-hover: '#000000'
  on-ink: '#FFFFFF'
  paper: '#FAFAF9'
  surface: '#FFFFFF'
  surface-muted: '#F1F1EF'
  border: '#E7E7E4'
  text: '#14171C'
  text-secondary: '#74767C'
  text-tertiary: '#A1A3A8'
  green: '#1E8E5A'
  green-tint: '#E4F4EB'
  red: '#D14B36'
  red-tint: '#FBEAE6'
  amber: '#C89A2E'
  amber-tint: '#F7EFDA'
typography:
  display-lg:
    fontFamily: 'IBM Plex Sans'
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: 'IBM Plex Sans'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: 'IBM Plex Sans'
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: 'IBM Plex Sans'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: 'IBM Plex Sans'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  label-md:
    fontFamily: 'IBM Plex Sans'
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  data-numeric:
    fontFamily: 'IBM Plex Mono'
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: 0px
rounded:
  sm: 0.375rem
  DEFAULT: 0.5rem
  md: 0.5rem
  lg: 0.75rem
  xl: 1rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-padding: 32px
  stack-gap: 16px
  sidebar-width: 232px
---

## Brand & Style

Sadelik, bu ürünün asıl işlevi. Kullanıcı burada saatlerce cari hesap, çek/senet
ve fatura takip edecek — göz yormayan, düşük kontrastlı, geniş boşluklu bir arayüz
uzun kullanımda fark yaratır. Kural basit: **renk sadece anlam taşıdığında kullanılır**
(para pozitif/negatif, durum), geri kalan her şey nötr gri tonlarda kalır. Dekoratif
hiçbir öğe yok; hiyerarşi tipografi ağırlığı, boşluk ve hizalamayla kurulur, kutu/gölge/
çizgiyle değil.

Tek bir yazı ailesi (IBM Plex Sans) — sadece ağırlık ve boyutla hiyerarşi kurulur.
Rakamlar için ayrı bir mono font var, bunun nedeni tamamen işlevsel: finansal
tablolarda basamakların hizalanması. Bunun dışında hiçbir "karakter" katmanı yok —
sistem sakin kalmak için kendini geri çeker.

## Colors

- **Ink (#14171C):** Metin, birincil buton, aktif durum. Tek güçlü renk bu —
  başka hiçbir yerde koyu/doygun renk kullanılmaz.
- **Paper (#FAFAF9) / Surface (#FFFFFF):** Arka plan ile kart yüzeyi arasında
  neredeyse fark edilmeyecek kadar düşük kontrast. Göz, renk geçişleriyle değil
  boşlukla yönlendirilir.
- **Border (#E7E7E4):** Çok açık, neredeyse görünmez bir çizgi — sadece gerektiğinde
  (tablo satırları, input) kullanılır. Kartlarda gölge veya çizgi yerine sadece
  `surface`/`paper` arasındaki ton farkı yeterli olabilir.
- **Green / Red / Amber:** Sadece finansal anlam için — sırasıyla pozitif (tahsilat,
  gelir), negatif (borç, gider, gecikme), bekleyen. Belirgin ve canlı tonlar —
  gözden kaçmamalı, bir bakışta "bu para pozitif mi negatif mi" sorusuna cevap
  vermeli. Yine de büyük renkli bloklar olarak değil, metin/ikon/rozet gibi
  küçük ve odaklı yüzeylerde kullanılır — canlılık, alanın küçük tutulmasıyla
  dengelenir.

## Typography

Tek aile: **IBM Plex Sans**. Büyük başlıklar SemiBold (600), gövde metni Regular
(400), etiketler Medium (500) + geniş harf aralığı. Bold (700) kullanılmaz —
kalın ağırlık gerginlik yaratır, bu sistemde en güçlü vurgu SemiBold'da durur.

Rakamlar (`data-numeric`, IBM Plex Mono) yalnızca finansal tutarlarda kullanılır;
bunun dışında her yerde Plex Sans.

## Layout & Spacing

Bol boşluk, az öğe. 8px grid ama önceki versiyona göre daha geniş boşluklar
(`container-padding` 32px, `stack-gap` 16px).

- **Sidebar:** 232px, **açık renkli** (`paper` zemin, koyu blok değil) — sadece
  aktif menü öğesi `surface-muted` zeminle hafifçe vurgulanır, ink renginde metin.
  Ayrım için sağında tek `border` çizgisi.
- **İçerik alanı:** Geniş kenar boşlukları, sayfada gereğinden fazla öğe sıkıştırılmaz —
  bir ekranda 3-4 net blok, karmaşık gruplamalardan kaçınılır.
- **Dashboard kartları:** 3-4 kolon, aralarında bol boşluk (`lg`, 24px+), kart
  içi yoğunluk düşük tutulur (az sayıda veri noktası, büyük okunaklı rakam).

## Elevation & Depth

Neredeyse düz. Gölge kullanımı minimumda.

1. **Flat:** Varsayılan.
2. **Kart:** `surface` zemin, gölge/çizgi yerine tercihen sadece `paper`den ton
   farkı. Gerekirse çok hafif 1px `border` — asla shadow.
3. **Modal/Dropdown (tek gerçek "yüzen" katman):** Çok yumuşak, düşük opaklıklı
   gölge (`0px 8px 24px rgba(20,23,28,0.08)`).

## Motion & Interaction

Hareket süslemeyle değil, **anlamla** sınırlı — bir şeyin değiştiğini, yüklendiğini
veya seçildiğini hissettirir, dikkat çekmek için değil. Sistem sakin kalır; hareket
sadece birkaç seçilmiş anda, tutarlı bir dille kullanılır.

**Zamanlama:**
- `fast` (120ms) — hover, basma, küçük durum değişiklikleri
- `base` (200ms) — panel açılma/kapanma, sekme geçişleri, badge durum değişimi
- `slow` (500ms) — dashboard rakamlarının sayarak değişmesi (aşağıya bakınız)
- Easing: girişlerde `ease-out`, çıkışlarda `ease-in`. Zıplama/bounce yok — bu
  sistemin "ciddiyetiyle" çelişir.

**Seçili anlar (sadece burada hareket var, başka yerde yok):**
- **Dashboard rakamları:** Sayfa yüklendiğinde veya bir değer güncellendiğinde,
  büyük özet rakamlar (`display-lg`, `data-numeric`) 0'dan veya önceki değerden
  hedefe doğru sayarak animasyonla değişir (`slow`, 500ms, ease-out). Bu ürünün
  "canlı" hissettiği tek ve en önemli an — abartılmaz, sadece bu rakamlarda kullanılır.
- **Sidebar aktif gösterge:** Menü öğeleri arası geçişte, vurgu (aktif arka plan)
  bir öğeden diğerine kayarak hareket eder (kaybolup yeniden belirmez), `base` süresinde.
- **Yeni tablo satırı:** Bir işlem eklendiğinde ilgili satır `surface-muted`
  tonunda kısa bir vurguyla belirir ve ~600ms içinde normale söner — göze
  "az önce buraya bir şey eklendi" der, alarm rengi kullanmadan.
- **Hover:** Kartlarda/satırlarda sadece zemin tonu değişir (`surface` → `surface-muted`),
  büyüme/gölge/kalkma efekti yok.
- **Yükleme durumları:** Spinner yerine skeleton (içeriğin taslak hali) tercih
  edilir — nihai içeriğin şeklini önceden gösterir, daha sakin bir bekleme hissi verir.
- **Bildirim/toast:** Köşeden yumuşak kayarak girer, birkaç saniye sonra sessizce
  kaybolur (fade), otomatik.

**Kısıtlar:**
- Sayfa geçişlerinde büyük/gösterişli animasyon yok — içerik doğrudan görünür,
  en fazla hafif bir fade (150ms).
- `prefers-reduced-motion` her zaman saygı görür: bu tercih açıksa sayma
  animasyonu dahil tüm hareketler anında/statik hale gelir.
- Dekoratif animasyon (arka plan hareketleri, parallax, sürekli dönen/nabız
  atan öğeler) kullanılmaz.


## Shapes

Tek tutarlı radius ölçeği — kart, buton, input hepsi aynı (`DEFAULT`, 8px).
Farklılaşma yaratmaz, tutarlılık sakinliğe hizmet eder. Sadece rozetler `full` (pill).

## Components

### Buttons
Önceki versiyona göre daha büyük ve tıklanabilirliği belirgin — küçük/çekingen
butonlar sakinlikle karıştırılmamalı.
- **Boyut:** Yükseklik 44px, yatay dolgu 24px, metin `body-lg` (15px) SemiBold (600).
  İkonlu butonlarda ikon 18px, metinle 8px boşluk.
- **Primary:** Solid `ink`, beyaz metin, 8px radius. Gölgesiz.
- **Secondary:** Şeffaf zemin, 1.5px `border` (önceki 1px'ten biraz daha belirgin).
- **Text:** Düşük öncelikli aksiyonlar için, arka plansız, buton yüksekliği aynı
  kalır (44px tıklama alanı korunur, sadece görsel çerçeve yok).
- Üç tipten fazlası yok — varyant çeşitliliği azaltılır.

### Status Badges (Durum Rozetleri)
Sade pill: `full` radius, ilgili rengin `-tint` zemini, aynı rengin koyu tonunda
küçük harfli (uppercase DEĞİL) `label-md` metin. Kenarlık yok, gölge yok, döndürme
yok — göz bir bakışta okusun, dikkat dağıtmasın.
- "Ödendi" → yeşil tint · "Gecikti" → kırmızı tint · "Bekliyor" → amber tint

### Cards (Kartlar)
`surface` zemin, 8px radius, çizgisiz veya en fazla 1px `border`. 24-32px iç dolgu —
önceki versiyona göre daha ferah.

### Input Fields (Giriş Alanları)
1px `border`, 8px radius, etiket üstte `label-md`. Focus: sadece `ink` renginde
ince 1.5px kenarlık — halka/gölge efekti yok.

### Ledger Tables (Tablo Görünümleri)
İşlem listeleri, ekstreler, kasa hareketleri için:
- Satırlar arası çok ince `border` çizgisi, zebra yok, dolgu bol (satır başına
  en az 12px dikey boşluk) — sıkışık tablo hissi verilmez.
- Tutar sütunu sağa yaslı, `data-numeric`. Gelir `+` ile yeşil, gider `-` ile kırmızı;
  başka hiçbir sütunda renk kullanılmaz.
- Hover: `surface-muted` — çok hafif, dikkat çekmeden konum belirtir.

### Iconography
Lucide, 1.5px stroke (önceki 2px'ten daha ince — daha hafif, daha az baskın).
Sadece işlevsel yerlerde; dekoratif ikon kullanılmaz.
