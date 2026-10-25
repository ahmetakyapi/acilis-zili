/**
 * `calendarVisuals` ad alanı — takvim ekranlarının görsel turu (25 Ekim):
 * "Son Açıklanan Veriler"in sapma çizgisi, Bilançolar'ın "Haftanın Bilanço
 * Ufku" ve temettü takviminin öne çıkanları ile katlanır günleri. Ayrı
 * dosyada: birleştirmede iki büyük sözlükte çakışma alanı küçük kalsın
 * (stock-entry.ts ile aynı gerekçe).
 *
 * Şablonlarda `{n}`, `{diff}` gibi yer tutucular sayfa tarafında doldurulur;
 * sayı biçimi ve birim `lib/release-deviation.ts`te.
 */

export const calendarVisualsTr = {
  released: {
    /* Künye Title Case (CLAUDE.md "0,05 Puan" örneği): birim de büyük. */
    aboveForecast: "Beklentinin {diff} Üstünde",
    belowForecast: "Beklentinin {diff} Altında",
    inlineForecast: "Beklentiyle Aynı",
    abovePrevious: "Öncekinin {diff} Üstünde",
    belowPrevious: "Öncekinin {diff} Altında",
    inlinePrevious: "Öncekiyle Aynı",
    /** Çizginin uç künyeleri: yön sözle de yazılı, renk tek taşıyıcı değil. */
    sideBelow: "Altında",
    sideAbove: "Üstünde",
    /** Çizginin ne anlattığı — paneldeki tek açıklama satırı. */
    legend:
      "Çizginin ortası beklenti; nokta gerçekleşen, gri çentik önceki değer. Renk yalnız yönü söyler: yüksek çıkmanın iyi mi kötü mü olduğu veriye göre değişir.",
    /** Birimlerin künyedeki yazımı (Title Case). */
    unitPoint: "Puan",
    unitThousand: "Bin",
  },
  horizon: {
    title: "Haftanın Bilanço Ufku",
    /** Başlığın sağındaki künye: "26–30 Ekim". */
    leadThis: "Bu hafta {count} bilanço var",
    leadNext: "Gelecek hafta {count} bilanço var",
    peakMany: "; en büyükleri {day} {window}: {symbols}.",
    peakOne: "; en büyüğü {day} {window}: {symbols}.",
    /** Cümle içindeki pencere adları (cümle düzeni). */
    windowBmo: "açılış öncesi",
    windowAmc: "kapanış sonrası",
    windowOther: "(saati belirsiz)",
    /** Katlı "Nasıl Okunur" ayrıntısı (kart turu, 25 Ekim). */
    caption:
      "Her hücre o gün o pencerede açıklayan kayda değer şirketler, piyasa değeri büyükten küçüğe. Çerçeveli karo, değeri haftanın en büyüğünün dörtte birini geçen şirket. Karonun altındaki dört kare son dört çeyrek, eskiden yeniye: dolu kare EPS beklentisinin aşıldığı, boş kare aşılmadığı, soluk kare bilinmeyen çeyrek. Hücreye sığmayanlar +N ile o günün listesinde.",
    howTitle: "Nasıl Okunur",
    /** Tek satırlık künye: kare lejantı. */
    legendBeat: "Aşıldı",
    legendMiss: "Aşılmadı",
    legendNone: "Veri Yok",
    legendNote: "Son dört çeyrek, eskiden yeniye",
    /** En kalabalık günün rozeti ve ekran okuyucu açıklaması. */
    peak: "Zirve",
    peakLabel: "Haftanın zirvesi: en çok bilançonun açıklandığı gün",
    countCompanies: "{count} Şirket",
    marketClosed: "Piyasa Kapalı",
    emptyLane: "Yok",
    marketCap: "Piyasa Değeri",
    companyPage: "Bilanço Sayfası",
    analysis: "Analizi Oku",
    /** Seçili karonun ekran okuyucu etiketi. */
    tileLabel: "{symbol}, {name}, {day} {window}",
    pickDay: "Gün seçimi",
    readoutHint: "Bir karonun üstüne gel ya da dokun; gelir ve EPS beklentisi burada.",
    karneLoading: "Karne yükleniyor",
    noKarne: "Karne için yeterli çeyrek yok",
    /** Hücreye sığmayanların çipi ve ekran okuyucu etiketi. */
    more: "+{count}",
    moreLabel: "{day} listesinde {count} şirket daha",
  },
  dividends: {
    highlights: "Öne Çıkanlar",
    watchlist: "Takip Listendekiler",
    topYield: "En Yüksek Getiri",
    topYieldHint: "Pencerede yıllık getiri tahmini en yüksek ödemeler; tahmin son ödemeden ve bugünkü fiyattan.",
    lastBuyShort: "Son Alım {date}",
    /* Son alım günü geçmiş hak kesim (rozet ve öne çıkanlar satırı). */
    missed: "Kaçtı",
    lastBuyMissed: "Son Alım Kaçtı",
    payments: "{n} Ödeme",
    maxYield: "En Yüksek ~{value}",
    watchedTag: "Takipte",
  },
};

export const calendarVisualsEn: typeof calendarVisualsTr = {
  released: {
    aboveForecast: "{diff} Above Forecast",
    belowForecast: "{diff} Below Forecast",
    inlineForecast: "In Line With Forecast",
    abovePrevious: "{diff} Above Previous",
    belowPrevious: "{diff} Below Previous",
    inlinePrevious: "Same as Previous",
    sideBelow: "Below",
    sideAbove: "Above",
    legend:
      "The middle of the line is the forecast; the dot is the actual, the gray notch the previous reading. Color shows direction only: whether a higher number is good or bad depends on the release.",
    unitPoint: "pp",
    unitThousand: "K",
  },
  horizon: {
    title: "The Week's Earnings Horizon",
    leadThis: "{count} reports this week",
    leadNext: "{count} reports next week",
    peakMany: "; the largest come {day} {window}: {symbols}.",
    peakOne: "; the largest comes {day} {window}: {symbols}.",
    windowBmo: "before the open",
    windowAmc: "after the close",
    windowOther: "(time not set)",
    caption:
      "Each cell lists the notable companies reporting in that window that day, largest market cap first. A framed tile is a company worth more than a quarter of the week's largest. The four squares under a tile are the last four quarters, oldest first: a filled square means EPS beat the estimate, an empty one that it did not, a faded one that the quarter is unknown. Companies that don't fit are under +N in that day's list.",
    howTitle: "How to Read",
    legendBeat: "Beat",
    legendMiss: "Missed",
    legendNone: "No Data",
    legendNote: "Last four quarters, oldest first",
    peak: "Peak",
    peakLabel: "The week's peak: the day with the most reports",
    countCompanies: "{count} Companies",
    marketClosed: "Market Closed",
    emptyLane: "None",
    marketCap: "Market Cap",
    companyPage: "Earnings Page",
    analysis: "Read the Analysis",
    tileLabel: "{symbol}, {name}, {day} {window}",
    pickDay: "Choose a day",
    readoutHint: "Hover or tap a tile to see its revenue and EPS estimates here.",
    karneLoading: "Loading track record",
    noKarne: "Not enough quarters for a track record",
    more: "+{count}",
    moreLabel: "{count} more companies in the {day} list",
  },
  dividends: {
    highlights: "Highlights",
    watchlist: "On Your Watchlist",
    topYield: "Highest Yield",
    topYieldHint: "Payments in the window with the highest estimated annual yield; the estimate uses the latest payment and today's price.",
    lastBuyShort: "Buy By {date}",
    missed: "Missed",
    lastBuyMissed: "Buy-By Passed",
    payments: "{n} Payments",
    maxYield: "Top ~{value}",
    watchedTag: "Watching",
  },
};
