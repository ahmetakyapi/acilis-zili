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
    slug: "leopold-aschenbrenner-96-saat",
    locale: "tr",
    title: "Leopold Aschenbrenner'ın 96 Saati: %439 Kazandı, Dört Günde Bitti",
    dek: "Yılın ilk yarısını masraflar sonrası %439 kârla kapatan Situational Awareness'ın borsadaki bütün pozisyonları — alış da satış da — dört gün içinde tek seferde Citadel'e geçti. Çöken şey fikrin kendisi değil, o fikre nasıl yatırım yapıldığıydı.",
    eventDate: "2026-07-30",
    symbols: ["MU", "CRWV", "NBIS", "SNDK", "BE", "ADBE"],
    sources: [
      { label: "Financial Times" },
      { label: "CNBC" },
      { label: "Wall Street Journal" },
      { label: "Bloomberg" },
    ],
    bodyMd: `Wall Street'te bir fonun bittiğini anlamanın en net işareti, portföyünün tek bir blokta el değiştirmesidir. Kimse duyuru yapmaz, kimse "kapanıyoruz" demez. Sadece bir sabah, borsa açılmadan önce, elindeki her şey tek bir alıcıya geçer.

30 Temmuz sabahı olan buydu. Leopold Aschenbrenner'ın Situational Awareness LP fonunun borsadaki bütün pozisyonları — hem aldıkları hem açığa sattıkları — Ken Griffin'in Citadel'ine geçti.

Altı ay önce aynı fon, yılın ilk yarısını masraflar düşüldükten sonra **yüzde 439** kârla kapatmıştı.

::: sayilar Rakamlarla
%439 | 2026'nın ilk yarısındaki kâr
45 Mr $ | Temmuz başındaki en büyük hâli
~4 kat | Kendi parasına göre taşıdığı pozisyon
96 saat | Yatırımcı mektubundan satışa
:::

## Manifestodan Fona: Tezin Doğuşu

Aschenbrenner'ın hikâyesi, yatırım çevrelerinde hızla anlatılan bir efsaneye dönüşmüştü. 2024'te OpenAI'dan ayrıldıktan sonra yayımladığı "Situational Awareness" başlıklı uzun metin tek bir iddiaya dayanıyordu: yapay genel zekâ sanılandan çok daha yakın ve bu, tarihin en büyük fiziksel altyapı yatırımı dalgasını tetikleyecek.

Bu fikrin güçlü yanı, havada kalan bir öngörüyü **satın alınabilir** şeylere çevirmesiydi. Yapay zekâ hızlanacaksa çip lazım. Çip çalışacaksa bellek lazım. İkisi de bir binaya konacaksa veri merkezi lazım. Veri merkezi çalışacaksa elektrik lazım. Ortaya çıkan şey bir düşünce yazısı değil, bir alışveriş listesiydi.

Sonra bu listenin arkasına kendi parasını koydu. Fon 2024 sonunda yaklaşık 225 milyon dolarla açıldı. Kimlerin bu fikre inandığı, yatırımcı listesinden belliydi: Stripe'ın kurucuları Patrick ve John Collison, Nat Friedman, Daniel Gross ve — bir fon için alışılmadık biçimde — Jane Street.

İki yıl dolmadan fon 20 milyar doları aştı. CNBC'ye konuşan bir kaynağa göre Temmuz başında büyüklük 45 milyar dolara kadar çıkmıştı. Aschenbrenner o sırada 25 yaşındaydı.

## İki Kırılganlık: Yoğunlaşma ve Kaldıraç

Yüzde 439'luk bir kâr kendiliğinden çıkmaz. Böyle bir sayıya ulaşmanın tek yolu haklı olmak değil, haklı olduğun şeye **çok yüklenmektir**. Burada iki şey aynı anda yapıldı.

**Birincisi, her şey birkaç hisseye yığılmıştı.** Fonun açıkladığı portföyde en büyük beş pozisyon, toplamın dörtte üçünden fazlasıydı: SK Hynix, [Nebius](/hisse/NBIS), [CoreWeave](/hisse/CRWV), [Micron](/hisse/MU), [SanDisk](/hisse/SNDK), [Bloom Energy](/hisse/BE). Farklı sektörlerde, farklı işler yapan altı şirket — ama hepsi aynı cümlenin farklı hâlleri.

**İkincisi, bunu ödünç parayla yaptı.** Fon kendi parasının yaklaşık dört katı büyüklüğünde pozisyon taşıyordu: her 1 dolara karşılık piyasada 4 dolarlık hisse.

Bir de üçüncü katman vardı. Fon aynı anda yazılım hisselerinin **düşeceğine** oynuyordu: "çipi al, yazılımı sat" — yapay zekânın yazılım şirketlerinin kârını eritirken altyapıya olan talebi patlatacağı fikri. 2026'nın en çok konuşulan işlemiydi.

::: dikkat Eşleştirilmiş İşlem Neden Daha Güvenli Değildir
Bir tarafı alış, diğer tarafı satış olan pozisyonlar ilk bakışta "dengeli" görünür. Değildir. Fikir tutarsa iki taraf birlikte kazandırır; fikir ters dönerse **iki taraf birlikte kaybettirir** — çipler düşerken yazılımlar yükselir. Risk azalmaz, sadece yer değiştirir. Ayrıntı: [Long ve Short Ne Demek?](/rehber/long-short)
:::

## Kaldıracın Aritmetiği

Bu yapının neden çöktüğünü anlamak için tek bir hesap yeter.

::: ornek 100 Birim Öz Sermaye, 4x Kaldıraç
Elinde 100 liran var ve ödünç parayla 400 liralık hisse tutuyorsun. Hisseler **%25 düşerse** kaybın 100 lira — yani paranın tamamı. %30 düşerse kayıp 120 lira, yani sende olandan fazlası.

Ama iş o noktaya gelmez. Aracı kurum çok daha önce kapıyı çalar ve "teminatı tamamla" der. Dört kat borçla taşınan bir portföyde bunun için **%10–12'lik bir düşüş** yeter — ki bu borsada gayet sıradan bir geri çekilmedir.
:::

Asıl mesele kaybın büyüklüğü değil, **satma kararının kime geçtiği**. Kaldıraçsız bir pozisyonda ne zaman satacağına sen karar verirsin; fiyat yarıya inse bile beklemeyi seçebilirsin, çünkü kimseye borçlu değilsin. Ödünç parayla aldığında bu kararı sen değil aracı kurum verir — üstelik tam da fiyatın en kötü olduğu anda, çünkü çağrı zaten o yüzden gelmiştir.

## Temmuz: Tezin Sınandığı Ay

Temmuz'da yapay zekâ altyapı hisseleri satıldı ve satış sıradan bir düzeltme olmaktan çıktı.

::: bar Temmuz'da Zirveden Geri Çekilme
Fonun çekirdek pozisyonları | -%54
Kore Kospi (SK Hynix) | -%40
Philadelphia Yarı İletken | -%28,6
Nasdaq 100 | -%10
:::

Çubukların anlattığı şey şu: düşüş bütün borsaya değil, tam olarak fonun durduğu yere geldi. Nasdaq 100 zirveden yüzde 10 civarında geri çekilirken fonun çekirdek pozisyonları yüzde 27 ile 54 arasında değer kaybetti. SK Hynix'in evi olan Kore borsası neredeyse yüzde 40 düştü.

Aşağıdaki grafikler canlıdır: olayın kendisini değil, o hisselerin bugün nerede olduğunu gösterir.

::: grafik MU | 3M | Fonun en büyük pozisyonlarından Micron — bugünden geriye üç ay
:::

Aynı hafta [Adobe](/hisse/ADBE) gibi düşeceğine oynadığı hisseler yükseldi. Portföyün iki tarafı da aynı anda zarar etti.

Dört kat borçla taşınan bir portföyde ana hisselerin yüzde 30 küsur düşmesi, elde kalan parayı bitirmeye fazlasıyla yeter. Fona kredi veren üç banka — Goldman Sachs, JPMorgan Chase ve Bank of America — teminat tamamlama çağrısı gönderdi.

## Dört Günde Biten Fon

Sonrasında olanlar, Financial Times ve CNBC'nin aktardığına göre bu tür çöküşlerde hep aynı sırayla ilerledi: yavaş başlar, sonra birdenbire biter.

::: zaman Kronoloji
24 Temmuz | Aschenbrenner yatırımcılara mektup yazar. Fonun da bu satıştan etkilendiğini kabul eder ama bunun 2025 başından bu yana **en iyi alım fırsatlarından biri** olduğunu söyler. Mektubun sonunda bir not vardır: 1 Ağustos'ta yeni sermaye kabul edilecektir.
Hafta ortası | Fon mevcut yatırımcılarına ve alacaklılarına taze para için başvurur. Bazılarına doğrudan portföyden hisse satın alma teklifi götürülür.
29 Temmuz | Bank of America, Goldman Sachs ve JPMorgan, fonun bütün pozisyonlarını piyasada alıcı aramaya başlar.
30 Temmuz · borsa açılmadan | Her şey tek seferde satılır. Alıcı Citadel.
:::

Üçüncü satır, hikâyenin gerçekten bittiği andır. Bir fonun portföyünün bankalar tarafından ortalıkta dolaştırıldığı duyulduğu anda fiyat aleyhine dönmeye başlar: herkes o hisselerin satılmak **zorunda** olduğunu bilir ve teklifini ona göre verir.

İşlem fiyatı açıklanmadı. Sosyal medyada dolara 40 sent gibi rakamlar dolaşıyor ancak bunların doğrulanmış bir kaynağı yok.

Karşılaştırma için borsanın geneli:

::: grafik QQQ | 3M | Nasdaq 100'ü izleyen QQQ — aynı üç aylık pencere
:::

## Neden Alıcı Citadel Oldu

Griffin'in şirketi bu rolü daha önce defalarca oynadı. Satmak zorunda kalan tarafın karşısına geçip alıcı olmak, Citadel'in yıllardır tekrarladığı bir iş modeli. Mantığı basittir: **pozisyonların temel değeri ile satıcının zaman baskısı arasındaki fark, alıcının kârıdır.**

Bu yüzden işlemin iki farklı okuması var ve ikisi de savunulabilir:

| Okuma | İddia | Zayıf noktası |
|---|---|---|
| Karamsar | Yapay zekâ altyapısı o kadar kötü durumda ki koca bir fon bitti | Fonu bitiren şey hisseler değil, ödünç parayla kurulan yapıydı |
| İyimser | Citadel bu hisseleri almaya değer buldu; sorun hisselerde değildi | Citadel indirimli aldı; "ucuz" demek "değerli" demek değildir |

Kesin olan tek şey ikisinin ortasında: piyasada satmak zorunda olan **en büyük taraf** artık yok.

## Geriye Ne Kaldı

Situational Awareness kapanmıyor. Borsada işlem görmeyen şirketlerdeki yatırımları duruyor ve bunların en büyüğü, Financial Times'ın yaklaşık 5 milyar dolar değer biçtiği Anthropic hissesi.

Bunun tesadüf olmadığını görmek gerekiyor ve sebebi teknik:

> Aracı kurumlar teminatı, her gün fiyatı belli olan varlıklar üzerinden hesaplar. Borsada işlem görmeyen bir şirketin günlük fiyatı yoktur; dolayısıyla teminat çağrısına da girmez.

Ödünç paranın öldürdüğü şey tam olarak **borsadaki kısımdı**. Orası her gün yeniden fiyatlandığı için her gün teminat hesabına girdi; diğerleri hiç girmedi.

Geriye ilginç bir yapı kaldı: Situational Awareness artık ödünç parayla borsada oynayan bir fon değil, **ağırlıklı olarak Anthropic hissesi tutan** bir yatırım şirketi. Fonun en uzun vadeli, en çok inandığı pozisyonu ayakta kaldı; onu tehdit eden kırılganlık ise ortadan kalktı.

Fonun sözcüsü, Anthropic hissesinin satışa çıkarıldığı haberlerini yalanladı. CNBC ise fonun bu yatırımlarını satmaya çalıştığını yazmıştı. Bu noktada kaynaklar çelişiyor.

## Alınacak Ders: Ne Zaman Satacağına Sen Karar Vermezsin

Aschenbrenner'ın fikri bu hafta çürütülmedi. Yapay zekâ altyapısına olan talep hakkında söyledikleri doğru mu, bunun cevabı hâlâ önümüzdeki yıllarda.

Çöken şey fikrin kendisi değil, **o fikre nasıl yatırım yapıldığıydı**.

::: ozet Kaldıracın Gerçek Maliyeti
Ödünç para, hisseyi senin yapar ama takvimi aracı kurumun yapar. Kendi paranla aldığında istediğin kadar bekleyebilirsin; ödünçle aldığında ne zaman satacağına teminat oranı karar verir. **Haklı olduğun hâlde batabilirsin**, çünkü haklı çıkman için gereken süre, dayanabileceğin süreden uzun olabilir. Ayrıntı: [Kaldıraç Nedir?](/rehber/kaldirac)
:::

İkinci ders hiç ödünç para kullanmayanlar için de geçerli: yapay zekâ hisseleri birbirinden çok farklı işler yapan şirketler olsa da piyasa onları giderek **tek bir hisse gibi** alıp satıyor.

Bir bellek üreticisi, bir sunucu kiralama şirketi ve bir enerji firması aynı gün, aynı yönde ve benzer büyüklükte düşüyorsa, portföyün sandığın kadar dağılmamış demektir. Altı ayrı şirket almış olabilirsin ama aslında tek bir cümleye oynuyorsundur.

Aschenbrenner yapay zekâ çağının en çok okunan yatırım metnini yazdı. Aynı fikrin en pahalı sınavını da o verdi.

---

*Bu yazı 30 Temmuz 2026 itibarıyla Financial Times, CNBC, Wall Street Journal ve Bloomberg'in aktardığı bilgilere dayanıyor. Haberlerin büyük kısmı isimsiz kaynaklara dayanmakta olup taraflardan resmî açıklama yapılmamıştır. Fon büyüklüğü ve işlem fiyatı gibi rakamlar kaynaklar arasında farklılık göstermektedir.*`,
  },
];
