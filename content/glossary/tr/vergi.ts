/* Sözlük — Vergi ve Türkiye (Türkçe). Yapı `../meta.ts`te. */
import type { GlossaryTexts } from "../meta";

export const TR_VERGI: GlossaryTexts<"vergi"> = {
  "w-8ben": {
    term: "W-8BEN Formu",
    definition:
      "ABD vergi idaresinin (IRS) formudur; ABD'de vergi mukimi olmadığını beyan eden bireyler doldurur ve aracı kuruma verir. Formu veren Türkiye mukimi yatırımcı, Türkiye ile ABD arasındaki vergi anlaşmasından yararlanır ve portföy temettülerinde kesinti varsayılan %30 yerine %20 olur. Form genellikle imzalandığı yılı izleyen üçüncü takvim yılının sonuna kadar geçerlidir; adres ya da mukimlik değişirse daha önce yenilenmesi gerekir. Güncel oran ve sınırlar değişebilir; kendi durumun için bir mali müşavire danış.",
    example:
      "Brüt 100 dolarlık bir ABD temettüsünden, geçerli W-8BEN ile 20 dolar kesilir ve hesabına 80 dolar geçer. Form yoksa 30 dolar kesilir, 70 dolar kalır.",
    match: ["W-8BEN"],
  },
  "form-1042-s": {
    term: "Form 1042-S",
    definition:
      "ABD kaynaklı gelir elde eden yabancılara aracı kurumun ya da ödeyicinin gönderdiği yıllık bildirimdir. Yıl içinde ödenen brüt temettü gibi gelirleri, uygulanan kesinti oranını ve ABD'de kesilen vergi tutarını gösterir. Her yıl 15 Mart'a kadar gönderilir. Türkiye'deki beyannamede yurt dışında ödenen vergiyi belgelemek için kullanılır. Güncel oran ve sınırlar değişebilir; kendi durumun için bir mali müşavire danış.",
    match: ["1042-S", "Form 1042-S"],
  },
  "stopaj": {
    term: "Stopaj",
    definition:
      "Verginin, geliri ödeyen tarafından ödeme anında kesilip vergi idaresine yatırılmasıdır; yatırımcının hesabına net tutar geçer. ABD hisselerinde stopaj temettüden kesilir: Türkiye mukimi, W-8BEN formu vermiş bir yatırımcı için portföy temettülerinde oran %20, form yoksa %30'dur. ABD, mukimi olmayan yatırımcıların hisse satış kazancından genellikle vergi kesmez. Güncel oran ve sınırlar değişebilir; kendi durumun için bir mali müşavire danış.",
    example:
      "Hisse başına 1 dolar temettü ödeyen bir şirketin 100 hissesine sahipsen, W-8BEN ile 20 dolar stopaj kesilir ve hesabına 80 dolar geçer.",
    match: ["stopaj", "kaynakta kesinti"],
  },
  "cifte-vergilendirmeyi-onleme": {
    term: "Çifte Vergilendirmeyi Önleme Anlaşması",
    definition:
      "İki ülkenin aynı gelirin iki kez tam vergilendirilmesini önlemek için imzaladığı anlaşmadır; hangi ülkenin hangi geliri hangi oranla vergileyebileceğini belirler. Türkiye ile ABD arasındaki anlaşma, Türkiye mukiminin ABD portföy temettülerinde kaynakta kesintiyi %20 ile sınırlar. ABD'de kesilen bu vergi, Türkiye'deki beyannamede o gelire düşen Türk vergisini aşmamak kaydıyla hesaplanan vergiden mahsup edilebilir. Güncel oran ve sınırlar değişebilir; kendi durumun için bir mali müşavire danış.",
    match: ["çifte vergilendirmeyi önleme anlaşması", "çifte vergilendirmeyi önleme", "çifte vergilendirme"],
  },
  "beyanname": {
    term: "Yıllık Gelir Vergisi Beyannamesi",
    definition:
      "Türkiye'de bir takvim yılında elde edilen ve beyana tabi gelirlerin, izleyen yılın mart ayında vergi idaresine bildirildiği beyannamedir. Yurt dışı hisselerden elde edilen satış kazançları ve temettüler, tutar ve şartlara bağlı olarak bu beyannameye girebilir. Yurt dışında kesilen vergi belgelenerek, sınırlar içinde beyannamede mahsup edilebilir; Form 1042-S bu belgelerden biridir. Güncel oran ve sınırlar değişebilir; kendi durumun için bir mali müşavire danış.",
    match: ["gelir vergisi beyannamesi", "beyanname"],
  },
  "deger-artis-kazanci": {
    term: "Değer Artış Kazancı",
    definition:
      "Türk vergi mevzuatında menkul kıymet gibi varlıkların elden çıkarılmasından doğan kazancın adıdır. Yurt dışı borsadaki bir hisse için kazanç Türk lirası üzerinden hesaplanır: satış bedeli satış tarihindeki kurla, alış bedeli alış tarihindeki kurla liraya çevrilir ve aradaki fark kazançtır. Bu yüzden dolar bazında kâr etmesen de kurdaki artış lira bazında kazanç doğurabilir. Güncel oran ve sınırlar değişebilir; kendi durumun için bir mali müşavire danış.",
    example:
      "Kur 30 liradayken 100 dolardan 10 hisse aldın (maliyet 30.000 lira), kur 35 liradayken 120 dolardan sattın (satış 42.000 lira). Dolar bazında kazanç 200 dolar, endekslemeden önceki lira bazındaki kazanç 12.000 liradır.",
    match: ["değer artış kazancı", "değer artışı kazancı"],
  },
  "yi-ufe-endekslemesi": {
    term: "Yİ-ÜFE Endekslemesi",
    definition:
      "Değer artış kazancı hesaplanırken alış maliyetinin enflasyona göre artırılmasıdır. Yurt içi üretici fiyat endeksi (Yİ-ÜFE), alıştan önceki aydan satıştan önceki aya kadar en az %10 arttıysa, maliyet bu artış oranında yükseltilir ve vergiye yalnızca kalan kazanç konu olur. Artış %10'un altındaysa endeksleme yapılmaz. Güncel oran ve sınırlar değişebilir; kendi durumun için bir mali müşavire danış.",
    example:
      "Lira bazında maliyetin 30.000, satış bedelin 42.000 lira olsun. Yİ-ÜFE ilgili dönemde %25 arttıysa endekslenmiş maliyet 37.500 lira, vergiye konu kazanç 4.500 liradır. Endeks yalnızca %8 arttıysa maliyet 30.000 lirada kalır.",
    match: ["Yİ-ÜFE endekslemesi", "maliyet endekslemesi"],
  },
  "kur-farki": {
    term: "Kur Farkı",
    definition:
      "Döviz cinsinden bir varlığın değerinin, yalnızca döviz kurundaki değişim yüzünden liraya çevrildiğinde değişmesidir. Dolar bazında hiç kıpırdamayan bir ABD hissesi, dolar lira karşısında değer kazandıkça lira bazında kazanç gösterir; tersi de geçerlidir. Türkiye'de yurt dışı hisse satışındaki kazanç lira üzerinden hesaplandığı için bu fark vergi matrahına da yansır. Güncel oran ve sınırlar değişebilir; kendi durumun için bir mali müşavire danış.",
    example:
      "100 dolarlık bir hisse bir yıl sonra yine 100 dolar olsun. Kur bu sürede 30 liradan 35 liraya çıktıysa hissenin lira karşılığı 3.000'den 3.500 liraya yükselir.",
    match: ["kur farkı"],
  },
};
