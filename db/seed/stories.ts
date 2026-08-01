/* ==========================================================================
   Açılış yazısı

   `stories` tablosu normalde Claude rutini tarafından doldurulur; bu dosya
   yalnızca ilk kaydı taşır, böylece boş bir veritabanında bile /mercek
   ekranı gerçek bir örnekle açılır.

   Seed bu kaydın ÜZERİNE yazar: metin burada, sürüm geçmişiyle birlikte
   düzenleniyor. Rutinin yazdığı yazılar farklı slug'lar kullandığı için
   birbirlerine dokunmuyorlar.

   Gövde `components/article/ArticleBody.tsx` sözdizimini kullanır.
   ========================================================================== */

export type StorySeed = {
  slug: string;
  locale: string;
  title: string;
  dek: string;
  eventDate: string;
  symbols: string[];
  sources: { label: string; url?: string }[];
  bodyMd: string;
};

export const STORY_SEEDS: StorySeed[] = [
  {
    slug: "situational-awareness-tasfiyesi",
    locale: "tr",
    title: "Leopold Aschenbrenner'ın 96 Saati: %439 Getiriden Tasfiyeye",
    dek: "Yılın ilk yarısını masraflar sonrası %439 getiriyle kapatan Situational Awareness'ın tüm halka açık kitabı — long ve short, hepsi — dört gün içinde tek blokta Citadel'e geçti. Tez yanlışlanmadı; o teze verilen ifadenin biçimi yanlışlandı.",
    eventDate: "2026-07-30",
    symbols: ["MU", "CRWV", "NBIS", "SNDK", "BE", "ADBE"],
    sources: [
      { label: "Financial Times" },
      { label: "CNBC" },
      { label: "Wall Street Journal" },
      { label: "Bloomberg" },
    ],
    bodyMd: `Wall Street'te bir fonun bittiğini anlamanın en net işareti, portföyünün tek bir blokta el değiştirmesidir. Kimse duyuru yapmaz, kimse kapanış bildirimi göndermez; sadece bir sabah, açılıştan önce, bütün pozisyonlar tek bir alıcıya geçer.

30 Temmuz sabahı olan buydu. Leopold Aschenbrenner'ın Situational Awareness LP fonunun halka açık hisse kitabının tamamı — long ve short, hepsi — Ken Griffin'in Citadel'ine geçti.

Altı ay önce aynı fon, yılın ilk yarısını masraflar sonrası **yüzde 439** getiriyle kapatmıştı.

::: sayilar Rakamlarla
%439 | 2026 ilk yarı getirisi, masraflar sonrası
45 Mr $ | Temmuz başındaki zirve büyüklük
~4x | Brüt maruziyette kaldıraç
96 saat | Yatırımcı mektubundan blok işleme
:::

## Manifestodan Fona: Tezin Doğuşu

Aschenbrenner'ın hikâyesi, yapay zekâ çağının yatırım folklorunda kendine hızla yer edinmişti. 2024'te OpenAI'dan ayrıldıktan sonra yayımladığı "Situational Awareness" başlıklı uzun manifesto tek bir iddia etrafında kuruluydu: yapay genel zekâ sanılandan çok daha yakın ve bu, tarihin en büyük fiziksel altyapı yatırımı dalgasını tetikleyecek.

Tezin gücü, soyut bir öngörüyü **satın alınabilir** şeylere çevirmesindeydi. Yapay zekâ hızlanacaksa çip lazım. Çip çalışacaksa bellek lazım. İkisi de bir binaya konacaksa veri merkezi lazım. Veri merkezi çalışacaksa elektrik lazım. Manifesto bir felsefe metni değil, bir alışveriş listesiydi.

Sonra bu listenin arkasına para koydu. Fon 2024 sonunda yaklaşık 225 milyon dolarla açıldı. Yatırımcı listesi teze kimlerin inandığını gösteriyordu: Stripe'ın kurucuları Patrick ve John Collison, Nat Friedman, Daniel Gross ve — bir hedge fon için sıra dışı biçimde — Jane Street.

İki yıl dolmadan fon 20 milyar doları aştı. CNBC'ye konuşan bir kaynağa göre Temmuz başında büyüklük 45 milyar dolara kadar çıkmıştı. Aschenbrenner o sırada 25 yaşındaydı.

## İki Kırılganlık: Yoğunlaşma ve Kaldıraç

Yüzde 439'luk getiri kendi kendine oluşmaz. Böyle bir sayı üretmenin tek yolu doğru olmak değil, doğru olduğun şeye **çok yüklenmektir**. Burada iki mekanizma birlikte çalıştı.

**Birincisi yoğunlaşma.** Fonun açıklanan long kitabında ilk beş pozisyon toplamın dörtte üçünden fazlasını oluşturuyordu: SK Hynix, [Nebius](/hisse/NBIS), [CoreWeave](/hisse/CRWV), [Micron](/hisse/MU), [SanDisk](/hisse/SNDK), [Bloom Energy](/hisse/BE). Farklı sektörlerde farklı işler yapan altı şirket — ama hepsi aynı cümlenin farklı ifadeleri.

**İkincisi kaldıraç.** Brüt maruziyet yaklaşık 4x kaldıraçla taşınıyordu: her 1 dolarlık öz sermayeye karşılık piyasada yaklaşık 4 dolarlık pozisyon.

Bir de üçüncü katman vardı. Fon aynı anda yazılım hisselerine karşı **short** pozisyondaydı: "uzun çip, kısa yazılım" — yapay zekânın yazılım marjlarını eritirken altyapı talebini patlatacağı fikri. 2026'nın tanımlayıcı işlemiydi.

::: dikkat Eşleştirilmiş İşlem Neden Daha Güvenli Değildir
Bir tarafı long, diğer tarafı short olan pozisyonlar sezgisel olarak "dengeli" görünür. Değildir. Tez doğruysa iki bacak birlikte kazandırır; tez ters dönerse **iki bacak birlikte kaybettirir** — çipler düşerken yazılımlar yükselir. Risk azalmaz, sadece şeklini değiştirir. Ayrıntı: [Long ve Short Ne Demek?](/rehber/long-short)
:::

## Kaldıracın Aritmetiği

Bu yapının neden kırıldığını anlamak için tek bir hesap yeter.

::: ornek 100 Birim Öz Sermaye, 4x Kaldıraç
Elinde 100 birim öz sermaye var ve 4x brüt maruziyetle 400 birimlik pozisyon taşıyorsun. Varlıkların **%25 düşerse** kaybın 100 birim — yani öz sermayenin tamamı. %30 düşerse kayıp 120 birim, öz sermayeden fazlası.

Ama iflas o noktada gelmez. Aracı kurum çok daha önce, teminat oranı eşiğin altına indiği anda kapıyı çalar. Pratikte 4x kaldıraçta **%10–12'lik bir düşüş** teminat tamamlama çağrısı getirmeye yeter — ki bu borsada sıradan bir düzeltme büyüklüğüdür.
:::

Kritik olan kaybın büyüklüğü değil, **kararın kime geçtiğidir**. Kaldıraçsız bir pozisyonda ne zaman satacağına sen karar verirsin; fiyat yarıya inse bile beklemeyi seçebilirsin, çünkü kimseye borçlu değilsin. Kaldıraçlı bir pozisyonda bu kararı teminat oranı verir — üstelik tam olarak fiyatın en kötü olduğu anda, çünkü çağrı zaten o yüzden gelmiştir.

## Temmuz: Tezin Sınandığı Ay

Temmuz'da yapay zekâ altyapı hisseleri satıldı ve satış sıradan bir düzeltme olmaktan çıktı.

::: bar Temmuz'da Zirveden Geri Çekilme
Fonun çekirdek pozisyonları | -%54
Kore Kospi (SK Hynix) | -%40
Philadelphia Yarı İletken | -%28,6
Nasdaq 100 | -%10
:::

Çubukların anlattığı şey şu: düşüş piyasa geneline değil, tam olarak fonun durduğu yere geldi. Nasdaq 100 zirveden yüzde 10 civarında geri çekilirken fonun çekirdek pozisyonları yüzde 27 ile 54 arasında değer kaybetti. SK Hynix'in evi olan Kore borsası neredeyse yüzde 40 düştü.

Aynı anda [Adobe](/hisse/ADBE) gibi isimlerdeki short pozisyonlar ters yönde hareket etti. Portföyün her iki bacağı da aynı hafta kanadı.

Yaklaşık 4x kaldıraçlı bir portföyde çekirdek varlıkların yüzde 30 küsur düşmesi, öz sermaye yastığını tüketmeye fazlasıyla yeter. Fonun üç prime broker'ı — Goldman Sachs, JPMorgan Chase ve Bank of America — teminat tamamlama çağrısı gönderdi.

## Dört Günde Biten Fon

Sonrasında olanlar, Financial Times ve CNBC'nin aktardığına göre klasik bir teminat çağrısı koreografisi. Bu tür çöküşler yavaş başlar, sonra birdenbire biter.

::: zaman Kronoloji
24 Temmuz | Aschenbrenner yatırımcılara mektup yazar. Fonun satış dalgasından muaf olmadığını kabul eder ama bunu 2025 başından bu yana **en iyi alım fırsatlarından biri** olarak niteler. Mektubun sonunda bir not vardır: 1 Ağustos'ta yeni sermaye kabul edilecektir.
Hafta ortası | Fon mevcut yatırımcılara ve kreditörlere taze para için başvurur. Bazılarına doğrudan portföyden varlık satın alma teklifi götürülür.
29 Temmuz | Bank of America, Goldman Sachs ve JPMorgan, fonun pozisyonlarını — hem long hem short tarafı — piyasada alıcılara pazarlamaya başlar.
30 Temmuz · açılış öncesi | Tek blok işlem. Alıcı Citadel.
:::

Üçüncü satır, hikâyenin gerçekten bittiği andır. Wall Street'te bir fonun kitabının broker'lar tarafından dolaştırıldığı duyulduğu anda fiyat aleyhine çalışmaya başlar: herkes o pozisyonların satılmak **zorunda** olduğunu bilir ve teklifini ona göre verir.

İşlem fiyatı açıklanmadı. Sosyal medyada dolara 40 sent gibi rakamlar dolaşıyor ancak bunların doğrulanmış bir kaynağı yok.

## Neden Alıcı Citadel Oldu

Griffin'in firması bu rolü daha önce defalarca oynadı. Zorunlu satıcının karşısına geçip likidite sağlamak, Citadel'in birden fazla piyasa döngüsünde tekrarladığı bir iş modeli. Mantığı basittir: **pozisyonların temel değeri ile satıcının zaman baskısı arasındaki fark, alıcının kârıdır.**

Bu yüzden işlemin iki farklı okuması var ve ikisi de savunulabilir:

| Okuma | İddia | Zayıf noktası |
|---|---|---|
| Karamsar | Yapay zekâ altyapısı o kadar kötü durumda ki koca bir fon silindi | Fonu silen şey varlıklar değil, sermaye yapısıydı |
| İyimser | Citadel bu hisseleri almaya değer buldu; sorun pozisyonlarda değildi | Citadel iskontoyla aldı, "ucuz" demesi "değerli" demesi anlamına gelmez |

Kesin olan tek şey ikisinin ortasında duruyor: piyasadaki en büyük **zorunlu satıcı** artık ortadan kalktı.

## Geriye Ne Kaldı

Situational Awareness kapanmıyor. Özel şirket yatırımları duruyor ve bunların en büyüğü, Financial Times'ın yaklaşık 5 milyar dolar değer biçtiği Anthropic hissesi.

Bunun tesadüf olmadığını görmek gerekiyor ve sebebi teknik:

> Prime broker'lar teminatı günlük fiyatlanabilen varlıklar üzerinden tutar. Özel bir şirketin hissesinin günlük piyasa fiyatı yoktur; dolayısıyla teminat çağrısına konu edilemez.

Kaldıracın öldürdüğü şey tam olarak **likit kısımdı**. Halka açık kitap her gün yeniden fiyatlandığı için her gün teminat hesabına girdi; özel yatırımlar hiç girmedi.

Sonuçta ortaya çıkan yapı ilginç: Situational Awareness artık kaldıraçlı bir halka açık piyasa fonu değil, üstüne bir hedge fon iliştirilmiş **yoğunlaşmış bir Anthropic holdingi**. Fonun en uzun vadeli, en yüksek inançlı pozisyonu ayakta kaldı; onu tehdit eden yapısal kırılganlık ise yok oldu.

Firma sözcüsü, Anthropic hissesinin satışa çıkarıldığı yönündeki haberleri yalanladı. CNBC ise fonun özel varlıklarını satmaya çalıştığını bildirmişti. Bu noktada kaynaklar çelişiyor.

## Alınacak Ders: Kaldıraç Takvimi Satın Alır

Aschenbrenner'ın tezi bu hafta yanlışlanmadı. Yapay zekâ altyapısına yönelik talep hakkında söylediklerinin doğru olup olmadığı hâlâ önümüzdeki yılların sorusu.

Yanlışlanan şey, o teze verilen **ifadenin biçimiydi**.

::: ozet Kaldıracın Gerçek Maliyeti
Kaldıraç, bir yatırımın sahibi ile takvimin sahibini birbirinden ayırır. Ödünç parayla pozisyon taşıdığında ne zaman satacağına sen karar vermezsin — teminat oranı karar verir. **Doğru olduğun hâlde iflas edebilirsin**, çünkü haklı çıkman için gereken süre, pozisyonu taşıyabileceğin süreden uzun olabilir. Ayrıntı: [Kaldıraç Nedir?](/rehber/kaldirac)
:::

İkinci ders daha geniş bir kitleyi ilgilendiriyor ve hiç kaldıraç kullanmayanlar için de geçerli: yapay zekâ hisseleri birbirinden çok farklı işler yapan şirketler olsalar da piyasa tarafından giderek **tek bir kalabalık pozisyon** gibi işlem görüyor.

Bir bellek üreticisi, bir GPU kiralama şirketi ve bir yakıt hücresi firması aynı gün, aynı yönde ve benzer büyüklükte satılıyorsa, portföyünde sandığından çok daha az çeşitlendirme var demektir. Altı farklı şirket almış olabilirsin ama tek bir cümleye bahis oynuyorsundur.

Aschenbrenner yapay zekâ çağının en çok okunan yatırım tezini yazdı. Aynı tezin en pahalı sınavını da o verdi.

---

*Bu yazı 30 Temmuz 2026 itibarıyla Financial Times, CNBC, Wall Street Journal ve Bloomberg'in aktardığı bilgilere dayanıyor. Haberlerin büyük kısmı isimsiz kaynaklara dayanmakta olup taraflardan resmî açıklama yapılmamıştır. Fon büyüklüğü ve işlem fiyatı gibi rakamlar kaynaklar arasında farklılık göstermektedir.*`,
  },
];
