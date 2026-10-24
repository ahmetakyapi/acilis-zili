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
  showMore: "{n} Madde Daha",
  showLess: "Daha Az Göster",
  filterLabel: "Değişiklik Türü",
  filterAll: "Tümü",
  kind: {
    yeni: "Yeni",
    iyilestirme: "İyileştirme",
    duzeltme: "Düzeltme",
  },
  monthsLabel: "Aylar",
  entryCount: "{n} Giriş",
  entryCountOne: "{n} Giriş",
  olderTitle: "Daha Eski Girişler",
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
  menuHint: "Latest Additions to the Site",
  badge: "New",
  badgeLabel: "There are updates you haven't seen",
  feedLink: "RSS",
  feedLabel: "What's New RSS Feed",
  latestTitle: "In This Release",
  itemCount: "{n} Items",
  itemCountOne: "{n} Item",
  try: "Try It",
  showMore: "{n} More Items",
  showLess: "Show Less",
  filterLabel: "Type of Change",
  filterAll: "All",
  kind: {
    yeni: "New",
    iyilestirme: "Improved",
    duzeltme: "Fixed",
  },
  monthsLabel: "Months",
  entryCount: "{n} Entries",
  entryCountOne: "{n} Entry",
  olderTitle: "Earlier Entries",
  emptyTitle: "No Changes of This Type",
  emptyBody: "Nothing matches the type you picked. Clear the filter to see every change.",
  footnote:
    "Only changes readers can see are listed; infrastructure and maintenance work is left out. Every item rests on a change in the site's source code.",
  menuGroup: "Site",
  feedTitle: "Opening Bell: What's New",
  feedDescription: "Features, improvements and fixes added to Opening Bell.",
};

export type ChangelogLabels = typeof changelogTr;
