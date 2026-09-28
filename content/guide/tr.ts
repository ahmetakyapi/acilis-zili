/* ==========================================================================
   Rehber — Türkçe metinler

   Yapı, sıra ve ilişkiler `meta.ts`'te; buradaki anahtarlar oradaki
   slug'larla birebir aynıdır ve tip bunu zorlar. Yeni yazı eklerken üç
   dosya birlikte güncellenir: meta + tr + en — biri eksikse derleme kırılır.

   Gövde sözdizimi `components/article/ArticleBody.tsx` içinde anlatılıyor:
   ## başlık, - madde, | tablo |, > alıntı, ::: kutu ... :::
   ========================================================================== */

import type { GuideSlug, GuideText } from "./meta";

export const GUIDE_TR: Record<GuideSlug, GuideText> = {
  /* ==== 1 · Temel Kavramlar =============================================== */

  /* ---------------------------------------------------------------------- */
  "hisse-senedi": {
    title: "Hisse Senedi Nedir?",
    dek: "Bir şirketin küçük bir parçasına sahip olmak — ve o parçanın fiyatını kimin belirlediği.",
    bodyMd: `Apple'ın bir hissesini aldığında bir kâğıt parçası satın almış olmuyorsun. Şirketin milyarlarca parçaya bölünmüş mülkiyetinin bir parçasını satın alıyorsun. O parça sana iki şey verir: şirket kâr dağıtırsa payını alma hakkı ve genel kurulda oy hakkı.

::: tanim Hisse Senedi
Bir şirketin sermayesinin eşit parçalara bölünmüş hâlinin tek bir birimi. Sahibine ortaklık hakkı verir. Borsada işlem gören şirketlerde bu parçalar herkese açık bir piyasada el değiştirir.
:::

## Fiyatı Kim Belirliyor

Hiç kimse. Daha doğrusu: o anda alıcı ile satıcının anlaştığı son rakam. Şirketin "gerçek değeri" diye bir tabelası yok; fiyat, binlerce insanın aynı anda verdiği kararların kesiştiği noktadır.

Bu yüzden fiyat iki şeyden birden etkilenir:

1. **Şirketin kendisi** — ne kadar kazanıyor, ne kadar büyüyor, borcu ne kadar.
2. **Piyasanın havası** — faizler, korku, moda olan sektör, gelen para.

İkincisi kısa vadede birincisinden daha güçlüdür. Uzun vadede ise tersi olur. Borsa hakkındaki en eski sözlerden biri bunu anlatır:

> Piyasa kısa vadede bir oylama makinesi, uzun vadede bir tartıdır.

## Ne Kazandırır

Bir hisseden para kazanmanın iki yolu vardır ve karıştırılmamaları gerekir:

| Yol | Nasıl olur | Kime uygun |
|---|---|---|
| **Sermaye kazancı** | Aldığından pahalıya satarsın | Büyüme bekleyen |
| **Temettü** | Şirket kârını nakit dağıtır | Düzenli gelir isteyen |

İkisinin toplamına *toplam getiri* denir. Ayrıntı: [Temettü Nedir?](/rehber/temettu)

## Sahip Olduğun Şey Nedir, Ne Değildir

**Olduğun:** Şirketin varlıklarının ve gelecekteki kârlarının küçük bir yüzdesinin sahibi.

**Olmadığın:** Şirketin borçlarından sorumlu biri. Bir şirket iflas ederse hissedar en fazla koyduğu parayı kaybeder — ötesi istenmez. Buna *sınırlı sorumluluk* denir ve modern şirketin en önemli buluşudur.

::: dikkat Sıra Meselesi
Şirket batarsa parayı önce alacaklılar alır, sonra tahvil sahipleri, sonra imtiyazlı hissedarlar, en son sıradan hissedarlar. "En son" pratikte çoğu zaman "hiç" demektir. Hisse, getiri sıralamasında en üstteyse, iflas sıralamasında en alttadır — ikisi aynı madalyonun yüzleridir.
:::

## Adet Değil, Oran

Yeni başlayanların en sık yaptığı hata: "100 lot mu alsam, 10 lot mu?" diye düşünmek. Önemli olan kaç adet aldığın değil, **paranın yüzde kaçını** o şirkete koyduğun.

50 dolarlık bir hisseden 10 adet almakla, 500 dolarlık bir hisseden 1 adet almak aynı şeydir: iki durumda da 500 dolarlık bir pozisyonun var. Fiyatın "ucuz" ya da "pahalı" görünmesi hisse adediyle ilgilidir, şirketin değeriyle değil. Ayrıntı: [Piyasa Değeri Nedir?](/rehber/piyasa-degeri)

::: ornek Aynı Şirket, İki Farklı Fiyat
Bir şirket hisse bölünmesi yaparsa 900 dolarlık hisse bir gecede 3'e bölünüp 300 dolar olur ve elindeki adet üçe katlanır. Portföyünde hiçbir şey değişmemiştir. Şirket de aynı şirkettir. Değişen tek şey fiyatın küçük yatırımcıya daha erişilebilir görünmesidir.
:::

## Bu Sitede Nerede Görürsün

Her şirketin kendi sayfası var: [NVDA](/hisse/NVDA) gibi. Orada fiyat, gün aralığı, piyasa değeri, temel oranlar, geçmiş bilançolar ve şirketle ilgili haberler bir arada durur. Şirket dizinine [Şirketler](/sirketler) ekranından, aramaya ise üstteki arama kutusundan ulaşırsın.`,
  },

  /* ---------------------------------------------------------------------- */
  "borsa-nasil-isler": {
    title: "Borsa Nasıl İşler?",
    dek: "Emrin tuşa bastığın andan hisselerin hesabına geçtiği ana kadar izlediği yol.",
    bodyMd: `Borsa bir bina değil, bir eşleştirme makinesidir. Görevi tek bir şey: alıcıyla satıcıyı fiyat üzerinden buluşturmak. Geri kalan her şey bu basit işin etrafına kurulmuş altyapıdır.

::: tanim Borsa (Exchange)
Alım ve satım emirlerinin toplandığı, fiyat ve zaman önceliğine göre eşleştirildiği düzenlenmiş piyasa. ABD'de en bilinenleri **NYSE** ve **Nasdaq**'tır.
:::

## Emir Defteri

Her hissenin bir emir defteri vardır: bir tarafta almak isteyenler, diğer tarafta satmak isteyenler.

| Taraf | Ne der | Örnek |
|---|---|---|
| **Alış (bid)** | En yüksek alıcı fiyatı | 100,20 dolardan 500 adet |
| **Satış (ask)** | En düşük satıcı fiyatı | 100,24 dolardan 300 adet |

İkisi arasındaki farka **spread** denir (Türkçede *makas* da denir). Bir alış emri satış tarafındaki fiyata değdiği anda işlem gerçekleşir ve o rakam "son fiyat" olur. Ekranda gördüğün fiyat budur: gerçekleşmiş son işlem, yani geçmiş.

## Sıra Kuralı

Eşleştirme iki kurala göre yapılır ve ikisi de basittir:

1. **Fiyat önceliği** — daha iyi fiyat veren önce işlem görür.
2. **Zaman önceliği** — aynı fiyattan iki emir varsa önce gelen önce işlem görür.

Bu yüzden "piyasa fiyatından" bir emir gönderdiğinde defterdeki en iyi karşı fiyattan başlayarak yukarı doğru yenirsin. Emir büyükse tek fiyattan değil, birkaç fiyat kademesinden dolar.

## Aradaki Kurumlar

Sen doğrudan borsaya bağlanmazsın. Zincir şöyledir:

::: zaman Bir Emrin Yolculuğu
Sen | Aracı kurumun uygulamasında "al" dersin.
Aracı kurum | Emri denetler, teminatını kontrol eder ve bir piyasaya yönlendirir.
Piyasa yapıcı ya da borsa | Emir defterinde karşı tarafla eşleşir. Bu aşama genellikle bir saniyenin küçük bir kısmıdır.
Takas | İşlem kaydedilir ve hisselerle para karşılıklı el değiştirir. ABD'de bu **T+1**'dir: işlemin ertesi iş günü.
:::

::: dikkat Emir Akışının Satılması
ABD'de birçok komisyonsuz aracı kurum, emirlerini borsaya değil bir piyasa yapıcıya yönlendirir ve karşılığında ödeme alır. Buna *payment for order flow* denir. "Komisyon sıfır" demek "maliyet sıfır" demek değildir; maliyet spread'in içine gizlenmiş olabilir. Ayrıntı: [Likidite ve Spread](/rehber/spread-likidite)
:::

## Seans Saatleri

ABD piyasası üç bölümde çalışır. Türkiye saatleri ABD'nin yaz saati uygulamasıyla yılda iki kez kayar; aşağıdaki TR saatleri yaz dönemi içindir.

| Bölüm | New York | Türkiye (yaz) | Karakteri |
|---|---|---|---|
| Açılış öncesi | 04:00 – 09:30 | 11:00 – 16:30 | İnce, oynak, spread geniş |
| **Ana seans** | 09:30 – 16:00 | **16:30 – 23:00** | Hacmin neredeyse tamamı |
| Kapanış sonrası | 16:00 – 20:00 | 23:00 – 03:00 | Bilanço tepkileri burada |

Günün en yoğun iki dakikası açılış ve kapanıştır. Kapanış müzayedesinde endeks fonları gün içindeki para giriş-çıkışını dengeler; bu yüzden son dakikada büyük hacimler görünür.

::: ornek Neden Bilançolar Kapanıştan Sonra
Büyük şirketlerin çoğu sonuçlarını seans bittikten sonra açıklar. Amaç, haberin piyasa kapalıyken sindirilmesi ve telekonferansın panik satışına dönüşmemesidir. Tepki ertesi sabah açılışta tek bir sıçrama olarak görünür — grafikte **gap** (fiyat boşluğu) diye durur.
:::

## Bu Sitede Nerede Görürsün

Ana sayfadaki geri sayım, bir sonraki açılışa ya da kapanışa kalan süreyi gösterir. **Bugünün Akışı** şeridi ekonomik verileri ve bilançoları aynı zaman ekseninde dizer; her saat hem New York hem Türkiye saatiyle yazılır.`,
  },

  /* ---------------------------------------------------------------------- */
  "endeks": {
    title: "Endeks Nedir?",
    dek: "S&P 500 dediğimiz sayı nereden geliyor ve neden Dow Jones'tan farklı davranıyor.",
    bodyMd: `"Piyasa bugün %1 yükseldi" cümlesindeki *piyasa* bir endekstir. Endeks, bir grup hissenin toplu hâlde nasıl hareket ettiğini tek bir sayıya indirir. Kendisi alınıp satılamaz — bir hesaptır, bir ürün değil.

::: tanim Endeks
Belirli kurallara göre seçilmiş bir hisse grubunun, belirli bir ağırlıklandırmayla hesaplanan bileşik değeri. Seviyenin kendisi ("6.230 puan") anlamlı değildir; anlamlı olan **yüzde değişimdir**.
:::

## Dört Büyük ABD Endeksi

| Endeks | İçinde ne var | Ağırlıklandırma | Neyi anlatır |
|---|---|---|---|
| **S&P 500** | En büyük 500 ABD şirketi | Piyasa değeri | ABD borsasının geneli |
| **Nasdaq 100** | Nasdaq'ın en büyük 100 finans dışı şirketi | Piyasa değeri | Teknoloji ağırlıklı büyüme |
| **Dow Jones** | 30 seçilmiş şirket | **Fiyat** | Tarihsel gösterge; dar |
| **Russell 2000** | 2000 küçük şirket | Piyasa değeri | Küçük ölçek, iç ekonomi |

## Ağırlıklandırma Neden Önemli

Bu, endeksler arasındaki en büyük ve en az fark edilen ayrımdır.

**Piyasa değeri ağırlıklı** endekste büyük şirket çok, küçük şirket az etkiler. S&P 500'de en büyük birkaç şirket endeksin üçte birinden fazlasını taşıyabilir. "500 şirkete yatırım yapıyorum" cümlesi bu yüzden göründüğü kadar çeşitlendirilmiş değildir.

**Fiyat ağırlıklı** endekste — ki bugün yalnızca Dow böyledir — hisse fiyatı yüksek olan şirket daha çok etkiler. Şirketin büyüklüğüyle ilgisi yoktur. 500 dolarlık bir hisse, 50 dolarlık bir hisseden on kat fazla etkiler; ikincisi on kat daha büyük bir şirket olsa bile. Bu yöntemin tek gerekçesi 1896'da hesap makinesi olmamasıdır.

::: dikkat Endeks Yükselirken Hisseler Düşebilir
Piyasa değeri ağırlıklı bir endekste birkaç dev şirket yükselirken geri kalan 480 şirket düşebilir ve endeks yine artıda kapanır. Buna *genişliğin daralması* denir ve genellikle trendin zayıfladığının erken işaretidir.
:::

## Endekse Nasıl Yatırım Yapılır

Endeksin kendisi alınamadığı için onu birebir kopyalayan fonlar kullanılır:

- **SPY** → S&P 500
- **QQQ** → Nasdaq 100
- **DIA** → Dow Jones
- **IWM** → Russell 2000

Bunlar ETF'tir. Ayrıntı: [ETF Nedir?](/rehber/etf)

::: ornek Seviye Değil, Yüzde
QQQ'nun fiyatı Nasdaq 100'ün puanı değildir; onun belirli bir oranıdır. DIA yaklaşık olarak Dow'un yüzde biri fiyatlanır. Seviyeler tutmaz, yüzde değişimler neredeyse birebir tutar. Endeksle fon arasında karşılaştırma yaparken daima yüzdeye bak.
:::

## Endekse Girmek ve Çıkmak

Endeksler durağan değildir. Bir şirket kurallara uymaz hâle gelirse çıkarılır, yerine yenisi alınır. Endekse giriş haberi genellikle hisseyi yükseltir — çünkü o endeksi izleyen bütün fonlar o hisseyi almak zorundadır. Bu, şirketin işiyle ilgisi olmayan, tamamen mekanik bir alım dalgasıdır.

## Bu Sitede Nerede Görürsün

Ana sayfanın yan kolonunda dört endeks kartı ve her birinin gün içi grafiği durur. [Piyasalar](/piyasalar) ekranında endeksler, sektörler ve tahvil faizleri bir arada; **Piyasa Genişliği** kartı da endeksteki şirketlerin kaçının artıda kaçının ekside olduğunu gösterir.`,
  },

  /* ---------------------------------------------------------------------- */
  "etf": {
    title: "ETF Nedir?",
    dek: "Tek bir hisse gibi alınıp satılan, içinde onlarca şirket taşıyan fon.",
    bodyMd: `Nasdaq 100 endeksini "satın alamazsın". Endeks bir hesaptır, bir ürün değil. Ama endeksteki 100 şirketin hepsini doğru ağırlıklarla tutan bir fonun payını satın alabilirsin. O fonun adı **QQQ** ve bir ETF'tir.

::: tanim ETF (Exchange Traded Fund)
Borsada işlem gören yatırım fonu. İçinde bir varlık sepeti tutar; payları borsada, tıpkı bir hisse gibi, gün boyu alınıp satılır. Türkçesi "borsa yatırım fonu"dur.
:::

## Klasik Fondan Farkı

| | Yatırım fonu | ETF |
|---|---|---|
| Alım-satım | Günde bir kez, gün sonu fiyatından | Seans boyunca, anlık fiyattan |
| Fiyat | Gün sonunda hesaplanan net varlık değeri | Arz-talebin belirlediği piyasa fiyatı |
| Gider oranı | Genellikle daha yüksek | Genellikle çok düşük (%0,03–0,20) |
| Şeffaflık | Portföy periyodik açıklanır | Portföy çoğunlukla her gün açıklanır |

Bu farkların en önemlisi gider oranıdır. Yılda %1 gider ile %0,05 gider arasındaki fark, otuz yıllık bir birikimde toplam getirinin dörtte birine varabilir.

## Türleri

- **Endeks ETF'leri:** Bir endeksi izler. SPY (S&P 500), QQQ (Nasdaq 100), DIA (Dow Jones), IWM (Russell 2000).
- **Sektör ETF'leri:** Tek bir sektörü tutar — yarı iletken, enerji, bankacılık.
- **Ülke ETF'leri:** Bir ülkenin hisselerini tutar. Bu sitedeki Dünya Piyasaları kartı bunları kullanır.
- **Tahvil ETF'leri:** Hisse yerine tahvil taşır.
- **Emtia ETF'leri:** Altın, petrol, gümüş.

::: dikkat Kaldıraçlı ve Ters ETF'ler
"3x" ya da "inverse" yazan ETF'ler farklı bir üründür. Endeksin **günlük** getirisinin katını hedeflerler, dönemsel getirisinin değil. Yatay ama oynak bir piyasada her iki yönde de erirler. Uzun vadeli tutmak için tasarlanmamışlardır; bu ürünlerde "aylarca beklerim" stratejisi matematiksel olarak çalışmaz.
:::

## Fiyatı Neden Endeksle Aynı Değil

QQQ'nun fiyatı Nasdaq 100 endeksinin seviyesi değildir; onun belirli bir oranıdır. DIA yaklaşık olarak Dow Jones'un yüzde biri fiyatlanır. Önemli olan seviye değil **yüzde değişimdir**; o neredeyse birebir aynıdır.

Ülke fonlarında bir katman daha vardır: fon dolar cinsinden ve ABD seansında işlem görür. Yerel endeks kendi ülkesinde saatler önce kapanmış olabilir ve arada kur değişmiş olabilir. Yön genellikle aynıdır, yüzde birebir tutmaz.

::: ornek Türkiye Örneği
BIST 100 lira bazında %2 yükselirken lira dolar karşısında %2 değer kaybederse, TUR (iShares MSCI Türkiye) dolar bazında neredeyse yatay kalır. Ekranda gördüğün yüzde, yerel endeksin yüzdesi değil, **dolar cinsinden getiridir**. Ayrıntı: [Kur Riski](/rehber/kur-riski)
:::

## Ne Zaman ETF, Ne Zaman Tek Hisse

Tek hisse almak, o şirket hakkında bir görüşün olduğunu varsayar. ETF almak, bir tema ya da piyasa hakkında görüşün olduğunu ama hangi şirketin kazanacağını bilmediğini kabul eder. İkisi de meşrudur; karıştırıldığında sorun çıkar — yani bir tema hakkında haklı olup yanlış şirketi seçtiğinde.

## Bu Sitede Nerede Görürsün

Endeks kartları (Nasdaq 100, S&P 500, Dow Jones, Russell 2000) ve Dünya Piyasaları listesi ETF fiyatlarından beslenir. Bir ETF'in sayfasına girdiğinde şirket metrikleri yerine **fon künyesi** görürsün: neyi izlediği, fon yöneticisi ve izlediği piyasayla arasındaki farkın notu.`,
  },

  /* ---------------------------------------------------------------------- */
  "volatilite": {
    title: "Volatilite Nedir?",
    dek: "Fiyatın ne kadar oynadığını ölçer — hangi yöne gittiğini değil.",
    bodyMd: `Bir hisse ayı %2 artıda kapatabilir. Aynı hisse ay boyunca önce %18 düşüp sonra %24 yükselerek de %2 artıda kapatabilir. Sonuç aynı, yaşadıkların değil. Aradaki farkın adı **volatilite**.

::: tanim Volatilite
Bir varlığın fiyatının belirli bir dönemde ortalamasından ne kadar saptığının ölçüsü. Yönü umursamaz: %10 yükseliş ile %10 düşüş volatiliteye aynı katkıyı yapar. Ölçtüğü şey **hareketin büyüklüğü**, yani belirsizlik.
:::

## Nasıl Hesaplanır

Günlük getirilerin standart sapması alınır ve yıllığa çevrilir. Kaba bir sayı: günlük hareketlerin standart sapması %1 olan bir hissenin yıllık volatilitesi yaklaşık %16'dır (%1 × √252, çünkü bir yılda yaklaşık 252 işlem günü vardır).

Bu sayı bir tahmin değil, bir ölçüdür. "Yıllık volatilitesi %40" cümlesi, hissenin yükseleceğini de düşeceğini de söylemez; yalnızca yıl içinde geniş bir bantta gezineceğini söyler.

| Tipik yıllık volatilite | Ne anlama gelir |
|---|---|
| %10–15 | Kamu hizmeti şirketleri, büyük gıda markaları. Fiyat günlerce yerinde durur. |
| %15–20 | S&P 500'ün uzun dönem bandı. Endeks, içindeki tek tek hisselerden daha sakindir. |
| %25–40 | Büyük teknoloji ve yarı iletken. Tek bir bilanço gecesi %10 hareket edebilir. |
| %60+ | Yeni halka açılmış şirketler, biyoteknoloji, spekülatif isimler. |

Endeksin tek tek hisselerden sakin olması tesadüf değil: içerideki şirketlerin bir kısmı artarken bir kısmı düşer ve hareketler kısmen birbirini götürür. Buna çeşitlendirme denir ve volatiliteyi düşürmenin en ucuz yoludur.

## Gerçekleşen Volatilite, Beklenen Volatilite

İki farklı sayı vardır ve karıştırılır:

- **Gerçekleşen (realized):** Geçmiş fiyatlardan hesaplanır. Ne olduğunu söyler.
- **Beklenen (implied volatility):** Opsiyon fiyatlarından geri çözülür. Piyasanın önümüzdeki dönem için ne beklediğini söyler.

Beklenen volatilitenin en bilinen göstergesi **VIX**'tir: S&P 500 opsiyonlarından türetilir ve "korku endeksi" diye anılır. Uzun dönem ortalaması 20 civarındadır. 12–15 bandı sakin bir piyasa, 30 üstü gerginlik, 50 üstü panik demektir.

::: ornek Bilanço Gecesi
Bir şirket bilanço açıklamadan önce opsiyon fiyatları şişer, çünkü piyasa büyük bir hareket bekler. Açıklama yapıldıktan sonra belirsizlik ortadan kalkar ve opsiyon fiyatları — hisse hiç hareket etmese bile — hızla düşer. Buna *volatility crush* denir. Doğru tahmin edip yine de para kaybetmenin klasik yollarından biridir.
:::

## Volatilite Kötü Bir Şey mi

Değil, ama bedava da değil. İki farklı sonucu vardır:

1. **Psikolojik:** Yüksek volatiliteli bir pozisyon, doğru olsan bile seni yolda satmaya zorlayabilir.
2. **Matematiksel:** Volatilite bileşik getiriyi yer. %50 düşen bir varlığın başa dönmesi için %100 yükselmesi gerekir. Sıfır etrafında salınan büyük hareketler, düz bir çizgide ilerleyen küçük hareketlerden daha az bileşik getiri üretir.

İkinci madde, aynı ortalama getiriye sahip iki varlıktan sakin olanın uzun vadede daha fazla kazandırmasının nedenidir.

::: dikkat Kaldıraçla Birleşince
Volatilite tek başına bir risk değil, bir ölçüdür. Riske dönüştüğü yer kaldıraçtır: ödünç parayla taşınan bir pozisyonda geçici bir dalgalanma, margin call (teminat çağrısı) yoluyla kalıcı bir kayba dönüşebilir. Bkz. [Kaldıraç Nedir?](/rehber/kaldirac)
:::

## Bu Sitede Nerede Görürsün

- **Gün aralığı** (hisse sayfası): günün en düşüğü ile en yükseği arasındaki mesafe, günlük volatilitenin en kaba göstergesidir.
- **52 hafta en yüksek / en düşük:** yıllık bandın genişliği.
- **Gün içi grafik:** düz bir çizgi mi, testere dişi mi — bakışta anlaşılır.`,
  },

  /* ---------------------------------------------------------------------- */
  "ayi-boga": {
    title: "Ayı ve Boğa Piyasası Nedir?",
    dek: "İki hayvan, iki eşik ve piyasanın kendi hakkında anlattığı hikâye.",
    bodyMd: `Boğa boynuzlarıyla yukarı savurur, ayı pençesiyle aşağı vurur. Terimlerin kökeni bu kadar basit. Eşikleri ise sayısaldır ve piyasa bunları ciddiye alır.

::: tanim İki Eşik
**Düzeltme (correction):** Son zirveden **%10** ya da daha fazla geri çekilme.
**Ayı piyasası (bear market):** Son zirveden **%20** ya da daha fazla geri çekilme.
**Boğa piyasası (bull market):** Ayı dibinden %20 yükseliş; genellikle yeni zirvelerle birlikte anılır.
:::

Bu eşikler matematiksel bir doğruluk taşımaz — kimse %19,4 ile %20,1 arasında bir doğa yasası olduğunu iddia etmiyor. Ama piyasa katılımcıları bunları ortak dil olarak kullandığı için gerçek etkileri vardır: fon yöneticileri raporlarında bu tanımlara göre konuşur, medya bu eşiklerde başlık atar, bazı kurumsal risk kuralları bu seviyelerde devreye girer.

## Karakterleri Farklıdır

| | Boğa piyasası | Ayı piyasası |
|---|---|---|
| Süre | Yıllar (tarihsel olarak çok daha uzun) | Aylar |
| Hız | Yavaş, kademeli | Hızlı, sert |
| Volatilite | Düşük | Yüksek |
| Duygu | Kayıtsızlık, sonra iyimserlik, sonra coşku | Endişe, sonra korku, sonra teslimiyet |
| Haber akışı | İyi haber alkışlanır, kötü haber görmezden gelinir | Kötü haber cezalandırılır, iyi haber güvenilmez bulunur |

En kalıcı gözlem şudur: **piyasalar merdivenle çıkar, asansörle iner.** Yükseliş kademeli birikimle olur; düşüş zorunlu satıcıların (teminat çağrıları, fon çıkışları, risk limitleri) aynı anda kapıya koşmasıyla olur.

::: dikkat Ayı Piyasası Rallisi
Ayı piyasalarının içinde %10–20'lik sert yükselişler görülür ve her biri "dip geçildi" diye yorumlanır. Tarihsel olarak en keskin günlük yükselişlerin çoğu ayı piyasalarının içinde yaşanmıştır. Bir günün yönü trendi anlatmaz.
:::

## Neden İsimlendirmek İşe Yarar

Bir düzeltmeyi ayı piyasasından ayırmak, portföyde neyin değiştiğini sormanı sağlar:

- **Düzeltme genellikle fiyat olayıdır.** Değerlemeler gerilir, biraz hava alınır, hikâye değişmez.
- **Ayı piyasası genellikle hikâye olayıdır.** Kazanç beklentileri düşer, faiz rejimi değişir, bir sektörün temel tezine güven sarsılır.

İkisini ayırmanın kestirme yolu yoktur ama iyi bir soru vardır: *bu düşüşe sebep olan şey, şirketlerin önümüzdeki üç yılda kazanacağı parayı değiştiriyor mu?* Cevap hayırsa muhtemelen düzeltmedir.

## Sayılar

Tarihsel ölçekte:

- ABD borsasında ayı piyasaları ortalama olarak birkaç yılda bir görülür.
- Boğa piyasaları ayı piyasalarından hem daha uzun sürer hem de daha büyük hareket üretir; endekslerin uzun vadeli yukarı eğiliminin sebebi budur.
- 1929, 2000–2002, 2007–2009 ve 2020 en çok anılan ayı piyasalarıdır; ilk üçü aylar-yıllar sürdü, 2020 tarihin en hızlısıydı ve haftalarla ölçüldü.

## Bu Sitede Nerede Görürsün

**Piyasa Genişliği** kartı, endeksteki şirketlerin kaçının artıda kaçının ekside olduğunu gösterir. Endeks yükselirken genişliğin daralması (yani yükselişi bir avuç hissenin taşıması) çoğu zaman trendin zayıfladığının ilk işaretidir — endeks seviyesinden önce burada görünür.`,
  },

  /* ---------------------------------------------------------------------- */
  "spread-likidite": {
    title: "Likidite ve Spread Nedir?",
    dek: "İşlem ücreti sıfır olsa bile her alım satımda ödediğin görünmez bedel.",
    bodyMd: `Bir hissenin tek bir fiyatı yoktur. Aynı anda iki fiyatı vardır: birinden alabilirsin, diğerinden satabilirsin ve ikisi asla aynı değildir. Aradaki fark, hiçbir komisyon tablosunda görünmeyen gerçek maliyettir.

::: tanim Spread ve Likidite
**Spread:** En iyi alış (bid) ile en iyi satış (ask) fiyatı arasındaki fark; Türkçede *makas* da denir.
**Likidite:** Fiyatı bozmadan ne kadar büyük işlem yapılabildiği. Likit bir hissede spread dardır ve her kademede çok emir vardır.
:::

## Neden Var

Karşı tarafta duran piyasa yapıcı bir risk alır: senden hisseyi satın alır ve bir sonraki alıcıyı bulana kadar elinde tutar. O arada fiyat düşerse zarar eder. Spread, bu riskin ücretidir.

## Ne Kadar Önemli

| Hisse tipi | Tipik spread | 10.000 dolarlık işlemde gidiş-dönüş maliyeti |
|---|---|---|
| SPY, AAPL gibi çok likit | 0,01 dolar (%0,002) | ~0,20 dolar |
| Orta ölçek | %0,05 | ~5 dolar |
| Küçük ölçek, düşük hacim | %0,5 | ~50 dolar |
| Açılış öncesi / kapanış sonrası | Normalin 3–10 katı | Çok değişken |

Son satır çoğu kişinin gözünden kaçar: seans dışında spread açılır. Bilanço gecesi "hemen tepki vereyim" diye ana seans dışında işlem yapmak, çoğu zaman kazanılan tepkinin bir kısmını spread'e bırakmak demektir.

::: ornek İki Yönde de Ödersin
Alış 100,00 · satış 100,10 olan bir hissede 100,10'dan alıp hemen 100,00'dan satarsan fiyat hiç hareket etmemesine rağmen %0,1 kaybedersin. Günde on kez alıp satan biri, fiyat hiç değişmese bile ayda ciddi bir tutarı yalnızca spread'e ödemiş olur.
:::

## Likiditeyi Nereden Anlarsın

- **Günlük ortalama hacim.** Milyonlarca adet işlem gören bir hissede sorun yaşamazsın.
- **Spread'in genişliği.** Fiyatın binde birinden büyük bir spread, dikkat işaretidir.
- **Emir defterinin derinliği.** Her kademede kaç adet var.

::: dikkat Likidite Tam İhtiyaç Duyduğunda Kaybolur
Likidite sakin günlerde boldur, panik günlerinde buharlaşır. Herkesin aynı anda satmak istediği bir sabahta alıcılar çekilir, spread açılır ve "istediğim fiyattan çıkarım" varsayımı çöker. Küçük ve az işlem gören hisselerde bu, düşüşün kendisinden daha büyük bir sorundur.
:::

## Ne Yapmalı

1. **Piyasa emri yerine limit emir kullan.** Özellikle likit olmayan bir hissede piyasa emri, defterin yukarısını yiyerek dolar. Ayrıntı: [Emir Tipleri](/rehber/emir-tipleri)
2. **Açılışın ilk ve kapanışın son dakikalarından kaçın.** Spread o iki aralıkta en geniştir.
3. **Seans dışında işlem yapma.** Gerçekten mecbur değilsen.
4. **Pozisyon büyüklüğünü hacme göre ölç.** Günlük hacmin kayda değer bir kısmını tek başına alacaksan fiyatı sen hareket ettirirsin.

## Bu Sitede Nerede Görürsün

Hisse sayfasındaki **hacim** satırı likiditenin en kaba göstergesidir ve bütün borsaların toplamıdır (konsolide tape). Bir dönem burada yalnızca tek bir borsanın (IEX) hacmi yazıyordu; o sayı gerçeğin %2 ile %8'i arasında bir dilimdi ve oran hisseden hisseye değiştiği için şirketleri hacme göre sıralamak da yanlış sonuç veriyordu. Ekrandaki fiyat 15 dakika gecikmelidir — spread'i canlı görmek istiyorsan aracı kurumunun defterine bakman gerekir.`,
  },

  /* ---------------------------------------------------------------------- */
  "halka-arz": {
    title: "Halka Arz (IPO): Şirket Borsaya Nasıl Gelir?",
    dek: "Kapalı bir şirketin herkese açık bir fiyat etiketi kazandığı gün — ve o günün neden bu kadar oynak olduğu.",
    bodyMd: `Borsada gördüğün her şirket bir gün borsada değildi. Kurucuların, çalışanların ve birkaç fonun elindeki kapalı bir şirketti; hissesinin fiyatı yoktu çünkü alınıp satıldığı bir piyasa yoktu. Halka arz, o kapalı yapının herkese açık bir piyasaya taşındığı süreçtir.

::: tanim Halka Arz (IPO)
*Initial Public Offering* — bir şirketin hisselerinin ilk kez halka satılması ve borsada işlem görmeye başlaması. O günden sonra şirketin her an güncellenen bir fiyat etiketi ve üç ayda bir hesap verme yükümlülüğü vardır.
:::

## Şirket Neden Halka Açılır

Üç sebep vardır ve hangisinin baskın olduğu, arzın nasıl okunacağını değiştirir:

1. **Para toplamak.** Şirket yeni hisse basar ve satıştan gelen para şirkete girer — fabrika, ürün, büyüme için.
2. **Erken yatırımcıya çıkış.** Kuruluşta para koyan fonlar ve kurucular, ellerindeki hisseyi nakde çevirmek ister. Bu satışta para şirkete değil, satan hissedara gider.
3. **Hisseyi para gibi kullanmak.** Borsada fiyatı olan bir hisse, şirket satın almakta ve çalışan maaşında ödeme aracı olur.

İzahnamede "kim satıyor" bölümü bu yüzden okunur: sermaye artırımı ağırlıklı bir arz ile erken yatırımcıların çıkışı ağırlıklı bir arz, aynı şey değildir.

## Süreç: Dosyadan Çana

::: zaman Tipik Bir Halka Arzın Takvimi
Aylar önce | Şirket yatırım bankalarını seçer ve SEC'e **S-1** dosyasını verir: mali tablolar, riskler, ortaklık yapısı — hepsi ilk kez kamuya açılır.
Haftalar önce | **Roadshow**: yönetim, kurumsal yatırımcılara şirketi anlatır. Bankalar talebi bir deftere toplar.
Birkaç gün önce | Fiyat aralığı ilan edilir ("hisse başına 24–27 dolar"). Talep güçlüyse aralık yukarı çekilir.
Arzdan önceki akşam | Kesin **arz fiyatı** belirlenir ve kurumsal alıcılara tahsis yapılır.
İlk gün | Hisse borsada işlem görmeye başlar. İlk işlem fiyatı arz fiyatından farklıdır — bazen çok farklı.
:::

## İki Fiyat: Arz ve Açılış

Halka arz gününde iki ayrı fiyat vardır ve karıştırılmaları en yaygın hatadır.

**Arz fiyatı**, önceki akşam kurumsal alıcıların ödediği fiyattır. **Açılış fiyatı**, ertesi gün borsada ilk eşleşmenin gerçekleştiği fiyattır. "Hisse ilk gün %35 yükseldi" başlığı çoğu zaman şu demektir: açılış, arz fiyatının %35 üstünde gerçekleşti.

::: ornek "Pop" Kimin Parası
Bir şirket hissesini 25 dolardan arz etti, ilk işlem 34 dolardan açıldı. Manşet bunu başarı olarak yazar. Şirket tarafından bakınca tablo farklıdır: şirket hisselerini 25'e sattı ama piyasa 34 ödemeye hazırmış — aradaki 9 dolar, şirketin kasasına girmeyen paradır. Büyük bir "ilk gün pop'u", arzın ucuza fiyatlandığının da işaretidir.
:::

Bu farkın senin için pratik sonucu şudur: bireysel yatırımcı neredeyse her zaman **açılış fiyatından** alır, arz fiyatından değil. Manşetteki "%35 kazanç" arz gecesinde tahsis alan kurumların kazancıdır.

## Lock-Up Süresi

Halka arzda satılmayan hisseler — kurucular, çalışanlar, erken fonlar — genellikle **90 ila 180 gün** boyunca satış yasağı altındadır. Buna **lock-up** (kilit süresi) denir.

::: dikkat Kilidin Açıldığı Gün
Lock-up süresi dolduğunda piyasaya çıkabilecek hisse sayısı bir anda katlanır. Fiyat çoğu zaman o güne yaklaşırken baskı görür; takvimi bellidir, sürpriz değildir. Yeni arz edilmiş bir hissede pozisyon alıyorsan lock-up tarihini bilmeden alma — izahnamede yazar.
:::

## Halka Açılmanın Diğer Yolları

| Yol | Nasıl işler | Fark |
|---|---|---|
| **Klasik IPO** | Bankalar aracılığıyla yeni hisse satışı | Şirkete para girer, banka garantisi vardır |
| **Direct listing** (doğrudan kotasyon) | Mevcut hisseler doğrudan borsada işleme açılır | Yeni para toplanmaz, arz fiyatı yoktur |
| **SPAC birleşmesi** | Borsada kote boş bir şirketle birleşme | Hızlıdır; incelemesi IPO'dan zayıftır |

Üçüncü yol 2020–2021'de moda oldu ve o dönemin SPAC'lerinin büyük kısmı sonraki yıllarda arz fiyatının çok altına düştü — hız ve gevşek inceleme, bedava değildi.

## Yeni Hisse Neden Daha Riskli

- **Kısa geçmiş.** Beş çeyreklik mali tablo, beş yıllıkla aynı güveni vermez; şirketin kötü bir döngüde nasıl davrandığı hiç görülmemiştir.
- **Bilgi asimetrisi.** Satan taraf şirketi yıllardır tanıyor; alan taraf birkaç haftadır. Fiyatı belirleyen taraf, bilgisi çok olan taraftır.
- **Halka arz penceresi.** Şirketler borsanın coşkulu olduğu dönemde arz etmeyi seçer — yani alıcının en iyimser olduğu anda. Zamanlamayı satıcı seçiyorsa, fiyat satıcının lehinedir.
- **Endeks dışıdır.** Yeni hisse S&P 500 gibi endekslere hemen girmez; endeks fonlarının mekanik alımı ilk günlerde yoktur.

::: ozet Özet
Halka arz bir şirketin doğumu değil, satış ilanıdır: zamanı ve fiyatı satan taraf belirler. İlk gün manşetleri arz gecesi tahsis alanların hikâyesidir; senin fiyatın açılış fiyatıdır ve lock-up takvimi, ilk bilançolar, endekse giriş gibi mekanik olaylar önündeki aylarda fiyatı şirketin işinden bağımsız hareket ettirir.
:::

## Bu Sitede Nerede Görürsün

Şirket sayfasındaki profil kartında **halka arz tarihi** yazar — beş çeyreklik geçmişi olan bir şirketle otuz yıllık bir şirketi aynı güvenle okumamak için oraya bak. Yeni kote olmuş semboller arama kutusuyla bulunur; endeks kartlarında görünmezler, çünkü henüz endekste değillerdir.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: H. Bessembinder, "Do Stocks Outperform Treasury Bills?",
     Journal of Financial Economics 129 (2018) — 1926-2016 arası net servet
     artışının tamamı hisselerin yaklaşık %4'ünden; hisselerin yarıdan fazlası
     ömür boyu bir aylık hazine bonosunun gerisinde. S&P Dow Jones Indices,
     SPIVA U.S. Scorecard (yıllık) — 15 yıllık pencerede ABD büyük ölçekli
     aktif fonların ~%90'ı S&P 500'ün gerisinde; oran rapordan rapora birkaç
     puan oynuyor, o yüzden metinde "onda dokuza yakın" yazıyor. */
  "endeks-fonu-mu-tek-hisse-mi": {
    title: "Endeks Fonu mu, Tek Hisse mi?",
    dek: "İkisi aynı soruya verilmiş iki cevap değil: biri piyasayı, öteki bir şirketi satın alır ve riskleri farklı yerden gelir.",
    bodyMd: `"Hangi hisseyi alayım?" sorusu çoğu zaman bir önceki soruyu atlar: tek bir şirket mi seçmek istiyorsun, yoksa piyasanın tamamını mı taşımak? İkisi aynı işin küçük ve büyük hâli değil. Getirinin nereden geldiği, riskin nereden geldiği ve seni neyin yanıltabileceği ikisinde farklıdır.

::: tanim Bu Yazıdaki Terimler
**Endeks Fonu:** Bir endeksi kurallara göre birebir kopyalayan fon. ABD'de çoğunlukla ETF olarak işlem görür.
**Şirkete Özgü Risk:** Yalnızca o şirketi vuran riskler: bir ürünün tutmaması, bir dava, bir yöneticinin hatası.
**Piyasa Riski:** Bütün hisseleri birlikte etkileyen riskler: faiz, resesyon, genel korku.
:::

## Ortalama Hisse Ortalama Değildir

Borsanın uzun vadeli getirisi hisselere eşit dağılmaz. Getirilerin dağılımı çarpıktır: çok sayıda sıradan ya da kötü sonuç, çok az sayıda devasa kazananla dengelenir.

::: sayilar Seçim Probleminin Rakamları
~%4 | 1926-2016 arasında ABD borsasındaki net servet artışının tamamını üreten hisselerin payı
>%50 | Aynı dönemde ömrü boyunca bir aylık hazine bonosundan az getiren hisselerin payı
~%90 | On beş yıllık pencerede S&P 500'ün gerisinde kalan ABD büyük ölçekli aktif fonların payı
:::

İlk iki satır aynı çalışmadan geliyor ve birlikte okununca şunu söylüyor: rastgele seçilmiş tek bir hissenin, borsanın ortalamasını yakalama ihtimali yarıdan azdır. Endeks ise o az sayıdaki büyük kazananı **tanımı gereği** içinde taşır; kimin kazanacağını bilmek zorunda kalmaz. Üçüncü satır da işin profesyonellere de kolay gelmediğini gösterir.

::: ornek Beş Hisse, Bir Kazanan
Beş hisseye eşit para koyduğunu düşün. Dördü dönem sonunda %20 kaybettirir, biri %300 kazandırır.
Beşini birden tutan portföy: (4 × −20 + 300) ÷ 5 = **+%44**.
Aynı beş hisseden rastgele yalnızca birini seçen kişi ise beşte dört ihtimalle **−%20** ile kapanır.
Ortalama getiri iki durumda da aynıdır. Değişen, sonucun dağılımıdır: tek hisse seçen biri ortalamayı değil, kendi şansını yaşar.
:::

## Tek Hisse İki Riski Birden Taşır

Tek bir hisse aldığında hem piyasa riskini hem şirkete özgü riski taşırsın. İkincisi [çeşitlendirmeyle](/rehber/cesitlendirme) neredeyse sıfıra indirilebilir; birincisi indirilemez.

Bunun sonucu önemlidir: piyasa, çeşitlendirilerek ortadan kaldırılabilecek bir risk için ek getiri ödemez. Tek hisse taşımak daha fazla risk almak demektir ama o fazladan riskin karşılığında **beklenen** getiri otomatik olarak artmaz. Artması için seçimin gerçekten isabetli olması gerekir.

## Karşılaştırma

| Konu | Endeks Fonu | Tek Hisse |
|---|---|---|
| **Neye Bahis** | Piyasanın geneline | O şirketin piyasadan iyi yapmasına |
| **Maliyet** | Yıllık gider oranı, genellikle düşük | Gider oranı yok, ama araştırma zamanı var |
| **Kötü Senaryo** | Piyasayla birlikte düşüş | Şirkete özgü çöküş, sıfıra kadar |
| **Takip Yükü** | Düşük | Her çeyrek bilanço, haber, rehberlik |
| **Yanılma Biçimi** | Zamanlamada | Hem zamanlamada hem seçimde |

## Tek Hisse Ne Zaman Anlamlı Olur

Tek hisse almak meşru bir tercihtir; yalnızca bir iddia taşıdığını bilmek gerekir. Bu iddia genellikle üç koşulda savunulabilir:

1. **Şirket hakkında bir görüşün var** ve bu görüş piyasanın fiyata koyduğundan farklı. "İyi şirket" bir görüş değildir; iyi şirketler zaten pahalı fiyatlanır. Ayrıntı: [F/K ve Değerleme Oranları](/rehber/degerleme)
2. **Takip edecek zamanın var.** Bilançoları okumak, rehberlik değişikliklerini izlemek, tezin çürüdüğünü fark etmek süreklilik ister.
3. **Pozisyon büyüklüğü sınırlı.** Tek bir şirketin çökmesi portföyünü taşınamaz bir yere götürmüyorsa. Ayrıntı: [Risk Yönetimi](/rehber/risk-yonetimi)

Bazı yatırımcılar bu yüzden iki katmanlı düşünür: portföyün büyük kısmı geniş bir endekste, küçük bir kısmı görüş taşıdığı şirketlerde. Bu bir öneri değil, iki aracın farklı işler yaptığını kabul eden bir çerçevedir.

::: dikkat Endeks Fonu da Risklidir
Endeks fonu şirkete özgü riski azaltır, piyasa riskini azaltmaz. S&P 500 2008-2009'da zirveden yarıdan fazla düştü ve fonu tutan herkes o düşüşü birebir yaşadı. Ayrıca piyasa değeri ağırlıklı bir endekste en büyük birkaç şirket endeksin önemli bir kısmını taşır; "500 şirket" göründüğü kadar dağınık değildir. Ayrıntı: [Endeks Nedir?](/rehber/endeks)
:::

::: ozet Özet
Endeks fonu "hangi şirket kazanacak" sorusunu cevaplamak zorunda kalmadan piyasanın getirisini almaktır. Tek hisse, o soruya bir cevabın olduğunu iddia etmektir. İkisi de meşru; sorun, bir tema hakkında haklı olup yanlış şirketi seçtiğinde ya da elindekinin bir iddia olduğunu unuttuğunda başlar.
:::

## Bu Sitede Nerede Görürsün

[Karşılaştır](/karsilastir) ekranında bir hisseyi SPY ya da QQQ ile aynı ölçekte çizebilirsin: şirket seçiminin endekse göre ne kattığı ya da ne götürdüğü tek grafikte okunur. ETF sayfalarında şirket metrikleri yerine fon künyesi durur.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: SEC, "Statement on the Approval of Spot Bitcoin Exchange-Traded
     Products" (10 Ocak 2024; işlem 11 Ocak 2024'te başladı). SEC onayı spot
     ether ETP'leri (Mayıs 2024 kural değişikliği, işlem 23 Temmuz 2024).
     SEC basın bülteni 2025-101: kripto ETP'lerde ayni (in-kind) yaratma ve
     itfa onayı, 29 Temmuz 2025. Fon izahnameleri (S-1): 1933 Kanunu altında
     kayıtlı grantor trust yapısı, 1940 Kanunu kapsamında yatırım şirketi
     değil; NAV bir referans fiyata (ör. CF Benchmarks, 16:00 ET) göre
     hesaplanıyor. GBTC'nin dönüşümdeki %1,5 gider oranı izahnameden.
     Vadeli işlem tabanlı ilk bitcoin ETF'i Ekim 2021. 2022 düşüşü (~%64)
     yıl başı/yıl sonu kapanışlarından yuvarlandı. */
  "kripto-etf": {
    title: "Kripto ETF'leri: Spot Bitcoin ve Ether Fonları Ne Tutar?",
    dek: "Bir borsa fonunun içinde gerçek bitcoin: ne kazandırdığı kadar ne kaybettirdiği de paketin yapısından geliyor.",
    bodyMd: `Ocak 2024'e kadar ABD borsalarında bitcoin'in kendisini tutan bir ETF yoktu. Vadeli işlem sözleşmesi tutan fonlar ve tezgâh üstünde işlem gören, fiyatı içindeki varlıktan sık sık kopan tröstler vardı. SEC'in onayıyla birlikte ilk kez **gerçek bitcoin tutan** fonlar borsada işlem görmeye başladı; altı ay sonra aynısı ether için geldi. Bu yazı bu fonların ne olduğunu anlatır, alınıp alınmaması gerektiğini değil.

::: tanim Spot Kripto ETF'i
İçinde doğrudan kripto varlığın kendisini (bitcoin ya da ether) tutan ve payları ABD borsalarında hisse gibi işlem gören fon. Varlık bir saklama kuruluşunda, çoğunlukla internete bağlı olmayan cüzdanlarda tutulur.
:::

::: zaman Düzenleyici Takvim
Ekim 2021 | İlk **vadeli işlem tabanlı** bitcoin ETF'i işlem görmeye başlar. Fon bitcoin değil, bitcoin vadeli sözleşmesi tutar.
10 Ocak 2024 | SEC spot bitcoin ETF'lerini onaylar; işlem ertesi gün başlar.
23 Temmuz 2024 | Spot ether ETF'leri işlem görmeye başlar.
29 Temmuz 2025 | SEC, fon paylarının nakit yerine doğrudan kripto varlıkla yaratılıp itfa edilmesine izin verir.
:::

## İçeride Ne Var, Fiyat Nasıl Oluşur

Fonun her payı belirli miktarda bitcoin'i temsil eder. Pay sayısı, büyük aracı kurumların (yetkili katılımcılar) fona varlık getirip yeni pay yaratması ya da pay iade edip varlık çekmesiyle değişir. Bu mekanizma fon fiyatını içindeki bitcoin'in değerine yakın tutar: fiyat açılırsa arbitrajcı devreye girer.

Fonun net varlık değeri (NAV) her gün, belirli bir saatte hesaplanan bir **referans fiyata** göre bulunur; tek bir kripto borsasının fiyatına değil. Ayrıntı: [ETF Nedir?](/rehber/etf)

## Takip Farkı Nereden Gelir

Fonun getirisi bitcoin'in getirisine hiçbir zaman birebir eşit olmaz. Farkı üç şey açar:

- **Gider oranı.** Yıllık yönetim ücreti fonun içindeki bitcoin'den her gün küçük parçalar hâlinde düşülür. Lansman döneminde yeni fonların çoğu yılda yaklaşık %0,2-0,25 bandındaydı; tröstten dönüşen en eski fon %1,5 ile başladı. Ücretler değişebilir, güncel oran fonun kendi sayfasında yazar.
- **Saat farkı.** Bitcoin yedi gün, yirmi dört saat işlem görür; fon yalnızca ABD seansında. Hafta sonu olan bir hareket fonda pazartesi açılışında tek bir fiyat boşluğu olarak görünür.
- **Spread ve prim/iskonto.** Fon payı piyasada NAV'ın biraz üstünde ya da altında el değiştirebilir. Ayrıntı: [Likidite ve Spread](/rehber/spread-likidite)

::: ornek Yatay Bir Yılın Hesabı
Bitcoin bir yılı başladığı fiyatta bitirdi. Gider oranı %0,25 olan bir fonun payı aynı dönemde yaklaşık **%0,25 geride** kapanır, çünkü her gün düşülen ücret fonun içindeki bitcoin miktarını azaltmıştır.
Gider oranı %1,5 olan bir fonda aynı fark %1,5'tir. On yılda bu, bileşik olarak **yaklaşık %14**'lük bir fark demektir.
:::

## Üç Yol, Üç Yapı

| Konu | Doğrudan Kripto | Spot ETF | Vadeli İşlem ETF'i |
|---|---|---|---|
| **Ne Tutarsın** | Varlığın kendisi | Fon payı | Vadeli sözleşme tutan fonun payı |
| **Anahtarlar** | Sende ya da platformda | Saklama kuruluşunda | Yok, varlık hiç tutulmuyor |
| **İşlem Saati** | Her an | ABD seansı | ABD seansı |
| **Ek Maliyet** | Platform ücreti, çekim ücreti | Gider oranı | Gider oranı + vade yenileme maliyeti |
| **Çekebilir Misin** | Evet | Hayır, yalnızca satarsın | Hayır |

Vadeli işlem tabanlı fonlarda son satırın ötesinde bir maliyet daha var: sözleşmeler her ay vadesi gelince daha uzak vadeliyle değiştirilir ve uzak vade genellikle daha pahalıdır. Bu "yenileme maliyeti" spot fonda yoktur.

## Yapının Getirdiği Sınırlar

Spot kripto fonları ABD'de klasik yatırım fonlarını düzenleyen 1940 Kanunu kapsamında değil, bir **tröst** olarak kayıtlıdır. Pratik anlamı: yatırım fonlarına özgü bazı yatırımcı korumaları (yönetim kurulu yapısı, portföy kuralları) burada aynı şekilde uygulanmaz. Fonun ne yaptığı izahnamede yazar ve okunmaya değer tek belge odur.

Fon payı sahibi olarak bitcoin'in kendisi üzerinde bir talebin yoktur: payı ancak borsada satabilirsin, içindeki bitcoin'i hesabına çekemezsin.

::: dikkat Paket Oynaklığı Değiştirmez
Bir ETF'in içine konmak bitcoin'i daha az oynak yapmaz. Bitcoin 2022'de yıl başından yıl sonuna yaklaşık üçte iki değer kaybetti; o yıl bir spot fon var olsaydı aynı düşüşü birebir yaşardı. Borsada işlem görmesi ürünü tanıdık gösterir, riskini değil. Ayrıntı: [Volatilite Nedir?](/rehber/volatilite)
:::

::: ozet Özet
Spot kripto ETF'i, kripto varlığı bir hisse hesabının içine taşıyan bir pakettir. Saklama, anahtar ve platform sorunlarını ortadan kaldırır; karşılığında gider oranı, seans saati ve varlığı hiçbir zaman eline alamama bedeli gelir. Oynaklığı ise olduğu gibi taşır.
:::

*Bu yazı SEC kararlarına ve fon izahnamelerine dayanıyor; gider oranları fon sağlayıcıların kararıyla değişebilir.*`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: SEC Investor Bulletin "American Depositary Receipts" (Level
     I/II/III, depo bankası, ücretler); TSMC 20-F (1 ADS = 5 adi hisse).
     SEC, "Special Purpose Acquisition Companies, Shell Companies, and
     Projections" nihai kuralları (24 Ocak 2024 kabul, 1 Temmuz 2024
     yürürlük). SEC Investor Bulletin "What You Need to Know About SPACs"
     (emanet hesabı, iade hakkı, sponsorun kurucu payları). Kurucu payının
     halka arz sonrası toplam payın ~%20'si olması piyasa teamülü, kural
     değil — metinde "genellikle" diye yazıyor. */
  "adr-spac": {
    title: "ADR ve SPAC Nedir?",
    dek: "ABD borsasında işlem gören ama ABD'de kurulmamış şirketler ile hiç şirketi olmadan halka açılan şirketler.",
    bodyMd: `ABD borsasındaki her sembol, arkasında ABD'de kurulmuş ve orada faaliyet gösteren bir şirket anlamına gelmez. İki yapı bu kuralın dışında durur ve ikisi de kendine özgü riskler taşır: yabancı şirketlerin hissesini temsil eden **ADR**'ler ve halka arz edildiği gün henüz bir işi olmayan **SPAC**'ler.

## ADR: Başka Bir Borsadaki Hissenin Makbuzu

::: tanim ADR (American Depositary Receipt)
Yabancı bir şirketin kendi ülkesinde işlem gören hisselerini temsil eden, dolar cinsinden ve ABD borsasında işlem gören sertifika. Hisselerin kendisi bir depo bankasında saklanır, ABD'de onları temsil eden makbuz alınıp satılır.
:::

Mekanizma basittir: bir ABD depo bankası şirketin kendi borsasından hisse alır, yerel bir saklama kuruluşunda tutar ve karşılığında ABD'de ADR çıkarır. Her ADR belirli sayıda yerel hisseyi temsil eder ve bu oran bire bir olmak zorunda değildir.

::: ornek Oran ve Fiyat
TSMC'nin ABD'deki bir ADR'si Tayvan'da işlem gören **5 adi hisseyi** temsil eder. ADR'nin fiyatı bu yüzden kabaca şuna eşittir:
Tayvan'daki hisse fiyatı × 5 ÷ dolar/Tayvan doları kuru.
Aradaki fark büyürse aracı kurumlar hisse ile ADR arasında dönüşüm yaparak farkı kapatır. Dönüşümün kısıtlı olduğu ülkelerde ADR kalıcı bir prim ya da iskontoyla işlem görebilir.
:::

### Üç Seviye

| Seviye | Nerede İşlem Görür | Sermaye Toplayabilir mi | Raporlama |
|---|---|---|---|
| **Level I** | Tezgâh üstü (OTC) | Hayır | En hafif |
| **Level II** | NYSE ya da Nasdaq | Hayır | SEC'e yıllık rapor |
| **Level III** | NYSE ya da Nasdaq | Evet, ABD'de halka arz | En kapsamlı |

Yabancı şirketler 10-K ve 10-Q yerine yıllık **20-F** ve dönemsel **6-K** raporları verir. Birçoğu çeyrek raporu yayımlamaz, yalnızca yarıyıl ya da ülkesinin kurallarına göre raporlar. Ayrıntı: [10-K ve 10-Q Nasıl Okunur?](/rehber/10k-10q)

### ADR'nin Görünmeyen Katmanları

- **Kur riski içinde gizlidir.** ADR dolar cinsinden işlem görür ama şirketin kazancı ve yerel hisse fiyatı kendi para birimindedir. Yerel hisse sabit kalırken yerel para dolara karşı değer kaybederse ADR düşer. Ayrıntı: [Kur Riski](/rehber/kur-riski)
- **Temettüde vergi başka bir ülkeden kesilir.** ADR'nin temettüsünden şirketin kendi ülkesi vergi keser, ABD değil; W-8BEN'in anlattığı oran burada geçerli değildir.
- **Depo ücreti vardır.** Depo bankası ADR başına yıllık birkaç sentlik bir saklama ücreti alabilir; çoğu zaman temettüden düşülür ya da aracı kurum üzerinden tahsil edilir.

## SPAC: Önce Para, Sonra Şirket

::: tanim SPAC (Special Purpose Acquisition Company)
Kendi işi olmayan, halka arzla para toplayıp bu parayı belirli bir süre içinde özel bir şirketle birleşmek için kullanan kabuk şirket. Birleşme gerçekleştiğinde hedef şirket borsaya bu yoldan girmiş olur.
:::

::: akis Bir SPAC'ın Yolu
Halka Arz | Birim başına genellikle 10 $, para emanet hesabına
Hedef Arayışı | Genellikle 18-24 ay
Birleşme Duyurusu | Hedef şirket ve değerlemesi açıklanır
Oylama ve İade | Hissedar ya kalır ya parasını geri alır
Birleşme Sonrası | Hedef şirket kendi sembolüyle işlem görür
:::

Toplanan para bir emanet hesabında, genellikle kısa vadeli ABD hazine bonolarında bekler. Hissedarın en önemli hakkı **iade hakkıdır**: birleşme oylamasında hedefi beğenmezse payını emanet hesabındaki tutar üzerinden (birim başına yaklaşık 10 $ artı birikmiş faiz) geri verebilir. Süre dolar ve birleşme olmazsa para hissedarlara iade edilir.

## Sponsorun Payı: Seyrelmenin Aritmetiği

SPAC'ı kuran sponsor, halka arzdan önce çok düşük bir bedelle **kurucu payları** alır; bunlar genellikle halka arz sonrası toplam payların yaklaşık beşte biridir. İade oranı yükseldikçe bu payların ağırlığı büyür.

::: ornek 100 Milyon Dolarlık Bir SPAC
Halka arzda 10 milyon pay, 10 $'dan satılır: emanette 100 milyon dolar. Sponsor 2,5 milyon kurucu payı taşır. Toplam 12,5 milyon pay.
Birleşme oylamasında halka açık payların **%80'i** iade edilir. Emanette 20 milyon dolar, dışarıda 2 milyon halka açık pay kalır; sponsorun 2,5 milyon payı yerinde durur.
Kalan 4,5 milyon payın her birine düşen emanet nakdi: 20 ÷ 4,5 ≈ **4,4 $**. Birleşme sonrası şirketin payı 10 $'dan işlem görmeye başlıyorsa, bu farkı hedef şirketin kendisinin kapatması gerekir.
:::

İade oranları 2021 sonrasında sık sık çok yüksek seviyelere çıktı ve birleşme sonrası birçok şirket, SPAC'ın 10 $'lık başlangıcının çok altına indi. SEC, 2024 ortasında yürürlüğe giren kurallarla SPAC birleşmelerinde sponsor çıkarları, seyrelme ve gelecek tahminleri konusunda açıklama yükünü artırdı; bu, klasik [halka arza](/rehber/halka-arz) yaklaşan bir denetim anlamına geliyor.

::: dikkat Birleşme Sonrası Satış Baskısı
Kurucu paylar ve birleşmeyle birlikte ek finansman sağlayan yatırımcıların payları çoğu zaman belirli bir süre satış yasağına tabidir. Bu süre dolduğunda arz bir anda artabilir. SPAC'tan gelen bir şirketin payında bu takvimi bilmek, halka arz sonrası kilitlenme süresini bilmek kadar önemlidir.
:::

::: ozet Özet
ADR yabancı bir hisseyi dolar cinsinden taşır, beraberinde kur riskini, başka bir ülkenin vergisini ve depo ücretini getirir. SPAC ise önce parayı toplar, şirketi sonra bulur; hissedarı iade hakkı korur, sponsorun kurucu payları ise iade arttıkça kalanların payını seyreltir. İkisinde de sembolün arkasındaki yapıyı bilmeden fiyatı okumak eksik kalır.
:::

## Bu Sitede Nerede Görürsün

Bir ADR'nin sayfasında fiyat ve piyasa değeri dolar cinsindendir; şirketin kendi ülkesindeki borsada oluşan hareket ve kur etkisi bu sayılara birlikte yansır. Yaklaşan halka arzlar [Takvim](/takvim) ekranında listelenir.`,
  },

  /* ==== 2 · Pozisyon ve Risk ============================================== */

  /* ---------------------------------------------------------------------- */
  "emir-tipleri": {
    title: "Emir Tipleri: Piyasa, Limit ve Stop",
    dek: "Hangi tuşa bastığın, ne aldığından bazen daha önemlidir.",
    bodyMd: `Aynı hisseyi aynı anda almak isteyen iki kişi, farklı emir tipleri kullanarak farklı fiyatlara sahip olabilir. Emir tipi, işlemin **ne zaman** ve **hangi fiyattan** gerçekleşeceğini belirleyen kuraldır.

::: tanim Üç Temel Emir
**Piyasa emri:** "Ne olursa olsun hemen al." Fiyatı sen belirlemezsin.
**Limit emri:** "Şu fiyattan ya da daha iyisinden al." Fiyatı sen belirlersin, gerçekleşme garantisi yoktur.
**Stop emri:** "Fiyat şu seviyeye gelirse harekete geç." Bir tetikleyicidir, bir fiyat değil.
:::

## Piyasa Emri

Emir defterindeki en iyi karşı fiyattan başlayarak anında dolar. Avantajı kesinlik: **gerçekleşir**. Dezavantajı da aynı yerde: hangi fiyattan gerçekleşeceğini bilmezsin.

Likit bir hissede fark önemsizdir. Likit olmayan bir hissede ya da açılışın ilk saniyelerinde piyasa emri, defterin birkaç kademesini birden yiyerek beklediğinden çok kötü bir ortalamayla dolabilir. Buna **slippage** (kayma) denir.

## Limit Emri

Bir tavan (alışta) ya da taban (satışta) koyarsın. Fiyat oraya gelmezse emir bekler, gün sonunda ya da belirlediğin süre dolduğunda iptal olur.

| | Piyasa emri | Limit emri |
|---|---|---|
| Gerçekleşme | Garanti | Garanti değil |
| Fiyat | Garanti değil | Garanti |
| Ne zaman kullanılır | Hızın fiyattan önemli olduğu an | Neredeyse her zaman |
| Riski | Kötü fiyattan dolmak | Hiç dolmamak |

> Yeni başlayan biri için pratik kural: aksini gerektiren özel bir sebep yoksa **limit emir** kullan.

::: ornek Aynı Anda İki Farklı Sonuç
Alış 100,00 · satış 100,40 olan az işlem gören bir hisse. Piyasa emri verirsen 100,40'tan, hatta defter inceyse 100,80'den dolarsın. 100,10 limit emri verirsen ya 100,10'dan alırsın ya da hiç alamazsın. İkinci durumda kaybettiğin şey bir fırsattır; birincisinde kaybettiğin şey paradır. İkisinin bedeli aynı değildir.
:::

## Stop Emri

Stop bir tetikleyicidir. Fiyat belirlediğin seviyeye değdiği anda emir **aktifleşir** ve piyasa emrine dönüşür.

- **Stop-loss (zarar kes):** Elindeki pozisyonda fiyat belirli bir seviyenin altına inerse satar. Kaybı sınırlamak içindir.
- **Stop-limit:** Tetiklenince piyasa emri değil, limit emri gönderir. Kötü fiyattan satmayı önler ama hiç satmama riski taşır.
- **Trailing stop (takip eden stop):** Seviye fiyatla birlikte yukarı kayar, aşağı inmez. Kârı korumak için kullanılır.

::: dikkat Stop Bir Sigorta Değildir
En sık yanılgı budur. Stop, fiyat oraya *değdiğinde* bir piyasa emri gönderir — o fiyattan satacağını garanti etmez. Kötü bir haberle gece boyunca %20 aşağıda açan bir hissede 5 aşağıya koyduğun stop, açılıştaki 20 aşağıda dolar. Stop, kademeli düşüşlere karşı işe yarar; ani gap'lere karşı yaramaz.
:::

## Süre Seçenekleri

| Kısaltma | Anlamı |
|---|---|
| **DAY** | Gün sonunda iptal olur (varsayılan) |
| **GTC** | İptal edilene kadar geçerli (*good till cancelled*) |
| **IOC / FOK** | Anında dolsun, dolmayan kısım iptal olsun |

GTC emirlerini takip etmeyi unutmak klasik bir hatadır: aylar önce koyduğun bir alım emri, şirket hakkındaki görüşün tamamen değiştikten sonra sessizce dolabilir.

::: ozet Pratik Kurallar
Alırken limit kullan, aceleyi maliyet olarak gör. Stop'u pozisyonu açarken belirle, düştükten sonra değil. Açılışın ilk beş ve kapanışın son beş dakikasında piyasa emri verme — spread orada en geniştir.
:::

## Bu Sitede Nerede Görürsün

Açılış Zili bir aracı kurum değildir; buradan emir verilmez ve bu ekranlarda emir defteri gösterilmez. Bu yazının amacı, kendi aracı kurumundaki ekranı okuyabilmen.`,
  },

  /* ---------------------------------------------------------------------- */
  "risk-yonetimi": {
    title: "Risk Yönetimi: Ne Kadar, Ne Zaman",
    dek: "Kazanmayı değil, oyunda kalmayı belirleyen tek beceri.",
    bodyMd: `Yeni başlayan biri "ne alsam" diye sorar. Uzun süre kalabilen biri "ne kadar alsam" diye sorar. İkinci soru daha az heyecanlıdır ve sonucu daha çok belirler.

::: tanim Risk Yönetimi
Bir pozisyonun aleyhine gitmesi durumunda ne kadar kaybedeceğine **önceden** karar vermek ve pozisyon büyüklüğünü o karara göre ayarlamak.
:::

## Asimetrinin Matematiği

Kayıplar simetrik değildir. Kaybettiğin yüzde ile başa dönmek için gereken yüzde aynı değildir:

::: bar Başa Dönmek İçin Gereken Yükseliş
%10 kayıp | %11
%25 kayıp | %33
%50 kayıp | %100
%75 kayıp | %300
%90 kayıp | %900
:::

Bu tablo, risk yönetiminin neden bir tercih değil bir zorunluluk olduğunu tek başına anlatır. Küçük kayıpları küçük tutmak, büyük kazançlar aramaktan daha kolaydır ve sonuca daha çok katkı yapar.

## Pozisyon Büyüklüğü Nasıl Hesaplanır

Profesyoneller "kaç lot alayım" diye düşünmez. Şu sırayla ilerler:

1. **Toplam sermayenin yüzde kaçını riske atacağına karar ver.** Yaygın kural: tek bir fikirde toplamın **%1–2**'sinden fazlasını riske atma.
2. **Nerede yanıldığını kabul edeceğini belirle.** Yani stop seviyesini.
3. **İkisini böl.**

::: ornek Sayılarla
Sermayen 10.000 dolar. İşlem başına en fazla %1 riske atmaya karar verdin — yani 100 dolar.
Hisse 50 dolar. Fiyat 45'in altına inerse fikrin yanlış demektir; stop 45.
Hisse başına risk: 50 − 45 = **5 dolar**.
Alacağın adet: 100 ÷ 5 = **20 adet**.
Pozisyonun büyüklüğü 20 × 50 = 1.000 dolar, yani sermayenin %10'u. Ama riskin %10 değil, **%1**.
:::

Bu ayrım kritik: pozisyon büyüklüğü ile risk aynı şey değildir. Riski belirleyen şey, pozisyonun büyüklüğü ile stop mesafesinin çarpımıdır.

## Stop Mesafesini Ne Belirler

Yuvarlak bir sayı değil, hissenin kendi karakteri. Günde ortalama %4 oynayan bir hisseye %2'lik bir stop koymak, "beni sıradan bir gün içinde piyasadan çıkar" demektir. Volatilitesi yüksek bir hissede stop uzak, pozisyon küçük olmalı. Ayrıntı: [Volatilite Nedir?](/rehber/volatilite)

## Sık Yapılan Dört Hata

| Hata | Neden Yanlış |
|---|---|
| Stop'u Düştükten Sonra Aşağı Çekmek | Kararı korkuya devretmek. Kaybın sınırı kalmaz. |
| Zarardaki Pozisyona Ekleme Yapmak | Yanlış fikre daha çok para koymak. Ortalama düşer, risk artar. |
| Kazançlı Pozisyonu Erken, Zararlıyı Geç Kapatmak | Küçük kâr, büyük zarar. Yukarıdaki tabloyu tersine çevirir. |
| Tek Fikre Büyük Ağırlık Vermek | Bir hata sermayenin yarısını götürebilir. |

::: dikkat Ortalama Düşürmenin İki Yüzü
"Düştükçe ekle" stratejisi, şirketin değeri hakkında haklıysan işe yarar; haksızsan seni hızlandırarak batırır. Fark, ekleme kararını *fiyat düştüğü için* mi yoksa *şirket hakkındaki bilgin değişmediği için* mi verdiğindedir. Fiyat tek başına bir gerekçe değildir.
:::

## Kaybetmeyi Planlamak

İyi bir yatırımcı pozisyon açmadan önce üç soruya cevap verir:

1. Bu fikirde yanılırsam bunu nereden anlarım?
2. Yanılırsam ne kadar kaybederim?
3. O kayıp gerçekleştiğinde uykum kaçar mı?

Üçüncü sorunun cevabı "evet" ise pozisyon büyüktür. Bu, matematiksel değil pratik bir kriterdir ve en güvenilir olanıdır.

::: ozet Tek Cümlelik Özet
Ne kadar kazanacağını piyasa belirler, ne kadar kaybedeceğini sen belirlersin. Risk yönetimi bu ikinci cümlenin uygulamaya dökülmüş hâlidir.
:::`,
  },

  /* ---------------------------------------------------------------------- */
  "teknik-gorusler": {
    title: "Teknik Görüşler: AL, TUT ve SAT Ne Demek?",
    dek: "Görüş bir emir değil; bir bölgesi, bir vazgeçme noktası ve bir sırası olan plan.",
    bodyMd: `Teknik analiz ekranındaki her kartın başında tek bir kelime durur: AL, TUT ya da SAT. Tek kelime bir emir gibi okunur ("şimdi hepsini al", "şimdi hepsini sat") ama kastettiği bu değildir. Kelime, altındaki planın özetidir; plan ise her zaman üç soruya cevap verir: **nereden alınır, nerede satılır, nerede vazgeçilir.**

::: tanim Teknik Görüş
Günlük grafikteki trend, destek-direnç ve momentumun bugün yeni bir alım için gerekçe verip vermediğinin özeti. Bir fiyat tahmini değil, koşullu bir plandır: "fiyat şu bölgedeyse şu, şu seviyenin altına inerse bu".
:::

## Üç Görüş, Tek Tabloda

| Görüş | Grafik Ne Diyor | Yayında Ne Var |
|---|---|---|
| AL | Trend yukarı, fiyat 50 günlük ortalamanın üstünde, bir destek üzerinde alım bölgesi var | Alım bölgesi, stop, 1–3 hedef |
| TUT | Tablo karışık ya da trend sağlam ama fiyat bölgeden uzak | Varsa bölge, destek ve dirençler |
| SAT | Trend aşağı, fiyat 50 ve 200 günlük ortalamaların altında | Tepkide satış seviyeleri (dirençler), destek |

## AL: Bölgede Alım Planı

AL, "fiyat ne olursa olsun şimdi al" demek değildir. Plan bir **alım bölgesi** verir; bu tek bir fiyat değil, bir aralıktır. Fiyat bölgenin üstündeyse plan onu kovalamaz, geri çekilmeyi bekler. Fiyat stopun altına inerse plan bozulur.

İlk hedef, bölgenin tepesinden stopa kadar olan riskin en az 1,5 katı uzaklıkta seçilir. Daha yakın bir hedef varsa görüş AL olmaz; ödül riski karşılamıyordur.

::: ornek Varsayımsal Bir Plan
Alım bölgesi 96–100, stop 92, hedefler 112 ve 120.
Bölgenin tepesinden stopa risk: 100 − 92 = **8**.
İlk hedefe getiri: 112 − 100 = **12**. Oran 1 : 1,5.
:::

### Kademeli mi, Tek Seferde mi?

İkisi de plana aykırı değildir; fark riskin nasıl ölçüldüğündedir.

- **Tek seferde:** Bölgenin herhangi bir yerinden bir kerede alınır. Risk en kötü hâliyle, bölgenin tepesinden stopa kadar hesaplanır.
- **Kademeli:** Alım bölgeye yayılır (bir kısmı üst uçta, kalanı alt uca doğru). Ortalama maliyet düşer, stopa uzaklık kısalır. Bedeli şudur: fiyat alt uca inmeden dönerse pozisyon yarım kalır.

::: ornek Aynı Plan, İki Uygulama
Sermaye 10.000 dolar, fikir başına en fazla %1 risk: 100 dolar.
Tek seferde 100'den: hisse başına risk 8, en fazla **12 adet**.
Kademeli, 6 adet 100'den, 6 adet 96'dan: ortalama maliyet 98, hisse başına risk 6, toplam risk **72 dolar**.
Fiyat 96'ya inmeden yükselirse elde 6 adet kalır; risk de getiri de yarıdır.
:::

Hangi yol seçilirse seçilsin tutarı belirleyen şey stop mesafesidir. Ayrıntı: [Risk Yönetimi](/rehber/risk-yonetimi)

### Pozisyon Zaten Varsa

Pozisyon taşınır, stop vazgeçme noktası olarak izlenir. Hedefler tek bir satış yeri değil, kâr almanın duraklarıdır. Yaygın bir yöntem, ilk hedefte bir kısmını satıp kalanı sonraki hedefe taşımaktır: kârın bir bölümü kesinleşir, yükselişin devamından da pay kalır.

## TUT: Bekle Ama Satma

TUT iki farklı durumu anlatır: göstergeler birbirini tutmuyordur ya da trend sağlamdır ama fiyat alım bölgesinden uzaktır. İkisinde de ortak cevap aynıdır: yeni alım için acele yok, satış için de gerekçe yok.

- **Pozisyonun yoksa:** Bölge verilmişse fiyatın oraya gelmesi ve teyit beklenir: bölgede tutunan bir kapanış, ortalamanın üstünde hacim. Bölge yoksa listelenen destek ve dirençler izlenir.
- **Pozisyonun varsa:** TUT satmak demek değildir. Stop verilmişse o seviye, verilmemişse en yakın destek izlenir. Aşağı kırılırsa görüş SAT'a dönebilir.

::: dikkat Eklemek İçin AL'ı Beklemek
Zayıflayan bir hissede "ucuzladı" diye pozisyonu büyütmek, yanlış fikre daha çok para koymak olabilir. Var olan pozisyona eklemek için görüşün AL'a dönmesini beklemek, eklemeyi fiyata değil grafiğin toparlanmasına bağlar.
:::

## SAT: Yeni Alım Yok, Tepkide Azalt

SAT görüşünde alım bölgesi ve stop yayımlanmaz; çünkü plan bir alım planı değildir. Hedef diye listelenen seviyeler, fiyatın tepki verirse takılabileceği **dirençlerdir.**

- **Pozisyonun yoksa:** Yeni alım yapılmaz. SAT bir açığa satış önerisi de değildir. Alım için görüşün TUT'a ya da AL'a dönmesi, yani fiyatın ortalamaları geri alması beklenir.
- **Pozisyonun varsa:** SAT, "hepsini hemen sat" demek değildir. Plan, fiyatın dirençlere yükseldiği tepkileri pozisyonu azaltma fırsatı olarak görür. Çıkış da kademeli olabilir: ilk dirençte bir kısmı, sonrakinde kalanı.

::: dikkat Tepki Gelmezse
Plan bir destek seviyesi de verir. O destek kırılırsa düşüş sürer; o durumda tepki beklemek riski büyütür. Kademeli çıkış bir fırsatı kullanmanın yolu, düşüşü görmezden gelmenin değil.
:::

Ne kadarının satılacağını ekran bilemez; bunu senin maliyetin, pozisyonun portföydeki ağırlığı ve vergi durumun belirler. Yurt dışı hisse kazancı beyana tabidir, satışın zamanlaması vergiyi değiştirebilir. Ayrıntı: [Yurt Dışı Hisse Vergisi](/rehber/yurt-disi-hisse-vergisi)

## Görüş Neden Kolay Değişmez

Görüş her yayında gözden geçirilir ama somut bir tetik olmadan değişmez:

- bir hareketli ortalamanın kırılması ya da geri alınması,
- fiyatın stopun altına inmesi,
- alım bölgesinin yeniden kurulması.

Tek günlük sert bir hareket görüşü çevirmez. Göstergeler günlük kapanışlardan hesaplanır; plan gün içi al-sat için değil, günlük grafiği okuyanlar için yazılır. Görüşün bir yayından ötekine sık sık dönmesi planı değil gürültüyü izlemek olurdu.

::: ozet Tek Cümlelik Özet
AL bir bölgede alım planı, TUT beklemek ama satmamak, SAT yeni alım yapmamak ve tepkileri azaltma fırsatı olarak görmek demektir; üçünde de ne kadar alınıp satılacağını stop mesafesi ve senin kendi durumun belirler.
:::

Bu yazı bir yöntem anlatımıdır. **Yatırım Tavsiyesi Değildir.**`,
  },

  /* ---------------------------------------------------------------------- */
  "cesitlendirme": {
    title: "Çeşitlendirme: Kaç Sepet Yeter?",
    dek: "On farklı hisse almak, on farklı riske sahip olmak demek değildir.",
    bodyMd: `"Bütün yumurtaları aynı sepete koyma" cümlesini herkes bilir. Az bilinen kısım şu: on farklı sepet aldığını sanırken hepsini aynı kamyona yüklemiş olabilirsin.

::: tanim Çeşitlendirme
Portföyü, birbirinden bağımsız hareket eden varlıklara dağıtarak toplam dalgalanmayı düşürmek. Anahtar kelime **bağımsız**: sayı değil, birbirine bağlılık önemlidir.
:::

## Neden İşe Yarar

Portföyün riski, içindeki varlıkların risklerinin ortalaması değildir — ondan **düşüktür**. Sebep basit: aynı gün bazıları artar, bazıları düşer ve hareketler kısmen birbirini götürür.

Bu, finansta bedavaya en yakın şeydir: beklenen getiriden feragat etmeden dalgalanmayı düşürürsün.

## Ama Yalnızca Bağımsızlarsa

::: ornek Sahte Çeşitlendirme
Portföyünde NVDA, AMD, AVGO, MU, TSM ve bir de yarı iletken ETF'i var. Altı farklı sembol, tek bir bahis. Yapay zekâ talebi hakkındaki beklenti değişirse altısı da aynı gün, aynı yönde, benzer büyüklükte düşer. Bu portföy çeşitlendirilmiş değil, yalnızca **parçalanmıştır**.
:::

Gerçek çeşitlendirme farklı eksenlerde olur:

| Eksen | Örnek |
|---|---|
| **Sektör** | Teknoloji + sağlık + enerji + kamu hizmeti |
| **Coğrafya** | ABD + Avrupa + gelişmekte olan piyasalar |
| **Varlık sınıfı** | Hisse + tahvil + nakit + altın |
| **Şirket ölçeği** | Büyük ölçek + küçük ölçek |

Bunlardan en güçlüsü üçüncüsüdür: hisse ile tahvilin birlikte hareket etme eğilimi, iki hissenin birbiriyle hareket etme eğiliminden çok daha düşüktür.

## Kaç Hisse Yeter

Akademik çalışmaların ortak sonucu: tek tek şirketlere özgü riskin büyük kısmı **20–30 hisseyle** ortadan kalkar. Ondan sonrası az fayda, çok takip yükü getirir.

::: dikkat Aşırı Çeşitlendirme de Bedava Değil
Elli hisse takip etmek, hiçbirini gerçekten tanımamak demektir. Bir portföyün elli iyi fikri yoktur. Çok fazla pozisyon, endeksi pahalı bir yoldan taklit etmekten başka bir şey üretmez — o durumda doğrudan bir endeks fonu almak daha ucuz ve daha dürüsttür. Bkz. [ETF Nedir?](/rehber/etf)
:::

## Korelasyon Krizde Artar

Çeşitlendirmenin en can sıkıcı özelliği: en çok ihtiyaç duyulduğu anda zayıflar. Panik günlerinde yatırımcılar neyi sevdiklerine değil neyi satabildiklerine bakarak satar. Normalde bağımsız hareket eden varlıklar aynı hafta birlikte düşer.

Bu, çeşitlendirmenin işe yaramadığı anlamına gelmez. Sadece "çeşitlendirdim, düşüşten korunurum" cümlesinin fazla iyimser olduğu anlamına gelir. Kısa vadeli paniklerde koruma zayıf, çok yıllı yanlış tercihlere karşı koruma güçlüdür.

## Yoğunlaşma Ne Zaman Mantıklı

Yoğunlaşmak her zaman hata değildir; bilinçli bir seçim olabilir. Ama üç koşulu vardır:

1. O şirketi gerçekten tanıyorsun.
2. Yanılma ihtimalini fiyatlandırdın ve pozisyon büyüklüğünü ona göre ayarladın.
3. **Kaldıraç kullanmıyorsun.**

Üçüncü madde pazarlık konusu değildir. Yoğunlaşma ile kaldıracın çarpımı, piyasada fon batıran klasik formüldür. Ayrıntı: [Kaldıraç Nedir?](/rehber/kaldirac)

::: ozet Özet
Çeşitlendirme sembol saymakla değil, birbirinden bağımsız fikirler saymakla ölçülür. "Kaç hissem var" değil, "kaç farklı şey ters giderse zarar ederim" diye sor.
:::`,
  },

  /* ---------------------------------------------------------------------- */
  "long-short": {
    title: "Long ve Short Ne Demek?",
    dek: "Yükselişten kazanmak ile düşüşten kazanmak — ve ikisinin hiç de simetrik olmaması.",
    bodyMd: `Piyasada iki temel yön vardır ve ikisi de para kazanabilir. Ama riskleri birbirinin aynası değildir; bu asimetri, short pozisyonun neden bu kadar tehlikeli olduğunu açıklar.

::: tanim Long ve Short
**Long (uzun):** Varlığı satın alıp sahibi olmak. Fiyat yükselirse kazanırsın.
**Short (kısa / açığa satış):** Sahip olmadığın varlığı ödünç alıp satmak, sonra geri alıp iade etmek. Fiyat düşerse aradaki farkı kazanırsın.
:::

## Short Mekaniği

1. Bir hissenin 100 adedini aracı kurumdan ödünç alırsın.
2. Piyasada 200 dolardan satarsın — hesabına 20.000 dolar geçer.
3. Fiyat 150 dolara düşer. 100 adedi 15.000 dolara geri alırsın.
4. Hisseleri iade edersin. Kârın 5.000 dolar (ödünç faizi düşülür).

Fiyat 250'ye çıkarsa aynı işlemi 25.000 dolara kapatırsın ve 5.000 dolar kaybedersin.

## Asıl Mesele: Asimetri

| | Long | Short |
|---|---|---|
| Azami kayıp | Yatırdığın para (%100) | **Sınırsız** |
| Azami kazanç | Sınırsız | Yatırdığın tutar kadar (%100) |
| Zaman | Genellikle lehine çalışır | Aleyhine çalışır (ödünç faizi, temettü) |
| Pozisyon zamanla | Yükselirse büyür, riski azalır | Yükselirse büyür, **riski artar** |

Son satır kritik. Long bir pozisyon aleyhine gittiğinde küçülür — portföydeki ağırlığı azalır, zararı sınırlanır. Short bir pozisyon aleyhine gittiğinde **büyür**: fiyat yükseldikçe pozisyonun nominal değeri artar, teminat ihtiyacı artar ve portföydeki ağırlığı kendiliğinden şişer.

::: dikkat Short Squeeze
Çok sayıda yatırımcı aynı hissede short'sa ve fiyat yükselmeye başlarsa, zararı kesmek için hepsi aynı anda geri alım yapmak zorunda kalır. Geri alım demek **satın almak** demektir; yani yükselişi besler; yükseliş daha fazla short'u kapanmaya zorlar. Kendi kendini büyüten bu döngüye *short squeeze* denir ve fiyatı birkaç günde katlayabilir.
:::

## Neden Yine de Short Yapılır

Short her zaman bahis değildir. Profesyonel portföylerde çoğunlukla bir **hedge** aracıdır:

- **Market-neutral (piyasa nötr):** Bir sektörde beğendiğin şirketi long, beğenmediğini short alırsan, sektörün genel yönünden bağımsız olarak "seçimimde haklı mıyım" bahsini oynamış olursun.
- **Portföy sigortası:** Uzun vadeli long portföyün varken endeksi short'lamak, düşüşte kaybı yumuşatır.
- **Pair trade (eşleştirilmiş işlem):** "Uzun çip, kısa yazılım" gibi. İki bacak da aynı tezin parçasıdır.

::: ornek Pair Trade'in İki Tarafı da Kanayabilir
"Uzun çip, kısa yazılım" pozisyonu, yapay zekânın yazılım marjlarını eritirken altyapı talebini patlatacağı fikrine dayanır. Tez doğruysa iki bacak birlikte kazandırır. Tez ters döndüğünde ise **iki bacak birlikte kaybettirir** — çipler düşerken yazılımlar yükselir. Bu yüzden pair trade'ler "daha az riskli" değildir; sadece farklı bir riski vardır.
:::

## Kısa Özet

Long yapmak varsayılan pozisyondur ve zaman genellikle lehine çalışır: şirketler büyür, ekonomi büyür, endeksler uzun vadede yükselir. Short yapmak zamana karşı bir bahistir; haklı olmak yetmez, **zamanında** haklı olman gerekir.

Bireysel bir yatırımcı için pratik sonuç şudur: short satış, kaybı teorik olarak sınırsız olan tek sıradan işlemdir. Denemeden önce [Kaldıraç](/rehber/kaldirac) yazısındaki teminat mekaniğini okumak faydalı olur — short pozisyon zaten doğası gereği bir kaldıraç biçimidir.`,
  },

  /* ---------------------------------------------------------------------- */
  "kisa-sikisma": {
    title: "Kısa Sıkışma (Short Squeeze) Nedir?",
    dek: "Bir hissenin, kimse almak istemediği için değil — satanlar geri almak zorunda kaldığı için fırlaması.",
    bodyMd: `Bir hisse bazen hiçbir haber olmadan iki günde ikiye katlanır. Şirkette yeni bir şey yoktur, kazancı değişmemiştir, sektörü aynıdır. Fiyatı yukarı iten şey alıcıların iştahı değildir; **satanların mecburiyetidir.**

::: tanim Kısa Sıkışma
Açığa satış pozisyonu yoğun bir hissede fiyatın yükselmesiyle başlayan zincir. Zarar eden short'lar pozisyonu kapatmak için hisseyi geri ALMAK zorundadır; bu alım fiyatı daha da yukarı iter, bu da daha fazla short'u kapanmaya zorlar. Yükseliş kendi yakıtını üretir.
:::

## Mekanizma

[Long/short yazısındaki](/rehber/long-short) mekaniği hatırla: açığa satan kişi hisseyi ödünç alır, satar ve **geri vermek zorundadır**. Geri vermenin tek yolu piyasadan satın almaktır.

Bu, açığa satışı diğer her pozisyondan ayıran şeydir: long pozisyondaki biri hiçbir zaman satmak zorunda değildir, bekleyebilir. Short'taki kişi bekleyemez — üç ayrı zorlayıcı vardır:

1. **Marj çağrısı.** Zarar teminatı yerse aracı kurum pozisyonu zorla kapatır.
2. **Ödünç geri çağrısı.** Hisseyi ödünç veren onu geri isteyebilir; short buna karşı çıkamaz.
3. **Ödünç maliyeti.** Sıkışan bir hissede yıllık ödünç faizi %100'ü aşabilir. Beklemek tek başına para yakar.

## Sıkışmayı Mümkün Kılan Koşullar

Her düşen hisse sıkışmaz. Üçü bir arada olduğunda ihtimal büyür:

| Koşul | Neye bakılır | Neden önemli |
|---|---|---|
| **Yoğun açık pozisyon** | Halka açık payın %20'sini aşan short oranı | Kapatmak zorunda kalacak çok kişi var |
| **Dar dolaşım** | Serbest dolaşımdaki hisse sayısının azlığı | Aynı alım daha çok fiyat oynatır |
| **Kapanma süresi** | Günlük hacme bölünmüş short miktarı | Herkes aynı anda çıkamaz |

Üçüncüsüne *days to cover* denir ve en açıklayıcı olanıdır: short miktarı günlük hacmin sekiz katıysa, short'ların tamamının çıkması sekiz günlük hacim demektir. Kapı dardır.

::: ornek Kapının Darlığı
Bir hissenin serbest dolaşımı 50 milyon adet, günlük ortalama hacmi 2 milyon adet. Açık short pozisyon 15 milyon adet — dolaşımın %30'u, günlük hacmin 7,5 katı.
Fiyat %20 yükselirse short'ların bir kısmı teminat sınırına dayanır ve kapatmaya başlar. Ama çıkış kapısı günde 2 milyon adetlik: 15 milyonun tamamı ancak günlerce sürecek bir alım baskısıyla kapanabilir.
O alım baskısı fiyatı yukarı taşır, yukarı fiyat yeni short'ları sınıra dayar. Döngü kendi kendini besler.
:::

## Sıkışma Bir Değerleme Değildir

Sıkışmanın en yanıltıcı yanı budur: fiyat yükselirken hikâye de yükselir. "Demek ki şirket iyiymiş" cümlesi sıkışmanın ortasında çok inandırıcı gelir. Oysa hareketin sebebi şirket değil, **pozisyonlanmadır**.

Bunun pratik sonucu şudur: sıkışma bittiğinde fiyatı yukarıda tutacak bir şey kalmaz. Zorunlu alıcılar kapanmıştır, yeni alıcı yoktur ve fiyat çoğu zaman başladığı yere yakın bir seviyeye döner. Yükseliş hızlıdır, iniş de öyle.

::: dikkat "Sıkışmaya Binmek"
Sıkışmayı önceden fark edip long tarafında kâr etmek teorik olarak mümkündür, pratikte iki sebeple çok zordur:
**Zamanlama.** Yoğun short'lu bir hisse aylarca hiçbir şey yapmadan durabilir; sıkışma haftalar sonra ya da hiç gelmeyebilir.
**Volatilite.** Sıkışan hissede gün içi %30'luk salınımlar normaldir. [Stop emri](/rehber/emir-tipleri) koyduysan sıkışma başlamadan süpürülürsün; koymadıysan pozisyon büyüklüğün seni yönetmeye başlar.
Bu, "haklı çıkıp para kaybetme" ihtimalinin en yüksek olduğu kurgulardan biridir.
:::

## Gamma Sıkışması

Bazen zorunlu alıcı short'lar değil, **opsiyon satan aracı kurumlardır.** Bir hissede yoğun call alımı olursa, o call'ları satan taraf riskini dengelemek için hisseden almak zorunda kalır. Fiyat yükseldikçe daha çok almaları gerekir — [opsiyon yazısındaki](/rehber/opsiyonlar) mantığın türev tarafı.

İki sıkışma tipi çoğu zaman birlikte görülür ve birbirini besler. Ayırt etmek zordur; ikisinin de ortak sonucu aynıdır: mekanik, geçici ve şiddetli bir yükseliş.

::: ozet Özet
Kısa sıkışma bir şirket hikâyesi değil, bir pozisyon hikâyesidir. Fiyatı yukarı taşıyan şey birinin o hisseyi istemesi değil, birinin geri almak ZORUNDA olmasıdır. Zorunluluk bitince yakıt biter. Bu yüzden sıkışma sırasında sorulacak doğru soru "bu şirket ne kadar eder" değil, **"geriye kaç zorunlu alıcı kaldı"**dır — ve bunun cevabını dışarıdan kimse tam olarak bilemez.
:::

## Bu Sitede Nerede Görürsün

[Piyasalar](/piyasalar) ekranındaki günün en çok artanları listesinde, endeksin geri kalanı yatayken tek başına %15-20 fırlamış bir isim görürsen, ilk ihtimal bir haber değil pozisyonlanmadır. [Hisse sayfasındaki](/sirketler) hacim satırı da ipucu verir: sıkışmalarda hacim ortalamanın birkaç katına çıkar — çünkü zorunlu alım gerçek bir alımdır.`,
  },

  /* ---------------------------------------------------------------------- */
  "kaldirac": {
    title: "Kaldıraç Nedir ve Neden Uzak Durmalısın?",
    dek: "Ödünç parayla pozisyon taşımak. Getiriyi de kaybı da çarpar — ama asıl aldığı şey, ne zaman satacağına karar verme hakkındır.",
    bodyMd: `Bu yazının bir tavsiyesi var ve baştan söylemek daha dürüst: **kaldıraç kullanma.**

Sitedeki diğer yazılar bir kavramı tarafsız anlatır. Bu yazı da mekaniği tarafsız anlatacak, ama sonunda bir şey söyleyecek. Sebebi, kaldıracın yalnızca riski artıran bir araç olmaması: kararı senin elinden alan bir araç olması.

::: dikkat Baştan Söylenecekler
Kaldıraç, bireysel bir yatırımcının portföyünde bulunmasını **önermediğimiz** tek araçtır. Kazanma ihtimalini artırmaz; yalnızca aynı bahsi daha büyük oynatır ve o bahsi kaybetme hızını artırır. Piyasayı yeni öğreniyorsan cevap tartışmasız: kullanma.
:::

## Mekanik

10.000 dolarlık sermayen var. Aracı kurumdan 30.000 dolar ödünç alıp 40.000 dolarlık hisse taşıyorsun. Kaldıracın 4x.

- Hisse %10 yükselirse 4.000 dolar kazanırsın — sermayenin %40'ı.
- Hisse %10 düşerse 4.000 dolar kaybedersin — yine sermayenin %40'ı.

::: tanim Kaldıraç
Kendi sermayenden büyük bir pozisyonu ödünç parayla taşımak. Ödünç veren taraf teminat ister ve teminatın piyasa değeri belirli bir oranın altına düşerse **hemen** tamamlanmasını talep eder.
:::

Buraya kadarı herkesin bildiği kısım ve simetrik görünüyor. Asıl mesele bundan sonrası.

## Asıl Aldığı Şey: Takvim

Kaldıraçsız bir pozisyonda ne zaman satacağına sen karar verirsin. Fiyat yarıya inse bile beklemeyi seçebilirsin, çünkü kimseye borçlu değilsin. Sıkıntı verir ama kararı senden almaz.

Kaldıraçlı bir pozisyonda bu karar senin değildir. Teminat oranı belirli bir eşiğin altına indiğinde aracı kurum **margin call** (teminat tamamlama çağrısı) gönderir. Para koyamazsan pozisyon kapatılır — hem de tam olarak fiyatın en kötü olduğu anda, çünkü çağrı zaten o yüzden geldi.

> Doğru olduğun hâlde iflas edebilirsin. Haklı çıkman için gereken süre, pozisyonu taşıyabileceğin süreden uzun olabilir.

Bu cümle kaldıracın tek cümlelik özetidir ve yazının geri kalanı bunun açılımıdır.

## Kaç Kat, Ne Kadar Düşüşe Dayanır

| Kaldıraç | Sermayeyi silen düşüş | Pratikte margin call |
|---|---|---|
| 1x (kaldıraçsız) | %100 | Yok |
| 2x | %50 | ~%25 düşüşte |
| 4x | %25 | ~%12 düşüşte |
| 10x | %10 | ~%5 düşüşte |

Sağdaki sütun daha önemli: pozisyon silinmeden çok önce çağrı gelir. 4x kaldıraçta piyasanın %12 düşmesi — ki bu sıradan bir düzeltmedir — seni oyundan çıkarmaya yeter.

Karşılaştırma için: S&P 500'de %10'luk düzeltmeler ortalama olarak yılda bir görülür. Yani 4x kaldıraç, "yılda bir yaşanan sıradan bir olay beni siler" demektir.

## Neden Kaldıraç Kullanmamalısın

### 1. Kaybın simetrik değil

%50 düşen bir pozisyonun başa dönmesi için %100 yükselmesi gerekir. Kaldıraç bu asimetriyi büyütür: kaldıraçla kaybedilen sermaye, kaldıraçsız bir portföyün toparlanabileceği bir kayıp değildir. Bkz. [Risk Yönetimi](/rehber/risk-yonetimi)

### 2. Zamanlama hakkını satmış olursun

Piyasada uzun vadede kazanan tarafın en büyük avantajı beklemeyi seçebilmesidir. Kaldıraç tam olarak bu avantajı satar. Karşılığında aldığın şey daha fazla getiri değil, aynı getirinin daha büyük katsayısıdır.

### 3. Faiz sessizce yer

Ödünç para bedavaya gelmez. Yıllık faiz, pozisyon yatay dursa bile her gün küçük bir miktar eritir. Uzun vadeli düşünen biri için bu, arka planda çalışan bir sızıntıdır.

### 4. Karar verme kaliteni düşürür

Kaldıraçlı bir pozisyonda gün içi dalgalanmalar sermayenin yüzdesi olarak korkutucu büyüklüklere ulaşır. İnsanlar bu baskı altında iyi karar veremez. En kötü satışlar, en kötü alımlar ve en pahalı panikler burada olur.

### 5. Portföyünün geri kalanını da tehdit eder

Margin call geldiğinde aracı kurum yalnızca sorunlu pozisyonu değil, elindeki başka varlıkları da satabilir. Kaldıraçlı tek bir fikir, sağlıklı pozisyonlarını da yanında götürebilir.

::: ornek Yoğunlaşmayla Çarpınca
Kaldıracın en tehlikeli hâli tek başına değil, **yoğunlaşmayla** birlikte ortaya çıkar. Portföyün ilk beş pozisyonu toplamın dörtte üçüyse ve beşi de aynı temanın farklı ifadesiyse, çeşitlendirme sandığından çok azdır. Tema satıldığında beş pozisyon aynı anda ve aynı yönde düşer.
2026 Temmuz'unda bir yapay zekâ fonunun dört günde kapanması tam olarak bu iki şeyin çarpımıydı: yoğunlaşmış bir portföy, dört kat kaldıraçla taşınıyordu. Fonu yöneten kişinin tezinin yanlış olduğu kanıtlanmadı — sadece zamanı bitti. [Yazının tamamı](/mercek/leopold-aschenbrenner-96-saat)
:::

## Görünmeyen Kaldıraç

Herkes kaldıracın "marj hesabı" olduğunu sanır. Değil. Kaldıraç birçok biçimde gelir ve bazıları hesap ekranında kaldıraç diye görünmez:

- **Opsiyonlar:** Prim ödeyerek çok daha büyük bir nominal tutara maruz kalırsın.
- **Vadeli işlemler:** Teminat, sözleşme büyüklüğünün küçük bir yüzdesidir.
- **Kaldıraçlı ETF'ler:** Ürünün içinde taşınır, senin hesabında görünmez.
- **Açığa satış:** Ödünç alınmış hisse taşımak da bir kaldıraç biçimidir.
- **Şirketin kendi borcu:** Borçlu bir şirketin hissesi, borçsuz bir şirketin hissesinden doğası gereği daha kaldıraçlıdır.

Son madde çoğu kişinin gözünden kaçar: hiç marj kullanmadan da yüksek kaldıraçlı bir portföy taşıyor olabilirsin.

## Buna Rağmen Kullanacaksan

Bunu önermiyoruz. Yine de karar seninse, en azından şu üç soruya rahatça cevap verebiliyor ol:

1. Bu pozisyon %30 düşerse hâlâ taşıyabilir miyim?
2. Taşıyamazsam, satış kararını ben mi vereceğim, teminat oranı mı?
3. Portföyümdeki diğer pozisyonlar aynı anda düşer mi?

Üçüne de net cevap veremiyorsan kaldıraç fazladır. Verebiliyorsan bile hatırla: bu üç soruya doğru cevap verip yine de kaybeden çok sayıda profesyonel var.

::: ozet Alınacak Ders
Kaldıraç, bir yatırımın sahibi ile takvimin sahibini birbirinden ayırır. Getirini büyütmez, yalnızca çarpar; buna karşılık kaybetme hızını ve kararı elinden alma ihtimalini artırır. Uzun vadede piyasada kalmak, herhangi bir yılda daha çok kazanmaktan daha değerlidir — kaldıraç tam olarak bu ikisini takas eder.
:::`,
  },

  /* ---------------------------------------------------------------------- */
  "opsiyonlar": {
    title: "Opsiyonlar: Call, Put ve Primin Anatomisi",
    dek: "Hisse almadan yön oynamanın aracı — ve primin içinde işleyen saatin neden hep alıcının aleyhine olduğu.",
    bodyMd: `Opsiyon, hisse senedinden farklı bir şey satın alır: hissenin kendisini değil, onu belirli bir fiyattan alma ya da satma **hakkını**. Bu tek cümlelik fark, bambaşka bir risk matematiği doğurur — ve bu yazının amacı o matematiği göstermek, kullanmayı önermek değil.

::: tanim Opsiyon
Belirli bir vadeye kadar, belirli bir fiyattan (**strike**, kullanım fiyatı) bir hisseyi alma ya da satma hakkı. **Call** alma hakkıdır, **put** satma hakkı. Hak kullanılmak zorunda değildir; işlemezse ödenen prim yanar. ABD'de bir opsiyon sözleşmesi 100 hisseyi temsil eder.
:::

## Dört Koltuk

Her opsiyon işleminde iki taraf vardır ve dört farklı pozisyon çıkar:

| | Call | Put |
|---|---|---|
| **Alıcı** | Yükselişe oynar, kaybı primle sınırlı | Düşüşe oynar, kaybı primle sınırlı |
| **Satıcı** | Primi alır, yükselişte kaybı **sınırsız** | Primi alır, düşüşte kaybı çok büyük |

Tablonun anlattığı asimetri şudur: alıcının kaybı sınırlı ama olasıdır; satıcının kazancı sınırlı ama olasıdır. İki taraf farklı şeyler takas eder — alıcı küçük ve kesin bir maliyeti, büyük ama düşük ihtimalli bir kazanç için öder.

## Primin İki Parçası

Opsiyonun fiyatına **prim** denir ve iki parçadan oluşur:

**İçsel değer** — hak bugün kullanılsa ne ederdi. Hisse 110 dolarken 100 dolarlık call'un içsel değeri 10 dolardır.

**Zaman değeri** — geri kalan her şey. Vadeye kadar hissenin lehine hareket etme *ihtimalinin* fiyatıdır.

::: ornek Primi Parçalara Ayırmak
Hisse 110 dolar. Bir ay vadeli, 100 dolar kullanım fiyatlı call 13 dolardan işlem görüyor.
İçsel değer: 110 − 100 = **10 dolar**.
Zaman değeri: 13 − 10 = **3 dolar**.
Hisse bir ay boyunca 110'da çakılı kalırsa opsiyon vadede 10 dolar eder: içsel değer durur, zaman değeri **sıfıra erir**. Hisse hiç düşmeden %23 kaybettin.
:::

## Zaman Erimesi (Time Decay)

Zaman değeri her gün azalır ve azalış vadeye yaklaştıkça hızlanır. Buna *theta* denir. Pratikteki anlamı şudur: opsiyon alıcısı yalnızca yöne değil, **takvime karşı** da oynar. Haklı çıkmak yetmez; vadeden önce, zaman değerinin eridiğinden daha hızlı haklı çıkmak gerekir.

Vadesi aynı gün dolan opsiyonlar (*0DTE*) bu erimenin en uç hâlidir: birkaç saat içinde ya katlanır ya sıfırlanır. Son yıllarda hacmin büyük kısmı bu sözleşmelere kaydı — piyango biletine en çok benzeyen finansal ürün budur.

## Volatilite Primi

Zaman değerinin büyüklüğünü belirleyen ana girdi, piyasanın o hisseden beklediği oynaklıktır — **implied volatility** (piyasanın beklediği oynaklık). Piyasa büyük hareket bekliyorsa prim şişer, sakinlik bekliyorsa söner. Ayrıntı: [Volatilite Nedir?](/rehber/volatilite)

::: dikkat Bilanço Gecesi Tuzağı
Bilançodan önce opsiyon primleri şişer, çünkü herkes büyük hareket bekler. Açıklama gelince belirsizlik biter ve şişkinlik söner — hisse beklediğin yönde hareket etse bile opsiyonun değer kaybedebilir. Buna *volatility crush* denir: yönü doğru tahmin edip para kaybetmenin en klasik yolu.
:::

## Bu Bir Kaldıraçtır

Opsiyonun cazibesi küçük parayla büyük pozisyona erişimdir: 3 dolarlık prim, 100 dolarlık hissenin hareketine maruz bırakır. Bu, tanımı gereği kaldıraçtır — hesap ekranında "kaldıraç" diye görünmese bile. [Kaldıraç yazısındaki](/rehber/kaldirac) her uyarı burada da geçerlidir, bir farkla: marj hesabında kayıp margin call ile gelir, opsiyonda primin **tamamının** yanmasıyla. Alıcı için %100 kayıp uç senaryo değil, sık görülen sonuçtur.

## Satıcı Tarafı

Prim toplamak düzenli gelir gibi görünür: çoğu ay opsiyonlar değersiz biter ve satıcı kazanır. Sorun dağılımdadır — kazançlar küçük ve sık, kayıplar nadir ve çok büyüktür. Teminatsız call satan biri, [short pozisyondaki](/rehber/long-short) sınırsız kayıp riskinin aynısını taşır. "Yıllardır her ay kazanıyordu" cümlesi, bu stratejilerde çoğu zaman "henüz o ay gelmedi" demektir.

::: ozet Özet
Opsiyon primi üç şey satın alır: yön, zaman ve oynaklık. Hisse alan yalnızca yönde haklı çıkmak zorundadır; opsiyon alan üçünde birden haklı çıkmak zorundadır. Bu yüzden opsiyon, "az parayla hisse" değil, farklı ve daha zor bir bahistir — öğrenme sırasında portföyün değil, merakın konusu olmalıdır.
:::

## Bu Sitede Nerede Görürsün

Bu sitede opsiyon zinciri yok ve buradan opsiyon alınmaz. Ama opsiyon piyasasının bir çıktısı her gün ekranda durur: **korku endeksi VIX**, S&P 500 opsiyonlarının fiyatından türetilir ve piyasanın önümüzdeki 30 gün için beklediği oynaklığı söyler. [Piyasalar](/piyasalar) ekranındaki karta ve bandına oradan bakabilirsin.`,
  },

  /* ---------------------------------------------------------------------- */
  "hedge": {
    title: "Hedge: Riski Kapatmanın Maliyeti",
    dek: "Pozisyonu satmadan riski azaltmak — ve her korumanın bir fatura kestiği.",
    bodyMd: `Hedge tahmin etmek değildir. Tahmin edemediğini kabul etmektir.

Bir pozisyonun düşeceğini biliyorsan yapılacak şey bellidir: satarsın. Hedge, "düşerse ne olacağını bilmiyorum ama o ihtimalin bana açacağı zararı şimdiden sınırlamak istiyorum" diyen kişinin işidir. Sigortaya benzemesi tesadüf değil — mantığı birebir aynıdır, faturası da.

::: tanim Hedge (Korunma)
Mevcut bir pozisyonun zararını dengeleyecek İKİNCİ bir pozisyon açmak. Amaç kazanç değil, kaybın büyüklüğünü baştan sınırlamaktır. İyi çalışan bir hedge, portföyün kazandığı senaryoda para kaybeder — kaybetmiyorsa muhtemelen hedge değil, ikinci bir bahistir.
:::

## Neden Satmak Yerine?

Satmak her zaman en basit korunmadır ve çoğu zaman doğru cevaptır. Hedge'in tercih edildiği durumlar dardır:

- **Pozisyondan çıkmak istemiyorsun.** Uzun vadeli tezine inanıyorsun ama önümüzdeki üç haftada bir bilanço, bir seçim ya da bir Fed toplantısı var.
- **Satış vergi doğuruyor.** Büyük bir kâr üzerinde oturuyorsan satmak vergi olayını bugüne çeker.
- **Geri girmek zor.** Düşük hacimli bir hissede çıkıp girmek [spread](/rehber/spread-likidite) maliyetini iki kez ödemek demektir.
- **Riskin tamamı değil bir parçası rahatsız ediyor.** Şirketi seviyorsun ama sektörün tamamının aşırı ısındığını düşünüyorsun.

Bu dördü de yoksa cevap büyük ihtimalle hedge değil, **pozisyonu küçültmek**tir. Küçültmenin maliyeti sıfırdır; hedge'in maliyeti hiçbir zaman sıfır değildir.

## Dört Yöntem

| Yöntem | Neyi korur | Maliyeti | Yukarı yönü |
|---|---|---|---|
| **Koruyucu put** | Belirli bir fiyatın altını tamamen | Peşin prim | Bozulmaz |
| **Covered call** | Küçük düşüşleri kısmen | Prim geliri, maliyet negatif | **Tavanlanır** |
| **Endeks short / ters ETF** | Piyasa geneli riskini | Finansman + takip sapması | Endeks kadar kısılır |
| **Pozisyon küçültme** | Her şeyi, orantılı | Yok | Orantılı azalır |

Dört satırın anlattığı şey şudur: bedava koruma yoktur. Ya peşin ödersin (put), ya yukarı yönden ödersin (covered call), ya taşıma maliyetiyle ödersin (short), ya da maruziyetten ödersin (küçültme).

## Koruyucu Put: Sigortanın Fiyatı

En saf hedge budur. Hisseyi tutarsın, altına bir taban koyan put alırsın. [Opsiyon yazısındaki](/rehber/opsiyonlar) prim mantığı burada aynen işler.

::: ornek Üç Aylık Sigorta
100 hisse, hisse başı 200 dolar. Portföydeki değer: **20.000 dolar**.
Üç ay vadeli, 180 dolar kullanım fiyatlı put: hisse başı 9 dolar → **900 dolar prim**.

Hisse 140'a düşerse: pozisyon 6.000 dolar kaybeder, put ~4.000 dolar kazanır. Net kayıp 2.900 dolar (put primi dahil) — korumasız hâlde 6.000 dolardı.
Hisse 200'de kalırsa: put sıfırlanır, 900 dolar gider. Hisse hiç hareket etmeden **%4,5** kaybettin.
Hisse 240'a çıkarsa: 4.000 dolar kazanırsın, 900 doları sigortaya verirsin. Net 3.100 dolar.
:::

Örnekteki üç satır hedge'in tamamını anlatır: **kötü senaryoda kazandığın, iyi ve nötr senaryoda ödediğindir.** Sigortayı her yıl yenilersen ve büyük düşüş hiç gelmezse, yıllık %4-5'lik bir sürtünme portföyün getirisinin önemli bir kısmını yer.

## Covered Call: Yarım Koruma

Elindeki hisse üzerine call satarsın, primi cebe koyarsın. O prim küçük düşüşleri karşılar. Karşılığında yukarıyı satmış olursun: hisse strike'ın üstüne çıkarsa kazancın orada durur.

Bu bir hedge'den çok **yön takasıdır**: büyük yukarı senaryodan vazgeçip küçük ve kesin bir gelir alırsın. Sert bir düşüşe karşı koruması neredeyse yoktur — %40 düşen bir hissede topladığın 3 dolarlık prim teselli olmaz.

## Endeksle Hedge ve Oran Sorunu

Tek tek hisseleri değil, portföyün tamamının piyasa riskini kapatmak istiyorsan endeks tarafından hedge yaparsın: endeks ETF'sinde [short](/rehber/long-short) ya da endeks üzerine put.

Burada bir oran sorunu doğar. Portföyün 100.000 dolarsa 100.000 dolarlık endeks short'u doğru cevap değildir — portföyün endeksten daha oynak ya da daha sakin olabilir. Bu duyarlılığa **beta** denir: betası 1,3 olan bir portföy, endeks %10 düşerken ortalama %13 düşer, yani hedge'in 130.000 dolar büyüklüğünde olması gerekir.

::: dikkat Baz Riski
Hedge ettiğin şey ile hedge aracın aynı şey değildir. Yarı iletken ağırlıklı bir portföyü S&P 500 ile hedge edersen, S&P yatay kalırken yarı iletkenler %15 düşebilir: portföy kaybeder, hedge hiçbir şey kazanmaz. Buna **baz riski** denir ve hedge'in en sık gözden kaçan kusurudur. Hedge aracı korunan şeye ne kadar benzemezse, koruma o kadar teoriktir.
:::

## Ters ETF'lerin Sessiz Sorunu

"Endeks düşerse kazanan" ETF'ler (ters/inverse, özellikle 2x ve 3x kaldıraçlı olanlar) hedge için pratik görünür. Sorun şudur: bu ürünler **günlük** getiriyi hedefler ve her gün yeniden dengelenir. Oynak ama yatay seyreden bir piyasada, endeks aynı yere dönse bile ters ETF değer kaybeder.

Sonuç: birkaç günlük bir olay için makul, aylarca taşınacak bir koruma için kötü bir araçtır. Uzun vadeli korumada takvim, ürünün aleyhine işler.

## Hedge'in Üç Sabit Maliyeti

1. **Prim ya da taşıma.** Put primi, short'un finansmanı, ETF'nin gider oranı. Kötü senaryo gelmezse bu para tamamen gider.
2. **Vazgeçilen yukarı yön.** Covered call'da açık, put'ta prim kadar, short'ta birebir.
3. **Dikkat.** Hedge bir pozisyondur; vadesi, oranı ve yenilenmesi takip ister. Unutulmuş bir hedge, korumadığı gibi tek başına zarar eden bir bahse dönüşür.

::: dikkat Aşırı Hedge
İkiden fazla korumayı üst üste bindiren portföy artık hedge'li değil, **yönsüzdür**. Her kalemi hedge edilmiş bir portföyün beklenen getirisi, maliyetler düşüldükten sonra nakitten düşüktür. O noktada yapılacak şey daha fazla hedge değil, pozisyonları küçültüp nakde geçmektir — aynı sonucu bedavaya verir.
:::

## Şirketler de Hedge Yapar

Bu, ekranda en sık karşına çıkacak hedge türüdür. Gelirinin yarısını avrodan alan bir Amerikan şirketi, döviz kurunun aleyhine dönmesine karşı vadeli işlem yapar. Havayolu yakıtı, gıda şirketi buğdayı, madenci de üretimini hedge eder.

Bunun bilanço okuma açısından iki sonucu vardır:

- Hedge, kötü çeyreği yumuşatır ama **iyi çeyreği de yumuşatır.** Kur lehine döndüğünde şirket o kazancın tamamını alamaz.
- Hedge'in kendisi kâr-zarar tablosunda satır açar. "Kur farkı geliri" ya da "türev araç zararı" gibi kalemler operasyonel performansla karışabilir. [Bilanço yazısındaki](/rehber/bilanco) düzeltilmiş/GAAP ayrımının bir sebebi de budur.

::: ozet Özet
Hedge, kaybı sınırlamak için beklenen getiriden vazgeçmektir. Doğru sorulacak soru "nasıl hedge yaparım" değil, **"bu riski taşıyamıyorsam neden bu büyüklükte taşıyorum"**dur. Cevap çoğu zaman pozisyonu küçültmektir — bedava, basit ve takip gerektirmez. Hedge yalnızca pozisyondan çıkmanın gerçek bir maliyeti olduğunda ve korunacak olay TARİHLİ olduğunda (bilanço, toplantı, seçim) mantıklıdır.
:::

## Bu Sitede Nerede Görürsün

Bu sitede opsiyon ya da türev işlemi yapılmaz. Ama hedge'in izleri birkaç yerde okunur:

- [Piyasalar](/piyasalar) ekranındaki **korku endeksi VIX**, korunma talebinin fiyatıdır: yükselmesi, piyasanın sigortaya daha çok ödemeye razı olduğu anlamına gelir.
- [Bilanço analizlerinde](/bilancolar/analizler) kur ve emtia etkisinden söz edilen satırlar, şirketin kendi hedge kararlarının sonucudur.
- [Takvim](/takvim) ekranındaki tarihli olaylar, kurumsal yatırımcının hedge takvimini kuran şeydir — koruma bu tarihlerin etrafında alınır ve çözülür.`,
  },

  /* ---------------------------------------------------------------------- */
  "yatirimci-psikolojisi": {
    title: "Yatırımcı Psikolojisi: En Pahalı Hatalar",
    dek: "Portföyünün en zayıf halkası genellikle bir hisse değil, bir alışkanlıktır.",
    bodyMd: `Piyasada uzun süre kalanların ortak gözlemi şudur: kayıpların çoğu bilgi eksikliğinden değil, davranıştan gelir. Bir yatırımcının aynı stratejiyi disiplinle uygulaması, daha iyi bir strateji bulmasından daha çok fark yaratır.

Aşağıdakiler kanıtlanmış davranış kalıplarıdır ve hepsinin ortak özelliği şudur: yaşarken mantıklı hissettirirler.

## Kayıptan Kaçınma

::: tanim Kayıptan Kaçınma (Loss Aversion)
Aynı büyüklükteki bir kaybın verdiği acı, kazancın verdiği hazdan yaklaşık iki kat güçlüdür. Sonuç: kaybı kabullenmek yerine ertelersin.
:::

Pratikte şöyle görünür: kazançtaki pozisyonu "kâr realize edeyim" diye erken satar, zarardaki pozisyonu "geri döner" diye tutarsın. Portföyünde iyi olanı atıp kötü olanı biriktirmiş olursun.

Panzehiri kural koymaktır: pozisyonu açarken nerede yanılmış sayılacağına karar ver. Karar, zarar henüz duygusal bir şey değilken verilir.

## Sürü ve FOMO

Bir hisse hakkında herkesin konuşmaya başladığı an, o hissenin en çok haber taşıdığı andır — en çok gelecek getirisini taşıdığı an değil. Kalabalığın en yoğun olduğu yer, çoğu zaman fiyatın en çok fikri içine sindirdiği yerdir.

::: dikkat Bir Fiyat Yükseldiği İçin Alma
"Kaçırıyorum" hissi, alım gerekçesi değildir. İyi bir gerekçe şirketle ilgilidir: ne kazanıyor, ne büyütüyor, ne kadar fiyatlanmış. Grafiğin dik olması bu soruların hiçbirine cevap vermez.
:::

## Çıpalama (Anchoring)

Aldığın fiyat, zihninde bir referans noktası olur. Oysa piyasa senin maliyetini bilmez ve umursamaz.

"Maliyetime gelince satacağım" cümlesi, kararı şirketin bugünkü değerine değil, geçmişteki bir tesadüfe bağlar. Doğru soru şudur: *bu hisseyi bugün, bu fiyattan, sıfırdan alır mıydım?* Cevap hayırsa elde tutmanın gerekçesi maliyet olamaz.

## Doğrulama Önyargısı (Confirmation Bias)

Bir fikre karar verdikten sonra beynin, o fikri destekleyen bilgiyi arar ve çelişeni önemsizleştirir. Portföyündeki en büyük pozisyon hakkında en az eleştirel olduğun an, tam da en eleştirel olman gereken andır.

Basit bir karşı ilaç: pozisyon açarken *hangi gelişme beni yanlış çıkarır* sorusunun cevabını yaz. Sonradan yazılan gerekçeler her zaman kendini haklı çıkarır.

## Aşırı Güven

İki üç isabetli karardan sonra "bu işi çözdüm" hissi gelir. Piyasada bu hissin bedeli genellikle pozisyon büyüklüğünün artmasıyla ödenir — ve büyüyen pozisyonla ilk yanlış kararın çarpımı, önceki isabetlerin toplamını siler.

::: ornek İşlem Sıklığı ve Getiri
Davranışsal finans literatüründeki en tekrarlanan bulgulardan biri şudur: bireysel yatırımcılar arasında **daha sık işlem yapanlar, daha az işlem yapanlardan sistematik olarak daha düşük net getiri** elde eder. Sebep karmaşık değil — her işlemin spread ve komisyon maliyeti vardır ve sık işlem, o maliyeti çoğaltırken karar kalitesini artırmaz.
:::

## Yakın Geçmiş Yanılgısı (Recency Bias)

Son üç ayda ne olduysa önümüzdeki üç ayda da olacakmış gibi hissedilir. Bu yüzden insanlar zirvede en iyimser, dipte en karamsardır — yani tam olarak tersini yapmaları gereken anlarda.

## Ne İşe Yarar

| Sorun | Karşı önlem |
|---|---|
| Duygusal satış | Pozisyon açarken stop ve hedef belirle |
| FOMO | Alım gerekçesini bir cümleyle yaz; grafik gerekçe değildir |
| Çıpalama | "Bugün sıfırdan alır mıydım?" sorusunu sor |
| Aşırı güven | Pozisyon büyüklüğünü kurala bağla, hisse bazlı üst sınır koy |
| Sık işlem | İşlem sayısını değil, fikirlerin kalitesini ölç |

::: ozet Özet
Piyasa hakkında bilmen gerekenlerin çoğu birkaç ayda öğrenilir. Kendin hakkında bilmen gerekenler yıllar alır ve pahalıya öğrenilir. Yazılı kurallar, ikinci öğrenmenin faturasını küçültmenin bilinen tek yoludur.
:::`,
  },

  "13f-nedir": {
    title: "13F Nedir: Ünlü Yatırımcıların Portföyü Nasıl Okunur",
    dek: "Buffett'ın ne aldığını gösteren belge gerçek, ama üç ay gecikmeli ve resmin yalnızca bir parçası.",
    bodyMd: `ABD'de 100 milyon doları aşan hisse portföyünü yöneten her kurum, her çeyreğin sonunda elindeki hisseleri SEC'e (ABD Sermaye Piyasası Kurulu) bildirmek zorunda. Bu bildirimin adı 13F. Berkshire Hathaway'in, Pershing Square'in ya da Bridgewater'ın "ne aldığı" haberlerinin kaynağı hep bu belgedir.

::: tanim 13F
Büyük kurumsal yöneticilerin çeyrek sonundaki ABD hisse pozisyonlarını, adet ve dolar değeriyle listeleyen zorunlu SEC bildirimi. Çeyrek bitiminden sonraki 45 gün içinde verilir.
:::

## Ne Gösterir

Bir 13F satırı üç şey söyler: hangi şirket, kaç hisse, çeyrek sonundaki fiyattan değeri ne. Aynı yöneticinin iki ardışık bildirimi yan yana konunca alım ve satım ortaya çıkar:

- **Yeni:** önceki çeyrekte olmayan pozisyon.
- **Artırdı / Azalttı:** hisse adedi değişen pozisyon.
- **Tamamen Sattı:** önceki çeyrekte olup bu çeyrekte olmayan pozisyon.

Karşılaştırma dolar değeriyle değil ADETLE yapılır. Fiyatı yüzde 30 yükselen bir hissenin değeri de yüzde 30 artar; yönetici tek hisse almamış olabilir.

## Neyi Göstermez

::: dikkat Dört Kör Nokta
**Gecikme:** Bildirim çeyrek bitiminden 45 gün sonraya kadar verilebilir. 30 Haziran'daki portföyü Ağustos ortasında görürsün; yönetici o arada her şeyi satmış olabilir.
**Açığa satış:** Kısa pozisyonlar bildirilmez. Bir fon bir hisseyi alıp başka bir hisseyi açığa satarak korunuyorsa sen yalnızca alım tarafını görürsün.
**Nakit ve tahvil:** Portföyün ne kadarının nakitte beklediği görünmez.
**Yurt dışı hisseler:** Yalnızca ABD'de işlem gören menkul kıymetler listelenir.
:::

## Opsiyon Satırları Yanıltabilir

13F'te alım (call) ve satım (put) opsiyonları da yer alır. Ama satırdaki değer, opsiyonun ödenen primi değil DAYANAK hissenin değeridir. "10 milyar dolarlık put" başlığı, fonun 10 milyar dolar ödediği anlamına gelmez; opsiyonun kapsadığı hisselerin çeyrek sonu değeri budur. Açılış Zili bu satırları hisse portföyünden ayrı gösterir ve ağırlık hesabına katmaz.

## Kopyalamak Neden Riskli

Ünlü bir yatırımcının aldığını almak cazip bir kısa yol gibi görünür. Üç sorunu vardır:

1. **Geç kalırsın.** Sen gördüğünde işlem en az birkaç hafta, çoğu zaman aylar önce yapılmıştır. Fiyat çoktan hareket etmiş olabilir.
2. **Bütünü görmezsin.** Pozisyon, görmediğin bir korumanın ya da başka bir varlığın parçası olabilir.
3. **Onun ölçeği senin ölçeğin değil.** Yüzlerce milyarlık bir portföyde yüzde birlik bir deneme, senin portföyünde tüm birikim olabilir.

13F bir fikir kaynağıdır, bir al sinyali değil. Bir yatırımcının neden o şirkete inandığını anlamaya çalışmak, ne aldığını kopyalamaktan çok daha öğreticidir.

## Kongre Bildirimleri

ABD Kongre üyeleri ve eşleri, 1.000 doları aşan hisse işlemlerini STOCK Yasası gereği 45 gün içinde bildirmek zorundadır. Bu bildirimler 13F'ten iki noktada ayrılır:

| | 13F | Kongre Bildirimi |
|---|---|---|
| Kapsam | Çeyrek sonundaki portföy | Tek tek işlemler |
| Tutar | Kesin değer | Aralık ($1.000.001 - $5.000.000 gibi) |
| Gecikme | Çeyrek sonu + 45 gün | İşlem + 45 gün |

Tutar yalnızca aralık olarak bildirildiği için bir işlemin gerçek büyüklüğü bilinmez; aralığın ortasını tek sayı gibi okumak uydurma bir kesinlik olur.

::: ozet Özet
13F büyük yöneticilerin çeyrek sonu fotoğrafıdır: gerçek ama gecikmeli ve eksik. Opsiyon satırında değer dayanak hissenindir. Kongre bildirimleri tek tek işlemleri tutar aralığıyla verir. Hiçbiri tek başına bir al-sat kararı için yeterli değildir.
:::`,
  },


  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: SEC, "Shortening the Securities Transaction Settlement Cycle"
     (T+1, 28 Mayıs 2024 yürürlük). SEC Investor Bulletin "Holding Your
     Securities" (street name, DTC). IRS Instructions for Form W-8BEN.
     Seans saatleri NYSE/Nasdaq; TR karşılığı lib/session-clock.ts'teki
     kuralla aynı (ABD yaz saatiyle kayar). Kurum adı bilerek geçmiyor. */
  "abd-hisse-nasil-alinir": {
    title: "ABD'de Hisse Nasıl Alınır: Adım Adım",
    dek: "Liranın bir ABD hissesine dönüşene kadar geçtiği beş halka ve her halkada ödenen, çoğu görünmeyen bedel.",
    bodyMd: `Türkiye'den bir ABD hissesi almak tek bir tuşa basmak gibi görünür ama arkasında beş ayrı adım vardır: bir kurum seçmek, hesap açmak, parayı dolara çevirmek, emir vermek ve hisseyi saklamak. Her adımın kendi maliyeti ve kendi kararı var. Bu yazı sırayla hepsinin üzerinden geçer; belirli bir kurumu önermez.

::: akis Liradan Hisseye
Aracı Kurum | Yerli ya da yabancı, lisanslı
Hesap | Kimlik doğrulama · W-8BEN
Döviz | Lira → dolar, kur farkıyla
Emir | Limit ya da piyasa emri
Saklama | T+1 takas, kurum adına kayıt
:::

## 1. Aracı Kurumu Seç

İki yol var. Birincisi Türkiye'de lisanslı bir aracı kurumun yurt dışı piyasalar hizmeti: hesabı yurt içinde açarsın, kurum emrini arka planda bir yabancı muhabir kuruma iletir. İkincisi hesabı doğrudan yurt dışındaki bir aracı kurumda açmak: para yurt dışına gider, muhatabın o kurum olur.

İkisinin maliyeti, koruma çerçevesi ve belge düzeni farklıdır. Hangisinin sana uyduğunu belirleyen kalemler ayrı bir yazıda: [Aracı Kurum Seçerken Nelere Bakılır?](/rehber/araci-kurum-secimi)

## 2. Hesabı Aç ve Kimliğini Doğrula

Her lisanslı kurum hesap açmadan önce kim olduğunu doğrulamak zorundadır. Buna **KYC** (müşterini tanı) denir: kimlik belgesi, adres belgesi, bazen gelir ve birikim kaynağına dair sorular. Çoğu kurum ayrıca yatırım deneyimini ölçen bir uygunluk testi yapar; opsiyon ya da kaldıraç gibi ürünlere erişim bu teste bağlıdır.

ABD hissesi için bir form daha vardır: **W-8BEN**. Bu form ABD vergi mükellefi olmadığını ve Türkiye'de yerleşik olduğunu beyan eder; temettülerden kesilecek ABD vergisini belirler. Yabancı kurumda hesap açılışında doldurulur; yerli kurumlar da genellikle muhabirleri için aynı formu ister. Ayrıntı: [W-8BEN ve 1042-S](/rehber/w-8ben)

## 3. Parayı Gönder ve Dolara Çevir

Hesaba para yatırmanın iki biçimi var: parayı bankada dolara çevirip göndermek ya da lira gönderip kurumun içinde çevirmek. Hangisi seçilirse seçilsin, çevirme anında bir kur farkı ödenir ve bu fark ekstrede "komisyon" diye yazmaz.

::: ornek İki Kez Ödenen Makas
100.000 lirayı dolara çevirdiğini düşün. Kullanılan kur ile piyasanın orta kuru arasında %0,5 fark varsa, çevirme anında **500 lira** kaybolur.
Aynı parayı yıllar sonra liraya döndürürken bir %0,5 daha ödenir.
Hisse hiç kıpırdamadan, yalnızca gidiş ve dönüşte yaklaşık **%1**. Karşılaştırırken sorulacak soru "komisyon kaç" değil, "hangi kurdan çeviriyorsunuz" olmalıdır.
:::

Yurt dışındaki bir kuruma banka havalesiyle para gönderiliyorsa buna SWIFT ücreti ve bazen arada duran muhabir bankanın kesintisi eklenir. Para liradan çıkıp dolara girdiği andan itibaren portföyün bir de kur bahsi taşır. Ayrıntı: [Kur Riski](/rehber/kur-riski)

## 4. Emri Ver

Emir üç bilgiden oluşur: sembol (ticker, örneğin [AAPL](/hisse/AAPL)), miktar (adet ya da dolar tutarı) ve emir tipi.

- **Piyasa emri** o anki en iyi karşı fiyattan hemen gerçekleşir; fiyatı garanti etmez.
- **Limit emri** yalnızca belirttiğin fiyattan ya da daha iyisinden gerçekleşir; gerçekleşmeyi garanti etmez.

Ana seans New York saatiyle 09:30'da açılır; Türkiye'de bu, ABD'nin yaz saati uygulamasına göre 16:30'a ya da 17:30'a denk gelir. Açılış öncesi ve kapanış sonrası seanslarda spread genişler ve çoğu kurum orada yalnızca limit emri kabul eder. Ayrıntı: [Emir Tipleri](/rehber/emir-tipleri)

## 5. Takas ve Saklama

İşlem gerçekleştiğinde hisseler hemen senin olmaz; ABD'de takas **T+1**'dir, yani işlemin ertesi iş günü tamamlanır. 28 Mayıs 2024'ten önce bu süre iki iş günüydü.

Takas sonrası hisseler çoğunlukla senin adına değil, aracı kurumun adına kayıtlıdır. Buna **street name** denir: merkezi saklama kuruluşunun kayıtlarında kurumun adı görünür, kurumun kendi defterinde sen. Yerli bir kurum üzerinden alırsan zincir bir halka uzar: sen, yerli kurum, yabancı muhabir kurum, merkezi saklama kuruluşu. Kurumlardan biri batarsa hangi koruma çerçevesinin geçerli olacağını bu zincir belirler.

::: dikkat Kayıt Tutmak Sonraki Adımdır, İsteğe Bağlı Değil
Türkiye'de yerleşik biri için yurt dışı hisseden elde edilen satış kazancı ve temettü beyana tabidir. Kazanç lira üzerinden, alış ve satış günlerinin kuruyla hesaplanır. Her işlemin tarihini, adedini, dolar tutarını ve ödenen ücretleri baştan kaydetmek, Mart ayındaki beyanı bir hesaplama işine indirir; kaydetmemek onu bir arkeoloji kazısına çevirir. Ayrıntı: [Yurt Dışı Hisse Kazancının Vergilendirilmesi](/rehber/yurt-disi-hisse-vergisi)
:::

::: tanim Bu Yazıdaki Terimler
**Ticker:** Hissenin borsadaki kısa kodu. Apple için AAPL, Nvidia için NVDA.
**KYC:** Kurumun müşterinin kimliğini ve para kaynağını doğrulama yükümlülüğü.
**T+1:** İşlemin, gerçekleştiği günden bir iş günü sonra takasla kesinleşmesi.
**Street Name:** Hissenin kayıtlarda yatırımcının değil aracı kurumun adına tutulması.
:::

::: ozet Özet
Bir ABD hissesinin toplam maliyeti komisyondan ibaret değildir: kur farkı, transfer ücreti, spread ve saklama ücreti birlikte hesaplanır. Beş adımın her biri bir kez doğru kurulduğunda sonraki alımlar tek bir emre iner; yanlış kurulduğunda her alımda aynı bedel yeniden ödenir.
:::

## Bu Sitede Nerede Görürsün

Aradığın şirketi üstteki arama kutusundan ya da [Şirketler](/sirketler) dizininden bulursun; sayfasında sembolü, fiyatı ve seansın durumu yazar. Ana sayfadaki geri sayım bir sonraki açılışa ya da kapanışa kalan süreyi Türkiye saatiyle gösterir.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: SIPC, "What SIPC Protects" (500.000 $ tavan, bunun 250.000
     $'ı nakit; piyasa kaybını kapsamaz). FINRA BrokerCheck. SPK ve
     Yatırımcı Tazmin Merkezi (YTM) — tazmin tavanı her yıl güncellendiği
     için metinde rakam yok. SPK'nın izinsiz yatırım hizmetine erişim engeli
     kararları SPK bültenlerinde. Ücret rakamı BİLEREK yok: tarifeler
     kurumdan kuruma ve aydan aya değişiyor; örnek varsayımsal. */
  "araci-kurum-secimi": {
    title: "Aracı Kurum Seçerken Nelere Bakılır?",
    dek: "Komisyon sıfır olabilir; maliyet sıfır olmaz. Bir kurumu karşılaştırmanın kalem kalem yolu.",
    bodyMd: `Aracı kurum, seninle borsa arasındaki tek kapıdır. Seçerken çoğu kişi tek bir sayıya bakar: işlem başına komisyon. Oysa bir kurumun sana maliyeti beş altı kalemin toplamıdır ve en görünür kalem çoğu zaman en küçüğüdür. Bu yazı kurum adı vermez ve ücret rakamı yazmaz; tarifeler sık değişir ve güncel olanı kurumun kendi fiyat sayfasında ve sözleşme ekinde durur.

## Maliyetin Kalemleri

| Kalem | Nerede Durur | Sorulacak Soru |
|---|---|---|
| **Komisyon** | Her işlemde, sabit ya da hisse başına | 5.000 dolarlık tek emirde toplam ne öderim? |
| **Saklama Ücreti** | Aylık ya da yıllık, portföy yüzdesi ya da sabit | Hiç işlem yapmasam yılda ne öderim? |
| **Döviz Farkı** | Kurun içinde | Hangi kurdan çeviriyorsunuz, piyasa ortasından farkı ne? |
| **Transfer Ücreti** | Para yatırma ve çekme | Parayı geri çekerken kaç kalem ücret var? |
| **Veri ve Hesap Ücretleri** | Anlık fiyat aboneliği, pasif hesap | Hangi durumda hesabım ücretlenir? |

::: ornek Sıfır Komisyonun Hesabı
Varsayımsal bir yatırımcı yılda dört kez 2.500 dolarlık alım yapıyor; hesapta ortalama 10.000 dolar duruyor.
Komisyon: **0 $**.
Çevirmede %0,5'lik kur farkı: 10.000 × %0,5 = **50 $**.
Yıllık %0,2'lik saklama ücreti: 10.000 × %0,2 = **20 $**.
Ekstrede "komisyon" satırı sıfır yazar; yıllık maliyet 70 dolardır. Kalemlerin oranları kurumdan kuruma değişir; değişmeyen şey, karşılaştırmanın toplam üzerinden yapılması gerektiğidir.
:::

## Ürün ve Seans Erişimi

Ucuz ama ihtiyacın olan şeyi sunmayan bir kurum ucuz değildir. Sorulacak başlıklar:

- **Kesirli hisse.** Tutar bazlı emir verilebiliyor mu, hangi hisselerde? Ayrıntı: [Kesirli Hisse](/rehber/kesirli-hisse)
- **Uzatılmış seans.** Açılış öncesi ve kapanış sonrası seanslara erişim var mı? Bazı kurumlar gece boyunca da işlem imkânı sunuyor. Bilanço tepkileri çoğunlukla bu saatlerde oluşur. Ayrıntı: [Bilanço Günü Nasıl Okunur?](/rehber/bilanco-gunu-nasil-okunur)
- **Emir tipleri.** Stop ve iz süren stop emirleri sunucuda mı bekliyor, uygulamada mı?
- **ETF erişimi.** Bazı kurumlar bağlı oldukları ülkenin düzenlemesi nedeniyle ABD'de kurulu ETF'leri bireysel müşteriye sunmaz. Hesap açmadan önce sormak gerekir.

## Yatırımcı Koruması Neyi Korur

ABD'de SIPC üyesi bir aracı kurum batarsa ve müşteri varlıkları eksik çıkarsa, SIPC müşteri başına **500.000 dolara** kadar (bunun en fazla 250.000 doları nakit için) koruma sağlar. Koruma, hesabın açıldığı **tüzel kişiliğe** bağlıdır: küresel kurumlar birçok ülkede ayrı şirketlerle çalışır ve ABD dışındaki bir şirkette açılan hesap SIPC kapsamında olmayabilir.

Türkiye'de lisanslı kurumlarda benzer rolü **Yatırımcı Tazmin Merkezi** üstlenir; kurumun yükümlülüklerini yerine getirememesi hâlinde her yıl güncellenen bir tavana kadar tazmin sağlar. Yurt dışı piyasalardaki varlıkların bu kapsamda nasıl değerlendirildiğini kuruma ayrıca sormak gerekir.

::: dikkat Koruma Fiyatı Korumaz
SIPC de Yatırımcı Tazmin Merkezi de **kurumun batmasına** karşı koruma sağlar, hissenin düşmesine karşı değil. Aldığın hisse %40 düşerse bu bir piyasa kaybıdır ve hiçbir koruma programı onu karşılamaz.
:::

## Yerli Kurum ve Yabancı Kurum

| Konu | Yerli Kurum | Yabancı Kurum |
|---|---|---|
| **Düzenleyici** | SPK | Kurumun kayıtlı olduğu ülkenin düzenleyicisi |
| **Para Transferi** | Yurt içi, lira ile | Uluslararası havale, SWIFT ücreti |
| **Saklama Zinciri** | Bir halka daha uzun, yabancı muhabir üzerinden | Daha kısa |
| **Koruma Çerçevesi** | Yatırımcı Tazmin Merkezi | SIPC ya da o ülkenin programı |
| **Belgeler** | Türkçe döküm, bazen vergi raporu | İngilizce ekstre, 1042-S |
| **Destek** | Türkçe, Türkiye saatiyle | Çoğunlukla İngilizce |

İkisi arasında doğru ya da yanlış yok; ağırlık verdiğin kaleme göre değişen bir tercih var. Yabancı bir kurumla çalışacaksan lisansını kurumun kendi düzenleyicisinin sitesinden doğrula (ABD'de FINRA'nın BrokerCheck aracı gibi). SPK, Türkiye'de izinsiz yatırım hizmeti sunan platformlara erişim engeli getirebiliyor; reklamla karşına çıkan bir platformun Türkiye'ye hizmet yetkisi olup olmadığını SPK'nın listelerinden kontrol etmek mümkün.

::: ozet Özet
Bir aracı kurumu komisyonuyla değil, **yıllık toplam maliyetiyle**, ihtiyacın olan ürünlere erişimiyle ve hesabının hangi tüzel kişilikte, hangi koruma çerçevesinde durduğuyla karşılaştır. Sıfır komisyon bir fiyat değil, bir pazarlama satırıdır.
:::

## Bu Sitede Nerede Görürsün

Bu site aracı kurum değildir ve buradan emir verilmez; herhangi bir kurumu önermez. Kurumunun uygulamasında gördüğün fiyatı buradaki hisse sayfasıyla karşılaştırırken sayfadaki zaman damgasına bak: aradaki fark çoğu zaman gecikmeden gelir.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: SEC Investor Bulletin "Fractional Share Investing — Buy a
     Slice, Not the Whole Pie" (oy hakkı, hesap taşıma, emir yürütme
     farkları). FINRA, ACATS (kesirli payların taşınmayıp nakde çevrilmesi
     kurumdan kuruma değişiyor). Opsiyon sözleşmesinin 100 hisse temsil
     etmesi OCC standart sözleşme koşulu. */
  "kesirli-hisse": {
    title: "Kesirli Hisse Nedir?",
    dek: "Yüzlerce dolarlık bir hisseye elli dolarla ortak olmak: nasıl çalıştığı ve tam hisseye göre neyin eksik kaldığı.",
    bodyMd: `Bir hissenin fiyatı 400 dolarsa, klasik bir emirle 50 dolara o şirkete ortak olamazsın. Kesirli hisse bu engeli kaldırır: hisse adedi yerine **tutar** yazarsın ve karşılığında hissenin bir parçasını alırsın. Mekanizma basit ama tam hissenin bütün haklarını her zaman taşımaz.

::: tanim Kesirli Hisse
Bir hissenin tam sayı olmayan bir kısmı: 0,125 ya da 2,4 hisse gibi. Borsada kesirli hisse işlem görmez; parçalama işini aracı kurum yapar ve kaydı kendi defterinde tutar.
:::

## Nasıl Çalışır

Borsalarda işlemin en küçük birimi tam hissedir. Kesirli emir veren müşterilerin taleplerini aracı kurum toplar, tam hisseleri piyasadan alır ya da kendi envanterinden karşılar ve parçaları müşterilerin hesaplarına defter üzerinde dağıtır.

Bunun iki sonucu var. Birincisi, kesirli payın kurum dışında bir karşılığı yoktur: merkezi saklama kaydında tam hisse kurumun adına durur, senin payın kurumun iç kaydıdır. İkincisi, emrin nasıl ve ne zaman gerçekleştiği kuruma göre değişir: bazıları anında, bazıları gün içinde toplu olarak işler; bazıları kesirli emirde yalnızca piyasa emrine izin verir.

::: ornek 50 Dolarla Bir Hisse Parçası
Hisse 400 dolar. 50 dolarlık kesirli emir **0,125 hisse** alır.
Şirket hisse başına 2 dolar temettü dağıtırsa hesabına 0,25 dolar brüt temettü gelir.
Hisse %10 yükselirse payın 55 dolar olur.
Ekonomik olarak bir tam hissenin sekizde biriyle birebir aynı davranır: kazanç, kayıp ve temettü oransal işler.
:::

## Tam Hisseye Göre Neyin Eksik Kaldığı

| Konu | Tam Hisse | Kesirli Hisse |
|---|---|---|
| **Fiyat Hareketi ve Temettü** | Tam | Oransal olarak tam |
| **Oy Hakkı** | Var | Kuruma göre yok ya da oransal |
| **Başka Kuruma Taşıma** | Taşınır | Çoğunlukla satılıp nakde çevrilir |
| **Emir Tipleri** | Hepsi | Çoğu kurumda kısıtlı |
| **Uzatılmış Seans** | Kuruma göre | Çoğu kurumda yok |
| **Opsiyon Teminatı** | 100 hisse bir sözleşme | Kesir sayılmaz |

::: dikkat Taşıma Bir Satıştır
Hesabını başka bir kuruma taşıdığında tam hisseler olduğu gibi aktarılabilir, kesirli kısım ise çoğu zaman satılıp nakde çevrilir. Türkiye'de yerleşik biri için bu bir **satış işlemidir**: kazanç varsa beyana girer. Küçük bir kesir için bile tarih, tutar ve kur kaydı gerekir. Ayrıntı: [Yurt Dışı Hisse Kazancının Vergilendirilmesi](/rehber/yurt-disi-hisse-vergisi)
:::

## Ne İşe Yarar

Kesirli hisse bir getiri aracı değil, bir **ölçü** aracıdır. Üç işte fark yaratır:

- **Düzenli küçük alımlar.** Her ay sabit bir tutar yatıran biri için hisse fiyatının bölünmezliği ortadan kalkar; tutarın tamamı yatırıma girer, kenarda artık nakit kalmaz. Ayrıntı: [Düzenli Alım (DCA)](/rehber/duzenli-alim)
- **Ağırlık hassasiyeti.** Portföyünü yüzdelerle kurmak istiyorsan pahalı bir hissede tam adet zorunluluğu hedef oranı bozar. Ayrıntı: [Risk Yönetimi](/rehber/risk-yonetimi)
- **Temettünün yeniden yatırımı.** Küçük temettü tutarları aynı hisseye kesir olarak geri yatırılabilir.

Hisse bölünmesiyle ilişkisi de buradan okunur: şirketler pahalı hisseleri küçük yatırımcıya erişilebilir kılmak için hisse böler. Kesirli işlem imkânı yaygınlaştıkça bu gerekçe zayıfladı, ama bölünme kararları hâlâ alınıyor. Ayrıntı: [Hisse Senedi Nedir?](/rehber/hisse-senedi)

::: ozet Özet
Kesirli hisse, fiyatın bölünmez olmasının yarattığı engeli kaldırır; getiri ve temettü açısından tam hisseyle aynı davranır. Karşılığında payın kurumun defterinde yaşar: oy, taşıma ve emir esnekliği kurumun sunduğu kadardır.
:::

## Bu Sitede Nerede Görürsün

Hisse sayfalarındaki fiyatlar her zaman **tam hisse** fiyatıdır. Kesirli payının değeri bu fiyatın payınla çarpımıdır; kurumunun uygulamasında gördüğün tutarla karşılaştırırken bunu hesaba kat.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: ABD-Türkiye Çifte Vergilendirmeyi Önleme Anlaşması (28 Mart
     1996), md. 10/2: temettüde kaynak ülke vergisi, en az %10 oy hakkına
     sahip ŞİRKETLERE %15, diğer bütün hâllerde %20. Gerçek kişi portföy
     yatırımcısı için oran %20 — "%15" sık yapılan bir hata, metin bunu
     açıkça söylüyor. Senato Dış İlişkiler raporu (Ex. Rept. 105-6) ve IRS
     Tax Treaty Table 1 aynı oranları veriyor. Md. 13: taşınmaz ve işyeri
     dışındaki değer artışı kazancı yalnızca yerleşik olunan ülkede
     vergilenir. IRS Instructions for Form W-8BEN: geçerlilik imza yılını
     izleyen üçüncü takvim yılının sonuna kadar; durum değişikliğinde 30 gün.
     IRS Instructions for Form 1042-S: alıcıya 15 Mart'a kadar.
     IRC §1446(f): 2023'ten itibaren yabancıların PTP satışlarında %10.
     IRS "Some nonresidents with U.S. assets must file estate tax returns":
     ABD'de yerleşik olmayanlarda 60.000 $ eşiği; ABD'nin Türkiye ile
     veraset vergisi anlaşması yok. GVK md. 123: yurt dışında ödenen
     verginin mahsubu ve belge şartı. */
  "w-8ben": {
    title: "W-8BEN ve 1042-S: Temettüden Kesilen ABD Vergisi",
    dek: "Bir ABD şirketinin temettüsü hesabına gelmeden önce vergisi kesilir; ne kadar kesileceğini tek bir form belirler.",
    bodyMd: `Bir ABD şirketi temettü dağıttığında para sana ulaşmadan önce ABD adına bir vergi kesilir. Bu kesintinin oranı senin kim olduğuna bağlıdır ve bunu aracı kuruma söyleyen belge **W-8BEN** formudur. Yıl sonunda ne kadar kesildiğini gösteren belge ise **1042-S**'tir. İkisi birlikte, yurt dışı hisse yatırımının vergi tarafındaki ilk halkayı oluşturur.

::: tanim Bu Yazıdaki Terimler
**W-8BEN:** ABD'de yerleşik olmayan gerçek kişinin ABD vergi mükellefi olmadığını, hangi ülkede yerleşik olduğunu ve vergi anlaşmasından yararlanmak istediğini beyan ettiği IRS formu.
**1042-S:** Vergiyi kesen kurumun yıl içinde ödediği geliri ve kestiği vergiyi gösteren yıllık bildirim.
**Kaynakta Kesinti:** Verginin, gelir sahibine ödenmeden önce ödeyen tarafından kesilip devlete aktarılması.
:::

## Form Ne Söyler

W-8BEN kısa bir formdur ve üç şey beyan eder: kimliğin, yerleşik olduğun ülke ve vergi anlaşmasından yararlanma talebin. Türkiye'de yerleşik biri için talep, ABD ile Türkiye arasındaki çifte vergilendirmeyi önleme anlaşmasının **temettü maddesine** dayanır.

Form IRS'e gönderilmez; aracı kuruma verilir. Kurum onu dosyada tutar ve her temettü ödemesinde hangi oranda kesinti yapacağını ona bakarak belirler.

## Oran: %30 Yerine %20

::: oncesi 100 Dolarlık Temettüden Hesabına Geçen
70 $ | Form Yoksa, %30 Kesinti
80 $ | W-8BEN ile, %20 Kesinti
:::

ABD, formu olmayan yabancıya ödenen temettüden **%30** keser. Anlaşma bu oranı gerçek kişiler için **%20**'ye indirir. Fark yıllar içinde küçük değildir: aynı temettüden hesabına geçen nakit yedide bir oranında artar.

::: dikkat %15 Değil, %20
Türkçe kaynaklarda sık sık "Türkiye için temettü kesintisi %15" yazar. Anlaşmanın 10. maddesi %15'i yalnızca şirketin oy haklarının en az %10'una sahip **şirketler** için öngörür. Hisse alan bir gerçek kişi için oran %20'dir. Kurumun uyguladığı oranı 1042-S'teki kesinti oranı satırından doğrulayabilirsin.
:::

## Formun Kapsamadığı Şeyler

**Satış kazancı.** ABD'de yerleşik olmayan bir yabancının hisse satışından elde ettiği kazançtan ABD vergi kesmez; anlaşma da bu kazancı yerleşik olunan ülkeye bırakır. Yani satış kazancının vergisi ABD'de değil **Türkiye'de** doğar. Ayrıntı: [Yurt Dışı Hisse Kazancının Vergilendirilmesi](/rehber/yurt-disi-hisse-vergisi)

**Bazı özel yapılar.** Ortaklık olarak kurulmuş ve borsada işlem gören yapıların (PTP) satışında 2023'ten beri satış tutarının %10'u kesilebiliyor. Bu kurallar hisse ve sıradan ETF'lerden farklıdır; bu tür bir ürün almadan önce kurumun ne kestiğini sormak gerekir.

**ADR temettüsü.** Yabancı bir şirketin ADR'sinden gelen temettüde vergiyi şirketin kendi ülkesi keser; W-8BEN'in ABD oranı orada geçerli değildir. Ayrıntı: [ADR ve SPAC Nedir?](/rehber/adr-spac)

## Formun Ömrü

W-8BEN süresiz değildir. İmzalandığı yılı izleyen **üçüncü takvim yılının son gününe** kadar geçerlidir; yani kabaca üç ila dört yıl. Adresin ya da yerleşik olduğun ülke değişirse otuz gün içinde yeni form verilmesi gerekir.

::: zaman Bir Formun Ömrü
10 Mart 2026 | Formu imzalarsın; kurum kaydına işler.
Her temettü ödemesi | Kesinti %20 olarak uygulanır.
15 Mart 2027'ye kadar | 2026 yılının 1042-S belgesi hesabına gelir.
31 Aralık 2029 | Formun geçerli olduğu son gün. Kurumlar genellikle birkaç ay önce yenileme ister.
1 Ocak 2030 | Yenilenmemişse kesinti %30'a döner; bazı kurumlar hesabı kısıtlar.
:::

## 1042-S ile Ne Yapılır

1042-S yıl içindeki her gelir türünü ayrı satırda gösterir: gelirin kodu, brüt tutarı, uygulanan oran ve kesilen vergi. Türkiye'deki beyan açısından iki işe yarar: temettünün **brüt** tutarını belgeler ve ABD'de ödenen vergiyi gösterir.

::: ornek 100 Dolarlık Temettünün İki Ülkedeki Yolu
Şirket 100 dolar brüt temettü öder. ABD 20 dolar keser; hesabına 80 dolar geçer.
Türkiye'de beyan sınırı aşılıyorsa temettü **brüt 100 dolar** üzerinden, ödeme günündeki kurla liraya çevrilerek beyan edilir; net 80 üzerinden değil.
ABD'de ödenen 20 dolar, o gelire Türkiye'de düşen vergiyi aşmamak kaydıyla hesaplanan vergiden mahsup edilebilir.
:::

Mahsup için verginin yurt dışında ödendiğinin belgelenmesi gerekir ve Türk mevzuatı bu belgede yetkili makam onayı gibi şartlar arayabilir. 1042-S'in tek başına yeterli sayılıp sayılmayacağını beyan öncesinde bir mali müşavirle konuşmak gerekir.

::: dikkat Formun Çözmediği Konu: Veraset
W-8BEN yalnızca gelir vergisiyle ilgilidir. ABD, yerleşik olmayan yabancıların ABD'deki varlıklarında da veraset vergisi uygular ve ABD hisseleri bu varlıklara dahildir. Beyan yükümlülüğü ABD'deki varlıkların toplamı **60.000 doları** aştığında doğar ve ABD'nin Türkiye ile veraset vergisine ilişkin bir anlaşması yoktur. Büyük bir portföy için bu, bir uzmana danışılacak ayrı bir konudur.
:::

::: ozet Özet
W-8BEN, ABD'nin temettüden keseceği vergiyi %30'dan %20'ye indiren formdur ve süresi dolunca kendiliğinden yenilenmez. 1042-S bu kesintinin belgesidir. Satış kazancı ise ABD'de değil Türkiye'de vergilenir; W-8BEN o hesabı değiştirmez.
:::

*Bu yazı genel bilgi verir, vergi danışmanlığı değildir. Oranlar ABD-Türkiye vergi anlaşmasının 1996 tarihli metnine ve IRS'in 2026 itibarıyla yayımlı form talimatlarına dayanır.*`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: 193 sayılı GVK md. Mük. 80 (değer artışı kazancı; yıllık
     istisna tutarı menkul kıymetlere UYGULANMAZ), Mük. 81 (Yİ-ÜFE artışı
     %10 ve üstüyse maliyet, elden çıkarılan ay hariç endekslenir), md. 86/1-d
     ve 332 Seri No.lu GVGT (31.12.2025 RG): tevkifata tabi olmayan
     menkul ve gayrimenkul sermaye iratlarında 2026 yılı beyan sınırı
     22.000 TL (2025: 18.000 TL). GVK md. 92 (beyan Mart), 117 (ödeme Mart
     ve Temmuz), 123 (yurt dışında ödenen verginin mahsubu). GİB özelgeleri
     ve Yapı Kredi "Yabancı Hisse Senedi Gelirlerinde (2026 Yılı) Vergi
     Durumu", Gedik ve Eriş YMM (09.2026) notları: TL karşılığı alış ve
     satış günlerinin TCMB döviz alış kuruyla; aynı yıl içindeki alım-satım
     zararı aynı yılın kazancından düşülür, sonraki yıla devretmez.
     Kâr payında yarı istisna yalnızca önemli sahiplikte (11257 sayılı CK,
     29.04.2026: oran %50'den %20'ye) — portföy yatırımcısını kapsamıyor.
     BELİRSİZLİK: "2026'dan itibaren her kazanç beyan edilir" ifadesi
     kaynaklarda farklı çerçeveleniyor; menkul kıymetler istisna dışında
     zaten vardı. Metin tarihsel bir değişiklik iddia etmiyor, 2026
     itibarıyla geçerli düzeni anlatıyor. Örnekteki kur ve endeks
     rakamları VARSAYIMSAL. */
  "yurt-disi-hisse-vergisi": {
    title: "Yurt Dışı Hisse Kazancının Vergilendirilmesi",
    dek: "Türkiye'de yerleşik biri için ABD hissesinden gelen satış kazancı ve temettü: nasıl hesaplanır, ne zaman beyan edilir.",
    bodyMd: `ABD hissesinden elde edilen kazancın vergisi ABD'de değil, Türkiye'de doğar. Yurt dışı borsalardaki hisseler için Türkiye'de kaynakta kesinti yapan bir aracı da çoğu zaman yoktur; hesaplama ve beyan yatırımcının kendisine kalır. Bu yazı 2026 itibarıyla geçerli düzeni anlatır.

::: dikkat Genel Bilgi, Vergi Danışmanlığı Değil
Bu yazı 2026 itibarıyla yürürlükteki kuralları genel olarak özetler. Kanun, tebliğ ve had tutarları her yıl değişebilir; kişisel durumun (diğer gelirlerin, yerleşiklik durumun, işlem sıklığın) sonucu değiştirebilir. Beyan öncesinde güncel mevzuatı Gelir İdaresi'nden ya da bir mali müşavirden doğrula.
:::

## Satış Kazancı Nasıl Hesaplanır

Yurt dışı hisse satışından doğan kazanç, Gelir Vergisi Kanunu'nda **değer artışı kazancı** olarak geçer. Hesap **lira** üzerinden yapılır: dolar kazancı değil, liraya çevrilmiş alış ile liraya çevrilmiş satış arasındaki fark vergilenir.

::: akis Kazancın Dört Adımı
Alış Maliyeti | Dolar tutarı × alış günü TCMB döviz alış kuru
Endeksleme | Yİ-ÜFE artışı %10 ve üstüyse maliyet güncellenir
Satış Bedeli | Dolar tutarı × satış günü TCMB döviz alış kuru
Kazanç | Satış bedeli − (endekslenmiş) maliyet
:::

**Endeksleme** enflasyonun maliyeti eritmesine karşı bir düzeltmedir. Alış ayından önceki ay ile satış ayından önceki ay arasındaki Yİ-ÜFE artışı **%10 ya da daha fazlaysa**, lira cinsinden maliyet bu oranda artırılır. Artış %10'un altındaysa endeksleme yapılmaz.

::: ornek Kurla Büyüyen Kazanç
Rakamlar varsayımsaldır.
Alış: 1.000 dolarlık hisse, kur 36 → maliyet **36.000 TL**.
Satış: 1.200 dolar, kur 43 → satış bedeli **51.600 TL**.
Endekssiz kazanç: 15.600 TL. Oysa dolar bazında kazanç yalnızca 200 dolar, satış kuruyla 8.600 TL. Geri kalan **7.000 TL** hissenin değil kurun yükselişinden geliyor.
Aradaki Yİ-ÜFE artışı %25 olsaydı maliyet 36.000 × 1,25 = **45.000 TL** olur ve vergiye esas kazanç 6.600 TL'ye iner. Endeksleme, kurdan gelen "kazancın" enflasyon kadar olan kısmını vergiden çıkarır.
:::

Buradaki mekanizma önemli: lira değer kaybettikçe, dolar bazında hiç kâr etmemiş bir pozisyon bile lira bazında kazanç gösterebilir. Endeksleme bunu kısmen dengeler, tamamen değil. Ayrıntı: [Kur Riski](/rehber/kur-riski)

## Beyan: Tutar Ne Olursa Olsun

Değer artışı kazançları için kanunda yıllık bir istisna tutarı vardır ama bu istisna **menkul kıymetlere uygulanmaz**. Sonuç: yurt dışı hisse satışından elde edilen kazanç, tutarı ne olursa olsun beyan edilir.

- Beyan, kazancın elde edildiği yılı izleyen yılın **1-31 Mart** döneminde yıllık gelir vergisi beyannamesiyle verilir. 2026'da satılan hissenin beyanı Mart 2027'dedir.
- Vergi, diğer beyana tabi gelirlerle toplanıp artan oranlı tarifeyle (%15'ten %40'a kadar dilimler) hesaplanır.
- Ödeme iki taksittir: Mart ve Temmuz.

::: sayilar 2026 Düzeninde Anahtar Sayılar
0 TL | Hisse satış kazancında beyan sınırı
%10 | Maliyet endekslemesi için gereken asgari Yİ-ÜFE artışı
22.000 TL | 2026 gelirlerinde, kesintiye uğramamış sermaye iratları için beyan sınırı
1-31 Mart | Beyanname dönemi, kazancı izleyen yıl
:::

## Zararlar Ne Olur

Aynı takvim yılı içindeki alım-satım zararları, aynı yılın alım-satım kazançlarından düşülür. Bir hissede 5.000 TL kazanıp diğerinde 3.000 TL kaybettiysen beyana 2.000 TL girer.

Sınırlar da net: zarar maaş, kira ya da temettü gibi başka gelirlerden düşülemez ve **sonraki yıla devretmez**. Yıl içinde kapatılmayan zarar o yılla birlikte kaybolur.

## Temettü

Yurt dışı hisseden gelen temettü **menkul sermaye iradıdır** ve satış kazancından farklı bir kurala tabidir.

1. Temettü **brüt** tutarı üzerinden, tahsil edildiği günün TCMB döviz alış kuruyla liraya çevrilir. ABD'nin kestiği %20 düşülmeden önceki tutar esastır. Ayrıntı: [W-8BEN ve 1042-S](/rehber/w-8ben)
2. 2026 gelirleri için kaynakta kesintiye uğramamış menkul ve gayrimenkul sermaye iratlarının toplamı **22.000 TL**'yi aşmıyorsa bu gelirler için beyanname verilmez. Aşıyorsa tamamı beyan edilir; yalnızca aşan kısım değil.
3. Yerli şirket temettülerindeki yarı istisna, portföy yatırımcısının yabancı hisse temettüsüne uygulanmaz.
4. ABD'de ödenen vergi, belgelenmek ve o gelire Türkiye'de düşen vergiyi aşmamak kaydıyla hesaplanan vergiden mahsup edilebilir.

::: dikkat Kur Günü Tek Değildir
Her alış, her satış ve her temettü kendi gününün kuruyla çevrilir. Yıl sonu kuruyla ya da ortalama kurla yapılan toplu bir hesap yanlış sonuç verir. Aynı hisseyi farklı günlerde parça parça aldıysan, hangi alışın satıldığını ve maliyetinin nasıl belirleneceğini de kayıt altında tutman gerekir.
:::

## Hesabı Yapmak

Sitedeki [vergi hesaplayıcısı](/vergi) alış ve satış tarihlerini, dolar tutarlarını ve kurları girerek bir tahmin çıkarmana yardım eder. Sonucu bir beyanname değil, bir ön hesap olarak oku.

::: ozet Özet
Yurt dışı hisse kazancı lira üzerinden hesaplanır, kur artışı da kazancın içindedir ve Yİ-ÜFE %10'u geçtiğinde maliyet endekslenerek bunun bir kısmı düşülür. Satış kazancında beyan sınırı yoktur, zarar yalnızca aynı yıl içinde düşülür. Temettü brüt tutarıyla ayrı bir sınıra tabidir. Kuralları bilmek yetmez: her işlemi günüyle kaydetmek beyanın kendisidir.
:::

*Bu yazı Gelir Vergisi Kanunu'nun ilgili maddelerine, 2026 had ve tutarlarını belirleyen tebliğe ve Gelir İdaresi özelgelerine dayanır. Genel bilgi verir, vergi danışmanlığı değildir ve 2026 itibarıyla geçerlidir; düzenlemeler değişebilir.*`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: Vanguard Research, "Dollar-cost averaging just means taking
     risk later" (2012): ABD, İngiltere ve Avustralya verisinde toplu
     yatırım, 12 aylık düzenli alımı vakaların yaklaşık üçte ikisinde
     geçti. Harmonik ortalama ≤ aritmetik ortalama eşitsizliği standart
     matematik. Örnekteki fiyatlar varsayımsal. */
  "duzenli-alim": {
    title: "Düzenli Alım (DCA): Ne Yapar, Ne Yapmaz",
    dek: "Her ay aynı tutarla almak ortalama maliyeti düşürür gibi görünür; neyi gerçekten düşürdüğü ve neyi hiç değiştirmediği.",
    bodyMd: `Her ay maaştan aynı tutarı ayırıp aynı fona ya da hisseye yatırmak, bireysel yatırımcının en yaygın yöntemidir. Adı İngilizcede **dollar-cost averaging**, kısaca DCA. Hakkında iki şey birden söylenir: "riski azaltır" ve "getiriyi artırır". Birincisi kısmen doğrudur, ikincisi büyük ölçüde yanlıştır.

::: tanim Düzenli Alım (DCA)
Piyasa fiyatına bakmadan, belirli aralıklarla sabit bir tutarla alım yapmak. Adet sabit değildir; fiyat düştüğünde aynı tutar daha çok adet, yükseldiğinde daha az adet alır.
:::

## Mekanizma: Sabit Tutar, Değişen Adet

Yöntemin bütün matematiği tek cümlede: sabit tutar, ucuz aylarda daha çok, pahalı aylarda daha az adet alır. Bu yüzden ödediğin **ortalama maliyet**, o aylardaki fiyatların basit ortalamasından her zaman düşük ya da ona eşittir.

::: ornek Dört Ay, Dört Fiyat
Her ay 1.000 dolar yatırılıyor. Fiyatlar sırasıyla 100, 80, 50 ve 100 dolar.
Alınan adetler: 10 + 12,5 + 20 + 10 = **52,5 adet**, toplam 4.000 dolar.
Adet başına ortalama maliyet: 4.000 ÷ 52,5 ≈ **76,2 dolar**. Fiyatların basit ortalaması ise 82,5 dolar.
Dördüncü ayın sonunda fiyat başladığı yere, 100 dolara döndü; portföy 5.250 dolar, yani **+%31**. Tek seferde ilk ay alan biri aynı tarihte başa baş durur.
:::

Örnek yöntemin en iyi senaryosunu gösteriyor: önce düşen, sonra toparlanan bir fiyat. Yöntemin değeri tam olarak bu yolun üzerindedir.

## Ne Yapmaz

**Beklenen getiriyi artırmaz.** Uzun vadede yükselen bir piyasada paranın bir kısmını aylarca nakitte bekletmek, o bekleme süresinin getirisinden vazgeçmek demektir. Vanguard'ın 2012'de ABD, İngiltere ve Avustralya verisiyle yaptığı çalışmada, eldeki paranın tamamını tek seferde yatırmak on iki aya yayarak yatırmayı vakaların yaklaşık **üçte ikisinde** geride bıraktı.

**Kötü seçimi düzeltmez.** Sürekli düşen bir hissede düzenli alım, her ay batan bir şeye daha çok para koymaktır. Ortalama maliyet düşer ama şirket kurtulmuyorsa ortalamanın düşmesi bir şey ifade etmez. Yöntem, uzun vadede yükseleceğine inanılan geniş bir varlık için anlamlıdır; bir şirketin kaderini değiştirmez. Ayrıntı: [Endeks Fonu mu, Tek Hisse mi?](/rehber/endeks-fonu-mu-tek-hisse-mi)

**Kaybı engellemez.** Piyasa on yıl boyunca yatay ya da aşağı giderse düzenli alan da kaybeder; yalnızca daha yavaş kaybeder.

| İddia | Gerçek |
|---|---|
| **"Riski azaltır"** | Zamanlama riskini yayar; piyasa riskini azaltmaz |
| **"Getiriyi artırır"** | Beklenti olarak hayır; yükselen piyasada tek seferlik alım çoğunlukla önde |
| **"Dipten almayı sağlar"** | Dibi bulmaz; dibin olduğu ayda da, zirvenin olduğu ayda da alır |
| **"Duyguyu devre dışı bırakır"** | Evet, asıl işlevi bu |

## Asıl İşlevi: Kararı Takvime Bırakmak

DCA'nın gerçek değeri matematikte değil davranıştadır. "Şimdi mi girsem, biraz daha mı beklesem" sorusu yatırımcıların en çok yanıldığı sorudur ve DCA bu soruyu hiç sormamayı sağlar. Düşüşte panikle durmak yerine planı sürdürmek, yöntemin bütün faydasını belirler. Ayrıntı: [Yatırımcı Psikolojisi](/rehber/yatirimci-psikolojisi)

Ayrıca çoğu insan için DCA bir tercih bile değildir: birikim maaşla her ay geldiği için yatırım da her ay yapılır. Toplu bir para (miras, prim, satış) söz konusu olduğunda soru gerçekten ortaya çıkar ve cevap, beklenen getiri ile "tek seferde girip hemen düşüşe yakalanma" pişmanlığına ne kadar dayanabileceğin arasındaki bir tercihtir.

::: dikkat Planlı Alım ile Ortalama Düşürmek Aynı Şey Değil
Düzenli alım, fiyattan bağımsız ve önceden belirlenmiş bir plandır. Zarardaki bir pozisyonu "maliyeti düşürmek" için büyütmek ise fiyata tepki olarak verilen bir karardır ve pozisyonun portföydeki ağırlığını tam da yanıldığın yerde artırır. İkisi ekranda aynı görünür; mantıkları zıttır. Ayrıntı: [Risk Yönetimi](/rehber/risk-yonetimi)
:::

## Türkiye'den Yapınca İki Katman

Türkiye'den ABD hissesine düzenli alım yapan biri aslında iki şeyi birden düzenli alır: doları ve hisseyi. Her ay yapılan çevirme, kurda da bir ortalama maliyet oluşturur. Bunun bedeli, her küçük alımda ayrı ayrı ödenen kur farkı ve sabit ücretlerdir. Küçük tutarlarda sabit bir işlem ücreti oransal olarak büyür; bu yüzden alım sıklığı ile maliyet arasında bir denge kurmak gerekir. Tutar küçükse [kesirli hisse](/rehber/kesirli-hisse) tutarın tamamının yatırıma girmesini sağlar.

::: ozet Özet
Düzenli alım, getiriyi artıran bir teknik değil, yanlış zamanda tek bir büyük karar verme riskini zamana yayan bir disiplindir. İyi seçilmiş geniş bir varlıkta ve sürdürüldüğünde işe yarar; kötü bir seçimi düzeltmez ve yükselen bir piyasada beklemenin bir bedeli vardır.
:::

## Bu Sitede Nerede Görürsün

[Karşılaştır](/karsilastir) ekranındaki uzun aralıklar (5 yıl gibi), bir varlığın düşüş ve toparlanma yolunu gösterir; düzenli alımın neden yol boyunca değer kazandığını bu yolun şekli belirler.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: Cboe, "VIX White Paper" (VIX = S&P 500 opsiyonlarından
     türetilen 30 günlük yıllıklaştırılmış beklenen oynaklık; aylığa
     çevirmek için √12). ATM straddle ≈ 0,8 × 1σ hareket yaklaşımı:
     Brenner-Subrahmanyam (1988) yaklaşık formülü (ATM opsiyon ≈ 0,4 ×
     σ × S × √T, straddle bunun iki katı; 0,4 ≈ 1/√(2π)). Normal dağılımda
     ±1σ olasılığı %68. Örnekteki fiyatlar varsayımsal. */
  "beklenen-hareket": {
    title: "Opsiyon Piyasası Ne Fiyatlıyor: Örtük Oynaklık ve Beklenen Hareket",
    dek: "Bilanço gecesinden önce piyasanın ne kadar büyük bir hareket beklediğini, opsiyon fiyatlarından tek bir bölmeyle okumak.",
    bodyMd: `Bir şirket bu akşam bilanço açıklayacak. Hisse yarın ne kadar oynar? Kimse bilmiyor, ama piyasa bu soruya bir fiyat koymuş durumda: o fiyat **opsiyonların** içinde. Bu yazı o fiyatı nasıl okuyacağını anlatır; opsiyon işlemi yapmayı önermez. Primin temel yapısı için önce [Opsiyonlar](/rehber/opsiyonlar) yazısını okumak gerekir.

::: tanim Bu Yazıdaki Terimler
**Örtük Oynaklık (IV):** Opsiyonun piyasa fiyatından geriye doğru çözülen, piyasanın beklediği yıllık oynaklık. Tarihsel oynaklık geçmişi ölçer; örtük oynaklık bugünkü fiyatın içindeki beklentidir.
**ATM (At the Money):** Kullanım fiyatı hissenin o anki fiyatına en yakın olan opsiyon.
**Straddle:** Aynı vade ve aynı kullanım fiyatında bir call ile bir put'un birlikte alınması. Hissenin yönünden bağımsız olarak, yalnızca hareketin büyüklüğünden kazanır.
:::

## Tek Bölmeyle Beklenen Hareket

ATM straddle'ın fiyatı, piyasanın vadeye kadar beklediği hareketin büyüklüğünü dolar cinsinden verir. Hisse fiyatına bölündüğünde yüzde olur:

**Beklenen hareket ≈ ATM straddle fiyatı ÷ hisse fiyatı**

::: ornek Bilanço Akşamı
Hisse 200 dolar. Bilançodan hemen sonra vadesi dolan 200 dolarlık call 9 dolar, put 7 dolar.
Straddle: 9 + 7 = **16 dolar**. Beklenen hareket: 16 ÷ 200 = **±%8**, yani 184 ile 216 dolar arası.
Ertesi gün hisse %6 yükselip 212'ye gider. Yön ne olursa olsun, hareket fiyatlananın **altında** kaldı: straddle vadede yaklaşık 12 dolar eder ve 16'ya alan kaybeder.
Manşet "hisse yükseldi" der; opsiyon piyasasının okuması "beklenenden sakin geçti" olur.
:::

Bu, bilanço tepkilerini okumanın en kullanışlı ölçüsüdür: %6'lık bir hareket, %3 fiyatlanmış bir hissede büyük bir sürpriz, %12 fiyatlanmış bir hissede ise sessiz bir gecedir. Ayrıntı: [Bilanço Günü Nasıl Okunur?](/rehber/bilanco-gunu-nasil-okunur)

## Örtük Oynaklıktan Aynı Sayıya

İkinci yol yıllık örtük oynaklığı vadeye ölçeklemektir. Oynaklık zamanın karekökü ile büyür:

**Bir standart sapmalık hareket ≈ fiyat × IV × √(gün ÷ 365)**

İki yöntem aynı sayıyı vermez ve bu bir hata değildir. ATM straddle, bir standart sapmalık hareketin yaklaşık **0,8** katına denk gelir; çünkü straddle ortalama mutlak hareketi fiyatlar, standart sapmayı değil. Pratikte straddle yöntemi daha doğrudandır: piyasada gerçekten işlem gören fiyatlardan hesaplanır.

::: sayilar Akılda Tutulacak Üç Sayı
√12 | Yıllık oynaklığı aylık harekete çevirmenin çarpanı
0,8 | ATM straddle'ın bir standart sapmalık harekete oranı, yaklaşık
%68 | Normal dağılımda fiyatın ±1 standart sapma içinde kalma olasılığı
:::

Aynı mantık endeks düzeyinde de işler. **VIX**, S&P 500 opsiyonlarından türetilen 30 günlük örtük oynaklıktır. VIX 20 ise piyasa önümüzdeki bir ay için S&P 500'de yaklaşık 20 ÷ √12 ≈ **±%5,8**'lik bir standart sapmalık hareket fiyatlıyor demektir. Ayrıntı: [Volatilite Nedir?](/rehber/volatilite)

## Okurken Dikkat Edilecekler

- **Vade olayı kapsamalı.** Bilanço hareketini ölçmek için açıklamadan hemen sonra dolan ilk vade kullanılır. Daha uzun vade, olayın dışındaki günlerin oynaklığını da içerir.
- **Orta fiyat kullan.** Opsiyonlarda alış-satış farkı geniş olabilir; son işlem fiyatı yerine alış ile satışın ortası daha güvenilir bir okuma verir.
- **Tam ATM yoksa en yakını.** Hisse 203 dolarsa 200 ve 205'lik kullanım fiyatlarının ikisine birden bakmak gerekir.
- **Yön bilgisi yoktur.** Straddle hareketin büyüklüğünü fiyatlar, yönünü değil. Yön konusunda piyasanın bir eğilimi varsa o put ile call'un göreli fiyatında (çarpıklıkta) görünür, beklenen hareket sayısında değil.

::: dikkat Olasılık Değil, Fiyat
Örtük oynaklık bir tahmin değil, bir fiyattır ve içinde bir **risk primi** taşır: opsiyon satanlar belirsizliği üstlenmek için ücret ister. Bu yüzden örtük oynaklık uzun dönemde genellikle gerçekleşen oynaklıktan biraz yüksektir. Ayrıca normal dağılım varsayımı uç hareketleri olduğundan az gösterir; "%68 ihtimalle bu aralıkta" cümlesi bir kaba ölçüdür, bir garanti değil.
:::

::: ozet Özet
Opsiyon piyasası her olayın önünde bir hareket büyüklüğü fiyatlar ve bunu okumak için opsiyon almak gerekmez: ATM straddle'ı fiyata bölmek yeter. Bir hareketin büyük mü küçük mü olduğunu anlamak için onu sıfıra değil, **fiyatlanan harekete** göre ölçmek gerekir.
:::

## Bu Sitede Nerede Görürsün

Bu sitede opsiyon zinciri yok. Piyasa geneli için aynı ölçünün hazır hâli olan VIX, [Piyasalar](/piyasalar) ekranında durur. Bilanço tarihlerini [Bilançolar](/bilancolar) ekranından, açıklama sonrası hareketi hisse sayfasından takip edebilirsin.`,
  },

  /* ==== 3 · Şirketi Okumak ================================================ */

  /* ---------------------------------------------------------------------- */
  "bilanco": {
    title: "Bilanço Nedir, Nasıl Okunur?",
    dek: "Üç ayda bir açılan kapak — ve piyasanın gerçekten baktığı üç satır.",
    bodyMd: `Halka açık şirketler üç ayda bir hesap verir. Türkçede hepsine "bilanço" denir; teknik olarak açıklanan şey bir bilanço tablosundan ibaret değildir, çeyrek sonuçlarının tamamıdır.

::: tanim Çeyrek Sonuçları
Şirketin üç aylık dönemde ne kadar sattığını (**gelir**), bundan geriye ne kadar kâr kaldığını (**net kâr**) ve bunun hisse başına kaç dolara denk geldiğini (**EPS**) açıklaması. Yanında genellikle bir de **guidance** verilir: gelecek çeyrek ve yıl için şirketin kendi beklentisi.
:::

## Piyasanın Baktığı Üç Satır

**1. Gelir (revenue).** Toplam satış. Marjlardan ve muhasebeden bağımsızdır, bu yüzden en zor manipüle edilen sayıdır. Büyüme oranı, geçen yılın aynı çeyreğiyle karşılaştırılır.

**2. EPS (hisse başına kâr).** Net kârın hisse sayısına bölünmüş hâli. Bir hissenin o dönemde ne kadar kâr ürettiğini gösterir.

**3. Guidance.** Şirketin gelecek dönem için kendi beklentisi. **Çoğu gün en önemlisi budur.** Geçmiş çeyrek harika olup guidance zayıf geldiğinde hisse sert düşer; tersi de olur.

::: dikkat "Beklentiyi Tutturdu" Ne Demek
Analistler her çeyrek için bir konsensüs beklentisi yayımlar. Piyasayı hareket ettiren şey mutlak rakam değil, **beklentiden sapmadır** (surprise). Kârı %40 artan bir şirket, piyasa %55 beklediği için düşebilir. Fiyat, gerçekleşene değil, gerçekleşen ile beklenenin farkına tepki verir.
:::

## Dört Olasılık

| Gelir | EPS | Tipik tepki |
|---|---|---|
| Tuttu | Tuttu | Guidance ne dedi, ona bakılır |
| Iskaladı | Tuttu | Kötü — kâr maliyet kısarak yapılmış olabilir |
| Tuttu | Iskaladı | Marj sorunu — sorgulanır |
| Iskaladı | Iskaladı | Sert satış |

İkinci satır çoğu kişiyi şaşırtır: kârı tutturup geliri ıskalayan şirket sık sık satılır. Sebep şudur — maliyet kısarak kâr yapmanın bir sınırı vardır, satış büyümesinin yoktur.

## Ne Zaman Açıklanır

| Zamanlama | Kısaltma | Anlamı |
|---|---|---|
| Açılış öncesi | BMO (*before market open*) | Seans başlamadan, genellikle 07:00–09:00 NY |
| Kapanış sonrası | AMC (*after market close*) | Seans bittikten sonra, genellikle 16:05–16:30 NY |

Büyük şirketlerin çoğu kapanış sonrasını tercih eder: piyasa kapalıyken haber sindirilsin, telekonferans yapılsın, ertesi sabah fiyat oluşsun diye. Bu yüzden bir hissenin bilanço tepkisi çoğunlukla **ertesi günün açılışında** görünür ve gün içi grafikte büyük bir gap olarak durur.

::: ornek Telekonferans
Sayılar yayımlandıktan yaklaşık bir saat sonra yönetim analistlerle telekonferans yapar. Rakamlar iyi olup hisse toplantı sırasında düşüyorsa, sebep neredeyse her zaman sözlü guidance'tır: bir yöneticinin "önümüzdeki çeyrekte talepte normalleşme bekliyoruz" cümlesi, tablodaki hiçbir sayının anlatmadığı bir hikâye anlatır.
:::

## Üç Tablo

Tam raporda üç tablo bulunur ve üçü farklı soruya cevap verir:

| Tablo | Cevapladığı soru |
|---|---|
| **Gelir tablosu** | Dönemde ne kadar kazandı? |
| **Bilanço** | Bugün neyi var, neye borçlu? |
| **Nakit akışı** | Kasaya gerçekten ne kadar para girdi? |

Üçüncüsü en az okunan ama en zor süslenen tablodur. Kâr muhasebe kurallarına göre hesaplanır; nakit akışı ise gerçekten yaşanan para hareketidir. Kârı büyüyüp nakit akışı zayıflayan bir şirket, çoğu zaman ilk uyarı işaretini burada verir.

## Bu Sitede Nerede Görürsün

- **[Bilançolar](/bilancolar)** ekranı: gün gün takvim, açılış öncesi / kapanış sonrası etiketiyle. Kartlarda gelir beklentisi, EPS beklentisi ve şirketin piyasa değeri birlikte durur — büyüklüğü bilmeden rakamın anlamı eksik kalır.
- **Hisse sayfası → Geçmiş Bilançolar:** açıklanan EPS ile beklenen EPS yan yana; sapma yüzdesi hesaplı.
- **Bugünün Akışı:** o gün bilanço açıklayan şirketler, ekonomik verilerle aynı zaman ekseninde.`,
  },

  /* ---------------------------------------------------------------------- */
  "bilanco-gunu-nasil-okunur": {
    title: "Bilanço Günü Nasıl Okunur?",
    dek: "Rekor kâr açıklayan hissenin neden düştüğü — beklenti, sapma ve rehberlik üçlüsü.",
    bodyMd: `Bir şirket tarihinin en yüksek kârını açıklar ve hisse %9 düşer. Bu, bilanço günlerinin en sık sorulan sorusudur ve cevabı tek cümlededir: **fiyat sayıya değil, sayının beklentiden sapmasına tepki verir.**

[Bilanço yazısı](/rehber/bilanco) tabloların kendisini okumayı anlatıyor. Bu yazı açıklama gününü okumayı anlatıyor — ikisi farklı iş.

::: tanim Konsensüs (Beklenti)
Şirketi takip eden analistlerin tahminlerinin ortalaması. Hisse fiyatı, açıklamadan önce zaten bu beklentiyi içinde taşır. Yani ödediğin fiyat "şirket kâr edecek" bilgisini değil, **"şirket şu kadar kâr edecek" bilgisini** satın alır.
:::

## Üç Sayı, Üç Zaman

Bir bilanço açıklaması aslında üç ayrı bilgi taşır ve üçü farklı zamanlara bakar:

| | Neyi söyler | Zamanı |
|---|---|---|
| **Gelir** | Ne kadar sattı | Geçmiş çeyrek |
| **Hisse başı kâr (EPS)** | Satıştan geriye ne kaldı | Geçmiş çeyrek |
| **Rehberlik (guidance)** | Şirket önümüzdeki dönem için ne bekliyor | **Gelecek** |

Fiyat tepkisinin büyük kısmını üçüncü satır belirler. Geçmiş çeyrek, açıklandığı anda artık bilinen bir şeydir; hisse ise geleceğin fiyatıdır. Rehberliği düşüren bir şirket, rekor bir çeyrek açıklamış olsa bile hissesini düşürür.

::: ornek Rekor Kâr, Düşen Hisse
Beklenti: hisse başı 2,40 dolar kâr, 8,1 milyar dolar gelir.
Açıklanan: hisse başı **2,55 dolar**, gelir **8,4 milyar dolar** — ikisi de beklentinin üstünde, ikisi de şirket tarihinin rekoru.
Rehberlik: gelecek çeyrek için 8,0-8,2 milyar dolar gelir. Piyasanın beklediği 8,7 milyardı.
Sonuç: hisse düşer. Açıklanan çeyrek iyiydi ama fiyatın içinde zaten iyisi vardı; değişen şey **gelecek çeyreğin daha kötü olacağı bilgisiydi.**
:::

## Sapmanın Büyüklüğü Değil, Yönü Bile Yetmez

"Beklentiyi aştı" cümlesi tek başına bir şey söylemez, çünkü sapmanın kendisi de beklenir. Şirketlerin çoğu düzenli olarak beklentiyi küçük farklarla aşar — bu bir başarı göstergesi değil, beklenti yönetiminin sonucudur: rehberlik ihtiyatlı verilir, aşmak kolaylaşır.

Bu yüzden asıl bakılacak yer sapmanın **büyüklüğü** ve **kaynağıdır**:

- Kâr beklentiyi aştı ama gelir aşmadıysa, fark maliyet kısıntısından geliyor olabilir. Maliyet kısmak sürdürülebilir bir büyüme kaynağı değildir.
- Kâr, tek seferlik bir kalemden (varlık satışı, vergi düzeltmesi) geliyorsa operasyonel değildir.
- Gelir aştı ama kâr marjı daraldıysa, şirket büyümeyi indirimle satın alıyor olabilir.

## Düzeltilmiş mi, GAAP mi

Şirketler iki kâr rakamı yayımlar: yasal standarda göre hesaplanan (**GAAP**) ve şirketin "olağandışı" saydığı kalemleri çıkardığı (**düzeltilmiş / non-GAAP**). Manşetlerde genellikle ikincisi geçer, çünkü daha yüksektir.

::: dikkat Her Yıl Tekrarlayan "Tek Seferlik"
Düzeltilmiş rakam yararlıdır: gerçekten olağandışı bir dava tazminatını çıkarmak makuldür. Sorun, aynı kalemin her çeyrek "tek seferlik" diye çıkarılmasıdır. Hisse bazlı ödeme (SBC) bunun klasik örneğidir — çalışana hisse vermek gerçek bir maliyettir ve her çeyrek tekrarlar.
Pratik ölçü: iki rakam arasındaki fark birkaç çeyrektir aynı büyüklükteyse, o kalem "olağandışı" değildir.
:::

## Konferans Görüşmesi

Sayılar açıklandıktan sonra yönetim analistlerle telefonda konuşur ve fiyatın en sert hareketi çoğu zaman **burada** olur. Sebebi şudur: tablodaki sayılar tek bir çeyreği anlatır, görüşmedeki cümleler yönü anlatır. "Talepte yumuşama görüyoruz" cümlesi hiçbir tabloda yazmaz ama tablodaki her sayıdan daha fazla fiyat oynatır.

## Volatilite Neden Şişer

Bilanço öncesinde opsiyon primleri şişer, açıklamadan sonra söner. [Opsiyon yazısındaki](/rehber/opsiyonlar) *volatility crush* budur: belirsizlik bitince belirsizliğin fiyatı da biter. Pratik sonucu, bilanço gecesinin hisse için de en oynak gece olmasıdır — [seans dışı](/rehber/borsa-nasil-isler) işlemlerde %10'luk hareketler olağandır ve o fiyatlar ince hacimde oluşur.

::: ozet Özet
Bilanço günü üç soruyla okunur: **Beklenti neydi? Sapma nereden geldi? Şirket gelecek için ne dedi?** Üçüncüsü ilk ikisinden daha önemlidir çünkü hisse geçmişin değil geleceğin fiyatıdır. "Rekor kâr" manşeti tek başına hiçbir şey söylemez — rekorun beklenip beklenmediğini söylemez.
:::

## Bu Sitede Nerede Görürsün

Bu sitenin bilanço tarafı tam olarak bu üçlü üzerine kurulu:

- [Bilanço takvimi](/bilancolar) hangi şirketin ne zaman açıklayacağını gösterir; saat kesin verilmiyorsa "~" ile ve pencere adıyla yazılır ("~23:00 · kapanış sonrası").
- [Bilanço analizlerinde](/bilancolar/analizler) her kayıt beklenti-gerçekleşme farkını ve rehberliği ayrı ayrı taşır; gelir sütun grafiğindeki kesikli çerçeveli son sütun **öngörüdür**, gerçekleşmiş sayı değildir.
- Analiz detayında "bilanço gününden bugüne" künyesi, açıklamadan sonra fiyatın ne yaptığını gösterir — sayının kendisi kadar öğreticidir.`,
  },

  /* ---------------------------------------------------------------------- */
  "nakit-akisi": {
    title: "Nakit Akışı: Kârın Arkasını Okumak",
    dek: "Kâr bir görüştür, nakit bir olgudur — ve ikisinin arasındaki fark, tablolardaki en erken uyarı işaretidir.",
    bodyMd: `"Şirket bu çeyrekte 2 milyar dolar kâr etti" cümlesi, kasaya 2 milyar dolar girdiği anlamına gelmez. Kâr, muhasebe kurallarına göre **hesaplanan** bir sayıdır; nakit, banka hesabında **duran** paradır. İkisi çoğu zaman farklıdır ve fark açıldığında önce bakılacak yer nakit akış tablosudur.

::: tanim Nakit Akış Tablosu
Bir dönemde şirketin kasasına gerçekten giren ve çıkan parayı, üç başlık altında gösteren tablo. [Bilanço açıklamasının](/rehber/bilanco) üç tablosundan biridir — en az okunanı ve en zor süslenenidir.
:::

## Üç Bölüm

| Bölüm | Soru | Örnek kalemler |
|---|---|---|
| **İşletme** | İş, para üretiyor mu? | Tahsilatlar, tedarikçi ödemeleri, maaşlar |
| **Yatırım** | Para neye harcanıyor? | Fabrika, ekipman, şirket alımları |
| **Finansman** | Para kimden geliyor, kime dönüyor? | Borçlanma, temettü, hisse geri alımı |

Sağlıklı olgun bir şirketin deseni bellidir: işletme bölümü artı, yatırım bölümü eksi (büyümek para ister), finansman bölümü eksi (temettü ve geri alım hissedara döner). Bu desenden sapma tek başına suç değildir — ama bir sorudur.

## Kâr ile Nakit Neden Ayrışır

Muhasebe, geliri para tahsil edildiğinde değil, **hak edildiğinde** yazar. Üç klasik ayrışma kaynağı:

- **Alacaklar.** Satış faturalandı, kâr yazıldı — ama müşteri henüz ödemedi. Para yok, kâr var.
- **Stok.** Üretilen mal satılana kadar giderleşmez. Depo dolarken nakit erir, kâr etkilenmez.
- **Amortisman.** Beş yıl önce alınan fabrikanın maliyeti her yıl parça parça giderleşir. Bu yıl kârı düşürür ama bu yıl kasadan para çıkarmaz.

::: ornek Aynı Çeyrek, İki Hikâye
Bir yazılım şirketi çeyreği 500 milyon dolar kârla kapattı. Nakit akış tablosunda işletme nakdi yalnızca 80 milyon. Fark nerede? Müşterilere üç yıllık sözleşmeler faturalandı, geliri bu çeyreğe yazıldı — tahsilat gelecek yıllarda. Kâr gerçek, ama **bu çeyreğin parası değil**. Büyüme yavaşlarsa aynı muhasebe bu kez tersine çalışır ve tablo aniden çirkinleşir.
:::

## Serbest Nakit Akışı

En çok kullanılan türev ölçü şudur:

**Serbest nakit akışı (FCF) = işletme nakdi − yatırım harcamaları**

Yani iş, kendini döndürmek için gereken harcamalar yapıldıktan sonra ne bırakıyor. [Temettü](/rehber/temettu) de, hisse geri alımı da, borç ödemesi de bu paradan çıkar. Kârdan çıkmaz — kâr bir hesaptır, temettü nakitle ödenir.

Bu yüzden uzun vadeli değerleme tartışmalarının çoğu F/K'dan değil FCF'den yürür: [değerleme oranının](/rehber/degerleme) paydası süslenebilir, kasaya giren para daha zor süslenir.

## Hisse Bazlı Ödemeler (SBC)

::: dikkat SBC: Nakit Çıkmayan Gerçek Maliyet
Teknoloji şirketleri çalışanlarına hisse dağıtır (*stock-based compensation*). Nakit akış tablosunda bu, nakit çıkışı olmadığı için işletme nakdine geri eklenir — ve serbest nakit akışını olduğundan güzel gösterir. Ama maliyet gerçektir: yeni hisse basıldıkça senin payın **sulanır**. FCF'si güçlü görünen bir şirkette SBC'nin büyüklüğüne bakmadan karar verme; bazı şirketlerde FCF'nin yarısına ulaşır.
:::

## Uyarı İşaretleri

Tek çeyrek desen bozan her şirket sorunlu değildir; işaretler **eğilim** olarak izlenir:

1. **Kâr büyüyor, işletme nakdi büyümüyor.** En klasik erken sinyal — büyüyen fark her çeyrek daha çok açıklama ister.
2. **Alacaklar satıştan hızlı büyüyor.** Satış "yapılmış" ama para gelmiyor; agresif fatura kesiminin izidir.
3. **Her çeyrek "tek seferlik" bir kalem.** Tek seferlik olay yılda bir olur; her çeyrek oluyorsa adı tek seferlik değildir.
4. **Temettü ve geri alım borçla dönüyor.** Finansman bölümünde borç artarken hissedara para dağıtılıyorsa, dağıtılan para kazanılmamış demektir.

::: ozet Özet
Kâr bir görüştür, nakit bir olgudur. İkisi uzun süre aynı yönde gitmiyorsa doğruyu söyleyen genellikle nakittir — çünkü muhasebe tercihi yorumlanabilir ama banka hesabı yorumlanamaz. Bir şirketi ciddi olarak değerlendiriyorsan gelir tablosuyla başla, nakit akışıyla bitir.
:::

## Bu Sitede Nerede Görürsün

Bu sitede bilanço günü **EPS ve gelir** beklenti/gerçekleşme olarak durur ([Bilançolar](/bilancolar) ekranı ve hisse sayfası); nakit akış tablosunun kendisi gösterilmez. Tablonun aslı, şirketin yatırımcı ilişkileri sayfasında ve SEC dosyalarında (10-Q, 10-K) yayımlanır — bu yazının işi, o dosyayı açtığında hangi üç satıra bakacağını bilmen.`,
  },

  /* ---------------------------------------------------------------------- */
  "degerleme": {
    title: "F/K ve Değerleme Oranları",
    dek: "Bir hissenin pahalı mı ucuz mu olduğunu fiyatına bakarak anlayamazsın.",
    bodyMd: `20 dolarlık bir hisse, 400 dolarlık bir hisseden ucuz değildir. Fiyat tek başına hiçbir şey söylemez; şirketin ürettiği kazanca oranlandığında söylemeye başlar.

::: tanim F/K Oranı (P/E)
Hisse fiyatının, hisse başına kâra bölümü. "Şirketin bir yıllık kârı için kaç yıllık fiyat ödüyorum" sorusunun cevabıdır. F/K 25 demek, bugünkü kâr sabit kalırsa yatırımın kendini 25 yılda amorti etmesi demektir.
:::

## Neden Fiyat Değil Oran

::: ornek İki Şirket
A şirketi: hisse 20 dolar, hisse başına yıllık kâr 0,50 dolar → F/K **40**.
B şirketi: hisse 400 dolar, hisse başına yıllık kâr 40 dolar → F/K **10**.
Ekranda A ucuz görünür. Kazanç başına ödediğin fiyata bakıldığında B, A'dan dört kat ucuzdur.
:::

## Başlıca Oranlar

| Oran | Formül | Ne zaman kullanışlı |
|---|---|---|
| **F/K** | Fiyat ÷ hisse başına kâr | Kârlı, olgun şirketler |
| **İleri F/K** | Fiyat ÷ beklenen kâr | Büyüyen şirketler |
| **PD/DD** | Piyasa değeri ÷ defter değeri | Bankalar, varlık ağırlıklı şirketler |
| **F/S** | Fiyat ÷ satış | Henüz kâr etmeyen şirketler |
| **FD/FAVÖK** (EV/EBITDA) | Firma değeri ÷ FAVÖK | Borçlu şirketleri karşılaştırırken |
| **PEG** | F/K ÷ büyüme oranı | Büyüme hızını fiyata katmak için |

Son satır faydalıdır: F/K'sı 40 olan ama yılda %50 büyüyen bir şirket, F/K'sı 15 olup hiç büyümeyen bir şirketten pahalı olmayabilir.

## Yüksek F/K Ne Anlatır

İki şeyden biri:

1. Piyasa bu şirketin kârının hızla büyümesini bekliyor.
2. Piyasa fazla iyimser.

Hangisi olduğunu oran söylemez. Söyleyen tek şey zamandır. Bu yüzden değerleme bir karar değil, bir **soru** üretir: *bu fiyatı haklı çıkaracak büyümenin gerçekleşme ihtimali nedir?*

::: dikkat Düşük F/K Ucuzluk Değildir
En düşük F/K'lı hisseler çoğu zaman en riskli olanlardır — piyasa kârın düşeceğini beklediği için fiyat düşüktür. Bir sektör yapısal olarak gerilerken F/K'nın düşmesi normaldir. Buna *değer tuzağı* (value trap) denir: ucuz görünen şey, ucuz olduğu için değil kârı eridiği için ucuzdur.
:::

## Karşılaştırma Kuralları

Bir F/K oranı tek başına anlamsızdır. Anlamlı olması için üç karşılaştırma gerekir:

- **Kendi sektörüyle.** Yazılım şirketinin F/K'sı bankanınkiyle karşılaştırılmaz.
- **Kendi geçmişiyle.** Şirket son beş yılda hangi bantta işlem gördü?
- **Kendi büyümesiyle.** Büyüme yavaşlarken çarpanın korunmasını beklemek gerçekçi değildir.

## Muhasebe Kârı ile Nakit

F/K'nın paydası muhasebe kârıdır ve muhasebe kârı, gerçekten kasaya giren paradan farklı olabilir. Tek seferlik kalemler (dava tazminatı, varlık satışı, yeniden yapılanma) bir çeyreğin kârını şişirip F/K'yı yapay olarak ucuz gösterebilir.

Bu yüzden ciddi bir değerlendirme nakit akışına da bakar. Kârı büyürken serbest nakit akışı zayıflayan şirket, çoğu zaman ilk uyarı sinyalini oradan verir.

::: ozet Özet
Değerleme oranı bir cevap değil, kısayoldur. "Bu fiyat hangi geleceği varsayıyor?" sorusunu sormanı sağlar. O geleceğin gerçekleşip gerçekleşmeyeceğine karar vermek, oranın işi değil senin işindir.
:::

## Bu Sitede Nerede Görürsün

Hisse sayfasındaki **Anahtar Metrikler** kartında F/K, PD/DD ve temettü verimi bir arada durur. [Şirketler](/sirketler) ekranında sektöre göre filtreleyip aynı sektördeki şirketlerin oranlarını yan yana görebilirsin — karşılaştırma ancak böyle anlamlı olur.`,
  },

  /* ---------------------------------------------------------------------- */
  "piyasa-degeri": {
    title: "Piyasa Değeri, Halka Açıklık ve Bölünme",
    dek: "Bir şirketin gerçek büyüklüğü hissenin fiyatında değil, adet ile fiyatın çarpımındadır.",
    bodyMd: `"Bu hisse 8 dolar, çok ucuz" cümlesi ekonomik olarak boş bir cümledir. Bir şirketin ne kadara satın alındığını hisse fiyatı değil, **piyasa değeri** söyler.

::: tanim Piyasa Değeri (Market Cap)
Hisse fiyatı × toplam hisse adedi. Şirketin tamamının borsadaki fiyat etiketidir.
:::

## Neden Fiyat Yanıltıcı

Hisse adedi tamamen şirketin kendi tercihidir. Aynı büyüklükteki iki şirketten biri sermayesini 100 milyon parçaya, diğeri 10 milyar parçaya bölmüş olabilir. Birinci şirketin hissesi 400 dolar, ikincisininki 4 dolar görünür — ikisi de aynı büyüklükte olabilir.

::: ornek Aynı Şirket, Farklı Etiket
Piyasa değeri 40 milyar dolar olan bir şirket:
· 100 milyon hisseye bölünmüşse → hisse 400 dolar
· 10 milyar hisseye bölünmüşse → hisse 4 dolar
Şirket her iki durumda da aynı şirkettir, aynı kârı üretir, aynı borcu taşır.
:::

## Ölçek Sınıfları

| Sınıf | Piyasa değeri | Karakter |
|---|---|---|
| Mega ölçek | 200 milyar dolar üstü | Endeksi tek başına hareket ettirir |
| Büyük ölçek | 10–200 milyar | S&P 500'ün gövdesi |
| Orta ölçek | 2–10 milyar | Büyüme ile olgunluk arasında |
| Küçük ölçek | 300 milyon – 2 milyar | Oynak, Russell 2000'in alanı |
| Mikro ölçek | 300 milyon altı | Likidite sorunlu, dikkat ister |

Ölçek yalnızca bir büyüklük etiketi değil, bir risk tanımıdır: küçüldükçe volatilite artar, spread genişler ve tek bir haberin fiyat üzerindeki etkisi büyür.

## Halka Açıklık Oranı (Float)

Toplam hisse adedinin hepsi piyasada dolaşmaz. Kurucuların, çalışanların ve kilitli paketlerin dışında kalan kısma **float** denir.

Float küçükse aynı büyüklükteki bir alım fiyatı daha çok hareket ettirir. Yeni halka açılan şirketlerde ilk aylarda görülen sert hareketlerin en büyük sebebi budur; lock-up süresi dolduğunda arz aniden artar ve fiyat baskı görür.

## Bölünme ve Ters Bölünme

**Bölünme (split):** Şirket her hisseyi birkaç parçaya böler. 900 dolarlık hisse 3'e bölünürse 300 dolar olur, elindeki adet üçe katlanır. Portföyünün değeri değişmez.

Amaç ekonomik değil psikolojiktir: fiyat daha erişilebilir görünsün, likidite artsın.

**Ters bölünme (reverse split):** Hisse adedi azaltılır, fiyat yükselir. Genellikle borsanın asgari fiyat kuralına takılmamak için yapılır ve çoğu zaman iyi bir işaret değildir.

::: dikkat Bölünme Bir Değer Yaratmaz
"Bölünme yapacak, alalım" düşüncesi yaygındır ve ekonomik dayanağı yoktur. Pizzayı dört yerine sekiz dilime bölmek pizzayı büyütmez. Bölünme sonrası görülen kısa süreli yükselişler, olayın kendisinden değil, olayın çektiği ilgiden gelir.
:::

## Firma Değeri (Enterprise Value)

Piyasa değeri şirketin özkaynağının fiyatıdır; borcunu içermez. Şirketi tamamen satın almak isteseydin borcunu da üstlenirdin.

**Firma değeri = piyasa değeri + net borç**

Borçlu iki şirketi karşılaştırırken firma değeri, piyasa değerinden daha dürüst bir ölçüdür. Aynı piyasa değerine sahip iki şirketten borçlu olanı, gerçekte daha pahalıdır.

## Bu Sitede Nerede Görürsün

Piyasa değeri hem hisse sayfasındaki metrik kartında hem de [Bilançolar](/bilancolar) ekranındaki kartlarda görünür. Bilanço kartında bilinçli olarak duruyor: "gelir beklentisi 2 milyar dolar" cümlesinin anlamı, şirketin 20 milyar mı yoksa 2 trilyon mu değerinde olduğunu bilmeden eksik kalır.`,
  },

  /* ---------------------------------------------------------------------- */
  "temettu": {
    title: "Temettü Nedir?",
    dek: "Şirketin kârını hissedarla paylaşması — ve bunun bedava para olmadığı gerçeği.",
    bodyMd: `Bir şirket kâr ettiğinde iki seçeneği vardır: parayı işine geri koymak ya da hissedarına dağıtmak. İkincisinin adı **temettü**dür.

::: tanim Temettü (Dividend)
Şirketin kârının bir kısmını, sahip olunan hisse başına nakit olarak hissedarlara dağıtması. ABD'de genellikle üç ayda bir ödenir; Avrupa'da çoğunlukla yılda bir veya iki kez.
:::

## Verim Nasıl Hesaplanır

**Temettü verimi = yıllık temettü ÷ hisse fiyatı**

Hissesi 100 dolar olan ve yılda 3 dolar dağıtan bir şirketin verimi %3'tür.

::: dikkat Yüksek Verim İyi Haber Olmayabilir
Formülün paydası fiyattır. Hisse yarıya düştüğünde verim ikiye katlanır — şirket hiçbir şey yapmasa bile. Alışılmadık derecede yüksek bir verim çoğu zaman piyasanın "bu temettü sürdürülemez" dediği anlamına gelir. Buna *temettü tuzağı* denir ve kesinti geldiğinde hem gelir hem sermaye kaybedilir.
:::

## Dört Tarih

| Tarih | Ne olur |
|---|---|
| Açıklama (declaration) | Şirket tutarı ve takvimi duyurur |
| **Ex-dividend (temettüsüz işlem)** | Bu günden itibaren alan temettüyü ALAMAZ |
| Kayıt (record) | Hissedar listesi dondurulur |
| Ödeme (payment) | Para hesaba geçer |

En kritik olanı ikincisidir. Ex-dividend gününün sabahında hisse, dağıtılacak tutar kadar **düşük açar**. Bu bir satış dalgası değil, muhasebedir: 3 dolar dağıtacak bir şirketin kasasında artık 3 dolar daha az vardır.

> Temettü bedava para değildir. Şirketin senin cebine aktardığı kendi öz sermayesidir.

Bunu anlamak, "temettü gününden bir gün önce alıp ertesi gün satarım" fikrinin neden işlemediğini de açıklar.

## Kim Dağıtır, Kim Dağıtmaz

**Dağıtanlar:** Olgun, nakit üreten, büyüme fırsatı sınırlı şirketler — kamu hizmetleri, büyük gıda ve içecek markaları, telekom, bankalar, sigorta.

**Dağıtmayanlar:** Büyüyen şirketler. Yılda %30 büyüyen bir şirket için kârı işe geri koymak, hissedara dağıtmaktan daha değerlidir. Teknoloji tarafında temettü ödemeye başlamak çoğu zaman "artık olgunlaştık" mesajı olarak okunur ve bazı yatırımcılar için iyi, bazıları için kötü haberdir.

::: ornek Geri Alım (Buyback)
ABD'de şirketler kâr paylaşımını sık sık temettü yerine **hisse geri alımıyla** yapar: piyasadan kendi hissesini toplar ve iptal eder. Hisse sayısı azaldığı için kalan her hissenin payı büyür; EPS artar. Ekonomik olarak temettüye benzer, vergisel olarak farklıdır ve — temettünün aksine — sessizce durdurulabilir.
:::

## Toplam Getiri

Bir hisseden kazancın iki bileşeni vardır:

1. **Sermaye kazancı:** Fiyatın yükselmesi.
2. **Temettü getirisi:** Dağıtılan nakit.

İkisinin toplamına **toplam getiri** denir. Endeks grafiklerinin çoğu yalnızca fiyatı gösterir; temettüler yeniden yatırıldığında uzun dönem farkı büyüktür. Onlarca yıllık ölçekte S&P 500'ün toplam getirisinin kayda değer bir kısmı temettülerden gelir. "Endeks 20 yılda şu kadar yükseldi" cümlesi, gerçek getiriyi olduğundan düşük anlatır.

## Bu Sitede Nerede Görürsün

Hisse sayfasındaki **Anahtar Metrikler** kartında temettü verimi yer alır. Verimi yorumlarken şirketin sektörüne bakmak gerekir: bir kamu hizmeti şirketi için %4 normal, bir yazılım şirketi için aynı sayı sorulacak bir sorudur.`,
  },

  "hisse-geri-alimi": {
    title: "Hisse Geri Alımı (Buyback) Nedir?",
    dek: "Şirketin kendi hissesini satın alması — pastayı büyütmeden dilimi büyütmek.",
    bodyMd: `Bir şirketin kazandığı parayı hissedara döndürmesinin iki yolu vardır. Birincisi [temettü](/rehber/temettu): parayı doğrudan hesabına yatırır. İkincisi geri alım: parayı sana vermez, **kendi hissesini piyasadan satın alıp iptal eder.**

İkincisi ilk bakışta tuhaf görünür — sana bir şey verilmiyor. Ama pay sayısı azaldığı için elindeki hissenin şirketteki oranı büyür. Pasta aynıdır, dilim büyür.

::: tanim Hisse Geri Alımı (Buyback)
Şirketin kendi hisselerini borsadan satın alması. Alınan hisseler genellikle iptal edilir ya da hazinede tutulur; her iki durumda da dolaşımdaki pay sayısı azalır. Hissedar bir ödeme almaz, sahip olduğu **oran** artar.
:::

## EPS Neden Yükselir

Hisse başı kâr basit bir kesirdir: net kâr bölü pay sayısı. Geri alım paydayı küçültür — kâr hiç artmasa bile EPS yükselir.

::: ornek Aynı Kâr, Yüksek EPS
Net kâr: 1 milyar dolar. Pay sayısı: 500 milyon. EPS = **2,00 dolar**.
Şirket 25 milyon hisse geri alır (pay sayısının %5'i). Yeni pay sayısı: 475 milyon.
Kâr değişmedi, hâlâ 1 milyar dolar. Yeni EPS = 1.000 / 475 = **2,11 dolar**.
Manşet: "hisse başı kâr %5,5 arttı". Şirketin işi bir gram büyümedi.
:::

Bu, geri alımın en çok istismar edilen yanıdır. Yönetici primleri sıklıkla EPS hedefine bağlıdır ve geri alım, işi büyütmeden o hedefi tutturmanın en kısa yoludur. [Bilanço okurken](/rehber/bilanco) bu yüzden EPS'in yanında **net kârın kendisine** ve **pay sayısının seyrine** bakmak gerekir: EPS artarken net kâr yatay ya da düşüyorsa büyüme yoktur, muhasebe vardır.

## Temettüyle Farkı

| | Temettü | Geri Alım |
|---|---|---|
| Hissedara etkisi | Nakit gelir | Oran artışı |
| Vergi | Dağıtım anında | Sen satana kadar yok |
| Esneklik | Kesmek kötü sinyal | Sessizce durdurulabilir |
| Fiyat duyarlılığı | Yok | **Yüksek** |

Son satır en önemlisidir. Temettü fiyattan bağımsızdır; geri alımda ise şirket bir alıcıdır ve **ne fiyattan aldığı belirleyicidir.** Ucuzken alınan geri alım hissedara değer katar, pahalıyken alınan değer yakar. Bu, şirketin sermaye dağıtımıyla ilgili en somut sınavıdır.

::: dikkat Zirvede Alım
Şirketler geri alımı en çok, kasaları en dolu olduğunda yapar: yani iş iyi giderken, yani hisse pahalıyken. Kriz geldiğinde nakde ihtiyaç duyulur ve geri alım tam da hisse ucuzken durdurulur.
Sonuç, bireysel yatırımcının klasik hatasının kurumsal versiyonudur: yüksekten al, düşükte alma. 2020 ve 2022'de birçok büyük şirket bu sırayı birebir uyguladı. Geri alım duyurusunu iyi haber saymadan önce **hangi fiyattan alındığına** bak.
:::

## Duyuru Alım Değildir

Şirketler "10 milyar dolarlık geri alım programı" açıklar. Bu bir **yetkidir**, taahhüt değil: yönetim kurulu izin verir, şirket dilerse kullanır, dilerse yıllar boyunca kısmen kullanır. Duyurulan tutarla gerçekleşen tutar sık sık ayrışır.

Gerçekleşeni görmek için nakit akış tablosuna bakılır — [nakit akışı yazısındaki](/rehber/nakit-akisi) finansman faaliyetleri bölümünde "hisse geri alımı" satırı, o çeyrekte fiilen harcanan parayı gösterir. Duyuru manşettedir, gerçekleşme tablodadır.

## Seyreltmeyi Kapatan Geri Alım

Teknoloji şirketlerinde sık görülen bir durum: şirket çalışanlarına hisse verir (SBC), bu pay sayısını artırır, sonra geri alımla o artışı kapatır. Dışarıdan "hissedara değer dönüyor" gibi görünür ama fiilen olan şey, çalışan maaşının nakit yerine hisseyle ödenip faturanın geri alımla kapatılmasıdır.

Ayırt etmenin yolu basittir: **pay sayısı gerçekten azalıyor mu?** Milyarlarca dolarlık geri alıma rağmen pay sayısı yatay duruyorsa, o geri alım hissedara değer döndürmüyor, seyreltmeyi gizliyordur.

::: ozet Özet
Geri alım nötr bir araçtır; iyi ya da kötü olmasını fiyat belirler. Üç soruyla okunur: **Pay sayısı gerçekten azaldı mı? Hangi değerlemeden alındı? Para nereden geldi — nakit akışından mı, borçtan mu?** Üçünün cevabı iyiyse geri alım temettüden bile verimli bir dağıtımdır. Kötüyse, EPS grafiğini güzelleştiren pahalı bir kozmetiktir.
:::

## Bu Sitede Nerede Görürsün

[Bilanço analizlerinde](/bilancolar/analizler) hisse başı kâr ile net kârın birlikte verilmesinin sebebi budur: ikisi ayrıştığında aradaki farkı pay sayısı açıklar. [Değerleme](/rehber/degerleme) ve [piyasa değeri](/rehber/piyasa-degeri) yazılarındaki F/K hesabı da geri alımdan doğrudan etkilenir — payda küçülünce oran, şirket hiç değişmeden düşer.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: SEC, "Investor Bulletin: How to Read a 10-K/10-Q" ve Form
     10-K / 10-Q genel talimatları (madde numaraları). Başvuru süreleri
     SEC Regulation S-K / Exchange Act kural 13a-1 ve 13a-13: büyük
     hızlandırılmış (halka açık değer ≥ 700 M $) 60/40 gün, hızlandırılmış
     (75-700 M $) 75/40 gün, diğerleri 90/45 gün. Bilanço basın bülteni
     Form 8-K Madde 2.02 ile verilir; GAAP dışı ölçüler Regulation G.
     Yabancı şirketler 20-F / 6-K. EDGAR tam metin araması sec.gov. */
  "10k-10q": {
    title: "10-K ve 10-Q Nasıl Okunur?",
    dek: "Şirketin kendi imzasıyla SEC'e verdiği rapor, basın bülteninin anlatmadığını anlatır; yüz sayfanın hangi beşinin önemli olduğu.",
    bodyMd: `Bilanço günü haberlere düşen sayılar bir **basın bülteninden** gelir. Şirketin asıl raporu ise birkaç gün ya da hafta sonra, SEC'e verilen ve çoğu zaman yüz sayfayı aşan bir belgedir: yıllık rapor **10-K**, çeyrek raporu **10-Q**. Kimse onları baştan sona okumaz; okunması gereken yer bellidir.

::: tanim Bu Yazıdaki Terimler
**10-K:** Yıllık rapor. Bağımsız denetimden geçmiş finansal tabloları, işin tanımını ve risk faktörlerini içerir.
**10-Q:** İlk üç çeyreğin raporu. Finansal tablolar denetlenmez, yalnızca sınırlı incelemeden geçer. Dördüncü çeyreğin ayrı 10-Q'su yoktur; o dönem 10-K'nın içindedir.
**EDGAR:** SEC'in, şirketlerin bütün resmî başvurularını ücretsiz yayımladığı veri tabanı.
:::

## Belgeyi Bulmak

EDGAR'da şirketin adını ya da sembolünü arat, başvuru listesini form türüne göre süz. Aynı raporlar şirketin yatırımcı ilişkileri sayfasında da bulunur. Süreler şirketin büyüklüğüne bağlıdır:

| Şirket Sınıfı | 10-K Süresi | 10-Q Süresi |
|---|---|---|
| **Büyük Hızlandırılmış** (halka açık değer 700 milyon $ üstü) | Yıl sonundan 60 gün | Çeyrek sonundan 40 gün |
| **Hızlandırılmış** (75-700 milyon $) | 75 gün | 40 gün |
| **Diğerleri** | 90 gün | 45 gün |

Yabancı şirketler bunların yerine yıllık **20-F** ve dönemsel **6-K** verir. Ayrıntı: [ADR ve SPAC Nedir?](/rehber/adr-spac)

## Okuma Sırası

::: akis Yüz Sayfayı Beşe İndirmek
Yönetimin Değerlendirmesi | Madde 7 (10-Q'da Bölüm I, Madde 2)
Finansal Tablolar | Madde 8: gelir, bilanço, nakit akışı
Dipnotlar | Segmentler, borç vadeleri, gelir tanıma
Risk Faktörleri | Madde 1A: geçen yıldan ne değişti
:::

**Yönetimin değerlendirmesi (MD&A)** raporun anlatı bölümüdür: gelirin neden değiştiği, marjı neyin sıktığı, nakdin nereye gittiği. Yönetim burada rakamları kendi diliyle açıklar ve açıklamak zorunda olduğu eğilimleri yazar.

**Finansal tablolar** üç tanedir ve üçü birlikte okunur: gelir tablosu kârı, bilanço varlık ve borçları, nakit akışı tablosu gerçek parayı gösterir. Ayrıntı: [Bilanço Nedir, Nasıl Okunur?](/rehber/bilanco) ve [Nakit Akışı](/rehber/nakit-akisi)

**Dipnotlar** raporun en az okunan ve en çok bilgi taşıyan kısmıdır. Gelirin hangi iş kolundan geldiği (segment raporu), borçların ne zaman vadesinin dolduğu, hisse bazlı ödemenin büyüklüğü ve müşteri yoğunlaşması burada yazar.

**Risk faktörleri** her yıl uzar ve çoğu kalıptır. Değerli olan yeni eklenen ya da yeniden yazılan maddelerdir: iki yılın metnini yan yana koymak, şirketin neyi yeni bir risk olarak gördüğünü gösterir.

::: ornek Dipnotta Saklı Olan
Varsayımsal bir şirket gelirini %20 artırdığını açıklıyor. Basın bülteni büyümeyi "güçlü talep"le anlatıyor.
Segment dipnotu ise şunu gösteriyor: büyümenin tamamı tek bir iş kolundan geliyor ve o iş kolunun gelirinin **%45'i tek bir müşteriden**.
Aynı %20, iki farklı risk profili anlatır. Birinde geniş bir talep, diğerinde tek bir sözleşmenin yenilenmesine bağlı bir gelir.
:::

## Basın Bülteni ile Rapor Arasındaki Fark

Bilanço akşamı yayımlanan bülten **8-K** ile SEC'e sunulur ve şirketin öne çıkarmak istediği sayıları taşır. Bunların çoğu GAAP dışı ölçülerdir: hisse bazlı ödemeyi, tek seferlik giderleri ya da satın alma maliyetlerini dışarıda bırakan "düzeltilmiş" kâr gibi. Kurallar şirketin bu ölçüleri GAAP karşılıklarıyla birlikte ve aradaki farkı göstererek vermesini ister.

::: dikkat Bülten 10-Q Değildir
Bülten bir pazarlama belgesidir, yanlış olmak zorunda değildir ama seçicidir. Düzeltilmiş kâr ile GAAP kârı arasındaki fark her çeyrek büyüyorsa, şirketin "tek seferlik" dediği giderler aslında tekrarlayan giderlerdir. Bu farkın izini sürmek için 10-Q'daki mutabakat tablosu gerekir.
:::

## Hızlı Okuma İçin Beş Soru

1. Gelir hangi segmentten büyüdü, hangisinden küçüldü?
2. Faaliyet nakit akışı net kârın üstünde mi, altında mı?
3. Önümüzdeki iki yıl içinde vadesi dolan borç ne kadar?
4. Hisse bazlı ödeme gelirin yüzde kaçı ve hisse sayısı artıyor mu?
5. Risk faktörlerine bu yıl ne eklendi?

::: ozet Özet
10-K ve 10-Q, şirketin sayılarının denetlenmiş ya da incelenmiş ve imzalı hâlidir. Bülten ne olduğunu söyler; rapor nedenini ve bedelini. Beş soruyla okunacak bir 10-Q, bir bilanço gününün manşetlerinden daha fazla bilgi verir.
:::

## Bu Sitede Nerede Görürsün

Hisse sayfasındaki geçmiş bilançolar ve [Bilançolar](/bilancolar) ekranındaki analizler bu raporların sayılarından beslenir. Bir analizde tuhaf görünen bir kalem varsa, kaynağı çoğu zaman 10-Q'nun dipnotlarındadır.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: SEC Regulation FD (Ağustos 2000 kabul, Ekim 2000 yürürlük):
     önemli bilgiyi seçici açıklama yasağı, halka açık çağrı pratiği.
     Private Securities Litigation Reform Act (1995): ileriye dönük beyan
     "güvenli liman" uyarısı. Çağrı yapısı şirketlerin yatırımcı ilişkileri
     sayfalarındaki kayıtlardan. Örnekler varsayımsal. */
  "konferans-gorusmesi": {
    title: "Bilanço Konferans Görüşmesi Nasıl Dinlenir?",
    dek: "Rakamlar bültende; yönetimin onlar hakkında ne düşündüğü ve neyi söylemekten kaçındığı görüşmede.",
    bodyMd: `Bilanço açıklandıktan kısa süre sonra şirketin üst yönetimi analistlerle bir telefon ya da internet görüşmesi yapar. Adı **earnings call**, Türkçesiyle konferans görüşmesi. Rakamlar zaten bültende yazılıdır; görüşmeyi değerli kılan, o rakamların yönetimin ağzından nasıl anlatıldığı ve analistlerin neyi sorduğudur.

## Neden Herkese Açık

ABD'de 2000 yılından beri yürürlükte olan **Regulation FD**, şirketlerin önemli bilgiyi bazı yatırımcılara diğerlerinden önce vermesini yasaklar. Sonuç: analistlerle yapılan görüşme herkesin dinleyebileceği biçimde yayımlanır. Canlı yayın, kaydı ve çoğu zaman yazılı dökümü şirketin yatırımcı ilişkileri sayfasında bulunur.

Kapanıştan sonra açıklama yapan şirketlerin çoğu görüşmeyi aynı akşam, New York saatiyle kapanıştan bir iki saat sonra yapar. Türkiye'den bakınca bu genellikle gece yarısına yakın bir saattir; kayıt ve döküm ertesi sabah okunabilir.

## Görüşmenin Yapısı

::: akis Bir Görüşmenin Sırası
Uyarı | İleriye dönük beyanlar hakkında yasal metin
Hazır Konuşma | CEO işi, CFO sayıları anlatır
Rehberlik | Gelecek çeyrek ve yıl beklentisi
Soru-Cevap | Analistlerin soruları
:::

**Hazır konuşma** önceden yazılmış ve hukukçulardan geçmiş bir metindir. Önemlidir ama sürprizi azdır. **Soru-cevap** bölümü ise hazırlıksızdır; bilginin çoğu buradan çıkar. Dinleyecek vaktin kısıtlıysa doğrudan soru-cevaba geçmek çoğu zaman daha verimlidir.

## Nelere Kulak Verilir

**Rehberliğin değişimi.** Gelecek dönem beklentisi, geçen çeyrekte verilen beklentiyle karşılaştırılarak okunur. Aralığın alt ucu mu yükseltildi, üst ucu mu indirildi? Piyasa çoğu zaman gerçekleşen çeyreğe değil bu değişime tepki verir. Ayrıntı: [Bilanço Günü Nasıl Okunur?](/rehber/bilanco-gunu-nasil-okunur)

**Tekrar eden soru.** Birden fazla analist aynı konuyu farklı kelimelerle soruyorsa, piyasanın o noktada tatmin olmadığı anlaşılır.

**Cevaplanmayan soru.** Yönetim bir soruya rakam vermekten kaçınıp genel bir cümleyle geçiyorsa, bu da bir bilgidir. Özellikle geçen çeyrekte rakam verdiği bir konuda bu kez vermiyorsa.

**Kelime değişimi.** "Güçlü" talebin "sağlıklı" talebe, "hızlanma"nın "istikrar"a dönüşmesi gibi küçük değişiklikler, hazır metinlerin dikkatle seçilen dilinde anlam taşır.

| Duyduğun | Ne Anlama Gelebilir |
|---|---|
| **"Görünürlüğümüz sınırlı"** | Yönetim de bilmiyor; rehberlik geniş ya da temkinli |
| **"Tek seferlik etkiler"** | Hangi etki olduğu ve gerçekten tekrarlamayıp tekrarlamayacağı sorulmalı |
| **"Bu konuda ayrıntı vermiyoruz"** | Önceden veriliyorsa, verilmemesi bir işaret |
| **"Yatırım dönemindeyiz"** | Marj baskısı sürecek; ne zaman biteceğini dinle |

::: ornek Temkinli Bir Kelimenin Fiyatı
Varsayımsal bir şirket beklentilerin üzerinde bir çeyrek açıklıyor; hisse kapanış sonrası %4 yükseliyor. Görüşmede CFO, gelecek çeyrek için müşterilerin sipariş verirken "daha temkinli" davrandığını söylüyor ve rehberliği değiştirmiyor.
Soru-cevap boyunca üç analist aynı temkine geri dönüyor. Görüşme bittiğinde hisse artıdan **eksiye** geçmiş oluyor. Rakamlar değişmedi; değişen, rakamların geleceği hakkında ne söylediğiydi.
:::

::: dikkat Görüşme Sırasındaki Fiyat Hareketi
Görüşme genellikle kapanış sonrası seansta, işlem hacminin düşük ve spread'in geniş olduğu saatlerde yapılır. Bu saatlerdeki sert hareketler ertesi günün açılışını her zaman öngörmez; bir kısmı manşetleri anlık okuyan algoritmaların tepkisidir. Ayrıntı: [Likidite ve Spread](/rehber/spread-likidite)
:::

::: ozet Özet
Bülten ne olduğunu söyler, görüşme yönetimin buna nasıl baktığını. Rehberliğin değişimine, analistlerin ısrar ettiği konulara ve yönetimin rakam vermekten kaçındığı yerlere odaklanmak, bir saatlik kaydı birkaç dakikalık bir bilgiye indirir.
:::

## Bu Sitede Nerede Görürsün

[Bilançolar](/bilancolar) ekranı kimin ne zaman, açılış öncesinde mi kapanış sonrasında mı açıklayacağını Türkiye saatiyle gösterir. Okunmuş çeyreklerin analizleri [Analizler](/bilancolar/analizler) sekmesindedir.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: SEC, T+1 geçişi (28 Mayıs 2024) ve FINRA/NYSE rehberliği:
     T+1 ile hak kesme günü kayıt günüyle aynı iş günü. FINRA Kural 11140
     (b)(2) ve borsa kuralları: hisse değerinin %25'i ve üstündeki
     dağıtımlarda hak kesme, ödeme gününü izleyen iş günü. 2026 takvimi:
     2 Şubat Pazartesi, 12 Şubat Perşembe, 13 Şubat Cuma, 5 Mart
     Perşembe — örnek tarihler varsayımsal bir şirket için. */
  "temettu-takvimi": {
    title: "Temettü Takvimi Nasıl Okunur?",
    dek: "İlan, hak kesme, kayıt ve ödeme: temettüyü almak için hisseyi en geç hangi gün alman gerektiği ve o günün neden bir tuzak olmadığı.",
    bodyMd: `Bir şirket temettü ilan ettiğinde duyuruda dört tarih yazar. Bunlardan yalnızca biri, temettüyü kimin alacağını belirler ve takas süresinin kısalmasıyla birlikte bu tarihin kuralı 2024'te değişti. Temettünün ne olduğu ve neden bedava para olmadığı [Temettü Nedir?](/rehber/temettu) yazısında; bu yazı takvimin kendisini anlatır.

## Dört Tarih

| Tarih | Ne Olur |
|---|---|
| **İlan (Declaration)** | Şirket tutarı ve takvimi duyurur |
| **Hak Kesme (Ex-Dividend)** | Bu günden itibaren alan temettüyü almaz |
| **Kayıt (Record)** | Şirketin hissedar listesi bu gün itibarıyla belirlenir |
| **Ödeme (Payment)** | Para hissedarların hesabına gönderilir |

Temettüyü almak için kayıt gününde hissedar listesinde olmak gerekir. Listeye girmek için hisseyi almak yetmez; işlemin **takası** tamamlanmış olmalıdır. Hak kesme günü bu yüzden vardır: kayıt gününe takası yetişmeyecek ilk alım gününü işaretler.

## T+1 ile Hak Kesme ve Kayıt Aynı Gün

ABD'de takas 28 Mayıs 2024'ten beri **T+1**'dir: işlem ertesi iş günü kesinleşir. Bunun sonucu olarak hak kesme günü artık kayıt günüyle **aynı iş günüdür**. Kural tek cümleye iner:

> Temettüyü almak için hisseyi en geç hak kesme gününden bir önceki iş günü almış olmak gerekir.

::: zaman Varsayımsal Bir Temettünün Takvimi
2 Şubat 2026 | Şirket hisse başına 1 dolar temettü ilan eder.
12 Şubat, Perşembe | **Son alım günü.** Bu gün alınan hissenin takası 13 Şubat'ta tamamlanır; alıcı listeye girer.
13 Şubat, Cuma | Hak kesme ve kayıt günü. Bu gün alan temettüyü almaz; hisse açılışta temettü kadar ayarlanır.
5 Mart | Ödeme günü. Brüt tutardan ABD kesintisi düşülerek hesaba geçer.
:::

Hesap **iş günüyle** yapılır: hafta sonları ve ABD'nin resmî tatilleri sayılmaz. Türkiye'deki tatiller ise hesabı etkilemez; belirleyici olan ABD piyasasının takvimidir.

## Hak Kesme Sabahı Ne Olur

Hak kesme günü hisse, dağıtılacak temettü kadar düşük bir referans fiyattan açılır. Bu bir satış dalgası değil, muhasebedir: şirketin kasasından çıkacak para artık hisse fiyatının içinde değildir.

::: ornek Son Gün Alıp Ertesi Gün Satmak
Hisse 100 dolar, temettü 1 dolar. 12 Şubat'ta alırsın. 13 Şubat sabahı hisse, piyasa başka hiçbir şey yapmasa, yaklaşık **99 dolardan** açılır.
Elinde 99 dolarlık hisse ve 1 dolarlık brüt temettü alacağı var; toplam yine 100.
Türkiye'de yerleşik biri için temettüden ABD %20 keser: hesabına 0,80 dolar geçer. Hisse fiyatındaki 1 dolarlık ayarlamanın karşılığında **0,80** dolar almış olursun; buna iki kez ödenen spread ve komisyon eklenir. "Temettü avı" bu yüzden yabancı yatırımcı için sıfır değil, **eksi** bir işlemdir.
:::

## Büyük Temettü İstisnası

Temettü hisse değerinin **%25'i ya da daha fazlasıysa** kural farklı işler: hak kesme günü kayıt gününe değil, ödeme gününü izleyen iş gününe kayar. Bu istisna olağanüstü tek seferlik dağıtımlarda görülür ve duyuruda ayrıca belirtilir. Böyle bir durumda hisseyi kayıt ile ödeme arasında satan kişi temettüyle birlikte hakkı da satmış olur.

::: dikkat Ödeme Günü Hesaba Geçiş Günü Değildir
Ödeme günü şirketin parayı gönderdiği gündür. Aracı kurumun zinciri uzunsa (yerli kurum, yabancı muhabir, saklama kuruluşu) paranın hesabında görünmesi birkaç iş günü sürebilir. Vergi hesabında esas alınacak tarih ve kur konusunda kurumun dökümüne bak. Ayrıntı: [Yurt Dışı Hisse Kazancının Vergilendirilmesi](/rehber/yurt-disi-hisse-vergisi)
:::

::: ozet Özet
Takvimde dört tarih var ama karar tek tarihe bağlı: hak kesme günü. T+1 ile bu gün kayıt günüyle aynıdır ve temettüyü almak için hisseyi bir önceki iş günü almış olmak gerekir. Hak kesme sabahı hisse temettü kadar ayarlanır; bu yüzden takvim bir fırsat değil, bir mekanizmadır.
:::

## Bu Sitede Nerede Görürsün

Hisse sayfasındaki **Anahtar Metrikler** kartında temettü verimi yer alır. Bir şirketin temettü takvimini ve tutarını şirketin yatırımcı ilişkileri duyurusundan ya da aracı kurumunun kurumsal işlem bildiriminden doğrulayabilirsin.`,
  },

  /* ---------------------------------------------------------------------- */
  /* Kaynaklar: Securities Exchange Act md. 16 (yöneticiler, yönetim kurulu
     üyeleri, %10'dan fazla pay sahipleri); Sarbanes-Oxley md. 403: Form 4
     işlemden sonra iki iş günü içinde. SEC Form 4 genel talimatları, işlem
     kodları (P, S, M, A, F, G, X). SEC, Kural 10b5-1 değişiklikleri
     (Aralık 2022 kabul, 2023 yürürlük): yönetici ve kurul üyelerinde
     "soğuma" süresi en az 90 gün (en fazla 120), Form 4'te plan onay
     kutusu. "İçeriden kişiler hisselerini birçok sebeple satar ama tek
     bir sebeple alır" sözü Peter Lynch'e atfediliyor. Örnek varsayımsal. */
  "insider-islemleri": {
    title: "Insider İşlemleri: Form 4 Nasıl Okunur?",
    dek: "Şirket yöneticilerinin kendi hisselerinde yaptığı alım satımlar herkese açık; satışların neden alımlardan çok daha az şey söylediği.",
    bodyMd: `Bir şirketin yöneticileri kendi şirketlerinin hissesini alıp satabilir; bu yasaldır. Yasal olmasının şartı, işlemin herkese duyurulmasıdır. ABD'de bu duyurunun adı **Form 4**'tür ve iki iş günü içinde SEC'e verilmek zorundadır. Manşetlerde "CEO milyonlarca dolarlık hisse sattı" diye okunan haberlerin kaynağı çoğu zaman bu formdur ve formun kendisi manşetten daha fazlasını anlatır.

::: tanim Bu Yazıdaki Terimler
**Insider:** ABD mevzuatında şirketin üst düzey yöneticileri, yönetim kurulu üyeleri ve şirketin %10'undan fazlasına sahip olanlar.
**Form 4:** Bu kişilerin şirket hissesindeki her değişikliği işlemden sonraki iki iş günü içinde bildirdiği SEC formu.
**10b5-1 Planı:** Yöneticinin önceden, içeriden bilgiye sahip olmadığı bir anda kurduğu ve sonradan değiştiremediği alım satım programı.
:::

::: dikkat Yasal İşlem ile Yasa Dışı Insider Trading
Form 4'te bildirilen işlemler yasaldır. Yasa dışı olan, kamuya açıklanmamış önemli bir bilgiye dayanarak işlem yapmaktır. Türkçede ikisi de "içeriden işlem" diye anılabildiği için karışır; bu yazı yalnızca yasal ve bildirilen işlemleri anlatır.
:::

## İşlem Kodları

Form 4'ün en önemli sütunu işlem kodudur. Aynı "hisse sayısında azalma", koduna göre çok farklı şeyler anlatır.

| Kod | Anlamı | Ne Söyler |
|---|---|---|
| **P** | Açık piyasadan ya da özel alım | Yönetici kendi parasıyla aldı; en güçlü sinyal |
| **S** | Açık piyasada ya da özel satış | Tek başına az şey söyler; sebep çok olabilir |
| **M** | Opsiyon ya da türev hakkının kullanılması | Ücret paketinin bir parçası |
| **A** | Şirketin verdiği hisse ya da ödül | Maaş gibi; bir karar değil |
| **F** | Vergi ya da kullanım bedeli için hisse tutulması | Otomatik; bilgi taşımaz |
| **G** | Bağış | Genellikle vergi planlaması |
| **X** | Parası içeride opsiyonun kullanılması | M'ye benzer |

## Satış Neden Gürültülüdür

Yöneticilerin ücretinin önemli bir kısmı hisse ve opsiyon olarak ödenir. Bu yüzden satmaları için birçok sebep vardır: vergi ödemek, ev almak, servetini tek bir şirketten çeşitlendirmek ya da yıllar önce kurulmuş bir satış planını sürdürmek. Bunların hiçbiri şirketin geleceği hakkında bir görüş değildir.

Alımın ise pratikte tek bir sebebi vardır:

> İçeriden kişiler hisselerini birçok sebeple satar ama yalnızca bir sebeple alır: fiyatın yükseleceğini düşündükleri için.

Söz Peter Lynch'e atfedilir ve Form 4 okumanın ana kuralını özetler: açık piyasadan, kendi parasıyla yapılan alım (**P**) nadirdir ve bilgi taşır; satışlar sıktır ve çoğu gürültüdür.

::: ornek Bir Manşetin Arkasındaki Form
Manşet: "CEO 4,8 milyon dolarlık hisse sattı." Varsayımsal Form 4'ün satırları:
**M** · 50.000 hisse · 20 $ · Yıllar önce verilmiş opsiyonun kullanılması.
**F** · 18.000 hisse · 150 $ · Kullanım bedeli ve vergi için şirketin tuttuğu hisseler.
**S** · 32.000 hisse · 151 $ · Satış; formdaki kutu işaretli: **10b5-1 planı** kapsamında.
Sonuç: CEO'nun işlemden önceki hisse sayısı değişmedi (50.000 − 18.000 − 32.000 = 0). Manşetteki satış, bir opsiyonun nakde çevrilmesi ve vergisinin ödenmesiydi; önceden planlanmıştı.
:::

## Planlı Satışlar

10b5-1 planları, yöneticinin içeriden bilgiye sahip olmadığı bir anda kurduğu ve sonra müdahale edemediği programlardır. 2023'ten beri yöneticiler için planın kurulmasıyla ilk işlem arasında en az 90 günlük bir bekleme süresi vardır ve Form 4'te işlemin bir plan kapsamında olup olmadığını gösteren bir kutu bulunur. Planlı bir satış, zamanlamasıyla ilgili bir sinyal taşımaz; planın **kurulma ya da iptal edilme** zamanı ise taşıyabilir.

## Anlamlı Olabilecek Örüntüler

- **Kümelenmiş alım.** Aynı dönemde birden fazla yöneticinin açık piyasadan alım yapması, tek bir alımdan daha güçlü bir işarettir.
- **Düşüş sonrası alım.** Sert bir düşüşten sonra yöneticinin kendi parasıyla alması, fiyatın içerideki görüşe göre fazla düştüğünü düşündüğünü gösterebilir.
- **Plan dışı büyük satış.** 10b5-1 kutusu işaretli olmayan, alışılmışın çok üstünde ve birden fazla yöneticiden gelen satışlar ayrıca incelenmeye değer.

Bunların hiçbiri tek başına bir alım ya da satım gerekçesi değildir. Yöneticiler de yanılır ve alımları çoğu zaman aylar, hatta yıllar sonra haklı çıkar.

::: ozet Özet
Form 4, şirket yöneticilerinin hisse hareketlerini iki iş günü içinde herkese açar. Okumanın kuralı kodlardadır: P kodu nadir ve anlamlı, S kodu sık ve çoğu zaman gürültü, M, A ve F ise ücretin mekaniğidir. Bir satış manşetini okumadan önce formun satırlarına bakmak gerekir.
:::

## Bu Sitede Nerede Görürsün

Bu sitede insider işlemleri listelenmiyor. Bir şirketin Form 4 başvurularını SEC'in EDGAR veri tabanında şirket adıyla arayıp form türüne göre süzerek bulabilirsin. Şirketin kendi hisselerini geri alması ise ayrı bir konudur: [Hisse Geri Alımı](/rehber/hisse-geri-alimi)`,
  },

  /* ---------------------------------------------------------------------- */
  /* ==== 4 · Makro ve Merkez Bankası ======================================= */

  /* ---------------------------------------------------------------------- */
  "faiz-tahvil": {
    title: "Faiz, Tahvil ve Getiri Eğrisi",
    dek: "Borsayı en çok etkileyen sayı borsada değil, tahvil piyasasında oluşur.",
    bodyMd: `Hisse yatırımcılarının çoğu tahvil piyasasını takip etmez. Oysa hisse fiyatlarının en büyük tek belirleyicisi orada oluşur: **risksiz faiz oranı**.

::: tanim Tahvil ve Getiri
**Tahvil:** Bir borç senedi. Devlet ya da şirket borçlanır, sana belirli aralıklarla faiz öder, vade sonunda anaparayı iade eder.
**Getiri (yield):** O tahvili bugünkü fiyatından alırsan vadeye kadar elde edeceğin yıllık getiri.
:::

## Ters İlişki

Bu, tahvil piyasasının en temel ve en kafa karıştırıcı kuralıdır:

> Tahvilin fiyatı yükselirse getirisi düşer. Fiyatı düşerse getirisi yükselir.

Sebebi basit: tahvilin ödeyeceği faiz tutarı sabittir. O sabit tutarı daha pahalıya satın alırsan yüzdesel getirin düşer.

Bu yüzden "10 yıllık faiz yükseldi" cümlesi aslında "10 yıllık tahvilin fiyatı düştü" demektir — yani yatırımcılar tahvil satıyor.

## Neden Hisseyi İlgilendirir

Bir şirketin bugünkü değeri, gelecekte kazanacağı paranın bugüne indirgenmiş toplamıdır. İndirgemede kullanılan oran yükseldiğinde bugünkü değer düşer.

Etki her hissede aynı değildir:

| Şirket tipi | Faiz artışında |
|---|---|
| Kârı uzak gelecekte olan büyüme şirketleri | En çok etkilenir |
| Bugün nakit üreten olgun şirketler | Daha az etkilenir |
| Bankalar | Marj genişleyebilir, ters yönde tepki verebilir |
| Temettü hisseleri | Tahvil rakip hâline geldiği için baskı görür |

Son satır sık atlanır: 10 yıllık tahvil %5 getiriyorsa, %3 temettü veren bir kamu hizmeti şirketi artık daha az çekicidir.

## Vadeler Farklı Şey Anlatır

::: sayilar Üç Vade, Üç Soru
2 yıl | Piyasa Fed'in yakın vadede ne yapacağını düşünüyor
10 yıl | Uzun vadeli büyüme ve enflasyon beklentisi
30 yıl | Çok uzun vadeli güven; en az takip edilen ama en anlamlı
:::

**2 yıllık faiz** neredeyse tamamen para politikası beklentisidir. Fed'in önümüzdeki iki yılda ne yapacağına dair kolektif bahistir ve Fed'in kendi açıklamalarından daha hızlı tepki verir.

**10 yıllık faiz** ise ekonominin uzun vadeli fiyatıdır. Mortgage faizlerinden şirket kredilerine kadar pek çok şey buna endekslidir.

## Getiri Eğrisi

Bütün vadelerin getirilerini bir eğri olarak çizersen normalde yukarı eğimli bir çizgi görürsün: uzun vadeye para bağlamak daha riskli, dolayısıyla daha çok getiri ister.

::: dikkat Ters Getiri Eğrisi
Kısa vadeli faiz uzun vadeliyi geçtiğinde eğri **tersine döner**. Bu, piyasanın "yakın vadede faizler yüksek kalacak ama sonra ekonomi yavaşlayacak ve indirim gelecek" dediği anlamına gelir. Tarihsel olarak ABD'de resesyonların çoğundan önce eğri ters dönmüştür. Kesin bir kehanet değildir — zamanlaması aylarla değil, çeyreklerle ölçülür ve yanıldığı dönemler de olmuştur.
:::

## Reel Faiz

Nominal faizden enflasyonu çıkarınca kalan sayıya **reel faiz** denir ve varlık fiyatlarını asıl belirleyen odur.

Nominal faiz %5, enflasyon %4 ise reel faiz %1'dir — para hâlâ ucuzdur. Nominal faiz %3, enflasyon %1 ise reel faiz %2'dir; ikinci durum, birinciden daha sıkıdır. Manşetteki sayı yanıltır, farkı almak gerekir.

## Bu Sitede Nerede Görürsün

- Ana sayfanın yan kolonunda **2, 5 ve 10 yıllık ABD tahvil faizleri**, bir önceki güne göre değişimiyle.
- Alt şeritte üç vade "ABD Tahvili" başlığı altında birlikte döner.
- [Piyasalar](/piyasalar) ekranında tam seri ve getiri eğrisi.`,
  },

  /* ---------------------------------------------------------------------- */
  "getiri-egrisi": {
    title: "Getiri Eğrisi ve Tersine Dönmesi",
    dek: "Kısa vadeli faizin uzun vadeliyi geçmesi — piyasanın bilinen en eski resesyon sinyali ve neden hemen çalışmadığı.",
    bodyMd: `Normal bir dünyada parayı uzun süre bağlamak daha çok kazandırır: 10 yıllık tahvil, 2 yıllıktan yüksek faiz öder. Bunun sebebi basittir — on yıl boyunca ne olacağını kimse bilmez ve o belirsizliğin bir bedeli vardır.

Bazen bu ters döner. Kısa vadeli faiz uzun vadeliyi geçer. Bu, tahvil piyasasının söylediği en dikkat çekici cümledir ve son elli yılda hemen her ABD resesyonundan önce görülmüştür.

::: tanim Getiri Eğrisi
Aynı borçlunun (burada ABD Hazinesi) farklı vadelerdeki tahvillerinin faizlerini vadeye göre çizen eğri. Normalde yukarı eğimlidir: vade uzadıkça faiz artar. **Tersine dönme (inversion)**, kısa vadeli faizin uzun vadeliyi geçmesidir.
:::

## Neden Ters Döner

İki uç iki farklı şeyi fiyatlar. [Faiz ve tahvil yazısı](/rehber/faiz-tahvil) mekaniği anlatıyor; burada önemli olan şu ayrım:

- **Kısa uç (2 yıl)** Fed'in bugünkü ve yakın gelecekteki politika faizini yansıtır. Enflasyonla mücadele için faiz yükseltiliyorsa kısa uç yükselir.
- **Uzun uç (10 yıl)** ekonominin uzun vadeli büyüme ve enflasyon beklentisini yansıtır. Piyasa yavaşlama bekliyorsa uzun uç düşer.

Tersine dönme bu ikisinin aynı anda olmasıdır: **Fed bugün sıkıyor, piyasa yarın yavaşlama bekliyor.** Eğri "bu sıkılık uzun süre taşınamaz, sonunda faiz indirilecek" diyor demektir.

::: ornek 2s10s Nasıl Okunur
2 yıllık: %4,90 · 10 yıllık: %4,25
Fark (spread): 4,25 − 4,90 = **−0,65 puan**. Eğri terstir.
Piyasa aynı anda iki şey söylüyor: bugünkü faiz yüksek VE önümüzdeki on yılın ortalaması bundan düşük olacak. İkisi ancak bir noktada indirim varsa bir arada doğru olabilir; indirim de genellikle ekonomi yavaşladığında gelir.
:::

Bu farka piyasa dilinde **2s10s** denir ve bu yazının glifi de odur.

## Sinyalin Gerçek Sicili

Tersine dönmenin ünü boşuna değildir: 1970'lerden bu yana ABD'deki her resesyondan önce eğri ters dönmüştür. Ama iki uyarıyla:

**Gecikme uzundur ve değişkendir.** Tersine dönme ile resesyonun başlangıcı arasında geçen süre tarihsel olarak 6 ile 24 ay arasında değişmiştir. "Eğri ters döndü, satalım" kararı bir yıldan uzun süre yanlış görünebilir — ve o süre boyunca borsa yükselmeye devam edebilir.

**Düzelme de bir sinyaldir.** Eğrinin terslikten normale dönmesi (*re-steepening*) çoğu zaman resesyonun hemen öncesine denk gelir, çünkü düzelme genelde kısa ucun düşmesiyle, yani Fed'in indirime başlamasıyla olur. Faiz indirimi bir kutlama sebebi gibi görünür ama sebebini de hatırlamak gerekir.

::: dikkat Tek Göstergeyle Karar
Getiri eğrisi bir tahmin makinesi değil, bir beklenti fotoğrafıdır: piyasanın bugün ne düşündüğünü gösterir, ne olacağını değil. Örneklem de küçüktür — elli yılda bir avuç resesyon üzerinden konuşuluyor ve her seferinde "bu sefer farklı" iddiası hem sık hem bazen doğru çıkıyor.
Pratik kullanım: eğriyi bir alarm değil, bir **bağlam** olarak oku. Ters bir eğri, riskin fiyatının değiştiği bir dönemde olduğunu söyler; ne zaman ne alacağını söylemez.
:::

## Hangi Fark Bakılır

Tek bir "getiri eğrisi" yoktur; hangi iki vadenin karşılaştırıldığına göre farklı sinyaller çıkar:

| Fark | Ne yansıtır | Özelliği |
|---|---|---|
| **2s10s** | Politika beklentisi ile büyüme beklentisi | En yaygın anılan |
| **3ay-10y** | Bugünkü para maliyeti ile büyüme | Akademik çalışmalarda daha güçlü |
| **5s30s** | Uzun vadeli enflasyon beklentisi | Politikadan az etkilenir |

İkisinin aynı anda ters olması sinyali güçlendirir; yalnızca birinin ters olması çoğu zaman teknik bir sebepten kaynaklanabilir.

## Borsaya Etkisi

Ters eğri bankalar için doğrudan bir sorundur: banka kısa vadeden borçlanıp uzun vadeye kredi verir, yani farktan yaşar. Fark negatife dönünce iş modeli sıkışır.

Geri kalan sektörler için etki dolaylıdır ve [sektör rotasyonu](/rehber/sektor-rotasyonu) yazısının konusudur: yavaşlama beklentisi parayı döngüsel sektörlerden savunma sektörlerine kaydırır.

::: ozet Özet
Getiri eğrisinin tersine dönmesi, tahvil piyasasının "bugünkü sıkılık sürdürülemez" demesidir. Sicili güçlüdür ama zamanlaması kötüdür: sinyal ile olay arasında bir ile iki yıl geçebilir. Bu yüzden bir alım-satım tetikleyicisi değil, riskin hangi rejimde fiyatlandığını gösteren bir arka plandır.
:::

## Bu Sitede Nerede Görürsün

[Piyasalar](/piyasalar) ekranındaki tahvil faizleri şeridi 2, 5, 10 ve 30 yıllık getirileri yan yana verir — eğrinin şeklini oradan doğrudan okuyabilirsin: kısa vadeli oran uzun vadeliden yüksekse eğri terstir. Veriler FRED'den gelir ve yayın gecikmesi künyesinde yazılıdır. [Makro](/makro) ekranında da faiz serilerinin zaman içindeki seyri durur.`,
  },

  /* ---------------------------------------------------------------------- */
  "enflasyon": {
    title: "Enflasyon Verileri: TÜFE, Çekirdek ve PCE",
    dek: "Ayda bir açıklanan bir sayı, bütün varlık fiyatlarını neden yeniden yazıyor.",
    bodyMd: `ABD piyasasında ayın en çok beklenen iki verisinden biri enflasyondur (diğeri istihdam). Sebebi doğrudan değil dolaylıdır: enflasyon, Fed'in ne yapacağını belirler; Fed faizi belirler; faiz her şeyi belirler.

::: tanim Üç Ölçü
**TÜFE (CPI):** Tüketici fiyat endeksi. Hanehalkının aldığı mal ve hizmet sepetinin fiyatı.
**Çekirdek TÜFE:** Gıda ve enerji hariç TÜFE.
**PCE:** Kişisel tüketim harcamaları fiyat endeksi. Fed'in resmî tercih ettiği ölçüdür.
:::

## Neden Gıda ve Enerji Çıkarılıyor

Sezgiye aykırı gelir: insanlar en çok gıda ve akaryakıt fiyatını hisseder. Ama bu iki kalem hava koşullarına ve jeopolitiğe göre çok oynar. Bir soğuk dalgası ya da bir petrol arzı kesintisi manşet enflasyonu birkaç ay yukarı iter ve sonra geri çeker.

Merkez bankası **kalıcı** eğilime bakar, çünkü faiz kararının ekonomiye yansıması aylar alır. Geçici bir sıçramaya faiz artırımıyla tepki vermek, etkisi ancak sıçrama geçtikten sonra ortaya çıkacak bir hata olurdu.

## TÜFE ile PCE Farkı

| | TÜFE | PCE |
|---|---|---|
| Kim yayımlar | Çalışma İstatistikleri Bürosu | Ekonomik Analiz Bürosu |
| Sepet | Sabit ağırlıklı | Davranış değişimini içerir |
| Konut ağırlığı | Daha yüksek | Daha düşük |
| Genellikle | Biraz daha yüksek çıkar | Biraz daha düşük çıkar |
| Kim kullanır | Medya, sözleşmeler, maaş zamları | **Fed** |

PCE, tüketicinin ikame davranışını hesaba katar: dana eti pahalanınca insanlar tavuğa kayar ve PCE bunu yansıtır. TÜFE sabit sepetle ölçtüğü için bu geçişi görmez.

Fed'in **%2 hedefi**, çekirdek PCE üzerinden tanımlıdır. Manşet TÜFE'ye bakıp "hedef tutmadı" demek, farklı bir termometreye bakmaktır.

## Nasıl Okunur

Her açıklamada dört sayı vardır ve piyasa dördünü de karşılaştırır:

| Sayı | Anlamı |
|---|---|
| Aylık manşet | Bir önceki aya göre |
| Yıllık manşet | Geçen yılın aynı ayına göre |
| Aylık çekirdek | Gıda ve enerji hariç, aylık |
| **Yıllık çekirdek** | En çok takip edilen tek sayı |

::: dikkat Baz Etkisi
Yıllık enflasyon geçen yılın aynı ayıyla karşılaştırılır. Geçen yıl o ay çok yüksek bir artış olmuşsa, bu yıl aynı ay hiçbir şey olmasa bile yıllık oran düşer. Buna *baz etkisi* denir ve "enflasyon düşüyor" başlıklarının önemli bir kısmı gerçekte bundan ibarettir. Aylık seriye bakmak daha dürüsttür.
:::

## Piyasa Nasıl Tepki Verir

Enflasyon beklentiden **yüksek** gelirse:
- Tahvil faizleri yükselir (Fed daha uzun süre sıkı kalacak)
- Büyüme hisseleri düşer
- Dolar güçlenir

Enflasyon beklentiden **düşük** gelirse tam tersi olur.

Tepkinin büyüklüğü sapmayla orantılıdır ve sapma genellikle **ondalık basamaklarla** ölçülür: yıllık çekirdekte 0,1 puanlık bir fark bile endeksi yüzde bir hareket ettirebilir.

::: ornek Neden Küçük Sapma Büyük Tepki
Piyasa açıklamadan önce bir beklentiyi zaten fiyatlamıştır. Fiyat, gerçekleşen değere değil **gerçekleşen ile beklenenin farkına** tepki verir. Bu yüzden "enflasyon %3, hâlâ yüksek" başlığı piyasayı düşürmez; %3 zaten bekleniyorsa hiçbir şey olmaz. %3,2 beklenirken %3,0 gelirse yükselir.
:::

## Bu Sitede Nerede Görürsün

- [Makro](/makro) ekranı: TÜFE, çekirdek TÜFE, çekirdek PCE ve politika faizi bir arada, geçmiş serisiyle.
- [Takvim](/takvim): açıklama tarihleri saatiyle işaretli, yüksek etkili olanlar kırmızı noktayla.
- Ana sayfadaki **Bugünün Akışı** şeridinde açıklama saati New York ve Türkiye saatiyle birlikte.`,
  },

  /* ---------------------------------------------------------------------- */
  "istihdam": {
    title: "İstihdam Verileri: Tarım Dışı, İşsizlik ve JOLTS",
    dek: "Ayın ilk cuması açıklanan tek sayı, Fed'in iki görevinden birinin karnesidir — ve bazen iyi haber, kötü haberdir.",
    bodyMd: `Fed'in yasayla tanımlı iki görevi vardır: fiyat istikrarı ve **tam istihdam**. Birincisinin karnesi [enflasyon verileridir](/rehber/enflasyon); ikincisininki, her ayın ilk cuması sabah 08:30'da (New York) açıklanan istihdam raporudur. Ayın en çok beklenen iki verisinden biri budur ve piyasayı enflasyon kadar hareket ettirebilir.

::: tanim Tarım Dışı İstihdam (Nonfarm Payrolls, NFP)
ABD'de bir ayda yaratılan (ya da kaybedilen) tarım dışı iş sayısı. "Tarım dışı" tarihsel bir tercihtir: mevsimlik tarım işleri seriyi bozduğu için dışarıda tutulur. Manşette okuduğun "ABD ekonomisi 187 bin istihdam yarattı" cümlesindeki sayı budur.
:::

## Bir Rapor, İki Anket

İstihdam raporu tek bir ölçüm değildir; aynı sabah açıklanan **iki ayrı anketin** birleşimidir ve ikisi bazen ters yönü gösterir:

| | Kurum anketi | Hane anketi |
|---|---|---|
| Kime sorulur | İşverenlere | Hanelere |
| Ürettiği sayı | **Tarım dışı istihdam** | **İşsizlik oranı** |
| Gücü | Büyük örneklem, güvenilir eğilim | Serbest çalışanları da görür |
| Zayıflığı | Sonradan ciddi revize edilir | Aydan aya oynak |

"İstihdam arttı ama işsizlik de yükseldi" başlığı çelişki değildir — iki farklı anket, iki farklı şey saymıştır. İşsizlik oranı ayrıca **katılıma** bağlıdır: iş aramayı bırakan biri işsiz sayılmaz, yeniden aramaya başlayan herkes önce "işsiz" olarak kaydolur. İşsizliğin yükselmesi bazen kötüleşme değil, umudun geri gelmesidir.

## Raporun Dört Sayısı

::: sayilar Piyasanın Baktığı Kalemler
NFP | Aylık yeni istihdam; beklentiyle farkı fiyatı oynatır
%X,X | İşsizlik oranı — hane anketinden
Saatlik kazanç | Ücret artışı: enflasyonun işgücü tarafı
Katılım | Çalışma çağındakilerin ne kadarı işgücünde
:::

Dördü içinde en az bilineni en kritik olabilir: **ortalama saatlik kazanç**. Ücretler hızlı artıyorsa hizmet enflasyonu diri kalır ve Fed'in işi bitmemiş demektir. Güçlü bir NFP'nin yanında yüksek ücret artışı, faiz beklentilerini doğrudan yukarı iter.

## İlk Sayı Bir Taslaktır

::: dikkat Revizyonlar
Her NFP sayısı sonraki iki ayda iki kez revize edilir ve revizyonlar yüz binlik olabilir. Piyasanın sert tepki verdiği bir manşet, iki ay sonra sessizce başka bir sayıya dönüşebilir. Ayrıca yılda bir kez tüm seri toptan güncellenir. Tek bir ayın verisi üzerinden büyük hikâye kurma; üç aylık ortalama, tek ayın manşetinden her zaman daha dürüsttür.
:::

## İyi Haber Ne Zaman Kötü Haberdir

İstihdam verisinin tuhaflığı şudur: piyasanın tepkisi sayının kendisine değil, sayının **Fed için anlamına** göre şekillenir ve bu anlam döneme göre değişir.

::: ornek Aynı Sayı, İki Tepki
Ekonominin güçlü, enflasyonun yüksek olduğu bir dönemde 300 binlik NFP hisseleri **düşürür**: "ekonomi soğumuyor, faiz uzun süre yüksek kalacak" diye okunur.
Resesyon korkusunun baskın olduğu bir dönemde aynı 300 bin hisseleri **yükseltir**: "kazançlar çökmeyecek" diye okunur.
Veriyi yorumlamadan önce hangi rejimde olduğunu bil: piyasa o ay büyümeden mi korkuyor, enflasyondan mı?
:::

Bu rejim sorusunun kestirme göstergesi tahvildir: güçlü veriye [2 yıllık faiz](/rehber/faiz-tahvil) sert yükselerek tepki veriyorsa piyasa Fed'i fiyatlıyor demektir.

## Ayın Diğer İstihdam Verileri

NFP tek başına değildir; etrafında bir takvim döner:

| Veri | Ne zaman | Ne söyler |
|---|---|---|
| **JOLTS** | Ay başı, iki ay gecikmeli | Açık pozisyon sayısı — işgücü talebinin genişliği |
| **ADP** | NFP'den iki gün önce | Özel sektör bordro tahmini; NFP'yi her zaman tutturamaz |
| **Haftalık başvurular** (jobless claims) | Her perşembe | İşsizlik maaşına ilk başvurular — en taze, en gürültülü |

JOLTS'un izlediği oran ("işsiz başına açık pozisyon") Fed konuşmalarında düzenli geçer: işgücü piyasasının gevşeyip gevşemediğinin en sade ölçüsüdür.

::: ozet Özet
İstihdam raporu tek sayı değil, iki anket ve bir ücret serisidir; ilk hâli taslaktır ve piyasadaki anlamı rejime göre değişir. Okumanın sırası şudur: önce NFP beklentiden saptı mı, sonra ücretler ne dedi, sonra tahvil faizi nasıl tepki verdi. Üçü aynı yönü gösteriyorsa hikâye gerçektir.
:::

## Bu Sitede Nerede Görürsün

- [Takvim](/takvim) ekranında istihdam raporu, TÜFE ile birlikte yüksek etkili veri olarak işaretlidir; saat hem New York hem Türkiye saatiyle yazılır.
- [Makro](/makro) ekranında işsizlik oranı ve tarım dışı istihdam serisi geçmişiyle durur.
- Ana sayfadaki **Bugünün Akışı**, açıklama sabahı geri sayımı gösterir.`,
  },

  /* ---------------------------------------------------------------------- */
  "sahin-guvercin": {
    title: "Şahin ve Güvercin: Fed'in Dilini Okumak",
    dek: "Faiz kararının kendisi çoğu zaman sürpriz değildir; sürpriz, kararın yanındaki cümlelerdedir.",
    bodyMd: `Fed toplantı günü faizi sabit bıraktı. Piyasa zaten bunu bekliyordu. Yine de endeks yarım saat içinde %1,5 düştü. Neden?

Çünkü kararın kendisi haber değildi — **Başkan'ın basın toplantısında kullandığı iki sıfat** haberdi.

::: tanim Şahin ve Güvercin
**Şahin (hawkish):** Enflasyona karşı sert. Faizi yüksek tutmaya, gerekirse artırmaya eğilimli. Öncelik fiyat istikrarı.
**Güvercin (dovish):** Büyümeye ve istihdama öncelik veren. Faizi indirmeye, para politikasını gevşetmeye eğilimli.
:::

## Neden Bu Kadar Önemli

Faiz, bütün varlıkların fiyatlandığı indirgeme oranıdır. Bir şirketin bugünkü değeri, gelecekte kazanacağı paranın bugüne indirgenmiş hâlidir; oran yükselirse bugünkü değer düşer. Etki her hissede aynı değildir:

- **Uzun vadeli büyüme hisseleri** (kârı bugün değil on yıl sonra olan şirketler) faiz artışından en çok etkilenir.
- **Bugün nakit üreten olgun şirketler** daha az etkilenir.
- **Bankalar** genellikle ters yönde tepki verir: yüksek faiz marjlarını genişletebilir.

Bu yüzden şahin bir toplantı, endeksten çok **endeksin içindeki dağılımı** değiştirir.

## Ne Söylenir, Ne Anlaşılır

| Söylenen | Okunan |
|---|---|
| "Enflasyonda kalıcı ilerleme görmemiz gerekiyor" | Faiz indirimi uzakta — şahin |
| "Riskler artık iki yönlü dengeli" | İndirim kapıda olabilir — güvercin |
| "Veriye bağlı ilerleyeceğiz" | Söz vermiyorum — nötr ama gerginlik yaratır |
| "Uzun süre bu seviyede kalmak uygun olabilir" | *Higher for longer* — şahin |
| "İş gücü piyasasında soğuma belirginleşti" | Gerekçe hazırlanıyor — güvercin |

::: ornek Dot Plot (Nokta Grafiği)
Fed üyeleri üç ayda bir, gelecek yıllar için kendi faiz beklentilerini nokta olarak yayımlar. Karar açıklanmadan bile bu grafiğin medyanı bir önceki çeyreğe göre yukarı kaydıysa, hiçbir cümle kurulmadan şahin bir mesaj verilmiş olur. Piyasanın saniyeler içinde tepki verdiği sayı çoğu zaman budur.
:::

## Toplantı Günü Nasıl Okunur

1. **14:00 NY — Karar metni.** Faiz kararı ve kısa açıklama. Önceki metinle kelime kelime karşılaştırılır; değişen ifadeler haberdir.
2. **14:30 NY — Basın toplantısı.** Başkan konuşur. Piyasanın en oynak yarım saati genellikle buradadır; ilk tepki sık sık tersine döner.
3. **Sonrasında** tahvil faizleri, dolar ve endeksler yeni beklentiye göre yeniden fiyatlanır.

Buradaki en sık hata, ilk beş dakikanın hareketini nihai yorum sanmaktır. Karar metni şahin, basın toplantısı güvercin olabilir; piyasa iki kez yön değiştirir.

::: dikkat Enflasyon Verisi Faiz Kararından Önemli Olabilir
Fed'in ne yapacağını Fed'den önce **veri** söyler. TÜFE ve çekirdek PCE açıklamaları, faiz kararı gününden daha büyük hareket üretebilir; çünkü karar günü geldiğinde piyasa çoktan fiyatlamıştır. Bkz. [Enflasyon Verileri](/rehber/enflasyon)
:::

## Bu Sitede Nerede Görürsün

- **[Makro](/makro)** ekranı: TÜFE, çekirdek TÜFE, çekirdek PCE ve Fed politika faizi bir arada.
- **[Takvim](/takvim):** Fed toplantıları ve enflasyon açıklamaları saatiyle işaretli; yüksek etkili olanlar kırmızı noktayla ayrılır.
- **ABD Tahvil Faizleri:** Piyasanın Fed hakkındaki gerçek beklentisi burada okunur. Ayrıntı: [Faiz, Tahvil ve Getiri Eğrisi](/rehber/faiz-tahvil)`,
  },

  /* ---------------------------------------------------------------------- */
  "kur-riski": {
    title: "Dolar Bazında Yatırım ve Kur Riski",
    dek: "ABD hissesi alan bir Türkiye yatırımcısı aslında iki bahis birden oynar.",
    bodyMd: `Bir ABD hissesi aldığında sadece o şirkete yatırım yapmış olmazsın. Aynı zamanda **dolara** yatırım yapmış olursun. Portföyünün getirisi bu iki bahsin çarpımıdır ve ikisi birbirinden bağımsız hareket eder.

::: tanim Kur Riski
Yatırımın değerinin, varlığın kendi fiyatı dışında, para birimleri arasındaki oranın değişmesinden etkilenmesi. Türkiye'de yaşayan biri için ABD hissesi almak, otomatik olarak bir kur pozisyonu almaktır.
:::

## İki Katman

Getirini iki çarpan belirler:

**Toplam getiri ≈ (1 + hissenin dolar getirisi) × (1 + kurun değişimi) − 1**

::: ornek Dört Senaryo
Başlangıç: 1 dolar = 40 lira, hisse 100 dolar. 4.000 lira yatırdın.

· Hisse %10 arttı, kur sabit → 4.400 lira. Kazanç %10.
· Hisse sabit, dolar %10 değerlendi → 4.400 lira. Kazanç %10.
· Hisse %10 arttı, dolar %10 değerlendi → 4.840 lira. Kazanç **%21**.
· Hisse %10 arttı, dolar %10 değer kaybetti → 3.960 lira. **Zarar %1**.

Son satır önemli: şirket hakkında haklı çıktın ve yine de para kaybettin.
:::

## Hangi Para Biriminde Düşünmelisin

Bu, cevabı kişiye göre değişen bir sorudur ve doğru cevabı gideri hangi para biriminde yaptığın belirler.

- Harcamalarının tamamı lirayla ise, gerçek getirin **lira bazındadır**. Dolar bazında %8 kazanıp lira bazında alım gücünü kaybetmiş olabilirsin.
- Bir kısmı dövizle ise (eğitim, seyahat, döviz borcu), dolar bazlı ölçüm anlamlıdır.

Ekrandaki yüzdeler daima dolar bazındadır. Aracı kurumun sana lira bazında bir rakam gösteriyorsa, o rakam iki etkiyi birleştirmiş demektir.

::: dikkat Yüksek Enflasyonda Nominal Getiri Yanıltır
Lira bazında %40 kazanmak, o yıl enflasyon %45 ise alım gücü kaybıdır. Getiriyi değerlendirirken sorulacak soru "kaç lira kazandım" değil, "aynı parayla eskisinden fazlasını alabiliyor muyum" olmalıdır.
:::

## Ülke Fonlarında Aynı Sorun Tersinden

ABD borsasında işlem gören ülke ETF'leri (TUR, EWG, EWJ, EWZ) dolar cinsindendir ama içindeki hisseler yerel para birimindedir. İki katman burada da vardır, sadece yönü farklıdır:

> Yerel endeks yükselirken yerel para değer kaybederse, dolar bazlı fon yatay kalabilir hatta düşebilir.

Bu, Dünya Piyasaları kartındaki yüzdeyi okurken hatırlanması gereken en önemli şeydir: gördüğün sayı, o ülkenin borsasındaki yüzde değil, **dolar cinsinden getiridir**. Ayrıntı: [ETF Nedir?](/rehber/etf)

## Kur Riskini Ne Belirler

Uzun vadede iki ülke arasındaki enflasyon farkı ve reel faiz farkı belirleyicidir. Kısa vadede ise sermaye akımları, jeopolitik ve risk iştahı baskındır — yani tahmin edilmesi hisse fiyatlarından daha kolay değildir.

Pratik sonuç şudur: kur, portföyünün getirisinin ciddi bir parçasıdır ama üzerinde kontrolün yoktur. Kontrol edebileceğin şey **ne kadarının döviz cinsinden olduğudur**.

::: ozet Özet
Yurt dışı hisse almak iki karardır: hangi şirket ve hangi para birimi. İkincisini bilinçli vermezsen, birincisinde haklı çıksan bile sonucu o belirleyebilir.
:::

## Bu Sitede Nerede Görürsün

Bütün fiyatlar ve yüzdeler dolar bazındadır; ayrıca bir kur dönüşümü yapılmaz. **Dünya Piyasaları** kartının altındaki not, bu kartın yerel endeksleri değil dolar cinsinden ülke fonlarını gösterdiğini hatırlatmak için orada durur.`,
  },

  /* ---------------------------------------------------------------------- */
  "sektor-rotasyonu": {
    title: "Sektör Rotasyonu Nedir?",
    dek: "Paranın borsadan çıkmadan sektör değiştirmesi — ve bunun ekonomik döngüyle ilişkisi.",
    bodyMd: `Bir gün endeks yatay kapanır ama içeride büyük bir hareket olmuştur: bankalar %3 yükselirken teknoloji %3 düşmüştür. Piyasadan para çıkmamıştır, **yer değiştirmiştir.** Buna sektör rotasyonu denir ve makro yazılarının portföye bağlandığı yer burasıdır.

::: tanim Sektör Rotasyonu
Yatırımcıların ekonomik döngüye ya da faiz beklentisine göre ağırlıklarını bir sektörden diğerine kaydırması. Endeks seviyesinde az şey olur; endeksin içinde çok şey olur.
:::

## İki Aile: Döngüsel ve Savunmacı

Rotasyonun tamamı tek bir ayrım üzerine kuruludur:

**Döngüsel sektörler** ekonomiyle birlikte nefes alır. İnsanlar iyi hissettiğinde araba alır, tatile çıkar, ev yeniler. Bankalar da kredi büyümesinden ve faiz farkından kazanır. Bu sektörler büyüme dönemlerinde endeksten hızlı yükselir, yavaşlamada hızlı düşer: **sanayi, tüketici isteğe bağlı, finans, enerji, malzeme.**

**Savunmacı sektörler** döngüden az etkilenir. Resesyonda da elektrik faturası ödenir, ilaç alınır, deterjan tükenir. Yavaşlamada endeksten iyi, coşkuda endeksten kötü performans gösterirler: **temel tüketim, sağlık, kamu hizmetleri (utilities), telekom.**

::: ornek Aynı Gün, İki Yön
Fed toplantısında beklenenden şahin bir mesaj çıkar: faizler daha uzun süre yüksek kalacak.
Aynı seansta:
Kamu hizmetleri **−%2,4** — yüksek borçlu, temettü ödeyen bu şirketler tahvil faiziyle rekabet eder; faiz yükselince cazibesi düşer.
Bankalar **+%1,8** — yüksek faiz, kredi ile mevduat arasındaki farkı genişletir.
Teknoloji **−%1,9** — değerinin büyük kısmı uzak gelecekteki kârlarda; yüksek faiz o kârların bugünkü değerini düşürür.
Endeks: **−%0,3**. Manşete bakan "sakin bir gün" der; içeride üç ayrı hikâye vardır.
:::

## Faiz Neden Bu Kadar Belirleyici

Yukarıdaki örneğin son satırı en önemlisidir. Bir şirketin değeri, gelecekte üreteceği nakdin bugüne indirgenmiş hâlidir. İndirgeme oranı faizdir.

Kârının büyük kısmı **yakın gelecekte** olan bir şirket (olgun bir banka, bir market zinciri) faiz değişiminden az etkilenir. Kârının büyük kısmı **uzak gelecekte** beklenen bir şirket (henüz kâr etmeyen bir büyüme hissesi) çok etkilenir — çünkü uzak nakit, yüksek faizle indirgendiğinde çok daha az eder.

Bu yüzden faiz beklentisi değiştiğinde rotasyon neredeyse mekanik olur. [Getiri eğrisi](/rehber/getiri-egrisi) ve [şahin/güvercin](/rehber/sahin-guvercin) yazılarındaki her sinyalin borsadaki karşılığı önce burada görülür.

## Döngünün Dört Evresi

Klasik model şudur — bir kural değil, bir çerçeve:

| Evre | Ekonomi | Öne çıkan |
|---|---|---|
| **Erken toparlanma** | Dipten dönüş, faiz düşük | Finans, tüketici isteğe bağlı |
| **Genişleme** | Büyüme hızlı, faiz artıyor | Teknoloji, sanayi |
| **Zirve / yavaşlama** | Enflasyon yüksek, faiz tepede | Enerji, malzeme |
| **Daralma** | Yavaşlama, faiz inmeye başlar | Temel tüketim, sağlık, kamu hizmetleri |

::: dikkat Çerçeveyi Kehanete Çevirmek
Bu tablo tarihsel eğilimleri özetler, gelecek için bir program vermez. Üç sebeple:
**Evreyi ancak sonradan biliriz.** Hangi evrede olduğumuz, geçtikten aylar sonra netleşen bir şeydir.
**Piyasa önden fiyatlar.** Rotasyon ekonomik veri açıklandığında değil, beklenti değiştiğinde olur — yani veriyi gördüğünde hareket çoktan olmuştur.
**Sektör etiketleri yanıltır.** Bugün "teknoloji" içinde hem kâr etmeyen bir yazılım şirketi hem dünyanın en nakit zengin işletmeleri var; ikisi aynı faiz haberine ters yönde tepki verebilir.
:::

## Rotasyonu Görmek

Rotasyonun en pratik göstergesi **piyasa genişliğidir**: endeks yükselirken kaç hisse artıda? Endeks %1 yükselirken bileşenlerin yalnızca %35'i artıdaysa, yükseliş birkaç büyük isimden geliyordur ve içeride para başka yöne akıyordur.

İkinci gösterge sektör performanslarının **birlikte hareket etmemesidir**. Panikte her şey birlikte düşer (korelasyon 1'e gider); sağlıklı bir rotasyonda ise bazıları yükselirken bazıları düşer.

::: ozet Özet
Sektör rotasyonu, aynı miktardaki paranın borsa içinde yer değiştirmesidir. Endeks manşetinin gizlediği şeyi gösterir. Bir zamanlama aracı değildir — çerçeveyi bilmek "şimdi bankaya geç" demeye yetmez. Asıl faydası [çeşitlendirme](/rehber/cesitlendirme) tarafındadır: portföyün hangi evreye bahis oynadığını fark etmeni sağlar. Çoğu portföy, sahibinin farkında olmadığı bir makro bahis taşır.
:::

## Bu Sitede Nerede Görürsün

Bu ekranların üçü doğrudan bu konuyu okur:

- [Piyasalar](/piyasalar) ekranındaki **piyasa genişliği** çubuğu, endeksin içinde kaç hissenin artıda olduğunu söyler — rotasyonun en hızlı okunan işareti.
- [Şirketler](/sirketler) dizinindeki sektör filtreleri, aynı günün hareketini sektör sektör karşılaştırmanı sağlar.
- [Makro](/makro) ekranındaki faiz ve enflasyon serileri, rotasyonun sebep tarafını verir; sonucu piyasalarda görürsün.`,
  },
};
