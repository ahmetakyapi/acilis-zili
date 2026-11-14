/**
 * `calendarFeed` ad alanı — takvim aboneliği (14 Kasım 2026): `/takvim` ve
 * `/bilancolar/takip`teki "Takvime Abone Ol" satırı ile `.ics` dosyalarının
 * içine yazılan metin (`lib/calendar-feed.ts`, `app/api/takvim/**`).
 * Sözlüğün parçası (tr.ts / en.ts bunu `calendarFeed` anahtarına koyuyor),
 * ayrı dosyada: paralel geliştirilen paketler sözlüğün ortasına anahtar
 * serpiştirmesin.
 *
 * `.ics` METNİ DE BURADA. Tek olay ucunda satır içi `tr ? … : …` olarak
 * duruyordu; abonelik aynı cümleleri yüzlerce olaya yazıyor ve bu metin
 * okurun takvim uygulamasında, sitenin DIŞINDA görünen tek şey.
 * Etkinlik başlığı (SUMMARY) ve takvim adı Title Case; açıklama cümle.
 */

export const calendarFeedTr = {
  /* Arayüz */
  subscribe: "Takvime Abone Ol",
  copy: "Adresi Kopyala",
  copied: "Kopyalandı",
  macroHint:
    "Veri açıklamaları Google ya da Apple Takvim'ine kendiliğinden gelir; saat değişirse orada da güncellenir. Google Takvim'de adresi kopyalayıp \"URL ile\" alanına yapıştır.",
  /* Ekranda önem süzgeci açıkken bağlantı da onu taşır. */
  macroHintFiltered:
    "Yalnız \"{impact}\" önemdeki açıklamalar Google ya da Apple Takvim'ine kendiliğinden gelir; saat değişirse orada da güncellenir. Google Takvim'de adresi kopyalayıp \"URL ile\" alanına yapıştır.",
  earningsHint:
    "Takip ettiğin şirketlerin bilanço günleri takvimine kendiliğinden gelir. Adres bugünkü listenle kurulur; listen değişirse yeniden abone ol.",
  earningsHintCapped:
    "Takip ettiğin şirketlerin bilanço günleri takvimine kendiliğinden gelir. Bir abonelik en çok {max} şirket taşır; adres listendeki ilk {max} sembolle kuruldu.",

  /* Takvim uygulamasının abonelik listesinde görünen ad ve açıklama */
  macroName: "Açılış Zili · Ekonomik Takvim",
  macroDescription:
    "ABD makro veri açıklamaları ve Fed toplantıları. Saatler takvim uygulamanın saat diliminde görünür.",
  earningsName: "Açılış Zili · Bilanço Takvimi",
  earningsDescription:
    "Seçtiğin şirketlerin yaklaşan bilanço tarihleri. Sağlayıcı saat vermediği için bilançolar tüm gün etkinliğidir; pencere başlıkta yazar.",

  /* Etkinlik metni */
  earningsSummary: "{symbol} Bilanço",
  window: { bmo: "Açılış Öncesi", amc: "Kapanış Sonrası", dmh: "Seans İçinde" },
  /* Aynı pencere cümlenin içinde. */
  windowInline: { bmo: "açılış öncesi", amc: "kapanış sonrası", dmh: "seans içinde" },
  earningsBody: "{company} {date} tarihinde çeyrek sonuçlarını açıklıyor.",
  earningsWindowKnown: "Sağlayıcı kesin saat vermiyor; açıklama {window} bekleniyor.",
  earningsWindowUnknown: "Sağlayıcı açıklama saatini vermiyor.",
  /* Tüm gün etkinliği New York gününe yazılıyor; kışın kapanış (16:00 ET)
     Türkiye'de 00:00'dır, yani açıklama okurun takviminde ertesi güne düşer. */
  earningsDateNote:
    "Tarih New York takvimine göredir; kapanış sonrası açıklama Türkiye'de gece yarısını geçebilir.",
  economicBody: "Ekonomik veri açıklaması. Önem: {impact}.",
  economicNoTime: "Saati ilan edilmedi; tüm gün etkinliği olarak yazıldı.",
};

export const calendarFeedEn: typeof calendarFeedTr = {
  subscribe: "Subscribe to Calendar",
  copy: "Copy Address",
  copied: "Copied",
  macroHint:
    "Releases arrive in Google or Apple Calendar on their own, and a changed time updates there too. In Google Calendar, copy the address and paste it under \"From URL\".",
  macroHintFiltered:
    "Only \"{impact}\" importance releases arrive in Google or Apple Calendar on their own, and a changed time updates there too. In Google Calendar, copy the address and paste it under \"From URL\".",
  earningsHint:
    "Earnings dates for the companies you follow arrive in your calendar on their own. The address is built from today's list; subscribe again if your list changes.",
  earningsHintCapped:
    "Earnings dates for the companies you follow arrive in your calendar on their own. One subscription carries up to {max} companies; the address uses the first {max} symbols on your list.",

  macroName: "Açılış Zili · Economic Calendar",
  macroDescription:
    "US macro releases and Fed meetings. Times appear in your calendar app's time zone.",
  earningsName: "Açılış Zili · Earnings Calendar",
  earningsDescription:
    "Upcoming earnings dates for the companies you chose. The provider publishes no release time, so earnings are all-day events; the window is in the title.",

  earningsSummary: "{symbol} Earnings",
  window: { bmo: "Before the Open", amc: "After the Close", dmh: "During the Session" },
  windowInline: { bmo: "before the open", amc: "after the close", dmh: "during the session" },
  earningsBody: "{company} reports quarterly results on {date}.",
  earningsWindowKnown: "No exact time is published; the release is expected {window}.",
  earningsWindowUnknown: "No release time is published.",
  earningsDateNote:
    "The date follows the New York calendar; an after-the-close release can land past midnight in Türkiye.",
  economicBody: "Economic data release. Importance: {impact}.",
  economicNoTime: "No time has been announced; written as an all-day event.",
};
