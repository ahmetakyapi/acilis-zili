---
paths:
  - "components/motion/**"
  - "components/ui/RollingFigure*"
  - "components/ui/TickingFigure*"
  - "components/themes/RollingFigure*"
  - "lib/motion.ts"
  - "app/globals.css"
  - "components/**/*.module.css"
  - "app/**/*.module.css"
---

<!-- Yol kapsamlı kural (10 Kasım 2026). Eğri kuralı `.claude/rules/arayuz.md` → Görsel Dil'de; burada hareketin NE ZAMAN ve HANGİ yardımcıyla yapılacağı var. Gerekçeler yardımcıların kendi yorumlarında. -->

## Hareket: İlke

- **Nedeni tek cümleyle yazılamayan hareket eklenmez** (`app/globals.css` →
  "HAREKET DİLİ"). Hareket veriyi ÇİZEN öğededir: çizgi çizilir, şerit
  dolar, halka döner, rakam yuvarlanır. Panel ve metin kayarak girmez
  ("her öğede soluklaş-ve-yukarı-kay" yapay zekâ varsayılanı; 12 Ekim).
- **Sunucu son kareyi basar.** JS yoksa, hareket azaltılmışsa ya da öğe
  ilk ekrandaysa okuyucu bitmiş hâli görür. Giriş animasyonu ilk boyamayı
  saklamaz; ilk ekrandaki veri hareket yüzünden gecikmez.
- **Bir kez oynar.** Sonsuz döngü yalnız yerleşik canlı imlerde (nabız
  noktası, `LoadingMark`). Görünüme her girişte yeniden oynatma yok.
- **Yalnız kompozitör:** `transform`, `opacity`, çizim için `clip-path`,
  `stroke-dashoffset`, `scale`. Genişlik/yükseklik/konum canlandırılmaz
  (şerit `scaleX` ile dolar, `width` ile değil).
- **Süre kısa, çıkış girişten kısa:** mikro geri bildirim 120–200 ms,
  veri çizimi 450–900 ms, kademe (stagger) adımı 30–60 ms ve toplamı
  ~400 ms'yi aşmaz; çıkış `exitOf()` (`lib/motion.ts`).
- **Hareketi azaltan** son kareyi görür: genel blok süreyi sıfırlar ama
  KAYDIRMA güdümlü animasyon süreyi umursamaz, ayrıca kapatılır
  (`@media (prefers-reduced-motion: no-preference)` kapısı).
- **Hover'da kaldırma yok** (`.panel-hover` "zıplamaz"); geri bildirim ton
  ve kenarla, basışta hafif çökme. Derinlik gölgeyle kurulmaz.

## Katalog: Önce Bunlara Bak

| İhtiyaç | Yardımcı | Not |
|---|---|---|
| Mini grafik çizgisi çizilsin | `.spark-line` / `.spark-area` / `.spark-dot` (globals.css) | Kırpmayla açılır; kesik çizgi DEĞİL (ölçek tuzağı yorumda) |
| Şerit/çubuk dolsun | `.bar-fill` | `scaleX`, kaynak solda |
| Puan halkası | `.ring-fill` + `--ring-circumference` | `components/earnings/ScoreRing.tsx` |
| Panel belirişi, panel başlığının yükselişi | kendiliğinden (`.panel`, `h2`; `data-rise-scope`, `data-no-rise`) | Kaydırma güdümlü, JS yok |
| Ekranın altındaki figür görünce oynasın | `components/motion/PlayOnView.tsx` (`data-armed` → `data-play`) | Taban durum bitmiş figür |
| Akışla gelen sunucu panelinde kademeli giriş | `MotionExperience` + `data-motion-stagger` / `-draw` / `-reveal` (`components/motion/PremiumMotion.tsx`) | Öznitelik DOM'a yazılır, yeniden çizim yok |
| İlk ekranda yuvarlanan display sayı | `components/ui/RollingFigure.tsx` | CSS, sunucuda; ekranın altı için `components/themes/RollingFigure.tsx` |
| Canlı tazelenen fiyat | `components/ui/TickingFigure.tsx` | Ara değer YOK, yalnız değişen rakam döner |
| Logo listeden ayrıntı sayfasına uçsun | `MorphRecorder` / `MorphTarget` (`components/motion/Morph.tsx`) | `data-morph`, `data-morph-stage` |
| Bölüm gezgini, okuma ilerlemesi | `SectionNav`, `ScrollProgress` (`PremiumMotion.tsx`) | Çapa kimliği dönüşümlü kutunun DIŞINA |
| Sıralama değişince tablo satırları kaysın | `components/markets/RowFlip.tsx` | `data-row` anahtarı, yalnız `translate` |
| Uzayan panelde çizimler görünce oynasın | `components/today/home/DrawOnView.tsx` | `PlayOnView`ın %40 eşiği doldurucuyla uzayan panelde sağlanmayabiliyor |
| Sayfa geçişi | `app/(app)/template.tsx` → `.page-enter` | Kabuk yerinde kalır |
| Seçim imi (sekme, segment) | `SELECTION_TRANSITION` (`lib/motion.ts`) | Hedefinde durur, yaylanmaz |
| JS'te eğri | `EASE_BRAND`, `EASE_BRAND_POINTS` (`lib/motion.ts`) | `element.animate` CSS değişkeni çözmez |
| Hareket tercihi (istemci) | `components/motion/useMotionPreference.ts` | Açıkken değişen tercihi de yakalar |

Katalogda karşılığı varsa YENİSİ YAZILMAZ. Modül içinde yeni `@keyframes`
ancak o ekrana özgü bir çizim içinse; iki ekran aynı deseni istiyorsa
globals.css'e (ana oturum) terfi eder ve bu tabloya satır olarak girer.

## Tuzaklar (ölçüldü, yorumları yerinde)

- `overflow-hidden` taşıyan kap kaydırma kabıdır: içindeki öğede `view()`
  ilerlemez. Zaman çizelgesini kap ADIYLA yayınlar (`view-timeline: --rise`).
- Kırpık (`clip-path`) öğe kesişmiyor sayılır: gözlemci çizgiyi değil
  SVG'sini izler.
- `animation-range` uzunlukla (`entry 220px`), yüzdeyle değil: uzun panel
  ancak binlerce piksel sonra tamamlanırdı.
- Başsız Chrome çalışan animasyonu başa sarılmış karede çeker; yerleşimi
  `reducedMotion: "reduce"` ile çek, animasyonu `getAnimations()` ile say.
- Kökte `:has()` yok; saniyede bir değişen DOM'da tüm belge yeniden
  hesaplanır.
