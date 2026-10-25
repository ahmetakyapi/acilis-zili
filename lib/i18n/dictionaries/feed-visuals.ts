/**
 * `feedVisuals` ad alanı — akış ve liste ekranlarının görsel turu (25 Ekim):
 * Haberler'in tepe cümlesi, konuşulan şirketler şeridi ve saat başlıkları;
 * Analizlerim'in görüş dağılımı ve "Rapordan Bugüne" kovaları; Topluluk
 * sembol rozetleri; Bildirimler gün grupları (Yenilikler'in metni kendi
 * `changelog` ad alanında). Ayrı
 * dosyada: birleştirmede iki büyük sözlükte çakışma alanı küçük kalsın
 * (personal-visuals.ts ile aynı gerekçe). Hesaplar lib/feed-visuals.ts.
 *
 * Başlıklar Title Case; cümleler, künyeler ve ekran okuyucu metinleri
 * cümle düzeninde. Sayıya ek getiren kalıp yok.
 */

export const feedVisualsTr = {
  news: {
    /** Tepe cümlesi: "{lead} {most}" — lib/feed-visuals.ts → pulseSentence. */
    lead: "Akış, son {span} içinde yayımlanan {n} haberi kapsıyor.",
    leadOne: "Akışta son {span} içinde yayımlanan 1 haber var.",
    hours: "{n} saat",
    hourOne: "1 saat",
    days: "{n} gün",
    most: "En çok {list} konuşuluyor.",
    and: "ve",
    stripTitle: "En Çok Konuşulan Şirketler",
    stripHint: "Kaç haberde geçtiği ve son seanstaki değişimi; dokununca yalnız o şirketin haberleri kalır. Seansa ait işlem yoksa yüzde basılmaz.",
    storyCount: "{n} Haber",
    storyCountOne: "1 Haber",
    /** Şerit kartının ekran okuyucu metni. */
    companyAria: "{symbol}: {n} haberde geçiyor, haberlerini süz",
    today: "Bugün",
    yesterday: "Dün",
    timelineLabel: "Saat saat haber akışı",
  },
  analyses: {
    mixTitle: "Görüş Dağılımı",
    mixHint: "Raporların görüşü, adet ve pay olarak.",
    sinceTitle: "Rapordan Bugüne Getiri",
    sinceHint: "Her sütun o getiri aralığına düşen rapor sayısı; sıfırın solu düşüş, sağı yükseliş.",
    sentence: "{n} raporun {up} tanesinde hisse rapordan bu yana yükseldi, {down} tanesinde düştü; ortanca getiri {median}.",
    sentenceNoLive: "{n} rapor, {stocks} hisse. Rapordan bugüne getiri için güncel fiyat şu an alınamadı.",
    binAria: "{range}: {n} rapor",
    binBelow: "{to} altı",
    binAbove: "{from} üstü",
    binBetween: "{from} ile {to} arası",
    mapAria: "{symbol} fiyat haritası: son 3 ayın kapanışları, senaryo tetikleri ve rapor fiyatı",
    mapLegend: "Çizgi 3 ay · kesik çizgi tetik",
  },
  community: {
    symbolsLabel: "Yazıda geçen hisseler",
  },
  inbox: {
    today: "Bugün",
    yesterday: "Dün",
    summary: "{n} bildirim; {unread} tanesi okunmamış.",
    summaryRead: "{n} bildirim, hepsi okunmuş.",
    kindsLabel: "Türlere göre bildirimler",
  },
};

export const feedVisualsEn: typeof feedVisualsTr = {
  news: {
    lead: "The feed covers {n} stories published over the last {span}.",
    leadOne: "The feed holds 1 story published over the last {span}.",
    hours: "{n} hours",
    hourOne: "hour",
    days: "{n} days",
    most: "Most talked about: {list}.",
    and: "and",
    stripTitle: "Most Talked-About Companies",
    stripHint: "How many stories mention each company and its last-session change; tap to keep only that company's stories. No percentage is shown without a trade from the session.",
    storyCount: "{n} Stories",
    storyCountOne: "1 Story",
    companyAria: "{symbol}: mentioned in {n} stories, filter its news",
    today: "Today",
    yesterday: "Yesterday",
    timelineLabel: "News feed by hour",
  },
  analyses: {
    mixTitle: "View Mix",
    mixHint: "The view of each report, as count and share.",
    sinceTitle: "Return Since Report",
    sinceHint: "Each column counts the reports in that return range; left of zero fell, right of zero rose.",
    sentence: "Since publication the stock rose after {up} of {n} reports and fell after {down}; median return {median}.",
    sentenceNoLive: "{n} reports on {stocks} stocks. A current price for the return since each report isn't available right now.",
    binAria: "{range}: {n} reports",
    binBelow: "below {to}",
    binAbove: "above {from}",
    binBetween: "{from} to {to}",
    mapAria: "{symbol} price map: last 3 months of closes, scenario triggers and the report price",
    mapLegend: "Line 3 months · dashed trigger",
  },
  community: {
    symbolsLabel: "Stocks mentioned in the post",
  },
  inbox: {
    today: "Today",
    yesterday: "Yesterday",
    summary: "{n} notifications, {unread} unread.",
    summaryRead: "{n} notifications, all read.",
    kindsLabel: "Notifications by type",
  },
};
