const tr = {
  brand: {
    name: "Açılış Zili",
    marketTagline: "ABD Piyasa Takibi",
    tagline: "Zil Çalmadan Önce Bugünü Gör",
    description:
      "ABD borsalarında bugün ne var: ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin tek ekranda, saatleriyle birlikte.",
  },

  /* BOŞ DURUM BAŞLIKLARI NOKTA ALMAZ. Aynı `EmptyState.title` yuvasına giren
     metinlerin bir kısmı nokta ile bitiyor bir kısmı bitmiyordu — aynı
     bileşen, aynı punto, iki farklı imla. Kural: `title` KISA BİR
     BAŞLIKTIR, nokta almaz; `hint` ise cümledir ve nokta alır. */
  nav: {
    tickerPause: "Şeridi Duraklat",
    tickerResume: "Şeridi Sürdür",
    today: "Bugün",
    calendar: "Takvim",
    earnings: "Bilançolar",
    companies: "Şirketler",
    watchlist: "Favoriler",
    news: "Haberler",
    macro: "Makro",
    markets: "Piyasalar",
    guide: "Rehber",
    stories: "Mercek",
    // Mobil alt çubuk etiketleri — 64px sekmede tam sığar.
    earningsShort: "Bilanço",
    marketsShort: "Piyasa",
    settings: "Ayarlar",
    search: "Ara",
    searchPlaceholder: "Hisse ara: sembol veya şirket adı",
    searchTrigger: "Sembol veya Olay Ara",
    searchPopular: "Popüler",
    searchWritings: "Yazılar",
    /* Arama ucu 429 döndüğünde. Eskiden bu durum "sonuç yok" gibi
       görünüyordu: aradığı şirket sitede duruyorken kullanıcıya olgusal
       olarak yanlış bilgi veriliyordu. */
    searchRateLimited: "Çok hızlı arıyorsun. {saniye} sn sonra tekrar dene.",
    searchFailed: "Arama şu an yapılamadı. Tekrar dene.",
    searchHintMove: "Gez",
    searchHintOpen: "Aç",
    menu: "Menü",
    mainNav: "Ana gezinme",
    /* İki gezinme yer imi var ve ikisi de "Ana gezinme" adını
       taşıyordu: ekran okuyucunun yer imi listesinde ayırt
       edilemiyorlardı. Masaüstü şeridi ile telefonun alt çubuğu
       kırılım noktasına göre değişse de ikisi de DOM da duruyor. */
    bottomNav: "Alt gezinme",
    skipToContent: "İçeriğe Geç",
    groupMarket: "Piyasa",
    signIn: "Giriş Yap",
    signUp: "Kayıt Ol",
    signOut: "Çıkış Yap",
    account: "Hesap",
  },

  common: {
    loading: "Yükleniyor",
    submitting: "Gönderiliyor…",
    error: "Bir sorun oluştu",
    retry: "Tekrar Dene",
    noData: "Veri yok",
    noDataHint: "Bu veri şu an alınamıyor.",
    save: "Kaydet",
    cancel: "İptal",
    delete: "Sil",
    add: "Ekle",
    close: "Kapat",
    back: "Geri",
    all: "Tümü",
    less: "Daha Az",
    showAll: "Tümünü Gör",
    breadcrumb: "Sayfa Yolu",
    source: "Kaynak",
    today: "Bugün",
    tomorrow: "Yarın",
    thisWeek: "Bu Hafta",
    empty: "Burada henüz bir şey yok",
  },

  /* Paylaş düğmesinin metinleri.

     Telefonda işletim sisteminin kendi paylaşım sayfası açılıyor ve buradaki
     hiçbir metin görünmüyor; bunlar masaüstünde açılan küçük panelin
     satırları. `copied` bir DURUM bildirimi, başlık değil — ama düğmenin
     üstünde tek başına duruyor, o yüzden Title Case. */
  share: {
    action: "Paylaş",
    title: "Bu Yazıyı Paylaş",
    copyLink: "Bağlantıyı Kopyala",
    copied: "Kopyalandı",
    onX: "X'te Paylaş",
    onLinkedIn: "LinkedIn'de Paylaş",
    onWhatsApp: "WhatsApp'ta Paylaş",
  },

  market: {
    status: "Piyasa Durumu",
    open: "Piyasa Açık",
    closed: "Piyasa Kapalı",
    preMarket: "Açılış Öncesi",
    afterHours: "Kapanış Sonrası",
    holiday: "Resmî Tatil",
    weekend: "Hafta Sonu",
    live: "Canlı",
    delayed: "Gecikmeli",
    lastPrice: "Son Fiyat",
    change: "Değişim",
    prevClose: "Önceki Kapanış",
    volume: "Hacim",
    marketCap: "Piyasa Değeri",
  },

  dayRail: {
    title: "Günün Seyri",
    now: "Şimdi",
    bell: "Açılış Zili",
    // Şerit ekseninde kısa biçim kullanılır — "AÇILIŞ ZİLİ" komşu etiketlere girer.
    openShort: "Açılış",
    closeShort: "Kapanış",
    earningsNote: "Bilanço",
    watchedNote: "Takipte",
    preOpen: "Açılış Öncesi Başlıyor",
    afterClose: "Kapanış Sonrası Bitiyor",
    /* Eksendeki kalın mavi bandın adı — açılış ile kapanış arası. Bandın
       iki ucundaki saatler onun nerede başlayıp bittiğini söylüyordu ama
       bandın kendisinin ne olduğunu söyleyen bir şey yoktu. */
    marketHours: "Piyasa Saatleri",
    noEvents: "Bugün planlanmış veri açıklaması yok",
  },

  today: {
    title: "Bugün",
    briefTitle: "Günün Özeti",
    briefWeeklyTitle: "Haftanın Özeti",
    briefEmpty: "Henüz günlük özet yazılmadı.",
    briefWeeklyEmpty: "Henüz haftalık özet yazılmadı.",
    briefPeriod: "Özet Dönemi",
    /* Günlük özet 16:00'da, haftalık pazartesi 09:30'da yazılıyor; o saate
       kadar en son yazılan metin duruyor ve tarihi burada söyleniyor.

       Cümle "bugünün özeti şu saatte gelecek" değil, "bu özet her gün şu
       saatte yazılır" diyor: rutin gecikirse ya da o gün hiç yazılmazsa
       ikincisi hâlâ doğru kalıyor, birincisi yalan oluyordu. */
    briefStaleNote:
      "Bu, {date} tarihli özet. Günlük özet her gün {time}'da (TR) yayımlanır.",
    briefWeeklyStaleNote:
      "Bu, {range} haftasının özeti. Haftalık özet pazartesi {time}'da (TR) yayımlanır.",
    indices: "Endeksler",
    /* Ön seans / akşam seansı hareketleri — yalnızca o pencerede basılan
       panel. "Günün en çok artanları" burada kullanılamaz: gösterilen şey
       günün değil, henüz açılmamış (ya da kapanmış) seansın hareketi. */
    preMarketMovers: "Açılış Öncesi Hareketleri",
    afterHoursMovers: "Kapanış Sonrası Hareketleri",
    moversUp: "Yükselenler",
    moversDown: "Düşenler",
    moversEmpty: "Bu seansta henüz işlem gören sembol yok.",
    /* Künye NE TARANDIĞINI söylüyor: liste bütün borsanın değil, endeks
       üyelerinin taraması ve içinde yalnızca bu seansta gerçekten işlem
       görenler var. */
    moversNote:
      "{n} endeks üyesi tarandı · yalnızca bu seansta işlem görenler",
    /* ---- Günün hareketleri (yan kolon) ----
       PANEL ARTIK HER SEANSTA VAR. Ön seans ve akşam seansı için yazılmıştı
       ve yalnızca o iki pencerede basılıyordu; seans açıkken ana sayfada
       tek bir hissenin bugün ne yaptığını gösteren hiçbir şey yoktu (kendi
       favorilerin dışında). Başlık seansa göre değişiyor: kapalıyken
       gösterilen şey "günün" değil son kapanışın sıralaması ve künye bunu
       söylüyor.
       "Öne Çıkanlar" DENMEDİ: aynı sayfanın altında `topNews` zaten "Öne
       Çıkan Haberler" diyor, üstelik öne çıkarmak bir editör kararıdır —
       burada yapılan şey sıralama. */
    dayMovers: "Günün Hareketleri",
    dayMoversNote: "{n} endeks üyesi tarandı · seans içi",
    dayMoversClosedNote: "{n} endeks üyesi tarandı · son kapanışa göre",
    dayMoversEmpty: "Sıralama için yeterli fiyat verisi yok.",

    schedule: "Bugünün Takvimi",
    scheduleEmpty: "Bugün için planlanmış ekonomik veri yok.",
    earningsToday: "Bugün Bilanço Açıklayanlar",
    /* Başlığın yanındaki sayaç: bugün kaç şirket açıklıyor ve kaçı
       listede. Listede piyasa değerine göre en büyük sekizi var.
       "TANESİ" — İYELİK EKİ YAZILAMAZ. Kalıp bir dönem "{n}'i" idi ve
       Türkçede o ek sayının son hecesine göre değişiyor: 3'ü, 6'sı, 7'si,
       9'u. Sekiz olası değerin beşi yanlış çıkıyordu. "tanesi" her sayıyla
       çalışıyor ve aynı çözüm arşiv sayacında (`stories.showing`) zaten
       kullanılıyor. */
    earningsCount: "{total} şirketin {n} tanesi",
    watchlistSummary: "Favorilerin",
    watchlistEmpty: "Henüz favori eklemedin.",
    // Ana sayfadaki "son yazılanlar" bloğu
    /* "Son Analizler" ne analizi olduğunu söylemiyordu: ana sayfada
       yanında mercek yazıları ve haberler duruyor, üçü de birer
       "analiz" sayılabilir. Başlık artık türü adıyla söylüyor. */
    latestAnalyses: "Son Bilanço Analizleri",
    latestStories: "Son Mercek Yazıları",
    topNews: "Öne Çıkan Haberler",
    /* Bölüm başlığının yanındaki künye. Liste "son haberler" değil bir
       SEÇKİ: kırk haberlik havuzdan altısı alınıyor ve sembol başına en
       fazla ikisi giriyor. Başlık bunu söylemiyordu. */
    topNewsNote: "son {n} haberden seçildi",
    weekAhead: "Haftaya Bakış",
    weekAheadEmpty: "Önümüzdeki hafta için planlanmış önemli veri yok.",
    worldMarkets: "Dünya Piyasaları",
    /* KÜNYE DÖRT CÜMLEDEN BİRE İNDİ. Birinci cümle SATIRLARIN KENDİSİYLE
       tekrar ediyordu — her satır zaten "MSCI Türkiye · BIST'i izleyen ABD
       fonu" yazıyor, yani neyin gösterildiği künyeye kalmamış. Üçüncü cümle
       ("fonun kendi fiyatı yazılmıyor, çünkü bir piyasa seviyesi değil") bir
       TASARIM GEREKÇESİ, okuyucunun ihtiyacı değil; kararın kendisi bu
       yorumda yaşıyor ve ekrandan indi. Kalan tek cümle okuyucunun gerçekten
       bilmesi gereken şey: yön güvenilir, yüzde değil. */
    worldMarketsHint:
      "ABD'de dolar bazında işlem gören MSCI ülke fonlarının günlük değişimi. Yönü yerel endeksle aynı, yüzdesi kur ve seans farkıyla ayrışabilir.",
    // Sayının ARDINDAN okunur: "1g 15sa 31dk açılış ziline kaldı".
    untilBell: "Açılış Ziline Kaldı",
    untilClose: "Kapanış Ziline Kaldı",
    // Geri sayımın kısa birimleri — "18 dk 42 sn"
    unitD: "g",
    unitH: "sa",
    unitM: "dk",
    unitS: "sn",
    macroSummary: "Makro",
    todayFlow: "Bugünün Akışı",
    pageHeading: "Açılış Zili: ABD Piyasa Takibi",
    /* KAYNAK SATIRI BESLEMEYİ ADIYLA SÖYLÜYOR. Bir dönem "Alpaca IEX"
       yazıyordu ve o besleme konsolide hacmin yirmide birini görüyordu;
       gerekçe `lib/providers/alpaca.ts` başında. Gecikme de artık "olabilir"
       değil, bilinen bir sayı. */
    sourceLine:
      "Fiyat: Alpaca konsolide veri akışı · Profil ve bilanço: Finnhub · Makro: FRED",
    sourceNote: "Endeksler ETF üzerinden izlenir · fiyatlar 15 dk gecikmeli",
  },

  calendar: {
    title: "Ekonomik Takvim",
    subtitle: "ABD makro veri açıklamaları ve Fed toplantıları",
    impact: "Etki",
    impactHigh: "Yüksek",
    impactMedium: "Orta",
    impactLow: "Düşük",
    actual: "Gerçekleşen",
    forecast: "Beklenti",
    previous: "Önceki",
    time: "Saat",
    event: "Olay",
    day: "Gün",
    week: "Hafta",
    month: "Ay",
    empty: "Bu aralıkta planlanmış veri açıklaması yok",
    timesNote: "Saatler Türkiye saatiyle · altında New York (NY)",
    // Gün başlığındaki uzaklık rozeti: "Bugün" · "Yarın" · "3 gün sonra"
    today: "Bugün",
    tomorrow: "Yarın",
    daysAway: "Gün Sonra",
    // Sayaç: Türkçede sayıdan sonra tekil kalır, ikisi de aynı.
    eventOne: "Olay",
    eventMany: "Olay",
    highImpactShort: "Yüksek Etkili",
  },

  earnings: {
    emptyWatchlist: "Favorilerinde bu aralıkta bilanço yok",
    emptyWatchlistHint:
      "Takip ettiğin şirketlerden hiçbiri bu tarih aralığında sonuç açıklamıyor.",
    clearFilter: "Filtreyi Kaldır",
    subtitle: "Şirketlerin finansal sonuç açıklama tarihleri",
    beforeOpen: "Açılış Öncesi",
    afterClose: "Kapanış Sonrası",
    duringMarket: "Seans İçi",
    timeUnknown: "Saat Belirsiz",
    epsEstimate: "EPS Beklentisi",
    /* Kompakt yuvanın öneki — "Yaklaşan Bilançolar" panelinde sayının
       yanında tek kelime. Analizler tablosunun başlığı "HBK / Beklenti"
       dediği için aynı sayfada aynı kısaltma. */
    epsEstimateShort: "HBK",
    epsActual: "Açıklanan EPS",
    revenueEstimate: "Gelir Beklentisi",
    revenueActual: "Açıklanan Gelir",
    surprise: "Sapma",
    quarter: "Çeyrek",
    timing: "Zamanlama",
    period: "Dönem",
    reportDate: "Rapor Tarihi",
    revenueShort: "Gelir",
    epsFull: "EPS (Hisse Başına Kâr)",
    epsExplainer:
      "şirketin çeyrek boyunca kazandığı net kârın hisse sayısına bölünmüş hâlidir; bir hissenin o dönemde ne kadar kâr ürettiğini gösterir. Analistler her çeyrek için bir beklenti açıklar; gerçekleşen rakamın bu beklentinin ne kadar üstünde veya altında kaldığı sapmadır. Gelir (ciro) ise kârdan önceki toplam satıştır: piyasa çoğu zaman kâr beklentisini tutturup gelirde beklentinin altında kalan şirketin hissesini de satar, bu yüzden ikisi birlikte okunur.",
    spotlight: "Öne Çıkanlar",
    addToCalendar: "Takvime Ekle",
    alsoReporting: "Diğer Açıklayanlar",
    /* Türkçede sayıdan sonra çoğul eki gelmez, iki değer de aynı; ayrım
       İngilizce için — "1 companies" yazıyordu. Desen `eventOne/eventMany`
       çiftinden geliyor, o zaten bu iş için vardı ama dört yere
       uygulanmamıştı. */
    companyOne: "Şirket",
    companyMany: "Şirket",
    empty: "Bu aralıkta bilanço açıklaması yok",
    marketCapShort: "PD",
    rangeWeek: "Hafta",
    rangeMonth: "Ay",
    /* Listenin altındaki aralık anahtarının yanındaki satır. Cümle, künye
       değil — Title Case kapsamı dışında. */
    endOfWeekList: "Haftanın sonu. Bir ay ilerisini görmek için aralığı değiştir.",
    endOfMonthList: "Ayın sonu. Daha yakın bir pencere için haftaya dön.",
    subtitleLong:
      "Şirketlerin finansal sonuç açıklama tarihleri · gün içinde piyasa değerine göre sıralı",
    /* Bilançolar ekranının üç sekmesi — takvim, analizler ve takip listesi
       aynı konunun üç görünümü, ayrı sayfalar değil. */
    tabCalendar: "Takvim",
    tabAnalyses: "Analizler",
    tabWatchlist: "Takip Ettiklerim",
    /* Dar sütunlarda tam etiket komşu hücreye taşıyor. */
    beforeOpenShort: "Açılış Öncesi",
    afterCloseShort: "Kap. Sonrası",
    /* Günün analizi kartındaki üçüncü ölçünün adı. Yanındaki ikisi "Gelir"
       ve "EPS" derken bu yalnızca bir ok ve yüzdeydi; okuyucu üç yüzdeden
       birinin neyin yüzdesi olduğunu bilemiyordu. */
    reactionShort: "Hisse",
  },

  /* Bilanço analizleri — açıklanmış çeyreğin okunmuş hâli. */
  analysis: {
    title: "Bilançolar",
    listTitle: "Son Bilanço Analizleri",
    /* Paylaşım kartının üst künyesi — kart sabit Türkçe basıyordu. */
    ogEyebrow: "Bilanço Analizi",
    /* Hisse sayfasındaki panel — orada zaten şirketin içindesin, adı
       tekrar etmeye gerek yok. */
    symbolPanelTitle: "Bilanço Analizleri",
    /* Takvim sekmesinin altındaki şerit — analizler geçmiş bilançolara ait
       olduğu için ileriye bakan takvimde kendiliğinden görünmüyorlar. */
    recentStrip: "Son Yazılan Analizler",
    symbolPanelAll: "Tüm Analizler →",
    thisWeekAnalyzed: "Bu Hafta Analiz Edilenler",
    upcomingEarnings: "Yaklaşan Bilançolar",
    goToCalendar: "Takvime Git →",
    showAll: "Tümünü Gör →",
    /* Rozetin kuyruğundaki bağlantı. Bir süre "Karne →" yazıyordu ve o
       kelime artık var olmayan bir PNG'yi işaret ediyordu — bağlantının
       gittiği yer baştan beri analiz sayfasıydı. */
    analysisLink: "Analiz →",

    /* Kayıtta buy/hold/sell duruyor; ekranda okunan bunlar. */
    verdictBuy: "AL",
    verdictHold: "TUT",
    verdictSell: "SAT",
    verdictLabel: "Genel Görüş",
    /* Paylaşım kartındaki hedef fiyat çipi — sabit "Hedef" yazıyordu. */
    ogTarget: "Hedef",

    /* Tablo 1180px ve kendi kabında yatay kayıyor; kap klavyeyle
       odaklanabilir olduğu için bir adı olmak zorunda. */
    tableRegion: "Analiz Tablosu",
    /* Satırı kaplayan bağlantının adı — satır artık bağlantı değil,
       içinde bağlantı taşıyan bir satır. */
    rowLink: "{symbol} · {period} analizini aç",
    colSymbol: "Sembol",
    colCompany: "Şirket · Dönem",
    colReported: "Açıklanma",
    colRevenue: "Gelir · Yıllık",
    colEps: "HBK / Beklenti",
    colReaction: "Hisse Tepkisi",
    colScore: "Skor",
    colVerdict: "Görüş",
    colCard: "Analiz",

    searchPlaceholder: "Sembol veya şirket ara",
    searchEmpty: "\"{query}\" ile eşleşen analiz yok.",
    searchClear: "Aramayı Temizle",
    resultCountOne: "{count} Analiz",
    resultCountMany: "{count} Analiz",
    sortDate: "Tarihe Göre",
    sortScore: "Skora Göre",
    sortReaction: "Tepkiye Göre",
    filterAll: "Tümü",
    filterThisWeek: "Bu Hafta",
    filterWatchlist: "Takip Ettiklerim",

    summary: "Özet",
    detailed: "Detaylı Değerlendirme",
    byTeam: "Claude",
    strengths: "Güçlü Yönler",
    risks: "Riskler",
    upcomingDev: "Beklenen Gelişmeler",
    quarterlyRevenue: "Çeyreklik Gelir",
    /* Birim sütunların üstünde altı kez tekrar etmesin diye başlıkta. */
    unitBillionUsd: "Milyar $",
    unitMillionUsd: "Milyon $",
    legendActual: "Gerçekleşen",
    legendProjected: "Şirket Öngörüsü",
    guidanceTitle: "{period} Şirket Öngörüsü",
    guidanceTitleFallback: "Gelecek Çeyrek Öngörüsü",
    legendRange: "Şirket Aralığı",
    legendConsensus: "Piyasa Beklentisi",
    /* Öngörü çubuklarının ekseni orta noktaya göre YÜZDE sapma ve kart
       içinde ortak: en geniş bant ekseni belirliyor. Bu satır olmadan uzun
       bir çubuk "geniş aralık" diye okunuyor, oysa yalnızca "bu karttaki en
       geniş bant" demek. {value} eksenin ucundaki yüzdeyle doluyor. */
    /* İŞARETLERİN NE ANLATTIĞI DÜZ TÜRKÇEYLE. Not bir dönem yalnızca
       "Çubuklar orta noktaya göre ölçekli · eksen ±%5,8" diyordu: doğru ama
       yalnızca grafiği zaten çözmüş birine bir şey söylüyordu. Okuyucunun
       sorduğu soru "mavi ne, siyah ne" idi ve cevabı hiçbir yerde yazmıyordu.
       Cümle olduğu için Title Case kapsamı dışında. */
    guidanceAxis:
      "Mavi şerit şirketin verdiği alt-üst aralık; uzunluğu şirketin kendine bıraktığı payı gösterir. Siyah üçgen ve altındaki çizgi piyasanın beklediği yeri işaretler, şeridin ortasındaki çentik ise aralığın orta noktasıdır. Üçgen yalnızca piyasa beklentisi bilinen satırlarda çıkar. Şirket aralık değil tek bir sayı verdiyse ve piyasa beklentisi de bilinmiyorsa o satırda şerit hiç çizilmez; ölçülecek bir uzunluk da, karşılaştırılacak bir konum da yoktur. Eksen orta noktaya göre ±{value}.",
    /* Öngörü satırındaki renkli yargı. Kayıtta `evaluation` yoksa bandın
       iki ucu ile piyasa beklentisi karşılaştırılıp buradan seçilir. */
    guidanceAbove: "Beklenti Aralığın Üstünde",
    guidanceBelow: "Beklenti Aralığın Altında",
    guidanceInline: "Beklentiyle Uyumlu",
    /* Grafik künyeleri — kayıtta künye yoksa gövdedeki sayılardan kurulur. */
    revenueGrowthYoy: "Yıllık Gelir Büyümesi",
    epsSurprise: "Hisse Başına Kâr Sapması",
    stockReaction: "Bilanço Sonrası Tepki",
    nextPeriod: "Sonraki Dönem",
    ceoMessage: "CEO Mesajı",
    analystTarget: "Ort. Analist Hedefi",
    analystTargetCount: "Ort. Analist Hedefi ({count})",
    upsidePotential: "Yükseliş Potansiyeli",
    closePrice: "Bilanço Günü Kapanışı",
    /* Kayıttaki fiyat donuk, bu canlı. İkisi tanımı gereği farklı sayı;
       adları da farklı olmalı ki yan yana dururken hata gibi okunmasın. */
    livePrice: "Şu An",
    /* Borsa kapalıyken "Şu An" yerine bu yazılıyor. "Önceki Kapanış"
       DEĞİL: sayfada bir de "Bilanço Günü Kapanışı" var ve "önceki",
       bilançodan önceki kapanış diye okunuyordu. Kastedilen en son
       kapanış. */
    lastClose: "Son Kapanış",
    sinceReport: "Bilanço Gününden Bugüne",
    reactionNote: "Bilanço Günü Tepkisi",
    return1y: "1 Yıllık Getiri",
    /* Değerleme künyesi. Kısaltmalar Türkiye'de yerleşik olduğu gibi
       bırakıldı — F/K açılımıyla yazılınca ("Fiyat / Kazanç") künye
       satırına sığmıyor ve zaten kimse öyle aramıyor. */
    /* Kayıttan gelen ölçülerin penceresi. Küçük harf çünkü künye, başlık
       değil. "analiz günü" denmedi: okuyucu analizin ne zaman yazıldığını
       bilmiyor, bilanço gününü ise kartın hemen üstünde okuyor. */
    asOfReport: "Bilanço Günü",
    asOfToday: "Bugün",
    peRatio: "F/K",
    pegRatio: "PEG",
    netMargin: "Net Kâr Marjı",
    /* Ölçünün penceresi — künye, başlık değil; cümle düzeninde kalıyor.
       "TTM" yazılmadı: sitenin okuru Türkçe okuyor ve kısaltma burada
       kazanç sağlamıyor. */
    trailing12m: "Son 12 Ay",
    afterHours: "Seans Sonrası",
    nextEarnings: "Sonraki Bilanço",
    earningsOf: "{period} Bilançosu",
    readMinutes: "{count} Dakikalık Okuma",

    empty: "Henüz yayımlanmış bilanço analizi yok",
    emptyHint:
      "Bir şirket bilançosunu açıkladıktan sonra değerlendirmesi burada yayımlanır.",
    emptyWatchlist: "Takip ettiklerin için henüz analiz yok",
    emptyWatchlistHint:
      "Favorilerine eklediğin şirketlerden biri bilanço açıkladığında analizi burada görünür.",
    emptyFilter: "Bu filtreyle eşleşen analiz yok.",
    notFound: "Analiz bulunamadı",
    notFoundHint: "Bağlantı eski olabilir; listeden tekrar dene.",
    signedOut: "Takip Listesi için Giriş Yap",
    signedOutHint:
      "Favorilerine eklediğin şirketlerin bilanço ve analizleri bu sekmede toplanır.",
    watchlistAnalyses: "Takip Ettiklerinin Analizleri",
    watchlistCalendar: "Takip Ettiklerinin Takvimi",

    fallbackNote:
      "Bu analiz henüz Türkçeye çevrilmedi; orijinal diliyle gösteriliyor.",
    publishNote: "Analizler bilanço açıklandıktan sonra ~1 saat içinde yayımlanır.",
    disclaimer:
      "Bu analiz şirketin resmi bilanço bülteni ve kazanç çağrısına dayanır. Yatırım Tavsiyesi Değildir.",
    sourcesLabel: "Kaynaklar",
  },

  companies: {
    title: "Şirketler",
    subtitle: "Takip edilen şirketler: sektör, piyasa değeri ve hacim",
    sector: "Sektör",
    allSectors: "Tüm Sektörler",
    company: "Şirket",
    name: "Şirket Adı",
    price: "Fiyat",
    change: "Değişim",
    weekChange: "Haftalık",
    weekChangeHint: "Son 5 işlem gününün kapanışına göre değişim. Takvim haftası değil, seans sayısı.",
    empty: "Henüz şirket verisi yok",
    emptyHint:
      "Şirket profilleri hisse sayfaları ziyaret edildikçe ve günlük senkronla dolar.",
    // Cümle, başlık değil: sayaç tablonun altında bir bilgi satırı.
    showing: "{total} şirketin {n} tanesi",
    showMore: "Daha Fazla Göster",
    noQuoteNote:
      "Bu listedeki {n} şirket için sağlayıcıda güncel işlem yok; fiyat, değişim ve hacim hücreleri boş bırakıldı. Çoğu, seyrek işlem gören çok küçük ölçekli şirkettir.",
  },

  stock: {
    profile: "Şirket Profili",
    sector: "Sektör",
    industry: "Alt Sektör",
    exchange: "Borsa",
    ipoDate: "Halka Arz",
    website: "Web Sitesi",
    metrics: "Anahtar Metrikler",
    peRatio: "F/K Oranı",
    forwardPe: "İleri F/K",
    movingAverages: "Hareketli Ortalamalar",
    movingAverageRow: "{n} Günlük",
    movingAveragesNote:
      "Son 50, 100 ve 200 işlem gününün kapanış ortalaması. Yanındaki yüzde, güncel fiyatın ortalamaya göre farkı.",
    movingAveragesShort:
      "Ortalama için yeterli geçmiş yok; elimizde {n} işlem günü var.",
    /* Sağlayıcı başka bir menkul kıymetin rakamlarını gönderdiğinde.
       Ölçüldü: BRK.B için A sınıfının rakamları geliyor. */
    metricsMismatch:
      "Veri sağlayıcı bu sembol için başka bir hisse sınıfının rakamlarını döndürüyor; hisse başına ölçüler gösterilmiyor.",
    eps: "Hisse Başına Kâr",
    dividend: "Temettü Verimi",
    beta: "Beta",
    /* Aynı dize `analysis` ve `compare` bölümlerinde de var. Üçüncü kopya
       bilinçli: bu kartın satır etiketlerinin TAMAMI `stock` altında ve
       tek bir satır için başka bölüme uzanmak, sözlüğün bölüm sınırını
       ekranın sınırı olmaktan çıkarırdı. */
    netMargin: "Net Kâr Marjı",
    /* PAYDA ETİKETTE YAZILI ve bu zorunlu: hemen yanındaki Katılım
       Taraması da bir borç oranı gösteriyor ama paydası PİYASA DEĞERİ
       ("Faizli Borç / Piyasa Değeri"). İki oran aynı ekranda ve farklı
       tabanda; "Borç Oranı" gibi paydasız bir ad ikisini ayırt edilemez
       hâle getirirdi. Analist kartındaki iki farklı yüzde tabanının
       karışması tam olarak bu yüzden bir kez sorun olmuştu. */
    debtToEquity: "Borç / Özsermaye",
    high52: "52 Hafta En Yüksek",
    low52: "52 Hafta En Düşük",
    homeCurrencyNote:
      "Hisse başı kâr ve 52 hafta bandı şirketin ana borsasından, {code} cinsinden geliyor; başlıktaki dolar fiyatıyla doğrudan karşılaştırılamaz. F/K oranı da o borsanın kendi içinde hesaplanmıştır.",
    analysts: "Analist Görüşleri",
    /* Kartın boşluğunu DOLDURAN değil, boşluğa HAK EDEN metin. Gerekçesi
       bileşenin kendi künyesinde: dağılımın en sık yanlış okunan üç yanı
       (hedef sanılması, zamanlama sanılması, öncü sanılması) tek paragrafta.
       Cümle olduğu için Title Case değil. */
    analystsNote:
      "Bu beş kova, hisseyi izleyen analistlerin 12 aylık tavsiyesidir; bir fiyat hedefi değildir ve ne zaman sorusunu yanıtlamaz. Tavsiyeler topluca ve geç değişir: dağılım çoğunlukla fiyatın ardından döner, önünden değil.",
    strongBuy: "Güçlü Al",
    buy: "Al",
    hold: "Tut",
    sell: "Sat",
    strongSell: "Güçlü Sat",
    /* Analist kartının dip künyesi — ölçünün altındaki mikro künye,
       başlık değil: cümle düzeninde kalıyor. */
    /* "Al Yönünde": Güçlü Al + Al toplamı. Rozet etiketi olduğu için
       Title Case. "Alım Tarafı" YAZILMADI —
       Türkçe finans dilinde o ifade kurumsal yatırımcıyı (buy-side)
       çağrıştırıyor, burada kastedilen tavsiyenin yönü. */
    analystLeaning: "Al Yönünde",
    analystOne: "Analist",
    analystMany: "Analist",
    analystListingNote:
      "Tavsiyeler şirketin ana kotasyonu ({code}) için toplanmıştır; bu sayfadaki fiyat ABD'de işlem gören payına aittir.",
    companyNews: "Şirket Haberleri",
    pastEarnings: "Geçmiş Bilançolar",
    nextEarnings: "Yaklaşan Bilanço",
    addToWatchlist: "Favorilere Ekle",
    removeFromWatchlist: "Favorilerden Çıkar",
    /* Künye açıklaması ŞABLON. Sabit Türkçe yazılmıştı ve dil ne olursa
       olsun "Fiyat, grafik, bilanço geçmişi ve haberler." gidiyordu — aynı
       fonksiyon sektör etiketini zaten çeviriyor olmasına rağmen.
       `{ad}` şirket adı ya da sembol, `{sektor}` varsa sektör. */
    metaWithSector: "{ad}, {sektor}. Fiyat, grafik, bilanço geçmişi ve haberler.",
    metaPlain: "{ad} hissesi: fiyat, grafik, bilanço geçmişi ve haberler.",
    notFound: "Bu sembol bulunamadı",
    notFoundHint: "Sembolü kontrol et veya arama kutusundan tekrar dene.",
    throttled: "Biraz Yavaşla",
    throttledHint:
      "Kısa sürede çok fazla farklı hisse açtın. Veri sağlayıcılarımızın ücretsiz kotasını korumak için bir dakika beklemen gerekiyor.",
    peers: "Aynı Sektörden Şirketler",
    peersHint: "Alt Sektör",
    fundProfile: "Fon Künyesi",
    fundKind: "Tür",
    fundKindLabel: "Borsa Yatırım Fonu (ETF)",
    fundTracks: "İzlediği Piyasa",
    fundIssuer: "Fon Yöneticisi",
    fundNoteCountry:
      "Bu bir ABD borsa yatırım fonudur; ilgili ülkenin endeksinin kendisi değildir. Dolar cinsinden ve ABD seansında işlem görür. Yerel endeksle aynı yönü gösterir, ama kur farkı ve seans kayması yüzünden yüzdeler birebir tutmaz.",
    fundNoteIndex:
      "Bu bir borsa yatırım fonudur; endeksin kendisi değil, onu izleyen üründür. Fiyatı endeks seviyesinin bir oranıdır, günlük değişimi ise endeksle neredeyse birebir aynıdır.",
    compliance: "Katılım Taraması",
    compliancePass: "Ön Elemeyi Geçiyor",
    complianceReview: "İnceleme Gerekir",
    complianceFail: "Ön Elemeyi Geçemiyor",
    complianceDebt: "Faizli Borç / Piyasa Değeri",
    complianceCash: "Nakit ve Faizli Varlık / Piyasa Değeri",
    complianceLimit: "Sınır",
    complianceUnknown: "Bu şirket için bilanço oranları alınamadı.",
    /* Alt sektör yalnızca endeks tohumundan geliyor; tohumda olmayan
       sembolde faaliyet alanı kriteri hiç çalışmıyor. Eskiden bu sessizdi
       ve kart yine "Ön Elemeyi Geçiyor" diyordu — bkz. lib/compliance.ts
       → `businessKnown`. */
    complianceNoSector:
      "Bu şirketin alt sektörü elimizdeki listede yok; faaliyet alanı ölçütü taranamadı.",
    /* Hisse başı bilanço değerleri ana borsanın parasında, fiyat dolar;
       oran hesaplanmıyor, kur uydurulmuyor. Para birimi kodu JSX'te
       yanına basılıyor. Bkz. lib/compliance.ts → `currency`. */
    complianceForeignCurrency:
      "Şirket bilançosunu dolar dışında bir para birimiyle raporluyor; oranlar dolar fiyatıyla hesaplanamıyor.",
    complianceMissing:
      "Faiz geliri oranı (sınır: gelirin %5'i) ücretsiz veri kaynağımızda yok; bu ölçüt taranamıyor.",
    /* Katlanan bloğun TETİKLEYİCİSİ — en önemli cümle açıkta kalsın diye
       disclaimer'ın ilk cümlesi buraya alındı. */
    complianceNotFatwa: "Bu Bir Fetva Değildir",
    complianceDisclaimer:
      "Faaliyet alanı ve AAOIFI'nin yaygın finansal eşiklerine dayanan otomatik bir ön elemedir; kesin hüküm için bağlı olduğun görüşe ve uzman kurulların denetimine bakmalısın.",
    complianceReasons: {
      banking: "Ana faaliyeti faizli finans (bankacılık, aracılık, ödeme)",
      insurance: "Ana faaliyeti konvansiyonel sigortacılık",
      alcohol: "Alkollü içecek üretimi",
      tobacco: "Tütün ürünleri",
      gambling: "Kumar ve bahis",
      weapons: "Savunma sanayi ve silah",
      adult: "Eğlence içeriği, gelir kırılımı incelenmeli",
      pork: "Gıda üretimi, domuz ürünü içerip içermediği incelenmeli",
    },
  },

  chart: {
    ranges: {
      "1D": "1G",
      "1W": "1H",
      "1M": "1A",
      "3M": "3A",
      "6M": "6A",
      YTD: "YBB",
      "1Y": "1Y",
      "5Y": "5Y",
    },
    rangeLabels: {
      "1D": "Bugün",
      "1W": "Son 1 Hafta",
      "1M": "Son 1 Ay",
      "3M": "Son 3 Ay",
      "6M": "Son 6 Ay",
      YTD: "Yılbaşından Beri",
      "1Y": "Son 1 Yıl",
      "5Y": "Son 5 Yıl",
    },
    area: "Çizgi",
    /* Aralık ve mod düğmeleri sahte `tablist` idi; artık `role="group"` ve
       grubun bir adı olması gerekiyor. */
    rangeGroup: "Grafik Aralığı",
    modeGroup: "Grafik Türü",
    candles: "Mum",
    periodReturn: "Getiri",
    periodHigh: "En Yüksek",
    periodLow: "En Düşük",
    noChartData: "Bu aralık için grafik verisi yok.",
    sessionPre: "Ön Seans",
    sessionRegular: "Seans",
    sessionAfter: "Akşam Seansı",
    sessionOvernight: "Gece",
    sessionOvernightNote: "Gece seansı konsolide veri akışında yok",
  },

  watchlist: {
    title: "Favorilerim",
    subtitle: "Kategorilere ayrılmış takip listelerin",
    newList: "Yeni Liste",
    newListName: "Liste Adı",
    listNamePlaceholder: "Örn. Yapay Zekâ, Yarı İletken, Temettü",
    createList: "Liste Oluştur",
    renameList: "Listeyi Yeniden Adlandır",
    deleteList: "Listeyi Sil",
    /* Satırdaki çöp kutusu YALNIZCA o sembolü çıkarıyor ama etiketi
       "Listeyi Sil"di: ekran okuyucu "Listeyi Sil: NVDA" diyor ve
       kullanıcı tüm listeyi sileceğini sanıyordu. Yıkıcı bir eylemde
       yanlış etiket, ya işlemi hiç yaptırmaz ya da istenmeyeni yaptırır. */
    removeSymbol: "Listeden Çıkar",
    /* Renk seçimi beş `sr-only` radio; etiketleri boştu ve ekran
       okuyucu beşini de ayırt edilemez biçimde okuyordu. */
    colorLegend: "Liste Rengi",
    colorNames: {
      primary: "Mavi",
      brass: "Amber",
      up: "Yeşil",
      down: "Kırmızı",
      flat: "Gri",
    },
    deleteListConfirm:
      "Bu liste ve içindeki tüm semboller silinecek. Devam edilsin mi?",
    addSymbol: "Sembol Ekle",
    symbolPlaceholder: "Sembol ara: örn. NVDA",
    alreadyInList: "Bu sembol listede zaten var",
    empty: "Bu listede henüz sembol yok",
    emptyAll: "Henüz bir takip listen yok.",
    emptyAllHint: "İlk listeni oluştur, sonra izlemek istediğin sembolleri ekle.",
    color: "Renk",
    note: "Not",
    moveUp: "Yukarı Taşı",
    dragHint: "Sürükleyerek sırala",
    moveDown: "Aşağı Taşı",
  },

  ipo: {
    title: "Halka Arz Takvimi",
    window: "Önümüzdeki 6 hafta",
    empty: "Bu aralıkta planlanmış halka arz yok",
    emptyHint: "Sağlayıcı takvimi henüz yeni kayıt yayımlamadı.",
    statusExpected: "Beklenen",
    statusPriced: "Fiyatlandı",
    statusFiled: "Başvuruldu",
    shares: "Adet",
    /* İkinci bir cümle daha vardı ve okuyucuyu "Hisse Senedi ve Likidite
       rehberlerine" yolluyordu — ama DÜZ METİNDİ, tıklanmıyordu; üstelik
       İngilizce karşılığı hiç yazılmamıştı, yani aynı yuvada iki dil iki
       farklı şey söylüyordu. Yönlendirme kaldırılmadı, doğru araca taşındı:
       sayfanın altındaki GuideHint artık halka arz ve likidite rehberlerini
       de gerçek bağlantı olarak basıyor. */
    hint: "Fiyat aralığı ve büyüklük, arz tamamlanana kadar değişebilir; \u201cbeklenen\u201d kayıtlarda tarih de kayabilir.",
  },

  compare: {
    eyebrow: "Yan Yana",
    title: "Karşılaştır",
    subtitle:
      "İkiden dörde kadar hisseyi aynı ölçekte oku: getiri, değerleme ve oynaklık tek tabloda.",
    empty: "Karşılaştırmak için Sembol Seç",
    /* Eski metin ekranı yalanlıyordu: sembol eklemenin yolu bu ekranın
       içinde de var (`CompareAdd`), bir hisse sayfasına gitmek gerekmiyor. */
    emptyHint:
      "Aşağıdaki kutuya sembol ya da şirket adı yaz, ya da hazır setlerden biriyle başla.",
    presets: "Hazır Setler",
    /* BOŞ EKRAN İKİNCİ TUR. "Sembol seç" demek yetmiyordu: hazır setler düz
       birer çipti ("Yarı İletken · NVDA · AMD · AVGO · MU") ve okuyucu bir
       seti seçmeden önce ne alacağını göremiyordu. Setler artık logolu
       kartlar ve her biri NİYE bir arada durduğunu tek satırda söylüyor —
       başlık setin adını veriyordu, sorusunu değil. */
    presetsHint:
      "Her set dört sembolle açılır; istediğini çıkarıp yerine başkasını koyabilirsin.",
    presetChipsNote:
      "Aynı talep döngüsünü paylaşan dört yonga üreticisi; ayrıştıkları yer görünür olur.",
    presetMegaNote:
      "Piyasa değerine göre en büyük dört teknoloji şirketi: endeksteki en ağır isimler.",
    presetIndicesNote:
      "Dört ayrı endeksi izleyen fonlar: piyasanın tamamı, teknoloji, sanayi devleri ve küçük ölçekli şirketler.",
    presetMemory: "Bellek ve Depolama",
    presetMemoryNote:
      "Aynı yapay zekâ talebinden beslenen dört üretici; ikisi ABD dışında işlem görüyor ve tablo bunu künyesinde söylüyor.",
    howTitle: "Nasıl Okunur",
    howScale: "Aynı Ölçek",
    howScaleText:
      "Her seri kendi başlangıç gününe göre yüzdeye çevrilir; hepsi sıfırdan çıkar, fiyat seviyeleri karşılaştırılmaz.",
    howRange: "Tek Aralık",
    howRangeText:
      "Başlıktaki aralık düğmesi grafiği, şeritteki getiriyi ve tablodaki dönem satırını birlikte değiştirir.",
    howGroups: "Dört Grup",
    howGroupsText:
      "Tablo getiri, değerleme, risk ve şirket bilgisi olmak üzere dört grupta okunur.",
    /* ARALIK ARTIK İSTEMCİDE DEĞİŞİYOR. Şeridin sağ sütunu seçili aralığın
       adını taşıyor: sayının hangi pencereye ait olduğu sayının kendi
       üstünde yazıyor, ekranın öteki ucundaki düğmede değil. */
    selected: "Seçilenler",
    dayShort: "Bugün",
    periodColumn: "{range} Getirisi",
    rangeAnnounce: "Aralık {range} olarak değiştirildi",
    /* METİN SEBEBİ DOĞRU SÖYLESİN. Önce "sağlayıcıdan yeni bar gelmedi"
       yazıyordu ama bu hâl oraya hiç düşmüyor: sağlayıcı gerçekten bar
       döndürmediğinde uç `{ok:true, series:[]}` veriyor ve ekran
       `chartMissing` yoluna gidiyor. Buraya yalnızca ağ kopması ya da
       reddedilen istek (429/400) düşüyor. */
    rangeFailed: "Aralık Verisi Alınamadı",
    rangeFailedHint:
      "İstek tamamlanmadı; bağlantını kontrol edip tekrar deneyebilirsin. Ekrandaki öteki ölçüler aralıktan bağımsız, onlar yerinde duruyor.",
    presetChips: "Yarı İletken",
    presetMega: "Mega Ölçek",
    presetIndices: "Endeks Fonları",
    chartTitle: "Dönem Getirisi",
    chartReading: "Ara değerler için grafiğe dokun ya da imleci üzerine getir",
    chartHint:
      "Her seri kendi başlangıcına göre yüzdeye çevrildi; hepsi sıfırdan başlar. Fiyat seviyeleri değil, dönem boyunca üretilen getiri karşılaştırılıyor.",
    metric: "Metrik",
    dayChange: "Günlük Değişim",
    periodChange: "Dönem Getirisi",
    range52: "52 Hafta Aralığı",
    homeCurrencyNote:
      "{symbols} ana borsasında {codes} cinsinden işlem görüyor: hisse başı kâr, 52 hafta bandı ve F/K oranı o borsadan geliyor, fiyat satırı ise ADR'nin doları. İki ölçü doğrudan karşılaştırılamaz.",
    /* Sözcük sırası dile bağlı; birleştirme İngilizcede "NVDA Remove From
       List" üretiyordu. Kalıp tam cümle, yer tutucu sözlükte. */
    remove: "{symbol} Sembolünü Listeden Çıkar",
    partialPeriod: "Kısmi Dönem",
    addSymbol: "Sembol Ekle",
    addPlaceholder: "Sembol ya da şirket adı",
    addCta: "Karşılaştır",
    trimmedNote:
      "Bağlantıdaki fazladan semboller alınmadı. Bu ekran en çok dört sembol gösterir.",
    unknownSymbols:
      "{symbols} için veri bulunamadı; o sütun boş kalıyor.",
    rangeLabel: "Grafik Aralığı",
    chartMissing: "Grafik Verisi Alınamadı",
    chartMissingHint:
      "Sağlayıcı bu semboller için bar döndürmedi; dönem getirisi satırı da bu yüzden boş.",
    tableRegion: "Karşılaştırma Tablosu",
    secondSymbolHint:
      "Tek seri kendi başlangıcına göre yüzdeye çevrildiği için sıfırdan çıkan bir çizgiden başka bir şey söylemiyor.",
    fullHint: "Sınır dört sembol; birini çıkarınca yenisini ekleyebilirsin.",
    dividendNone: "Ödemiyor",
    metricsUnavailable:
      "{symbols} için ölçü verisi alınamadı: F/K, temettü, beta ve 52 hafta bandı o sütunda boş.",
    quotesUnavailable: "Kotasyonlar alınamadı; fiyat ve günlük değişim boş.",
    groupReturn: "Getiri",
    groupValuation: "Değerleme",
    groupRisk: "Risk",
    groupCompany: "Şirket",
    netMargin: "Net Kâr Marjı",
    sector: "Sektör",
    compareFirstFour: "İlk Dördünü Karşılaştır",
  },

  markets: {
    fearTitle: "Korku Endeksi",
    fearHint:
      "VIX, S&P 500 opsiyonlarından türetilir ve piyasanın önümüzdeki 30 gün için beklediği oynaklığı gösterir. Yön söylemez; yalnızca hareketin ne kadar büyük beklendiğini söyler.",
    fearAverage: "Uzun Dönem Ort. ~20",
    fearGuideCta: "Volatilite Nedir?",
    fearCalm: "Sakin",
    fearNormal: "Normal",
    fearTense: "Tedirgin",
    fearHigh: "Gergin",
    fearPanic: "Panik",
    title: "Piyasalar",
    subtitle: "Endeksler, tahvil faizleri ve gün içi hareket: piyasanın nabzı",
    yields: "ABD Tahvil Faizleri",
    yieldY2: "2 Yıllık",
    yieldY5: "5 Yıllık",
    yieldY10: "10 Yıllık",
    yieldY30: "30 Yıllık",
    point: "Puan",
    curveTitle: "Getiri Eğrisi (10 Yıllık − 2 Yıllık)",
    curveNormal: "Normal Eğri",
    curveInverted: "Ters Eğri",
    curveHint:
      "Uzun vadeli tahvilin faizi kısa vadeliden yüksekse eğri normaldir; ekonomi olağan seyrinde demektir. Fark eksiye dönerse (ters eğri) piyasa yakın vadede faiz indirimi bekliyor; tarihsel olarak durgunluğun en çok izlenen habercisidir.",
    breadth: "Piyasa Genişliği",
    advancing: "Artıda",
    declining: "Ekside",
    unchanged: "Yatay",
    topGainers: "Günün En Çok Artanları",
    topLosers: "Günün En Çok Düşenleri",
    contribution: "Katkı",
    contributionHint:
      "Katkı, hissenin bugün endeksi kaç puan yukarı ya da aşağı taşıdığını gösterir. Dow fiyat ağırlıklı bir endekstir: her hissenin dolar bazındaki değişimi endeksin bölenine oranlanarak hesaplanır.",
    constituents: "Endeks Bileşenleri",
    asOf: "Liste Kompozisyonu",
  },

  news: {
    title: "Haberler",
    subtitle: "Piyasa ve şirket haberleri",
    all: "Tümü",
    general: "Genel",
    empty: "Şu an gösterilecek haber yok.",
    readAtSource: "Kaynakta Oku",
    translated: "Türkçeye Çevrildi",
    notFound: "Haber bulunamadı",
    notFoundHint: "Bu haber kaldırılmış olabilir.",
    relatedSymbols: "Haberde Geçen Şirketler",
    related: "Benzer Haberler",
    fullStoryTitle: "Haberin Tamamı Kaynağında",
    fullStoryHint:
      "Burada gördüğün özet, haber sağlayıcısından geliyor; metnin devamı yayıncının sitesinde",
    neutral: "Nötr",
  },

  brief: {
    title: "Günlük Bülten",
    subtitle: "Her sabah hazırlanan piyasa özeti · geçmiş günler arşivde",
    archiveLink: "Geçmiş Bültenler",
    archiveTitle: "Arşiv",
    empty: "Bu güne ait bülten bulunamadı.",
    emptyHint: "Bülten her sabah hazırlanır; hafta sonu ve tatillerde olmayabilir.",
    noArchive: "Henüz arşivlenmiş bülten yok.",
    today: "Bugün",
    thisWeek: "Bu Hafta",
    periodDaily: "Günlük",
    /* Sayfa başlığı ile SEKME adı ayrı: sekmede "Haftalık" doğru (yanında
       "Günlük" duruyor, tamlama gereksiz), sayfa başlığında ise çıplak bir
       sıfat kalıyordu — günlük görünüm "Günlük Bülten" derken haftalık
       görünüm yalnızca "Haftalık" diyordu. */
    periodWeekly: "Haftalık",
    weeklyTitle: "Haftalık Bülten",
    /* Haftalık bülten iki soruyu birlikte cevaplıyor ve bu, ekranda
       söylenmezse anlaşılmıyor: kayıt biten haftanın adına açılıyor ama
       içinde önümüzdeki haftanın takvimi de var. */
    weeklySubtitle:
      "Her pazartesi hazırlanan hafta değerlendirmesi · geçen hafta ne oldu, bu hafta ne var",
    weeklyFrame: "Geçen Hafta Ne Oldu · Bu Hafta Ne Var",
    weeklyRange: "{start} - {end}",
    weeklyNotForecast:
      "Bu hafta bölümü bir takvimdir, tahmin değil: neyin açıklanacağını söyler, ne çıkacağını değil.",
    writtenBy: "Hazırlayan",
    byClaude: "Claude",
    byRules: "Kural Tabanlı",
    /* Bülten henüz bu dile çevrilmediyse orijinal gösterilir; not bunu söyler. */
    fallbackNote:
      "Bu bülten henüz Türkçeye çevrilmedi; orijinal diliyle gösteriliyor.",
  },

  guide: {
    title: "Rehber",
    eyebrow: "Kavramlar",
    subtitle:
      "Piyasada sürekli duyduğun kavramlar: tanımı, örneği ve nerede işine yaradığı.",
    allTopics: "Tümü",
    readMinutes: "Dk Okuma",
    related: "Bunları da Oku",
    backToList: "Rehbere Dön",
    empty: "Bu başlıkta henüz yazı yok.",
    cardCta: "Oku",
    /* "Yalnızca Bunlar" Türkçede kurulmayan bir kalıptı — işaret zamiri
       neyi gösterdiğini söylemiyordu. Bağlantı konunun kendi sayfasını
       açıyor; adı da onu söylüyor. */
    /* Bir dönem "mikro künye, cümle düzeninde" diye muaf tutuluyordu.
       CLAUDE.md o muafiyeti gerekçesiyle geri aldı: aynı ekranda Title Case
       bir rozetin altında küçük harfle başlayan bir künye duruyordu ve sonuç
       tutarsızlıktı. Cümle olmayan her metin Title Case. */
    curriculumRange: "Müfredatın {from}-{to}. Yazısı",
    onlyThis: "Konuyu Aç",
    /* Müfredat şeridi — liste sayfasının girişindeki dört konu karosu. */
    curriculum: "Nereden Başlamalı",
    /* Şeridin başlığı "Nereden Başlamalı" diyordu ama sayfada başlamayı
       tek tuşla mümkün kılan hiçbir şey yoktu. */
    startFirst: "Baştan Başla",
    curriculumHint:
      "Dört konu bloğu kolaydan zora sıralı; hiç bilmeyen biri baştan sona bir müfredat gibi okuyabilir.",
    articleOne: "Yazı",
    articleMany: "Yazı",
    prevArticle: "Önceki Yazı",
    nextArticle: "Sıradaki Yazı",
    contextLabel: "Bunu Anlamak İçin",
  },

  stories: {
    title: "Mercek",
    eyebrow: "Mercek Altında",
    subtitle:
      "Piyasada yaşanan olayları yakından anlatan uzun yazılar: ne oldu, neden oldu, ne öğretti.",
    latest: "Son Yazı",
    archive: "Önceki Yazılar",
    /* Sayaç `companies.showing`den ödünç alınıyordu ve "25 şirketin 24
       tanesi" yazıyordu — burada sayılan şirket değil YAZI. */
    showing: "{total} yazının {n} tanesi",
    showMore: "Daha Fazla Göster",
    /* Sayfanın kendini tanıttığı bant — "Mercek" adı tek başına burada ne
       yazıldığını söylemiyor ve liste haber akışından ayırt edilemiyordu. */
    whatShort: "altı ay sonra da merak edilecek olaylar",
    howShort: "doğrulanmış rakamlar, künyede kaynaklar",
    rhythmShort: "her gün değil, olay olduğunda",
    whatTitle: "Ne Yazılır",
    howTitle: "Nasıl Yazılır",
    rhythmTitle: "Ne Sıklıkla",
    bridge: "Günlük haber akışı ve kavram anlatımları ayrı bölümlerde:",
    moreCompaniesOne: "+{count} Şirket Daha",
    moreCompaniesMany: "+{count} Şirket Daha",
    sinceEvent: "Olaydan Bugüne",
    /* Hisse sayfasındaki blok. Kardeş panelle (analysis.symbolPanelTitle)
       aynı kural: şirketin içindesin, adını başlıkta tekrar etme. Ama tür
       adıyla söylensin — yalın "Mercek" bloğun ne listelediğini
       söylemiyordu. */
    symbolPanelTitle: "Mercek Yazıları",
    symbolPanelAll: "Tüm Yazılar →",
    symbolPanelCountOne: "{count} Yazı",
    symbolPanelCountMany: "{count} Yazı",
    filterLabel: "Şirkete Göre",
    filterAll: "Tümü",
    emptyFilter: "Bu şirket hakkında henüz yazı yok.",
    sources: "Kaynaklar",
    relatedSymbols: "Yazıda Geçen Şirketler",
    eventDate: "Olay Tarihi",
    readMinutes: "Dk Okuma",
    backToList: "Mercek'e Dön",
    moreStories: "Arşivden Diğer Yazılar",
    empty: "Henüz yayımlanmış yazı yok.",
    emptyHint:
      "Piyasada anlatmaya değer bir olay yaşandığında burada mercek altına alınır.",
    notFound: "Yazı bulunamadı",
    notFoundHint: "Bağlantı eski olabilir; listeden tekrar dene.",
    /* Yazı henüz bu dile çevrilmediyse orijinal gösterilir; bu not onu söyler. */
    fallbackNote:
      "Bu yazı henüz Türkçeye çevrilmedi; orijinal diliyle gösteriliyor.",
    disclaimer:
      "Bu yazı yayımlandığı tarihteki kamuya açık haber kaynaklarına dayanır. Yatırım Tavsiyesi Değildir.",
  },

  macro: {
    title: "Makro Göstergeler",
    subtitle: "Enflasyon, istihdam ve faiz verileri",
    previous: "Önceki",
    nextRelease: "Sonraki Açıklama",
    noNextRelease: "Henüz açıklanmadı",
    unchanged: "Değişmedi",
  },

  auth: {
    signInTitle: "Giriş Yap",
    /* Başlık markanın kendi cümlesi. Bir dönem "Sabah Altı Sekmeye Bakmayı
       Bırak" yazıyordu: ürünün ne olduğunu değil, kullanıcının neyi
       bırakması gerektiğini anlatan, herhangi bir SaaS'a yapıştırılabilecek
       bir cümleydi ve sitenin adıyla hiç konuşmuyordu. Zil bu ürünün
       merkezindeki nesne — ana sayfanın en büyük sayısı ona geri sayıyor. */
    pitchTitle: "Zil Çalmadan Önce Hazır Ol",
    /* KISA CÜMLELER. Tek uzun cümle ve bir uzun tire vardı; vurgu
       dağılıyordu. Dört kısa cümle her iddiayı tek başına bırakıyor. */
    pitchBody:
      "Bugün ne açıklanacak, kim bilanço verecek, takip ettiklerin nerede duruyor. Hepsi tek ekranda, Türkiye saatiyle. Okumak için hesap gerekmiyor. Hesap açarsan listelerin seninle kalır.",
    /* "Takip listen, notlarınla birlikte" diyordu ve NOT DİYE BİR ŞEY YOK:
       şemada sütun duruyor (`symbols`e bağlı `note`), yazan-okuyan arayüz
       hiç yazılmadı. Hesap açmaya ikna etmesi gereken sayfa olmayan bir
       özelliği vadediyordu. Not eklememe kararı verildi; vaat, hesabın
       gerçekten verdiği şeyle değiştirildi: listeler cihazlar arasında
       taşınıyor ve takip edilenlerin bilançoları ayrı sekmede toplanıyor
       (/bilancolar/takip). */
    featureLists: "Takip listelerin her cihazda seninle",
    featureAlerts: "Takip ettiklerinin bilançoları tek sekmede, saatleriyle",
    /* Manşetle aynı imgeyi kullanıyor: "Zil Çalmadan Önce Hazır Ol". */
    featureBrief: "Her sabah, zil çalmadan önce yazılmış bülten",
    featureFree: "Reklamsız ve ücretsiz",
    privacyNote:
      "Reklam yok, veri satışı yok. Hesabını yalnızca listelerini saklamak için kullanırız.",
    signInSubtitle: "Takip listelerine dönmek için giriş yap.",
    signUpTitle: "Hesap Oluştur",
    signUpSubtitle: "Kendi takip listeni kurmak için hesap aç.",
    username: "Kullanıcı Adı",
    /* Yer tutucu etiketin Title Case kopyasıydı ve hiçbir bilgi
       katmıyordu — üstelik yer tutucu bir başlık değil, beklenen biçimi
       gösteren bir örnek. İngilizcesi zaten öyle yapıyor ("username"). */
    usernamePlaceholder: "kullaniciadi",
    /* GİRİŞTE iki kapı da açık: `authorize` kullanıcı adı ya da e-posta ile
       eşleştiriyor. Alan etiketi bunu söylemezse ikinci kapı görünmez
       kalır — kullanıcı adını unutan biri hesabını kaybetmiş sanır. */
    identifier: "Kullanıcı Adı veya E-posta",
    identifierPlaceholder: "Kullanıcı adın ya da e-postan",
    email: "E-posta",
    emailPlaceholder: "ornek@eposta.com",
    password: "Şifre",
    passwordPlaceholder: "En az 8 karakter",
    passwordConfirm: "Şifre Tekrar",
    submitSignIn: "Giriş Yap",
    submitSignUp: "Hesap Oluştur",
    noAccount: "Hesabın yok mu?",
    hasAccount: "Zaten hesabın var mı?",
    errors: {
      invalidCredentials: "Bilgiler hatalı. Kullanıcı adını, e-postanı ve şifreni kontrol et.",
      usernameTaken: "Bu kullanıcı adı alınmış.",
      emailTaken:
        "Bu bilgilerle hesap açılamadı. Zaten bir hesabın varsa giriş yap.",
      usernameFormat:
        "Kullanıcı adı 3-20 karakter olmalı; harf, rakam, alt çizgi kullanabilirsin.",
      passwordLength: "Şifre en az 8 karakter olmalı.",
      passwordTooLong: "Şifre en fazla 72 karakter olabilir.",
      passwordWeak: "Şifren kullanıcı adını ya da e-postanı içermemeli.",
      passwordMismatch: "Şifreler eşleşmiyor.",
      emailFormat: "Geçerli bir e-posta adresi gir.",
      generic: "Giriş yapılamadı. Tekrar dene.",
      tooManyAttempts:
        "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.",
    },
  },

  settings: {
    title: "Ayarlar",
    language: "Dil",
    theme: "Tema",
    themeLight: "Açık",
    themeDark: "Koyu",
    account: "Hesap",
    privacyTitle: "Verilerin",
    privacyHint:
      "Hangi verini neden sakladığımız, nereye gittiği ve haklarının tamamı KVKK sayfasında yazılı.",
    privacyLink: "KVKK ve Gizlilik Metni",
    deleteTitle: "Hesabı Sil",
    deleteHint:
      "Hesabın ve bütün takip listelerin kalıcı olarak silinir. Bu işlem geri alınamaz.",
    deleteOpen: "Hesabımı Sil",
    deleteConfirmLabel: "Onay",
    deleteConfirmHint: "Silmek için kullanıcı adını yaz:",
    deleteSubmit: "Kalıcı Olarak Sil",
    deleteWarning:
      "Bu işlem geri alınamaz. Hesabın, takip listelerin ve listelerdeki notların veritabanından silinir.",
    deleteNotSignedIn: "Oturum bulunamadı. Tekrar giriş yap.",
    deleteConfirmMismatch: "Kullanıcı adı eşleşmedi.",
    deleteWrongPassword: "Şifre hatalı.",
    deleteTooMany: "Çok fazla deneme. Biraz bekleyip tekrar dene.",
  },

  legal: {
    eyebrow: "Yasal",
    privacyTitle: "KVKK Aydınlatma Metni ve Gizlilik",
    disclaimerEyebrow: "Sorumluluk Reddi",
    disclaimerTitle: "Bu Site Ne Değildir",
    updatedAt: "Son güncelleme:",
    manageAccount: "Hesap Ayarlarına Git",
    contact: "Başvuru ve İletişim",
  },

  menu: {
    eyebrow: "Tüm Bölümler",
    title: "Menü",
    subtitle:
      "Ürünün bütün ekranları burada. Alt çubukta yer olmayan bölümlere de tek dokunuşla ulaşırsın.",
    groupMarket: "Piyasa",
    groupRead: "Okuma",
    groupAccount: "Hesap ve Site",
    guestTitle: "Misafir",
    guestHint: "Takip listesi tutmak için hesap açman yeterli.",
    signedInHint: "Listelerin bu hesapta saklanıyor.",
    /* Menü satırlarının altındaki mikro etiketler Title Case. Bunlar cümle
       değil, satırın ne olduğunu söyleyen ADLAR — "Endeksler, Tahviller,
       Sektörler". Bağlaçlar (ve/and) küçük kalır. */
    hintMarkets: "Endeksler, Tahviller, Sektörler",
    hintCompanies: "Şirket Dizini ve Arama",
    hintMacro: "TÜFE, İstihdam, Faiz",
    hintEarnings: "Bilanço Takvimi ve Beklentiler",
    hintCalendar: "Ekonomik Veri Takvimi",
    hintCompare: "Hisseleri Yan Yana Oku",
    hintGuide: "Kavramları Anlatan Yazılar",
    hintStories: "Piyasada Yaşananların Uzun Anlatımı",
    hintNews: "Çevrilmiş Piyasa Haberleri",
    hintBrief: "Günlük ve Haftalık Bülten Arşivi",
    hintWatchlist: "Takip Listelerin",
    hintSettings: "Hesap, Tema ve Dil",
    hintPrivacy: "Verilerin ve Haklarının Tamamı",
  },

  footer: {
    blurb:
      "ABD borsalarını Türkçe takip etmek için yapılmış kişisel bir proje. Ücretsiz, reklamsız ve açık kaynak.",
    feed: "RSS",
    sectionMarket: "Piyasa",
    sectionRead: "Okuma",
    sectionAccount: "Hesap",
    briefArchive: "Bülten Arşivi",
    privacy: "KVKK ve Gizlilik",
    builtBy: "Ahmet Akyapı",
    copyright: "© 2026 Açılış Zili",
    disclaimer: "Yatırım Tavsiyesi Değildir",
  },

  errors: {
    notFoundTitle: "Bu Sayfa Bulunamadı",
    notFoundHint:
      "Bağlantı eski olabilir ya da adres yanlış yazılmış olabilir. Aradığın şey büyük ihtimalle hâlâ sitede.",
    shortcuts: "Kısayollar",
    searchHint: "Sembol aramak için üstteki arama kutusunu kullan.",
  },

  data: {
    stale: "Bu veri güncel olmayabilir",
    failed: "Veri alınamadı",
    /* İkinci cümle "Son bilinen değer gösteriliyor." idi ve YANLIŞTI:
       `DataError` yalnızca `!result.ok` dalında çiziliyor, yani ekranda hiçbir
       değer YOK — kart boş. Okuyucuya gördüğü sayının eski olduğunu söylemek
       ile hiç sayı olmadığını söylemek farklı iki şey; birincisi de zaten
       ayrı bir anahtarda yazılı (`stale`). */
    failedHint: "Sağlayıcıya ulaşılamıyor; bu kart şimdilik boş.",
    delayedNote:
      "Fiyatlar konsolide veri akışından (SIP) gelir ve 15 dakika gecikmelidir. Gün içi hacim, açılış-en yüksek-en düşük ve önceki kapanış bütün borsaların toplamıdır.",
    /* Kaynak adları SÖZLÜKTE: "önbellek" ve "takvim" sabit bir tablodan
       geliyordu ve İngilizce sitede de Türkçe basılıyordu. */
    delayed: "15 Dakika Gecikmeli",
    /* Seans dışında listelerdeki değişim sütununun künyesi.
       Konsolide tape'e geçtikten sonra açılış öncesi işlemler akıyor ama
       her sembol her sabah işlem görmüyor: gören sembol bu sabahın
       hareketini, görmeyen son kapanışın hareketini gösteriyor. İkisi de
       "son işleme göre değişim" ama referans günleri farklı — satır satır
       aynı sütunda durduklarında bunu söylemek gerekiyor. */
    extendedNote: "Seans Dışı: Değişim Her Sembolün Son İşlemine Göre",
    sourceCache: "Önbellek",
    sourceSeed: "Takvim",
    /* CÜMLE TAM YAZILIYOR, parça parça birleştirilmiyor. Damga
       "{saat} {kelime}" sırasıyla kuruluyordu; Türkçede doğru ama İngilizcede
       "5:05 PM updated" çıkıyordu — sözcük sırası dile ait, bu yüzden yer
       tutuculu tam cümle. */
    updatedAt: "{time} Güncellendi",
    mayBeStale: "Güncel Olmayabilir",
  },
};

export default tr;
