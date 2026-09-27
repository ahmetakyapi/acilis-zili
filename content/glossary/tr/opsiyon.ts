/* Sözlük — Opsiyonlar (Türkçe). Yapı `../meta.ts`te. */
import type { GlossaryTexts } from "../meta";

export const TR_OPSIYON: GlossaryTexts<"opsiyon"> = {
  "opsiyon": {
    term: "Opsiyon",
    definition:
      "Opsiyon, sahibine bir varlığı belirli bir fiyattan belirli bir tarihe kadar (ya da o tarihte) alma veya satma hakkı veren, ama bunu zorunlu kılmayan sözleşmedir. Alan taraf bu hak için opsiyon primi öder; satan taraf primi alır ve opsiyon kullanılırsa sözleşmenin gereğini yerine getirmek zorundadır. ABD'de standart bir hisse opsiyonu sözleşmesi 100 hisseyi kapsar.",
    match: ["opsiyon sözleşmesi"],
  },
  "alim-opsiyonu": {
    term: "Alım Opsiyonu (Call)",
    definition:
      "Alım opsiyonu, sahibine bir hisseyi kullanım fiyatından vade sonuna kadar satın alma hakkı verir. Hisse kullanım fiyatının üzerine çıktıkça değeri artar; vade sonunda hisse kullanım fiyatının altındaysa değersiz kalır ve alıcının kaybı ödediği primle sınırlıdır. Başa baş noktası, kullanım fiyatı ile ödenen primin toplamıdır.",
    example:
      "100 dolar kullanım fiyatlı alım opsiyonunu 3 dolar primle aldın (sözleşme başına 300 dolar). Vade sonunda hisse 110 dolarsa opsiyon 10 dolar eder ve net kazanç hisse başına 7, sözleşme başına 700 dolardır. Hisse 100 doların altında kalırsa 300 dolarlık primin tamamını kaybedersin.",
    match: ["alım opsiyonu", "call opsiyon"],
  },
  "satim-opsiyonu": {
    term: "Satım Opsiyonu (Put)",
    definition:
      "Satım opsiyonu, sahibine bir hisseyi kullanım fiyatından vade sonuna kadar satma hakkı verir. Hisse kullanım fiyatının altına indikçe değeri artar; bu yüzden elindeki hisseyi düşüşe karşı korumak için de kullanılır. Alıcının kaybı ödediği primle sınırlıdır; başa baş noktası kullanım fiyatından primin çıkarılmasıyla bulunur.",
    example:
      "100 dolar kullanım fiyatlı satım opsiyonunu 4 dolar primle aldın. Vade sonunda hisse 90 dolarsa opsiyon 10 dolar eder ve net kazanç hisse başına 6 dolardır. Başa baş noktası 96 dolardır.",
    match: ["satım opsiyonu", "put opsiyon"],
  },
  "kullanim-fiyati": {
    term: "Kullanım Fiyatı (Strike)",
    definition:
      "Kullanım fiyatı, opsiyon sahibinin hisseyi alabileceği (alım opsiyonunda) ya da satabileceği (satım opsiyonunda) sabit fiyattır. Sözleşmede baştan belirlenir ve vade boyunca değişmez. Aynı hisse ve aynı vade için birçok farklı kullanım fiyatında opsiyon işlem görür.",
    example:
      "50 dolar kullanım fiyatlı bir alım opsiyonun varken hisse 60 dolara çıkarsa, hakkını kullanarak hisseyi 50 dolardan alabilirsin; opsiyonun içsel değeri hisse başına 10 dolardır.",
    match: ["kullanım fiyatı", "strike fiyatı", "işleme koyma fiyatı"],
  },
  "vade-sonu": {
    term: "Vade Sonu",
    definition:
      "Vade sonu, bir opsiyonun geçerliliğinin bittiği tarihtir; bu tarihten sonra hak kullanılamaz. ABD'de aylık hisse opsiyonları ayın üçüncü cuması sona erer, bunun yanında haftalık ve daha kısa vadeli opsiyonlar da vardır. Hisse opsiyonları Amerikan tipidir ve vadeye kadar her an kullanılabilir; S&P 500 endeks opsiyonları gibi Avrupa tipi opsiyonlar yalnızca vade sonunda kullanılır.",
    match: ["opsiyon vadesi"],
  },
  "opsiyon-primi": {
    term: "Opsiyon Primi",
    definition:
      "Opsiyon primi, opsiyonun piyasa fiyatıdır: alıcının ödediği, satıcının aldığı tutar. İki parçadan oluşur: opsiyonun hemen kullanılsa getireceği içsel değer ve kalan süre ile beklenen oynaklığa bağlı zaman değeri. Fiyatlar hisse başına verilir; 100 hisselik bir sözleşmenin tutarı için 100 ile çarpılır.",
    example:
      "Hisse 105 dolarken 100 dolar kullanım fiyatlı alım opsiyonunun primi 7 dolarsa, bunun 5 doları içsel değer, 2 doları zaman değeridir. Bir sözleşme 700 dolar tutar.",
    match: ["opsiyon primi"],
  },
  "parada": {
    term: "Parada, Paranın İçinde ve Dışında",
    definition:
      "Bu üç ifade, opsiyonun kullanım fiyatının hisse fiyatına göre nerede durduğunu anlatır. Alım opsiyonu, hisse kullanım fiyatının üzerindeyse paranın içinde (ITM), altındaysa paranın dışında (OTM), iki fiyat hemen hemen eşitse parada (ATM) sayılır; satım opsiyonunda içi ve dışı tersine döner. Paranın dışındaki bir opsiyonun primi yalnızca zaman değerinden oluşur.",
    example:
      "Hisse 100 dolarken 90 dolar kullanım fiyatlı alım opsiyonu paranın içinde (içsel değeri 10 dolar), 110 dolarlık paranın dışında, 100 dolarlık ise paradadır. Aynı fiyatlarda 110 dolarlık satım opsiyonu paranın içindedir.",
    match: ["paranın içinde", "paranın dışında", "ITM", "OTM"],
  },
  "delta": {
    term: "Delta",
    definition:
      "Delta, hisse fiyatı 1 dolar değiştiğinde opsiyon priminin yaklaşık ne kadar değişeceğini gösterir. Alım opsiyonunda 0 ile 1, satım opsiyonunda 0 ile eksi 1 arasındadır; paradaki opsiyonların deltası yaklaşık 0,5 civarındadır. Kaba bir ölçü olarak, opsiyonun vade sonunda paranın içinde bitme olasılığının yaklaşık bir göstergesi olarak da okunur.",
    example:
      "Deltası 0,40 olan bir alım opsiyonunda hisse 1 dolar yükselirse prim yaklaşık 0,40 dolar artar; 100 hisselik sözleşme için bu yaklaşık 40 dolardır.",
    match: ["opsiyon deltası"],
  },
  "theta": {
    term: "Theta",
    definition:
      "Theta, diğer her şey sabitken yalnızca bir günün geçmesiyle opsiyon priminin ne kadar eriyeceğini gösterir. Opsiyon alıcısı için negatiftir: zaman değeri her gün biraz azalır ve bu erime vade sonu yaklaştıkça, özellikle paradaki opsiyonlarda hızlanır. Opsiyon satıcısı için ise bu erime lehine işler.",
    example:
      "Thetası eksi 0,05 olan bir opsiyon, hisse fiyatı ve oynaklık değişmezse günde yaklaşık 5 sent, 100 hisselik sözleşmede yaklaşık 5 dolar değer kaybeder.",
    match: ["opsiyon thetası", "zaman değeri kaybı"],
  },
  "ortuk-oynaklik": {
    term: "Örtük Oynaklık",
    definition:
      "Örtük oynaklık, opsiyon fiyatlarından geriye doğru hesaplanan ve piyasanın hissede önümüzdeki dönemde beklediği oynaklığı gösteren ölçüdür; yıllık yüzde olarak verilir. Opsiyonlar pahalandıkça örtük oynaklık yükselir. Bilanço gibi belirsizlik yaratan olaylardan önce genellikle artar, olay geçtikten sonra da çoğu zaman hızla düşer.",
    match: ["örtük oynaklık", "zımni oynaklık", "implied volatility"],
  },
  "beklenen-hareket": {
    term: "Beklenen Hareket",
    definition:
      "Beklenen hareket, opsiyon fiyatlarının bir hisse için belirli bir tarihe kadar ima ettiği yaklaşık fiyat aralığıdır. Pratikte en sık, en yakın vadeli paradaki alım ve satım opsiyonlarının primleri toplanarak (straddle fiyatı) kabaca hesaplanır. Yön söylemez, yalnızca büyüklük söyler; gerçekleşen hareket bu aralığın içinde de dışında da kalabilir.",
    example:
      "Hisse 100 dolarken bilançodan hemen sonraki vadede 100 dolar kullanım fiyatlı alım ve satım opsiyonlarının primleri 4'er dolarsa, toplam 8 dolar eder ve piyasa kabaca yüzde 8 civarında bir hareket fiyatlıyor demektir.",
    match: ["beklenen hareket", "expected move"],
  },
  "straddle": {
    term: "Straddle",
    definition:
      "Straddle, aynı hisse, aynı kullanım fiyatı ve aynı vade için bir alım ve bir satım opsiyonunu birlikte almaktır. Sonucu yön değil hareketin büyüklüğü belirler: hisse iki yönden birinde, ödenen toplam primden daha fazla hareket ederse kâr eder. Hisse yerinde sayarsa iki opsiyon da zaman değeri kaybeder ve en kötü durumda ödenen primin tamamı kaybedilir.",
    example:
      "Hisse 100 dolarken 100 dolar kullanım fiyatlı alım opsiyonunu 4, satım opsiyonunu 4 dolara aldın; toplam maliyet hisse başına 8 dolar. Vade sonunda kâra geçmek için hissenin 92 doların altına ya da 108 doların üstüne gitmesi gerekir.",
    match: ["straddle"],
  },
  "ortulu-alim": {
    term: "Örtülü Alım (Covered Call)",
    definition:
      "Örtülü alım, sahip olduğun her 100 hisse için bir alım opsiyonu satmaktır. Opsiyon priminden ek gelir elde edersin; karşılığında hisse kullanım fiyatının üzerine çıkarsa yükselişin o noktadan sonrası senin olmaz, çünkü hisse kullanım fiyatından elinden alınabilir. Düşüş riski ise büyük ölçüde sürer, yalnızca alınan prim kadar hafifler.",
    example:
      "Hisse 100 dolarken 110 dolar kullanım fiyatlı alım opsiyonunu 2 dolar primle sattın. Vade sonunda hisse 120 dolarsa hisse 110 dolardan elinden çıkar ve toplam kazancın hisse başına 12 dolarda (10 dolar fiyat farkı artı 2 dolar prim) kalır.",
    match: ["örtülü alım", "covered call"],
  },
  "vix": {
    term: "VIX (Korku Endeksi)",
    definition:
      "VIX, Cboe'nin S&P 500 opsiyon fiyatlarından hesapladığı ve piyasanın önümüzdeki 30 gün için beklediği oynaklığı yıllık yüzde olarak gösteren endekstir. Piyasalar sakinken düşük seyreder, sert düşüşlerde ve belirsizlik dönemlerinde hızla yükselir; bu yüzden korku endeksi diye de anılır. Doğrudan satın alınamaz; VIX'e bağlı vadeli işlemler ve fonlar ise endeksin kendisinden belirgin biçimde farklı davranabilir.",
    example:
      "VIX 16 ise piyasa S&P 500 için yıllık yaklaşık yüzde 16 oynaklık fiyatlıyor demektir; bu da bir aylık dönem için kabaca yüzde 4,6'lık bir standart sapmaya denk gelir (16'nın 12'nin kareköküne bölünmesi).",
    match: ["VIX", "korku endeksi"],
  },
};
