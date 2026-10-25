/**
 * `communityVisuals` ad alanı — topluluk ekranlarının görsel turu (25 Ekim).
 * Sözlüğün parçası (tr.ts / en.ts bunu `communityVisuals` anahtarına
 * koyuyor), ayrı dosyada: paralel geliştirilen paketler sözlüğün ortasına
 * anahtar serpiştirmesin. Akışın kendi metinleri (`community.feed`) yerinde
 * kalıyor; burada yalnız yeni görsellerin etiketleri var.
 */

export const communityVisualsTr = {
  band: {
    posts: "Yazı",
    authors: "Yazar",
    latest: "Son Yayın",
    symbols: "En Çok Geçen",
    label: "Topluluk Akışının Özeti",
  },
  lead: {
    label: "Öne Çıkan",
    preview: "Yazıdan",
  },
  kindsLabel: "Yazıdaki Görsel Bloklar",
  kinds: {
    sayilar: "Sayılar",
    bar: "Çubuk",
    pay: "Pay",
    akis: "Akış",
    oncesi: "Öncesi ve Sonrası",
    zaman: "Zaman Çizelgesi",
    grafik: "Grafik",
    ornek: "Örnek",
    dikkat: "Dikkat",
    ozet: "Özet",
    tanim: "Tanım",
  },
  stepsLabel: "Yazının Üç Adımı",
  starters: {
    title: "Bir Şablonla Başla",
    hint: "Şablon editörü örnek bloklarla dolu açar; köşeli parantezli yerleri kendi fikrinle doldurursun.",
  },
  author: {
    title: "Yazar",
    profile: "Profili Gör",
    posts: "{n} Yazı",
    postsOne: "1 Yazı",
    since: "{date} Tarihinden Beri Üye",
    more: "Yazarın Öteki Yazıları",
  },
};

export const communityVisualsEn: typeof communityVisualsTr = {
  band: {
    posts: "Posts",
    authors: "Authors",
    latest: "Latest",
    symbols: "Most Mentioned",
    label: "Community Feed Summary",
  },
  lead: {
    label: "Featured",
    preview: "From the Post",
  },
  kindsLabel: "Visual Blocks in This Post",
  kinds: {
    sayilar: "Numbers",
    bar: "Bars",
    pay: "Share",
    akis: "Flow",
    oncesi: "Before and After",
    zaman: "Timeline",
    grafik: "Chart",
    ornek: "Example",
    dikkat: "Caution",
    ozet: "Summary",
    tanim: "Definitions",
  },
  stepsLabel: "Three Steps to a Post",
  starters: {
    title: "Start From a Template",
    hint: "A template opens the editor filled with sample blocks; you replace the bracketed parts with your own idea.",
  },
  author: {
    title: "Author",
    profile: "View Profile",
    posts: "{n} Posts",
    postsOne: "1 Post",
    since: "Member Since {date}",
    more: "More From This Author",
  },
};
