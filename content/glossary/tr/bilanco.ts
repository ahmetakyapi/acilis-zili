/* Sözlük — Bilanço Dönemi (Türkçe). Yapı `../meta.ts`te. */
import type { GlossaryTexts } from "../meta";

export const TR_BILANCO: GlossaryTexts<"bilanco"> = {
  "bilanco-sezonu": {
    term: "Bilanço Sezonu",
    definition:
      "Halka açık şirketlerin biten çeyreğin sonuçlarını art arda açıkladığı birkaç haftalık dönemdir. ABD'de her çeyrek bitiminden birkaç hafta sonra, genellikle büyük bankaların sonuçlarıyla başlar ve S&P 500 şirketlerinin çoğu sonraki altı hafta kadar içinde açıklar. Şirketler sonuçlarını çoğunlukla açılıştan önce ya da kapanıştan sonra duyurur, bu yüzden en sert fiyat hareketleri seans dışında ve ertesi açılışta görülür. Sezon boyunca tek tek şirketlerin sonuçları, sektörün ve genel ekonominin gidişatına dair ipucu olarak da okunur.",
    match: ["bilanço sezonu"],
  },
  "mali-ceyrek": {
    term: "Mali Çeyrek",
    definition:
      "Şirketin mali yılının üç aylık dilimlerinden biridir ve Q1, Q2, Q3, Q4 diye anılır. Mali yılı takvim yılıyla aynı olan şirkette ilk çeyrek ocak ile mart arasını kapsar. Mali yılı farklı bir ayda biten şirkette ise çeyreklerin adları takvimdeki çeyreklerle örtüşmez. Bu yüzden iki şirketin \"üçüncü çeyrek\" sonuçlarını kıyaslamadan önce hangi ayları kapsadığına bakmak gerekir.",
    match: ["mali çeyrek"],
  },
  "mali-yil": {
    term: "Mali Yıl",
    definition:
      "Şirketin yıllık finansal raporlamasında esas aldığı on iki aylık dönemdir. Birçok şirkette takvim yılıyla aynıdır, ama bazı şirketler mali yılını kendi iş döngüsüne göre farklı bir ayda bitirir. Mali yıl genellikle bittiği takvim yılının adıyla anılır, bu da yıl adlarının takvimin önüne geçmesine yol açabilir.",
    example:
      "Mali yılı eylül sonunda biten bir şirketin 2026 mali yılı, Ekim 2025 ile Eylül 2026 arasını kapsar. Bu şirketin \"2026'nın ilk çeyreği\" dediği dönem Ekim ile Aralık 2025 arasıdır.",
    match: ["mali yıl"],
  },
  "konsensus": {
    term: "Konsensüs Beklentisi",
    definition:
      "Bir şirketi izleyen analistlerin hisse başı kâr, gelir gibi kalemler için yaptığı tahminlerin ortalaması ya da medyanıdır. Veri sağlayıcıları bu tahminleri toplayıp yayımlar ve kaynağa göre rakam biraz farklı olabilir. Bilanço günü sonuçlar bu rakamla kıyaslanır: fiyat mutlak sonuca değil, sonucun beklentiye göre nerede kaldığına tepki verir. Beklenti zaten yüksekse iyi bir sonuç bile hayal kırıklığı sayılabilir.",
    match: ["konsensüs beklenti", "konsensüs tahmin", "analist beklenti"],
  },
  "eps-surprizi": {
    term: "EPS Sürprizi",
    definition:
      "Açıklanan hisse başı kârın konsensüs beklentisinden ne kadar saptığıdır ve genellikle yüzde olarak verilir. Beklentinin üstündeki sonuca beklentiyi aşma, altındakine beklentinin gerisinde kalma denir. Tarihsel olarak şirketlerin çoğunluğu beklentiyi aşar, bu yüzden küçük bir aşım piyasa için sürpriz sayılmayabilir. Fiyatın tepkisi yalnızca bu rakama değil gelir, marjlar ve rehberliğe de bağlıdır; beklentiyi aşıp düşen hisse sık görülür.",
    example:
      "Konsensüs hisse başı kâr beklentisi 2,00 dolar, açıklanan rakam 2,10 dolarsa sürpriz (2,10 - 2,00) / 2,00 = %5'tir.",
    match: ["EPS sürprizi", "kâr sürprizi"],
  },
  "rehberlik": {
    term: "Rehberlik (Şirket Beklentisi)",
    definition:
      "Şirket yönetiminin gelecek çeyrek ya da mali yıl için gelir, kâr veya marj gibi kalemlerde paylaştığı kendi tahminidir; çoğunlukla bir aralık olarak verilir. Yasal bir zorunluluk değildir ve her şirket vermez. Piyasa rehberliği konsensüs beklentisiyle kıyaslar: biten çeyrek iyi olsa bile rehberlik beklentinin altında kalırsa hisse düşebilir. Rehberliğin yükseltilmesi ya da düşürülmesi çoğu zaman sonuçların kendisinden daha fazla fiyat hareketi yaratır.",
    match: ["şirket rehberliği", "yönetim rehberliği", "yıllık rehberlik", "rehberliğini yükselt", "rehberliğini düşür"],
  },
  "bilanco-toplantisi": {
    term: "Bilanço Toplantısı",
    definition:
      "Şirket yönetiminin sonuçlar açıklandıktan kısa süre sonra düzenlediği, analistlerin ve yatırımcıların dinleyebildiği telekonferans ya da canlı yayındır. Genellikle yönetimin sunumuyla başlar ve analistlerin sorularıyla devam eder. Rakamların arkasındaki nedenler, rehberliğin gerekçesi ve yönetimin tonu burada ortaya çıkar. Hisse fiyatı sonuçlar açıklandıktan sonra toplantı sırasında yön değiştirebilir.",
    match: ["bilanço toplantı", "bilanço sonrası toplantı"],
  },
  "yillik-bazda": {
    term: "Yıllık Bazda",
    definition:
      "Bir dönemin rakamını bir yıl önceki aynı dönemle kıyaslamaktır; İngilizcede YoY diye kısaltılır. Çeyreklik sonuçlarda bu çeyrek geçen yılın aynı çeyreğiyle kıyaslanır. Aynı mevsim kendisiyle kıyaslandığı için, örneğin yılbaşı alışverişinin her yıl dördüncü çeyreği şişirmesi gibi mevsimsel etkiler büyük ölçüde ortadan kalkar.",
    example:
      "Şirketin geliri geçen yılın üçüncü çeyreğinde 100 milyon dolar, bu yılın üçüncü çeyreğinde 120 milyon dolarsa gelir yıllık bazda %20 artmıştır.",
    match: ["yıllık bazda", "YoY"],
  },
  "ceyreklik-bazda": {
    term: "Çeyreklik Bazda",
    definition:
      "Bir çeyreğin rakamını hemen önceki çeyrekle kıyaslamaktır; İngilizcede QoQ diye kısaltılır. Son eğilimi yıllık kıyaslamadan daha hızlı gösterir. Ama mevsimsel etkilere açıktır: perakendeci gibi dördüncü çeyreği her yıl güçlü geçen bir şirkette ilk çeyrekteki düşüş, işlerin bozulduğu anlamına gelmeyebilir.",
    example:
      "Gelir ikinci çeyrekte 110 milyon dolar, üçüncü çeyrekte 120 milyon dolarsa çeyreklik bazda artış yaklaşık %9,1'dir.",
    match: ["çeyreklik bazda", "QoQ"],
  },
  "form-10-q": {
    term: "Form 10-Q",
    definition:
      "ABD'de halka açık şirketlerin mali yılın ilk üç çeyreği için SEC'e verdiği çeyreklik rapordur; dördüncü çeyrek yıllık 10-K raporunun içinde yer alır. Finansal tabloları, yönetimin değerlendirmesini ve risklerdeki önemli değişiklikleri içerir. Tablolar bağımsız denetçinin incelemesinden geçer ama tam denetimden geçmez. Şirketin büyüklüğüne göre çeyrek bitiminden 40 ya da 45 gün içinde verilmesi gerekir ve SEC'in EDGAR sisteminden herkes okuyabilir.",
    match: ["Form 10-Q", "10-Q"],
  },
  "form-10-k": {
    term: "Form 10-K",
    definition:
      "ABD'de halka açık şirketlerin SEC'e verdiği yıllık rapordur ve şirket hakkındaki en kapsamlı resmi belgedir. Bağımsız denetimden geçmiş finansal tabloları, iş modelinin anlatımını, risk faktörlerini ve yönetimin değerlendirmesini içerir. Şirketin büyüklüğüne göre mali yıl bitiminden 60 ila 90 gün içinde verilir. Yabancı özel ihraççı sayılan ABD dışı şirketler genellikle 10-K yerine 20-F formunu kullanır.",
    match: ["Form 10-K", "10-K"],
  },
  "form-8-k": {
    term: "Form 8-K",
    definition:
      "Şirketin, yatırımcıların bilmesi gereken önemli bir olay yaşandığında SEC'e verdiği güncel durum raporudur. Üst yönetim değişikliği, bir şirket satın alımı, iflas başvurusu gibi olaylar bu kapsama girer ve çoğu için olaydan sonraki dört iş günü içinde bildirim gerekir. Şirketler çeyreklik sonuç açıklamalarını da genellikle bir 8-K ile SEC'e iletir; bu yüzden bilanço günü ilk resmi belge çoğunlukla 10-Q değil 8-K'dır.",
    match: ["Form 8-K", "8-K"],
  },
  "hak-dusum-tarihi": {
    term: "Hak Düşüm Tarihi",
    definition:
      "Bu tarihte ya da sonrasında hisseyi alan yatırımcının açıklanmış temettüyü alamadığı ilk işlem günüdür. ABD'de takas Mayıs 2024'ten beri T+1 olduğu için normal nakit temettülerde hak düşüm tarihi kayıt tarihiyle aynı iş gününe denk gelir. Temettüyü almak için hisseyi en geç hak düşüm tarihinden önceki işlem günü satın almış olman gerekir. Hak düşüm günü hisse, öteki etkenler sabitken, genellikle temettü tutarı kadar düşük bir referans fiyattan işlem görmeye başlar.",
    example:
      "Hisse başı 1 dolar temettü açıklanmış ve hisse hak düşümden önceki gün 100 dolardan kapanmışsa, hak düşüm günü referans fiyat yaklaşık 99 dolar olur. Vergiyi saymazsak temettüyü alan yatırımcının toplam değeri değişmez.",
    match: ["hak düşüm tarihi", "hak düşüm"],
  },
  "kayit-tarihi": {
    term: "Kayıt Tarihi",
    definition:
      "Şirketin temettü ödeyeceği hissedarları belirlemek için esas aldığı tarihtir: bu tarihte şirketin kayıtlarında hissedar görünen herkes temettüyü alır. Tarihi temettüyü açıklarken yönetim kurulu belirler; ödeme ise genellikle birkaç gün ya da hafta sonra yapılır. ABD'de T+1 takas nedeniyle hisseyi kayıt tarihinde almak yetmez, çünkü işlem ertesi iş günü takasa girer; bu yüzden yatırımcı açısından belirleyici tarih hak düşüm tarihidir.",
    match: ["temettü kayıt tarihi", "record date"],
  },
};
