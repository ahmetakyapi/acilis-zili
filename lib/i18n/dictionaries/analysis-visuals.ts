/**
 * `analysisVisuals` ad alanı — bilanço karnesinin görsel turu (25 Ekim):
 * tepe cümlesi, beklenti çizgisi, güçlü yön / risk kartı, okuma dizini,
 * kaynak kartları ve analiz listesinin kart görünümü. Ayrı dosyada:
 * birleştirmede iki büyük sözlükte çakışma alanı küçük kalsın.
 *
 * Başlıklar Title Case. Tepe cümlesi (`reportLede`) 28 Kasım 2026'da
 * kalktı: aynı üç sayı kapakta hemen altında duruyordu (dönem sayfası).
 */

export const analysisVisualsTr = {
  expected: "Beklenti",
  actual: "Gerçekleşen",
  balanceTitle: "Güçlü Yönler ve Riskler",
  balanceCount: "{strengths} Güçlü Yön · {risks} Risk",
  ceoTopics: "Çağrıda Öne Çıkanlar",
  sourceDocument: "Belge",
  /* Tur 3 (28 Kasım): telefonda katlanan listeler. */
  pointsMore: "{n} Madde Daha",
  sourcesMore: "{n} Kaynak Daha",
  foldLess: "Daha Az Göster",
  list: {
    view: "Görünüm",
    cards: "Kart",
    rows: "Liste",
    reaction: "İlk Tepki",
    scale: "Şeritler her ölçüde listenin ortak ölçeğinde: Gelir ±%{revenue} · HBK ±%{eps} · Tepki ±%{n}",
    revenue: "Gelir (Yıllık)",
    eps: "HBK Sürprizi",
    noReaction: "Tepki yazılmadı",
    more: "Daha Fazla Göster",
    shown: "{shown} / {total}",
  },
};

export const analysisVisualsEn: typeof analysisVisualsTr = {
  expected: "Estimate",
  actual: "Actual",
  balanceTitle: "Strengths and Risks",
  balanceCount: "{strengths} Strengths · {risks} Risks",
  ceoTopics: "Highlighted on the Call",
  sourceDocument: "Document",
  pointsMore: "{n} More",
  sourcesMore: "{n} More Sources",
  foldLess: "Show Less",
  list: {
    view: "View",
    cards: "Cards",
    rows: "List",
    reaction: "First Reaction",
    scale: "Each strip shares the list's scale: Revenue ±{revenue}% · EPS ±{eps}% · Reaction ±{n}%",
    revenue: "Revenue (YoY)",
    eps: "EPS Surprise",
    noReaction: "No reaction recorded",
    more: "Show More",
    shown: "{shown} of {total}",
  },
};
