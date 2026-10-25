/**
 * `toolVisuals` ad alanı — araç ekranlarının görsel turu (25 Ekim):
 * /tarama (tepe cümlesi, sektör şeridi, ölçü kümesi, kart görünümü),
 * /sirketler (sektör dağılımı) ve /hisse-secimi (kural kartları, puan
 * kulvarı). Ayrı dosyada: birleştirmede iki büyük sözlükte çakışma alanı
 * küçük kalsın (personal-visuals.ts ile aynı gerekçe).
 *
 * Başlıklar ve künyeler Title Case; cümleler, ipuçları ve ekran okuyucu
 * metinleri cümle düzeninde. Sayıya ek getiren kalıp yok ("%41'i" gibi):
 * ek sayının okunuşuna bağlı, şablon onu bilemez — "%41 payı" yazılır.
 */

export const toolVisualsTr = {
  screener: {
    /** Tepe cümlesi parçaları — birleştirme `lib/tool-visuals.ts` → screenerSentence. */
    sentence: {
      filtered: "Süzgeçten {n} hisse geçti",
      all: "Tarama evreninde {n} hisse var",
      topSector: "en kalabalık sektör {sector} ({k} hisse)",
      oneSector: "tamamı {sector}",
      medianFk: "ortanca F/K {fk}",
      none: "Süzgeçten hisse geçmedi.",
    },
    summaryTitle: "Sonucun Görünümü",
    sectorMix: "Sektör Dağılımı",
    sectorMixHint: "Şerit sonuç kümesinin sektörlerini gösterir; bir parçaya basınca liste o sektöre süzülür.",
    sectorAria: "{sector}: {n} hisse, kümenin %{p} payı",
    other: "Diğer {n} Sektör",
    swarmTitle: "{metric} Dağılımı",
    metricLabel: "Ölçü",
    swarmHint: "Her nokta bir hisse. Üzerine gel ya da dokun, adı görünsün; ok tuşlarıyla da gezilir.",
    swarmAria: "{metric} dağılımı, {n} hisse. Ok tuşlarıyla hisseler arasında gez, Enter ile hisseyi aç.",
    swarmMedian: "Ortanca {v}",
    swarmUniverse: "Evren Ortancası {v}",
    swarmLog: "Logaritmik Ölçek",
    swarmClipped: "Uçtaki {n} hisse kenarda boş halkayla duruyor; gerçek değeri üzerine gelince yazar.",
    swarmEmpty: "Bu ölçü süzgeçten geçen hisselerde henüz yok.",
    swarmMissing: "{n} hissede bu ölçü yok; kümede görünmez.",
    open: "Hisseyi Aç",
    viewLabel: "Görünüm",
    viewCards: "Kart",
    viewTable: "Tablo",
    laneTitle: "Tarama evreninde {p}. yüzdelik",
    laneLegend: "Ray, sıraladığın ölçünün tarama evrenindeki yerini gösterir; ortadaki çentik ortanca. Çubuk piyasa değeri, listenin en büyüğüne göre.",
    sortedBy: "Sıralama",
  },
  companies: {
    distTitle: "Sektör Dağılımı",
    distMeta: "Şirket Sayısı ve Piyasa Değeri",
    distLead: "Piyasa değerinin en büyük payı {group} grubunda: şirketlerin %{c} payı, toplam değerin %{v} payı.",
    distCount: "Şirket Sayısı",
    distValue: "Piyasa Değeri",
    distItemAria: "{group}: {n} şirket; şirketlerin %{c} payı, piyasa değerinin %{v} payı. Tabloyu bu gruba süz.",
    distNote: "Değer, şirketlerin önbellekteki piyasa değerlerinin toplamı; tablodaki canlı değerden birkaç dakika geride olabilir. Bir parçaya basınca tablo o gruba süzülür.",
    distMore: "{n} grup daha şeritte",
    sharePct: "%{p}",
  },
  screening: {
    rulesCount: "{n} Kural",
    gateNote: "Puana girmez; takılan hissenin puanı {cap} ile sınırlanır.",
    weightShare: "Puandaki Ağırlık",
    laneTitle: "Puanlar Tek Kulvarda",
    laneHint: "Her nokta bir hisse; çentikler bant eşikleri. Puan bir araştırma sırasıdır, alım listesi değil.",
    ringAria: "{symbol} uyum puanı {score} / 100",
  },
};

export const toolVisualsEn: typeof toolVisualsTr = {
  screener: {
    sentence: {
      filtered: "{n} stocks passed the screen",
      all: "The screening universe holds {n} stocks",
      topSector: "the largest sector is {sector} ({k} stocks)",
      oneSector: "all in {sector}",
      medianFk: "median P/E {fk}",
      none: "No stocks passed the screen.",
    },
    summaryTitle: "Result at a Glance",
    sectorMix: "Sector Mix",
    sectorMixHint: "The strip shows the sectors in the result; tap a segment to narrow the list to that sector.",
    sectorAria: "{sector}: {n} stocks, {p}% of the result",
    other: "{n} Other Sectors",
    swarmTitle: "{metric} Distribution",
    metricLabel: "Measure",
    swarmHint: "Each dot is a stock. Hover or tap to see its name; arrow keys work too.",
    swarmAria: "{metric} distribution, {n} stocks. Use arrow keys to move between stocks, Enter to open one.",
    swarmMedian: "Median {v}",
    swarmUniverse: "Universe Median {v}",
    swarmLog: "Log Scale",
    swarmClipped: "{n} outliers sit at the edges as hollow rings; hover to read the actual value.",
    swarmEmpty: "This measure isn't available yet for the stocks in the result.",
    swarmMissing: "{n} stocks lack this measure and are not plotted.",
    open: "Open Stock",
    viewLabel: "View",
    viewCards: "Cards",
    viewTable: "Table",
    laneTitle: "Percentile {p} in the screening universe",
    laneLegend: "The rail shows where the sorted measure sits in the screening universe; the middle notch is the median. The bar is market cap, relative to the largest in the list.",
    sortedBy: "Sorted By",
  },
  companies: {
    distTitle: "Sector Mix",
    distMeta: "Company Count and Market Cap",
    distLead: "The largest share of market value sits in {group}: {c}% of companies, {v}% of total value.",
    distCount: "Companies",
    distValue: "Market Cap",
    distItemAria: "{group}: {n} companies; {c}% of companies, {v}% of market value. Filter the table to this group.",
    distNote: "Value is the sum of cached market caps; it may trail the live figures in the table by a few minutes. Tap a segment to filter the table to that group.",
    distMore: "{n} more groups in the strip",
    sharePct: "{p}%",
  },
  screening: {
    rulesCount: "{n} Rules",
    gateNote: "Not scored; a stock that fails is capped at {cap}.",
    weightShare: "Weight in Score",
    laneTitle: "All Scores on One Lane",
    laneHint: "Each dot is a stock; notches mark the band thresholds. The score is a research order, not a buy list.",
    ringAria: "{symbol} fit score {score} / 100",
  },
};
