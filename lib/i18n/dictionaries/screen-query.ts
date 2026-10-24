/**
 * `screenQuery` ad alanı — /tarama'nın düz cümleyle tarama kutusu ve etkin
 * süzgeç çipleri (24 Ekim). Ayrı dosyada: özellik kendi ad alanında, büyük
 * sözlük dosyalarına tek satır girer. Gerekçe lib/screen-query.ts.
 */

export const screenQueryTr = {
  label: "Taramayı bir cümleyle anlat",
  placeholder: "Ör. borcu az, kârlı yarı iletkenler",
  submit: "Süzgeçlere Çevir",
  examplesLabel: "Örnek Cümleler",
  examples: [
    "Borcu az, kârlı yarı iletkenler",
    "F/K'sı 15'in altında olan finans hisseleri",
    "Geliri %20'den hızlı büyüyen yazılım şirketleri",
    "Net marjı yüksek, 100 milyar dolardan büyük sağlık şirketleri",
    "Temettü veren, borcu az, son çeyrekte geliri büyüyen yarı iletkenler",
  ],
  pending: "Cümle süzgeçlere çevriliyor…",
  translated: "Claude cümleyi aşağıdaki süzgeçlere çevirdi; hangi hissenin geçtiğini tarayıcının kendisi buluyor.",
  unsupported: "Şunu süzemiyorum: {list}.",
  dropped: "Sayısını cümlede bulamadığım için atılan koşul: {list}.",
  nothing: "Bu cümleden bir süzgeç çıkaramadım. Tarayıcının ölçüleriyle dene: F/K, gelir ve kâr büyümesi, net marj, ROE, borç, cari oran, piyasa değeri, sektör.",
  errors: {
    short: "Biraz daha uzun bir cümle yaz.",
    rate: "Çok sık denedin; biraz bekleyip tekrar dene. Süzgeçler elle çalışmaya devam ediyor.",
    unavailable: "Cümle şu an çevrilemedi; süzgeçleri elle kullanabilirsin.",
  },
  activeLabel: "Etkin Süzgeçler",
  clearAll: "Tümünü Temizle",
  remove: "{label} süzgecini kaldır",
  profitable: "Kârlı",
  fields: {
    pe: "F/K",
    revenueGrowth: "Gelir Büyümesi",
    epsGrowth: "Kâr Büyümesi",
    netMargin: "Net Marj",
    roe: "ROE",
    debtToEquity: "Borç/Özkaynak",
    currentRatio: "Cari Oran",
    marketCap: "Piyasa Değeri",
  },
  /* Ölçülerin dönemi — çiplerin altında, cümle düzeninde. */
  periodNote: "Büyüme ve marjlar son 12 ayın ölçüsü; F/K canlı fiyattan. Ölçüsü bilinmeyen şirket süzgeçten geçmiş sayılmaz.",
};

export const screenQueryEn: typeof screenQueryTr = {
  label: "Describe your screen in a sentence",
  placeholder: "E.g. profitable chipmakers with low debt",
  submit: "Turn Into Filters",
  examplesLabel: "Example Sentences",
  examples: [
    "Profitable semiconductor companies with low debt",
    "Financial stocks with a P/E below 15",
    "Software companies growing revenue faster than 20%",
    "Health care companies above $100 billion with high net margins",
    "Dividend-paying chipmakers with low debt and revenue growth last quarter",
  ],
  pending: "Turning your sentence into filters…",
  translated: "Claude turned the sentence into the filters below; the screener itself finds which stocks pass.",
  unsupported: "I can't filter for: {list}.",
  dropped: "Dropped because its number isn't in your sentence: {list}.",
  nothing: "I couldn't get a filter out of that sentence. Try the screener's measures: P/E, revenue and earnings growth, net margin, ROE, debt, current ratio, market cap, sector.",
  errors: {
    short: "Write a slightly longer sentence.",
    rate: "Too many tries; wait a moment and try again. The filters still work by hand.",
    unavailable: "The sentence couldn't be translated right now; you can still use the filters by hand.",
  },
  activeLabel: "Active Filters",
  clearAll: "Clear All",
  remove: "Remove the {label} filter",
  profitable: "Profitable",
  fields: {
    pe: "P/E",
    revenueGrowth: "Revenue Growth",
    epsGrowth: "Earnings Growth",
    netMargin: "Net Margin",
    roe: "ROE",
    debtToEquity: "Debt/Equity",
    currentRatio: "Current Ratio",
    marketCap: "Market Cap",
  },
  periodNote: "Growth and margins are trailing 12 months; P/E uses the live price. A company with an unknown measure doesn't count as passing.",
};

export type ScreenQueryLabels = typeof screenQueryTr;
