/* Sözlük — Değerleme ve Temel Analiz (Türkçe). Yapı `../meta.ts`te. */
import type { GlossaryTexts } from "../meta";

export const TR_DEGERLEME: GlossaryTexts<"degerleme"> = {
  "fk": {
    term: "Fiyat/Kazanç Oranı (F/K)",
    definition:
      "Hisse fiyatının hisse başı kâra bölünmesiyle bulunur. Bir dolarlık yıllık kâr için piyasanın bugün kaç dolar ödediğini gösterir. Geçmiş on iki ayın kârıyla hesaplanırsa cari F/K, analistlerin gelecek yıl beklentisiyle hesaplanırsa ileriye dönük F/K denir. Yüksek F/K tek başına pahalılık demek değildir: piyasa hızlı büyüme bekliyor olabilir, bu yüzden oran en çok aynı sektördeki şirketlerle ve şirketin kendi geçmişiyle karşılaştırılarak okunur.",
    example:
      "Hisse 100 dolar, yıllık hisse başı kâr 5 dolar ise F/K 20'dir. Kâr hiç değişmeseydi, ödediğin fiyatı kârla geri kazanman 20 yıl sürerdi.",
    match: ["F/K", "fiyat/kazanç oranı", "fiyat/kazanç"],
  },
  "pd-dd": {
    term: "Piyasa Değeri/Defter Değeri (PD/DD)",
    definition:
      "Şirketin piyasa değerinin özsermayesine, yani defter değerine bölünmesidir. Piyasanın, şirketin muhasebe kayıtlarındaki net varlıkları için kaç katı fiyat biçtiğini gösterir. Bankalar gibi varlıkları büyük ölçüde finansal olan şirketlerde anlamlıdır; yazılım gibi değerinin çoğu marka, fikrî mülkiyet ve insan kaynağında duran şirketlerde oran doğal olarak yüksek çıkar.",
    example:
      "Piyasa değeri 50 milyar dolar, özsermayesi 25 milyar dolar olan bir şirketin PD/DD oranı 2'dir.",
    match: ["PD/DD", "piyasa değeri/defter değeri"],
  },
  "fd-favok": {
    term: "Firma Değeri/FAVÖK (FD/FAVÖK)",
    definition:
      "Firma değerinin yıllık FAVÖK'e bölünmesidir. F/K'den farkı, şirketin borcunu da hesaba katmasıdır: borçlu ve borçsuz şirketleri aynı terazide tartmaya yarar. Oran ne kadar düşükse şirketin faaliyet kârına göre o kadar ucuza fiyatlandığı düşünülür, ama sektörler arasında farklar büyüktür.",
    example:
      "Piyasa değeri 100 milyar dolar, borcu 30 milyar, nakdi 10 milyar dolar olan şirketin firma değeri 120 milyar dolardır. Yıllık FAVÖK 12 milyar dolarsa FD/FAVÖK 10 olur.",
    match: ["FD/FAVÖK", "EV/EBITDA"],
  },
  "peg-orani": {
    term: "PEG Oranı",
    definition:
      "F/K oranının, yıllık beklenen hisse başı kâr büyümesine (yüzde olarak) bölünmesidir. Hızlı büyüyen bir şirketin yüksek F/K'sini büyümesiyle birlikte okumaya yarar. Kaba bir kural olarak 1 civarı büyümeye göre makul fiyat diye yorumlanır, ancak paydadaki büyüme bir tahmindir ve tahmin yanlışsa oran da yanıltır.",
    example:
      "F/K'si 30, yıllık kâr büyümesi beklentisi %15 olan şirketin PEG oranı 30 / 15 = 2'dir.",
    match: ["PEG oranı", "PEG"],
  },
  "fiyat-satis-orani": {
    term: "Fiyat/Satış Oranı (F/S)",
    definition:
      "Piyasa değerinin yıllık satış gelirine bölünmesidir. Henüz kâr etmeyen ya da kârı dalgalı olan şirketlerde F/K hesaplanamadığı için bu orana bakılır. Kârlılığı hiç hesaba katmadığı için, düşük marjlı bir şirketle yüksek marjlı bir şirketin oranları doğrudan karşılaştırılamaz.",
    example:
      "Piyasa değeri 20 milyar dolar, yıllık satış geliri 5 milyar dolar olan şirketin F/S oranı 4'tür.",
    match: ["fiyat/satış oranı", "F/S"],
  },
  "hisse-basi-kar": {
    term: "Hisse Başı Kâr (EPS)",
    definition:
      "Şirketin dönem net kârının (varsa imtiyazlı hisse temettüleri düşüldükten sonra) dolaşımdaki ortalama hisse sayısına bölünmesidir. Kârın tek bir hisseye düşen payını gösterir ve F/K oranının paydasıdır. Bilanço açıklamalarında en çok izlenen sayıdır; piyasa gerçekleşen rakamı analistlerin beklentisiyle karşılaştırır.",
    example:
      "Net kârı 1 milyar dolar, ortalama hisse sayısı 500 milyon olan şirketin hisse başı kârı 2 dolardır.",
    match: ["hisse başı kâr", "hisse başına kâr", "hisse başı kar", "EPS"],
  },
  "seyreltilmis-hisse-basi-kar": {
    term: "Seyreltilmiş Hisse Başı Kâr",
    definition:
      "Hisse başı kârın, ileride hisseye dönüşebilecek her şey (çalışan opsiyonları, kısıtlı hisse birimleri, dönüştürülebilir tahviller) hisseye dönüşmüş gibi varsayılarak hesaplanan hâlidir. Payda büyüdüğü için temel hisse başı kârdan küçük ya da ona eşit çıkar. ABD'de halka açık şirketler gelir tablosunda iki rakamı birlikte verir; aradaki fark büyüdükçe seyrelme riski de büyür.",
    example:
      "Net kâr 1 milyar dolar, dolaşımdaki hisse 500 milyon ise temel hisse başı kâr 2 dolardır. 20 milyon hisselik opsiyon da eklenince payda 520 milyon olur ve seyreltilmiş hisse başı kâr yaklaşık 1,92 dolara iner.",
    match: ["seyreltilmiş hisse başı kâr", "seyreltilmiş hisse başı kar", "seyreltilmiş EPS"],
  },
  "gelir": {
    term: "Gelir (Hasılat)",
    definition:
      "Şirketin ana faaliyetinden, yani mal ve hizmet satışından bir dönemde elde ettiği toplam tutardır; iadeler ve indirimler düşülerek net satış olarak raporlanır. Gelir tablosunun ilk satırıdır ve hiçbir gider düşülmemiştir. Gelirin büyümesi talebin, gelirden geriye ne kaldığı ise kârlılığın göstergesidir; ikisi birlikte okunur.",
    match: ["hasılat", "satış geliri", "satış gelirleri"],
  },
  "brut-kar-marji": {
    term: "Brüt Kâr Marjı",
    definition:
      "Satış gelirinden satılan malın maliyeti düşüldükten sonra kalan brüt kârın, gelire oranıdır. Şirketin ürününü üretmenin ya da hizmeti sunmanın ne kadara mal olduğunu, yani fiyatlama gücünü gösterir. Yazılım gibi sektörlerde yüksek, perakende gibi sektörlerde düşük olması doğaldır; bu yüzden en anlamlı karşılaştırma aynı sektör içinde ve şirketin kendi geçmişiyledir.",
    example:
      "Satış geliri 100 milyon dolar, satılan malın maliyeti 60 milyon dolarsa brüt kâr 40 milyon, brüt kâr marjı %40'tır.",
    match: ["brüt kâr marjı", "brüt kar marjı", "brüt marj"],
  },
  "faaliyet-kar-marji": {
    term: "Faaliyet Kâr Marjı",
    definition:
      "Brüt kârdan araştırma geliştirme, pazarlama ve genel yönetim gibi faaliyet giderleri de düşüldükten sonra kalan faaliyet kârının, gelire oranıdır. Faiz ve vergi henüz düşülmediği için şirketin ana işinin ne kadar verimli yürüdüğünü gösterir. Gelir büyürken bu marjın da genişlemesi, giderlerin gelirden yavaş büyüdüğü anlamına gelir.",
    example:
      "Satış geliri 100, brüt kâr 40, faaliyet giderleri 25 milyon dolarsa faaliyet kârı 15 milyon, faaliyet kâr marjı %15'tir.",
    match: ["faaliyet kâr marjı", "faaliyet kar marjı", "faaliyet marjı"],
  },
  "net-kar-marji": {
    term: "Net Kâr Marjı",
    definition:
      "Faiz, vergi ve diğer tüm giderler düşüldükten sonra kalan net kârın, gelire oranıdır. Her 100 dolarlık satıştan hissedarlara kaç dolar kaldığını gösterir. Tek seferlik kazanç ya da giderler bu oranı bir dönemliğine şişirebilir veya bastırabilir, bu yüzden birkaç çeyreğe birlikte bakmak daha sağlıklıdır.",
    example:
      "Satış geliri 100 milyon, net kâr 10 milyon dolar olan şirketin net kâr marjı %10'dur.",
    match: ["net kâr marjı", "net kar marjı"],
  },
  "favok": {
    term: "FAVÖK (EBITDA)",
    definition:
      "Faiz, amortisman ve vergi öncesi kârdır: net kâra faiz gideri, vergi ile amortisman ve itfa payları geri eklenerek bulunur. Borç yapısı ve vergi farkları ayıklandığı için şirketleri karşılaştırmakta sık kullanılır. ABD muhasebe standartlarında (GAAP) tanımlı bir kalem değildir ve yatırım harcamalarını hiç göstermez; bu yüzden nakit üretme gücünün yerine geçmez.",
    example:
      "Net kâr 50, faiz gideri 10, vergi 15, amortisman 25 milyon dolarsa FAVÖK 100 milyon dolardır.",
    match: ["FAVÖK", "EBITDA"],
  },
  "gaap-disi": {
    term: "GAAP Dışı Ölçüler (Non-GAAP)",
    definition:
      "Şirketlerin ABD muhasebe standartlarına (GAAP) göre hesaplanan rakamları, kendi seçtikleri kalemleri çıkararak ya da ekleyerek düzelttiği ölçülerdir; düzeltilmiş hisse başı kâr en yaygın örnektir. Genellikle hisse bazlı ödemeler, yeniden yapılanma giderleri ve tek seferlik kalemler dışarıda bırakılır. SEC, bu ölçülerin en yakın GAAP rakamıyla birlikte ve aradaki farkı açıklayan bir mutabakatla verilmesini şart koşar. Analist beklentileri çoğu zaman düzeltilmiş rakam üzerinden kurulur, ama çıkarılan giderlerin çoğu gerçek maliyettir.",
    match: ["GAAP dışı", "non-GAAP", "düzeltilmiş hisse başı kâr"],
  },
  "isletme-nakit-akisi": {
    term: "İşletme Nakit Akışı",
    definition:
      "Şirketin ana faaliyetlerinden bir dönemde kasasına giren net nakittir. Net kârdan başlanır, amortisman ve hisse bazlı ödeme gibi nakit çıkışı gerektirmeyen giderler geri eklenir, alacak, stok ve borçlardaki değişimler de hesaba katılır. Net kâr ile işletme nakit akışı arasında sürekli büyüyen bir fark, kârın kaliteli olup olmadığı sorusunu doğurur.",
    match: ["işletme nakit akışı", "faaliyet nakit akışı", "faaliyetlerden elde edilen nakit"],
  },
  "serbest-nakit-akisi": {
    term: "Serbest Nakit Akışı (FCF)",
    definition:
      "İşletme nakit akışından sermaye harcamaları düşüldükten sonra kalan nakittir. Şirketin işini sürdürüp büyütmek için gerekeni harcadıktan sonra temettü, hisse geri alımı, borç ödemesi ya da satın alma için elinde kalan parayı gösterir. Muhasebe tercihlerinden kâra göre daha az etkilendiği için değerlemede sık kullanılır.",
    example:
      "İşletme nakit akışı 8 milyar, sermaye harcaması 3 milyar dolar olan şirketin serbest nakit akışı 5 milyar dolardır.",
    match: ["serbest nakit akışı", "FCF"],
  },
  "sermaye-harcamasi": {
    term: "Sermaye Harcaması (Capex)",
    definition:
      "Şirketin fabrika, ekipman, veri merkezi gibi uzun ömürlü varlıklara yaptığı harcamadır. Nakit akış tablosunun yatırım faaliyetleri bölümünde görünür; gelir tablosuna tek seferde gider olarak yazılmaz, yıllar içinde amortisman olarak yansır. Yüksek sermaye harcaması gelecekteki büyümeye yatırım olabilir, ama serbest nakit akışını bugün azaltır.",
    match: ["sermaye harcaması", "sermaye harcamaları", "capex"],
  },
  "iskontolu-nakit-akisi": {
    term: "İskontolu Nakit Akışı (DCF)",
    definition:
      "Bir şirketin gelecekte üreteceği tahmin edilen serbest nakit akışlarının, bir iskonto oranıyla bugüne indirgenip toplanmasına dayanan değerleme yöntemidir. Temel fikir, bugün elde edilen bir doların yıllar sonra elde edilecek bir dolardan değerli olmasıdır. Tahmin döneminin ötesi için bir uç değer eklenir. Sonuç büyüme ve iskonto oranı varsayımlarına çok duyarlıdır: küçük bir varsayım değişikliği değeri büyük ölçüde oynatabilir.",
    example:
      "Bir yıl sonra elde edilecek 110 dolar, %10 iskonto oranıyla bugün 100 dolar eder (110 / 1,10).",
    match: ["iskontolu nakit akışı", "indirgenmiş nakit akışı", "DCF"],
  },
  "ozsermaye-karliligi": {
    term: "Özsermaye Kârlılığı (ROE)",
    definition:
      "Net kârın özsermayeye (çoğunlukla dönemin ortalama özsermayesine) bölünmesidir. Şirketin hissedarlarının koyduğu ve içeride bıraktığı sermayeyle ne kadar kâr ürettiğini gösterir. Yüksek borç özsermayeyi küçülttüğü için oranı yapay olarak yükseltebilir; bu yüzden borç/özsermaye oranıyla birlikte okunmalıdır.",
    example:
      "Yıllık net kârı 2 milyar, ortalama özsermayesi 10 milyar dolar olan şirketin özsermaye kârlılığı %20'dir.",
    match: ["özsermaye kârlılığı", "özkaynak kârlılığı", "ROE"],
  },
  "aktif-karliligi": {
    term: "Aktif Kârlılığı (ROA)",
    definition:
      "Net kârın toplam varlıklara bölünmesidir. Şirketin elindeki tüm varlıkları, ister özsermayeyle ister borçla finanse edilmiş olsun, ne kadar verimli kullandığını gösterir. Bankalar gibi varlık tabanı çok büyük şirketlerde doğal olarak düşük çıkar; karşılaştırma aynı sektör içinde yapılmalıdır.",
    example:
      "Net kârı 2 milyar, toplam varlıkları 40 milyar dolar olan şirketin aktif kârlılığı %5'tir.",
    match: ["aktif kârlılığı", "varlık kârlılığı", "ROA"],
  },
  "borc-ozsermaye-orani": {
    term: "Borç/Özsermaye Oranı",
    definition:
      "Şirketin borcunun özsermayesine bölünmesidir ve faaliyetlerin ne ölçüde borçla finanse edildiğini gösterir. Bazı kaynaklar yalnızca finansal borcu, bazıları tüm yükümlülükleri paya yazar; iki şirketi karşılaştırırken aynı tanımın kullanıldığına bakmak gerekir. Yüksek oran faizler yükseldiğinde ya da kâr düştüğünde riski büyütür. Geri alımlarla özsermayesi eksiye düşmüş şirketlerde oran anlamını yitirir.",
    example:
      "Toplam borcu 30 milyar, özsermayesi 60 milyar dolar olan şirketin borç/özsermaye oranı 0,5'tir.",
    match: ["borç/özsermaye oranı", "borç/özkaynak oranı", "borç/özsermaye"],
  },
  "cari-oran": {
    term: "Cari Oran",
    definition:
      "Dönen varlıkların (nakit, alacaklar, stoklar gibi bir yıl içinde nakde dönmesi beklenen varlıklar) kısa vadeli yükümlülüklere bölünmesidir. Şirketin önümüzdeki bir yıl içinde ödemesi gereken borçlarını eldeki kısa vadeli varlıklarla karşılayıp karşılayamayacağını gösterir. 1'in üzerindeki oran kısa vadeli borçların karşılandığı anlamına gelir, ama uygun seviye sektöre göre değişir.",
    example:
      "Dönen varlıkları 15 milyar, kısa vadeli yükümlülükleri 10 milyar dolar olan şirketin cari oranı 1,5'tir.",
    match: ["cari oran"],
  },
  "defter-degeri": {
    term: "Defter Değeri",
    definition:
      "Şirketin toplam varlıklarından toplam yükümlülükleri düşülünce kalan tutardır; bilançodaki özsermayeye eşittir. Hisse sayısına bölünerek hisse başı defter değeri bulunur. Varlıklar çoğunlukla tarihî maliyetle kaydedildiği için defter değeri, şirketin piyasada ne edeceğini değil muhasebe kayıtlarındaki net değeri gösterir.",
    example:
      "Varlıkları 100 milyar, yükümlülükleri 70 milyar dolar olan şirketin defter değeri 30 milyar dolardır. 1 milyar hisse varsa hisse başı defter değeri 30 dolardır.",
    match: ["defter değeri"],
  },
  "piyasa-degeri": {
    term: "Piyasa Değeri",
    definition:
      "Hisse fiyatının dolaşımdaki toplam hisse sayısıyla çarpılmasıdır. Piyasanın şirketin tamamına o an biçtiği fiyattır ve fiyatla birlikte her an değişir. Şirketleri büyüklüğe göre sıralamanın en yaygın yoludur ve S&P 500 gibi endekslerde şirketin ağırlığı da buna göre belirlenir.",
    example:
      "Hissesi 50 dolar, dolaşımda 2 milyar hissesi olan şirketin piyasa değeri 100 milyar dolardır.",
    match: ["piyasa değeri"],
  },
  "firma-degeri": {
    term: "Firma Değeri (FD)",
    definition:
      "Piyasa değerine şirketin borcunun eklenip elindeki nakit ve benzerlerinin düşülmesiyle bulunur; bazı hesaplamalara imtiyazlı hisseler ve azınlık payları da eklenir. Şirketi borcuyla birlikte satın almak isteyen birinin ödemesi gereken yaklaşık tutarı gösterir. Bu yüzden borç yapısı farklı şirketleri karşılaştıran FD/FAVÖK gibi oranlarda piyasa değeri yerine kullanılır.",
    example:
      "Piyasa değeri 100 milyar, borcu 30 milyar, nakdi 10 milyar dolar olan şirketin firma değeri 120 milyar dolardır.",
    match: ["firma değeri"],
  },
  "temettu": {
    term: "Temettü",
    definition:
      "Şirketin kârının bir bölümünü nakit olarak hissedarlarına dağıtmasıdır. ABD'de temettü kararını yönetim kurulu verir ve çoğu şirket üç ayda bir öder. Temettüyü alabilmek için hisseyi hak düşüm tarihinden önce almış olmak gerekir; hak düşüm günü hisse fiyatı genellikle temettü tutarı kadar aşağıdan açılır.",
    example:
      "Hisse başına çeyreklik 0,50 dolar temettü ödeyen şirketin yıllık temettüsü hisse başına 2 dolardır.",
    match: ["temettü", "kâr payı"],
  },
  "temettu-verimi": {
    term: "Temettü Verimi",
    definition:
      "Hisse başı yıllık temettünün hisse fiyatına bölünmesidir. Hisseyi bugünkü fiyattan alan birinin yalnızca temettüden yıllık yüzde kaç nakit getiri elde edeceğini gösterir. Fiyat düştükçe verim yükselir; bu yüzden çok yüksek bir verim bazen piyasanın temettünün kesileceğini beklediğine işaret eder.",
    example:
      "Yıllık 2 dolar temettü ödeyen ve 80 dolardan işlem gören hissenin temettü verimi %2,5'tir.",
    match: ["temettü verimi"],
  },
  "temettu-dagitim-orani": {
    term: "Temettü Dağıtım Oranı",
    definition:
      "Dağıtılan temettünün net kâra oranıdır. Şirketin kazandığının ne kadarını hissedara dağıttığını, ne kadarını işe geri yatırdığını gösterir. Oranın uzun süre %100'ün üzerinde kalması, temettünün kârdan değil birikmiş nakitten ya da borçtan ödendiği anlamına gelir; bu yüzden bazı yatırımcılar oranı serbest nakit akışına göre de hesaplar.",
    example:
      "Hisse başı kârı 5 dolar, hisse başı temettüsü 2 dolar olan şirketin temettü dağıtım oranı %40'tır.",
    match: ["temettü dağıtım oranı", "kâr dağıtım oranı"],
  },
  "hisse-geri-alimi": {
    term: "Hisse Geri Alımı",
    definition:
      "Şirketin kendi hisselerini piyasadan satın almasıdır. Dolaşımdaki hisse sayısı azaldığı için kalan her hisse şirketin kârından daha büyük pay alır ve hisse başı kâr, net kâr değişmese bile yükselir. Hissedara nakit döndürmenin temettüye alternatif yoludur. Bir geri alım programının açıklanması, şirketin o tutarın tamamını harcayacağı anlamına gelmez.",
    example:
      "Net kârı 1 milyar dolar olan şirket hisse sayısını 500 milyondan 480 milyona indirirse hisse başı kâr 2,00 dolardan yaklaşık 2,08 dolara çıkar.",
    match: ["hisse geri alımı", "pay geri alımı", "geri alım programı"],
  },
  "hisse-seyrelmesi": {
    term: "Hisse Seyrelmesi",
    definition:
      "Şirketin yeni hisse ihraç etmesiyle dolaşımdaki hisse sayısının artması ve mevcut hissedarların şirketteki payının küçülmesidir. Sermaye artırımı, çalışanlara verilen hisseler ve opsiyonlar, dönüştürülebilir borçların hisseye çevrilmesi başlıca kaynaklardır. Aynı kâr daha çok hisseye bölündüğü için hisse başı kâr da baskı altına girer.",
    example:
      "100 milyon hissesi olan şirket 5 milyon yeni hisse çıkarırsa 1 milyon hisseye sahip bir yatırımcının payı %1'den yaklaşık %0,95'e düşer.",
    match: ["hisse seyrelmesi", "seyrelme"],
  },
};
