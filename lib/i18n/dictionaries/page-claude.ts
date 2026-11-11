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
};

export const stockWeekEn: typeof stockWeekTr = {
  points: "Drivers ({n})",
  dataOnly: "The Claude note isn't available right now; the figures above come from the closes of the last five completed sessions.",
};

export type WatchlistTodayLabels = typeof watchlistTodayTr;
