# Açılış Zili — Claude Code Notları

**Proje:** ABD borsasını Türk yatırımcıya Türkiye saatiyle anlatan iki dilli
(TR birincil, `/en` önekli EN) site — https://aciliszili.com. Next.js 16
(App Router) + React 19, Drizzle + Neon Postgres, NextAuth v5, Tailwind v4.
Tek VPS'te çalışır (`deploy/`). Yazılı içeriği claude.ai rutinleri üretir;
sitenin kendi Claude çağrıları ayrı ve sınırlıdır (§ Site İçi Claude).

**Bu dosyanın sözleşmesi.** Kararların gerekçesi kod içi yorumlarda yaşar;
oralar karar kaydıdır, silme. Burada yalnız **her oturumda bilmen
gerekenler**: kural + tek satır neden + gerekçenin durduğu dosya. Geçmiş
anlatısı, sayım ve liste buraya yazılmaz (eskir); kaynağa nasıl sorulacağı
yazılır. Bir kural değişince satırı güncelle, yanına yenisini ekleme.

| Ne arıyorsan | Nerede |
|---|---|
| Rotalar, mimari, veri modeli, ortam değişkenleri | `README.md` (tek rota listesi) |
| Neyin canlı, neyin yarım olduğu | `docs/ROUTEMAP.md` (rota DEĞİL durum tutar) |
| Rutin promptları (bülten, mercek, analiz, teknik, grafik) | `docs/claude-rutinler.md` |
| Kullanıcı isteğiyle Claude analizi | `docs/claude-analysis.md` |
| Sunucu, deploy, geri dönüş | `docs/deploy-vps.md`, `deploy/update.sh` |

## Oturum Başı

```bash
git config user.name "Ahmet Akyapı"
git config user.email "ahmetakyapii@gmail.com"
npm ci && npm run build          # temiz kopyada typecheck'ten ÖNCE build
```

- Commitler her zaman `Ahmet Akyapı <ahmetakyapii@gmail.com>` adına; yazarı
  yalnız "Claude" olan commit atılmaz. Claude, mesaj sonundaki
  `Co-Authored-By: Claude …` satırıyla ortak yazar (sahibinin tüm repolarında,
  9 Ekim 2026).
- **Neden önce `build`:** `PageProps`/`RouteContext` tipleri `.next/types`
  altına build sırasında üretilir; öncesinde typecheck "Cannot find name
  'PageProps'" verir (CI sırası da bu: `deploy.yml`).

## Komutlar

```
npm run dev                      # 3000 doluysa 3001'e düşer
npm run build                    # route tipleri bozulursa önce `rm -rf .next`
npm run typecheck                # `npx tsc` değil — önce iCloud kopyalarını temizler
npm run lint
npm test                         # birim testleri (tsx --test; tek dosya: npx tsx --test tests/<ad>.test.ts)
npm run check                    # typecheck + lint + test — commit öncesi tek komut (build'den sonra)
python3 -m unittest discover -s tests/deploy   # deploy/ ve .github/scripts/ betiklerinin testleri
npm run smoke                    # başsız Chrome: rota kodu, konsol hatası, yatay taşma
npm run db:generate              # şema değişti → YENİ migration; eskisini düzenleme
npm run db:migrate
npm run db:seed                  # takvim kapsamı azalınca uyarır; bir `stories` satırını da ezer
npm run db:seed:events           # yalnız ekonomik takvim — takvimi tazelemek için bu
npm run build:favicon            # .ico + PWA PNG'leri (elle üretme)
npm run build:email              # posta bant GIF'i (public/email/hero.gif, elle üretme)
```

`db:push` YOK (30 Ekim'de kaldırıldı): migration geçmişini atlayıp canlı
şemayı doğrudan değiştirir. Şema değişikliği yalnız `db:generate` + migration.

## Commit ve Yayın

- **Yayın:** `main`e push → `deploy.yml` (build + typecheck + lint + test)
  → SSH ile VPS'te `deploy/update.sh`. Test düşerse sürüm çıkmaz. Her push yeni sürümdür, belge değişikliği dahil.
  Duman testi ayrı iş akışı (`smoke.yml`), kapı değil.
- **`main`e push için onay SORULMAZ** (sahibinin isteği, 28 Ekim 2026: "artık
  oto alabilirsin"): denetimler temizse doğrudan `main`e gönder.
- Commit öncesi temiz: `build`, sonra `npm run check`. Yeni `lib/` mantığı
  testsiz girmez (`tests/<ad>.test.ts`). Görsel değişiklik
  tarayıcıda ÖLÇÜLMÜŞ olmalı — "sığıyor gibi duruyor" doğrulama değil.
- **Oturumda iki-üç commit**, konu başına bir tane. Tek başlıkta
  özetlenebiliyorsa tek commit; "görsel iyileştirme" ve "performans" gibi iki
  alan varsa iki. Her mikro düzeltmeye ya da ekrana ayrı commit YOK.
- **İş sürerken yeni istek gelirse ya da arka planda ajan çalışıyorsa
  commit'i ERTELE**; kuyruk boşalınca topla (bu uyarı beş kez geldi). "Konu"
  ekran değil İŞ ALANI: büyük görsel turda bile 2–4 commit. Mesele sayı, detay değil: gövdede her değişikliğin
  gerekçesi ayrı paragraf.
- Mesaj Türkçe, başlık ne değiştiğini söyler (`git log` kalıbına bak).
- **Depo herkese açık:** staged diff'i sırlara karşı tara (§ Altyapı).
- **Geçici işaretlere de tara:** `git diff --cached | grep -nE
  '^\+.*(TMP|TODO|console\.log|debugger)'`. Ajanlar çalışırken alınan anlık
  commit bir denemenin `label="TMPTEST"` satırını canlıya çıkardı (23 Eylül,
  `32e6d16d`); build/lint/test bunu yakalamaz.

## Ajanlarla Çalışma

Proje ajanlarla, "vibe coding" usulü gelişiyor. Bu dosya `AGENTS.md` olarak
da okunur (sembolik bağ; Codex, Cursor, Gemini) — Claude'a özgü olmayan
kuralı buraya yaz, aracın adına değil.

- **Yanıt, ara not, alt ajan brifi ve commit Türkçe.** Okura görünen metinde
  "düğme" değil "buton"; teknoloji seçimi için "tech stack" ("yığın" değil);
  İngilizceden kelime kelime çeviri yok ("çıplak sayı" → "birimsiz sayı").
- **Tasarım/UX ara kararlarını kendin ver**, gerekçesini rapora yaz (sahibinin
  isteği, 25 Ekim: "sınırlarını zorla, sonra değiştiririz"). Yine SORULACAK:
  veri silen/değiştiren migration, ödeme/hesap/üçüncü taraf hizmet, bu
  dosyadaki kuralı değiştirmek.
- **Alt ajan commit ATMAZ, push ETMEZ**; commit ana oturumun işi, ajanlar
  bitince. Paralel ajanlar aynı dosyayı düzenleyecekse ya sıraya koy ya da
  `isolation: worktree`.
- **Alt ajan brifi bu dosyayı okutur** ve ilgili §'i adıyla verir; ajan
  kuralı bilmeden "düzeltip" kod içi karar yorumunu silebilir. Karar
  yorumları silinmez (bu dosyanın sözleşmesi).
- **Bitti demeden önce kanıt:** değişen davranışın testi ya da ölçümü
  (`npm run check`, `npm run smoke`, `.tmp-*.mjs` ölçüm betiği). Görsel iş
  ekran görüntüsüyle değil sayıyla doğrulanır (§ Düzen).

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

Token'lar `app/globals.css` → `@theme inline` (tek kaynak; ölçülmüş
kontrastlar sahibinin makinesindeki `~/dev-starter/knowledge/themes/acilis-zili.md`te
— bulut oturumunda yok, token'a bak).

- **Derinlik tonla**, gölgeyle değil: `surface` → `surface-sunken` →
  `premium-surface`. Tek gerçek gölge açılır katmanda ve marka karosunda.
  Cam, blur, ışıma YOK.
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
- **Display başlığın yanındaki metin 0,12em kalkar.** Degrade başlıklar Ü/İ/Ö
  imleri kesilmesin diye 0,12em yukarı açılıp `translate` ile geri kalkıyor
  (globals.css, "ÜSTTEKİ İMLER"); yanındaki künye 2–5 piksel aşağıda görünür.
  Yanındaki öğeye `translate: 0 calc(<başlık puntosu> * -.12)` ver (örnek
  `components/today/home/MarketTexture.module.css` → `.bandHead`,
  `.partHead`). Başlığa `inline-flex` verme; taban çizgisini içi boş bir
  `::before` imi belirliyor.
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

## Veri Dürüstlüğü

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
   Barlarda aynı kural: `cachedBarsUsable`. Açılış öncesi sağlayıcının gün
   barı dünkü seanstır.
5. **Ekran bayat veriyi künyesiyle gösterebilir; YAZMA katmanı hiç
   kullanmaz** (teknik, bülten, mercek uçları, site içi Claude notları) —
   sayı metne geçip kalıcı olur.
6. **Paket tazeliği sembolün tazeliği değil:** `packCurrent` paketteki EN
   YENİ işleme bakar; alarm gibi yazan yollar her sembolün kendi seansını
   ister (`sessionReadings`, `lib/price-alerts.ts`) — yoksa henüz işlem
   görmemiş hisse dünün yüzdesiyle alarm tetikliyordu.

## Saat: TR Önce

`lib/session-clock.ts` tek kaynak: TR'de birincil İstanbul, ikincil New York;
EN'de tersi. ABD yaz saati farkı kaydırdığı için sabit saat yazılmaz (açılış
yazın 16:30, kışın 17:30 TR). ET↔UTC aritmetiği yalnız `lib/market-hours.ts`'te.

## İstemci/Sunucu Sınırı ve Önbellek

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
  DEĞİL; tek koruma `fetch`in `revalidate`i). Kaynağa sor:
  `grep -rnE "= (React\.)?cache\(" lib components app`.
- **İstekler arası önbellek = `unstable_cache`**; hata önbelleğin DIŞINDA
  yakalanır ki düşen veritabanının boş sonucu saklanmasın
  (`grep -rn "unstable_cache(" lib`; örnek `loadSymbolTable`, `lib/data.ts`).
- **Önbellek dağıtımlar arası ORTAK** (20 Ekim; `shared/fetch-cache`,
  `deploy/update.sh`): anahtar geri çağrının metni + keyParts, yani dönen
  ŞEKİL değişip metin aynı kalırsa (çağırdığı yardımcı, şema sütun tipi)
  eski şekil yeni koda gider. Şekli değiştiren, o önbelleğin keyParts
  sürümünü artırır (ör. `lib/investor-data.ts` → `"investors-overview-v4"`);
  her anahtar sürümlü.

## İçerik: Rutinler ve Yazma Yolu

- Yazılı içeriği claude.ai rutinleri üretir; promptlar `docs/claude-rutinler.md`
  (§ 1 günlük bülten, § 2 haftalık, § 3 mercek, § 4 bilanço analizi, § 5
  teknik, § 6 yaz saati nöbetçisi, § 7 günün grafiği). Rutinler koddan
  kurulmaz, claude.ai'de elle; prompt değişince sahibine "yeniden yapıştır"
  de ve `docs/ROUTEMAP.md`'ye açık iş olarak yaz.
- Rutin uçları `/api/{brief,mercek,analiz,teknik,hedef,grafik}` (+
  `/api/takvim/{beklenti,bilanco}`): POST yazar, GET geri okur, `/context`
  rutine girdi verir; hepsi `BRIEF_SECRET` (`lib/api-auth.ts` →
  `checkBearer`). Rutin sayı üretmez: göstergeleri uç hesaplar, rutin yorum
  yazar.
- **Uca alan eklemek = prompt da değişir:** yeni girdi/çıktı alanı
  `docs/claude-rutinler.md`'deki ilgili §'e yazılmadan iş bitmiş sayılmaz.
- **İçeriğin yazma yolu TEK: `lib/content-write.ts`** (şema, sürüm fotoğrafı,
  upsert) — `/api/mercek`, `/api/brief` ve panel eylemleri
  (`app/actions/content.ts`) oradan geçer. Yeni giriş de oradan geçer.
  Panel yeni kayıt ÜRETMEZ, var olanı düzeltir (`/admin/yazilar/...`);
  üzerine yazılan hâl `story_revisions`a düşer (bülten anahtarı
  `bulten:{tarih}:{dönem}`). Panelde **İçerik ÖLÇER, Yazılar DEĞİŞTİRİR**.
- **Panel dışından toplu düzeltme** (ör. ölü kaynak bağlantıları): geçici
  `.tmp-*.mts` betiği, satırı okuyup `storyInputSchema.parse` →
  `saveStory(input, "admin", row.updatedAt.toISOString())`. Doğrudan
  `UPDATE` yazma: sürüm denetimi ve fotoğraf atlanır. Önce kuru çalıştır,
  sonra `--apply`. Canlı veritabanıdır (§ Yerelde).
- **Kırık Bağlantı Raporu** (`links.yml`, pazartesi; tek açık issue):
  lychee'nin hata saydığı adres `.github/scripts/links-recheck.py` ile
  yeniden denenir, kalanlar gerçekten kırıktır. Mercek kaynağı
  (`stories.sources`) ölmüşse sıra: aynı yazının yeni adresi → web.archive.org
  kopyası → adresi kaldır, etiketi bırak. Uydurma ya da başka yayının
  bağlantısı konmaz.
- Rehber depoda (`content/guide/`: meta + tr + en, eksik çeviri derlemeyi
  kırar); mercek veritabanında (`stories`, slug başına iki `locale`; çeviri
  yoksa orijinal "TR" rozetiyle).
- Bilanço analizi (`earnings_analyses`): sayılar HAM (8.97e9), metin dile
  göre. Bilançolar dört sekme (`/bilancolar`, `/hafta`, `/analizler`,
  `/takip`); sekme çubuğunu her sayfa kendi basar — detay sayfası sekmesiz.
- Teknik analiz (`technical_analyses`): satır YAYIN başına (metin
  `copy.{tr,en}`). Sembol listesi `lib/technical.ts` → `TECHNICAL_SYMBOLS`;
  nöbet saati değişirse `TECHNICAL_CRON`, `SLOT_UTC`, `currentSlot` üçü
  birden (yoksa yeni koşu var olan nöbetin ÜSTÜNE yazar). Bülten saati
  `lib/data.ts` → `BRIEF_PUBLISH_TR`.

## Site İçi Claude

Rutinlerden ayrı, sunucunun kendi Claude çağrıları. Anahtar
`lib/claude-key.ts` (`ANTHROPIC_API_KEY`, yoksa `CLAUDE_ANALYSIS_API_KEY`).

- **Notlar** (`app/api/ai/*`; hisse sayfası "Bu Hafta Neden Hareket Etti",
  bilanço/haber/karşılaştırma/portföy/takip notları, Bu Hisseye Sor, düz
  cümleyle tarama): hepsi tek kapıdan, `callClaude` (`lib/stock-insights.ts`)
  + ortak günlük bütçe (`lib/claude-budget.ts`; istemci ve üye başına sayaç,
  anonime tavanın %80'i). SDK'yı doğrudan çağıran yalnız üç bilinçli yol var:
  analiz (`lib/ai-analysis.ts`), çeviri yedeği (`lib/translate.ts`), pazar
  özeti yorumu (`lib/weekly-commentary.ts`). Dördüncüyü açma.
- **Bunlar yazma katmanıdır:** yalnız tamamlanmış seans ve biçimlenmiş sayı
  verilir; çıktıdaki her sayı girdide geçmek zorunda (`lib/ai-grounding.ts`),
  geçmeyen metin HİÇ basılmaz. Kişiye ya da hisseye yön veren metin (portföy,
  risk, takip, Bu Hisseye Sor) bir de tavsiye denetiminden geçer
  (`lib/advice-guard.ts`: al/sat yönlendirmesi = SPK'ya göre yatırım
  danışmanlığı). Not istemciden istenir, botlara açılmaz.
- **Claude analizi** (`/claude/[symbol]`, `lib/ai-analysis*.ts`,
  `/admin/ai`): yetki + günlük kota + tek eşzamanlı iş kilidi, başarısız işte
  hak iadesi, Zod şemalı JSON çıktı. Ayrıntı ve model notları
  `docs/claude-analysis.md`; kullanıcı adı/e-posta/portföy modele gitmez.
- Model değiştirirken: Sonnet 5.5 ve sonrası `temperature` almaz, `thinking`
  yalnız `adaptive`.

## Altyapı ve Güvenlik

- **Depo herkese açık.** Gerçek sırlar (`BRIEF_SECRET`, `CRON_SECRET`, …)
  asla commit'lenmez; doldurulmuş promptlar `docs/*.local.md` (gitignore'da).
- **Migration'lar deploy'da UYGULANMAZ.** Üretim adresi yalnız sunucuda;
  uygulama yolu GitHub Actions → "Migrate DB" (`migrate.yml`, elle
  tetiklenir, `deploy/remote-migrate.sh`): önce `check` (salt okunur,
  bekleyenleri adıyla basar), sonra `apply`. Kod migration'dan önce yayına
  inebilir: yeni özellik mümkünse var olan tabloya (özellikle `users`) sütun
  eklemez, kendi tablosunu açar ve tablo yokken sessizce düşer
  (`lib/avatar-data.ts`). Migration'ı unutmak da sessiz hatadır (0042 bir gün
  bekledi, 29 Ekim):
  - **Yalnız ekleyen** migration (`CREATE TABLE/INDEX`, varsayılanlı ya da
    boş geçilebilir `ADD COLUMN`): push'tan sonra deploy bitince Claude
    `check` → `apply` koşar ve `docs/ROUTEMAP.md`'deki sayıyı günceller.
  - **Veri değiştiren/silen** (`DROP`, `RENAME`, tip değişikliği, `NOT NULL`
    ekleme, `UPDATE`): uygulamadan önce sahibine sor.
- **`/gomulu/*` çerçevelenebilen TEK yol**; geri kalanı `X-Frame-Options:
  DENY` + `frame-ancestors 'none'` (`next.config.ts`).
- **GitHub iş akışları:** push'ta `deploy` (kapı) ve `smoke` (kapı değil);
  zamanlanmış `links`; elle `migrate`, `sync-app-env`, `sync-analysis-key`,
  `verify-analysis`, `test-mail`. Sunucuya dokunanlar `deploy-vps`
  sırasında bekler (`deploy.yml`, `concurrency`).
- **Zamanlanmış işler** `deploy/cron-install.sh`'te (`update.sh` her sürümde
  çalıştırır) — yeni iş oraya; uçları `app/api/cron/*`, `CRON_SECRET` ile.
- **Bildirim Web Push** (`lib/push.ts`, `public/sw.js`,
  `app/api/cron/alarmlar`, VAPID). Service worker yalnız bildirim taşır:
  `fetch` dinleyicisi/önbellek YOK (bayat fiyat = veri dürüstlüğü 2). Kayıt
  yalnız Ayarlar'daki düğmeyle.
- **Şifre değişince açık oturumlar düşer** (`auth.ts`: JWT'de parola özetinin
  parmak izi, beş dakikalık süreç önbelleği). Şifre YAZAN her yeni yol
  `forgetPasswordFingerprint(userId)` çağırır; çağırmazsa çalınmış oturum beş
  dakika daha yaşar.
- **E-posta** (`lib/email.ts`, Resend, SDK'sız):
  - Şifre sıfırlama: anahtar yoksa "Şifremi Unuttum" basılmaz; her adrese
    aynı yanıt, gönderim `after` ile; satırda bağlantının SHA-256 özeti.
  - Bildirim postası TEK KAPIDAN: `sendNotificationEmail`
    (`lib/email-notify.ts`) — tercih, çift onaylı adres (`confirmedEmail`;
    yalnız alarm — pazar özeti bütün üyelere varsayılan açık ve onaysız,
    `enrollWeeklyDefault`), günlük bütçe (`EMAIL_DAILY_BUDGET`, varsayılan
    80; Resend ücretsiz katmanı günde 100) ve `dedupeKey`. Kendi başına
    `sendEmail` çağıran bildirim yolu açma.
  - Yeni posta türü = KVKK metni + şablon (`lib/notify-emails.ts`) +
    `emailNotify` sözlüğü + çıkış kapsamı.
- **Tek `eslint-disable` istisnası:** `components/news/NewsImage.tsx`'teki iki
  `@next/next/no-img-element`. `next/image` her haber CDN'i için
  `remotePatterns` ister; tek kapsayıcı yol `hostname: "**"` ve o,
  `/_next/image`'ı herkese açık görsel proxy'sine çevirir. Yeni bir
  `eslint-disable` bu kadar sağlam gerekçe ister.

## Arayüz Metni ve Diller

- **Tailwind v4**: `tailwind.config.ts` yok, tokenlar `app/globals.css` →
  `@theme inline`.
- **Arayüz metni** `lib/i18n/dictionaries/{tr,en}.ts`; `en`, `typeof tr` —
  `tr`'ye eklenen anahtar `en`'i derletmez, ikisi birlikte. **Her özellik
  kendi ad alanında** (`glossary`, `stockDepth`, `lira`…; büyük özellikler
  aynı dizinde kendi dosyasında); var olana anahtar serpiştirme.
- **Çevirisi eksik olabilen içerik** (mercek, analiz, bülten, teknik): aynı
  dil listesi hem `pageAlternates`e hem `articleOpenGraph`a (`availableLocales`)
  gider; site haritası da yalnız o dilleri yazar. Canonical, hreflang ve
  `og:locale` metnin dilini söyler, arayüzünkini değil (`lib/site.ts`).

## Küçük ama Kritik

- Sayfa içi filtre/sıralama bağlantıları `scroll={false}`.
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

- **`.env.local`'deki `DATABASE_URL` CANLI Neon** — gerçek üyeler ve
  rutinlerin yazıları. Yerelde koşan `db:seed`, `db:migrate` ve her geçici
  betik üretime yazar. Seed yeni kod canlıdayken koşar; migration SQL'i
  koşmadan önce okunur (§ Altyapı).

Boş sağlayıcı anahtarında kartlar "veri alınamadı" der, sayfa çökmez —
beklenen. Grafik eksikse önce anahtara bak (`/api/debug/providers`).
`BRIEF_SECRET`/`CRON_SECRET` boşsa korumalı uçlar geliştirmede açık, üretimde
503 (`lib/api-auth.ts`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
