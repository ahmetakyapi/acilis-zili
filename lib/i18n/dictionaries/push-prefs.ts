/**
 * `pushPrefs` ad alanı — Ayarlar → Bildirimler'deki tür anahtarları ve cuma
 * portföy özeti push'unun metni (11 Kasım). Gerekçe lib/push-prefs-model.ts
 * ve lib/portfolio-week-push.ts. Sözlüğün parçası (tr.ts / en.ts bunu
 * `pushPrefs` anahtarına koyuyor), ayrı dosyada: paralel geliştirilen
 * paketler sözlüğün ortasına anahtar serpiştirmesin.
 */

export const pushPrefsTr = {
  title: "Ne İçin Bildirim Gelsin",
  price: "Fiyat Alarmları",
  priceHint: "Fiyat ya da yüzde alarmın tetiklenince anında bildirim gelir.",
  weekly: "Haftalık Portföy Özeti",
  weeklyHint: "Haftanın son kapanışından sonra portföyünün haftalık yüzdesi ve en çok etkileyen pozisyon; tutar yazılmaz. Gece gelmez, sabah 08:00'de gelir.",
  /* Hesapta hiç cihaz açılmamışken anahtarlar basılı ama kilitli. */
  needsDevice: "Bu tercihler bildirimleri açtığın cihazlara uygulanır; önce yukarıdan bildirimleri aç.",
  failed: "Tercih şu an kaydedilemedi; biraz sonra tekrar dene.",
  /* Push metni — kilit ekranında görünür: tutar yok, yalnız oran. */
  weeklyTitle: "Haftalık Portföy Özeti",
  weeklyBodyLifted: "Portföyün bu hafta {change}; en çok {symbol} taşıdı.",
  weeklyBodyDragged: "Portföyün bu hafta {change}; en çok {symbol} geriletti.",
  weeklyBodyPlain: "Portföyün bu hafta {change}.",
};

export const pushPrefsEn: typeof pushPrefsTr = {
  title: "What to Notify Me About",
  price: "Price Alerts",
  priceHint: "Get notified the moment a price or percent alert fires.",
  weekly: "Weekly Portfolio Summary",
  weeklyHint: "After the week's final close: your portfolio's weekly percent change and the position that moved it most; no amounts. Never at night in Türkiye; it waits until 08:00.",
  needsDevice: "These apply to the devices you turn notifications on for; turn notifications on above first.",
  failed: "Couldn't save that right now; please try again shortly.",
  weeklyTitle: "Weekly Portfolio Summary",
  weeklyBodyLifted: "Your portfolio this week: {change}. {symbol} did the most lifting.",
  weeklyBodyDragged: "Your portfolio this week: {change}. {symbol} weighed on it most.",
  weeklyBodyPlain: "Your portfolio this week: {change}.",
};
