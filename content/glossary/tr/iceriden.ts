/* Sözlük — Bildirimler ve İçeriden İşlemler (Türkçe). Yapı `../meta.ts`te. */
import type { GlossaryTexts } from "../meta";

export const TR_ICERIDEN: GlossaryTexts<"iceriden"> = {
  "sec": {
    term: "SEC (ABD Menkul Kıymetler ve Borsa Komisyonu)",
    definition:
      "ABD sermaye piyasalarını düzenleyen ve denetleyen federal kurumdur; 1934 tarihli Menkul Kıymetler Borsası Kanunu ile kuruldu. Halka açık şirketlerin çeyreklik ve yıllık raporları, yöneticilerin hisse işlemleri ve büyük yatırımcıların pozisyon bildirimleri SEC'e yapılır. Bu belgelerin tamamı kurumun EDGAR veri tabanında herkese açık olarak yayımlanır.",
    match: ["SEC", "Menkul Kıymetler ve Borsa Komisyonu"],
  },
  "iceriden-islem": {
    term: "İçeriden İşlem",
    definition:
      "Bir şirketin yöneticilerinin, yönetim kurulu üyelerinin ya da hisselerinin %10'undan fazlasına sahip ortaklarının o şirketin hisselerini alıp satmasıdır. Bu işlemler ABD'de yasaldır ve SEC'e Form 4 ile bildirilir. Kamuya açıklanmamış önemli bir bilgiye dayanarak işlem yapmak ise yasa dışıdır ve ayrı bir şeydir. Yatırımcılar içeriden satışları çoğu zaman vergi, çeşitlendirme ya da önceden planlanmış satış programları gibi sıradan sebeplerle açıklar; birden fazla yöneticinin kendi cebinden alım yapması ise daha çok dikkat çeker.",
    match: ["içeriden işlem", "içeriden alım", "içeriden satış"],
  },
  "form-4": {
    term: "Form 4",
    definition:
      "Şirket yöneticilerinin, yönetim kurulu üyelerinin ve hisselerin %10'undan fazlasına sahip ortakların, şirket hisselerindeki sahiplik değişikliğini SEC'e bildirdiği formdur. İşlemden sonraki iki iş günü içinde verilmesi gerekir. Formda işlemin tarihi, hisse adedi, fiyatı ve türü yazar; işlem kodu P piyasadan alımı, S satışı gösterir, hisse ödülü ve opsiyon kullanımı gibi işlemlerin de kendi kodları vardır.",
    example:
      "Bir yönetim kurulu üyesi pazartesi günü piyasadan hisse alırsa, araya tatil girmediği sürece Form 4'ü en geç çarşamba günü vermesi gerekir.",
    match: ["Form 4"],
  },
  "form-13f": {
    term: "Form 13F",
    definition:
      "Yönettiği 13(f) kapsamındaki menkul kıymetlerin (başlıca ABD borsalarında işlem gören hisseler) değeri 100 milyon dolar ve üzerinde olan kurumsal yatırımcıların, her çeyrek sonundaki pozisyonlarını SEC'e bildirdiği formdur. Çeyrek bitiminden sonraki 45 gün içinde verilir. Yalnızca uzun pozisyonları gösterir, açığa satışları göstermez; veri de 45 güne kadar gecikmeli geldiği için fonun bugünkü portföyünü değil çeyrek sonundaki fotoğrafını yansıtır.",
    match: ["13F", "Form 13F"],
  },
  "form-13d": {
    term: "Schedule 13D",
    definition:
      "Bir şirketin oy hakkı taşıyan hisselerinin %5'inden fazlasına sahip olan yatırımcının SEC'e verdiği bildirimdir. Formda kimin ne kadar hisse aldığı, parayı nereden bulduğu ve şirketle ilgili amacı, örneğin yönetime müdahale etme niyeti yazılır; önemli değişikliklerde güncellenir. Şirketi etkileme niyeti olmayan pasif yatırımcılar belirli şartlarla daha kısa olan Schedule 13G'yi verir. Bu yüzden 13D, aktivist yatırımcıların sahneye çıktığı an olarak izlenir.",
    match: ["Schedule 13D", "13D", "Schedule 13G", "13G"],
  },
  "kilitlenme-suresi": {
    term: "Kilitlenme Süresi (Lock-Up)",
    definition:
      "Halka arzdan sonra şirket yöneticilerinin, çalışanlarının ve arz öncesi yatırımcılarının hisselerini satamadığı dönemdir. Yasal bir zorunluluk değil, aracı kurumlarla yapılan bir sözleşmedir ve çoğunlukla 180 gün sürer. Süre dolduğunda satılabilir hisse sayısı birden artabileceği için bu tarih piyasada izlenir.",
    match: ["kilitlenme süresi", "lock-up süresi", "lock-up"],
  },
  "hisse-bazli-odeme": {
    term: "Hisse Bazlı Ödeme",
    definition:
      "Şirketin çalışanlarına ücretin bir parçası olarak kısıtlı hisse birimi (RSU) ya da hisse opsiyonu vermesidir. ABD muhasebe standartlarında (GAAP) gider olarak yazılır, ama nakit çıkışı olmadığı için nakit akış tablosunda net kâra geri eklenir; birçok şirket de düzeltilmiş kâr hesabında bu gideri dışarıda bırakır. Maliyeti hissedara hisse seyrelmesi olarak yansır, bu yüzden şirketler çoğu zaman geri alımlarla bu seyrelmeyi dengelemeye çalışır.",
    match: ["hisse bazlı ödeme", "hisse bazlı ücret", "RSU"],
  },
};
