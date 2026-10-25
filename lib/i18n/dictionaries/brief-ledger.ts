/**
 * `briefLedger` ad alanı — bültenin Kayıt Defteri bandı (25 Ekim görsel
 * zirve turu). Sözlüğün parçası (tr.ts / en.ts bunu `briefLedger`
 * anahtarına koyuyor), ayrı dosyada: paralel geliştirilen paketler sözlüğün
 * ortasına anahtar serpiştirmesin.
 *
 * Cümle şablonları `lib/brief-ledger.ts` → `ledgerStoryText`; şablonların
 * doldurulması testli (tests/brief-ledger.test.ts).
 */

export const briefLedgerTr = {
  dailyTitle: "Günün Kayıt Defteri",
  weeklyTitle: "Haftanın Kayıt Defteri",
  /* Bandın künyesi: hangi seansın kapanışı. Bülten sabah yazılıyor ve bir
     ÖNCEKİ seansı anlatıyor; bant onu adıyla söylüyor. "Asıl Seans" (25
     Ekim son düzeltme): metindeki ve üst şeritteki yüzde akşam seansı
     dahil son işlemden gelebiliyor (QQQ bantta −%0,01, şeritte +%0,06);
     künye bandın sayısının hangi kapanış olduğunu söylüyor. */
  sessionLine: "{date}, Asıl Seans Kapanışı",
  weekLine: "{start}–{end}, Asıl Seans Kapanışları",
  /* Metindeki geçişin ayrıntısında, yüzdenin hemen yanında. */
  sessionShort: "{date} Seans Kapanışı",
  weekShort: "{start}–{end} Seans Kapanışları",
  /* Telefonda katlanan ayrıntı (ölçüler, hisseler, künye). */
  foldBoth: "Ölçüleri ve Hisseleri Göster",
  foldMetrics: "Ölçüleri Göster",
  foldStocks: "Hisseleri Göster",
  foldLess: "Daha Az Göster",
  indicesLabel: "Endeksler, Kapanıştan Kapanışa",
  /* Endeks kartının ölçek künyesi (kompakt bant, 25 Ekim): eksen satırının
     yerine etiketin sağında. {value} "%1,2" biçiminde. */
  scale: "Ölçek ±{value}",
  metricsLabel: "Öne Çıkan Ölçüler",
  stocksLabel: "Bültende Geçen Hisseler",
  heroCaption: "S&P 500, Günlük Değişim",
  heroCaptionWeekly: "S&P 500, Haftalık Değişim",
  weekTotal: "Hafta",
  holiday: "Tatil",
  /* Kısa gün adları — haftalık şeridin sütun başları. */
  weekdays: ["Pzt", "Sal", "Çar", "Per", "Cum"],
  metrics: {
    us10y: "10 Yıllık Faiz",
    vix: "VIX",
    usdtry: "Dolar/TL",
  },
  /* Ölçünün değişim birimi. */
  bp: "{value} Baz Puan",
  points: "{value} Puan",
  metricDate: "{date}",
  /* Hissenin ekran okuyucu adı: "AT&T, T, −%7,79". */
  stockAria: "{name}, {symbol}, {value}",
  dayAria: "{day}: {value}",
  holidayAria: "{day}: Tatil, seans yok",
  /* Bölüm dizini (yalnız iki ve daha çok ara başlıklı sayıda). */
  tocLabel: "Bu Sayıda",
  /* Künyenin tek satırı; yöntemin tamamı `dataNote`ta, katlı ayrıntıda. */
  dataNoteShort: "Kapanıştan kapanışa: Alpaca SIP, U.S. Treasury, Cboe ve TCMB. O seansa ait olmayan ölçü gösterilmez.",
  dataNoteMore: "Kaynak ve Yöntem",
  dataNote:
    "Endeks ve hisse yüzdeleri kapanıştan kapanışa, günlük işlem barlarından (Alpaca SIP); Günün Posteri ile aynı hesap. 10 yıllık faiz U.S. Treasury, VIX Cboe, dolar/TL TCMB bülteni. Verisi o seansa ait olmayan ölçü gösterilmez. Bülten metnindeki yüzde yazıldığı anın kotasyonundan gelebilir (akşam seansı dahil); bant asıl seansın kapanışını gösterir.",
  /* Veriden kurulan tek cümle — şablonlar. {list} birden çok adı taşır. */
  story: {
    allUp: "Dört endeks de yükseldi; en güçlü hareket {name}, {pct}.",
    allDown: "Dört endeks de geriledi; en sert düşüş {name}, {pct}.",
    someUp: "{list} yükseldi.",
    someDown: "{list} geriledi.",
    flat: "{list} yatay kaldı.",
    split: "Endeksler ayrıştı: {up} yükseldi, {down} geriledi.",
    splitFlat: "Endeksler ayrıştı: {up} yükseldi, {down} geriledi, {flat} yatay kaldı.",
    upFlat: "{up} yükseldi, {flat} yatay kaldı.",
    downFlat: "{down} geriledi, {flat} yatay kaldı.",
    weekUp: "{name} haftayı {pct} yükselişle kapattı; {sessions} seansın {upDays} tanesi artıda, en sert gün {day} ({dayPct}).",
    weekDown: "{name} haftayı {pct} düşüşle kapattı; {sessions} seansın {upDays} tanesi artıda, en sert gün {day} ({dayPct}).",
    weekFlat: "{name} haftayı yatay kapattı; {sessions} seansın {upDays} tanesi artıda, en sert gün {day} ({dayPct}).",
  },
  /* Gün adlarının cümle içindeki hâli. */
  weekdaysLong: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"],
};

export const briefLedgerEn: typeof briefLedgerTr = {
  dailyTitle: "The Day's Ledger",
  weeklyTitle: "The Week's Ledger",
  sessionLine: "{date}, Regular-Session Close",
  weekLine: "{start}–{end}, Regular-Session Closes",
  sessionShort: "{date} Regular Close",
  weekShort: "{start}–{end} Regular Closes",
  foldBoth: "Show Measures and Stocks",
  foldMetrics: "Show Measures",
  foldStocks: "Show Stocks",
  foldLess: "Show Less",
  indicesLabel: "Indices, Close to Close",
  scale: "Scale ±{value}",
  metricsLabel: "Key Measures",
  stocksLabel: "Stocks in This Brief",
  heroCaption: "S&P 500, Daily Change",
  heroCaptionWeekly: "S&P 500, Weekly Change",
  weekTotal: "Week",
  holiday: "Holiday",
  weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  metrics: {
    us10y: "10-Year Yield",
    vix: "VIX",
    usdtry: "USD/TRY",
  },
  bp: "{value} Bp",
  points: "{value} Pts",
  metricDate: "{date}",
  stockAria: "{name}, {symbol}, {value}",
  dayAria: "{day}: {value}",
  holidayAria: "{day}: holiday, no session",
  tocLabel: "In This Issue",
  dataNoteShort: "Close to close: Alpaca SIP, U.S. Treasury, Cboe and the CBRT. A measure not from that session is not shown.",
  dataNoteMore: "Sources and Method",
  dataNote:
    "Index and stock percentages are close to close, from daily trade bars (Alpaca SIP), the same calculation as the Day's Poster. 10-year yield from the U.S. Treasury, VIX from Cboe, USD/TRY from the CBRT bulletin. A measure whose data is not from that session is not shown. A percentage in the brief text may come from the quote at the time of writing (including after-hours); the ledger shows the regular-session close.",
  story: {
    allUp: "All four indices rose; the strongest move was {name}, {pct}.",
    allDown: "All four indices fell; the sharpest drop was {name}, {pct}.",
    someUp: "{list} rose.",
    someDown: "{list} fell.",
    flat: "{list} ended flat.",
    split: "Indices split: {up} rose, {down} fell.",
    splitFlat: "Indices split: {up} rose, {down} fell, {flat} ended flat.",
    upFlat: "{up} rose, {flat} ended flat.",
    downFlat: "{down} fell, {flat} ended flat.",
    weekUp: "{name} ended the week up {pct}; {upDays} of {sessions} sessions closed higher, the sharpest day was {day} ({dayPct}).",
    weekDown: "{name} ended the week down {pct}; {upDays} of {sessions} sessions closed higher, the sharpest day was {day} ({dayPct}).",
    weekFlat: "{name} ended the week flat; {upDays} of {sessions} sessions closed higher, the sharpest day was {day} ({dayPct}).",
  },
  weekdaysLong: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
};
