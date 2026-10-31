/**
 * `macroVisual` ad alanı — makro ve piyasa görselleri (25 Ekim görsel turu):
 * getiri eğrisi minyatürü (/makro kapağı ve ana sayfanın tahvil kartı),
 * enflasyonda Fed hedef çizgisi, /makro kapağının dört ölçüsü, sektör ısı
 * matrisi. Ayrı dosyada: birleştirmede iki büyük sözlükte çakışma alanı
 * küçük kalsın (stock-entry.ts ile aynı gerekçe). Mantık
 * `lib/macro-visual.ts`te.
 */

export const macroVisualTr = {
  /* ---- Getiri eğrisi ---- */
  legendNow: "Son · {date}",
  legendGhost: "Bir Ay Önce · {date}",
  shapeNormal: "Normal Eğri",
  shapeFlat: "Düz Eğri",
  shapeInverted: "Ters Eğri",
  /** Biçim künyesi: neye göre söylendiği. */
  shapeNote: "Eğrinin biçimi 10 yıllık ile 2 yıllık farkından okunur; {threshold} puanın altı düz, sıfırın altı ters sayılır.",
  /** Ekran okuyucu: minyatürün tamamı. */
  chartLabel: "Getiri eğrisi, {date}: {values}",
  chartLabelGhost: "Bir ay önce, {date}: {values}",
  /** Nokta okuması (hover ve klavye odağı). */
  pointGhost: "Bir Ay Önce {value}",
  pointChange: "{delta} Puan",
  /* ---- Enflasyon hedefi ---- */
  target: "Fed Hedefi {value}",
  aboveTarget: "Hedefin {gap} Puan Üstünde",
  belowTarget: "Hedefin {gap} Puan Altında",
  atTarget: "Hedefte",
  targetNote:
    "Kesikli çizgi Fed'in %2 uzun dönem enflasyon hedefi. Hedef PCE fiyat endeksi için tanımlı; TÜFE ve çekirdek ölçüler karşılaştırma için aynı çizgiyle çiziliyor.",
  /* ---- Aylık değişim çubukları ---- */
  barsNote: "Her çubuk bir ayın değişimi; sıfırın üstü artış, altı düşüş.",
  /** Ana sayfa makro özetinin kıvılcımları. */
  sparkNote: "Çizgiler son {n} aylık gözlemi gösterir.",
  sparkTitle: "{title}, son {n} ay",
  /* ---- /makro kapağının dört ölçüsü (31 Ekim; önce tek cümleydi) ---- */
  gaugesTitle: "Bir Bakışta",
  gaugeInflation: "Enflasyon (TÜFE)",
  gaugeUnemployment: "İşsizlik Oranı",
  gaugeCurve: "Getiri Eğrisi",
  gaugeSahm: "Sahm Kuralı",
  /** Ölçeğin üstündeki işaretler. */
  gaugeTarget: "Hedef {value}",
  gaugeThreshold: "Eşik {value}",
  gaugePrev: "Önceki {value}",
  gaugeRange: "Son 12 Ay",
  gaugeShort: "3 Ay",
  gaugeLong: "10 Yıl",
  /** Ölçünün altındaki cümle: her sayı veriden. */
  gaugeInflationAbove: "Fed'in %2 hedefinin {gap} puan üstünde.",
  gaugeInflationBelow: "Fed'in %2 hedefinin {gap} puan altında.",
  gaugeInflationAt: "Fed'in %2 hedefinde.",
  gaugeUnemploymentUp: "Bir ayda {delta} puan arttı.",
  gaugeUnemploymentDown: "Bir ayda {delta} puan azaldı.",
  gaugeUnemploymentFlat: "Bir önceki aya göre değişmedi.",
  gaugeCurveNormal: "10 yıllık faiz 3 aylıktan {spread} puan yüksek; eğri normal.",
  gaugeCurveFlat: "10 yıllık faiz 3 aylıktan yalnız {spread} puan yüksek; eğri düz.",
  gaugeCurveInverted: "10 yıllık faiz 3 aylıktan {spread} puan düşük; eğri ters.",
  gaugeSahmBelow: "{threshold} eşiğinin altında; kural tetiklenmedi.",
  gaugeSahmAbove: "{threshold} eşiğini aştı; kural tetiklendi.",
  /* ---- Sektör ısı matrisi ---- */
  sectorLead:
    "Son bir ayda öne çıkan {best} {bestValue}, en çok geride kalan {worst} {worstValue}; {total} sektörün {up} tanesi artıda.",
  heatNote:
    "Hücrenin rengi yönü, koyuluğu büyüklüğü söyler. Her dönem kendi ölçeğinde: tam ton, lejantta o dönem için yazılan hareket ve üstü.",
  /** Lejantın altındaki yazılı ölçek: "Tam Ton 1G ±%3 · 1A ±%20". */
  heatScale: "Tam Ton",
  heatLegendDown: "Düşüş",
  heatLegendUp: "Yükseliş",
  /* ---- FOMC takvim şeridinin anahtarı ---- */
  fomcToday: "Bugün",
  fomcWeekend: "Hafta Sonu",
  fomcMeeting: "Karar Günü",
};

export const macroVisualEn: typeof macroVisualTr = {
  legendNow: "Latest · {date}",
  legendGhost: "A Month Ago · {date}",
  shapeNormal: "Normal Curve",
  shapeFlat: "Flat Curve",
  shapeInverted: "Inverted Curve",
  shapeNote: "The curve's shape is read from the 10-year minus 2-year spread; below {threshold} points counts as flat, below zero as inverted.",
  chartLabel: "Yield curve, {date}: {values}",
  chartLabelGhost: "A month ago, {date}: {values}",
  pointGhost: "A Month Ago {value}",
  pointChange: "{delta} Points",
  target: "Fed Target {value}",
  aboveTarget: "{gap} Points Above Target",
  belowTarget: "{gap} Points Below Target",
  atTarget: "At Target",
  targetNote:
    "The dashed line is the Fed's 2% longer-run inflation goal. The goal is defined for the PCE price index; CPI and the core measures are drawn against the same line for comparison.",
  barsNote: "Each bar is one month's change; above zero is a rise, below is a fall.",
  sparkNote: "Lines show the last {n} monthly readings.",
  sparkTitle: "{title}, last {n} months",
  gaugesTitle: "At a Glance",
  gaugeInflation: "Inflation (CPI)",
  gaugeUnemployment: "Unemployment Rate",
  gaugeCurve: "Yield Curve",
  gaugeSahm: "Sahm Rule",
  gaugeTarget: "Target {value}",
  gaugeThreshold: "Threshold {value}",
  gaugePrev: "Previous {value}",
  gaugeRange: "Last 12 Months",
  gaugeShort: "3M",
  gaugeLong: "10Y",
  gaugeInflationAbove: "{gap} points above the Fed's 2% target.",
  gaugeInflationBelow: "{gap} points below the Fed's 2% target.",
  gaugeInflationAt: "At the Fed's 2% target.",
  gaugeUnemploymentUp: "Up {delta} points in a month.",
  gaugeUnemploymentDown: "Down {delta} points in a month.",
  gaugeUnemploymentFlat: "Unchanged from the previous month.",
  gaugeCurveNormal: "The 10-year yield is {spread} points above the 3-month; the curve is normal.",
  gaugeCurveFlat: "The 10-year yield is only {spread} points above the 3-month; the curve is flat.",
  gaugeCurveInverted: "The 10-year yield is {spread} points below the 3-month; the curve is inverted.",
  gaugeSahmBelow: "Below the {threshold} threshold; the rule has not triggered.",
  gaugeSahmAbove: "Above the {threshold} threshold; the rule has triggered.",
  sectorLead:
    "Over the past month {best} led at {bestValue} and {worst} lagged most at {worstValue}; {up} of {total} sectors are up.",
  heatNote:
    "A cell's color gives the direction and its depth the size. Each period has its own scale: full depth is the move written for that period in the legend, or more.",
  heatScale: "Full Depth",
  heatLegendDown: "Fall",
  heatLegendUp: "Rise",
  fomcToday: "Today",
  fomcWeekend: "Weekend",
  fomcMeeting: "Decision Day",
};
