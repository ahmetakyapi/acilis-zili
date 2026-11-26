/**
 * "Sayfanın İçinde Claude" (24 Ekim) — `watchlistToday` (Takip Listem
 * Bugün) ve `askStock` (Bu Hisseye Sor) ad alanları. Sözlüğün parçası
 * (tr.ts / en.ts sonuna ekliyor) ama AYRI dosyada: iki istemci bileşeni
 * etiketleri prop olarak alıyor ve özellik kendi dosyasında kalınca öteki
 * dallarla birleşmede sözlüğün ortasında çakışma çıkmıyor.
 */

export const watchlistTodayTr = {
  title: "Takip Listem Bugün",
  session: "{date} Kapanışıyla",
  credit: "Claude · {date} Kapanışı",
  loading: "Claude listeni son seansın kapanışıyla okuyor…",
  unavailable: "Bugünün okuması şu an hazırlanamadı; birazdan yeniden dene.",
  noteFailed: "Claude notu bu kez yazılamadı; hareketler son seansın kapanışından.",
  movers: "En Çok Hareket Edenler",
  market: "S&P 500 {pct}",
  versus: "S&P 500'e Göre {gap}",
  pointsUnit: "Puan",
  earnings: "Yakında Bilanço",
  bmo: "Açılış Öncesi",
  amc: "Kapanış Sonrası",
  partial: "{covered} hissenin {total} tanesi okunabildi; kalanın son seans verisi yok.",
  disclosure:
    "Bu okuma, takip listenden ve son tamamlanmış seansın kapanışından Claude ile yazıldı; ekrandaki canlı fiyatlar notta yer almaz. Yatırım tavsiyesi değildir.",
};

export const watchlistTodayEn: typeof watchlistTodayTr = {
  title: "My Watchlist Today",
  session: "As of the {date} Close",
  credit: "Claude · {date} Close",
  loading: "Claude is reading your list at the last session's close…",
  unavailable: "Today's reading couldn't be prepared right now; try again shortly.",
  noteFailed: "Claude's note couldn't be written this time; the moves are from the last session's close.",
  movers: "Biggest Movers",
  market: "S&P 500 {pct}",
  versus: "{gap} vs. S&P 500",
  pointsUnit: "pts",
  earnings: "Earnings Soon",
  bmo: "Before Open",
  amc: "After Close",
  partial: "{covered} of {total} stocks could be read; the rest have no data for the last session.",
  disclosure:
    "This reading was written with Claude from your watchlist and the last completed session's close; live prices on screen are not part of it. Not investment advice.",
};

/* `askStock` 11 Kasım'da kendi dosyasına taşındı (ask-stock.ts); adlar
   buradan yeniden dışa aktarılıyor ki tr.ts / en.ts'teki içe aktarma ve
   anahtar değişmesin. */
export { askStockEn, askStockTr, type AskStockLabels } from "./ask-stock";

/* Bu Hafta Neden Hareket Etti, kompakt kart (25 Ekim) — components/stock/
   WeekMoveCard.tsx. Kartın öteki metinleri `stockInsight`te (eski tam
   genişlik kartla ortak); burada yalnız kompakt karta özgü iki satır. */
export const stockWeekTr = {
  points: "Etkenler ({n})",
  dataOnly: "Claude notu şu an yok; yukarıdaki sayılar son beş tamamlanmış seansın kapanışlarından.",
  /* Haftanın Okuması (26 Kasım 2026): not yokken kartı dolduran
     deterministik özet (lib/week-digest.ts). Künyeler Title Case. */
  digest: {
    title: "Haftanın Okuması",
    loudest: "En Sert Seans",
    loudestMarket: "S&P 500 Aynı Gün {pct}",
    volume: "Yüksek Hacimli Seans",
    volumePeak: "En Yüksek {x}× · {day}",
    volumeHint: "Hacmi 20 seans ortalamasının 1,5 katını aşan seans",
    market: "S&P 500'ün Önünde",
    marketWidest: "En Geniş Fark {pts} Puan · {day}",
    sessions: "{n}/{total} Seans",
    range: "Beş Kapanışın Aralığı",
    low: "Dip",
    high: "Zirve",
    start: "Başlangıç",
    near: { low: "Haftayı Dibine Yakın Kapattı", mid: "Aralığın Ortasında Kapattı", high: "Haftayı Zirvesine Yakın Kapattı" },
  },
};

export const stockWeekEn: typeof stockWeekTr = {
  points: "Drivers ({n})",
  dataOnly: "The Claude note isn't available right now; the figures above come from the closes of the last five completed sessions.",
  digest: {
    title: "Reading the Week",
    loudest: "Sharpest Session",
    loudestMarket: "S&P 500 Same Day {pct}",
    volume: "High-Volume Sessions",
    volumePeak: "Peak {x}× · {day}",
    volumeHint: "Sessions with volume above 1.5 times the 20-session average",
    market: "Ahead of the S&P 500",
    marketWidest: "Widest Gap {pts} Pts · {day}",
    sessions: "{n}/{total} Sessions",
    range: "Five-Close Range",
    low: "Low",
    high: "High",
    start: "Start",
    near: { low: "Closed Near the Week's Low", mid: "Closed Mid-Range", high: "Closed Near the Week's High" },
  },
};

export type WatchlistTodayLabels = typeof watchlistTodayTr;
