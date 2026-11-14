/**
 * `searchPalette` ad alanı — ⌘K paletinin site içi sonuçları (14 Kasım):
 * sözlük terimleri, temalar, ünlü yatırımcılar, araç ve sayfalar. Ayrı
 * dosyada: iki büyük sözlükte çakışma alanı tek satır kalsın
 * (tool-visuals.ts ile aynı gerekçe). Paletin eski metinleri (`nav.search*`)
 * yerinde duruyor.
 *
 * `groups` grup başlıkları ve `hints` satırın ikinci satırı: Title Case.
 * `placeholder` ve `empty` cümle düzeninde.
 *
 * `keywords` — sayfanın ADINDA geçmeyen, okurun yazabileceği kelimeler
 * ("stopaj" → Vergi Hesaplayıcı). Anahtar dil öneksiz yol; sayfa listesi
 * `lib/search-site.ts`te ve her sayfanın burada bir satırı olduğunu
 * `tests/search-site.test.ts` denetliyor. Yazım serbest: arama harfleri
 * katlıyor (büyük/küçük, ç/ğ/ı/ö/ş/ü), "ısı haritası" da "isi haritasi" da
 * bulur. Adın kendisini tekrar yazma; başka bir sayfanın adını da yazma
 * (o sayfanın önüne geçmez ama listeyi kalabalıklaştırır). İngilizce
 * sözlükte okurun alışık olabileceği birkaç Türkçe kelime de var, tersi de.
 */

export const searchPaletteTr = {
  placeholder: "Hisse, terim, tema ya da sayfa ara",
  empty: "Bu aramayla eşleşen bir sonuç yok.",
  groups: {
    page: "Araçlar ve Sayfalar",
    glossary: "Sözlük",
    theme: "Temalar",
    investor: "Ünlü Yatırımcılar",
  },
  /* Menüde ipucu satırı olmayan sayfaların ikinci satırı. */
  hints: {
    today: "Geri Sayım, Gün Akışı, Bülten",
    menu: "Bütün Ekranlar Tek Listede",
    about: "Veriler Nereden Geliyor, Kim Yazıyor",
    bigger: "İki Şirket, Tek Soru",
  },
  keywords: {
    "/": ["ana sayfa", "anasayfa", "geri sayım", "açılış zili", "gün akışı"],
    "/piyasalar": ["borsa", "endeksler", "ısı haritası", "tahvil faizleri", "piyasa nabzı", "sektör performansı", "emtia", "VIX"],
    "/teknik-analiz": ["teknik", "destek direnç", "al tut sat", "alım bölgesi", "stop"],
    "/sirketler": ["şirket dizini", "hisseler", "hisse listesi", "sektörler"],
    "/portfoy": ["portföyüm", "pozisyonlar", "kâr zarar", "TL maliyet", "varlıklarım"],
    "/makro": ["ekonomi", "enflasyon", "TÜFE", "işsizlik", "istihdam", "FOMC", "Fed", "FRED"],
    "/bilancolar": ["bilanço takvimi", "kazanç", "EPS", "çeyrek sonuçları", "earnings"],
    "/takvim": ["ekonomik takvim", "veri takvimi", "halka arz", "temettü takvimi", "IPO"],
    "/mercek": ["yazılar", "uzun okuma", "olayın arkası"],
    "/temalar": ["temalar", "tema listeleri", "sektör listeleri"],
    "/olasiliklar": ["olasılık", "Fed kararı", "faiz indirimi", "seçim", "resesyon", "tahmin piyasası"],
    "/hisse-secimi": ["hisse seç", "kural kontrolü", "uyum puanı", "hisse nasıl seçilir"],
    "/tarama": ["tarayıcı", "tarama", "hisse tara", "süzgeç", "filtre", "screener"],
    "/karsilastir": ["karşılaştırma", "kıyasla", "kıyas", "yan yana"],
    "/rehber": ["eğitim", "öğren", "başlangıç", "borsa nasıl öğrenilir"],
    "/sozluk": ["terimler", "terim", "kavramlar", "ne demek"],
    "/araci-kurumlar": ["aracı kurum", "broker", "komisyon", "hesap açma", "banka", "ücretler"],
    "/vergi": ["vergi", "vergi hesaplama", "stopaj", "beyanname", "temettü vergisi", "Yİ-ÜFE", "W-8BEN"],
    "/yatirimcilar": ["yatırımcılar", "13F", "fon yöneticileri", "kim ne aldı"],
    "/risk-masasi": ["risk", "rejim", "maruziyet"],
    "/topluluk": ["üye yazıları", "okur yazıları", "forum"],
    "/haberler": ["haber", "gündem", "haber akışı", "son dakika"],
    "/seans-silueti": ["poster", "seans silueti", "siluet"],
    "/gunun-grafigi": ["grafik", "günlük grafik", "tek grafik"],
    "/bulmaca": ["bulmaca", "oyun", "hisse tahmin", "tahmin oyunu"],
    "/bulmaca/hangisi-buyuk": ["oyun", "piyasa değeri oyunu", "büyük mü küçük mü"],
    "/bulten": ["bülten", "günlük bülten", "haftalık bülten", "sabah bülteni"],
    "/favoriler": ["favori", "takip listesi", "izleme listesi", "watchlist"],
    "/yenilikler": ["yenilik", "ne değişti", "değişiklikler", "sürüm notları"],
    "/menu": ["menü", "tüm sayfalar", "bütün ekranlar", "site haritası"],
    "/hakkinda": ["hakkında", "metodoloji", "veri kaynakları", "kim yapıyor", "iletişim"],
    "/ayarlar": ["ayar", "koyu tema", "açık tema", "dil", "bildirimler", "şifre değiştir", "hesap"],
  },
};

export const searchPaletteEn: typeof searchPaletteTr = {
  placeholder: "Search stocks, terms, themes or pages",
  empty: "Nothing matches this search.",
  groups: {
    page: "Tools and Pages",
    glossary: "Glossary",
    theme: "Themes",
    investor: "Famous Investors",
  },
  hints: {
    today: "Countdown, Day Flow, Brief",
    menu: "Every Screen in One List",
    about: "Where the Data Comes From, Who Writes",
    bigger: "Two Companies, One Question",
  },
  keywords: {
    "/": ["home", "homepage", "countdown", "opening bell", "day flow"],
    "/piyasalar": ["stock market", "indices", "indexes", "heat map", "heatmap", "treasury yields", "market pulse", "sector performance", "commodities", "VIX"],
    "/teknik-analiz": ["technicals", "support resistance", "buy hold sell", "buy zone", "stop"],
    "/sirketler": ["company directory", "stocks", "stock list", "sectors"],
    "/portfoy": ["my portfolio", "positions", "profit loss", "holdings", "lira cost"],
    "/makro": ["economy", "inflation", "CPI", "unemployment", "jobs", "FOMC", "Fed", "FRED"],
    "/bilancolar": ["earnings calendar", "EPS", "quarterly results", "reports", "bilanço"],
    "/takvim": ["economic calendar", "data calendar", "IPO", "dividend calendar", "takvim"],
    "/mercek": ["stories", "long reads", "explainers", "mercek"],
    "/temalar": ["themes", "theme lists", "sector lists"],
    "/olasiliklar": ["odds", "Fed decision", "rate cut", "election", "midterms", "recession", "prediction market"],
    "/hisse-secimi": ["pick a stock", "rule check", "fit score", "how to pick stocks"],
    "/tarama": ["screener", "screen", "scan", "filter", "stock filter"],
    "/karsilastir": ["comparison", "versus", "vs", "side by side"],
    "/rehber": ["learn", "education", "beginner", "how to invest", "rehber"],
    "/sozluk": ["terms", "dictionary", "definitions", "what does it mean", "sözlük"],
    "/araci-kurumlar": ["broker", "brokerage", "commission", "fees", "open an account"],
    "/vergi": ["tax", "taxes", "withholding", "tax return", "dividend tax", "W-8BEN", "vergi"],
    "/yatirimcilar": ["investors", "13F", "fund managers", "who bought what"],
    "/risk-masasi": ["risk", "regime", "exposure"],
    "/topluluk": ["member posts", "reader posts", "forum"],
    "/haberler": ["headlines", "news feed", "latest news"],
    "/seans-silueti": ["poster", "session skyline", "skyline"],
    "/gunun-grafigi": ["chart", "daily chart", "one chart"],
    "/bulmaca": ["puzzle", "game", "stock guess", "guessing game"],
    "/bulmaca/hangisi-buyuk": ["game", "market cap game", "higher or lower"],
    "/bulten": ["brief", "daily brief", "weekly brief", "newsletter", "morning brief"],
    "/favoriler": ["favorites", "favourites", "watchlists", "tracking list"],
    "/yenilikler": ["changelog", "what changed", "updates", "release notes"],
    "/menu": ["all pages", "every screen", "site map", "sitemap"],
    "/hakkinda": ["about", "methodology", "data sources", "who makes this", "contact"],
    "/ayarlar": ["setting", "dark theme", "light theme", "language", "notifications", "change password", "account"],
  },
};
