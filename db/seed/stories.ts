/* ==========================================================================
   Açılış dosyası

   `stories` tablosu normalde Claude rutini tarafından doldurulur; bu dosya
   yalnızca ilk kaydı taşır, böylece boş bir veritabanında bile /dosyalar
   ekranı gerçek bir örnekle açılır. Seed idempotenttir: aynı slug ikinci
   kez yazılırsa üzerine geçer, rutin sonradan düzeltirse o kazanır.

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
    title: "439'dan Sıfıra: Bir AI Fonunun 96 Saatte Çöküşü",
    dek: "Yılın ilk yarısını masraflar sonrası %439 getiriyle kapatan Situational Awareness'ın tüm halka açık kitabı — long ve short, hepsi — dört gün içinde tek blokta Citadel'e geçti.",
    eventDate: "2026-07-30",
    symbols: ["MU", "CRWV", "NBIS", "SNDK", "BE", "ADBE"],
    sources: [
      { label: "Financial Times" },
      { label: "CNBC" },
      { label: "Wall Street Journal" },
      { label: "Bloomberg" },
    ],
    bodyMd: `Wall Street'te bir fonun bittiğini anlamanın en net işareti, portföyünün tek bir blokta el değiştirmesidir. 30 Temmuz sabahı, ABD piyasaları açılmadan önce, Leopold Aschenbrenner'ın Situational Awareness LP fonunun halka açık hisse kitabının tamamı — long ve short, hepsi — Ken Griffin'in Citadel'ine geçti.

Altı ay önce aynı fon, yılın ilk yarısını masraflar sonrası yüzde 439 getiriyle kapatmıştı.

## Tez

Aschenbrenner'ın hikâyesi, AI çağının yatırım folklorunda kendine hızla yer edinmişti. 2024'te OpenAI'dan ayrıldıktan sonra yayımladığı "Situational Awareness" başlıklı uzun manifesto, yapay genel zekânın sanılandan çok daha yakın olduğunu ve bunun devasa bir fiziksel altyapı yatırımı dalgası anlamına geldiğini savunuyordu. Çip, bellek, veri merkezi, elektrik üretimi.

Sonra bu tezin arkasına para koydu. Fon 2024 sonunda yaklaşık 225 milyon dolarla açıldı. Yatırımcı listesi, teze kimlerin inandığını gösteriyordu: Stripe'ın kurucuları Patrick ve John Collison, Nat Friedman, Daniel Gross ve — bir hedge fon için sıra dışı biçimde — Jane Street.

İki yıl dolmadan fon 20 milyar doları aştı. CNBC'ye konuşan bir kaynağa göre Temmuz başında büyüklük 45 milyar dolara kadar çıkmıştı. Aschenbrenner o sırada 25 yaşındaydı.

## Kırılganlık

Yüzde 439'luk getiri kendi kendine oluşmadı. İki mekanizma vardı: yoğunlaşma ve kaldıraç.

Fonun açıklanan long kitabında ilk beş pozisyon toplamın dörtte üçünden fazlasını oluşturuyordu — SK Hynix, [Nebius](/hisse/NBIS), [CoreWeave](/hisse/CRWV), [Micron](/hisse/MU), [SanDisk](/hisse/SNDK), [Bloom Energy](/hisse/BE). Hepsi aynı tezin farklı ifadeleriydi. Üstüne, brüt maruziyet yaklaşık 4x kaldıraçla taşınıyordu.

Aynı zamanda fon yazılım hisselerine karşı short pozisyondaydı. "Uzun çip, kısa yazılım" — AI'ın yazılım marjlarını eritirken altyapı talebini patlatacağı fikri. 2026'nın tanımlayıcı işlemiydi ve Aschenbrenner bunu ödünç parayla uç noktasına taşımıştı.

Bu yapı yükselişte muhteşem çalışır. Düşüşte ise iki bacaktan aynı anda kanatır.

## Temmuz

Temmuz'da AI altyapı hisseleri satıldı ve satış sıradan bir düzeltme olmaktan çıktı. Fonun çekirdek pozisyonları ay içinde yüzde 27 ile 54 arasında değer kaybetti. Nasdaq 100 zirveden yüzde 10'dan fazla geriledi. SK Hynix'in evi olan Kore Kospi endeksi neredeyse yüzde 40 düştü. Philadelphia Yarı İletken Endeksi 22 Haziran zirvesinden yüzde 28,6 aşağıdaydı.

Aynı anda [Adobe](/hisse/ADBE) gibi isimlerdeki short pozisyonlar ters yönde hareket etti.

Yaklaşık 4x kaldıraçlı bir portföyde çekirdek varlıkların yüzde 30 küsur düşmesi, öz sermaye yastığını tüketmeye yeter. Fonun üç prime broker'ı — Goldman Sachs, JPMorgan Chase ve Bank of America — teminat tamamlama çağrısı gönderdi.

## Dört gün

Sonrasında olanlar, Financial Times ve CNBC'nin aktardığına göre klasik bir margin call koreografisi:

**24 Temmuz.** Aschenbrenner yatırımcılara mektup yazar. Fonun satış dalgasından muaf olmadığını kabul eder, ancak bunu 2025 başından bu yana en iyi alım fırsatlarından biri olarak niteler. Mektubun sonuna bir not düşer: 1 Ağustos'ta yeni sermaye kabul edilecektir.

**Hafta ortası.** Fon mevcut yatırımcılara ve kreditörlere taze para için başvurur. Bazılarına doğrudan portföyden varlık satın alma teklifi götürülür.

**29 Temmuz.** Bank of America, Goldman Sachs ve JPMorgan, fonun pozisyonlarını — hem long hem short tarafı — piyasada alıcılara pazarlamaya başlar. Wall Street'te bir fonun kitabının broker'lar tarafından dolaştırıldığı duyulduğu anda fiyat aleyhine çalışmaya başlar.

**30 Temmuz, açılış öncesi.** Tek blok işlem. Alıcı Citadel.

Fiyat açıklanmadı. Sosyal medyada dolara 40 sent gibi rakamlar dolaşıyor ancak bunların hiçbir doğrulanmış kaynağı yok.

## Neden Citadel

Griffin'in firması bu rolü daha önce defalarca oynadı. Zorunlu satıcının karşısına geçip likidite sağlamak, Citadel'in birden fazla piyasa döngüsünde tekrarladığı bir iş modeli. Mantık şudur: pozisyonların temel değeri ile satıcının zaman baskısı arasındaki fark, alıcının kârıdır.

Bu yüzden işlemin iki okuması var. Karamsar okuma: AI altyapısı o kadar kötü durumda ki koca bir fon silindi. İyimser okuma: Citadel bu hisseleri almaya değer buldu — yani sorun varlıkların kendisinde değil, onları taşıyan sermaye yapısındaydı. Ayrıca piyasadaki en büyük zorunlu satıcı artık ortadan kalkmış oldu.

## Geriye kalan

Situational Awareness kapanmıyor. Özel şirket yatırımları duruyor ve bunların en büyüğü, FT'nin yaklaşık 5 milyar dolar değer biçtiği Anthropic hissesi.

Bunun tesadüf olmadığını görmek gerekiyor. Prime broker'lar teminatı günlük fiyatlanabilen varlıklar üzerinden tutar. Özel bir şirketin hissesinin günlük piyasa fiyatı yoktur; dolayısıyla teminat çağrısına konu edilemez. Kaldıracın öldürdüğü şey tam olarak likit kısımdı.

Sonuçta ortaya çıkan yapı ilginç: Situational Awareness artık kaldıraçlı bir halka açık piyasa fonu değil, üstüne bir hedge fon iliştirilmiş yoğunlaşmış bir Anthropic holdingi. Fonun en uzun vadeli, en yüksek inançlı pozisyonu ayakta kaldı; onu tehdit eden yapısal kırılganlık ise yok oldu.

Firma sözcüsü, Anthropic hissesinin satışa çıkarıldığı yönündeki haberleri yalanladı. CNBC ise fonun özel varlıklarını satmaya çalıştığını bildirmişti. Bu noktada bilgiler çelişiyor.

## Ders

Aschenbrenner'ın tezi bu hafta yanlışlanmadı. Yapay zekâ altyapısına yönelik talep hakkında söylediklerinin doğru olup olmadığı hâlâ önümüzdeki yılların sorusu.

Yanlışlanan şey, o teze verilen ifadenin biçimiydi.

::: ozet Kaldıracın gerçek maliyeti
Kaldıraç, bir yatırımın sahibi ile takvimin sahibini birbirinden ayırır. Ödünç parayla pozisyon taşıdığınızda, ne zaman satacağınıza siz karar vermezsiniz — teminat oranı karar verir. Doğru olduğunuz hâlde iflas edebilirsiniz, çünkü haklı çıkmanız için gereken süre, pozisyonu taşıyabileceğiniz süreden uzun olabilir. Bkz. [Kaldıraç Nedir?](/rehber/kaldirac)
:::

İkinci ders daha geniş bir kitleyi ilgilendiriyor: AI hisseleri birbirinden çok farklı işler yapan şirketler olsalar da piyasa tarafından giderek tek bir kalabalık pozisyon gibi işlem görüyor. Bir bellek üreticisi, bir GPU kiralama şirketi ve bir yakıt hücresi firması aynı anda ve aynı yönde satılıyorsa, portföyünüzde sandığınızdan çok daha az çeşitlendirme var demektir.

Aschenbrenner AI çağının en çok okunan yatırım tezini yazdı. Aynı tezin en pahalı sınavını da o verdi.

---

*Bu yazı 30 Temmuz 2026 itibarıyla Financial Times, CNBC, Wall Street Journal ve Bloomberg'in aktardığı bilgilere dayanıyor. Haberlerin büyük kısmı isimsiz kaynaklara dayanmakta olup taraflardan resmî açıklama yapılmamıştır. Fon büyüklüğü ve işlem fiyatı gibi rakamlar kaynaklar arasında farklılık göstermektedir.*`,
  },
];
