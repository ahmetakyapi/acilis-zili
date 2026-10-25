/**
 * `changelog` ad alanı — Yenilikler sayfası, menü satırı ve rozet (25 Ekim).
 * Sözlüğün parçası (tr.ts / en.ts sonuna ekleniyor) ama ayrı dosyada:
 * özellik birleştirilirken iki büyük sözlük dosyasında çakışma alanı küçük
 * kalsın (stock-puzzle.ts ile aynı gerekçe). Girişlerin kendisi sözlükte
 * değil, `content/changelog.ts`te.
 */

export const changelogTr = {
  title: "Yenilikler",
  subtitle: "Sitede neyin değiştiği, en yenisi üstte. Yeni bir özelliği yanındaki bağlantıdan hemen deneyebilirsin.",
  menuHint: "Siteye Son Eklenenler",
  badge: "Yeni",
  badgeLabel: "Görmediğin yenilikler var",
  feedLink: "RSS",
  feedLabel: "Yenilikler RSS Akışı",
  latestTitle: "Bu Sürümde",
  itemCount: "{n} Madde",
  itemCountOne: "{n} Madde",
  try: "Dene",
  filterLabel: "Değişiklik Türü",
  filterAll: "Tümü",
  kind: {
    yeni: "Yeni",
    iyilestirme: "İyileştirme",
    duzeltme: "Düzeltme",
  },
  /* Yeniden düzen (25 Ekim): sürüm şeridi ve alanlar. */
  stripTitle: "Sürüm Akışı",
  statReleases: "Sürüm",
  statItems: "Madde",
  statUpdated: "Son Güncelleme",
  pointLabel: "{date}, {title}, {n} madde",
  area: {
    claude: "Claude",
    piyasa: "Piyasa ve Hisse",
    bilanco: "Bilanço ve Takvim",
    kisisel: "Kişisel",
    icerik: "İçerik ve Site",
  },
  entryCount: "{n} Giriş",
  entryCountOne: "{n} Giriş",
  emptyTitle: "Bu Türde Değişiklik Yok",
  emptyBody: "Seçtiğin türde bir madde bulunamadı. Bütün değişiklikleri görmek için süzgeci kaldır.",
  footnote:
    "Yalnız okurun gördüğü değişiklikler burada; altyapı ve bakım işleri yazılmıyor. Her madde sitenin kaynak kodundaki bir değişikliğe dayanıyor.",
  menuGroup: "Site",
  feedTitle: "Açılış Zili: Yenilikler",
  feedDescription: "Açılış Zili'ne eklenen özellikler, iyileştirmeler ve düzeltmeler.",
};

export const changelogEn: typeof changelogTr = {
  title: "What's New",
  subtitle: "What changed on the site, newest first. Try any new feature straight from the link next to it.",
  menuHint: "Latest Additions",
  badge: "New",
  badgeLabel: "There are updates you haven't seen",
  feedLink: "RSS",
  feedLabel: "What's New RSS Feed",
  latestTitle: "In This Release",
  itemCount: "{n} Items",
  itemCountOne: "{n} Item",
  try: "Try It",
  filterLabel: "Type of Change",
  filterAll: "All",
  kind: {
    yeni: "New",
    iyilestirme: "Improved",
    duzeltme: "Fixed",
  },
  stripTitle: "Release Timeline",
  statReleases: "Releases",
  statItems: "Items",
  statUpdated: "Last Update",
  pointLabel: "{date}, {title}, {n} items",
  area: {
    claude: "Claude",
    piyasa: "Markets and Stocks",
    bilanco: "Earnings and Calendar",
    kisisel: "Personal",
    icerik: "Content and Site",
  },
  entryCount: "{n} Entries",
  entryCountOne: "{n} Entry",
  emptyTitle: "No Changes of This Type",
  emptyBody: "Nothing matches the type you picked. Clear the filter to see every change.",
  footnote:
    "Only changes readers can see are listed; infrastructure and maintenance work is left out. Every item rests on a change in the site's source code.",
  menuGroup: "Site",
  feedTitle: "Opening Bell: What's New",
  feedDescription: "Features, improvements and fixes added to Opening Bell.",
};

export type ChangelogLabels = typeof changelogTr;
