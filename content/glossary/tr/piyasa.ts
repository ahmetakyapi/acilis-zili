/* Sözlük — Piyasa İşleyişi (Türkçe). Yapı `../meta.ts`te. */
import type { GlossaryTexts } from "../meta";

export const TR_PIYASA: GlossaryTexts<"piyasa"> = {
  "alis-satis-fiyati": {
    term: "Alış ve Satış Fiyatı (Bid/Ask)",
    definition:
      "Alış fiyatı (bid), o anda bir hisseyi almak isteyenlerin verdiği en yüksek fiyattır; satış fiyatı (ask) ise satmak isteyenlerin kabul ettiği en düşük fiyat. Ekranda gördüğün son fiyat bir önceki işlemin fiyatıdır; şimdi piyasa emriyle alırsan genellikle satış fiyatından, satarsan alış fiyatından işlem görürsün. İkisinin arasındaki fark spread olarak adlandırılır.",
    example:
      "Alış 99,98 dolar, satış 100,02 dolar görünüyorsa piyasa emriyle alan kişi yaklaşık 100,02 dolar öder, hemen geri satmak isteyen ise yaklaşık 99,98 dolar alır.",
    match: ["bid/ask", "alış ve satış kotasyonu"],
  },
  "spread": {
    term: "Alış-Satış Farkı (Spread)",
    definition:
      "Spread, bir hissenin satış fiyatı (ask) ile alış fiyatı (bid) arasındaki farktır. Alıp hemen satan biri bu farkı kaybeder, yani spread işlem yapmanın gizli bir maliyetidir. Çok işlem gören büyük hisselerde birkaç sent kadar dar olur; az işlem gören hisselerde, ön seansta ve kapanış sonrasında genişler.",
    example:
      "Alış 49,90 dolar, satış 50,10 dolar ise spread 20 senttir. 100 hisseyi alıp aynı anda geri satarsan fiyat hiç değişmese bile yaklaşık 20 dolar kaybedersin.",
    match: ["spread", "alış-satış farkı", "alım-satım farkı"],
  },
  "likidite": {
    term: "Likidite",
    definition:
      "Likidite, bir varlığın fiyatı fazla oynatmadan ne kadar hızlı ve kolay alınıp satılabildiğidir. Likit bir hissede her an çok sayıda alıcı ve satıcı bulunur, spread dardır ve büyük emirler fiyatı pek kaydırmaz. Likiditesi düşük hissede ise istediğin fiyattan işlem bulmak zorlaşır ve küçük emirler bile fiyatı belirgin biçimde oynatabilir.",
    match: ["likidite"],
  },
  "piyasa-yapici": {
    term: "Piyasa Yapıcı",
    definition:
      "Piyasa yapıcı, bir hisse için sürekli hem alış hem satış fiyatı veren ve iki taraftan da işlem yapmaya hazır bekleyen kurumdur. Kazancının önemli bir kısmı alış ile satış arasındaki farktan gelir; karşılığında piyasaya likidite sağlar. ABD'de NYSE'de her hisse için atanmış bir piyasa yapıcı bulunur, Nasdaq'ta ise aynı hissede birden fazla piyasa yapıcı rekabet eder.",
    match: ["piyasa yapıcı"],
  },
  "islem-hacmi": {
    term: "İşlem Hacmi",
    definition:
      "İşlem hacmi, belirli bir sürede el değiştiren hisse adedidir; genellikle günlük olarak verilir. Tek başına pek bir şey söylemez, o hissenin kendi ortalamasıyla karşılaştırılarak okunur. Ortalamanın çok üzerinde hacimle gelen bir fiyat hareketi, düşük hacimli bir hareketten daha fazla katılımcının kararını yansıtır.",
    example:
      "Bir hisse günde ortalama 2 milyon adet işlem görüyorsa ve bilanço günü 8 milyon adet işlem görmüşse, hacim ortalamanın dört katına çıkmış demektir.",
    match: ["işlem hacmi"],
  },
  "on-seans": {
    term: "Ön Seans",
    definition:
      "Ön seans, ABD borsalarında normal seans açılmadan önce yapılan işlemlerdir; birçok aracı kurumda New York saatiyle 04:00'ten 09:30'daki açılışa kadar sürer, ama saatler kuruma göre değişir. Katılımcı az olduğu için likidite düşük, spread geniştir ve çoğu kurum yalnızca limit emir kabul eder. Gece gelen haberler ve açılış öncesi açıklanan bilançolar fiyata ilk burada yansır, ama ön seans fiyatı açılışın nerede olacağını garanti etmez.",
    match: ["ön seans", "piyasa öncesi işlem"],
  },
  "kapanis-sonrasi": {
    term: "Kapanış Sonrası İşlemler",
    definition:
      "Kapanış sonrası işlemler, normal seansın New York saatiyle 16:00'da kapanmasından sonra yapılan alım satımlardır; genellikle 20:00'ye kadar sürer. Birçok şirket bilançosunu tam bu pencerede açıkladığı için sert fiyat hareketleri sık görülür. Ön seansta olduğu gibi likidite düşük, spread geniştir ve fiyatlar ertesi günün açılışını kesin olarak göstermez.",
    match: ["kapanış sonrası işlem", "seans sonrası işlem"],
  },
  "devre-kesici": {
    term: "Devre Kesici",
    definition:
      "Devre kesici, sert düşüşlerde işlemleri geçici olarak durduran kuraldır. ABD'de piyasa geneli devre kesiciler S&P 500'ün bir önceki kapanışına göre düşüşüne bakar: yüzde 7 ve yüzde 13 düşüşte işlemler 15 dakika durur (New York saatiyle 15:25'ten sonra bu iki seviye işlem durdurmaz), yüzde 20 düşüşte ise o günün işlemleri tamamen kapanır. Tek tek hisseler için ayrıca, kısa sürede aşırı fiyat hareketinde o hissenin işlemini kısa süreliğine durduran ayrı bir mekanizma vardır.",
    match: ["devre kesici"],
  },
  "araci-kurum": {
    term: "Aracı Kurum",
    definition:
      "Aracı kurum, yatırımcının emirlerini borsaya ya da diğer işlem yerlerine ileten ve hesabındaki hisse ile nakdi tutan kurumdur. ABD hisselerine Türkiye'den ya yurt içindeki bir aracı kurumun yurt dışı hizmetiyle ya da doğrudan yabancı bir aracı kurumla erişilir. Kurumlar komisyon, kur çevirme maliyeti, saklama ücreti ve sundukları emir tipleri bakımından farklılaşır.",
    match: ["aracı kurum"],
  },
  "t-1-takas": {
    term: "T+1 Takas",
    definition:
      "T+1, bir hisse işleminin takasının, yani hisse ile paranın resmen el değiştirmesinin işlem gününden bir iş günü sonra tamamlanması demektir. ABD hisse piyasası Mayıs 2024'te T+2'den T+1'e geçti. Temettü açısından önemli sonucu şudur: temettü hakkı için hisseyi hak düşüm tarihinden önceki iş günü kapanışına kadar almış olman gerekir.",
    example:
      "Salı günü sattığın hissenin parası takas açısından çarşamba günü kesinleşir; aracı kurum bu nakdi ancak o günden itibaren çekilebilir sayabilir.",
    match: ["T+1"],
  },
  "kesirli-hisse": {
    term: "Kesirli Hisse",
    definition:
      "Kesirli hisse, bir hissenin tamamı yerine bir parçasına sahip olmaktır. Bu imkânı borsa değil aracı kurum sunar: kurum tam hisseyi tutar ve sana payını hesabında gösterir. Fiyatı yüksek hisselere küçük tutarlarla girmeyi kolaylaştırır; ancak bazı kurumlarda kesirli hisse başka bir kuruma aktarılamaz ve emir tipleri kısıtlı olabilir.",
    example:
      "Hisse 400 dolarsa 100 dolarla 0,25 hisse alırsın; hisse yüzde 10 yükselirse payın da 110 dolara çıkar.",
    match: ["kesirli hisse", "küsuratlı hisse"],
  },
  "piyasa-emri": {
    term: "Piyasa Emri",
    definition:
      "Piyasa emri, fiyat belirtmeden o anda bulunan en iyi fiyattan hemen alım ya da satım yapma talimatıdır. Gerçekleşmesi neredeyse kesindir ama fiyatı garanti değildir. Hızlı hareket eden, az işlem gören hisselerde ya da ön seansta ekranda gördüğünden belirgin biçimde farklı bir fiyattan işlem görebilirsin.",
    match: ["piyasa emri"],
  },
  "limit-emir": {
    term: "Limit Emir",
    definition:
      "Limit emir, alımda ödemeye razı olduğun en yüksek, satımda kabul ettiğin en düşük fiyatı belirleyen emirdir. Emir yalnızca bu fiyattan ya da daha iyisinden gerçekleşir; fiyat oraya gelmezse hiç gerçekleşmeyebilir. Yani fiyat güvencesi verir, işlem güvencesi vermez.",
    example:
      "Hisse 52 dolardayken 50 dolara limit alım emri verirsen, fiyat 50 dolara ya da altına inmedikçe emir bekler.",
    match: ["limit emir", "limit emri", "limitli emir"],
  },
  "stop-emir": {
    term: "Stop Emir",
    definition:
      "Stop emir, fiyat belirlediğin seviyeye gelene kadar bekleyen, o seviyede işlem görülünce piyasa emrine dönüşen emirdir; çoğunlukla zararı sınırlamak için satış tarafında kullanılır. Piyasa emrine dönüştüğü için stop seviyesinden gerçekleşeceği garanti değildir. Stop limit emir ise tetiklendiğinde limit emre dönüşür: fiyatı sınırlar ama gerçekleşmeyebilir.",
    example:
      "50 dolarlık hisseye 45 dolardan stop satış emri koydun. Hisse ertesi sabah kötü bir haberle 40 dolardan açılırsa emir tetiklenir ama satış 45 dolardan değil, 40 dolar civarından gerçekleşir.",
    match: ["stop emir", "stop emri", "zarar durdur emri", "stop-loss"],
  },
  "aciga-satis": {
    term: "Açığa Satış",
    definition:
      "Açığa satış, sahip olmadığın hisseyi aracı kurumdan ödünç alıp satmak ve daha sonra geri alıp iade etmektir; fiyatın düşeceği beklentisiyle yapılır. Fiyat düşerse aradaki fark kazançtır, yükselirse zarardır ve fiyatın ne kadar yükselebileceğinin sınırı olmadığı için zarar teorik olarak sınırsızdır. Marj hesabı gerektirir; ödünç alma ücreti ödenir ve pozisyon açıkken dağıtılan temettüler hisseyi ödünç verene ödenir.",
    example:
      "Hisseyi 100 dolardan açığa satıp 80 dolardan geri alırsan hisse başına 20 dolar kazanırsın (ücretlerden önce). Hisse 130 dolara çıkarsa geri alımda hisse başına 30 dolar zarar edersin.",
    match: ["açığa satış", "kısa pozisyon"],
  },
  "kisa-sikisma": {
    term: "Kısa Sıkışma (Short Squeeze)",
    definition:
      "Kısa sıkışma, açığa satış pozisyonu yüksek olan bir hissede fiyat yükselince açığa satanların zararı durdurmak için hisseyi geri almak zorunda kalması ve bu alımların fiyatı daha da yukarı itmesidir. Riskin ölçüsü olarak açık pozisyonun halka açık hisselere oranına ve mevcut hacimle bu pozisyonun kaç günde kapanabileceğine bakılır. ABD'de açık pozisyon verisi ayda iki kez yayımlandığı için anlık değildir.",
    match: ["kısa sıkışma", "short squeeze"],
  },
  "marj-hesabi": {
    term: "Marj Hesabı",
    definition:
      "Marj hesabı, aracı kurumdan hesabındaki menkul kıymetleri teminat göstererek borç alıp işlem yapmana izin veren hesaptır; borca faiz ödenir. ABD'de başlangıçta alım tutarının genellikle en fazla yarısı borçla karşılanabilir ve hesaptaki özsermayenin belirli bir oranın altına düşmemesi gerekir (kurallar en az yüzde 25 der, kurumlar çoğu zaman daha yüksek oran ister). Oran altına inilirse kurum ek teminat ister (margin call); yatırılmazsa pozisyonları senin yerine satabilir.",
    match: ["marj hesabı", "marjin hesabı", "margin call"],
  },
  "kaldirac": {
    term: "Kaldıraç",
    definition:
      "Kaldıraç, kendi paranın üzerinde bir pozisyon taşımak için borç ya da türev araç kullanmaktır. Kazancı da kaybı da aynı oranda büyütür: iki kat kaldıraçla fiyattaki yüzde 10'luk hareket kendi parana yaklaşık yüzde 20 olarak yansır, borcun faizi de ayrıca maliyettir. Şirketler için kullanıldığında ise faaliyetlerin ne ölçüde borçla finanse edildiğini anlatır.",
    example:
      "10.000 dolar kendi paranla 10.000 dolar borç alıp 20.000 dolarlık hisse aldın. Hisse yüzde 25 düşerse pozisyon 15.000 dolara iner, borç 10.000 dolar olarak durur ve senin payın 5.000 dolara, yani yarıya düşer.",
    match: ["kaldıraç"],
  },
  "halka-arz": {
    term: "Halka Arz (IPO)",
    definition:
      "Halka arz, bir şirketin hisselerini ilk kez borsada herkese satışa sunmasıdır. Fiyat, arza aracılık eden yatırım bankalarının kurumsal yatırımcılardan topladığı talebe göre belirlenir ve hisse ilk işlem gününden itibaren borsada serbestçe alınıp satılır. İlk günlerde fiyat oynak olabilir; mevcut ortakların satışını bir süre kısıtlayan kilitlenme süresinin bitimi de fiyata baskı yapabilir.",
    match: ["halka arz", "IPO"],
  },
  "spac": {
    term: "SPAC",
    definition:
      "SPAC (Special Purpose Acquisition Company), kendi faaliyeti olmayan, halka arzla para toplayıp bu parayla belirli bir süre içinde özel bir şirketle birleşmek için kurulan şirkettir. Toplanan para birleşme olana kadar bir emanet hesabında tutulur; süre içinde birleşme olmazsa yatırımcılara iade edilir. Birleşmeyle hedef şirket klasik halka arz sürecinden geçmeden borsaya girmiş olur; kurucuların aldığı ucuz hisseler ise mevcut ortakların payını seyreltebilir.",
    match: ["SPAC"],
  },
  "adr": {
    term: "ADR (Amerikan Depo Sertifikası)",
    definition:
      "ADR, ABD dışındaki bir şirketin hisselerini temsil eden ve ABD'de dolar cinsinden işlem gören sertifikadır; bir ABD depo bankası asıl hisseleri saklar ve karşılığında ADR ihraç eder. Bir ADR bir hisseye denk gelmek zorunda değildir; oran birden fazla ya da bir hissenin kesri olabilir. Temettüler dolara çevrilerek ödenir, şirketin ülkesindeki vergi kesintisi ve depo ücretleri uygulanabilir ve ADR'nin dolar fiyatı o ülkenin para birimindeki kur hareketlerinden de etkilenir.",
    match: ["ADR", "amerikan depo sertifikası"],
  },
  "halka-aciklik": {
    term: "Halka Açıklık (Free Float)",
    definition:
      "Halka açıklık, bir şirketin hisselerinden piyasada serbestçe işlem görebilecek olan kısmıdır; yöneticilerin, kurucuların, stratejik ortakların elindeki ve satışı kısıtlı hisseler bunun dışında kalır. S&P 500 gibi endeksler şirketin ağırlığını bu serbest hisse sayısına göre hesaplar. Halka açık kısmı küçük olan hisselerde arz sınırlı olduğu için fiyat daha oynak olabilir.",
    match: ["halka açıklık", "free float", "fiili dolaşım"],
  },
  "hisse-bolunmesi": {
    term: "Hisse Bölünmesi",
    definition:
      "Hisse bölünmesi, şirketin mevcut her hisseyi birden fazla hisseye bölmesidir. Hisse sayısı artar, hisse başı fiyat aynı oranda düşer; şirketin piyasa değeri ve senin payının toplam değeri değişmez. Grafikler ve geçmiş hisse başı kâr verileri bölünmeye göre geriye dönük düzeltilir.",
    example:
      "4'e 1 bölünmede 400 dolarlık 10 hissen 100 dolarlık 40 hisseye dönüşür; toplam değer yine 4.000 dolardır.",
    match: ["hisse bölünmesi", "pay bölünmesi"],
  },
  "ters-bolunme": {
    term: "Ters Bölünme",
    definition:
      "Ters bölünme, birden fazla hissenin tek hissede birleştirilmesidir. Hisse sayısı azalır, fiyat aynı oranda yükselir ve toplam değer değişmez. Sıklıkla fiyatı çok düşen şirketler, borsanın 1 dolarlık asgari fiyat şartını karşılamak için başvurur; bu yüzden piyasada çoğu zaman zayıflık işareti olarak okunur.",
    example:
      "10'da 1 ters bölünmede 0,80 dolarlık 1.000 hissen 8 dolarlık 100 hisseye dönüşür; toplam değer yine 800 dolardır.",
    match: ["ters bölünme", "ters hisse bölünmesi"],
  },
  "endeks": {
    term: "Endeks",
    definition:
      "Borsa endeksi, belirli bir hisse grubunun toplam fiyat hareketini tek bir sayıyla izleyen ölçüdür. S&P 500 ABD'nin yaklaşık 500 büyük şirketini halka açık piyasa değerine göre ağırlıklandırır; Dow Jones Sanayi Ortalaması 30 hisseyi fiyatına göre ağırlıklandırır; Nasdaq 100 ise Nasdaq'ta işlem gören finans dışı en büyük 100 şirketi kapsar. Endeksin kendisi satın alınamaz; ona endeksi izleyen fonlarla yatırım yapılır.",
    match: ["borsa endeksi", "hisse senedi endeksi"],
  },
  "etf": {
    term: "Borsa Yatırım Fonu (ETF)",
    definition:
      "ETF, borsada tek bir hisse gibi gün boyu alınıp satılan yatırım fonudur. Çoğu bir endeksi izler ve tek işlemle onlarca ya da yüzlerce hisseye sahip olmayı sağlar. Fon her yıl varlıkların küçük bir yüzdesini yönetim gideri olarak keser; kaldıraçlı ve ters ETF'ler ise günlük getiriyi hedeflediği için uzun sürede endeksten belirgin biçimde sapabilir.",
    match: ["ETF", "borsa yatırım fonu"],
  },
  "cesitlendirme": {
    term: "Çeşitlendirme",
    definition:
      "Çeşitlendirme, parayı birbirinden farklı hareket eden birçok varlığa dağıtarak tek bir şirketin ya da sektörün kötü gidişinin portföye etkisini azaltmaktır. Şirkete özgü riski büyük ölçüde düşürür ama tüm piyasayı birlikte etkileyen riski ortadan kaldırmaz. Aynı sektörden on hisse, farklı sektörlerden on hisseye göre çok daha az çeşitlendirme sağlar.",
    match: ["portföy çeşitlendirme", "çeşitlendirilmiş portföy"],
  },
  "volatilite": {
    term: "Volatilite",
    definition:
      "Volatilite (oynaklık), bir fiyatın ne kadar sert ve sık dalgalandığının ölçüsüdür; genellikle getirilerin standart sapması olarak hesaplanır ve yıllık yüzde olarak verilir. Geçmiş fiyatlardan hesaplanan tarihsel volatilite olduğu gibi, opsiyon fiyatlarından çıkarılan örtük oynaklık da vardır. Yüksek volatilite yön söylemez; yalnızca hareketin büyüklüğünü anlatır.",
    example:
      "Yıllık volatilitesi yüzde 20 olan bir hisse için tipik günlük hareket yaklaşık yüzde 1,3'tür (20'nin, bir yıldaki yaklaşık 252 işlem gününün kareköküne bölünmesi).",
    match: ["volatilite", "oynaklık"],
  },
  "beta": {
    term: "Beta",
    definition:
      "Beta, bir hissenin piyasa geneline, çoğunlukla S&P 500'e göre ne kadar hareket ettiğini gösteren katsayıdır. Beta 1 ise hisse ortalamada piyasayla aynı ölçüde, 1'in üzerindeyse daha sert, 1'in altındaysa daha sakin hareket etmiştir. Geçmiş getirilerden hesaplanır, dönemden döneme değişir ve hissenin kendi haberleriyle yaptığı hareketleri anlatmaz.",
    example:
      "Betası 1,5 olan bir hisse, piyasa yüzde 2 düştüğünde ortalamada yaklaşık yüzde 3 düşme eğilimi göstermiştir.",
    match: ["beta katsayısı"],
  },
  "boga-piyasasi": {
    term: "Boğa Piyasası",
    definition:
      "Boğa piyasası, fiyatların uzun süre yükseldiği dönemdir. Resmî bir tanımı yoktur; yaygın kullanımda bir endeksin son dip noktasından yüzde 20 ya da daha fazla yükselmesi boğa piyasası olarak anılır. Boğa piyasasının içinde de düzeltmeler yaşanabilir.",
    match: ["boğa piyasası"],
  },
  "ayi-piyasasi": {
    term: "Ayı Piyasası",
    definition:
      "Ayı piyasası, fiyatların uzun süre ve derin biçimde düştüğü dönemdir. Resmî bir tanımı yoktur; yaygın kullanımda bir endeksin son zirvesinden yüzde 20 ya da daha fazla düşmesi ayı piyasası olarak anılır. Sıklıkla resesyon kaygısıyla birlikte görülür ama her ayı piyasasına resesyon eşlik etmez.",
    match: ["ayı piyasası"],
  },
  "duzeltme": {
    term: "Düzeltme",
    definition:
      "Piyasada düzeltme, bir endeksin ya da hissenin son zirvesinden yüzde 10 ile yüzde 20 arasında düşmesi için kullanılan yaygın ifadedir. Resmî bir tanım değildir. Düşüş yüzde 20'yi aşarsa genellikle ayı piyasası olarak anılır.",
    example:
      "Endeks 5.000 puandan 4.400 puana inerse yüzde 12 düşmüştür ve bu yaygın kullanımda bir düzeltmedir.",
    match: ["piyasa düzeltmesi", "borsa düzeltmesi"],
  },
};
