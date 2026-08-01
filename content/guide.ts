/* ==========================================================================
   Rehber — kavram yazıları

   Neden veritabanında değil de depoda: bu metinler durağan ve editoryal.
   Bir tanımın yanlış olması bir fiyatın eski olmasından daha pahalı, o yüzden
   kod incelemesinden geçmeleri ve sürüm geçmişinde durmaları isteniyor.
   Piyasa dosyaları (`stories` tablosu) tam tersi: her akşam üretiliyor ve
   deploy beklemeden yazılabilmeli.

   Gövde sözdizimi `components/article/ArticleBody.tsx` içinde anlatılıyor:
   ## başlık, - madde, | tablo |, > alıntı, ::: kutu ... :::
   ========================================================================== */

export const GUIDE_TOPICS = [
  { key: "temel", labelTr: "Temel Kavramlar", labelEn: "Basics" },
  { key: "strateji", labelTr: "Pozisyon ve Risk", labelEn: "Positions & Risk" },
  { key: "sirket", labelTr: "Şirketi Okumak", labelEn: "Reading a Company" },
  { key: "makro", labelTr: "Makro ve Merkez Bankası", labelEn: "Macro" },
] as const;

export type GuideTopicKey = (typeof GUIDE_TOPICS)[number]["key"];

export type GuideArticle = {
  slug: string;
  title: string;
  /** Kartta ve sayfa başında okunan tek cümle. */
  dek: string;
  topic: GuideTopicKey;
  /** Kart üstündeki tipografik işaret — ikon değil, kavramın kendi notasyonu. */
  glyph: string;
  bodyMd: string;
  /** İlgili yazılar; sayfa sonunda bağlantı olarak çıkar. */
  related?: string[];
};

export const GUIDE_ARTICLES: GuideArticle[] = [
  /* ---------------------------------------------------------------------- */
  {
    slug: "volatilite",
    title: "Volatilite Nedir?",
    dek: "Fiyatın ne kadar oynadığını ölçer — hangi yöne gittiğini değil.",
    topic: "temel",
    glyph: "σ",
    related: ["ayi-boga", "kaldirac"],
    bodyMd: `Bir hisse ayı %2 artıda kapatabilir. Aynı hisse ay boyunca önce %18 düşüp sonra %24 yükselerek de %2 artıda kapatabilir. Sonuç aynı, yaşadıkların değil. Aradaki farkın adı **volatilite**.

::: tanim Volatilite
Bir varlığın fiyatının belirli bir dönemde ortalamasından ne kadar saptığının ölçüsü. Yönü umursamaz: %10 yükseliş ile %10 düşüş volatiliteye aynı katkıyı yapar. Ölçtüğü şey **hareketin büyüklüğü**, yani belirsizlik.
:::

## Nasıl hesaplanır

Günlük getirilerin standart sapması alınır ve yıllığa çevrilir. Kaba bir sayı: günlük hareketlerin standart sapması %1 olan bir hissenin yıllık volatilitesi yaklaşık %16'dır (%1 × √252, çünkü bir yılda yaklaşık 252 işlem günü vardır).

Bu sayı bir tahmin değil, bir ölçüdür. "Yıllık volatilitesi %40" cümlesi, hissenin yükseleceğini de düşeceğini de söylemez; yalnızca yıl içinde geniş bir bantta gezineceğini söyler.

| Tipik yıllık volatilite | Ne anlama gelir |
|---|---|
| %10–15 | Kamu hizmeti şirketleri, büyük gıda markaları. Fiyat günlerce yerinde durur. |
| %15–20 | S&P 500'ün uzun dönem bandı. Endeks, içindeki tek tek hisselerden daha sakindir. |
| %25–40 | Büyük teknoloji ve yarı iletken. Tek bir bilanço gecesi %10 hareket edebilir. |
| %60+ | Yeni halka açılmış şirketler, biyoteknoloji, spekülatif isimler. |

Endeksin tek tek hisselerden sakin olması tesadüf değil: içerideki şirketlerin bir kısmı artarken bir kısmı düşer ve hareketler kısmen birbirini götürür. Buna çeşitlendirme denir ve volatiliteyi düşürmenin en ucuz yoludur.

## Gerçekleşen volatilite, beklenen volatilite

İki farklı sayı vardır ve karıştırılır:

- **Gerçekleşen (realized):** Geçmiş fiyatlardan hesaplanır. Ne olduğunu söyler.
- **Beklenen (implied):** Opsiyon fiyatlarından geri çözülür. Piyasanın önümüzdeki dönem için ne beklediğini söyler.

Beklenen volatilitenin en bilinen göstergesi **VIX**'tir: S&P 500 opsiyonlarından türetilir ve "korku endeksi" diye anılır. Uzun dönem ortalaması 20 civarındadır. 12–15 bandı sakin bir piyasa, 30 üstü gerginlik, 50 üstü panik demektir.

::: ornek Bilanço gecesi
Bir şirket bilanço açıklamadan önce opsiyon fiyatları şişer, çünkü piyasa büyük bir hareket bekler. Açıklama yapıldıktan sonra belirsizlik ortadan kalkar ve opsiyon fiyatları — hisse hiç hareket etmese bile — hızla düşer. Buna *volatility crush* denir. Doğru tahmin edip yine de para kaybetmenin klasik yollarından biridir.
:::

## Volatilite kötü bir şey mi

Değil, ama bedava da değil. İki farklı sonucu vardır:

1. **Psikolojik:** Yüksek volatiliteli bir pozisyon, doğru olsan bile seni yolda satmaya zorlayabilir.
2. **Matematiksel:** Volatilite bileşik getiriyi yer. %50 düşen bir varlığın başa dönmesi için %100 yükselmesi gerekir. Sıfır etrafında salınan büyük hareketler, düz bir çizgide ilerleyen küçük hareketlerden daha az bileşik getiri üretir.

İkinci madde, aynı ortalama getiriye sahip iki varlıktan sakin olanın uzun vadede daha fazla kazandırmasının nedenidir.

::: dikkat Kaldıraçla birleşince
Volatilite tek başına bir risk değil, bir ölçüdür. Riske dönüştüğü yer kaldıraçtır: ödünç parayla taşınan bir pozisyonda geçici bir dalgalanma, teminat çağrısı yoluyla kalıcı bir kayba dönüşebilir. Bkz. [Kaldıraç Nedir?](/rehber/kaldirac)
:::

## Bu sitede nerede görürsün

- **Gün aralığı** (hisse sayfası): günün en düşüğü ile en yükseği arasındaki mesafe, günlük volatilitenin en kaba göstergesidir.
- **52 hafta en yüksek / en düşük:** yıllık bandın genişliği.
- **Gün içi grafik:** düz bir çizgi mi, testere dişi mi — bakışta anlaşılır.`,
  },

  /* ---------------------------------------------------------------------- */
  {
    slug: "etf",
    title: "ETF Nedir?",
    dek: "Tek bir hisse gibi alınıp satılan, içinde onlarca şirket taşıyan fon.",
    topic: "temel",
    glyph: "ETF",
    related: ["volatilite", "temettu"],
    bodyMd: `Nasdaq 100 endeksini "satın alamazsın". Endeks bir hesaptır, bir ürün değil. Ama endeksteki 100 şirketin hepsini doğru ağırlıklarla tutan bir fonun payını satın alabilirsin. O fonun adı **QQQ** ve bir ETF'tir.

::: tanim ETF (Exchange Traded Fund)
Borsada işlem gören yatırım fonu. İçinde bir varlık sepeti tutar; payları borsada, tıpkı bir hisse gibi, gün boyu alınıp satılır. Türkçesi "borsa yatırım fonu"dur.
:::

## Klasik fondan farkı

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

::: dikkat Kaldıraçlı ve ters ETF'ler
"3x" ya da "inverse" yazan ETF'ler farklı bir üründür. Endeksin **günlük** getirisinin katını hedeflerler, dönemsel getirisinin değil. Yatay ama oynak bir piyasada her iki yönde de erirler. Uzun vadeli tutmak için tasarlanmamışlardır; bu ürünlerde "aylarca beklerim" stratejisi matematiksel olarak çalışmaz.
:::

## Fiyatı neden endeksle aynı değil

QQQ'nun fiyatı Nasdaq 100 endeksinin seviyesi değildir; onun belirli bir oranıdır. DIA yaklaşık olarak Dow Jones'un yüzde biri fiyatlanır. Önemli olan seviye değil **yüzde değişimdir**; o neredeyse birebir aynıdır.

Ülke fonlarında bir katman daha vardır: fon dolar cinsinden ve ABD seansında işlem görür. Yerel endeks kendi ülkesinde saatler önce kapanmış olabilir ve arada kur değişmiş olabilir. Yön genellikle aynıdır, yüzde birebir tutmaz.

::: ornek Türkiye örneği
BIST 100 lira bazında %2 yükselirken lira dolar karşısında %2 değer kaybederse, TUR (iShares MSCI Türkiye) dolar bazında neredeyse yatay kalır. Ekranda gördüğün yüzde, yerel endeksin yüzdesi değil, **dolar cinsinden getiridir**.
:::

## Ne zaman ETF, ne zaman tek hisse

Tek hisse almak, o şirket hakkında bir görüşün olduğunu varsayar. ETF almak, bir tema ya da piyasa hakkında görüşün olduğunu ama hangi şirketin kazanacağını bilmediğini kabul eder. İkisi de meşrudur; karıştırıldığında sorun çıkar — yani bir tema hakkında haklı olup yanlış şirketi seçtiğinde.

## Bu sitede nerede görürsün

Endeks kartları (Nasdaq 100, S&P 500, Dow Jones, Russell 2000) ve Dünya Piyasaları listesi ETF fiyatlarından beslenir. Bir ETF'in sayfasına girdiğinde şirket metrikleri yerine **fon künyesi** görürsün: neyi izlediği, fon yöneticisi ve izlediği piyasayla arasındaki farkın notu.`,
  },

  /* ---------------------------------------------------------------------- */
  {
    slug: "kaldirac",
    title: "Kaldıraç Nedir?",
    dek: "Ödünç parayla pozisyon taşımak — getiriyi de kaybı da çarpar, ama asıl aldığı şey zamandır.",
    topic: "strateji",
    glyph: "4×",
    related: ["volatilite", "long-short"],
    bodyMd: `10.000 dolarlık sermayen var. Aracı kurumdan 30.000 dolar ödünç alıp 40.000 dolarlık hisse taşıyorsun. Kaldıracın 4x. Hisse %10 yükselirse 4.000 dolar kazanırsın — sermayenin %40'ı. Hisse %10 düşerse 4.000 dolar kaybedersin — yine sermayenin %40'ı.

Buraya kadarı herkesin bildiği kısım. Asıl mesele bundan sonrası.

::: tanim Kaldıraç
Kendi sermayenden büyük bir pozisyonu ödünç parayla taşımak. Ödünç veren taraf (aracı kurum, prime broker) teminat ister ve teminatın piyasa değeri belirli bir oranın altına düşerse **hemen** tamamlanmasını talep eder.
:::

## Asıl aldığı şey: takvim

Kaldıraçsız bir pozisyonda ne zaman satacağına sen karar verirsin. Fiyat yarıya inse bile beklemeyi seçebilirsin, çünkü kimseye borçlu değilsin.

Kaldıraçlı bir pozisyonda bu karar senin değildir. Teminat oranı belirli bir eşiğin altına indiğinde aracı kurum **teminat tamamlama çağrısı** (margin call) gönderir. Para koyamazsan pozisyon kapatılır — hem de tam olarak fiyatın en kötü olduğu anda, çünkü çağrı zaten o yüzden geldi.

> Doğru olduğun hâlde iflas edebilirsin. Haklı çıkman için gereken süre, pozisyonu taşıyabileceğin süreden uzun olabilir.

Bu cümle kaldıracın tek cümlelik özetidir.

## Kaç kat, ne kadar düşüşe dayanır

| Kaldıraç | Sermayeyi silen düşüş | Pratikte teminat çağrısı |
|---|---|---|
| 1x (kaldıraçsız) | %100 | Yok |
| 2x | %50 | ~%25 düşüşte |
| 4x | %25 | ~%12 düşüşte |
| 10x | %10 | ~%5 düşüşte |

Sağdaki sütun daha önemli: pozisyon silinmeden çok önce çağrı gelir. 4x kaldıraçta piyasanın %12 düşmesi — ki bu sıradan bir düzeltmedir — seni oyundan çıkarmaya yeter.

::: ornek Yoğunlaşma ile birleşince
Kaldıracın en tehlikeli hâli tek başına değil, **yoğunlaşmayla** birlikte ortaya çıkar. Portföyün ilk beş pozisyonu toplamın dörtte üçüyse ve beşi de aynı temanın farklı ifadesiyse, çeşitlendirme sandığından çok azdır. Tema satıldığında beş pozisyon aynı anda ve aynı yönde düşer. 2026 Temmuz'unda bir yapay zekâ fonunun 96 saatte tasfiye edilmesi tam olarak bu iki şeyin çarpımıydı.
:::

## Görünmeyen kaldıraç

Herkes kaldıracın "marj hesabı" olduğunu sanır. Değil. Kaldıraç birçok biçimde gelir:

- **Opsiyonlar:** Prim ödeyerek çok daha büyük bir nominal tutara maruz kalırsın.
- **Vadeli işlemler:** Teminat, sözleşme büyüklüğünün küçük bir yüzdesidir.
- **Kaldıraçlı ETF'ler:** Ürünün içinde taşınır, senin hesabında görünmez.
- **Şirketin kendi borcu:** Borçlu bir şirketin hissesi, borçsuz bir şirketin hissesinden doğası gereği daha kaldıraçlıdır.

Son madde çoğu kişinin gözünden kaçar: hiç marj kullanmadan da yüksek kaldıraçlı bir portföy taşıyor olabilirsin.

## Doğru soru

"Ne kadar kazandırır" değil. Doğru sorular şunlar:

1. Bu pozisyon %30 düşerse hâlâ taşıyabilir miyim?
2. Taşıyamazsam, satış kararını ben mi vereceğim, teminat oranı mı?
3. Portföyümdeki diğer pozisyonlar aynı anda düşer mi?

Üçüne de rahatça cevap veremiyorsan kaldıraç fazladır.`,
  },

  /* ---------------------------------------------------------------------- */
  {
    slug: "long-short",
    title: "Long ve Short Ne Demek?",
    dek: "Yükselişten kazanmak ile düşüşten kazanmak — ve ikisinin hiç de simetrik olmaması.",
    topic: "strateji",
    glyph: "L/S",
    related: ["kaldirac", "ayi-boga"],
    bodyMd: `Piyasada iki temel yön vardır ve ikisi de para kazanabilir. Ama riskleri birbirinin aynası değildir; bu asimetri, short pozisyonun neden bu kadar tehlikeli olduğunu açıklar.

::: tanim Long ve Short
**Long (uzun):** Varlığı satın alıp sahibi olmak. Fiyat yükselirse kazanırsın.
**Short (kısa / açığa satış):** Sahip olmadığın varlığı ödünç alıp satmak, sonra geri alıp iade etmek. Fiyat düşerse aradaki farkı kazanırsın.
:::

## Short mekaniği

1. Bir hissenin 100 adedini aracı kurumdan ödünç alırsın.
2. Piyasada 200 dolardan satarsın — hesabına 20.000 dolar geçer.
3. Fiyat 150 dolara düşer. 100 adedi 15.000 dolara geri alırsın.
4. Hisseleri iade edersin. Kârın 5.000 dolar (ödünç faizi düşülür).

Fiyat 250'ye çıkarsa aynı işlemi 25.000 dolara kapatırsın ve 5.000 dolar kaybedersin.

## Asıl mesele: asimetri

| | Long | Short |
|---|---|---|
| Azami kayıp | Yatırdığın para (%100) | **Sınırsız** |
| Azami kazanç | Sınırsız | Yatırdığın tutar kadar (%100) |
| Zaman | Genellikle lehine çalışır | Aleyhine çalışır (ödünç faizi, temettü) |
| Pozisyon zamanla | Yükselirse büyür, riski azalır | Yükselirse büyür, **riski artar** |

Son satır kritik. Long bir pozisyon aleyhine gittiğinde küçülür — portföydeki ağırlığı azalır, zararı sınırlanır. Short bir pozisyon aleyhine gittiğinde **büyür**: fiyat yükseldikçe pozisyonun nominal değeri artar, teminat ihtiyacı artar ve portföydeki ağırlığı kendiliğinden şişer.

::: dikkat Short squeeze
Çok sayıda yatırımcı aynı hissede short'sa ve fiyat yükselmeye başlarsa, zararı kesmek için hepsi aynı anda geri alım yapmak zorunda kalır. Geri alım demek **satın almak** demektir; yani yükselişi besler; yükseliş daha fazla short'u kapanmaya zorlar. Kendi kendini büyüten bu döngüye *short squeeze* denir ve fiyatı birkaç günde katlayabilir.
:::

## Neden yine de short yapılır

Short her zaman bahis değildir. Profesyonel portföylerde çoğunlukla bir **hedge** aracıdır:

- **Piyasa nötrleme:** Bir sektörde beğendiğin şirketi long, beğenmediğini short alırsan, sektörün genel yönünden bağımsız olarak "seçimimde haklı mıyım" bahsini oynamış olursun.
- **Portföy sigortası:** Uzun vadeli long portföyün varken endeksi short'lamak, düşüşte kaybı yumuşatır.
- **Eşleştirilmiş işlem (pair trade):** "Uzun çip, kısa yazılım" gibi. İki bacak da aynı tezin parçasıdır.

::: ornek Eşleştirilmiş işlemin iki tarafı da kanayabilir
"Uzun çip, kısa yazılım" pozisyonu, yapay zekânın yazılım marjlarını eritirken altyapı talebini patlatacağı fikrine dayanır. Tez doğruysa iki bacak birlikte kazandırır. Tez ters döndüğünde ise **iki bacak birlikte kaybettirir** — çipler düşerken yazılımlar yükselir. Bu yüzden eşleştirilmiş işlemler "daha az riskli" değildir; sadece farklı bir riski vardır.
:::

## Kısa özet

Long yapmak varsayılan pozisyondur ve zaman genellikle lehine çalışır: şirketler büyür, ekonomi büyür, endeksler uzun vadede yükselir. Short yapmak zamana karşı bir bahistir; haklı olmak yetmez, **zamanında** haklı olman gerekir.`,
  },

  /* ---------------------------------------------------------------------- */
  {
    slug: "ayi-boga",
    title: "Ayı ve Boğa Piyasası Nedir?",
    dek: "İki hayvan, iki eşik ve piyasanın kendi hakkında anlattığı hikâye.",
    topic: "temel",
    glyph: "▲▼",
    related: ["volatilite", "long-short"],
    bodyMd: `Boğa boynuzlarıyla yukarı savurur, ayı pençesiyle aşağı vurur. Terimlerin kökeni bu kadar basit. Eşikleri ise sayısaldır ve piyasa bunları ciddiye alır.

::: tanim İki eşik
**Düzeltme (correction):** Son zirveden **%10** ya da daha fazla geri çekilme.
**Ayı piyasası (bear market):** Son zirveden **%20** ya da daha fazla geri çekilme.
**Boğa piyasası (bull market):** Ayı dibinden %20 yükseliş; genellikle yeni zirvelerle birlikte anılır.
:::

Bu eşikler matematiksel bir doğruluk taşımaz — kimse %19,4 ile %20,1 arasında bir doğa yasası olduğunu iddia etmiyor. Ama piyasa katılımcıları bunları ortak dil olarak kullandığı için gerçek etkileri vardır: fon yöneticileri raporlarında bu tanımlara göre konuşur, medya bu eşiklerde başlık atar, bazı kurumsal risk kuralları bu seviyelerde devreye girer.

## Karakterleri farklıdır

| | Boğa piyasası | Ayı piyasası |
|---|---|---|
| Süre | Yıllar (tarihsel olarak çok daha uzun) | Aylar |
| Hız | Yavaş, kademeli | Hızlı, sert |
| Volatilite | Düşük | Yüksek |
| Duygu | Kayıtsızlık, sonra iyimserlik, sonra coşku | Endişe, sonra korku, sonra teslimiyet |
| Haber akışı | İyi haber alkışlanır, kötü haber görmezden gelinir | Kötü haber cezalandırılır, iyi haber güvenilmez bulunur |

En kalıcı gözlem şudur: **piyasalar merdivenle çıkar, asansörle iner.** Yükseliş kademeli birikimle olur; düşüş zorunlu satıcıların (teminat çağrıları, fon çıkışları, risk limitleri) aynı anda kapıya koşmasıyla olur.

::: dikkat Ayı piyasası rallisi
Ayı piyasalarının içinde %10–20'lik sert yükselişler görülür ve her biri "dip geçildi" diye yorumlanır. Tarihsel olarak en keskin günlük yükselişlerin çoğu ayı piyasalarının içinde yaşanmıştır. Bir günün yönü trendi anlatmaz.
:::

## Neden isimlendirmek işe yarar

Bir düzeltmeyi ayı piyasasından ayırmak, portföyde neyin değiştiğini sormanı sağlar:

- **Düzeltme genellikle fiyat olayıdır.** Değerlemeler gerilir, biraz hava alınır, hikâye değişmez.
- **Ayı piyasası genellikle hikâye olayıdır.** Kazanç beklentileri düşer, faiz rejimi değişir, bir sektörün temel tezine güven sarsılır.

İkisini ayırmanın kestirme yolu yoktur ama iyi bir soru vardır: *bu düşüşe sebep olan şey, şirketlerin önümüzdeki üç yılda kazanacağı parayı değiştiriyor mu?* Cevap hayırsa muhtemelen düzeltmedir.

## Sayılar

Tarihsel ölçekte:

- ABD borsasında ayı piyasaları ortalama olarak birkaç yılda bir görülür.
- Boğa piyasaları ayı piyasalarından hem daha uzun sürer hem de daha büyük hareket üretir; endekslerin uzun vadeli yukarı eğiliminin sebebi budur.
- 1929, 2000–2002, 2007–2009 ve 2020 en çok anılan ayı piyasalarıdır; ilk üçü aylar-yıllar sürdü, 2020 tarihin en hızlısıydı ve haftalarla ölçüldü.

## Bu sitede nerede görürsün

**Piyasa Genişliği** kartı, endeksteki şirketlerin kaçının artıda kaçının ekside olduğunu gösterir. Endeks yükselirken genişliğin daralması (yani yükselişi bir avuç hissenin taşıması) çoğu zaman trendin zayıfladığının ilk işaretidir — endeks seviyesinden önce burada görünür.`,
  },

  /* ---------------------------------------------------------------------- */
  {
    slug: "sahin-guvercin",
    title: "Şahin ve Güvercin: Fed'in Dilini Okumak",
    dek: "Faiz kararının kendisi çoğu zaman sürpriz değildir; sürpriz, kararın yanındaki cümlelerdedir.",
    topic: "makro",
    glyph: "Fed",
    related: ["ayi-boga", "volatilite"],
    bodyMd: `Fed toplantı günü faizi sabit bıraktı. Piyasa zaten bunu bekliyordu. Yine de endeks yarım saat içinde %1,5 düştü. Neden?

Çünkü kararın kendisi haber değildi — **Başkan'ın basın toplantısında kullandığı iki sıfat** haberdi.

::: tanim Şahin ve güvercin
**Şahin (hawkish):** Enflasyona karşı sert. Faizi yüksek tutmaya, gerekirse artırmaya eğilimli. Öncelik fiyat istikrarı.
**Güvercin (dovish):** Büyümeye ve istihdama öncelik veren. Faizi indirmeye, para politikasını gevşetmeye eğilimli.
:::

## Neden bu kadar önemli

Faiz, bütün varlıkların fiyatlandığı iskonto oranıdır. Bir şirketin bugünkü değeri, gelecekte kazanacağı paranın bugüne indirgenmiş hâlidir; iskonto oranı yükselirse bugünkü değer düşer. Etki her hissede aynı değildir:

- **Uzun vadeli büyüme hisseleri** (kârı bugün değil on yıl sonra olan şirketler) faiz artışından en çok etkilenir.
- **Bugün nakit üreten olgun şirketler** daha az etkilenir.
- **Bankalar** genellikle ters yönde tepki verir: yüksek faiz marjlarını genişletebilir.

Bu yüzden şahin bir toplantı, endeksten çok **endeksin içindeki dağılımı** değiştirir.

## Ne söylenir, ne anlaşılır

| Söylenen | Okunan |
|---|---|
| "Enflasyonda kalıcı ilerleme görmemiz gerekiyor" | Faiz indirimi uzakta — şahin |
| "Riskler artık iki yönlü dengeli" | İndirim kapıda olabilir — güvercin |
| "Veriye bağlı ilerleyeceğiz" | Söz vermiyorum — nötr ama gerginlik yaratır |
| "Uzun süre bu seviyede kalmak uygun olabilir" | *Higher for longer* — şahin |
| "İş gücü piyasasında soğuma belirginleşti" | Gerekçe hazırlanıyor — güvercin |

::: ornek Nokta grafiği (dot plot)
Fed üyeleri üç ayda bir, gelecek yıllar için kendi faiz beklentilerini nokta olarak yayımlar. Karar açıklanmadan bile bu grafiğin medyanı bir önceki çeyreğe göre yukarı kaydıysa, hiçbir cümle kurulmadan şahin bir mesaj verilmiş olur. Piyasanın saniyeler içinde tepki verdiği sayı çoğu zaman budur.
:::

## Toplantı günü nasıl okunur

1. **14:00 NY — Karar metni.** Faiz kararı ve kısa açıklama. Önceki metinle kelime kelime karşılaştırılır; değişen ifadeler haberdir.
2. **14:30 NY — Basın toplantısı.** Başkan konuşur. Piyasanın en oynak yarım saati genellikle buradadır; ilk tepki sık sık tersine döner.
3. **Sonrasında** tahvil faizleri, dolar ve endeksler yeni beklentiye göre yeniden fiyatlanır.

Buradaki en sık hata, ilk beş dakikanın hareketini nihai yorum sanmaktır. Karar metni şahin, basın toplantısı güvercin olabilir; piyasa iki kez yön değiştirir.

::: dikkat Enflasyon verisi faiz kararından önemli olabilir
Fed'in ne yapacağını Fed'den önce **veri** söyler. TÜFE ve çekirdek PCE açıklamaları, faiz kararı gününden daha büyük hareket üretebilir; çünkü karar günü geldiğinde piyasa çoktan fiyatlamıştır.
:::

## Bu sitede nerede görürsün

- **Makro** ekranı: TÜFE, çekirdek TÜFE, çekirdek PCE ve Fed politika faizi bir arada.
- **Takvim:** Fed toplantıları ve enflasyon açıklamaları saatiyle işaretli; yüksek etkili olanlar kırmızı noktayla ayrılır.
- **ABD Tahvil Faizleri** ve **getiri eğrisi:** Piyasanın Fed hakkındaki gerçek beklentisi burada okunur. 2 yıllık faiz, Fed'in önümüzdeki iki yılda ne yapacağına dair kolektif bahistir.`,
  },

  /* ---------------------------------------------------------------------- */
  {
    slug: "bilanco",
    title: "Bilanço Nedir, Nasıl Okunur?",
    dek: "Üç ayda bir açılan kapak — ve piyasanın gerçekten baktığı üç satır.",
    topic: "sirket",
    glyph: "EPS",
    related: ["temettu", "volatilite"],
    bodyMd: `Halka açık şirketler üç ayda bir hesap verir. Türkçede hepsine "bilanço" denir; teknik olarak açıklanan şey bir bilanço tablosundan ibaret değildir, çeyrek sonuçlarının tamamıdır.

::: tanim Çeyrek sonuçları
Şirketin üç aylık dönemde ne kadar sattığını (**gelir**), bundan geriye ne kadar kâr kaldığını (**net kâr**) ve bunun hisse başına kaç dolara denk geldiğini (**EPS**) açıklaması. Yanında genellikle bir de **öngörü** (guidance) verilir: gelecek çeyrek ve yıl için şirketin kendi beklentisi.
:::

## Piyasanın baktığı üç satır

**1. Gelir (revenue).** Toplam satış. Marjlardan ve muhasebeden bağımsızdır, bu yüzden en zor manipüle edilen sayıdır. Büyüme oranı, geçen yılın aynı çeyreğiyle karşılaştırılır.

**2. EPS (hisse başına kâr).** Net kârın hisse sayısına bölünmüş hâli. Bir hissenin o dönemde ne kadar kâr ürettiğini gösterir.

**3. Öngörü (guidance).** Şirketin gelecek dönem beklentisi. **Çoğu gün en önemlisi budur.** Geçmiş çeyrek harika olup öngörü zayıf geldiğinde hisse sert düşer; tersi de olur.

::: dikkat "Beklentiyi tutturdu" ne demek
Analistler her çeyrek için bir konsensüs beklentisi yayımlar. Piyasayı hareket ettiren şey mutlak rakam değil, **beklentiden sapmadır** (surprise). Kârı %40 artan bir şirket, piyasa %55 beklediği için düşebilir. Fiyat, gerçekleşene değil, gerçekleşen ile beklenenin farkına tepki verir.
:::

## Dört olasılık

| Gelir | EPS | Tipik tepki |
|---|---|---|
| Tuttu | Tuttu | Öngörü ne dedi, ona bakılır |
| Iskaladı | Tuttu | Kötü — kâr maliyet kısarak yapılmış olabilir |
| Tuttu | Iskaladı | Marj sorunu — sorgulanır |
| Iskaladı | Iskaladı | Sert satış |

İkinci satır çoğu kişiyi şaşırtır: kârı tutturup geliri ıskalayan şirket sık sık satılır. Sebep şudur — maliyet kısarak kâr yapmanın bir sınırı vardır, satış büyümesinin yoktur.

## Ne zaman açıklanır

| Zamanlama | Kısaltma | Anlamı |
|---|---|---|
| Açılış öncesi | BMO (*before market open*) | Seans başlamadan, genellikle 07:00–09:00 NY |
| Kapanış sonrası | AMC (*after market close*) | Seans bittikten sonra, genellikle 16:05–16:30 NY |

Büyük şirketlerin çoğu kapanış sonrasını tercih eder: piyasa kapalıyken haber sindirilsin, telekonferans yapılsın, ertesi sabah fiyat oluşsun diye. Bu yüzden bir hissenin bilanço tepkisi çoğunlukla **ertesi günün açılışında** görünür ve gün içi grafikte büyük bir boşluk (gap) olarak durur.

::: ornek Telekonferans
Sayılar yayımlandıktan yaklaşık bir saat sonra yönetim analistlerle telekonferans yapar. Rakamlar iyi olup hisse toplantı sırasında düşüyorsa, sebep neredeyse her zaman sözlü öngörüdür: bir yöneticinin "önümüzdeki çeyrekte talepte normalleşme bekliyoruz" cümlesi, tablodaki hiçbir sayının anlatmadığı bir hikâye anlatır.
:::

## Bu sitede nerede görürsün

- **Bilançolar** ekranı: gün gün takvim, açılış öncesi / kapanış sonrası etiketiyle. Kartlarda gelir beklentisi, EPS beklentisi ve şirketin piyasa değeri birlikte durur — büyüklüğü bilmeden rakamın anlamı eksik kalır.
- **Hisse sayfası → Geçmiş Bilançolar:** açıklanan EPS ile beklenen EPS yan yana; sapma yüzdesi hesaplı.
- **Bugünün Akışı:** o gün bilanço açıklayan şirketler, ekonomik verilerle aynı zaman ekseninde.`,
  },

  /* ---------------------------------------------------------------------- */
  {
    slug: "temettu",
    title: "Temettü Nedir?",
    dek: "Şirketin kârını hissedarla paylaşması — ve bunun bedava para olmadığı gerçeği.",
    topic: "sirket",
    glyph: "%",
    related: ["bilanco", "etf"],
    bodyMd: `Bir şirket kâr ettiğinde iki seçeneği vardır: parayı işine geri koymak ya da hissedarına dağıtmak. İkincisinin adı **temettü**dür.

::: tanim Temettü (dividend)
Şirketin kârının bir kısmını, sahip olunan hisse başına nakit olarak hissedarlara dağıtması. ABD'de genellikle üç ayda bir ödenir; Avrupa'da çoğunlukla yılda bir veya iki kez.
:::

## Verim nasıl hesaplanır

**Temettü verimi = yıllık temettü ÷ hisse fiyatı**

Hissesi 100 dolar olan ve yılda 3 dolar dağıtan bir şirketin verimi %3'tür.

::: dikkat Yüksek verim iyi haber olmayabilir
Formülün paydası fiyattır. Hisse yarıya düştüğünde verim ikiye katlanır — şirket hiçbir şey yapmasa bile. Alışılmadık derecede yüksek bir verim çoğu zaman piyasanın "bu temettü sürdürülemez" dediği anlamına gelir. Buna *temettü tuzağı* denir ve kesinti geldiğinde hem gelir hem sermaye kaybedilir.
:::

## Dört tarih

| Tarih | Ne olur |
|---|---|
| Açıklama (declaration) | Şirket tutarı ve takvimi duyurur |
| **Temettüsüz işlem (ex-dividend)** | Bu günden itibaren alan temettüyü ALAMAZ |
| Kayıt (record) | Hissedar listesi dondurulur |
| Ödeme (payment) | Para hesaba geçer |

En kritik olanı ikincisidir. Temettüsüz işlem gününün sabahında hisse, dağıtılacak tutar kadar **düşük açar**. Bu bir satış dalgası değil, muhasebedir: 3 dolar dağıtacak bir şirketin kasasında artık 3 dolar daha az vardır.

> Temettü bedava para değildir. Şirketin senin cebine aktardığı kendi öz sermayesidir.

Bunu anlamak, "temettü gününden bir gün önce alıp ertesi gün satarım" fikrinin neden işlemediğini de açıklar.

## Kim dağıtır, kim dağıtmaz

**Dağıtanlar:** Olgun, nakit üreten, büyüme fırsatı sınırlı şirketler — kamu hizmetleri, büyük gıda ve içecek markaları, telekom, bankalar, sigorta.

**Dağıtmayanlar:** Büyüyen şirketler. Yılda %30 büyüyen bir şirket için kârı işe geri koymak, hissedara dağıtmaktan daha değerlidir. Teknoloji tarafında temettü ödemeye başlamak çoğu zaman "artık olgunlaştık" mesajı olarak okunur ve bazı yatırımcılar için iyi, bazıları için kötü haberdir.

::: ornek Geri alım (buyback)
ABD'de şirketler kâr paylaşımını sık sık temettü yerine **hisse geri alımıyla** yapar: piyasadan kendi hissesini toplar ve iptal eder. Hisse sayısı azaldığı için kalan her hissenin payı büyür; EPS artar. Ekonomik olarak temettüye benzer, vergisel olarak farklıdır ve — temettünün aksine — sessizce durdurulabilir.
:::

## Toplam getiri

Bir hisseden kazancın iki bileşeni vardır:

1. **Sermaye kazancı:** Fiyatın yükselmesi.
2. **Temettü getirisi:** Dağıtılan nakit.

İkisinin toplamına **toplam getiri** denir. Endeks grafiklerinin çoğu yalnızca fiyatı gösterir; temettüler yeniden yatırıldığında uzun dönem farkı büyüktür. Onlarca yıllık ölçekte S&P 500'ün toplam getirisinin kayda değer bir kısmı temettülerden gelir. "Endeks 20 yılda şu kadar yükseldi" cümlesi, gerçek getiriyi olduğundan düşük anlatır.

## Bu sitede nerede görürsün

Hisse sayfasındaki **Anahtar Metrikler** kartında temettü verimi yer alır. Verimi yorumlarken şirketin sektörüne bakmak gerekir: bir kamu hizmeti şirketi için %4 normal, bir yazılım şirketi için aynı sayı sorulacak bir sorudur.`,
  },
];

const BY_SLUG = new Map(GUIDE_ARTICLES.map((article) => [article.slug, article]));

export function guideArticle(slug: string): GuideArticle | null {
  return BY_SLUG.get(slug) ?? null;
}

export function guideTopicLabel(key: GuideTopicKey, locale: string): string {
  const topic = GUIDE_TOPICS.find((entry) => entry.key === key);
  if (!topic) return key;
  return locale === "tr" ? topic.labelTr : topic.labelEn;
}
