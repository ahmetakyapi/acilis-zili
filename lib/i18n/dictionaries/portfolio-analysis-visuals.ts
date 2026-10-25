/**
 * `portfolioAnalysisVisuals` ad alanı — Portföy analizinin görsel katmanı (25 Ekim, öğrenme ve hesap
 * araçlarının görsel turu). Sözlüğün parçası (tr.ts / en.ts bunu `portfolioAnalysisVisuals`
 * anahtarına koyuyor), ayrı dosyada: paralel geliştirilen paketler sözlüğün
 * ortasına anahtar serpiştirmesin.
 *
 * KURAL: öneri kipi yok (SPK çizgisi, components/portfolio/analysis/
 * AnalysisScreen.tsx başındaki not). Tepedeki cümle yalnız ölçüyü söyler;
 * `tests/analysis-visuals.test.ts` cümleyi lib/advice-guard.ts'ten geçirir.
 */

export const portfolioAnalysisVisualsTr = {
  /* Tepedeki tek cümle — şablon + veri (analysis-visuals.ts → composeAnalysisLead). */
  lead: {
    sector: "En ağır sektör {sector}: portföyde {share}, S&P 500'de {bench}",
    spread: "{count} pozisyon eşit ağırlıklı {effective} pozisyon kadar dağınık",
    single: "portföy tek pozisyondan oluşuyor ({symbol})",
    volatility: "geçen yılki oynaklık S&P 500'ün {ratio} katı",
    join: "; ",
    joinRisk: ", ",
    note: "Cümle aşağıdaki ölçülerden kurulur; yorum değil, ölçü.",
  },
  strip: {
    title: "Pozisyonların Ağırlığı",
    rest: "Diğer",
    restCount: "{n} Pozisyon",
    aria: "Pozisyonların portföydeki ağırlığı: {list}",
  },
  ring: {
    aria: "{count} pozisyon, eşit ağırlıklı {effective} pozisyon kadar dağınık",
  },
  compare: {
    portfolio: "Portföy",
    benchmark: "S&P 500",
  },
  matrix: {
    title: "En Büyük {n} Pozisyonun Isı Haritası",
    hint: "Hücre koyulaştıkça iki pozisyon çoğu gün aynı yöne gidiyor; kesikli kenarlı hücre ters yönü (eksi korelasyon) gösterir.",
    idle: "Bir hücrenin üstüne gel ya da sekmeyle odaklan; çift ve değeri burada okunur.",
    aria: "{a} ile {b}: korelasyon {value}",
    caption: "Korelasyon ısı haritası",
  },
  scenario: {
    same: "Değişmiyor",
    aria: "{label}: bugün {before}, fonla {after}",
  },
  /* Kart panosu (25 Ekim, sahibinin isteği: "yan yana kartlar, kaydırmadan
     görülsün"). Kompakt bandın tek satırlık açıklaması ve kartların adları. */
  board: {
    description: "Sektör, yoğunlaşma ve risk; S&P 500 ile yan yana ölçülür ve karşılaştırılır.",
    keysTitle: "Temel Ölçüler",
    heaviest: "En Ağır Sektör",
    ratio: "{ratio} Kat",
    effectiveSub: "{count} pozisyonun eşit ağırlıklı karşılığı",
    notesMore: "Hesap Notunu Göster",
    notesLess: "Hesap Notunu Gizle",
    concentrationTitle: "Yoğunlaşma",
    absent: "Portföyde Olmayan Sektörler",
    absentAria: "{sector}: portföyde yok, S&P 500'de {bench}",
  },
};

export const portfolioAnalysisVisualsEn: typeof portfolioAnalysisVisualsTr = {
  lead: {
    sector: "The heaviest sector is {sector}: {share} of the portfolio against {bench} of the S&P 500",
    spread: "{count} positions spread like {effective} equal-weight positions",
    single: "the portfolio is a single position ({symbol})",
    volatility: "last year's volatility was {ratio} times the S&P 500's",
    join: "; ",
    joinRisk: ", and ",
    note: "The sentence is built from the measures below; a measurement, not an opinion.",
  },
  strip: {
    title: "Position Weights",
    rest: "Other",
    restCount: "{n} Positions",
    aria: "Weight of each position in the portfolio: {list}",
  },
  ring: {
    aria: "{count} positions, spread like {effective} equal-weight positions",
  },
  compare: {
    portfolio: "Portfolio",
    benchmark: "S&P 500",
  },
  matrix: {
    title: "Heat Map of the {n} Largest Positions",
    hint: "The darker a cell, the more often the two positions move the same way; a dashed cell marks opposite moves (negative correlation).",
    idle: "Hover over a cell or tab to it; the pair and its value appear here.",
    aria: "{a} and {b}: correlation {value}",
    caption: "Correlation heat map",
  },
  scenario: {
    same: "Unchanged",
    aria: "{label}: today {before}, with the fund {after}",
  },
  board: {
    description: "Sector mix, concentration and risk, measured side by side with the S&P 500.",
    keysTitle: "Key Measures",
    heaviest: "Heaviest Sector",
    ratio: "{ratio}×",
    effectiveSub: "Equal-weight equivalent of {count} positions",
    notesMore: "Show the Method Note",
    notesLess: "Hide the Method Note",
    concentrationTitle: "Concentration",
    absent: "Sectors Not in the Portfolio",
    absentAria: "{sector}: not in the portfolio, {bench} of the S&P 500",
  },
};
