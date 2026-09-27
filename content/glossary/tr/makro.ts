/* Sözlük — Makro ve Fed (Türkçe). Yapı `../meta.ts`te. */
import type { GlossaryTexts } from "../meta";

export const TR_MAKRO: GlossaryTexts<"makro"> = {
  "tufe": {
    term: "Tüketici Fiyat Endeksi (TÜFE)",
    definition:
      "Hanelerin satın aldığı mal ve hizmetlerden oluşan bir sepetin fiyatındaki değişimi ölçer. ABD'de Çalışma İstatistikleri Bürosu (BLS) her ay yayımlar ve piyasa en çok aylık değişime ve bir yıl öncesine göre değişime bakar. Sepette en büyük ağırlık barınma kalemindedir. Beklentinin üstünde gelen bir TÜFE, Fed'in faizi daha uzun süre yüksek tutabileceği biçiminde okunur ve hem tahvil faizlerini hem hisseleri hareket ettirebilir.",
    example:
      "Sepet geçen yıl bu ay 100 dolara, bu ay 103 dolara mal oluyorsa yıllık TÜFE %3'tür. Aynı sepet geçen ay 102,7 dolarsa aylık artış yaklaşık %0,3'tür.",
    match: ["TÜFE", "CPI", "tüketici fiyat endeksi", "tüketici fiyatları"],
  },
  "cekirdek-enflasyon": {
    term: "Çekirdek Enflasyon",
    definition:
      "Fiyatları sert ve geçici dalgalanan gıda ve enerji kalemleri çıkarıldıktan sonra kalan enflasyondur. Hem TÜFE'nin hem PCE'nin çekirdek hâli yayımlanır. Petrol fiyatındaki bir sıçrama manşet enflasyonu bir ayda çok oynatabilir; çekirdek ölçü ise fiyat artışının ekonomiye ne kadar yayıldığını daha iyi gösterir. Fed'in yönünü tahmin etmeye çalışan piyasa bu yüzden çekirdek rakama manşetten daha fazla önem verir.",
    match: ["çekirdek enflasyon", "çekirdek TÜFE", "çekirdek PCE"],
  },
  "pce": {
    term: "Kişisel Tüketim Harcamaları Fiyat Endeksi (PCE)",
    definition:
      "ABD Ekonomik Analiz Bürosu'nun (BEA) her ay yayımladığı, tüketim harcamalarındaki fiyat değişimini ölçen endekstir. Fed'in %2'lik enflasyon hedefi TÜFE'ye değil PCE'ye göre tanımlanır. Kapsamı TÜFE'den geniştir (örneğin işverenin hane adına ödediği sağlık harcamalarını da sayar), barınmaya daha az ağırlık verir ve tüketicinin pahalanan üründen ucuzuna geçmesini daha iyi hesaba katar. Bu farklar yüzünden PCE genellikle TÜFE'den biraz düşük seyreder.",
    match: ["PCE", "kişisel tüketim harcamaları"],
  },
  "ufe": {
    term: "Üretici Fiyat Endeksi (ÜFE)",
    definition:
      "Üreticilerin sattıkları mal ve hizmetler karşılığında aldıkları fiyatlardaki ortalama değişimi ölçer. ABD'de BLS her ay yayımlar. Üretim maliyetindeki artış zamanla tüketici fiyatlarına yansıyabileceği için ÜFE, TÜFE'nin öncüsü gibi izlenir; ama bu geçiş ne otomatik ne de her zaman aynı hızdadır. Türkiye'de TÜİK'in yayımladığı Yİ-ÜFE aynı ailenin yerli ölçüsüdür ve vergi hesabında da kullanılır.",
    match: ["ÜFE", "PPI", "üretici fiyat endeksi", "üretici fiyatları"],
  },
  "fomc": {
    term: "Federal Açık Piyasa Komitesi (FOMC)",
    definition:
      "Fed'in faiz kararlarını veren komitedir. Oy hakkı olan on iki üyesi var: Fed Yönetim Kurulu'nun yedi üyesi, New York Fed başkanı ve öteki on bir bölgesel Fed başkanından dönüşümlü seçilen dört kişi. Komite yılda sekiz planlı toplantı yapar; karar metni New York saatiyle 14:00'te yayımlanır, ardından Fed Başkanı basın toplantısı düzenler. Toplantı tutanakları yaklaşık üç hafta sonra açıklanır.",
    match: ["FOMC", "federal açık piyasa komitesi"],
  },
  "politika-faizi": {
    term: "Politika Faizi (Federal Fon Oranı)",
    definition:
      "Bankaların Fed'deki rezervlerini birbirlerine bir gecelik borç verirken uyguladığı faizdir ve FOMC bunun için çeyrek puan genişliğinde bir hedef aralık belirler. Bu oran, kredi kartından konut kredisine kadar ekonomideki faizlerin çıpası sayılır. Fed faizi artırdığında borçlanma pahalanır ve ekonomi yavaşlamaya itilir, indirdiğinde tersi olur. Hisse değerlemeleri de bu orandan etkilenir, çünkü gelecekteki kârlar daha yüksek bir faizle bugüne indirgenir.",
    match: ["politika faizi", "federal fon oranı", "fed funds", "federal funds"],
  },
  "nokta-grafigi": {
    term: "Nokta Grafiği (Dot Plot)",
    definition:
      "FOMC katılımcılarının her birinin, önümüzdeki birkaç yılın sonunda ve uzun vadede politika faizinin nerede olması gerektiğini düşündüğünü tek bir noktayla gösteren grafiktir. Yılda dört kez (Mart, Haziran, Eylül ve Aralık) Ekonomik Projeksiyonlar Özeti ile birlikte yayımlanır. Piyasa en çok noktaların medyanına bakar. Noktalar bir söz değil kişisel tahmindir ve veriler değiştikçe bir sonraki grafikte kayabilir.",
    match: ["nokta grafiği", "dot plot"],
  },
  "sahin": {
    term: "Şahin",
    definition:
      "Enflasyonla mücadeleyi ön plana koyan, faizi yüksek tutmaya ya da artırmaya daha yatkın merkez bankacıyı veya tutumu anlatır. Bir Fed yetkilisinin konuşması ya da bir karar metni beklenenden şahin bulunursa piyasa bunu faizlerin daha uzun süre yüksek kalacağı biçiminde okur. Kısa vadeli tahvil faizleri ve dolar genellikle bu okumaya en hızlı tepki veren fiyatlardır.",
    match: ["şahin tutum", "şahince", "şahin duruş", "şahin mesaj"],
  },
  "guvercin": {
    term: "Güvercin",
    definition:
      "Büyümeyi ve istihdamı ön plana koyan, faizi düşürmeye ya da düşük tutmaya daha yatkın merkez bankacıyı veya tutumu anlatır. Beklenenden güvercin bir karar ya da konuşma, piyasada faiz indiriminin yakın olduğu biçiminde okunur. Şahin ve güvercin kalıcı kimlikler değildir; aynı yetkili verilere göre bir dönem bir tarafa, sonra öteki tarafa yakın konuşabilir.",
    match: ["güvercin"],
  },
  "baz-puan": {
    term: "Baz Puan",
    definition:
      "Yüzde bir puanın yüzde biridir: 100 baz puan 1 yüzde puana eşittir. Faiz ve getiri değişimlerini karışıklığa yer bırakmadan anlatmak için kullanılır. \"Faiz %1 arttı\" ifadesi hem yüzde bir puanlık hem yüzde birlik göreli artış anlamına gelebilir; baz puan bu belirsizliği ortadan kaldırır.",
    example:
      "Fed faizi 25 baz puan artırırsa hedef aralığın alt ucu %4,00'ten %4,25'e çıkar. 10 yıllık tahvil faizi %4,10'dan %4,35'e yükselirse 25 baz puan yükselmiş olur.",
    match: ["baz puan"],
  },
  "hazine-tahvili": {
    term: "ABD Hazine Tahvili",
    definition:
      "ABD Hazinesi'nin borçlanmak için çıkardığı borç senetleridir. Vadesi bir yıla kadar olanlara bono (bill), 2 ila 10 yıl olanlara note, 20 ve 30 yıllık olanlara bond denir; Türkçede hepsi için genellikle \"tahvil\" denir. Tahvilin fiyatı ile getirisi ters yönde hareket eder: fiyat düşerken getiri yükselir. 10 yıllık tahvilin getirisi konut kredisi faizlerinden hisse değerlemelerine kadar pek çok hesabın referansıdır.",
    example:
      "Yılda 40 dolar faiz ödeyen, 1.000 dolar nominal değerli bir tahvili 1.000 dolara alırsan getirin %4'tür. Tahvilin fiyatı piyasada 950 dolara düşerse, aynı 40 dolar yeni alıcı için yaklaşık %4,2'lik bir faiz getirisi demektir.",
    match: ["hazine tahvil", "10 yıllık tahvil", "2 yıllık tahvil"],
  },
  "reel-faiz": {
    term: "Reel Faiz",
    definition:
      "Nominal faizden enflasyonun çıkarılmasıyla bulunan, paranın gerçek satın alma gücü olarak kazandırdığı faizdir. Kabaca nominal faiz eksi beklenen enflasyon diye hesaplanır. ABD'de piyasanın reel faiz ölçüsü, enflasyona endeksli tahvillerin (TIPS) getirisidir. Yükselen reel faiz, özellikle kârlarının büyük kısmını uzak gelecekte bekleyen büyüme şirketlerinin değerlemesine baskı yapar.",
    example:
      "Tahvil yılda %5 getiriyor ve enflasyon %3 ise reel getiri yaklaşık %2'dir. Enflasyon %6 olsaydı aynı tahvil reel olarak yaklaşık %1 kaybettirirdi.",
    match: ["reel faiz", "reel getiri"],
  },
  "getiri-egrisi": {
    term: "Getiri Eğrisi",
    definition:
      "Aynı ihraççının (genellikle ABD Hazinesi) farklı vadeli tahvillerinin getirilerini kısadan uzuna doğru sıralayan çizgidir. Normalde yukarı eğimlidir: parasını daha uzun süre bağlayan yatırımcı daha yüksek getiri ister. Eğrinin kısa ucu en çok Fed'in politika faizi beklentisine, uzun ucu ise büyüme, enflasyon ve risk beklentilerine göre şekillenir. Piyasa eğimi genellikle 10 yıllık ile 2 yıllık ya da 3 aylık getiri arasındaki farkla ölçer.",
    match: ["getiri eğrisi"],
  },
  "ters-getiri-egrisi": {
    term: "Ters Getiri Eğrisi",
    definition:
      "Kısa vadeli tahvil getirilerinin uzun vadelilerin üstüne çıktığı durumdur; en çok izlenen ölçüler 10 yıllık eksi 2 yıllık ve 10 yıllık eksi 3 aylık farktır. Piyasanın ileride faiz indirimi, yani ekonomik yavaşlama beklediği biçiminde okunur. Tarihsel olarak ABD resesyonlarının çoğundan önce görülmüştür, ama arada geçen süre aylarla yıllar arasında değişmiştir ve sinyalin resesyonla sonuçlanmadığı dönemler de olmuştur. Kesin bir takvim değil, bir uyarı işaretidir.",
    match: ["ters getiri eğrisi", "tersine dönmüş getiri eğrisi"],
  },
  "niceliksel-gevseme": {
    term: "Niceliksel Gevşeme (QE)",
    definition:
      "Merkez bankasının yeni rezerv yaratarak piyasadan büyük miktarda tahvil satın almasıdır; Fed'in alımları ağırlıklı olarak Hazine tahvilleri ve ipoteğe dayalı menkul kıymetlerden oluşmuştur. Amaç, politika faizi sıfıra yakınken bile uzun vadeli faizleri aşağı çekmek ve finansal koşulları gevşetmektir. Alımlar merkez bankasının bilançosunu büyütür. Piyasa QE'yi genellikle riskli varlıklar için destekleyici bir ortam olarak okur.",
    match: ["niceliksel gevşeme", "QE"],
  },
  "niceliksel-sikilasma": {
    term: "Niceliksel Sıkılaşma (QT)",
    definition:
      "Merkez bankasının bilançosunu küçültmesidir. Fed bunu genellikle elindeki tahvilleri satarak değil, vadesi gelenlerin bir kısmını yeniden yatırmayıp bilançodan düşmesine izin vererek yapar ve bunun için aylık bir tavan belirler. Piyasadaki tahvil talebini azalttığı için uzun vadeli faizlere yukarı yönlü baskı yapabilir. Politika faizi kararlarının arka planında işleyen ikinci bir sıkılaştırma aracı olarak izlenir.",
    match: ["niceliksel sıkılaşma", "QT"],
  },
  "tarim-disi-istihdam": {
    term: "Tarım Dışı İstihdam (NFP)",
    definition:
      "ABD ekonomisinde bir ayda eklenen ya da kaybedilen maaşlı iş sayısıdır; tarım çalışanları, hane içi çalışanlar ve kendi hesabına çalışanlar dışarıda kalır. BLS'nin aylık istihdam raporunda yer alır; rapor genellikle ayın ilk cuma günü New York saatiyle 08:30'da yayımlanır. Sonraki iki ayda revize edildiği için tek bir ayın rakamı sonradan belirgin biçimde değişebilir. Piyasa rakamı beklentiyle kıyaslar ve aynı rapordaki ücret artışına da bakar.",
    match: ["tarım dışı istihdam", "NFP"],
  },
  "issizlik-orani": {
    term: "İşsizlik Oranı",
    definition:
      "İşgücü içinde işi olmayan, çalışmaya hazır olan ve son dört haftada aktif olarak iş arayan kişilerin payıdır. ABD'de BLS'nin aylık istihdam raporunda, hane halkı anketinden hesaplanarak yayımlanır. İş aramayı bırakan kişi işgücünden çıktığı için oran düşebilir; bu yüzden işgücüne katılım oranıyla birlikte okunması gerekir. Fed'in iki görevinden biri azami istihdam olduğu için bu oran faiz beklentilerini doğrudan etkiler.",
    match: ["işsizlik oranı"],
  },
  "sahm-kurali": {
    term: "Sahm Kuralı",
    definition:
      "Ekonomist Claudia Sahm'ın adını taşıyan bir resesyon göstergesidir. İşsizlik oranının son üç aylık ortalaması, önceki 12 aydaki en düşük üç aylık ortalamasının 0,5 yüzde puan veya daha fazla üstüne çıktığında tetiklenir. Tarihsel olarak resesyonun başladığını erken aşamada yakalamıştır. Bir ekonomi yasası değil gözlenmiş bir düzenliliktir; işgücü arzındaki hızlı değişimler gibi durumlarda yanıltıcı olabilir.",
    example:
      "İşsizliğin üç aylık ortalaması son bir yılda en düşük %3,6'ya inmiş ve şimdi %4,1'e çıkmışsa fark 0,5 puandır ve kural tetiklenmiş sayılır.",
    match: ["sahm kuralı"],
  },
  "jolts": {
    term: "JOLTS (Açık İş İlanları ve İşgücü Devri Anketi)",
    definition:
      "BLS'nin aylık olarak yayımladığı, ABD'deki açık iş sayısını, işe alımları ve işten ayrılmaları (istifa ve işten çıkarma olarak ayrı ayrı) ölçen ankettir. Tarım dışı istihdam raporundan bir ay kadar geriden gelir. Açık iş sayısının işsiz sayısına oranı işgücü piyasasının ne kadar sıkı olduğunu gösterir. İstifaların artması, çalışanların kolayca yeni iş bulabileceğine güvendiği biçiminde okunur.",
    match: ["JOLTS"],
  },
  "issizlik-basvurulari": {
    term: "Haftalık İşsizlik Başvuruları",
    definition:
      "ABD'de bir haftada ilk kez işsizlik sigortası için başvuran kişi sayısıdır. Çalışma Bakanlığı her perşembe New York saatiyle 08:30'da yayımlar; bu yüzden işgücü piyasasının en sık güncellenen göstergesidir. Haftalık rakam tatiller ve hava olayları nedeniyle oynak olduğundan çoğu zaman dört haftalık ortalamaya bakılır. Aynı raporda sigortadan yararlanmaya devam edenlerin sayısı da yer alır.",
    match: ["işsizlik başvuru", "işsizlik maaşı başvuru"],
  },
  "gsyh": {
    term: "Gayrisafi Yurt İçi Hasıla (GSYH)",
    definition:
      "Bir ülkede belirli bir dönemde üretilen tüm nihai mal ve hizmetlerin değeridir ve ekonominin büyüklüğünün temel ölçüsüdür. ABD'de BEA çeyreklik GSYH'yi önce öncü tahmin olarak açıklar, sonraki aylarda iki kez revize eder. ABD büyüme oranını mevsimsellikten arındırılmış ve yıllıklandırılmış olarak verir; yani çeyrekten çeyreğe büyüme, dört çeyrek aynı hızda sürseydi yıllık ne olacağına çevrilir. Türkiye'nin yıllık bazda açıkladığı büyüme rakamıyla doğrudan kıyaslanmamalıdır.",
    example:
      "Ekonomi bir çeyrekte bir öncekine göre %0,5 büyüdüyse ABD bunu yıllıklandırarak yaklaşık %2 olarak açıklar.",
    match: ["GSYH", "GDP", "gayrisafi yurt içi hasıla", "gayri safi yurt içi hasıla"],
  },
  "resesyon": {
    term: "Resesyon",
    definition:
      "Ekonomik faaliyetin geniş bir alana yayılan ve birkaç aydan uzun süren belirgin bir düşüş göstermesidir. ABD'de resmi başlangıç ve bitiş tarihlerini Ulusal Ekonomik Araştırmalar Bürosu (NBER) belirler ve bunu çoğu zaman aylar sonra geriye dönük olarak açıklar. \"Art arda iki çeyrek GSYH daralması\" yaygın bir pratik kuraldır ama resmi tanım değildir; NBER istihdam, gelir ve üretim gibi göstergelere birlikte bakar.",
    match: ["resesyon"],
  },
  "pmi": {
    term: "Satın Alma Yöneticileri Endeksi (PMI)",
    definition:
      "Şirketlerin satın alma yöneticilerine siparişler, üretim, istihdam ve fiyatlar hakkında sorulan aylık anketten türetilen bir endekstir. 50'nin üstü faaliyetin bir önceki aya göre genişlediğini, altı daraldığını gösterir. ABD'de en çok izlenenleri ISM ile S&P Global'in imalat ve hizmet PMI'larıdır. Ay bitiminden hemen sonra açıklandığı için resmi verilerden önce ekonominin gidişatına dair ilk ipucunu verir.",
    match: ["PMI", "satın alma yöneticileri endeksi"],
  },
  "perakende-satislar": {
    term: "Perakende Satışlar",
    definition:
      "ABD Nüfus Sayım Bürosu'nun her ay yayımladığı, perakende ve gıda hizmeti işletmelerinin toplam satışlarını ölçen veridir. Tüketim ABD ekonomisinin en büyük parçası olduğu için yakından izlenir. Rakam enflasyondan arındırılmamıştır; fiyatlar yükselirken satışların artması daha fazla ürün satıldığı anlamına gelmeyebilir. Otomobil, benzin ve inşaat malzemesi gibi oynak kalemleri dışarıda bırakan \"kontrol grubu\" rakamı GSYH hesabına daha yakın olduğu için ayrıca izlenir.",
    match: ["perakende satış"],
  },
  "dolar-endeksi": {
    term: "Dolar Endeksi (DXY)",
    definition:
      "ABD dolarının altı büyük para birimine karşı değerini ölçen endekstir: euro, Japon yeni, İngiliz sterlini, Kanada doları, İsveç kronu ve İsviçre frangı. Ağırlığın yarıdan fazlası euroya aittir, bu yüzden endeks büyük ölçüde euro karşısındaki dolar hareketini yansıtır. Türk lirası sepette yoktur; dolar endeksinin düşmesi dolar/TL'nin düşeceği anlamına gelmez. Güçlü dolar, gelirinin önemli kısmını yurt dışından elde eden ABD şirketlerinin dolar cinsinden sonuçlarını olumsuz etkileyebilir.",
    match: ["dolar endeksi", "DXY"],
  },
};
