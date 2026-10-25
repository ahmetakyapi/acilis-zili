/**
 * `analysisVisuals` ad alanı — bilanço karnesinin görsel turu (25 Ekim):
 * tepe cümlesi, beklenti çizgisi, güçlü yön / risk kartı, okuma dizini,
 * kaynak kartları ve analiz listesinin kart görünümü. Ayrı dosyada:
 * birleştirmede iki büyük sözlükte çakışma alanı küçük kalsın.
 *
 * Başlıklar Title Case; cümle parçaları cümle düzeninde. Tepe cümlesinin
 * parçaları `lib/analysis-visuals.ts` → `reportLede` ile birleşiyor:
 * "{gelir}, {hbk}; {tepki}." — yalnız kayıtta olan parçalar.
 */

export const analysisVisualsTr = {
  lede: {
    revenueUp: "gelir yıllık {pct} büyüdü",
    revenueDown: "gelir yıllık {pct} geriledi",
    epsBeat: "hisse başı kâr beklentiyi {pct} aştı",
    epsMiss: "hisse başı kâr beklentinin {pct} altında kaldı",
    epsInline: "hisse başı kâr beklentiyle aynı geldi",
    reactionUp: "hisse ilk tepkide {pct} yükseldi",
    reactionDown: "hisse ilk tepkide {pct} düştü",
    reactionFlat: "hisse ilk tepkide yerinde kaldı",
  },
  expected: "Beklenti",
  actual: "Gerçekleşen",
  balanceTitle: "Güçlü Yönler ve Riskler",
  balanceCount: "{strengths} Güçlü Yön · {risks} Risk",
  readingIndex: "Bölümler",
  ceoTopics: "Çağrıda Öne Çıkanlar",
  sourceDocument: "Belge",
  list: {
    view: "Görünüm",
    cards: "Kart",
    rows: "Liste",
    reaction: "İlk Tepki",
    scale: "Tepki şeritleri ortak ölçekte: ±%{n}",
    revenue: "Gelir Yıllık",
    eps: "HBK Beklentiye Göre",
    noReaction: "Tepki yazılmadı",
    more: "Daha Fazla Göster",
    shown: "{shown} / {total}",
  },
};

export const analysisVisualsEn: typeof analysisVisualsTr = {
  lede: {
    revenueUp: "revenue grew {pct} year over year",
    revenueDown: "revenue fell {pct} year over year",
    epsBeat: "EPS beat the estimate by {pct}",
    epsMiss: "EPS missed the estimate by {pct}",
    epsInline: "EPS matched the estimate",
    reactionUp: "the stock rose {pct} in its first reaction",
    reactionDown: "the stock fell {pct} in its first reaction",
    reactionFlat: "the stock was flat in its first reaction",
  },
  expected: "Estimate",
  actual: "Actual",
  balanceTitle: "Strengths and Risks",
  balanceCount: "{strengths} Strengths · {risks} Risks",
  readingIndex: "Sections",
  ceoTopics: "Highlighted on the Call",
  sourceDocument: "Document",
  list: {
    view: "View",
    cards: "Cards",
    rows: "List",
    reaction: "First Reaction",
    scale: "Reaction strips share one scale: ±{n}%",
    revenue: "Revenue YoY",
    eps: "EPS vs Estimate",
    noReaction: "No reaction recorded",
    more: "Show More",
    shown: "{shown} of {total}",
  },
};
