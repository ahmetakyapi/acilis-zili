# Açılış Zili — Claude Code notları

Kararların gerekçesi kod içi yorumlarda yaşar; oralar karar kaydıdır, silme.
Bu dosya yalnızca **her oturumda bilmen gerekenleri** taşır: kural + tek
satır neden + gerekçenin durduğu dosya. Rota listesi ve mimari yalnız
`README.md`'de; `docs/ROUTEMAP.md` rota değil DURUM tutar (iki liste ayrı düşer).

## Commit yazarı

Commitler her zaman `Ahmet Akyapı <ahmetakyapii@gmail.com>` adına atılır;
yazarı yalnızca "Claude" olan commit atılmaz. Claude, mesajın sonundaki
`Co-Authored-By: Claude …` satırıyla ortak yazar olarak görünür. Oturum
başında, ilk committen önce:

```bash
git config user.name "Ahmet Akyapı"
git config user.email "ahmetakyapii@gmail.com"
```

Bu kural sahibinin tüm repolarında geçerli (9 Ekim 2026).

## Komutlar

```
npm run dev                      # 3000 doluysa 3001'e düşer
npm run build                    # route tipleri bozulursa önce `rm -rf .next`
npm run typecheck                # `npx tsc` değil — önce iCloud kopyalarını temizler
npm run lint
npx tsx --test tests/*.test.ts   # birim testleri (CI'da koşmaz)
npm run smoke                    # başsız Chrome: rota kodu, konsol hatası, yatay taşma
npm run db:generate              # şema değişti → YENİ migration; eskisini düzenleme
npm run db:migrate
npm run db:seed                  # takvim kapsamı azalınca uyarır; bir `stories` satırını da ezer
npm run db:seed:events           # yalnız ekonomik takvim — takvimi tazelemek için bu
npm run build:favicon            # .ico + PWA PNG'leri (elle üretme)
```

- **Temiz kopyada önce `build`.** `PageProps`/`RouteContext` tipleri
  `.next/types` altına build sırasında üretilir; öncesinde typecheck
  "Cannot find name 'PageProps'" verir (CI sırası da bu: `deploy.yml`).
- **Yayın:** `main`e push → `deploy.yml` (build + typecheck + lint) → SSH ile
  VPS'te `deploy/update.sh`. Duman testi ayrı iş akışı (`smoke.yml`), kapı değil.

## Commit'leme

- **Oturumda iki-üç commit**, konu başına bir tane. Yapılanlar tek başlıkta
  özetlenebiliyorsa tek commit; "görsel iyileştirme" ve "performans" gibi iki
  alan varsa iki. Her mikro düzeltmeye ya da ekrana ayrı commit YOK.
- **İş sürerken yeni istek gelirse commit'i ERTELE**; kuyruk boşalınca topla
  (bu uyarı üç kez geldi). Mesele sayı, detay değil: gövdede her değişikliğin
  gerekçesi ayrı paragraf.
- Commit öncesi üçü temiz: `typecheck`, `lint`, `build`. Görsel değişiklik
  tarayıcıda ÖLÇÜLMÜŞ olmalı — "sığıyor gibi duruyor" doğrulama değil.

## Yazım: Title Case

**Cümle olmayan her metin Title Case** — künye ve birimler dahil:
- Sayfa/bölüm/panel/kart başlıkları, buton ve bağlantılar ("Tümünü Gör"),
  kategori/filtre/sekme/rozet, tablo başlıkları ve etiket sütunu, rehber ve
  mercekteki `##`/`###`, kısa vurgular ("Yatırım Tavsiyesi Değildir").
- Künyeler: "Olaydan Bugüne", "15 Dakika Gecikmeli", "0,05 Puan",
  "20:04 Güncellendi", "56 Analist". (Muaf tutuldukları dönem tutarsızlık üretti.)

Cümle düzeninde kalanlar: paragraflar, açıklama ve ipucu satırları; boş
durum/hata **mesajları** (başlıkları Title Case); `placeholder` ve
`aria-label` cümleleri; sayı + isim kalıbındaki kısa cümleler ("819 şirketin
60 tanesi"); geri sayımın birim ekleri (`17 sa 59 dk 53 sn`).

Bağlaç/edat (ve, ile, için, de/da, mi) başta değilse küçük: "Faiz, Tahvil ve
Getiri Eğrisi". **`title()` / `capitalize` KULLANMA** (`i → I` üretir, `İ`
değil); küçültürken `toLocaleLowerCase("tr-TR")`.

## Ekran düzeni: her ekranda aynı sıra

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

## Düzen: ölçmeden değiştirme

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

## Görsel dil

**Kimlik, bir bakışta.** Ayrıntı ve ölçülmüş kontrastlar
`~/dev-starter/knowledge/themes/acilis-zili.md`te; token'lar
`app/globals.css` → `@theme inline`.

- **Derinlik tonla**, gölgeyle değil: `surface` → `surface-sunken` →
  `premium-surface`. Tek gerçek gölge açılır katmanda ve marka karosunda.
  Cam, blur, ışıma YOK.
- **Renk anlam taşır, süs değil:** mavi etkileşim, `up`/`down` yön. Veri
  panelinde mavi sayı ya da yeşil başlık gördüysen hata vardır.
- **Degrade yalnız üç yerde:** kısa display başlık (`.display-ink`), birincil
  eylem, marka karosu. Veri panelleri ve gövde metni taşımaz.
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
- **Display başlığın yanındaki metin 0,12em kalkar.** Degrade başlıklar Ü/İ/Ö
  imleri kesilmesin diye 0,12em yukarı açılıp `translate` ile geri kalkıyor
  (globals.css, "ÜSTTEKİ İMLER"); taban çizgisi kaydırılmamış kutuya göre
  hizalandığı için yanındaki künye 2–5 piksel aşağıda görünür. Yanındaki öğeye
  `translate: 0 calc(<başlık puntosu> * -.12)` ver (örnek
  `components/today/home/MarketTexture.module.css` → `.bandHead`,
  `.partHead`). Başlığa `inline-flex` verme; taban çizgisini içi boş bir
  `::before` imi belirliyor.

- **Yazılarda fotoğraf yok.** Görsel, metinden çizilen `:::` bloklarıdır
  (`stories.image_url` 0004'te eklendi, 0005'te kaldırıldı — `lib/schema.ts`).
  **Tek belgeli istisna:** yatırımcı portreleri (`public/investors/`, özgür
  lisanslı; kaynak ve lisans `lib/investors.ts` → `PORTRAITS`). Yeni fotoğraf
  ancak o kadar sağlam bir lisans kaydıyla.
  Bloklar `components/article/ArticleBody.tsx`: `sayilar` · `bar` · `pay` ·
  `akis` · `oncesi` · `zaman` · `grafik` + metin kutuları `ornek` · `dikkat` ·
  `ozet` · `tanim`. Kutuda `**Etiket:**` ile başlayan satır tanım listesine
  dönüşür (yapıdır, süs değil).
- **Yeni blok = DÖRT yer:** çizici (`ArticleBody.tsx`), editoryal stil
  (`components/article/ArticleEditorial.module.css`), rutin prompt'u
  (`docs/claude-rutinler.md` § 3) ve editör çipleri
  (`components/admin/StoryEditor.tsx` → `BLOKLAR`).
- Mercek ve rehber `variant="editorial"` ile çizilir; KVKK ve panel önizlemesi
  varsayılanla, piksel piksel aynı kalır. Blok rolleri CSS `:has()` ile değil
  TS'te `blockRoles` ile. Okuma ızgarası iki hat: yüzeyler 1040'lık kartın
  kenarında, metin `--read-inset` (36 / telefonda 20) içeride. Metni ayrı dar
  sütuna almak denendi ve geri alındı (`components/stories/StoryDetail.module.css`).
- **Görselin etrafında çerçeve yok** — görsel kutunun kendisi
  (`overflow-hidden` + yarıçap). Kenarlık yalnız yer tutucularda.
- **Mürekkep sahneleri** (`lib/ink/scenes.ts` → `INK_SCENES`,
  `components/ink/`): Canvas 2D, tohumlu, deterministik, saf `render(ctx, t)`;
  hareketi azaltana son kare. Renk temadan (`--text-strong`, `--brass`; mavi
  YOK). Sahne DÖNMEZ, bir kez oynar — tek istisna `LoadingMark`'ın `ringing`
  döngüsü. Rota beklemesi `lib/ink/route-scenes.ts`; sayfa düzeyi boş durum
  `EmptyState scene=`; panel içi tek satırlık boş duruma sahne konmaz. Yeni
  sahneyi `.tmp-*` önizlemede kare kare, iki temada gözle kontrol et.
  Açılış `InkSplash` botlara ve hareketi azaltana hiç açılmaz.

## Veri dürüstlüğü

1. **Uydurma kesinlik yok.** Dakika bilinmiyorsa `~` ve pencere adı
   ("~23:00 · Kapanış Sonrası").
2. **Eski veri büyük puntoyla gösterilmez**; küçük tarih kurtarmaz — metrik
   kalkar (Brent örneği: `lib/market-boards.ts`).
3. **Aynı sayı iki yerde duruyorsa aynı kaynaktan gelir** (başlıktaki kotasyon
   ile grafiğin son barı).
4. **Yüzde hangi seansı anlattığını KANITLAR.** Tek ölçü
   `status.sessionDate` (`lib/market-hours.ts`): kotasyon ancak
   `isSessionTrade` ise seansı anlatır. Gün yetmez, YAŞ da sorulur
   (`packCurrent`, `lib/providers/index.ts`; ölçü sağlayıcının `Date`
   başlığı) — güncel değilse bir kez önbelleksiz tekrar, sonra `stale: true`.
   **Ekran bayat veriyi künyesiyle gösterebilir; YAZMA katmanı (teknik,
   bülten, mercek uçları) hiç kullanmaz** — sayı metne geçip kalıcı olur.
   Barlarda aynı kural: `cachedBarsUsable`. Açılış öncesi sağlayıcının gün
   barı dünkü seanstır.

## Saat: TR önce

`lib/session-clock.ts` tek kaynak: TR'de birincil İstanbul, ikincil New York;
EN'de tersi. ABD yaz saati farkı kaydırdığı için sabit saat yazılmaz (açılış
yazın 16:30, kışın 17:30 TR). ET↔UTC aritmetiği yalnız `lib/market-hours.ts`'te.

## İstemci/sunucu sınırı ve önbellek

- **`"use client"` modülden dışa aktarılan DEĞER sunucuya gerçek değer olarak
  gelmez** — sessizce istemci referansına döner. Paylaşılan sabitler düz
  modülde: `lib/chart-series.ts`, `lib/compare.ts`.
- Sunucu bileşeni istemci sağlayıcıya `children` olarak geçebilir; yalnız
  duruma BAĞLI hücreler istemcide (karşılaştırma ekranı).
- **Sığ adres güncellemesi uçuştaki gezinmeyi sessizce ÖLDÜRÜR** — gezinme
  sürerken kapan (`useRouteNavigating`, `components/layout/RouteProgress.tsx`).
- **Sığ güncelleme geçmiş girdisini tazelemez**: geri tuşu eski ağacı yükler.
  Adresten okunan durum prop'tan değil ADRESTEN başlatılır.
- **İstek içi önbellek = React `cache()`**, argümanı KİMLİKLE eşler; bu yüzden
  anahtar sıralanmış dize (`getQuotes` → `quotesForKey`, `getSymbolNames` →
  `symbolNamesForKey`). Aynı veriyi gösteren iki panel aynı listeyi sormalı,
  yoksa aynı hissenin iki farklı yüzdesi yan yana durabilir. Her fonksiyonun
  sarılı olduğunu varsayma (ör. `getSeries`, `lib/providers/fred.ts`, sarılı
  DEĞİL; makro serilerde tek koruma `fetch`in `revalidate`i). Liste burada
  TUTULMAZ (elle tutulan liste 39 dosyanın 20'sini sayıyordu) — kaynağa sor:
  `grep -rnE "= (React\.)?cache\(" lib components app`.
- **İstekler arası önbellek = `unstable_cache`**; hata önbelleğin DIŞINDA
  yakalanır ki düşen veritabanının boş sonucu saklanmasın
  (`grep -rn "unstable_cache(" lib`; örnek `loadSymbolTable`, `lib/data.ts`).

## İçerik ve rutin köprüsü

- Yazılı içeriği claude.ai rutinleri üretir; promptlar `docs/claude-rutinler.md`
  (§ 1 günlük bülten, § 2 haftalık, § 3 mercek, § 4 bilanço analizi, § 5 teknik).
  Uçlar `/api/{brief,mercek,analiz,teknik,hedef}`: POST yazar, GET geri okur,
  `/context` rutine girdi verir; hepsi `BRIEF_SECRET` (`lib/api-auth.ts` →
  `checkBearer`).
- **İçeriğin yazma yolu TEK: `lib/content-write.ts`** (şema, sürüm fotoğrafı,
  upsert) — `/api/mercek`, `/api/brief` ve panel eylemleri
  (`app/actions/content.ts`) oradan geçer. Yeni giriş de oradan geçer.
  Panel yeni kayıt ÜRETMEZ, var olanı düzeltir (`/admin/yazilar/...`);
  üzerine yazılan hâl `story_revisions`a düşer (bülten anahtarı
  `bulten:{tarih}:{dönem}`). Panelde **İçerik ÖLÇER, Yazılar DEĞİŞTİRİR**.
- Rehber depoda (`content/guide/`: meta + tr + en, eksik çeviri derlemeyi
  kırar); mercek veritabanında (`stories`, slug başına iki `locale`; çeviri
  yoksa orijinal "TR" rozetiyle).
- Bilanço analizi (`earnings_analyses`): sayılar HAM (8.97e9), metin dile
  göre. Bilançolar dört sekme (`/bilancolar`, `/hafta`, `/analizler`,
  `/takip`); sekme çubuğunu her sayfa kendi basar — detay sayfası sekmesiz.
- Teknik analiz (`technical_analyses`): satır YAYIN başına (metin
  `copy.{tr,en}`), rutin yorum yazar, göstergeleri uç hesaplar. Sembol
  listesi `lib/technical.ts` → `TECHNICAL_SYMBOLS`; nöbet saati değişirse
  `TECHNICAL_CRON`, `SLOT_UTC`, `currentSlot` üçü birden.

## Altyapı ve güvenlik

- **Depo herkese açık.** Gerçek sırlar (`BRIEF_SECRET`, `CRON_SECRET`, …)
  asla commit'lenmez; doldurulmuş promptlar `docs/*.local.md` (gitignore'da).
  Commit öncesi staged diff'i sırlara karşı tara.
- **Migration'lar deploy'da UYGULANMAZ**; `npm run db:migrate` ayrıca, üretim
  `DATABASE_URL`iyle koşulur. Kod migration'dan önce yayına inebilir: yeni
  özellik mümkünse var olan tabloya (özellikle `users`) sütun eklemez, kendi
  tablosunu açar ve tablo yokken sessizce düşer (`lib/avatar-data.ts`).
  Migration'ı uygulamayı unutmak da sessiz hatadır.
- **`/gomulu/*` çerçevelenebilen TEK yol**; geri kalanı `X-Frame-Options:
  DENY` + `frame-ancestors 'none'` (`next.config.ts`).
- **Bildirim Web Push** (`lib/push.ts`, `public/sw.js`,
  `app/api/cron/alarmlar`, VAPID). Service worker yalnız bildirim taşır:
  `fetch` dinleyicisi/önbellek YOK (bayat fiyat = veri dürüstlüğü 2). Kayıt
  yalnız Ayarlar'daki düğmeyle. Zamanlanmış işler `deploy/cron-install.sh`'te
  (`update.sh` her sürümde çalıştırır) — yeni iş oraya.
- **E-posta yalnız şifre sıfırlama** (`lib/email.ts`, Resend, SDK'sız).
  Anahtar yoksa "Şifremi Unuttum" basılmaz; her adrese aynı yanıt, gönderim
  `after` ile; satırda bağlantının SHA-256 özeti. Bülten/bildirim e-postası
  eklenirse önce KVKK metni değişir.
- **Tek `eslint-disable` istisnası:** `components/news/NewsImage.tsx`'teki iki
  `@next/next/no-img-element`. `next/image` her haber CDN'i için
  `remotePatterns` ister; tek kapsayıcı yol `hostname: "**"` ve o,
  `/_next/image`'ı herkese açık görsel proxy'sine çevirir. Yeni bir
  `eslint-disable` bu kadar sağlam gerekçe ister.

## Stil, tema, metin

- **Tailwind v4**: `tailwind.config.ts` yok, tokenlar `app/globals.css` →
  `@theme inline`. Hardcoded renk yasak.
- **Tema** next-themes değil: `data-theme` + `az-theme` çerezi.
- **Marka işareti tek kaynak** `components/brand/BellMark.tsx`
  (`--mark-*`); `app/icon.svg`, `app/apple-icon.tsx`, `lib/og.tsx` aynı
  sabitleri okur. Mavi degrade karo iki temada aynı.
- **Arayüz metni** `lib/i18n/dictionaries/{tr,en}.ts`; `en`, `typeof tr` —
  `tr`'ye eklenen anahtar `en`'i derletmez, ikisi birlikte. **Her özellik
  kendi ad alanında** (`glossary`, `stockDepth`, `lira`…); var olana anahtar
  serpiştirme.
- **Büyük sayfalar panellere bölünür**, yeni panel kendi dosyasında:
  `app/(app)/hisse/[symbol]/_panels/`, `components/today/home/`,
  `components/earnings/report/`.
- Mobilde sabit katmanlar `env(safe-area-inset-*)` taşır (`viewport-fit=cover`).

## Küçük ama kritik

- Sayfa içi filtre/sıralama bağlantıları `scroll={false}`.
- **Çevirisi eksik olabilen içerik** (mercek, analiz, bülten, teknik): aynı
  dil listesi hem `pageAlternates`e hem `articleOpenGraph`a (`availableLocales`)
  gider; site haritası da yalnız o dilleri yazar. Canonical, hreflang ve
  `og:locale` metnin dilini söyler, arayüzünkini değil (`lib/site.ts`).
- **Katlama bastığın yerde açılır**: `components/layout/ExpandInPlace.tsx`
  (aç/kapa anında kaydırma çapası kapalı); yeni `sr-only` onay kutusu düğmenin
  hizasına (`.foldInput`, `components/ui/FoldToggle.module.css`).
- Karşılaştırma ekranı: sözleşme `lib/compare.ts`, istemci
  `components/markets/CompareLive.tsx`, bar ucu `app/api/karsilastir/route.ts`;
  aralık istemcide değişir.
- Grafikte dokunmatik okuma, aralık değişince temizlenir.
- Otomatik bağlantı (`lib/autolink.ts`): terim/sembol yalnız İLK geçişte;
  sembol yalnız `$NVDA` / `(NVDA)` kalıbında ve bilinen kümedeyse.
- ABD temettü stopajı W-8BEN ile bireyde **%20** (yoksa %30; %15 yalnız ≥%10
  oy hakkı olan kurum). Tek kaynak `lib/tax.ts` → `US_WITHHOLDING`.
- **iCloud kopyaları** (`alpaca 2.ts`, `routes.d 5.ts`) `.next/types`'a düşüp
  `TS6200` ile derlemeyi kırar; `typecheck`/`build` önce
  `scripts/clean-sync-dupes.mjs` koşar, `.gitignore` commit'i engeller.
  Kalıcı çözüm: iCloud Drive → "Masaüstü ve Belgeler Klasörleri" kapalı.

## Yerelde

Boş sağlayıcı anahtarında kartlar "veri alınamadı" der, sayfa çökmez —
beklenen. Grafik eksikse önce anahtara bak (`/api/debug/providers`).
`BRIEF_SECRET`/`CRON_SECRET` boşsa korumalı uçlar geliştirmede açık, üretimde
503 (`lib/api-auth.ts`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
