# Açılış Zili · Opening Bell

ABD borsaları için Türkçe günlük takip platformu: **zil çalmadan önce bugünü gör.**

Ekonomik takvim, bilanço tarihleri, canlı fiyat ve grafikler, makro göstergeler,
haber akışı ve kişisel takip listeleri — hepsi saatleriyle tek ekranda. Üstüne
her gün yazılan bir bülten, olay bazlı uzun anlatımlar ve bilanço analizleri.

İki dil (TR/EN), açık ve koyu tema, tam mobil uyum. Ücretsiz, reklamsız, açık kaynak.

**Canlı:** [acilis-zili.vercel.app](https://acilis-zili.vercel.app)

---

## Ne yapar

Beş konu başlığı var ve her biri ayrı bir soruya cevap veriyor.

### Piyasayı takip et

Endeksler (S&P 500, Nasdaq 100, Dow, Russell 2000), günün seans haritası ve
açılışa geri sayım, gün içi en çok yükselen ve düşen isimler, piyasa
genişliği, ABD tahvil faizleri ve getiri eğrisi, VIX korku endeksi, dünya
piyasaları. Ana sayfa bunu tek ekranda topluyor; `/piyasalar` aynı soruyu
endeks bileşenlerine kadar iniyor.

### Şirketleri ve hisseleri incele

Her hisse için gün içinden beş yıla kadar grafik (alan ya da mum), şirket
profili, değerleme ve risk ölçüleri (F/K, temettü, beta, net kâr marjı, 52
hafta bandı), analist tavsiye dağılımı ve hedef fiyat, o şirkete ait haberler
ve geçmiş bilanço sürprizleri. `/sirketler` 800'ü aşkın şirketi sektör
şeridiyle ve sıralanabilir bir dizinle veriyor; `/karsilastir` iki ile dört
hisseyi **aynı ölçekte** yan yana koyuyor — normalize tek grafik ve getiri,
değerleme, risk, şirket künyesi olmak üzere dört öbekli tek tablo.

### Bilançoları izle

Kim ne zaman açıklıyor (açılış öncesi mi kapanış sonrası mı), analist EPS ve
gelir beklentisi ne, gerçekleşen ne çıktı. Takvimi kendi takvimine `.ics`
olarak ekleyebiliyorsun. Açıklanan çeyrekler için ayrıca uzun analizler var:
skor, görüş, hedef fiyat, güçlü yönler ve riskler, beklenen gelişmeler.

### Ekonomik veriyi ve makroyu oku

CPI, çekirdek enflasyon, FOMC kararları ve basın toplantıları, tarım dışı
istihdam, işsizlik, PCE — takvimde saatleriyle, beklenti ve gerçekleşen
değerleriyle. `/makro` altı FRED serisini sparkline ve bir sonraki açıklama
tarihiyle gösteriyor. Önümüzdeki altı haftanın halka arz takvimi de burada.

### Haberleri ve analizleri takip et

Piyasa haber akışı, sembol süzgeciyle ve siteden çıkmadan okunabilir hâlde.
Üstüne her gün yazılan bir bülten (haftalık özeti pazartesi), olayın
arkasındaki **mekanizmayı** anlatan uzun yazılar ve borsayı sıfırdan
öğreten sıralı bir rehber.

Bir de kişisel taraf: çoklu takip listeleri, renkli etiketler, ana sayfada
kendi listenin özeti ve yalnızca senin izlediklerinin bilanço takvimi.

---

## İki kurucu karar

Ürünün geri kalanı bu iki karardan türüyor.

### Saat Türkiye saatiyle

Bütün kaynaklar New York saatiyle yayın yapıyor. Bir bilançonun "after the
close" açıklanacağını bilmek yetmiyor; okuyucunun kafasında bunu 23:00'a
çevirmesi gerekiyor — üstelik ABD yaz saati kaydıkça bu dönüşüm yılda iki kez
değişiyor. Bu üründe **birincil saat İstanbul**, New York künyede durur;
İngilizceye geçince sıra tersine döner. Hiçbir yere sabit saat yazılmaz, o
günün tarihiyle hesaplanır (açılış yazın 16:30, kışın 17:30 TR).

### Ekranda uydurma sayı yok

Ücretsiz sağlayıcılar dünyayı yarım gösteriyor ve bu proje eksik veriyi
gizlemek yerine **söylemeyi** seçiyor. Veri yoksa kart boş durur; her kartın
altında `kaynak · saat` damgası vardır; gecikmeli besleme gecikmeli olduğunu
yazar; sağlayıcı dakika vermiyorsa saat `~` ile yaklaşık yazılır ve hangi
pencere olduğu adıyla söylenir. Bir metrik dürüstçe gösterilemiyorsa
gösterilmez — Brent kartı bu yüzden kaldırıldı.

---

## Ekranlar

29 sayfa rotası var; hepsi istek başına sunucuda çiziliyor (kök layout dili ve
temayı çerezden okuduğu için statik ön çizim yapılmıyor).

### Ana akış

| Rota | Cevapladığı soru |
|---|---|
| `/` | Zil çalmadan önce bugün ne var — gün şeridi, geri sayım, endeksler, takvim, bilançolar, bülten, favoriler, haberler |
| `/piyasalar` | Piyasanın nabzı ne — endeksler, tahvil faizleri, korku endeksi, gün içi hareket, endeks bileşenleri |
| `/sirketler` | Hangi şirket hangi sektörde, ne kadar ediyor — sektör şeridi + sıralanabilir dizin |
| `/hisse/[symbol]` | Bu şirket nasıl gidiyor — grafik, profil, metrikler, analist dağılımı, haber, geçmiş bilançolar |
| `/karsilastir` | İki ile dört hisseden hangisi — aynı ölçekte normalize grafik + tek tablo |
| `/makro` | ABD ekonomisi nerede — altı FRED serisi, sparkline, sonraki açıklama |
| `/takvim` | Hangi makro veri ne zaman açıklanacak — gün/hafta/ay, önem filtresi, halka arz takvimi |
| `/haberler` · `/haberler/[id]` | Bugün ne konuşuluyor — akış + siteden çıkmadan okuma |

### Bilançolar

Üç sekme ve bir detay. Sekme çubuğu paylaşılan bir layout'ta değil, üç sayfanın
her biri kendi basıyor — detay sayfası aynı segmentin altında ve orada sekme
istenmiyor.

| Rota | Soru |
|---|---|
| `/bilancolar` | Kim ne zaman açıklıyor — hafta/ay, açılış öncesi ve kapanış sonrası rozetleri |
| `/bilancolar/analizler` | Okunmuş çeyrekler — skor, görüş, hedef fiyat |
| `/bilancolar/takip` | Benim izlediklerimin bilançoları |
| `/bilancolar/[symbol]/[period]` | Bu çeyrek ne anlattı — tam analiz |

### Okuma

| Rota | Soru |
|---|---|
| `/mercek` · `/mercek/[slug]` | Olayın arkasındaki mekanizma neydi — uzun anlatım arşivi |
| `/rehber` · `/rehber/[slug]` | Borsayı nereden öğrenirim — sıralı müfredat |
| `/bulten` | Dünkü ya da geçen haftaki bülteni okuyayım |

### Hesap ve yönetim

`/giris` · `/kayit` · `/favoriler` · `/ayarlar` · `/menu` · `/kvkk`, ve kabuğun
dışında beş yönetim ekranı (`/admin`, `/admin/icerik`, `/admin/sistem`,
`/admin/trafik`, `/admin/uyeler`). Yönetim yetkisi ortam değişkeninde değil
veritabanında; yetkisiz istek **404** görür — "yetkiniz yok" demek panelin
varlığını ele verirdi.

### İngilizce

Her sayfa ikinci bir adreste daha var: `/en/<aynı slug>`. Önek sunucuda
sökülüyor ve dil bir başlıkla taşınıyor; tarayıcının adresi `/en/...` kalıyor.

---

## Teknoloji

| Katman | Seçim |
|---|---|
| Framework | Next.js 16 · App Router · Turbopack |
| Dil | TypeScript, `strict` |
| Stil | Tailwind CSS v4 — `tailwind.config` yok, tokenlar `app/globals.css` içindeki `@theme inline` bloğunda |
| Tema | Custom `data-theme` + `az-theme` çerezi (`next-themes` kullanılmıyor) |
| Grafik | TradingView lightweight-charts v5 (hisse) · elle çizilen SVG (karşılaştırma, sparkline, makale blokları) |
| Veritabanı | Neon PostgreSQL + Drizzle ORM |
| Auth | next-auth v5 — Credentials + bcrypt, JWT |
| İkon | Phosphor (duotone) |
| Yazı tipi | Schibsted Grotesk — tek aile, değişken 400–900 |
| Barındırma | Vercel + Vercel Cron |

---

## Mimari

### Sunucuda model çağrısı yok

Sitenin yazılı içeriğini (bülten, mercek yazıları, bilanço analizleri) claude.ai
üzerindeki zamanlanmış görevler üretir ve korumalı uçlara **yazar**. Sunucu
yalnızca veritabanından okur; kodda hiçbir model çağrısı ve model anahtarı
yoktur. Yayın gecikirse ekran en son yazılanı gösterir ve yenisinin ne zaman
geleceğini söyler.

### Üç katmanlı veri, uydurma yok

Her sağlayıcı çağrısı sırayla üç kapıdan geçer: **canlı sağlayıcı → yedek
sağlayıcı → Neon'daki son bilinen değer.** Hiçbir aşamada uydurma değer
üretilmez. Sağlayıcı fonksiyonları asla `throw` etmez, hatayı değer olarak
döndürür; çağıran kart "veri alınamadı" gösterir ve sayfanın geri kalanı
çalışmaya devam eder. Önbelleğe düşüldüğünde kaynak `cache` olur ve ekrandaki
damga "güncel olmayabilir" der.

Bu kuralın üç maddesi kod içinde de yazılı ve üçü de birer hata düzeltmesinden
geldi:

1. **Uydurma kesinlik yok.** Sağlayıcı dakika vermiyorsa saat `~` ile yazılır ve
   hangi pencere olduğu adıyla söylenir ("~23:00 · kapanış sonrası").
2. **Eski veriyi büyük puntoyla gösterme.** Brent kartı FRED'in EIA spot
   serisinden geliyordu ve o seri günlerce geriden yayımlanıyor; ekranda bir
   haftalık eski fiyat duruyordu. Küçük puntoda tarih yazmak bunu kurtarmaz —
   metrik kaldırıldı.
3. **Aynı sayı iki yerde duruyorsa aynı kaynaktan gelmeli.** Hisse başlığı anlık
   kotasyonu, grafik son dakika barının kapanışını yazıyordu; ikisi tanımı gereği
   farklı sayılar ve yan yana durunca hata gibi okunuyordu.

### Önbellek sunucuda paylaşımlı

Kotasyon tazeliği seansa göre değişir: seans içinde 15 saniye, uzatılmış seansta
60, kapalıyken 15 dakika. Önbellek ziyaretçi başına değil sunucuda paylaşımlı
olduğu için sağlayıcıya giden istek trafikle değil yalnızca bu süreyle artıyor —
15 saniyede dakikada dört istek, Alpaca'nın 200/dk sınırının çok altında.

İstek içinde ayrıca `cache()` ile tekilleştirme var ve anahtar **sıralanmış
sembol dizesi**: iki ayrı panel aynı listeyi sorduğunda sağlayıcıya bir kez
gidilir. Bu hız kadar doğruluk meselesi — ayrı çekilselerdi aynı ekranda aynı
hissenin iki farklı yüzdesi durabilirdi.

### Görsel dili metin çiziyor

Yazıların fotoğrafı yok. Görsel dili, metinden çizilen `:::` bloklarıdır: model
yalnızca satırları yazar, çizimi site yapar.

```
::: sayilar Rakamlarla
%5,31 | 30 yıllık faiz, pazartesi
2007 | bu seviyenin son görüldüğü yıl
:::
```

Yedi görsel blok (`sayilar` · `bar` · `pay` · `akis` · `oncesi` · `zaman` ·
`grafik`) ve dört metin kutusu (`ornek` · `dikkat` · `ozet` · `tanim`) var.
Karşılığı üç kazanç: telif riski yok, hiçbir yerde görsel barındırmak
gerekmiyor, her temada tutarlı. Şema bir kez `image_url` alanı aldı ve hemen
geri alındı.

Elimizdeki tek gerçek görsel kaynağı şirket logoları — mercek kapakları ve haber
künyeleri ondan besleniyor.

### Ölçmeden düzen değişmiyor

Yerleşim kararları tahminle değil ölçümle veriliyor ve ölçüm kod yorumlarında
kalıyor: hangi genişlikte kaç piksel taştığı, hangi CLS değerinin nereden
geldiği, hangi kontrast oranının kaça çıktığı. Kod içi Türkçe yorumlar birer
**karar kaydıdır** — ne yapıldığını değil neden yapıldığını ve hangi somut
hatanın onu doğurduğunu anlatırlar.

---

## Veri modeli

15 tablo. Kim yazar sütunu önemli: bir tablonun tazeliği onu yazanın ritmine bağlı.

| Tablo | Ne tutar | Kim yazar |
|---|---|---|
| `users` · `watchlists` · `watchlist_items` | Hesap, takip listeleri ve sembolleri | Kullanıcı eylemleri |
| `symbols` | Sembol künyesi: ad, borsa, sektör, logo, piyasa değeri, hisse sayısı | Tohum + cron profil turu + sayfa isteği |
| `quotes_cache` | Son bilinen fiyat — sağlayıcı düşünce gösterilecek yedek | Sayfa isteği |
| `candles_cache` | Aralık başına bar dizisi | Sayfa isteği |
| `earnings_calendar` | Bilanço takvimi + beklenti/gerçekleşen | Cron |
| `economic_events` | Ekonomik takvim (ET tarih + saat) | Tohum + cron |
| `market_holidays` | NYSE/Nasdaq tatilleri, yarım günde erken kapanış | Yalnız tohum |
| `macro_series` | FRED serisi + son 60 gözlem + sonraki yayın | Tohum (tanım) + cron (değer) |
| `news` | Haber akışı + çevirisi | Cron + hisse sayfası açılışı |
| `daily_briefs` | Günlük ve haftalık bülten | claude.ai rutini |
| `stories` | Mercek yazıları | claude.ai rutini |
| `earnings_analyses` | Bilanço analizleri — sayılar **ham** tutulur (8.97e9), sunum katmanı biçimlendirir | claude.ai rutini |
| `page_views` | Çerezsiz sayfa ölçümü | İstemci beacon |

Migration disiplini: şema değişince **yeni** migration dosyası üretilir, eskisi
düzenlenmez.

---

## Sağlayıcılar

| Sağlayıcı | Ne verir | Not |
|---|---|---|
| **Alpaca** | Anlık fiyat (`/snapshots`, `delayed_sip`) ve tarihsel barlar (`/bars`, `sip`) | Ücretsiz katman 200 istek/dk. 200 sembollük paketler paralel gider |
| **Finnhub** | Profil, haber, bilanço takvimi, halka arz, EPS sürprizi, analist dağılımı, metrikler, arama | 60 istek/dk. Grafik barları buradan **alınmaz** — ücretsiz katmanda güvenilmez |
| **FRED** | Makro seriler, tahvil faizleri, VIX | Yayın kimlikleri koda gömülmez, seri kimliğinden çalışma anında türetilir |
| **TCMB** | USD/TRY | Anahtarsız. Canlı değil, günde tek bülten — dönen veri bülten tarihini taşır |

Alpaca'ya geçiş ölçülerek yapıldı: bir dönem IEX beslemesi kullanıldı, gerçek
zamanlıydı ama konsolide hacmin yalnızca %2–7'sini görüyordu (bir ölçümde MRNA
için 3,67M / 199,3M) ve **ön seansta hiç işlem akmıyordu** — 05:58 ET'de "son
işlem" dünkü kapanıştı. Karşılığında 15 dakikalık gecikme kabul edildi ve ekranda
damgalanıyor.

Finnhub'ın üç tuzağı kodda kayıtlı: `marketCapitalization` milyon cinsinden ama
dolar değil ana borsanın parasında; `/stock/recommendation` sorulan sembolü değil
karşılık kotasyonu döndürebiliyor (TSM → "2330.TW"); hazır `peTTM` geriden gelen
bir fiyattan hesaplandığı için kullanılmıyor, oran ekranın kendi fiyatından
kuruluyor.

Tohumlanan veri elle bakılıyor çünkü ücretsiz katmanda karşılığı yok: NYSE
tatilleri (23 gün, üçü yarım), FOMC/CPI/istihdam takvimi, sembol listesi ve
endeks bileşimleri.

---

## İçerik üretimi

| Görev | Ne zaman | Nereye |
|---|---|---|
| Günlük bülten | her gün 16:00 TR | `POST /api/brief` → ana sayfa · Günün Özeti |
| Haftalık bülten | pazartesi 09:30 TR | `POST /api/brief` (`period: weekly`) → `/bulten` |
| Mercek yazısı | her gün 11:30 ve 23:30 TR | `POST /api/mercek` → `/mercek` |
| Bilanço analizi | her gün 09:00 TR | `POST /api/analiz` → `/bilancolar/analizler` |

Dördü de `BRIEF_SECRET` ile korunuyor ve her uç `?slug=` / `?symbol=&period=` ile
yazdığını geri okuyabiliyor — rutin güncelleme yaparken bu köprüyü kullanıyor.
Ayrıca üç `context` ucu rutine ham veri ve aday listesi veriyor.

Prompt'ların tamamı ve kurulum adımları `docs/claude-rutinler.md` içinde.
**Görevler koddan kurulamaz**, claude.ai arayüzünden elle kurulur.

---

## Görsel dil

- **Gölge yok.** Derinlik gölgeyle değil **ton farkıyla** kurulur; kartlar
  zeminden saydamlık ve tek hairline ile ayrılır. Glass/blur efekti de yok.
- **Hardcoded renk yok.** Her renk bir CSS değişkeni; açık ve koyu tema aynı
  token adlarını farklı değerlerle doldurur.
- **Tek yazı ailesi.** Ayrım punto ve ağırlıkla kurulur. Sayılar için ayrı bir
  mono aile denendi ve geri alındı: dokuz sütunlu bir tabloda daktilo
  genişliğindeki rakamlar hem yer yiyor hem satırı gürültülü gösteriyordu.
- **Degrade metin belgeli bir istisna:** yalnızca kısa display metninde,
  token'lanmış, `@supports` korumalı, solid fallback'li ve descender düzeltmeli.
- **Türkçe Title Case.** Cümle olmayan her metin Title Case yazılır. `title()` ve
  `text-transform: capitalize` yasak — `i → I` üretir, `İ` değil. Bağlaç ve
  edatlar başta değilse küçük kalır.

---

## Erişilebilirlik

Kod içinde on iki yerde WCAG kriter numarası geçiyor ve her biri gerçek bir
düzeltmeye bağlı:

- **2.1.1** — yatay kayan tablo kapları klavyeyle odaklanabilir; öncesinde fare
  olmadan sağ sütunlara ulaşılamıyordu.
- **2.4.1** — atlama bağlantısı ve `<main tabIndex={-1}>`; `tabIndex` olmadan odak
  `<body>`de kalıyor ve "İçeriğe Geç" hiçbir şeyi atlamıyordu.
- **2.4.11** — sabit katmanlar odaklanan öğeyi örtmesin diye `scroll-padding`;
  kırpan kaplarda `outline-offset: -2px`. Ölçüldü: `/haberler`de 99 odaklanabilir
  öğenin 62'sinin odak halkası kırpılıyordu.
- **2.5.3** — kısaltmalı denetimlerde erişilebilir ad görünen etiketi kapsar
  ("1A Son 1 Ay"); `aria-label` görünen metni ezmez.
- **AA kontrast** — ölçülmüş düzeltmeler: `--text-muted` 3,50 → 5,28; wash üzerine
  yazılan metin için ayrı bir `--primary-ink` token'ı (4,14 → 4,86); koyu tema
  yüzey rampası 1,03:1 kontrastla görünmezken açıldı.
- **Renk tek taşıyıcı değil.** Yön her zaman işaretle de söylenir (▲/▼ ya da
  +/−), grafik serileri renk körlüğünde ayrışsın diye kesikli çizilir.
- **Dokunma hedefi** telefonda 44 piksel, masaüstünde 32–36'ya iner. İki araç
  var ve hangisinin kullanılacağı yapıya bağlı:
  - `.tap-44` (`app/globals.css`) hedefi sözde öğeyle büyütür, görünür ölçüye
    ve düzene dokunmaz. Bir panel başlığındaki "Tümünü Gör" bağlantısını 44
    piksel yüksekliğinde çizmek satırı şişirirdi; hedef genişler, düzen
    kımıldamaz.
  - Öğe SARAN bir listenin içindeyse ya da `overflow: hidden` bir kabın
    altındaysa sözde öğe işe yaramaz — ilkinde alt satırın hedefini kapar,
    ikincisinde kırpılır. Orada gerçek yükseklik verilir (`min-h-11
    sm:min-h-8`) ve dikey aralık ona göre ayarlanır. Kaynak künyeleri ve
    menüdeki dil segmenti bu yoldan geçti.

  Kuralın dışında kalan tek şey bir cümlenin içine gömülü satır içi
  bağlantılar (bir paragraftaki "bilançonun" gibi); onları genişletmek
  satırları birbirine geçirir ve kural zaten muaf tutuyor (WCAG 2.5.8).
  Ölçüm otomatik değil, tarayıcıdan yapılıyor — bkz. Doğrulama.
- **Hareket** azaltılmış hareket tercihine saygı gösterir; piyasa şeridi hover,
  `prefers-reduced-motion` ve açık bir duraklat düğmesiyle durur.

---

## Performans

CLS ölçülerek düşürüldü. Ana sayfanın mobil CLS'i 0,25'ti — dokuz Suspense
sınırı tek bir elle yazılmış yüksekliği paylaşıyordu ve paneller akışla gelince
altındaki her şey sıçrıyordu. Çözüm yer tutucuyu **yükseklikle değil yapıyla**
eşleştirmek oldu: aynı dolgu, aynı satır düzeni, panel büyüdükçe onunla birlikte
kayan bir iskelet.

Uzun listeler kırpılıyor (S&P 500 bileşenleri tek sayfada 2,3 MB HTML üretiyordu)
ve sıralama dilimden **önce** yapılıyor. Değişmemiş satır veritabanına yeniden
yazılmıyor — şirketler dizininin sunucu yanıtının yarısı bu yazmadan geliyordu.

---

## Gizlilik

Sayfa ölçümü çerezsiz. IP, tam referrer, kullanıcı-ajanı ve kullanıcı kimliği
tutulmuyor; günlük dönen bir ziyaretçi özeti (IP + UA + gün + sır → 16 karakter)
saklanıyor ve 180 gün sonra siliniyor. Üçüncü taraf analitik yok.

---

## Kurulum

```bash
npm install
cp .env.example .env.local   # değerleri doldur — aşağıya bak
npm run db:migrate           # şemayı Neon'a uygula
npm run db:seed              # takvim + tatil + sembol tohumları
npm run dev
```

### Ortam değişkenleri

| Değişken | Zorunlu | Nereden |
|---|---|---|
| `DATABASE_URL` | evet | [neon.tech](https://neon.tech) → yeni proje → connection string |
| `AUTH_SECRET` | evet | `openssl rand -base64 32` |
| `ALPACA_API_KEY_ID` + `ALPACA_API_SECRET_KEY` | fiyat için | [alpaca.markets](https://alpaca.markets) → API Keys (paper yeterli) |
| `FINNHUB_API_KEY` | profil/haber için | [finnhub.io](https://finnhub.io) → Get free API key |
| `FRED_API_KEY` | makro için | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) — 32 karakter, küçük harf |
| `CRON_SECRET` | üretimde | `openssl rand -hex 32` — Vercel Cron bunu `Bearer` ile gönderir |
| `BRIEF_SECRET` | içerik için | `openssl rand -hex 32` — bülten, mercek ve analiz uçlarının kapısı |
| `NEXT_PUBLIC_SITE_URL` | üretimde | yayın adresi (OG görselleri ve sitemap için) |
| `ANTHROPIC_API_KEY` | opsiyonel | haber başlığı çevirisi (DeepL yoksa) |
| `DEEPL_API_KEY` | opsiyonel | haber başlığı çevirisi (önce bu denenir) |
| `ANALYTICS_SALT` | opsiyonel | ziyaretçi özetinin tuzu; verilmezse `AUTH_SECRET` kullanılır |

Anahtarlar olmadan da uygulama açılır; ilgili kartlar "veri alınamadı" gösterir ve
sayfa çökmez. Doğrulamak için: `/api/debug/providers`.

Korumalı uçlar yerelde secret boşsa açıktır; **üretimde secret yoksa uç 503
döner**, açık kalmaz.

---

## Komutlar

```bash
npm run dev          # geliştirme (3000 doluysa 3001'e düşer)
npm run build        # üretim derlemesi
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run db:generate  # şema değişikliği → YENİ migration dosyası
npm run db:migrate   # migration'ları uygula
npm run db:seed      # idempotent tohum (kullanıcı verisine dokunmaz)
npm run db:studio    # Drizzle Studio
```

**Temiz bir kopyada önce `npm run build` çalıştır.** `PageProps` ve `RouteContext`
tipleri Next tarafından `.next/types` altına üretiliyor ve ikisi de gitignore'da;
build almadan `typecheck` çalıştırırsan kodda sorun olmadığı hâlde onlarca hata
alırsın.

---

## Doğrulama

Otomatik test paketi yok; doğrulama üç ayaklı:

1. `npm run typecheck` + `npm run lint` + `npm run build` — üçü de temiz olmadan
   commit yok.
2. **Yatay taşma ve konsol taraması** — Chrome'u başsız koşturup rota × genişlik
   matrisini (360 / 390 / 768 / 1280 / 1600) tarayan geçici betikler. Bunlar
   `.tmp-*.mjs` deseniyle yazılır ve commit'lenmez.
3. **Ölçüm** — düzen değişiklikleri gerçek piksellerle doğrulanır; sonuç kod
   yorumuna yazılır ki bir daha ölçülmesin.

---

## Deploy (Vercel)

1. Repo'yu Vercel'e bağla.
2. Environment Variables: `.env.example` içindeki değişkenler +
   `NEXT_PUBLIC_SITE_URL`.
3. `vercel.json` cron'u otomatik kaydeder; Vercel `CRON_SECRET`'ı
   `Authorization: Bearer` başlığıyla gönderir.
4. İlk deploy sonrası bir kez: `npm run db:migrate && npm run db:seed` (lokalden,
   üretim `DATABASE_URL` ile).
5. claude.ai görevlerini kur (`docs/claude-rutinler.md`) — yoksa bülten ve mercek
   boş kalır.

Günlük cron (`/api/cron/daily`, hafta içi 10:30 UTC) bilanço takvimi, haber, FRED
serileri, gerçekleşen değerler, profil tazeleme ve budama işlerini sırayla yapar.
Yüz saniyelik bir bütçesi vardır: bütçe dolarsa kalan adımları atlar ve neyi
atladığını raporlar — yarım kalmış bir tur sessizce başarılı görünmez.

---

## Dizin yapısı

```
app/
  (app)/             # sayfalar — Bugün, piyasalar, şirketler, hisse, karşılaştır,
                     #   takvim, bilançolar, mercek, rehber, bülten, haberler, hesap
  admin/             # yönetim — kabuğun dışında, yetkisizde 404
  api/               # chart, karsilastir, search, takvim, olcum,
                     #   brief, mercek, analiz (+ context uçları), cron, auth, debug
components/
  article/           # ArticleBody — ::: blok ailesi burada çizilir
  layout/            # AppShell, masthead, alt sekme çubuğu, piyasa şeridi, arama paleti
  today/             # gün şeridi, bülten anahtarı, geri sayım, kolon doldurucu
  markets/           # karşılaştırma (canlı aralık katmanı), korku endeksi
  stock/ earnings/ stories/ watchlist/ ui/
lib/
  market-hours.ts    # ET↔UTC, seans durumu, önbellek süreleri
  session-clock.ts   # dile göre birincil saat dilimi (TR/NY)
  compare.ts         # karşılaştırma ekranının ortak sözleşmesi
  providers/         # alpaca · finnhub · fred · tcmb
  i18n/              # tr + en sözlükleri (en, tr tipinden türer)
content/guide/       # rehber yazıları — meta + tr + en, eksik çeviri derlemeyi kırar
db/seed/             # tatiller, ekonomik takvim, semboller, endeks bileşimleri
docs/                # rutin prompt'ları, tasarım notları
drizzle/             # migration'lar — elle düzenlenmez, yenisi eklenir
```

---

## Bilinen sınırlar

- **Fiyatlar 15 dakika gecikmeli.** Alpaca'nın ücretsiz katmanı konsolide tape'i
  (SIP) gecikmeli veriyor; ekranda damgalanır.
- **Endeksler ETF üzerinden izlenir** (SPY/QQQ/DIA/IWM) ve arayüzde belirtilir.
- **Dünya piyasaları MSCI ülke fonları üzerinden.** Yerel endeksler ücretsiz
  sağlayıcılarda yok; yön aynı, yüzde kur ve seans farkıyla ayrışabilir.
- **Emtia yok.** Brent bir süre gösterildi ve kaldırıldı — ücretsiz
  sağlayıcılarımızın hiçbirinde canlı emtia fiyatı yok.
- **Bilanço saatleri yaklaşıktır.** Sağlayıcı yalnızca pencereyi veriyor (açılış
  öncesi / kapanış sonrası), dakika vermiyor.
- **Ekonomik takvim tohumlanır.** Finnhub'ın ücretsiz katmanında bu uç yok;
  tarihler resmî kaynaklardan tohumlanır ve FRED'in yayın takvimiyle ileriye
  uzatılır.
- **Otomatik test yok.** Doğrulama yukarıdaki üç ayakla yapılıyor.

---

## Lisans ve sorumluluk

Kişisel bir proje; **yatırım tavsiyesi değildir.** Veriler üçüncü taraf
sağlayıcılardan gelir, gecikmeli ya da hatalı olabilir. Ekrandaki hiçbir sayı bir
alım satım kararının tek dayanağı olacak şekilde tasarlanmadı.
