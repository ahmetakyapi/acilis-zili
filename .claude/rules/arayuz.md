---
paths:
  - "app/**/*.tsx"
  - "app/**/*.css"
  - "components/**"
  - "lib/ink/**"
  - "lib/article-blocks.ts"
  - ".impeccable/**"
---

<!-- Yol kapsamlı kural: eşleşen bir dosya okunduğunda/düzenlendiğinde yüklenir. Kaynak: kök CLAUDE.md'den taşındı (8 Kasım 2026); kural metni aynen korundu. -->

## Ekran Düzeni: Her Ekranda Aynı Sıra

1. **Başlık** — `PageHeader`: ad, tek cümle açıklama, sağda tek denetim.
   **Üst künye/kicker YOK** (sahibinin isteği, 9 Ekim 2026: "hem okunmuyor
   hem kötü görünüyor"). Başlığa ait bilgi (tarih, kurum, kategori) başlığın
   ALTINA iner. Gerekçe `components/ui/primitives.tsx` → `PageHeader`.
2. **Künye/seçim şeridi** — şirket kimliği, seçili semboller, kapak.
3. **Ana görsel** — tek grafik/harita; ikincisi ölçü ızgarasının altına.
4. **Ölçü ızgarası** — yan yana ölçüler AYNI HATTA biter; birim sayıdan
   kopmaz (`MONEY_GAP`, `tieFigures` — `lib/utils.ts`).
5. **Metin** — yorum, değerlendirme, senaryo.
6. **Künyeler/uyarılar** — panelin İÇİNDE, hairline ile ayrılmış düz
   paragraf; uyarı için yeni kutu açılmaz.
7. **`DataStamp`**, sonra **`GuideHint`**.

- **Her panelin `h2`si var** — kalıp `PanelHeader` (kutu değil, ton).
- **Karşılaştırılan büyüklük bir de ÇİZGİ olarak okunur**
  (`components/markets/CompareScale.tsx`). Çubuk büyüklüktür, yargı değil:
  renk yalnız işaretten gelir; karşılaştırılamayan ölçüde (farklı hisse
  fiyatları) çubuk HİÇ basılmaz.
- **Kaydırma saklanmaz.** Sığmayan tablo `table-fixed` ile kaba zorlanmaz
  (değer komşu hücreye biner); taban genişlik + kaydırma + sabit etiket
  sütunu + "devamı var" işareti.
- **Büyük sayfalar panellere bölünür**, yeni panel kendi dosyasında:
  `app/(app)/hisse/[symbol]/_panels/`, `components/today/home/`,
  `components/earnings/report/`.

## Düzen: Ölçmeden Değiştirme

- Boşluk/yerleşim kararı tahminle verilmez: ölç, değiştir, **ölçümü yoruma
  yaz**. Kalıcı tarama `npm run smoke` (390/1280, iki dil); geçici ölçüm
  betikleri `.tmp-*.mjs` (gitignore'da, commit'lenmez). Yatay taşma düzenli
  kontrol edilir.
- **Başsız Chrome CSS animasyonunu yanlış yakalar:** `el.screenshot()` çalışan
  `animation`ı başa sarılmış karede çeker (10 Ekim, sektör silueti basık
  göründü). Yerleşimi `prefers-reduced-motion: reduce` taklidiyle ya da
  `headless: false` ile çek; animasyonu sayıyla (`getAnimations()`) doğrula,
  görüntüyle değil.
- **İki kolona `justify-between` konmaz** — fark panel aralarına dağılır,
  aralık öteki kolonun boyuna bağlanır. Aralık hep `gap-5`.
- **Boşluk esnetilmez, doldurulur** — iki yönlü: sunucu tavan kadar satır
  basar, fazlası `hidden` + `data-fill`; `components/today/FillColumn.tsx`
  kısa kolonu ölçüp sığanı açar. JS kapalıyken taban liste kalır.
- **Kolonun dibi kutusunun dibi değil, SON ÇOCUĞUN dibi** (ızgara satırı
  kolonları eşit gerer). Aynı nedenle gözlemci kolonu değil PANELLERİ izler;
  yoksa sonradan inen panelde `ResizeObserver` hiç ateşlenmez.
- **Kökte `:has()` yok** — `html:has()` her DOM değişikliğinde tüm belgeyi
  yeniden hesaplatır (geri sayım saniyede bir). Sayfa kendisi basar ya da
  `<html>` özniteliği taşır (bkz. `app/admin/layout.tsx`).
- Mobilde sabit katmanlar `env(safe-area-inset-*)` taşır (`viewport-fit=cover`).

## Görsel Dil

**Çıta: her ekran Awwwards ödüllü bir ürünün işçiliğinde** (sahibinin
isteği, 30 Ekim: "bir şey yaparken, düzeltirken, eklerken hep görsel olarak
çok iyi şeyler yapmalıyız"). Düzeltme de yeni özellik de "çalışıyor" ile
bitmez: veri bir çizimle okunur (şerit, halka, ölçek, yaprak), renk anlam
taşır, hiyerarşi tek bakışta seçilir, iki temada ve 390/1440'ta ekran
görüntüsüyle bakılır. Yerleşik dil: kart zemini nötr, durum/görüş kartın
tepesindeki 3 piksellik şeritte (bilanço, teknik ve risk kartları);
noktalı rozet yerine ikonlu hap (`VerdictPill`); uyarı hap yığını değil
ikonlu satır. Arayüz işinde `design-taste-frontend` önce çağrılır (pano
ekranlarında yalnız zanaat kuralları).

Token'lar `app/globals.css` → `@theme inline` (tek kaynak; ölçülmüş
kontrastlar sahibinin makinesindeki `~/dev-starter/knowledge/themes/acilis-zili.md`te
— bulut oturumunda yok, token'a bak).

- **Derinlik tonla**, gölgeyle değil: `surface` → `surface-sunken` →
  `premium-surface`. Panel gölge taşımaz; kenarı üstten ışıklı
  (`--edge-top/side/bottom`, `.edge-lit`). Gölge yalnız merdivende
  (3 Kasım, sahibinin isteği — gerekçe globals.css "GÖLGE MERDİVENİ"):
  `--shadow-raised` rayın içindeki hap, `--shadow-floating` açılır menü ve
  ipucu, `--shadow-overlay` diyalog/⌘K; dolgulu birincil buton
  `--shadow-button`, alan ve ray `--shadow-well`, metin alanı odağı
  `--shadow-focus` (odak çizgisinin YANINA). Katmanlı, negatif yayılmalı;
  tek geniş gölge yazma. Cam, blur, ışıma YOK.
- **Renk anlam taşır, süs değil:** mavi etkileşim, `up`/`down` yön. Veri
  panelinde mavi sayı ya da yeşil başlık gördüysen hata vardır. Hardcoded
  renk yasak.
- **Degrade:** kısa display başlık (`.display-ink`), birincil eylem, marka
  karosu ve bekleme filmleri/sahneleri (21 Ekim, sahibinin isteği). Veri
  panelleri ve gövde metni taşımaz.
- **Grafik dili ince:** kulvar (`--line-soft`) üstünde 5 piksellik şerit,
  sıfır çizgisi `--line-strong`; dolu ağır bloklar "tablo programı" gibi
  duruyor (10 Ekim, sahibinin itirazı — `MarketTexture.module.css`).
- **Tek font** (Schibsted Grotesk, değişken 400–900); mono yalnız sembol ve
  dizin numarası gibi künyelerde (`--font-mono`).
- **Eğri:** her geçiş `--ease-brand` (JS'te `lib/motion.ts` → `EASE_BRAND`;
  `element.animate` CSS değişkenini çözmüyor). Hedefini aşıp geri oturan
  `--ease-spring` / `--ease-spring-soft` YALNIZ tek küçük öğenin geri
  bildiriminde (sayaç rakamı, saat kolu, onay işareti); panel, sayfa ve metin
  girişinde asla. Elle `cubic-bezier(...)` yazılmaz.
  Hangi yardımcıyla, ne zaman: `.claude/rules/hareket.md` (katalog).
- **Display başlığın yanındaki metin 0,12em kalkar.** Degrade başlıklar Ü/İ/Ö
  imleri kesilmesin diye 0,12em yukarı açılıp `translate` ile geri kalkıyor
  (globals.css, "ÜSTTEKİ İMLER"); yanındaki künye 2–5 piksel aşağıda görünür.
  Yanındaki öğeye `translate: 0 calc(<başlık puntosu> * -.12)` ver (örnek
  `components/today/home/MarketTexture.module.css` → `.bandHead`,
  `.partHead`). Başlığa `inline-flex` verme; taban çizgisini içi boş bir
  `::before` imi belirliyor.
- **Görüş hapı tek bileşen:** AL/TUT/SAT her yerde `VerdictPill`
  (`components/ui/VerdictPill.tsx`; yön ikonu, skor varsa mini halka),
  analize giden hap `AnalysisBadge`. Elle `verdictPillClass` hapı yazma.
  Hap/çip SABİT genişlikli sütuna konmaz: sütun `max-content` (gerekçe
  `EarningsToday` → subgrid); sıkışan hap duman testinde düşer.
- **Ortak ölçüler** (10 Kasım tutarlılık denetimi: dört ekranda aynı role
  dört ayrı ölçü vardı). Modülde yenisini uydurma, bunları kullan:
  panel yarıçapı `--radius-panel` (öne çıkan tek yüzey `--radius-feature`);
  paneller arası `--page-section-gap`; panel `h2` `PanelHeader` ölçüsü
  (16/700), küçük kart başlığı 14/700, bölüm başlığı
  `clamp(25px,2.8vw,36px)`/600; display sayı 700, harf aralığı −0,03em;
  ağırlıklar 400/600/700 (550/650/750/850 ara basamak yok); metin tabanı 12
  piksel; şerit 5 piksel, uçlar 999, kulvar `--line-soft`, dolgu opak; mini
  grafik çizgisi 2 piksel; halka 6 piksel; etiket çipi 22/12/600 dolgu 8;
  zaman çipi `TimingChip`, değişim hapı `ChangePill`, karne
  `components/earnings/KarneStrip.tsx`; boş değer "–" + `text-muted`.
- **Büyüklük KALIN YATAY ŞERİTLE okunur, nokta/çentik bulutuyla değil**
  (sahibinin sözü, 10 Kasım: "böyle nokta nokta ne anlatıyor anlamıyorum;
  yatayda uzun kalın çizgi seviyorum"). Bir satırın tek bir değeri varsa
  (medyan, değişim, pay) sıfırdan o değere uzanan dolu çubuk çizilir (8
  piksel, yönü renginde; kulvar 5; satırın kahramanıysa 12–14 piksele
  çıkar — `components/themes/ThemeBoard.tsx`). Dağılım çentikleri, onluk eksende nokta,
  düğmeli im gibi okurun çözmesi gereken çizimler kullanılmaz; ayrıntı
  tabloya ya da haritaya gider. Piyasa değeri gibi büyüklükler doğrudan
  YAZILIR (aynı gün, Endeks Bileşenleri). Örnek `components/themes/ThemeStrip.tsx`.
- **Görselin etrafında çerçeve yok** — görsel kutunun kendisi
  (`overflow-hidden` + yarıçap). Kenarlık yalnız yer tutucularda.
- **Tema** next-themes değil: `data-theme` + `az-theme` çerezi.
- **Marka işareti tek kaynak** `components/brand/BellMark.tsx`
  (`--mark-*`); `app/icon.svg`, `app/apple-icon.tsx`, `lib/og.tsx` aynı
  sabitleri okur. Mavi degrade karo iki temada aynı.
- `.impeccable/config.json` tasarım denetçisinin istisnalarıdır; yeni
  istisna ancak kod içi karar yorumuna işaret eden bir `reason` ile.

### Yazı Görselleri: `:::` Blokları

- **Yazılarda fotoğraf yok.** Görsel, metinden çizilen `:::` bloklarıdır
  (`stories.image_url` 0004'te eklendi, 0005'te kaldırıldı — `lib/schema.ts`).
  **Tek belgeli istisna:** yatırımcı portreleri (`public/investors/`, özgür
  lisanslı; kaynak ve lisans `lib/investors.ts` → `PORTRAITS`). Yeni fotoğraf
  ancak o kadar sağlam bir lisans kaydıyla.
- Bloklar: `sayilar` · `bar` · `pay` · `akis` · `oncesi` · `zaman` · `grafik`
  + metin kutuları `ornek` · `dikkat` · `ozet` · `tanim`. Kutuda `**Etiket:**`
  ile başlayan satır tanım listesine dönüşür (yapıdır, süs değil).
- **Yeni blok = BEŞ yer:** ayrıştırıcı (`components/article/parse-blocks.ts`
  → `Block`, `parseBlocks`, kutuda `CALLOUT_LABELS`; testi
  `tests/article-parse.test.ts`), çizici (`ArticleBody.tsx`), editoryal stil
  (`components/article/ArticleEditorial.module.css`), rutin prompt'u
  (`docs/claude-rutinler.md` § 3) ve editör çipleri
  (`lib/article-blocks.ts` → `BLOKLAR`; StoryEditor ve topluluk
  PostEditor'ü aynı listeyi basar).
- Mercek ve rehber `variant="editorial"` ile çizilir; KVKK ve panel önizlemesi
  varsayılanla, piksel piksel aynı kalır. Blok rolleri CSS `:has()` ile değil
  TS'te `blockRoles` ile (`parse-blocks.ts`). Okuma ızgarası iki hat:
  yüzeyler 1040'lık kartın kenarında, metin `--read-inset` (36 / telefonda 20)
  içeride. Metni ayrı dar sütuna almak denendi ve geri alındı
  (`components/stories/StoryDetail.module.css`).

### Mürekkep Sahneleri ve Zil

- `lib/ink/scenes.ts` → `INK_SCENES`, `components/ink/`: Canvas 2D, tohumlu,
  deterministik, saf `render(ctx, t)`; hareketi azaltana son kare. Renk
  temadan, mavi degrade dilinde (`--mark-gradient`, `--display-gradient`,
  `--primary*`, `--brass` vurgusu; eski "mavi yok" kuralı 21 Ekim'de
  sahibinin isteğiyle kalktı). Açık temada film açık kalır, koyu temada
  koyu.
- Sahne DÖNMEZ, bir kez oynar — tek istisna `LoadingMark`'ın `ringing`
  döngüsü. Rota beklemesi `lib/ink/route-scenes.ts`; sayfa düzeyi boş durum
  `EmptyState scene=`; panel içi tek satırlık boş duruma sahne konmaz. Yeni
  sahneyi `.tmp-*` önizlemede kare kare, iki temada gözle kontrol et.
  Açılış `InkSplash` botlara ve hareketi azaltana hiç açılmaz.
- **Kahraman zili bir düğme** (`components/today/HeroBell.tsx`): basınca
  `heroTap` sahnesi `key` remount'uyla yeniden oynar; geri sayım sıfırlanınca
  `Countdown` `az:bell-rang` yayar, zil kendiliğinden çalar — olay adı tek
  kaynak `components/today/bell-event.ts`. Zil animasyonu için ikinci bir
  bileşen AÇMA (eski `BellLoader`/`BellMood` bu yüzden silindi, 14 Ekim).
