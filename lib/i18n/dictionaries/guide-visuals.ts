/**
 * `guideVisuals` ad alanı — Rehberin yol haritası ve yazı sayfasındaki
 * ilerleme (25 Ekim, öğrenme ve hesap araçlarının görsel turu). Sözlüğün
 * parçası (tr.ts / en.ts bunu `guideVisuals` anahtarına koyuyor), ayrı
 * dosyada: paralel geliştirilen paketler sözlüğün ortasına anahtar
 * serpiştirmesin.
 */

export const guideVisualsTr = {
  /* Yol haritası (/rehber) */
  roadmapLabel: "Rehberin Yol Haritası",
  chapter: "{n}. Bölüm",
  chapterMeta: "{count} Yazı · ~{minutes} Dk",
  chapterRead: "{read}/{total} Okundu",
  chapterDone: "Bölüm Bitti",
  totalMeta: "{count} Yazı · ~{minutes} Dk Okuma",
  totalRead: "{read}/{total} Yazı Okundu",
  continueReading: "Kaldığın Yerden Devam Et",
  allDone: "Rehberin Tamamını Okudun",
  storageNote: "İlerlemen yalnız bu tarayıcıda tutulur; hesabına kaydedilmez.",
  readMark: "Okundu",
  dotsLabel: "{label}: {total} yazının {read} tanesi okundu",

  /* Yazı sayfası */
  progressTitle: "Rehberdeki Yerin",
  chapterPosition: "{chapter} · {index}. Yazı / {total}",
  curriculumPosition: "Rehberin {index}/{total} Yazısı",
  legendRead: "Okunan",
  legendCurrent: "Bu Yazı",
  legendNext: "Sırada",
  segmentsLabel: "{chapter} bölümünün yazıları; bu yazı {index}. sırada",
  stepMeta: "{level} · {minutes} Dk",
  chapterStart: "Yeni Bölüm",
};

export const guideVisualsEn: typeof guideVisualsTr = {
  roadmapLabel: "Guide Roadmap",
  chapter: "Chapter {n}",
  chapterMeta: "{count} Articles · ~{minutes} Min",
  chapterRead: "{read}/{total} Read",
  chapterDone: "Chapter Complete",
  totalMeta: "{count} Articles · ~{minutes} Min Read",
  totalRead: "{read}/{total} Articles Read",
  continueReading: "Continue Where You Left Off",
  allDone: "You Have Read the Whole Guide",
  storageNote: "Your progress is kept only in this browser; it is not saved to your account.",
  readMark: "Read",
  dotsLabel: "{label}: {read} of {total} articles read",

  progressTitle: "Your Place in the Guide",
  chapterPosition: "{chapter} · Article {index} of {total}",
  curriculumPosition: "Article {index} of {total} in the Guide",
  legendRead: "Read",
  legendCurrent: "This Article",
  legendNext: "Up Next",
  segmentsLabel: "Articles in {chapter}; this is number {index}",
  stepMeta: "{level} · {minutes} Min",
  chapterStart: "New Chapter",
};
