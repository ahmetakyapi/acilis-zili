# Açılış Zili — Claude Code notları

Kararların gerekçesi kod içi yorumlarda yaşıyor ve oralar birer karar
kaydıdır, silme. Bu dosya yalnızca **her oturumda bilmen gerekenleri** taşır.

## Hızlı komutlar

```
npm run dev         # geliştirme (3000 doluysa 3001'e düşer)
npm run typecheck   # tsc --noEmit  ·  `npx tsc` ÇALIŞMAZ
npm run lint
npm run build       # route tipleri bozulursa önce `rm -rf .next`
npm run db:generate # şema değişti → YENİ migration dosyası, eskiyi düzenleme
npm run db:migrate  # migration'ları uygula
npm run db:seed     # takvim kapsamı azaldığında uyarı basar
```

**Temiz bir kopyada önce `npm run build` çalıştır.** `PageProps` ve
`RouteContext` tipleri Next 16 tarafından `.next/types` altına üretiliyor ve
ikisi de gitignore'da. Build almadan `npm run typecheck` çalıştırırsan
"Cannot find name 'PageProps'" diye onlarca hata alırsın — kodda bir sorun
olduğu için değil, tipler henüz üretilmediği için.

## Yazım kuralı: Title Case

Vurgu taşıyan her metin **Title Case** yazılır. Kapsam:

- Sayfa başlıkları, bölüm ve panel başlıkları, kart başlıkları
- Buton ve bağlantı metinleri ("Tümünü Gör", "Hesabımı Sil", "Tekrar Dene")
- Kategori, filtre, sekme ve rozet etiketleri
- Tablo başlık satırları ve etiket görevi gören ilk sütun hücreleri
- Rehber ve mercek yazılarındaki `##` / `###` başlıkları
- Kısa vurgulu ifadeler ("Yatırım Tavsiyesi Değildir")

Kural **künyeleri ve birimleri de kapsar**. Bir süre "ölçü altındaki mikro
künyeler" muaf tutuldu ("olaydan bugüne", "15 dk gecikmeli", "0,05 puan") ve
sonuç tutarsızlıktı: aynı ekranda Title Case bir rozetin altında küçük harfle
başlayan bir künye duruyordu. Artık **cümle olmayan her metin Title Case**:
"Olaydan Bugüne", "15 Dakika Gecikmeli", "0,05 Puan", "20:04 Güncellendi",
"56 Analist", "Takipte", "Önbellek".

Title Case OLMAYAN yerler — bunlar cümledir, başlık değil:

- Paragraflar, açıklama satırları, kart altı ipuçları
- Boş durum ve hata **mesajları** (başlıkları Title Case, gövdeleri değil)
- Yer tutucu metinleri (`placeholder`) ve `aria-label` cümleleri
- Sayı + isim kalıbındaki tam cümleler ("819 şirketin 60 tanesi",
  "son 40 haberden seçildi") — bunlar bir künye değil, kısa bir cümle
- Geri sayımın birim ekleri (`17 sa 59 dk 53 sn`) — orada küçük harf,
  dev puntolu sayının yanında bilinçli bir tipografik karar

Türkçe Title Case: bağlaç ve edatlar (ve, ile, için, de/da, mi) küçük kalır,
başta gelirse büyür. "Faiz, Tahvil ve Getiri Eğrisi" · "Ne Kadar, Ne Zaman"
`title()` / `capitalize` KULLANMA — `i → I` üretir, `İ` değil; küçültürken de
`toLocaleLowerCase("tr-TR")` kullan.

## Görsel dili

**Fotoğraf yok.** Yazıların görseli, metinden çizilen `:::` bloklarıdır: model
yalnızca satırları yazar, çizimi site yapar. Telif riski yok, hiçbir yerde
görsel barındırmak gerekmiyor, her temada tutarlı. Şema bir kez `image_url`
alanı aldı (migration 0004) ve hemen geri alındı (0005) — gerekçesi
`lib/schema.ts` yorumunda.

Blok ailesi `components/article/ArticleBody.tsx` içinde:
`sayilar` · `bar` · `pay` · `akis` · `oncesi` · `zaman` · `grafik`, artı dört
metin kutusu `ornek` · `dikkat` · `ozet` · `tanim`. Sözdizimi ve yazım
kuralları `docs/claude-rutinler.md` § 3'te; rutin prompt'u oradan kopyalanıyor.

**Yeni blok eklersen ÜÇ yeri birden güncelle:** çizici (`ArticleBody.tsx`),
rutin prompt'u (`docs/claude-rutinler.md` § 3) ve panel editörünün çip
listesi (`components/admin/StoryEditor.tsx` → `BLOKLAR`). Çipler yazıya
örnek blok basıyor; listede olmayan blok editörden hiç eklenemez, listede
olup çizicide olmayan blok da sayfada düz metne döner.

**Görselin etrafında çerçeve yok.** Kenarlık ve iç dolgu, resmi kutunun
ortasında duran ayrı bir nesne gibi gösteriyor; görsel kutunun kendisi olmalı
(`overflow-hidden` + kendi köşe yarıçapı, `object-contain`/`object-cover`).
Kenarlık yalnızca görsel OLMAYAN yer tutucularda kalır. Elimizdeki tek gerçek
görsel kaynağı şirket logoları (`symbols.logo_url`, Finnhub): mercek kapakları
ve haber künyeleri ondan besleniyor.

## Düzen: ölçmeden değiştirme

Yerleşim kararları tahminle verilmiyor. Bir boşluk "fazla duruyorsa" önce
ölçülür, sonra değiştirilir ve **ölçüm yoruma yazılır** ki bir daha
ölçülmesin. Chrome'u başsız koşturup rota × genişlik matrisini tarayan
geçici betikler bunun için var (`.tmp-*.mjs`, commit'lenmez).

**`justify-between` iki kolona konmaz.** Ana sayfanın iki kolonu bir süre
onu taşıdı ve sonuç şuydu: ızgara satırı iki kolonu aynı yüksekliğe geriyor,
kısa olan kolon aradaki farkı PANEL ARALARINA dağıtıyor. Yani aralık kendi
ölçüsü olmaktan çıkıp öteki kolonun boyuna bağlanıyor — sağ kolon kısayken
oradaki boşluklar 20 pikselden 92'ye, sağ dolduğunda bu kez sol kolonun
aralıkları 35 piksele çıkıyordu. Panel eklemek sayfanın ÖTEKİ tarafındaki
boşlukları oynatıyordu. Aralık her zaman `gap-5`; kısa kolon erken biter ve
iki sütunlu bir düzende olması gereken de budur.

**Kolonun dibi kutusunun dibi değildir.** Izgara satırı kolonları aynı
yüksekliğe gerdiği için `kolon.getBoundingClientRect().bottom` ikisinde de
aynı sayıyı verir. İçeriğin gerçekten bittiği yer SON ÇOCUĞUN dibidir;
kolon boyu ölçen her hesap onu okumalı (bkz. `components/today/FillColumn.tsx`).

**Boşluk esnetilmez, doldurulur.** Kısa kalan kolon, kırpılmış bir listeye
satır açarak dengelenir: sunucu tavan kadar satır basar, fazlası `hidden`
gelir ve tarayıcı kaçının sığdığını ölçüp o kadarını açar. JavaScript
kapalıyken taban satır sayısı kalır ve hiçbir şey zıplamaz — açılan satırlar
zaten boş olan alana iner.

Doldurma İKİ YÖNLÜ ve kapasite iki kolonda da var (`LatestAnalyses` solda,
`WeekAhead` ile favoriler sağda). Bir dönem yalnızca sağ kolonu
dolduruyordu — kısa kalanın hep o olduğu varsayılmıştı — ve bilanço açıklayan
şirketin olmadığı bir günde sol kolon 127 piksel açıkta kalıyordu.

**Gözlemci kolonu değil PANELLERİ izler.** Izgara satırı iki kolonu aynı
yüksekliğe geriyor, yani kolonun kutusu UZUN kolonun boyuna kilitli: kısa
kolonun içindeki bir panel akışla gelip büyüdüğünde hiçbir kolon kutusu
değişmiyor ve `ResizeObserver` hiç ateşlenmiyor. Doldurma o zaman ilk
karedeki (paneller henüz inmemiş) ölçüye göre karar verip orada kalıyor;
belirtisi, aynı sayfanın aynı genişlikte bazen dolup bazen dolmamasıdır.

## Saat kuralı: TR önce

Kaynakların tamamı New York saatiyle yayın yapıyor ama okuyucu Türkiye'de.
`lib/session-clock.ts` tek kaynak: TR dilinde birincil saat İstanbul, ikincil
New York; EN'de sıra tersine döner. Fark ABD yaz saatiyle kaydığı için hiçbir
yere sabit saat yazılmaz, o günün tarihiyle hesaplanır (açılış yazın 16:30,
kışın 17:30 TR). Seansın kendi saati `lib/market-hours.ts`'te kalır — ET↔UTC
dönüşümünün tamamı orada, başka yerde manuel saat aritmetiği yapılmaz.

## İstemci ile sunucu sınırı

**`"use client"` bir modülden dışa aktarılan DEĞER sunucu bileşenine gerçek
değer olarak gelmez** — Next onu bir istemci referansına çevirir ve sonuç
sessizdir: ne derleme ne çalışma zamanı konuşur. Renk sabitleri bu yüzden
`lib/chart-series.ts`te, aralık sözleşmesi `lib/compare.ts`te duruyor; ikisi
de `"use client"` değil ve iki taraftan da okunuyor.

**Sunucu bileşeni istemci sağlayıcıya `children` olarak geçebilir.** Aralık
karşılaştırma ekranında böyle çalışıyor: sağlayıcı istemci ama sardığı ağacın
çoğu sunucuda çiziliyor, yalnızca aralığa BAĞLI hücreler istemci. Tabloyu
bütünüyle istemciye taşımak aralıkla hiç değişmeyen beş ölçü bloğunu da
tarayıcıya indirmek olurdu.

**Sığ adres güncellemesi uçuştaki gezinmeyi ÖLDÜRÜR.** Next'in yamalı
`history.replaceState`i o sırada bekleyen bir gezinmeyi sessizce iptal
ediyor — geri gelmiyor, yeniden denenmiyor, hata da vermiyor. Sığ güncelleme
yapan bir denetim, gezinme sürerken kendini kapatmak zorunda
(`useRouteNavigating`, `components/layout/RouteProgress.tsx`).

**Sığ güncelleme geçmiş girdisini tazelemez.** O adres için sunucudan RSC
yükü çekilmediği için geri tuşu ÖNCEKİ durumun ağacını geri yükler. Adresten
okunan bir durum, prop'tan değil ADRESTEN başlatılmalı; prop yalnızca sunucu
çiziminde geçerlidir.

**`getQuotes` ve `getSymbolNames` istek içinde önbellekli ve anahtar
sıralanmış sembol dizesi.** İki panel birebir aynı listeyi sorarsa
sağlayıcıya bir kez gidilir; listede tek bir sembol farkı anahtarı değiştirir
ve tur ikiye çıkar. Aynı ekranda iki panel aynı veriyi gösteriyorsa aynı
anahtarı sormalı — yoksa aynı hissenin iki farklı yüzdesi yan yana durabilir.

Bu cümle bir dönem `getSeries`i sayıyordu ve YANLIŞTI: o düz bir `async
function`, `cache()` sarmalı yok ve argümanı sembol listesi değil bir
`SeriesRequest`. Makro serilerde istek-içi tekilleştirme YOK; oradaki tek
koruma `fetch`in kendi veri önbelleği (`revalidate`), yani farklı bir
mekanizma. `cache()` ile sarılı olanların tam listesi: `lib/data.ts`
(`getHolidays`, `getStatus`, `getEventsBetween`, `getEarningsBetween`,
`getNewsById`, `getStoryBySlug`, `getAnalysis`, `symbolNamesForKey`,
`isKnownSymbol`), `lib/admin.ts`
(`getAdmin`), `lib/admin-data.ts` ve `lib/providers/index.ts`
(`quotesForKey`).

## Veri dürüstlüğü

Üçü de birer hata düzeltmesinden geldi; yenisini yazarken bunları koru:

1. **Uydurma kesinlik yok.** Sağlayıcı dakika vermiyorsa saat `~` ile yazılır
   ve hangi pencere olduğu adıyla söylenir (bilanço satırları: "~23:00 ·
   kapanış sonrası").
2. **Eski veriyi büyük puntoyla gösterme.** Brent kartı FRED'in EIA spot
   serisinden geliyordu ve o seri günlerce geriden yayımlanıyor; ekranda bir
   haftalık eski fiyat duruyordu. Küçük puntoda tarih yazmak bunu kurtarmaz —
   metrik kaldırıldı.
3. **Aynı sayı iki yerde duruyorsa aynı kaynaktan gelmeli.** Hisse başlığı
   anlık kotasyonu, grafik son dakika barının kapanışını yazıyordu; ikisi
   tanımı gereği farklı sayılar ve yan yana durunca hata gibi okunuyor.

## Commit'leme

**Bir oturumda iki-üç commit.** Her mikro düzeltme ya da her ekran için ayrı
commit atma; kullanıcı arka arkaya iş sıraladığında hepsini bitir, sonra
konu bazında topla. Ölçü: yapılanlar tek bir başlıkta özetlenebiliyorsa tek
commit; "görsel iyileştirme" ile "performans" gibi iki farklı alan varsa iki.

Commit'ten önce üçü de temiz olmalı: `npm run typecheck`, `npm run lint`,
`npm run build`. Görsel bir değişiklikse ayrıca tarayıcıda ölçülmüş olmalı —
"sığıyor gibi duruyor" bir doğrulama değil.

Mesele commit SAYISI, mesaj detayı değil — gövdede her değişikliğin gerekçesi
ayrı paragraf olarak yazılmaya devam eder. Sekiz-on küçük commit geçmişi
taranamaz hâle getiriyor.

## Belgeli istisna: `eslint-disable`

Ekosistem kuralı `eslint-disable` yorumunu yasaklıyor ("sorunu düzelt").
Depoda **tek** istisna var ve gerekçesi güvenlik: `components/news/NewsImage.tsx`
iki yerde `@next/next/no-img-element` kuralını kapatıyor.

Haber görselleri onlarca farklı haber CDN'inden geliyor ve `next/image` her
host için `remotePatterns` kaydı istiyor. Hepsini kapsamanın tek yolu
`hostname: "**"` ve o da `/_next/image` ucunu HERKESİN kullanabileceği bir
görsel proxy'sine çevirir. Şirket logosu dalı da kurtulmuyor: `logoSrc`
bilinen sembollerde yerel dosya döndürüyor ama bilinmeyende Finnhub'ın uzak
adresine düşüyor.

Yani buradaki "sorunu düzeltmek" optimizasyon için bir güvenlik açığı açmak
olurdu. Kural yerinde; istisna da yerinde ve tek. Yeni bir `eslint-disable`
eklemeden önce bu paragraf kadar sağlam bir gerekçe yazılabiliyor mu diye bak.

## Bilinmesi gerekenler

- **Depo herkese açık.** `BRIEF_SECRET` ve `CRON_SECRET` asla commit'lenmez.
  Gerçek değerlerin bulunduğu `docs/rutinler.local.md` `*.local.md` deseniyle
  gitignore'da; commit öncesi staged diff'i secret'a karşı tara.
- **Tailwind v4** — `tailwind.config.ts` yok, tokenlar `app/globals.css`
  içindeki `@theme inline` bloğunda. Hardcoded renk yasak.
- **Tema** next-themes değil, `data-theme` + `az-theme` çerezi.
- **Arayüz metni** sözlükte: `lib/i18n/dictionaries/{tr,en}.ts`. `en`, `tr`
  tipinden türüyor — `tr`'ye anahtar eklersen `en` derlenmez, ikisini birlikte
  güncelle.
- **Rehber yazıları** depoda (`content/guide/`), **mercek yazıları**
  veritabanında (`stories` tablosu). `/api/mercek` POST ile yazılır, aynı uç
  `?slug=` ile gövdeyi geri okur — rutin güncelleme yaparken onu kullanıyor.
- **İçeriğin yazma yolu TEK: `lib/content-write.ts`.** Doğrulama şeması,
  sürüm fotoğrafı ve upsert orada; `/api/mercek`, `/api/brief` ve panelin
  sunucu eylemleri (`app/actions/content.ts`) hepsi oradan geçiyor. Bir dönem
  "panelden içerik yazılmasın" kararı vardı ve gerekçesi ikilikti — iki
  doğrulama, iki biçim kontrolü, ayrı düşen iki kod yolu. Karar
  savuşturulmadı, gerekçesi ortadan kaldırıldı; yeni bir giriş eklerken de
  aynı kural: şema ve yazma tek yerde kalır.
  Panelden **yeni kayıt üretilmiyor**, yalnızca var olan düzeltiliyor:
  mercek `/admin/yazilar/mercek/[slug]`, bülten
  `/admin/yazilar/bulten/[tarih]?tur=haftalik&dil=en`. Üzerine yazılan hâlin
  fotoğrafı `story_revisions`a düşüyor (bülten anahtarı
  `bulten:{tarih}:{donem}` — mercek slug'ıyla çakışamaz, slug şeması iki
  nokta üst üste kabul etmiyor).
  Panel sekmelerinden **İçerik ÖLÇER, Yazılar DEĞİŞTİRİR** — biri sağlık
  panosu (sayım, eksik çeviri, yayın ritmi), öteki editör girişi.
- **Bilanço analizleri** de veritabanında (`earnings_analyses`) ve aynı
  köprüden geliyor: `/api/analiz` POST yazar, `?symbol=&period=` geri okur,
  `/api/analiz/context` rutine aday listesi verir. Rutin promptu
  `docs/claude-rutinler.md` § 4'te. Sayılar **ham** tutulur (8.97e9), metin
  alanları dile göre; sunum katmanı biçimlendirir.
  Bilançolar ekranı üç sekmedir — Takvim (`/bilancolar`), Analizler
  (`/bilancolar/analizler`), Takip Ettiklerim (`/bilancolar/takip`); detay
  `/bilancolar/{sembol}/{donem}`. Sekme çubuğu paylaşılan bir layout'ta
  DEĞİL, üç sayfanın her biri kendi basıyor: detay sayfası aynı segmentin
  altında ve orada sekme istenmiyor.
- **İçerik iki dilli.** Rehber: `content/guide/` üç katman (meta + tr + en),
  eksik çeviri derlemeyi kırar. Mercek: aynı slug iki `locale` satırı; çeviri
  yoksa sayfa orijinali "TR" rozeti ve notla gösterir, boş kalmaz.
- **Sayfa içi filtre ve sıralama bağlantıları `scroll={false}` ister.** App
  Router her gezinmede en üste kaydırıyor; tablonun ortasında sıralamayı
  değiştiren okuyucu sayfanın başına fırlıyordu.
- **Mobilde sabit katmanlar güvenli alanı kendi taşır** (`env(safe-area-inset-*)`).
  Sayfa `viewport-fit=cover` ile açılıyor: dolgu eklenmezse başlık çentiğin
  altında kalıyor.
- **Yatay taşma** düzenli kontrol edilir; puppeteer koşumu route × genişlik
  matrisini tarar (`.tmp-*.mjs` geçici dosyaları commit'lenmez).
- **Karşılaştırma ekranı üç dosyaya yayılı.** Ortak sözleşme (aralık listesi,
  sembol sınırı, adres biçimi, dönem getirisi hesabı) `lib/compare.ts`te ve
  üç yerden okunuyor: sunucu sayfası, istemci denetimi
  (`components/markets/CompareLive.tsx`) ve toplu bar ucu
  (`app/api/karsilastir/route.ts`). Aralık İSTEMCİDE değişiyor; sunucuya bir
  daha gidilmiyor, barlar aralık başına önbelleğe alınıyor ve düğmenin
  üzerinde durmak isteği önden başlatıyor.
- **Makale kutularında `**Etiket:**` kalıbı yapıdır.** `:::` metin kutusunda
  bu kalıpla başlayan satır terim ve metne bölünüp tanım listesi olarak
  çiziliyor (dar ekranda iki satır, geniş ekranda iki sütun). Kalıba uymayan
  satır sıradan paragraf kalır — rehberdeki serbest paragraflı tanım kutuları
  etkilenmiyor.
- **Grafikte dokunulan okuma aralıkla temizlenir.** Dokunmatikte imleç
  okuması grafiğin dışına dokunulana kadar ekranda kalıyor; aralık düğmeleri
  grafiğin dışında değil ve temizlenmezse okuma satırı artık var olmayan bir
  barı göstermeye devam ediyor.
- **Rota listesi tek yerde: `README.md`.** `docs/ROUTEMAP.md` bir dönem
  ikinci bir rota tablosu tutuyordu ve tam da bu yüzden güncelliğini yitirdi — on üç
  rota eksik kalmıştı. O dosya artık yalnızca DURUM tutuyor: canlıda ne var,
  ne yarım kaldı, ne bilinçli olarak yapılmadı.

## iCloud kopyaları — derlemeyi kırar

Depo iCloud Drive'a bağlı bir klasörde (Masaüstü senkronu). Senkron bir
dosyayı iki yerde değişmiş görünce ikinci bir kopya bırakıyor: `alpaca 2.ts`,
`routes.d 5.ts`, `.gitignore 3`. Kopyalar eski sürüm taşır, hiçbir yerden
import edilmez ama `.next/types` altına düştüklerinde TypeScript onları da
okur ve derleme `TS6200: Definitions … conflict` ile kırılır — hata koddan
değil dosya sisteminden gelir.

`npm run typecheck` ve `npm run build` bu yüzden önce
`scripts/clean-sync-dupes.mjs` çalıştırıyor; ayrıca `.gitignore` deseni
kopyaların commit'e girmesini engelliyor. Kalıcı çözüm kaynakta: Sistem
Ayarları → Apple Hesabı → iCloud → iCloud Drive → "Masaüstü ve Belgeler
Klasörleri" kapatılırsa hiç oluşmazlar.

## Yerelde çalışırken

`.env.local` içindeki bazı sağlayıcı anahtarları boş olabilir. O zaman ilgili
kartlar "veri alınamadı" gösterir ve **sayfa çökmez** — beklenen davranış bu.
Grafik ya da eğri eksikse önce anahtara bak (`/api/debug/providers`), koda
değil. `BRIEF_SECRET` yerelde boşsa korumalı uçlar geliştirmede açıktır
(`lib/api-auth.ts`); üretimde anahtar yoksa uç 503 döner, açık kalmaz.
