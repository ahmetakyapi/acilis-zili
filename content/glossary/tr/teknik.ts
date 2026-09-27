/* Sözlük — Teknik Analiz (Türkçe). Yapı `../meta.ts`te. */
import type { GlossaryTexts } from "../meta";

export const TR_TEKNIK: GlossaryTexts<"teknik"> = {
  "hareketli-ortalama": {
    term: "Hareketli Ortalama",
    definition:
      "Son belirli sayıdaki kapanış fiyatının ortalamasıdır; her yeni gün en eski gün hesaptan çıkar, bu yüzden ortalama fiyatla birlikte \"hareket eder\". Günlük gürültüyü süzüp fiyatın genel yönünü görmeye yarar. En çok izlenenler 50 ve 200 günlük ortalamalardır. Geçmiş fiyatlardan hesaplandığı için her zaman fiyatın gerisinden gelir; yönü gösterir, geleceği söylemez.",
    example:
      "Son beş günün kapanışları 10, 11, 12, 13 ve 14 dolarsa beş günlük basit hareketli ortalama 12 dolardır. Ertesi gün 15 dolardan kapanırsa 10 hesaptan çıkar ve ortalama 13 dolara yükselir.",
    match: ["hareketli ortalama", "basit hareketli ortalama", "SMA"],
  },
  "ussel-hareketli-ortalama": {
    term: "Üssel Hareketli Ortalama (EMA)",
    definition:
      "Son fiyatlara eski fiyatlardan daha fazla ağırlık veren bir hareketli ortalamadır. Bu yüzden fiyat yön değiştirdiğinde basit ortalamadan daha çabuk tepki verir, ama kısa süreli dalgalanmalara da daha kolay kapılır. Her gün yeni kapanış, 2 / (dönem sayısı + 1) ağırlığıyla ortalamaya katılır. MACD gibi başka göstergeler de üssel ortalamalar üzerine kuruludur.",
    example:
      "10 günlük EMA'da yeni günün ağırlığı 2 / 11, yani yaklaşık %18'dir. Dünkü EMA 50 dolar, bugünkü kapanış 55 dolarsa yeni EMA yaklaşık 50 + 0,18 × 5 = 50,9 dolar olur.",
    match: ["üssel hareketli ortalama", "EMA"],
  },
  "altin-kesisim": {
    term: "Altın Kesişim",
    definition:
      "50 günlük hareketli ortalamanın 200 günlük hareketli ortalamayı aşağıdan yukarı kesmesidir. Kısa vadeli ortalama uzun vadeliyi geçtiği için yakın dönem fiyatların uzun dönemin üstüne çıktığını gösterir ve geleneksel olarak yükseliş eğiliminin güçlendiği biçiminde okunur. İki ortalama da geçmiş fiyatlardan hesaplandığı için kesişim çoğu zaman hareketin önemli bir kısmı gerçekleştikten sonra oluşur. Yatay seyreden piyasada ortalamalar sık sık kesişip yanıltıcı sinyal verebilir.",
    match: ["altın kesişim", "altın çapraz"],
  },
  "olum-kesisimi": {
    term: "Ölüm Kesişimi",
    definition:
      "50 günlük hareketli ortalamanın 200 günlük hareketli ortalamayı yukarıdan aşağı kesmesidir. Altın kesişimin tersidir ve geleneksel olarak düşüş eğiliminin güçlendiği biçiminde okunur. Adı dramatik olsa da gecikmeli bir göstergedir: çoğu zaman fiyat zaten belirgin biçimde düştükten sonra oluşur ve ardından fiyatın toparlandığı örnekler de az değildir.",
    match: ["ölüm kesişim", "ölüm çaprazı"],
  },
  "rsi": {
    term: "Relative Strength Index (RSI)",
    definition:
      "Belirli bir dönemdeki ortalama yükselişlerin ortalama düşüşlere oranından hesaplanan, 0 ile 100 arasında gidip gelen bir momentum göstergesidir. Varsayılan dönem 14'tür ve 70 üstü geleneksel olarak aşırı alım, 30 altı aşırı satım bölgesi sayılır. Bu eşikler bir dönüşün geleceğini söylemez; güçlü bir yükseliş trendinde RSI uzun süre 70'in üstünde kalabilir. Fiyat yeni zirve yaparken RSI'ın yapamaması (uyumsuzluk) momentumun zayıfladığı biçiminde yorumlanır.",
    example:
      "14 günlük dönemde ortalama yükseliş 2 dolar, ortalama düşüş 1 dolarsa oran 2'dir ve RSI = 100 - 100 / (1 + 2), yani yaklaşık 66,7 olur.",
    match: ["RSI", "göreceli güç endeksi", "göreli güç endeksi"],
  },
  "macd": {
    term: "Hareketli Ortalama Yakınsama Iraksama (MACD)",
    definition:
      "12 günlük üssel hareketli ortalamadan 26 günlük üssel hareketli ortalamanın çıkarılmasıyla bulunan bir momentum göstergesidir. Bu farkın 9 günlük üssel ortalamasına sinyal çizgisi, MACD ile sinyal çizgisi arasındaki farka histogram denir. MACD'nin sinyal çizgisini yukarı kesmesi geleneksel olarak momentumun yukarı döndüğü, aşağı kesmesi aşağı döndüğü biçiminde okunur. Ortalamalardan türediği için gecikmelidir ve yatay piyasada sık yanıltıcı kesişim üretir.",
    example:
      "12 günlük EMA 105, 26 günlük EMA 102 dolarsa MACD 3'tür. Sinyal çizgisi 2,5 ise histogram 0,5 gösterir.",
    match: ["MACD"],
  },
  "asiri-alim": {
    term: "Aşırı Alım",
    definition:
      "Fiyatın kısa sürede o kadar hızlı yükseldiğini anlatır ki bir momentum göstergesi (çoğunlukla RSI'ın 70 üstü) geleneksel eşiğin üstüne çıkmıştır. Yükselişin soluklanabileceği ya da geri çekilebileceği biçiminde yorumlanır. Ama bir satış sinyali değildir: güçlü trendlerde fiyat haftalarca aşırı alım bölgesinde kalıp yükselmeye devam edebilir.",
    match: ["aşırı alım"],
  },
  "asiri-satim": {
    term: "Aşırı Satım",
    definition:
      "Fiyatın kısa sürede o kadar hızlı düştüğünü anlatır ki bir momentum göstergesi (çoğunlukla RSI'ın 30 altı) geleneksel eşiğin altına inmiştir. Düşüşün yavaşlayabileceği ya da bir tepki yükselişi gelebileceği biçiminde yorumlanır. Ama bir alış sinyali değildir: sert düşüşlerde, özellikle kötü bir haberin ardından, fiyat uzun süre aşırı satım bölgesinde kalabilir.",
    match: ["aşırı satım"],
  },
  "destek-seviyesi": {
    term: "Destek Seviyesi",
    definition:
      "Geçmişte fiyatın düşüşünün birkaç kez durduğu ve alıcıların devreye girdiği fiyat bölgesidir. Tek bir kesin rakamdan çok bir aralık olarak düşünülmesi daha doğrudur. Fiyat bu bölgeye yaklaştığında yine tepki verip vermeyeceği izlenir. Destek kırıldığında, yani fiyat belirgin biçimde altına indiğinde, o bölge geleneksel olarak bu kez direnç gibi davranabilir; bu bir kural değil, sık görülen bir eğilimdir.",
    match: ["destek seviye", "destek bölge"],
  },
  "direnc-seviyesi": {
    term: "Direnç Seviyesi",
    definition:
      "Geçmişte fiyatın yükselişinin birkaç kez durduğu ve satıcıların ağır bastığı fiyat bölgesidir. Destek gibi tek bir rakamdan çok bir aralık olarak düşünülür. Fiyat bu bölgeyi belirgin biçimde aştığında kırılım olmuş sayılır ve eski direnç geleneksel olarak destek gibi davranabilir. Seviyenin ne kadar önemli sayıldığı genellikle kaç kez test edildiğine ve o sırada gerçekleşen işlem hacmine bağlanır.",
    match: ["direnç seviye", "direnç bölge"],
  },
  "pivot-noktasi": {
    term: "Pivot Noktası",
    definition:
      "Bir önceki dönemin (genellikle bir önceki günün) en yüksek, en düşük ve kapanış fiyatlarının ortalamasıyla hesaplanan referans seviyesidir. Bu noktadan türetilen seviyeler olası dirençler (R1, R2) ve destekler (S1, S2) olarak kullanılır. Özellikle gün içi işlemcilerin baktığı bir araçtır. Formül mekaniktir; seviyelerin önemi, çok sayıda piyasa katılımcısının aynı seviyelere bakmasından gelir.",
    example:
      "Dün en yüksek 110, en düşük 100, kapanış 105 dolarsa pivot (110 + 100 + 105) / 3 = 105 dolardır. İlk direnç 2 × 105 - 100 = 110, ilk destek 2 × 105 - 110 = 100 dolar olur.",
    match: ["pivot noktası", "pivot seviye"],
  },
  "trend-cizgisi": {
    term: "Trend Çizgisi",
    definition:
      "Grafikte ardışık diplerin (yükseliş trendinde) ya da ardışık tepelerin (düşüş trendinde) birleştirilmesiyle çizilen düz çizgidir. Trendin yönünü ve eğimini gözle görmeyi sağlar. Çizginin kaç noktaya dokunduğu güvenilirliğinin ölçüsü olarak kabul edilir. Hangi noktaların seçileceği çizen kişiye bağlı olduğu için iki analist aynı grafikte farklı çizgiler çizebilir.",
    match: ["trend çizgisi", "trend çizgileri"],
  },
  "kirilim": {
    term: "Kırılım",
    definition:
      "Fiyatın bir direnç seviyesinin üstüne ya da bir destek seviyesinin altına belirgin biçimde geçmesidir. Geleneksel okumada ortalamanın üstünde işlem hacmiyle gelen kırılım daha anlamlı sayılır. Fiyat kısa süre seviyenin ötesine geçip hızla geri dönerse buna sahte kırılım denir ve bu sık görülür. Bu yüzden birçok analist kapanışın seviyenin ötesinde gerçekleşmesini bekler.",
    match: ["yukarı yönlü kırılım", "aşağı yönlü kırılım", "sahte kırılım"],
  },
  "fibonacci-duzeltmesi": {
    term: "Fibonacci Düzeltmesi",
    definition:
      "Belirgin bir yükseliş ya da düşüşten sonra fiyatın bu hareketin ne kadarını geri alabileceğini gösteren yatay seviyelerdir. Kullanılan oranlar %23,6, %38,2, %61,8 ve %78,6'dır; %50 bir Fibonacci oranı değildir ama yaygın olarak eklenir. Oranların piyasa üzerinde kanıtlanmış bir etkisi yoktur. Seviyeler, çok sayıda katılımcı aynı yerlere baktığı için izlenir ve hangi tepe ile dibin seçildiğine göre değişir.",
    example:
      "Hisse 100 dolardan 200 dolara çıktıysa %38,2 düzeltme 200 - 38,2 = 161,8 dolara, %50 düzeltme 150 dolara, %61,8 düzeltme 138,2 dolara denk gelir.",
    match: ["fibonacci düzeltme", "fibonacci seviye"],
  },
  "bollinger-bantlari": {
    term: "Bollinger Bantları",
    definition:
      "Fiyatın 20 dönemlik hareketli ortalamasının iki yanına, ortalamadan 2 standart sapma uzaklıkta çizilen iki banttan oluşur. Oynaklık arttıkça bantlar açılır, azaldıkça daralır. Bantların belirgin biçimde daralması (sıkışma), sakin bir dönemin ardından sert bir hareket gelebileceği biçiminde yorumlanır ama hareketin yönünü söylemez. Fiyatın üst banda değmesi tek başına bir satış, alt banda değmesi tek başına bir alış sinyali sayılmaz.",
    match: ["bollinger bant"],
  },
  "atr": {
    term: "Ortalama Gerçek Aralık (ATR)",
    definition:
      "Bir hissenin tipik olarak bir dönemde ne kadar oynadığını fiyat birimiyle ölçen oynaklık göstergesidir. Her gün için gerçek aralık şu üçünün en büyüğüdür: günün en yüksek eksi en düşük fiyatı, en yüksek ile önceki kapanış arasındaki fark ve en düşük ile önceki kapanış arasındaki fark. ATR bu değerlerin genellikle 14 günlük ortalamasıdır. Yön hakkında bir şey söylemez; zarar durdur mesafesini ya da pozisyon büyüklüğünü oynaklığa göre ayarlamak için kullanılır.",
    example:
      "100 dolarlık bir hissenin ATR'si 3 dolarsa hisse bir günde tipik olarak 3 dolar civarında oynuyor demektir. Zarar durdur seviyesini 2 ATR aşağıya koyan biri onu 94 dolara yerleştirir.",
    match: ["ATR", "ortalama gerçek aralık"],
  },
  "vwap": {
    term: "Hacim Ağırlıklı Ortalama Fiyat (VWAP)",
    definition:
      "Gün içinde gerçekleşen işlemlerin fiyatlarının işlem hacmiyle ağırlıklandırılmış ortalamasıdır; her işlem gününün başında sıfırdan hesaplanmaya başlar. Kurumsal yatırımcılar büyük emirlerini ortalama olarak iyi bir fiyattan gerçekleştirip gerçekleştirmediklerini ölçmek için onu referans alır. Fiyatın VWAP'ın üstünde olması, hissenin o an günün hacimle ağırlıklandırılmış ortalama işlem fiyatından daha yüksekten işlem gördüğü anlamına gelir; bir yön tahmini değil, günün ortalamasına göre konumdur.",
    example:
      "Gün içinde 100 hisse 10 dolardan, 300 hisse 12 dolardan el değiştirdiyse VWAP (1.000 + 3.600) / 400 = 11,5 dolardır.",
    match: ["VWAP", "hacim ağırlıklı ortalama fiyat"],
  },
  "mum-grafigi": {
    term: "Mum Grafiği",
    definition:
      "Her dönemin açılış, en yüksek, en düşük ve kapanış fiyatını tek bir \"mum\" ile gösteren grafik türüdür. Mumun gövdesi açılış ile kapanış arasını, üstündeki ve altındaki ince fitiller ise dönemin en yüksek ve en düşük fiyatlarını gösterir. Kapanış açılışın üstündeyse mum genellikle yeşil ya da içi boş, altındaysa kırmızı ya da içi dolu çizilir. Tek bir mum dönemin içinde alıcıyla satıcı arasındaki dengeyi özetler.",
    match: ["mum grafiği", "mum grafikleri", "japon mumları"],
  },
  "fiyat-boslugu": {
    term: "Fiyat Boşluğu",
    definition:
      "Fiyatın bir önceki dönemin işlem aralığının tamamen üstünde ya da altında açılması ve grafikte arada hiç işlem görülmeyen bir boşluk kalmasıdır. Günlük grafiklerde çoğunlukla piyasa kapalıyken gelen bir haberden, örneğin kapanış sonrası açıklanan bir bilançodan sonra oluşur. \"Boşluklar kapanır\" diye yaygın bir söz vardır ama bir kural değildir; bazı boşluklar uzun süre ya da hiç kapanmaz.",
    match: ["fiyat boşluğu", "boşluklu açılış"],
  },
  "risk-getiri-orani": {
    term: "Risk/Getiri Oranı",
    definition:
      "Bir işlemde göze alınan olası zararın, hedeflenen olası kazanca oranıdır. Giriş fiyatı ile zarar durdur seviyesi arasındaki fark riski, giriş ile hedef fiyat arasındaki fark getiriyi verir. Oran tek başına bir işlemin iyi olup olmadığını söylemez, çünkü hedefe ulaşma olasılığını hesaba katmaz: 1'e 3'lük bir oran, hedefe nadiren ulaşılıyorsa zarar ettirebilir.",
    example:
      "100 dolardan girip zarar durduru 95 dolara, hedefi 115 dolara koyarsan risk 5, getiri 15 dolardır ve oran 1'e 3 olur.",
    match: ["risk/getiri oranı", "risk-getiri oranı", "risk getiri oranı"],
  },
};
