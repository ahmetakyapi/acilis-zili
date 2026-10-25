/**
 * `stockVisuals` ad alanı — hisse sayfası ve kural kontrolünün görsel
 * katmanı (25 Ekim, görsel zirve turu): Temel Göstergeler'in sektör
 * kulvarı, analist dağılımının yığılı sütunları, ünlü yatırımcıların
 * portföy payı şeridi ve "Kural Kural" eşik kulvarı. Ayrı dosyada:
 * birleştirmede iki büyük sözlükte çakışma alanı küçük kalsın
 * (stock-entry.ts ile aynı gerekçe).
 */

export const stockVisualsTr = {
  /* ---- Temel Göstergeler: sektör kulvarı ---- */
  /** `{ek}` lib/scorecard.ts → trAblative ("'inden", "'sinden"). */
  peerAbove: "Sektörün %{p}{ek} Yüksek",
  peerBelow: "Sektörün %{p}{ek} Düşük",
  /** Ekran okuyucu: kulvarın tamamı tek cümlede. */
  peerAria: "{metric} {v}; sektör medyanı {m}, {n} şirketle karşılaştırıldı, {pos}.",
  peerNote:
    "Kulvar aynı GICS sektöründeki {n} şirketin %5 ile %95 dilimi arası: çizgi sektör medyanı, nokta şirket. Hisse Skor Kartı'yla aynı kaynak; sektör verisi olmayan ölçüde kulvar yok. Konum not değildir: yüksek ya da düşük olmak tek başına iyi ya da kötü demek değil.",

  /* ---- Analist Görüşleri Nasıl Değişti ---- */
  shiftDown: "Al tarafının payı {m} ayda {d} puan azaldı: %{a}\u00a0→\u00a0%{b}.",
  shiftUp: "Al tarafının payı {m} ayda {d} puan arttı: %{a}\u00a0→\u00a0%{b}.",
  shiftFlat: "Al tarafının payı {m} ayda değişmedi: %{b}.",
  stackLabel: "Aylara Göre Dağılım",
  lineLabel: "Al Tarafı Payı",
  /** Sütunun ekran okuyucu adı ve dokunuşta açılan ayrıntının başlığı. */
  columnAria: "{month}: {n} analist, al tarafı %{share}",
  analysts: "{n} Analist",
  tableShow: "Sayılarla Tablo",

  /* ---- Ünlü Yatırımcılar: portföy payı ---- */
  weightNote:
    "Şerit hissenin yatırımcının portföyündeki payı; ölçek listedeki en büyük pay ({max}). Pay, son 13F bildirimindeki uzun pozisyonların toplam değerine oranla.",

  /** Pozisyonun hisse adedi: "228 Mn Adet". */
  sharesUnit: "{n} Adet",
  /* ---- Aynı Sektörden Şirketler: piyasa değeri ---- */
  capLogNote:
    "Çubuk piyasa değerini logaritmik ölçekte gösterir: sol uç {floor}, sağ uç listenin en büyüğü; her eşit adım on kat.",

  /* ---- Kural Kural: eşik kulvarı ---- */
  colGauge: "Eşik ve Değer",
  gaugeAria: "Eşik {t}, değer {v}",
  gaugeNote:
    "Kulvarda çizgi kuralın eşiği, nokta hissenin değeri, aradaki çubuk farkı. Piyasa değeri, fiyat ve hacimde ölçek logaritmik: bir aralık on kat. Ucu aşan değer uçta açık nokta olarak durur.",
  /** Halkanın dilim ayrıntısı (dokunuşta, `title`). */
  sliceTitle: "{name}: {score} Puan, Ağırlık %{w}",
  dialCaption: "Halkanın dilimleri kategoriler: boyu ağırlık, dolu kısmı puan.",
};

export const stockVisualsEn: typeof stockVisualsTr = {
  peerAbove: "Above {p}% of Sector",
  peerBelow: "Below {p}% of Sector",
  peerAria: "{metric} {v}; sector median {m}, compared with {n} companies, {pos}.",
  peerNote:
    "The lane spans the 5th to 95th percentile of {n} companies in the same GICS sector: the line is the sector median, the dot is the company. Same source as the Stock Scorecard; measures without sector data get no lane. Position is not a grade: being high or low is not good or bad on its own.",

  shiftDown: "The buy-side share fell {d} points in {m} months: {a}%\u00a0→\u00a0{b}%.",
  shiftUp: "The buy-side share rose {d} points in {m} months: {a}%\u00a0→\u00a0{b}%.",
  shiftFlat: "The buy-side share held steady over {m} months: {b}%.",
  stackLabel: "Distribution by Month",
  lineLabel: "Buy-Side Share",
  columnAria: "{month}: {n} analysts, buy side {share}%",
  analysts: "{n} Analysts",
  tableShow: "Table With Numbers",

  weightNote:
    "The bar is the stock's share of the investor's portfolio; the scale is the largest share in the list ({max}). Share is relative to the total value of long positions in the latest 13F filing.",

  sharesUnit: "{n} Shares",
  capLogNote:
    "Bars show market cap on a log scale: the left end is {floor}, the right end the largest in the list; each equal step is ten times.",

  colGauge: "Threshold and Value",
  gaugeAria: "Threshold {t}, value {v}",
  gaugeNote:
    "In each lane the line is the rule's threshold, the dot is the stock's value and the bar between them is the gap. Market cap, price and volume use a log scale: one step is ten times. A value beyond the end sits at the edge as an open dot.",
  sliceTitle: "{name}: {score} Points, Weight {w}%",
  dialCaption: "The ring's slices are the categories: length is weight, fill is score.",
};
