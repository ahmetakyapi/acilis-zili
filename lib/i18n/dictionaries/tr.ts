import { datePickerTr } from "./date-picker";

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
    taxTool: "Vergi Hesaplayıcı",
    themes: "Temalar",
    moreGroupData: "Veri ve Araçlar",
    moreGroupLearn: "Öğren",
    moreGroupRead: "Oku",
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
    /* Şeritteki ad. EN kısa ("Technicals"), TR tam ad: "Teknik" tek başına
       neyin tekniği olduğunu söylemiyordu ve TR aralığı buna yetiyor. */
    technical: "Teknik Analiz",
    // Mobil alt çubuk etiketleri — 64px sekmede tam sığar.
    earningsShort: "Bilanço",
    marketsShort: "Piyasa",
    settings: "Ayarlar",
    search: "Ara",
    searchPlaceholder: "Hisse ara: sembol veya şirket adı",
    searchTrigger: "Sembol veya Olay Ara",
    searchPopular: "Popüler",
    searchRecent: "Son Aramalar",
    searchWritings: "Yazılar",
    /* Arama ucu 429 döndüğünde. Eskiden bu durum "sonuç yok" gibi
       görünüyordu: aradığı şirket sitede duruyorken kullanıcıya olgusal
       olarak yanlış bilgi veriliyordu. */
    searchRateLimited: "Çok hızlı arıyorsun. {saniye} sn sonra tekrar dene.",
    searchFailed: "Arama şu an yapılamadı. Tekrar dene.",
    searchHintMove: "Gez",
    searchHintOpen: "Aç",
    menu: "Menü",
    /* Masaüstü şeridinin sonundaki açılır liste. "Menü" DEĞİL: o ad mobilde
       ürünün tamamını açan dizinin adı; bu liste yalnızca şeritte olmayan
       dört ekranı taşıyor. */
    more: "Daha Fazla",
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
    scrollPrev: "Geri Kaydır",
    scrollNext: "İleri Kaydır",
    loading: "Yükleniyor",
    submitting: "Gönderiliyor…",
    error: "Bir sorun oluştu",
    retry: "Tekrar Dene",
    noData: "Veri Yok",
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
    /* Yazı olmayan ekranların paneli (`PageShare`). */
    pageTitle: "Bu Sayfayı Paylaş",
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
    // Yarım gün: kapanış zili 13:00 ET. Takvim şeridi ve ana sayfanın zil künyesi aynı kelimeyi kullanıyor.
    earlyClose: "Erken Kapanış",
    /* Bu seansa ait işlem yoksa yüzde bir önceki seansı anlatıyor; ana
       sayfanın dünya ve endeks satırları bunu künyeyle söylüyor. */
    lastClose: "Son Kapanış",
  },

  directory: {
    sectorPreview: "Dizinin En Geniş Sektörleri",
    earningsActivity: "Takvim Yoğunluğu",
    earningsBusiest: "En Yoğun Gün",
    reportsCount: "{n} Bilanço",
    reportsCountOne: "{n} Bilanço",
    marketLeaders: "Piyasanın Devleri",
    leadersByCap: "Piyasa Değerine Göre",
    selectCompany: "Bir Şirket Seç",
    exploreCompanies: "Şirketleri Keşfet",
    openCompany: "Şirketi İncele",
    earningsRadar: "Takvimde Öne Çıkanlar",

    companiesEyebrow: "ABD Piyasalarının Şirketleri",
    earningsEyebrow: "Finansal Sonuçlar ve Beklentiler",
    companyCount: "Dizindeki Şirket",
    sectorCount: "Sektör Grubu",
    sectorDistribution: "Sektörlere Bir Bakış",
    distributionUnit: "Şirket Sayısı",
    reportingRhythm: "Önümüzdeki 7 Gün",
    scheduledReports: "Takvimdeki Bilanço",
    followedCompanies: "Takip Edilen Şirket",
    publishedAnalyses: "Yayımlanmış Analiz",
    reportingDays: "Açıklama Günü",
    analysisDescription: "Gerçekleşen sonuçlar, piyasanın beklentileri ve bir sonraki çeyreğe bakış.",
  },

  dayFlow: {
    /* Sonuç bildiriminin (8-K / 2.02) künyesi: "SEC Bildirimi · 23:02 TR". */
    secFiling: "SEC Bildirimi",
    marketDay: "Piyasa Günü",
    timelineHint: "Sonuç ve analiz için bir olay seç.",

    auto: "Otomatik Güncelleme",
    checked: "Son Kontrol",
    updating: "Kontrol Ediliyor",
    retry: "Yeniden Dene",
    offline: "Güncelleme Bekleniyor",
    scheduled: "Planlandı",
    awaiting: "Sonuç Bekleniyor",
    released: "Açıklandı",
    analyzed: "Analiz Hazır",
    partial: "Sonuçlar Geliyor",
    actual: "Gerçekleşen",
    forecast: "Beklenti",
    previous: "Önceki",
    readAnalysis: "Analizi Oku",
    viewCompany: "Şirkete Git",
    calendar: "Takvimde Gör",
    calendarSource: "Ekonomik Takvim",
    timeUnknown: "Saat Belirtilmedi",
    economic: "Ekonomik Veri",
    earnings: "Bilanço",
    emptyTitle: "Bugün Planlanmış Açıklama Yok",
    emptyHint: "Yeni veri ve bilanço kayıtları geldiğinde bu akış kendiliğinden güncellenir.",
    // Akış 50 milyar doların altındaki bilançoları göstermiyor; o gün yalnız onlar varsa "açıklama yok" yanlış olurdu.
    emptyMajorTitle: "Büyük Bir Açıklama Yok",
    emptyMajorHint: "Bugün {count} şirket bilanço açıklıyor; akış yalnızca büyük ve takip edilen şirketleri gösterir.",
    emptyMajorLink: "Bilanço Takvimi",
    selectEvent: "Olay ayrıntılarını göster",
    events: "Günün Olayları",
    next: "Sonraki Olaylar",
    back: "Önceki Olaylar",
    source: "Kaynak",
    revenue: "Gelir",
    eps: "Hisse Başına Kâr",
    // Bilanço satırının ölçüleri: açıklanmadan önce beklenti, sonra sürpriz.
    revenueEstimate: "Gelir Beklentisi",
    epsEstimate: "Hisse Başına Kâr Beklentisi",
    surprise: "Beklentiye Göre",
    beat: "Beklentiyi Aştı",
    miss: "Beklentinin Altında",
    inline: "Beklentiye Eşit",
    scheduledHint: "Açıklandığında sonuçlar burada güncellenir.",
    pendingHint: "Açıklama saatinin gelmesi sonucun yayımlandığı anlamına gelmez. Kaynak verisi bekleniyor.",
    analyzedHint: "Yayımlanan bilanço analizine şirketin yanındaki bağlantıdan ulaşabilirsin.",
    liveNote: "30 Saniyede Bir Kontrol",
    closed: "Seans Kapalı",
    updatedAnnouncement: "Günün akışı güncellendi.",
    sourceDelayed: "Kaynak Güncellemesi Bekleniyor",

    /* AÇIKLAMA CÜMLELERİ — "bu da ne?" sorusunun cevabı.
       Başlıklar olayın ADINI söylüyor ama adı bilmeyene bir şey anlatmıyor:
       "FOMC" ile "Nokta Grafiği" okuyucunun yarısına hiçbir şey ifade etmez.
       Anahtar tarihi atılmış slug, yani cümle olay TÜRÜ başına yazılıyor ve
       her tekrarında aynısı görünüyor. Cümleler kısa ve tanım niteliğinde:
       ne olduğu, kimin açıkladığı ve niye izlendiği. Tahmin ya da yorum YOK —
       "faizler düşebilir" demek yatırım tavsiyesi olurdu. */
    notes: {
      "fomc-rate": "ABD merkez bankası Fed'in politika faizini belirlediği toplantının sonucu. Yılda sekiz kez açıklanır ve borçlanma maliyetini doğrudan değiştirdiği için piyasanın en yakından izlediği başlıktır.",
      "fomc-sep": "Fed üyelerinin önümüzdeki yıllar için faiz, büyüme, enflasyon ve işsizlik tahminleri. Her üyenin faiz beklentisi grafikte bir nokta olduğu için \u201cnokta grafiği\u201d deniyor: noktaların nerede toplandığı Fed'in yönü hakkında fikir verir. Yılda dört kez yayımlanır.",
      "fomc-presser": "Faiz kararının ardından Fed Başkanı'nın soruları yanıtladığı toplantı. Kararın metninde yer almayan gerekçeler burada söylendiği için piyasa çoğu zaman karara değil bu toplantıya tepki verir.",
      "nfp": "ABD'de bir ayda tarım dışı sektörlerde işe alınan ve işten çıkarılan kişilerin net farkı. İstihdamın gücünü gösterdiği için Fed'in faiz kararlarında baktığı iki veriden biridir.",
      "cpi": "Tüketici Fiyat Endeksi: hanelerin aldığı mal ve hizmetlerin fiyatlarındaki değişim, yani enflasyon. Fed'in faiz kararlarında baktığı öteki veri budur.",
      "core-cpi": "TÜFE'nin gıda ve enerji hariç hesaplanmış hâli. Bu iki kalem hava koşulu ve petrol fiyatıyla sert oynadığı için çıkarılır; kalan sayı enflasyonun kalıcı eğilimini daha iyi gösterir.",
      "unemployment": "İş arayan ama iş bulamayanların iş gücüne oranı. Tarım dışı istihdamla aynı raporda açıklanır ve iş gücü piyasasının soğuyup soğumadığını gösterir.",
      "jobless-claims": "O hafta ilk kez işsizlik maaşı başvurusu yapan kişi sayısı. Haftalık yayımlandığı için iş gücü piyasasındaki bozulmayı aylık verilerden önce haber verir.",
    },

    /* Kaynak adları — ham sağlayıcı anahtarı ekrana basılmaz. Panelde
       "Kaynak: federalreserve" yazıyordu; bu bir veri tabanı değeri, okuyucuya
       söylenecek bir ad değil. Listede olmayan kaynak olduğu gibi yazılır. */
    issuers: {
      federalreserve: "Fed",
      "bls-rule": "ABD İstatistik Bürosu (BLS)",
      "bls-schedule": "ABD İstatistik Bürosu (BLS)",
      "dol-rule": "ABD Çalışma Bakanlığı",
    },
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
    countdownOpen: "Açılış Ziline Kalan",
    countdownClose: "Kapanış Ziline Kalan",
    countdownDays: "Gün",
    countdownHours: "Saat",
    countdownMinutes: "Dakika",
    countdownSeconds: "Saniye",
    countdownDescription: "Bir sonraki zile hazırlan. Gündem, şirketler ve bilançolar bir arada.",
    flowTimeline: "Zaman Çizgisi",
    experienceEyebrow: "ABD Piyasalarına Açılan Penceren",
    experienceHeading: "Piyasanın Ritmini",
    experienceHeadingAccent: "Yakala.",
    experienceDescription: "Endekslerden şirketlere, bilançolardan büyük resme. Piyasayı hareket ettiren her şey, tek yerde.",
    experienceClock: "New York Saati",
    experienceOverview: "Piyasa Özeti",
    experienceReading: "Gündemi Oku",
    experienceReports: "Bilançolar",
    experienceNews: "Haber Akışı",
    experienceIndexNote: "ABD Endekslerini İzleyen Fonlar",
    experienceFlowNote: "Veriler, bilançolar ve seansın dönüm noktaları.",
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
    dayMoversClosed: "Son Kapanışın Hareketleri",
    dayMoversNote: "{n} endeks üyesi tarandı · seans içi",
    dayMoversClosedNote: "{n} endeks üyesi tarandı · son kapanışa göre",
    dayMoversEmpty: "Sıralama için yeterli fiyat verisi yok.",

    schedule: "Bugünün Takvimi",
    scheduleEmpty: "Bugün için planlanmış ekonomik veri yok.",
    earningsToday: "Bugün Bilanço Açıklayanlar",
    earningsOn: "{day} Bilanço Açıklayanlar",
    /* Başlığın yanındaki sayaç: bugün kaç şirket açıklıyor ve kaçı
       listede. Listede piyasa değerine göre en büyük sekizi var.
       "TANESİ" — İYELİK EKİ YAZILAMAZ. Kalıp bir dönem "{n}'i" idi ve
       Türkçede o ek sayının son hecesine göre değişiyor: 3'ü, 6'sı, 7'si,
       9'u. Sekiz olası değerin beşi yanlış çıkıyordu. "tanesi" her sayıyla
       çalışıyor ve aynı çözüm arşiv sayacında (`stories.showing`) zaten
       kullanılıyor. */
    earningsCount: "{total} şirketin {n} tanesi",
    watchlistSummary: "Favorilerin",
    /* Ana sayfanın portföy özeti (28 Eylül) — Mercek seçkisinin altında. */
    portfolioSummary: "Portföyün",
    portfolioValue: "Toplam Değer",
    portfolioPnlUsd: "Dolar K/Z",
    portfolioPnlTl: "Lira K/Z",
    portfolioWeights: "Dağılım",
    portfolioOther: "Diğer",
    portfolioPositions: "{n} Pozisyon",
    portfolioPositionsOne: "{n} Pozisyon",
    portfolioPartial: "Bazı pozisyonların fiyatı ya da kuru alınamadı; toplam kısmi.",
    portfolioAria: "{symbol}, portföydeki pay: yüzde {pct}",
    watchlistEmpty: "Henüz favori eklemedin.",
    // Ana sayfadaki "son yazılanlar" bloğu
    /* "Son Analizler" ne analizi olduğunu söylemiyordu: ana sayfada
       yanında mercek yazıları ve haberler duruyor, üçü de birer
       "analiz" sayılabilir. Başlık artık türü adıyla söylüyor. */
    latestAnalyses: "Son Bilanço Analizleri",
    latestStories: "Son Mercek Yazıları",
    allStories: "Tüm Mercek Yazıları",
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
    sourceNote: "Endeksler ETF üzerinden izlenir · seans içinde fiyat gerçek zamanlı (IEX), hacim ve seans dışı 15 dakika gecikmeli",
    // Kahramanın zil künyesi: hangi zile sayıldığı ve bir sonraki zil.
    bellOpen: "Açılış Zili",
    bellClose: "Kapanış Zili",
    nextOpen: "Sonraki Açılış",
    bellsLabel: "Zil Saatleri",
    /* Dünya satırlarının HİÇBİRİ bu seansta işlem görmediyse künyenin ilk
       cümlesinin yerine geçer: yüzdeler bugünün değil son kapanışın. */
    worldLastCloseHint: "Yüzdeler son kapanışa göre; bu seansta işlem yok. Yönü yerel endeksle aynı, yüzdesi kur ve seans farkıyla ayrışabilir.",
    // Giriş yapmamış okuyucu: bir listesi olabilir, "henüz yok" demek yanlış.
    watchlistSignedOutTitle: "Favorilerini Burada Gör",
    watchlistSignedOutHint: "Giriş yapınca takip ettiğin semboller fiyatıyla burada listelenir.",
    // Yüzen bölüm dizini: adı ve altı durağı. Kısa, çünkü telefonda altısı tek şeritte.
    // Dizinin sağındaki küçük geri sayımın öneki: "Açılışa 01 sa 04 dk".
    /* Sektörler ve temalar bandı (28 Eylül): günün hareketi genişten dara.
       Sektör adları ve fon künyesi `marketExtras`ten, tema adları ve
       sıralama başlığı `themes`ten okunuyor; burada yalnızca bandın kendi
       metinleri var. */
    textureTitle: "Sektörler ve Temalar",
    textureNote: "Günün hareketi önce on bir sektörde, sonra tematik listelerde.",
    sectorsHeading: "Sektörler",
    sectorsLink: "Sektör Tablosu",
    themesLink: "Tüm Temalar",
    /* Son kapanışa "Günün En Güçlüsü" denmiyor (dünü bugün diye anlatmak
       olurdu); künye hangi günü anlattığını adıyla söylüyor. */
    /* HANGİ EVREN (28 Eylül). Kartlar "Günün En Güçlüsü" diyordu ve
       Enerji +%1,32 iken en güçlü olarak +%0,01'lik bir tema gösteriliyordu;
       okuyucu haklı olarak "yanlış mı" diye sordu. İki ölçü ayrı evren:
       sektörler SPDR fonunun (piyasa değeri ağırlıklı) değişimi, temalar
       üye hisselerin eşit ağırlıklı medyanı. Etiketler ve künyeler bunu
       adıyla söylüyor. */
    sectorsWeight: "Piyasa Değeri Ağırlıklı",
    themesHeading: "Temalar",
    themesMeta: "Üye Hisselerin Medyanı · Eşit Ağırlık",
    strongestTheme: "Günün En Güçlü Teması",
    weakestTheme: "Günün En Zayıf Teması",
    strongestLastClose: "Son Kapanışta En Güçlü Tema",
    weakestLastClose: "Son Kapanışta En Zayıf Tema",
    /* Açılış öncesinde yüzdeler bu sabahın ön seans işlemi: "Günün" değil
       (gerekçe lib/theme-stats.ts → themePhase). "Açılış Öncesinde…" 360
       pikselde üç satıra kırılıyordu (ölçüldü); bu biçim öteki künyeler
       gibi iki satırda kalıyor. */
    strongestPreMarket: "Açılış Öncesi En Güçlü Tema",
    weakestPreMarket: "Açılış Öncesi En Zayıf Tema",
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
    // Kapağın üst künyesi sözlükte; sayfada dile göre ikili ifade vardı.
    eyebrow: "Ekonominin Ajandası",
    nextHigh: "Sıradaki Yüksek Etkili Açıklama",
    nextRelease: "Sıradaki Açıklama",
    noRelease: "Açıklama Yok",
    todayEmpty: "Bugün planlanmış veri açıklaması yok.",
    nextDay: "Sıradaki Açıklama Günü",
    released: "Açıklandı",
    scheduled: "Planlandı",
    datesNav: "Açıklama Günleri",
    pickedNote: "Yalnızca seçili gün gösteriliyor.",
    allDays: "Tüm Günler",
    viewLabel: "Takvim Görünümü",
    /* Önem süzgeci açıkken "açıklama yok" demek YANLIŞ olurdu: o gün başka
       önemde bir açıklama olabilir. Cümle süzgeci söylüyor. */
    emptyFiltered: "Seçili önemde bu aralıkta açıklama yok.",
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
    /* Takvim kartında beklenti satırlarının yerini alan künye. Cümle değil
       künye olduğu için Title Case. */
    noEstimate: "Beklenti Yok",
    epsEstimate: "EPS Beklentisi",
    /* Kompakt yuvanın öneki — "Yaklaşan Bilançolar" panelinde sayının
       yanında tek kelime. Analizler tablosunun başlığı "HBK / Beklenti"
       dediği için aynı sayfada aynı kısaltma. */
    epsEstimateShort: "HBK",
    /* Yaklaşan bilanço kartındaki geçmiş bağlamı. "Geçen çeyrek" DEĞİL
       "son açıklanan": aradaki çeyrek atlanmış olabilir ve tarih zaten
       yanında yazıyor. */
    /* Yaklaşan bilanço kartındaki geçmiş bağlamı. Ham sayı DEĞİL karne:
       tarih, gerçekleşen ve sapma zaten aşağıdaki Geçmiş Bilançolar
       tablosunda var; burada olan şey o tablonun SÖYLEMEDİĞİ özet. */
    beatRecord: "Beklenti Karnesi",
    epsAvgSurprise: "Ortalama Sapma",
    epsLatest: "Son Çeyrek EPS",
    epsBeatCount: "{beat}/{total} Çeyrekte Aşıldı",
    beatRecordLine: "Son {total} çeyreğin {beat} tanesinde beklenti aşıldı",
    beatRecordNone: "Son {total} çeyrekte beklenti aşılmadı",
    beatRecordAll: "Son {total} çeyreğin tamamında beklenti aşıldı",
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
    /* Tek satır: uzun hâli 1024px kapağın ikinci satırına tek kelime
       bırakıyordu. Sıralama ölçütü zaten sütun başlığında yazılı. */
    subtitleLong: "Şirketlerin finansal sonuç açıklama tarihleri · piyasa değerine göre sıralı",
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
    reportNavigation: "Rapor Bölümleri",
    reportOverview: "Genel Bakış",
    reportInNumbers: "Rakamlarla Bu Çeyrek",
    reportOutlook: "İleriye Bakış",
    /* Bölüm adı = sekme adı (gerekçe `stock.chapterValuation` üstünde).
       "Detaylı Değerlendirme" sekmesi "Özet" panelinde açılıyordu. */
    chapterFigures: "Rakamlar",
    chapterReading: "Özet ve Değerlendirme",
    listTitle: "Son Bilanço Analizleri",
    filteredReports: "Listelenen Raporlarda Görüş Dağılımı",
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
    goToCalendar: "Takvime Git",
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
    /* Türkçede sayıdan sonra çoğul eki gelmiyor; çift İngilizce için. */
    colCardMany: "Analiz",

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
    /* BİLANÇO DETAYI, 24 Eylül. Potansiyel artık kapaktaki fiyattan
       ölçülüyor ve hangi fiyattan ölçüldüğü yazılı; hedefin kendisi
       bilanço günü ortalaması olarak künyeleniyor. */
    upsideFromToday: "Bugünkü Fiyata Göre",
    upsideFromReport: "Bilanço Günü Kapanışına Göre",
    aboveTarget: "Hedefin Üzerinde",
    peAtToday: "Bugünkü Fiyatla",
    newerAnalysis: "Daha Yeni Analiz",
    guidanceTitleReported: "{period} Öngörüsü (Açıklandı)",
    howToRead: "Grafik Nasıl Okunur",
    readMore: "Devamını Oku",
    readLess: "Daha Az Göster",
    missingQuarter: "Eksik Çeyrek",
    quarterOnQuarter: "Çeyreklik",
    yearOnYear: "Yıllık",
    preparedWith: "Claude ile Hazırlandı",
    readMinutes: "{count} Dakikalık Okuma",

    empty: "Henüz yayımlanmış bilanço analizi yok",
    emptyHint:
      "Bir şirket bilançosunu açıkladıktan sonra değerlendirmesi burada yayımlanır.",
    emptyWatchlist: "Takip ettiklerin için henüz analiz yok",
    emptyWatchlistHint:
      "Favorilerine eklediğin şirketlerden biri bilanço açıkladığında analizi burada görünür.",
    emptyFilter: "Bu filtreyle eşleşen analiz yok.",
    notFound: "Analiz Bulunamadı",
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
    // Seçim piyasa değerine, sıra tarihe göre: künye ikisini birden söylüyor.
    upcomingOrderNote: "En Büyük Şirketler · Tarih Sırasıyla",
    upcomingOrderNoteWatch: "Takip Ettiklerin ve En Büyükler · Tarih Sırasıyla",
    openAnalysisAria: "{company} analizini aç",
  },

  /* Teknik analiz — /teknik ve /teknik/[sembol].
     Görüş etiketleri (AL/TUT/SAT) `analysis` bloğundan okunuyor: aynı karar,
     aynı sözlük. Burada yalnızca bu ekranlara özgü olanlar var. */
  technical: {
    eyebrow: "Günlük Teknik Görünüm",
    title: "Teknik Analiz",
    /* Tek satır: uzun hâli 1024px kapağın ikinci satırına iki kelime
       bırakıyordu. */
    description: "Takip edilen hisselerde trend, destek-direnç, alım bölgesi ve stop.",
    slotPremarket: "Açılış Öncesi",
    slotMidsession: "Seans İçi",
    slotLateday: "Kapanış Öncesi",
    latestEdition: "Son Yayın",
    nextEdition: "Sıradaki Yayın",
    scheduleLabel: "Yayın Saatleri",
    schedule: "Her işlem günü {pre}, {mid} ve {late}",
    changedToBuy: "Ala Döndü",
    changedToHold: "Tuta Döndü",
    changedToSell: "Sata Döndü",
    stanceLabel: "Teknik Görünüm",
    readAnalysis: "Analizi Oku",
    shareTitle: "Bu Analizi Paylaş",
    /* "Şu An" DEĞİL: kotasyon Alpaca'nın 15 dakika gecikmeli SIP akışı ve aynı
       ekranın veri damgası bunu söylüyor. Etiket tazeliği abartmasın. */
    now: "15 Dakika Gecikmeli",
    /* Melez kotasyonda fiyat IEX'ten gerçek zamanlıysa (lib/providers/index.ts). */
    nowRealtime: "Gerçek Zamanlı",
    /* Detay ekranında fiyatın ADI; gecikme yanında rozet olarak (`now`).
       Etiketin kendisi "15 Dakika Gecikmeli" olunca okuyucu fiyatın ne
       olduğunu değil yalnızca ne kadar geç olduğunu okuyordu. */
    currentPrice: "Güncel Fiyat",
    thisEdition: "Bu Yayın",
    atAnalysis: "Analiz Anında",
    levelPassed: "Geçildi",
    levelBroken: "Kırıldı",
    levelsNote: "Fiyata Uzaklık",
    /* STOP ALTI KUŞAĞININ KÜNYESİ. Kuşak sessizdi ve kırmızı bir alan
       tek başına "kötü" diyor, "ne" demiyor. Kısa tutuldu: 390 pikselde
       tek satır kalmalı (ölçüldü). */
    zoneBelowStop: "Bu Seviyenin Altı: Plan Geçersiz",
    target: "Hedef {n}",
    targetsLabel: "Hedefler",
    resistance: "Direnç",
    entryZone: "Alım Bölgesi",
    support: "Destek",
    stop: "Stop",
    summary: "Değerlendirme",
    indicators: "Göstergeler",
    movingAverages: "Hareketli Ortalamalar",
    goldenCross: "Altın Kesişim",
    deathCross: "Ölüm Kesişimi",
    sessionsAgo: "{n} Seans Önce",
    sessionsAgoOne: "1 Seans Önce",
    lastSession: "Son Seansta",
    aboveMa: "{n} Günlüğün Üzerinde",
    belowMa: "{n} Günlüğün Altında",
    notEnoughHistory: "Yeterli Geçmiş Yok",
    rsi: "RSI (14)",
    rsiOverbought: "Aşırı Alım",
    rsiOversold: "Aşırı Satım",
    rsiNeutral: "Nötr Bölge",
    macd: "MACD (12, 26, 9)",
    macdLine: "MACD",
    macdSignal: "Sinyal",
    macdHistogram: "Histogram",
    macdNote: "Sıfır çizgisinin sağı pozitif, solu negatif. Histogram, MACD ile sinyal arasındaki farktır.",
    macdAbove: "Sinyalin Üzerinde",
    macdBelow: "Sinyalin Altında",
    crossedLastSession: "Son Seansta Kesişti",
    crossedSessionsAgo: "{n} Seans Önce Kesişti",
    crossedSessionsAgoOne: "1 Seans Önce Kesişti",
    volume: "Hacim",
    volumeLast: "Son Seans",
    volumeAverage: "20 Günlük Ortalama",
    volumeRatio: "Ortalamaya Oran",
    volumeToday: "Gün İçi ({time} İtibarıyla)",
    atr: "Günlük Aralık (ATR 14)",
    atrShare: "Fiyata Oranı",
    range52: "52 Haftalık Bant",
    range52Low: "Dip",
    range52High: "Tepe",
    range52Below: "Tepenin {n} Altında",
    range52AtHigh: "Tepede",
    /* NE ANLATIYOR — HER KUTUNUN BAŞINDA.
       Göstergeler sayfası RSI, MACD ve pivot gibi adları hiç açıklamadan
       basıyordu: değeri okuyan ama ölçünün ne olduğunu bilmeyen okuyucu
       için sayfa bir gösterge paneli değil bir bilmeceydi. Her kutu artık
       başlığının altında bir-iki cümleyle kendini anlatıyor; cümleler
       jargonsuz ve iddiasız — "şu sayı şu demek", "al" ya da "sat" değil. */
    maLead:
      "Son 20, 50, 100 ve 200 seansın ortalama kapanışı. Fiyat ortalamanın üstündeyse o dönemde alan taraf önde, altındaysa satan taraf.",
    rsiLead:
      "Yükselişin hızını 0 ile 100 arasında ölçer. 70'in üstü hızlı yükseliş, 30'un altı hızlı düşüş demek, tek başına al ya da sat sinyali değil.",
    macdLead:
      "İki hareketli ortalamanın arasındaki farkı izler. MACD sinyal çizgisinin üstündeyse hareket hızlanıyor, altındaysa yavaşlıyor demektir.",
    volumeLead:
      "O seansta kaç hisse el değiştirdi. Ortalamanın üstü hareketin arkasında gerçek ilgi olduğunu, altı hareketin cılız kaldığını gösterir.",
    atrLead:
      "Fiyatın bir günde ortalama ne kadar oynadığı. Stop bu salınımın içinde kalırsa sıradan bir gün bile onu tetikler.",
    range52Lead:
      "Son bir yılın en düşük ve en yüksek fiyatı; işaret bugünkü fiyatın bu bandın neresinde durduğunu gösterir.",
    pivotsLead:
      "Önceki seansın en yüksek, en düşük ve kapanışından hesaplanan referans fiyatlar. P denge noktası: üstü alıcının, altı satıcının bölgesi sayılır. R direnç, S destek adayıdır.",
    pivotR2: "2. Direnç",
    pivotR1: "1. Direnç",
    pivotP: "Denge Noktası",
    pivotS1: "1. Destek",
    pivotS2: "2. Destek",
    maNote: "Yüzde, güncel fiyatın ortalamaya göre farkı; merdivendeki uzaklık ise fiyattan seviyeye.",
    pivots: "Pivot Seviyeleri",
    scenarios: "Senaryolar",
    bullCase: "Yükseliş Senaryosu",
    bearCase: "Düşüş Senaryosu",
    volumeRead: "Hacim Okuması",
    watch: "Dikkat Edilecekler",
    history: "Görüş Geçmişi",
    historyDate: "Tarih",
    historyEdition: "Yayın",
    historyStance: "Görüş",
    historyPlan: "Planın Seyri",
    historyRuns: "{n} Yayın",
    historyNote:
      "Aynı gün aynı kalan yayınlar tek satırda. Çubukta alım bölgesi ve stop (kırmızı çentik), tablodaki en düşük ve en yüksek seviye arasında ortak ölçekte.",
    moreSymbols: "Diğer Şirketler",
    noEditionYet: "Yayın Bekliyor",
    companyPage: "Şirket Sayfası",
    allStocks: "Bütün Hisseler",
    snapshotNote:
      "Göstergeler {date} kapanışına göre hesaplandı; fiyat 15 dakika gecikmelidir.",
    snapshotNoteRealtime:
      "Göstergeler {date} kapanışına göre hesaplandı; fiyat gerçek zamanlıdır (IEX).",
    method:
      "Ortalamalar, RSI, MACD, hacim ve pivot seviyeleri sitenin kendi günlük fiyat verisinden hesaplanır. Görüş, seviyeler ve senaryolar bu göstergelerin üzerine Claude tarafından yazılır.",
    disclaimer:
      "Buradaki görüş ve seviyeler teknik göstergelerin bir yorumudur. Yatırım Tavsiyesi Değildir; karar vermeden önce kendi araştırmanı yap.",
    langNote: "Bu analizin Türkçesi henüz yok; orijinal diliyle gösteriliyor.",
    /* Metin çevrilmemişse kartta duran rozet — orijinalin dil kodu. */
    originalBadge: "TR",
    empty: "Güncel Teknik Analiz Yok",
    emptyHint:
      "Analizler her işlem günü açılıştan önce ve seans içinde yayımlanır; beş günden eski görüşler burada gösterilmez.",
    notListed: "Bu Hisse Teknik Analiz Listesinde Yok",
    notListedHint: "Teknik analizi her işlem günü yayımlanan {n} hisse:",
    noAnalysis: "Bu Hisse için Henüz Analiz Yok",
    noAnalysisHint: "Bu hissenin analizi her işlem günü açılıştan önce ve seans içinde yayımlanır.",
    distribution: "Görüş Dağılımı",
    stockCount: "{n} Hisse",
    stockCountOne: "{n} Hisse",
    trackedLabel: "Takipte",
    distributionNote: "Takip edilen {n} hissenin son analizdeki görüşü.",
    boardTitle: "Hisse Planları",
    /* BEKLEYEN SEMBOL — listeye yeni girmiş, ilk yayını henüz yok. */
    pendingLabel: "Bekliyor",
    /* Türkçede sayıdan sonra çoğul eki gelmiyor, iki değer de aynı; çift
       İngilizce için var (bkz. `plural`, lib/utils.ts). */
    pendingNoteOne:
      "{symbols} takip listesine yeni eklendi; ilk yayından sonra kartı burada görünecek.",
    pendingNoteMany:
      "{symbols} takip listesine yeni eklendi; ilk yayından sonra kartları burada görünecek.",
    /* GECİKEN YAYIN, YENİ SEMBOL DEĞİL. Pano yalnızca beş günden taze
       yayını taşıyor; bir sembolün yayını aksarsa panodan düşüyordu ve
       "listeye yeni eklendi" künyesiyle basılıyordu — daha önce onlarca kez
       yayımlanmış bir hisse için bu doğru değil. İki hâl artık ayrı
       cümleyle söyleniyor; ikisi de sessizce kaybolmuyor. */
    lapsedLabel: "Yayın Gecikti",
    lapsedNoteOne:
      "{symbols} için son beş günde yeni yayın yok; kartı yeniden yayımlandığında görünecek.",
    lapsedNoteMany:
      "{symbols} için son beş günde yeni yayın yok; kartları yeniden yayımlandıklarında görünecek.",
    changesLabel: "Görüşü Değişenler",
    filterLabel: "Görüşe Göre Süz",
    filterAll: "Tümü",
    planInZone: "Alım Bölgesinde",
    planAbove: "Bölgenin {n} Üstünde",
    planBelow: "Bölgenin {n} Altında",
    planBelowStop: "Stopun Altında",
    sellLevel: "Satış Seviyesi {n}",
    /* ---- Plan: üç soru, üç hücre ---- */
    planEntry: "Nereden Alınır",
    planTargets: "Nerede Satılır",
    planStop: "Nerede Vazgeçilir",
    planSellLevels: "Tepkide Satış",
    planNearestSupport: "En Yakın Destek",
    planNearestResistance: "En Yakın Direnç",
    /* SAT kartının üçüncü satırı: destek kırılırsa sıradaki seviye. */
    planNextSupport: "Sonraki Destek",
    planNone: "Bu Yayında Yok",
    riskReward: "Risk / Getiri",
    /* "1 : 2,4" — bir birim riske karşı kaç birim getiri. */
    riskRewardValue: "1 : {n}",
    /* Bacakların adı; yanına ham tutar ve yüzde yazılıyor. */
    riskLeg: "Risk",
    rewardLeg: "Getiri",
    /* Yüzdenin çapası — hangi fiyattan ölçüldüğü söylenmeden eksik. */
    riskAnchor: "Bölgenin Tepesinden · {n}",
    /* Liste kartının dar rayında çapanın yalnızca adı: sayı bir satır
       yukarıda, alım aralığının üst ucu olarak zaten yazılı. */
    riskAnchorLabel: "Bölgenin Tepesinden",
    readingLabel: "Planın Okuması",
    /* Cümleler: görüş ve fiyatın plana göre yeri birleşince altı durum. */
    readingInZone: "Fiyat alım bölgesinin içinde; plan alımı burada, vazgeçme noktasını {stop} altında görüyor.",
    readingInZoneNoStop: "Fiyat alım bölgesinin içinde; plan alımı burada görüyor.",
    readingHoldInZone: "Fiyat alım bölgesinde ama görüş TUT: plan alım için teyit (kapanış, hacim) bekliyor.",
    readingAbove: "Fiyat bölgenin {n} üstünde; plan kovalamıyor, {high} seviyesine geri çekilmeyi bekliyor.",
    readingBelow: "Fiyat bölgenin {n} altında ama stopun üstünde; {stop} tutundukça plan geçerli.",
    readingBelowNoStop: "Fiyat bölgenin {n} altında; plan bir sonraki yayında gözden geçirilir.",
    readingBelowStop: "Fiyat stopun ({stop}) altında; plan bozuldu, bir sonraki yayın yeni seviye kurar.",
    readingWait: "Yeni alım bölgesi yok; en yakın destek {support}, en yakın direnç {resistance}.",
    readingWaitSupport: "Yeni alım bölgesi yok; izlenecek ilk seviye {support} desteği.",
    readingWaitResistance: "Yeni alım bölgesi yok; izlenecek ilk seviye {resistance} direnci.",
    readingWaitPlain: "Yeni alım bölgesi yok; seviyeler bir sonraki yayında yenilenir.",
    readingSell: "Görüş SAT: tepkiler {level} çevresinde satış için izlenir; {support} desteği kırılırsa düşüş sürer.",
    readingSellLevel: "Görüş SAT: tepkiler {level} çevresinde satış için izlenir.",
    readingSellSupport: "Görüş SAT: {support} desteği kırılırsa düşüş sürer.",
    readingSellPlain: "Görüş SAT: yeni alım planı yok.",
    /* ---- Gösterge özeti ---- */
    signalsLabel: "Göstergelerin Özeti",
    signalTrend: "Trend",
    signalMomentum: "Momentum",
    signalRange: "52 Haftalık Yer",
    trendUp: "Yukarı",
    trendDown: "Aşağı",
    trendMixed: "Karışık",
    trendAboveBoth: "50 ve 200 Günlüğün Üstünde",
    trendBelowBoth: "50 ve 200 Günlüğün Altında",
    trendAbove50Below200: "50 Günlüğün Üstünde, 200'ün Altında",
    trendBelow50Above200: "50 Günlüğün Altında, 200'ün Üstünde",
    momentumStrong: "Olumlu",
    momentumWeak: "Zayıf",
    momentumDetail: "RSI {rsi} · MACD {macd}",
    momentumDetailRsi: "RSI {rsi}",
    volumeHeavy: "Yoğun",
    volumeNormal: "Olağan",
    volumeLight: "Zayıf",
    volumeDetail: "Ortalamanın {n} Katı",
    rangeDetail: "Dip {low} · Tepe {high}",
    /* ---- Fiyat haritası ---- */
    levelRationale: "Seviyelerin Dayanağı",
    priceMap: "Fiyat Haritası",
    levelColumn: "Seviye",
    thesisLabel: "Görüşün Gerekçesi",
    priceLevelsNote: "Seviyeler yüksek fiyattan düşüğe sıralıdır. Çubuklar şu anki fiyata uzaklığı ortak ölçekte gösterir; satır aralıkları fiyat mesafesi değildir.",
    priceMapNote: "Seviyeler fiyat sırasına göre dizilir, birbirine yakın olanlar okunabilsin diye ayrılır; uzaklıklar şu anki fiyattan ölçülür.",
    sectionsLabel: "Analiz Bölümleri",
    // Dağılım logosunun bilgi kartı, yayını bekleyen sembolde.
    pulseAwaiting: "Güncel analiz henüz yayımlanmadı.",
    /* ---- Hisse Planları, 23 Eylül ----
       Telefonda dağılımın logo satırları gizli; bekleyen sayısı başlık
       künyesine iniyor ki hiçbir yerde kaybolmasın. */
    pendingCount: "{n} Bekliyor",
    /* Panoda son yayından eski bir kart — ayağında adıyla söyleniyor. */
    earlierEdition: "Önceki Yayın",
    /* SAT ve bölgesiz TUT kartının bacakları: fiyattan seviyeye uzaklık. */
    planToSellLevel: "Tepkiye",
    planToSupport: "Desteğe",
    planToResistance: "Dirence",
    /* Pano künyesi: kaç kart bölgede, bölgeye %1'den yakın, stopun altında. */
    proximityLabel: "Plana Göre Fiyat",
    proximityInZone: "Bölgede",
    proximityNear: "%1'den Yakın",
    proximityBelowStop: "Stop Altında",
    /* Trend göstergesinin iki etiketi: 50 ve 200 günlük ortalama. */
    ma50Short: "50G",
    ma200Short: "200G",
    /* ---- Görüşler ne demek ----
       Görüş kartta tek kelime (AL/TUT/SAT) ve okuyucu onu bir emir gibi
       okuyordu: "şimdi hepsini al", "şimdi hepsini sat". Rutinin tanımı
       öyle değil (docs/claude-rutinler.md § 5): AL bir alım BÖLGESİ ve
       vazgeçme noktası olan plan, SAT yeni alım olmaması ve tepkide
       azaltma. Metinler o tanımı okuyucunun iki durumuna (pozisyonu var /
       yok) ve kademe sorusuna çeviriyor; tanımda olmayan bir şey (oran,
       vade, yüzde) uydurmuyor. */
    stanceGuide: {
      detailTitle: "{stance} Ne Demek?",
      boardTitle: "AL, TUT, SAT Ne Demek?",
      boardLead:
        "Görüş bir emir değil, planın tek kelimelik özetidir. Üçü de aynı soruya cevap verir: bugünkü grafikte yeni bir alım için gerekçe var mı, varsa nereden alınır ve nerede vazgeçilir.",
      boardLink: "Görüşler Ne Demek?",
      noPosition: "Pozisyonun Yoksa",
      hasPosition: "Pozisyonun Varsa",
      whatToDo: "Ne Yapmalı?",
      scaling: "Kademeli mi, Tek Seferde mi?",
      othersLabel: "Öteki Görüşler",
      stickyTitle: "Görüş Neden Kolay Değişmez",
      sticky:
        "Görüş her yayında gözden geçirilir ama somut bir tetik olmadan değişmez: bir ortalamanın kırılması, stopun altına inilmesi ya da alım bölgesinin yeniden kurulması. Göstergeler günlük kapanışlardan hesaplanır; plan gün içi al-sat için değil, günlük grafiği okuyanlar için yazılır.",
      guideLink: "Ayrıntılı Rehber",
      buy: {
        short: "Trend yukarı; alım bölgesi, stop ve hedefler belli.",
        meaning:
          "Trend yukarı: fiyat 50 günlük ortalamanın üstünde ve bir desteğin üzerinde alım bölgesi kurulmuş. Stop ve hedefler belli, ilk hedef riskin en az 1,5 katı uzakta. “Hemen al” değil, “bu bölgede alım planı geçerli” demek.",
        noPosition:
          "Alım bölgenin içinde düşünülür. Fiyat bölgenin üstündeyse plan kovalamaz, geri çekilmeyi bekler; stopun altına inerse plan bozulur ve alım yapılmaz.",
        hasPosition:
          "Pozisyon taşınır, stop vazgeçme noktası olarak izlenir. Hedefler kâr almanın duraklarıdır: fiyat bir hedefe vardığında bir kısmını satıp kalanı sonraki hedefe taşımak yaygın bir yöntemdir.",
        scaling:
          "Bölge tek fiyat değil bir aralık. Alımı bölgeye yaymak (bir kısmı üst uçta, kalanı alt uca doğru) tek bir fiyata bağlanmayı önler. Tek seferde almak da plana aykırı değil, ama o zaman risk bölgenin tepesinden stopa kadar ölçülür. Tutarı stop mesafesi belirler: stop çalışırsa ne kadar kaybedileceği baştan bilinmeli.",
      },
      hold: {
        short: "Tablo karışık ya da fiyat bölgeden uzak; teyit bekleniyor.",
        meaning:
          "Tablo karışık ya da trend sağlam ama fiyat alım bölgesinden uzak. Ne yeni alım ne satış için yeterli gerekçe var; plan bir seviyenin netleşmesini bekliyor.",
        noPosition:
          "Acele edilmez. Alım bölgesi verilmişse fiyatın oraya gelmesi ve teyit (bölgede tutunan bir kapanış, ortalamanın üstünde hacim) beklenir; bölge yoksa listelenen destek ve dirençler izlenir.",
        hasPosition:
          "TUT satmak demek değil: pozisyon taşınır. Stop verilmişse o seviye, verilmemişse en yakın destek izlenir; aşağı kırılırsa görüş SAT'a dönebilir.",
        scaling:
          "Yeni alım teyitten sonra ve yine bölgeye yayılarak düşünülür. Var olan pozisyona eklemek için AL görüşünü beklemek, zayıflayan bir hissede pozisyonu büyütmenin önüne geçer.",
      },
      sell: {
        short: "Trend aşağı; yeni alım yok, tepkiler azaltma fırsatı.",
        meaning:
          "Trend aşağı: fiyat 50 ve 200 günlük ortalamaların altında. Yeni alım planı olmadığı için alım bölgesi ve stop yayımlanmaz; listelenen seviyeler, fiyat tepki verirse takılabileceği dirençlerdir.",
        noPosition:
          "Yeni alım yapılmaz; bu bir açığa satış önerisi de değil. Alım için görüşün TUT'a ya da AL'a dönmesi, yani fiyatın ortalamaları geri alması beklenir.",
        hasPosition:
          "“Hepsini hemen sat” demek değil. Plan, fiyatın dirençlere yükseldiği tepkileri pozisyonu azaltma fırsatı olarak görür. Destek kırılırsa düşüş sürer; o durumda tepki beklemek riski büyütür.",
        scaling:
          "Çıkış da kademeli olabilir: ilk dirençte bir kısmı, sonrakinde kalanı. Ne kadarının satılacağını maliyetin, portföydeki ağırlık ve vergi durumu belirler; ekran bunları bilemez.",
      },
    },
  },

  companies: {
    searchLabel: "Şirket Bul",
    searchPlaceholder: "Sembol veya şirket adı",
    searchSubmit: "Ara",
    searchResults: "“{query}” için {n} şirket",
    clearSearch: "Aramayı Temizle",
    searchEmpty: "Eşleşen Şirket Yok",
    searchEmptyHint: "Başka bir ad veya sembol dene; seçili sektör aramayı daraltır.",
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
      "Bu listedeki {n} şirketin fiyat, değişim ve hacim verisi sağlayıcıdan alınamadı. Kapsam dışındaki veya seyrek işlem gören semboller boş görünebilir.",
  },

  stock: {
    latestAnalysis: "Son Bilanço Analizi",
    earningsShortcut: "Bilançolara Git",
    experienceOverview: "Genel Bakış",
    experienceNav: "Şirket sayfası bölümleri",
    experienceEyebrow: "Şirket Dosyası",
    /* Fon sayfasının künyesi: "Şirket Dosyası" bir ETF için yanlış ad. */
    fundEyebrow: "Fon Dosyası",
    /* Profil kartının tek büyük okuması piyasa değeri; künye neyle
       hesaplandığını söylüyor (lib/data.ts → liveMarketCap). */
    capLiveNote: "Canlı Fiyatla Hesaplandı",
    capRank: "Piyasa Değeri Sırası",
    capRankOf: "Takip Edilen {n} Şirket İçinde",
    capLeader: "En Büyük: {symbol} · {value}",
    /* "S&P 500'deki", "Nasdaq 100'deki": iki endeksin sayısı da aynı eki
       alıyor (beş yüz-de, yüz-de); yeni bir endeks eklenirse eki denetle. */
    capRankOfIndex: "{index}'deki {n} Şirket İçinde",
    capLeaderSelfIndex: "{index}'ün En Büyüğü",
    capLeaderSelf: "Takip Edilenlerin En Büyüğü",
    /* Profilin ikinci turu (1 Ekim) — gerekçe ProfileCard. Sayıya ek
       getiren kalıp yok ("%0,4'ü" gibi): ek rakamın okunuşuna bağlı ve
       her değerde değişirdi; sayı etiketin sonunda, eksiz. */
    capIndexShare: "{index} Toplamındaki Payı {value}",
    capTrackedShare: "Takip Edilenlerin Toplamındaki Payı {value}",
    capAbove: "{rank}. {symbol} · {value} Önde",
    capBelow: "{rank}. {symbol} · {value} Geride",
    capLens: "Yakın Plan ×{n}",
    bandFromLow: "Dibin {value} Üstünde",
    bandFromHigh: "Zirvenin {value} Altında",
    nextReportRow: "Sıradaki Bilanço",
    experienceFundamentals: "Değerleme ve Beklentiler",
    experienceFundamentalsHint: "Fiyatın ötesinde: şirketin finansal yapısı ve analistlerin bakışı.",
    experienceEarnings: "Çeyrek Çeyrek Performans",
    experienceEarningsHint: "Beklentiler, gerçekleşen sonuçlar ve rakamların anlattıkları.",
    experienceContext: "Şirketin Gündemi",
    experienceContextHint: "Sektördeki yeri, son gelişmeler ve büyük resmi tamamlayan analizler.",
    /* BÖLÜM ADI = SEKME ADI (23 Eylül). Sekmeler "Anahtar Metrikler" ve
       "Geçmiş Bilançolar" diyordu, tıklanınca açılan bölümler ise
       "Değerleme ve Beklentiler" ve "Çeyrek Çeyrek Performans": okuyucu
       tıkladığı yeri başka bir adla buluyordu. İkisi artık aynı anahtardan
       okunuyor; kısa, çünkü 390 pikselde dört sekme tek şeritte kayıyor. */
    chapterValuation: "Değerleme",
    chapterEarnings: "Bilançolar",
    chapterContext: "Gündem",
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
    /* Fiyat cetvelindeki çentik etiketi — dar, satırdaki adın kısası. */
    movingAverageShort: "{n}G",
    currentQuote: "Son Fiyat",
    averageDistance: "Ortalamaya Göre Fark",
    analystReading: "12 Aylık Tavsiye Dağılımı",
    movingAveragesNote:
      "Son 50, 100 ve 200 işlem gününün kapanış ortalaması. Fiyat ortalamanın üstündeyse o dönemde alan taraf önde, altındaysa satan taraf; yanındaki yüzde aradaki farkı gösterir.",
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
    /* Bant bloğunun başlığı — iki ayrı satırın yerini alıyor. */
    country: "Ülke",
    week52Range: "52 Hafta Aralığı",
    /* İşaretçinin ne olduğunu SÖYLEYEN künye: dipten tepeye giden yolun ne
       kadarı geride kaldı. SAYI EKİ YOK ve bu zorunlu — Türkçede ek sayının
       OKUNUŞUNA göre değişiyor ("%90'ında" ama "%5'inde", "%72'sinde") ve
       yüzde her hissede farklı. Sabit bir ek çoğu sayıda yanlış olurdu;
       "içinde" edatı sayıdan önce gelip sorunu tümüyle ortadan kaldırıyor. */
    week52Position: "Bant İçinde {value}",
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
    notFound: "Bu Sembol Bulunamadı",
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
    sessionHours: "Seans Saatleri",
    sessionPre: "Ön Seans",
    sessionRegular: "Seans",
    sessionAfter: "Akşam Seansı",
    sessionOvernight: "Gece",
    sessionOvernightNote: "Gece seansı konsolide veri akışında yok",
    /* 1G grafiğindeki kesikli çizginin eksen etiketi — dar, kısaltılmış. */
    prevCloseShort: "Önc. Kapanış",
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
    /* Boş durumun BAŞLIĞI — Title Case ve noktasız. Tek başına gri bir
       cümle olarak basılıyordu ve altındaki ipucundan ayırt edilmiyordu;
       artık panelin h2'si, ipucu gövdesi. */
    emptyAll: "Henüz Bir Takip Listen Yok",
    emptyAllHint: "İlk listeni oluştur, sonra izlemek istediğin sembolleri ekle.",
    color: "Renk",
    note: "Not",
    moveUp: "Yukarı Taşı",
    dragHint: "Sürükleyerek sırala",
    moveDown: "Aşağı Taşı",
  },

  ipo: {
    title: "Halka Arz Takvimi",
    window: "Önümüzdeki 6 Hafta",
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
    tableTitle: "Ölçü Tablosu",
    secondSymbolHint:
      "Tek seri kendi başlangıcına göre yüzdeye çevrildiği için sıfırdan çıkan bir çizgiden başka bir şey söylemiyor.",
    fullHint: "Sınır dört sembol; birini çıkarınca yenisini ekleyebilirsin.",
    seatHint: "Dörde kadar hisse aynı ölçekte yan yana okunur.",
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
    fearCalm: "Sakin",
    fearNormal: "Normal",
    fearTense: "Tedirgin",
    fearHigh: "Gergin",
    fearPanic: "Panik",
    title: "Piyasalar",
    subtitle: "Endeksler, piyasa genişliği ve gün içi hareket: piyasanın nabzı",
    yields: "ABD Tahvil Faizleri",
    yieldY2: "2 Yıllık",
    yieldY5: "5 Yıllık",
    yieldY10: "10 Yıllık",
    yieldY30: "30 Yıllık",
    pulseTitle: "Faiz ve Oynaklık",
    curveShort: "Getiri Eğrisi",
    curveBasis: "10 − 2 Yıllık",
    point: "Puan",
    curveNormal: "Normal Eğri",
    curveInverted: "Ters Eğri",
    breadth: "Piyasa Genişliği",
    advancingShare: "Yükselenlerin Payı",
    breadthCoverage: "{total} şirketin {known} tanesinde değişim verisi mevcut.",
    heatmap: "Isı Haritası",
    heatmapHint: "Piyasa değerine göre ilk 30 şirket · Günlük değişim",
    /* Telefonda harita 20 şirket (5 × 4) — künye ekrandakini söyler. */
    heatmapHintPhone: "Piyasa değerine göre ilk 20 şirket · Günlük değişim",
    heatScaleHint: "Renk yoğunluğu eşikleri: yüzde 0,5, 1,5 ve 3; yeşil yükseliş, kırmızı düşüş.",
    heatScaleSteps: "Kademeler: %0,5 · %1,5 · %3",
    heatDayRange: "Gün İçi Aralık",
    heatOpenCompany: "Şirketi İncele",
    movementScale: "Çubuklar iki listede aynı yüzde ölçeğini kullanır.",
    advancing: "Artıda",
    declining: "Ekside",
    unchanged: "Yatay",
    topGainers: "Günün En Çok Artanları",
    topLosers: "Günün En Çok Düşenleri",
    contribution: "Katkı",
    contributionHint:
      "Katkı, hissenin bugün endeksi kaç puan yukarı ya da aşağı taşıdığını gösterir. Dow fiyat ağırlıklı bir endekstir: her hissenin dolar bazındaki değişimi endeksin bölenine oranlanarak hesaplanır.",
    constituents: "Endeks Bileşenleri",
    constituentsMore: "{n} Şirket Daha",
    constituentsLess: "Daha Az Göster",
    asOf: "Liste Kompozisyonu",
  },

  news: {
    eyebrow: "ABD Piyasalarından",
    title: "Haberler",
    subtitle: "Piyasa ve şirket haberleri",
    all: "Tümü",
    general: "Genel",
    empty: "Şu an gösterilecek haber yok.",
    readAtSource: "Kaynakta Oku",
    translated: "Türkçeye Çevrildi",
    notFound: "Haber Bulunamadı",
    notFoundHint: "Bu haber kaldırılmış olabilir.",
    relatedSymbols: "Haberde Geçen Şirketler",
    related: "Benzer Haberler",
    fullStoryTitle: "Haberin Tamamı Kaynağında",
    fullStoryHint:
      "Burada gördüğün özet, haber sağlayıcısından geliyor; metnin devamı yayıncının sitesinde",
    neutral: "Nötr",
  },

  brief: {
    eyebrow: "Piyasa Özeti",
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
    contextLabel: "Bunu Anlamak için",
  },

  stories: {
    title: "Mercek",
    eyebrow: "Mercek Altında",
    /* TEK SATIR. Uzun hâli ("...uzun yazılar: ne oldu, neden oldu, ne
       öğretti.") kapağın dar kolonunda ikinci satıra yalnızca iki kelime
       bırakıyordu — öksüz satır, boşluk gibi okunuyor. Cümle üç soruyu iki
       kelimeye indirip aynı şeyi söylüyor. */
    subtitle: "Olayın arkasındaki mekanizmayı anlatan uzun yazılar.",
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
    lastClose: "Son Kapanış",
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
    notFound: "Yazı Bulunamadı",
    notFoundHint: "Bağlantı eski olabilir; listeden tekrar dene.",
    /* Yazı henüz bu dile çevrilmediyse orijinal gösterilir; bu not onu söyler. */
    fallbackNote:
      "Bu yazı henüz Türkçeye çevrilmedi; orijinal diliyle gösteriliyor.",
    disclaimer:
      "Bu yazı yayımlandığı tarihteki kamuya açık haber kaynaklarına dayanır. Yatırım Tavsiyesi Değildir.",
    // Okuma rayı ve mobil içindekiler.
    inThisArticle: "Bu Yazıda",
    sectionCountOne: "{count} Bölüm",
    sectionCountMany: "{count} Bölüm",
    railLabel: "Yazı rehberi",
    tocLabel: "İçindekiler",
    sourceCountOne: "{count} Kaynak",
    sourceCountMany: "{count} Kaynak",
    opensInNewTab: "yeni sekmede açılır",
    /* Rayın şirket künyesi: "olaydan bugüne" hangi kapanışa kadar. */
    closeOn: "{date} Kapanışı",
  },

  macro: {
    title: "Makro Göstergeler",
    subtitle: "Enflasyon, istihdam, faiz ve büyüme verileri",
    previous: "Önceki",
    nextRelease: "Sonraki Açıklama",
    noNextRelease: "Henüz Açıklanmadı",
    unchanged: "Değişmedi",
    eyebrow: "ABD Ekonomisi",
    pick: "Gösterge seç",
    history: "Geçmiş Gözlem",
    historyEmpty: "Geçmiş gözlemler henüz yeterli değil.",
    groupsLabel: "Gösterge grubu",
    groupInflation: "Enflasyon",
    groupLabor: "İş Gücü",
    groupPolicy: "Para Politikası",
    groupGrowth: "Büyüme ve Risk",
    all: "Tüm Göstergeler",
    threshold: "Eşik",
  },

  auth: {
    showPassword: "Şifreyi Göster",
    hidePassword: "Şifreyi Gizle",
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
    avatarTitle: "Profil İkonu",
    avatarHint: "Hesabın başlıkta ve menüde bu karoyla görünür. Rengini ve ikonunu istediğin zaman değiştirebilirsin.",
    avatarInitials: "Baş Harfler",
    avatarIconLabel: "İkon",
    avatarColorLabel: "Renk",
    avatarSaved: "Kaydedildi",
    avatarFailed: "İkon kaydedilemedi, birazdan tekrar dene.",
    avatarNames: {
      bell: "Zil",
      bull: "Boğa",
      bear: "Ayı",
      candles: "Mumlar",
      rocket: "Roket",
      compass: "Pusula",
      trend: "Yükseliş",
      pie: "Portföy",
      coin: "Madeni Para",
      briefcase: "Evrak Çantası",
      owl: "Gece Baykuşu",
      diamond: "Elmas",
      bolt: "Yıldırım",
      shield: "Kalkan",
      globe: "Dünya",
      target: "Hedef",
    },
    avatarColors: {
      blue: "Mavi",
      navy: "Lacivert",
      teal: "Turkuaz",
      violet: "Lavanta",
      brass: "Pirinç",
      ink: "Mürekkep",
      silver: "Gümüş",
    },
    title: "Ayarlar",
    subtitle: "Hesap bilgilerin, tema ve dil tercihlerin, verilerinle ilgili hakların.",
    appearance: "Görünüm",
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
    hintScreening: "Bir Hisseyi Kurallarla Sına",
    hintTechnical: "Günlük Görüş, Destek ve Direnç",
    hintGuide: "Kavramları Anlatan Yazılar",
    hintStories: "Piyasada Yaşananların Uzun Anlatımı",
    hintNews: "Çevrilmiş Piyasa Haberleri",
    hintBrief: "Günlük ve Haftalık Bülten Arşivi",
    hintWatchlist: "Takip Listelerin",
    hintPortfolio: "Pozisyonların, Dolar ve Lira Kâr/Zarar",
    hintInvestors: "Buffett, Pelosi, Burry: Kim Ne Aldı",
    hintThemes: "Yapay Zekâ, Yarı İletken, Katılım",
    hintGlossary: "Piyasa Terimleri, A’dan Z’ye",
    hintTax: "Hisse Kazancı ve Temettü Vergisi",
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
      "Seans içinde fiyat IEX'ten gerçek zamanlıdır; az işlem gören sembollerde ve seans dışında konsolide veri akışından (SIP) 15 dakika gecikmeli gelir. Gün içi hacim, açılış ve önceki kapanış bütün borsaların toplamıdır.",
    /* Kaynak adları SÖZLÜKTE: "önbellek" ve "takvim" sabit bir tablodan
       geliyordu ve İngilizce sitede de Türkçe basılıyordu. */
    delayed: "15 Dakika Gecikmeli",
    partlyDelayed: "Az İşlem Görenlerde 15 Dakika Gecikmeli",
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
    /* TARİH DE YAZILIYOR — ve bu bir hata düzeltmesiydi. Damga yalnızca saat
       basıyordu ("22:47 Güncellendi") ve dünden kalmış bir kayıt ekranda
       bugünmüş gibi duruyordu: okuyucunun bildirdiği "başka bir tarihin
       verisi geliyor" şikâyetinin görünen yüzü buydu. Damganın doğru anı
       taşıması bir kez düzeltilmişti (bkz. `quotesFromCache`) ama BİÇİM
       onu geri gizliyordu. Tarih yalnızca bugün DEĞİLSE yazılır; bugünse
       fazladan bir kelime olurdu. */
    updatedOn: "{date} {time} Güncellendi",
    mayBeStale: "Güncel Olmayabilir",
  },

  /* Hakkında ve Metodoloji (`/hakkinda`), gömülü parçalar (`/gomulu/*`) ve
     Açılış Kartı (`/gun/[tarih]/kart`). Üçü de sitenin kendini dışarıya
     anlattığı yüzeyler; tek ad alanında duruyorlar. */
  about: {
    metaTitle: "Hakkında ve Metodoloji",
    metaDescription:
      "Açılış Zili'ni kim yapıyor, veriler nereden geliyor, yazılar nasıl üretiliyor ve neden ücretsiz. Sitenin çalışma biçiminin açık anlatımı.",
    eyebrow: "Hakkında",
    title: "Hakkında ve Metodoloji",
    intro:
      "Sayılar nereden geliyor, yazıları kim yazıyor ve hangisine ne kadar güvenebilirsin: sitenin çalışma biçimi, açıkça.",
    clockTitle: "Seans Saatleri",
    clockZone: "Türkiye Saatiyle",
    clockSecondaryZone: "NY",
    clockOpen: "Açılış Zili",
    clockClose: "Kapanış Zili",
    clockPre: "Ön Seans",
    clockRegular: "Ana Seans",
    clockAfter: "Kapanış Sonrası",
    clockAria: "Günün 24 saati içinde seans pencereleri",
    footerLink: "Hakkında",
    whoTitle: "Kim Yapıyor",
    whoBody: [
      "Açılış Zili, geliştirici Ahmet Akyapı'nın kişisel projesi. Bir şirket, aracı kurum ya da yatırım danışmanı değil; arkasında reklam veren ya da sponsor yok.",
      "Neden var: ABD borsalarını Türkiye'den izleyen herkes her gün aynı çeviriyi yapıyordu. Kaynaklar New York saatiyle yayın yapıyor, bir bilanço \"kapanış sonrası\" deniyor ve bunun Türkiye saatiyle kaç olduğunu herkes kendi hesaplıyor; ABD yaz saatine geçince hesap bir saat kayıyor. Site bu çeviriyi bir kez ve doğru yapmak için kuruldu.",
    ],
    whoLink: "ahmetakyapi.com",
    dataTitle: "Veri Nereden Geliyor",
    dataIntro:
      "Sitedeki her sayının adı belli bir kaynağı var. Site sayı uydurmuyor; kaynağın verdiğini hesaplıyor, biçimlendiriyor ve damgalıyor.",
    sources: [
      { name: "Alpaca", what: "Hisse ve fon fiyatları, grafik barları. Seans içinde fiyat gerçek zamanlı (IEX); hacim, grafik ve seans dışı konsolide tape (SIP), 15 dakika gecikmeli." },
      { name: "IEX", what: "Seans içindeki gerçek zamanlı fiyat. Data provided for free by IEX.", href: "https://iextrading.com/api-exhibit-a" },
      { name: "Finnhub", what: "Şirket profilleri, haberler, bilanço takvimi, analist dağılımı ve halka arzlar." },
      { name: "FRED", what: "ABD makro serileri: enflasyon, istihdam, büyüme ve faiz." },
      { name: "U.S. Treasury ve Cboe", what: "Tahvil getirileri ve VIX için resmî günlük kapanışlar." },
      { name: "TCMB", what: "Dolar/TL kuru, bültenin kendi tarihiyle." },
    ],
    flowSources: "Kaynaklar",
    flowScreen: "Ekranda",
    flowFallback: "Cevap Yoksa",
    stampSource: "Alpaca",
    stampDelay: "Gerçek Zamanlı ya da 15 Dakika Gecikmeli",
    stampTime: "Çekildiği Saat",
    stampStale: "Bayatsa İşaretlenir",
    stampCaption: "Her veri kartının altındaki damga: kaynağın adı, gecikme ve verinin çekildiği saat.",
    layersTitle: "Üç Katmanlı Veri",
    layersIntro:
      "Her fiyat isteği sırayla üç kapıdan geçiyor. Hiçbir aşamada tahmin ya da uydurma değer üretilmiyor.",
    layers: [
      { title: "Canlı Sağlayıcı", body: "Önce asıl kaynak soruluyor." },
      { title: "Yedek Sağlayıcı", body: "Asıl kaynak cevap vermezse ikinci kaynak deneniyor." },
      { title: "Son Bilinen Değer", body: "İkisi de düşerse veritabanındaki son kayıt gösteriliyor ve kartın künyesi bunu söylüyor." },
    ],
    stampTitle: "Kaynak ve Saat Damgası",
    stampBody: [
      "Her veri kartının altında kaynağın adı ve verinin çekildiği saat yazıyor. Seans içinde fiyat gerçek zamanlı (IEX), az işlem gören sembollerde ve seans dışında 15 dakika gecikmeli; damga hangisi olduğunu söylüyor. Kayıt dünden kaldıysa tarih de yazılıyor; bayat olabilecek bir kayıt ayrıca işaretleniyor.",
      "Bir yüzde hangi seansı anlattığını kanıtlamıyorsa \"bugün\" diye gösterilmiyor. Bir ölçü dürüstçe gösterilemiyorsa hiç gösterilmiyor: kart boş kalıyor ya da ölçü kaldırılıyor.",
    ],
    timeTitle: "Saat Türkiye Saatiyle",
    timeBody:
      "Birincil saat İstanbul, New York saati yanında duruyor. Site hiçbir yere sabit saat yazmıyor, her saati o günün tarihiyle hesaplıyor; ABD yaz saatine geçince de doğru kalıyor. Kapaktaki seans saatleri de bugünün tarihiyle hesaplandı.",
    contentTitle: "Yazılar Nasıl Üretiliyor",
    contentBody: [
      "Bülten, Mercek yazıları, bilanço analizleri ve teknik analizler, Anthropic'in yapay zekâ modeli Claude ile çalışan zamanlanmış rutinler tarafından yazılıyor. Bunu saklamıyoruz: yazıların altında bir insan adı yok, çünkü onları bir insan yazmıyor.",
    ],
    contentSteps: [
      { title: "Site Hesaplar", body: "Ortalamalar, RSI, MACD ve pivot seviyeleri sitenin kendi fiyat verisinden hesaplanıp rutine veriliyor." },
      { title: "Rutin Yazar", body: "Zamanlanmış rutin yalnızca yorumu yazıyor; sayı üretmiyor." },
      { title: "Yazma Katmanı Denetler", body: "Biçim doğrulanıyor; o seansa ait olduğu kanıtlanmayan fiyat metne giremiyor." },
      { title: "Sahip Düzeltir", body: "Yayımlanan metin panelden okunup düzeltiliyor, önceki hâli saklanıyor." },
    ],
    contentNote:
      "Rehber yazıları ise kodun içinde duruyor; her değişiklikleri incelemeden geçiyor.",
    rhythmTitle: "Yayın Ritmi",
    rhythm: [
      { when: "Her Gün", what: "Bülten" },
      { when: "Günde İki", what: "Mercek Yazısı" },
      { when: "Ertesi Gün", what: "Bilanço Analizleri" },
      { when: "İşlem Günlerinde Üç", what: "Teknik Analiz" },
      { when: "Pazartesi", what: "Haftalık Bülten" },
    ],
    freeTitle: "İlkeler",
    principles: [
      { title: "Reklamsız", body: "Sitede reklam, sponsorlu içerik ya da ücretli üyelik yok." },
      { title: "Ücretsiz", body: "Hiçbir içerik ücretli değil; hesap yalnızca kendi listelerin ve portföyün için." },
      { title: "Açık Kaynak", body: "Kodun tamamı GitHub'da: bir sayının nasıl hesaplandığını kodunda okuyabilirsin." },
      { title: "Uydurma Sayı Yok", body: "Kaynağı olmayan sayı basılmıyor; dürüstçe gösterilemeyen ölçü hiç gösterilmiyor." },
    ],
    repoLink: "Kaynak Kodu",
    issuesLink: "Hata Bildir",
    privacyTitle: "Gizlilik",
    privacyBody:
      "Sayfa ölçümü çerezsiz: IP adresi, tam yönlendiren adres ve tarayıcı kimliği saklanmıyor, üçüncü taraf analitik yok. Hesap açarsan tutulan her alan aydınlatma metninde tek tek sayılı.",
    privacyLink: "KVKK ve Gizlilik",
    disclaimerTitle: "Yatırım Tavsiyesi Değildir",
    disclaimerBody:
      "Sitedeki hiçbir sayı, görüş ya da yazı bir alım satım önerisi değil. Teknik analizdeki Al, Tut ve Sat görüşleri bir yöntemin çıktısı; senin birikimini, risk tercihini ve vergi durumunu bilmiyor. Karar vermeden önce lisanslı bir yatırım danışmanına başvur.",
    embedTitle: "Sitene Ekle",
    embedIntro:
      "Açılış geri sayımını ya da haftanın bilançolarını kendi sitene ekleyebilirsin. Kodu kopyalayıp sayfana yapıştırman yeterli; koyu zemin için adresteki tema değerini koyu yap.",
    embedCountdown: "Açılış Geri Sayımı",
    embedEarnings: "Haftanın Bilançoları",
    embedCopy: "Kodu Kopyala",
    embedCopied: "Kopyalandı",
    embedCodeLabel: "{name} için gömme kodu",
    embedPreviewLabel: "{name} önizlemesi",
    embed: {
      attribution: "Açılış Zili",
      attributionLabel: "Açılış Zili'ni yeni sekmede aç",
      openAt: "Açılış",
      closeAt: "Kapanış",
      earningsTitle: "Haftanın Bilançoları",
      earningsEmpty: "Bu hafta takvimde öne çıkan bir bilanço yok.",
      /* Ek saate değil "TR"ye bitişiyor: "16:30'dan" ünlü uyumu saatin
         okunuşuna bağlı ve saat kışın kayıyor (session-clock.ts,
         dayBoundaryNote ile aynı kural). */
      earningsNote:
        "Açılış öncesi {open} TR'den önce, kapanış sonrası {close} TR'den sonra açıklanır.",
      earningsSource: "Finnhub Takvimi",
      allEarnings: "Tüm Takvim",
      metaCountdown: "Açılış Geri Sayımı",
      metaEarnings: "Haftanın Bilançoları",
    },
    card: {
      eyebrow: "Açılış Kartı",
      trTime: "TR",
      marketClosed: "Piyasa Kapalı",
      weekend: "Hafta Sonu",
      halfDay: "Yarım Gün",
      eventsEmpty: "Takvimde öne çıkan bir veri ya da bilanço yok.",
      timeUnknown: "Saat Belirsiz",
      movesSession: "Seans İçi",
      movesPre: "Açılış Öncesi İşlem",
      movesAfter: "Kapanış Sonrası İşlem",
      movesLastClose: "Önceki Kapanış · {date}",
    },
  },
  /* Verilerimi İndir (28 Eylül) — Ayarlar → Verilerin. KVKK veri
     taşınabilirliği; içerik lib/account-export-format.ts. */
  dataExport: {
    title: "Verilerimi İndir",
    hint:
      "Hesabının tuttuğu her şey tek dosyada: hesap bilgilerin, takip listelerin ve renkleri, listelerdeki semboller ve notların, portföy pozisyonların, profil ikonun. JSON tam kopyadır, CSV listelerini tablo programında açmak için.",
    json: "JSON Olarak İndir",
    csv: "CSV Olarak İndir",
  },
  /* Piyasa panoları, makro ikinci halka ve temettü (28 Eylül). Ayrı ad
     alanı: aynı gün başka paketler de sözlüğe anahtar ekliyor. */
  marketExtras: {
    boardsLabel: "Piyasa Geneli",
    /* ---- Sektör ve emtia panoları ---- */
    sectorsTitle: "Sektör Performansı",
    sectorsMeta: "11 SPDR Sektör Fonu",
    sectorColumn: "Sektör",
    colDay: "1G",
    colDayLong: "Günlük Değişim",
    colWeek: "1H",
    colWeekLong: "Son 1 Hafta",
    colMonth: "1A",
    colMonthLong: "Son 1 Ay",
    colQuarter: "3A",
    colQuarterLong: "Son 3 Ay",
    colYtd: "YBB",
    colYtdLong: "Yılbaşından Beri",
    sectorsProxyNote:
      "Sektörler SPDR sektör fonlarıyla temsil ediliyor: her fon, o sektördeki S&P 500 şirketlerini piyasa değeriyle tutar ve tek şirketin ağırlığına tavan uygular. Fonun getirisi sektörün kendisiyle birebir aynı değildir.",
    dayNote:
      "1G bu seansın değişimidir; bu seansta işlem görmemiş bir fonda yüzde son kapanışı anlatır ve Son Kapanış işaretiyle yazılır.",
    periodNote:
      "1H, 1A ve 3A son 5, 21 ve 63 işlem günüdür; YBB önceki yılın son kapanışından hesaplanır. Getiriler günlük kapanışlardan hesaplanan fiyat getirisidir, temettü dahil değildir.",
    returnsThrough: "Dönem Getirileri {date} Kapanışına Kadar",
    commoditiesTitle: "Emtia",
    commoditiesMeta: "Borsada İşlem Gören Fonlar",
    commodityGroup: "Emtia Fonları",
    cryptoGroup: "Spot Kripto Fonları",
    fundColumn: "Fon",
    priceColumn: "Fon Fiyatı ($)",
    etfLabel: "{name} ETF",
    commoditiesNote:
      "Fiyatlar emtianın değil fonun fiyatıdır: GLD'nin fiyatı bir ons altının fiyatı değildir. Yüzdeler fonun hareketini gösterir. USO ve UNG vadeli kontrat tutar; vade yenileme maliyeti yüzünden uzun dönemde spot fiyattan ayrışabilir.",
    cryptoNote:
      "Kripto 7/24 işlem görür, fonlar yalnızca borsa saatlerinde: hafta sonunun hareketi pazartesi açılışında topluca yansır.",

    /* ---- Piyasa Nabzı ---- */
    pulseTitle: "Piyasa Nabzı",
    pulseScale: "0 Korku · 100 İştah",
    pulseDetails: "Ayrıntılar",
    pulseLead: "Beş göstergeyle yatırımcının ruh hâli: 0 korku, 100 iştah. Her gösterge son altı aya göre puanlanır.",
    bandNoteExtremeFear: "Yatırımcı panikte, riskten kaçıyor.",
    bandNoteFear: "Yatırımcı temkinli, riskten kaçıyor.",
    bandNoteNeutral: "Ne korku ne iştah ağır basıyor.",
    bandNoteGreed: "Yatırımcı risk almaya istekli.",
    bandNoteExtremeGreed: "Coşku yüksek, iştah aşırıya kaçıyor.",
    hintVix: "Beklenen dalgalanma; yükseldikçe puan düşer",
    hintMomentum: "Endeksin {days} günlük ortalamasına uzaklığı",
    hintBreadth: "S&P 500'de yükselen hisselerin payı",
    hintCredit: "Riskli şirketlerin borç primi; açıldıkça puan düşer",
    hintSafeHaven: "Son {days} günde hisse mi tahvil mi kazandırdı",
    gaugeAria: "Piyasa nabzı 100 üzerinden {score}: {band}",
    pulseInsufficient: "Genel puan için yeterli bileşen yok",
    pulseInsufficientShort: "Yetersiz Veri",
    pulseAverageOf: "{n} Bileşenin Ortalaması",
    bandExtremeFear: "Aşırı Korku",
    bandFear: "Korku",
    bandNeutral: "Nötr",
    bandGreed: "İştah",
    bandExtremeGreed: "Aşırı İştah",
    pulseVix: "Oynaklık (VIX)",
    pulseMomentum: "S&P 500 Momentumu",
    pulseBreadth: "Piyasa Genişliği",
    pulseCredit: "Yüksek Getirili Tahvil Farkı",
    pulseSafeHaven: "Güvenli Liman Talebi",
    rawVix: "VIX {value} · {days} Günlük Ortalama {average}",
    rawCredit: "Fark {value} Puan · {days} Günlük Ortalama {average}",
    rawMomentum: "SPY, {days} Günlük Ortalamasına Göre {distance}",
    rawSafeHaven: "{days} Gün: SPY {stocks} · TLT {bonds}",
    rawBreadth: "Artıdaki Üye Payı {share}",
    pulseExtended: "Seans Dışı",
    pulseMethod:
      "Her bileşenin bugünkü okuması, kendi son 126 işlem gününün (yaklaşık altı ay) içinde yüzdelik sıraya çevrilir; VIX ve tahvil farkında sıra ters çevrilir, çünkü yükselmeleri gerginlik demektir. Genişlik doğrudan artıdaki hisselerin payıdır. Genel puan mevcut bileşenlerin ağırlıksız ortalamasıdır.",
    pulseRelative:
      "Puan göreli bir ölçüdür: son altı aya göre okunur. Sakin bir dönemin korku bölgesi, tarihsel bir krizle aynı şey değildir. Yatırım tavsiyesi değildir.",
    pulseMissing: "Hesaplanamayan bileşenler: {names}.",
    pulseMinimum: "Genel puan en az {n} bileşenle yazılır.",
    pulseNoHighsLows:
      "52 haftalık zirve ve dip sayısı kullanılmıyor: her endeks üyesi için bir yıllık fiyat geçmişi gerekiyor ve bu ekranın verisinden türetilemiyor.",
    pulseSources:
      "Kaynaklar: VIX Cboe (yedek FRED), yüksek getirili tahvil farkı ICE BofA serisi FRED üzerinden, SPY ve TLT günlük kapanışları ile S&P 500 kotasyonları Alpaca.",

    /* ---- Makro ikinci halka ---- */
    weekEnding: "{date} ile Biten Hafta",
    sahmBelow: "Eşiğin Altında",
    sahmTriggered: "Eşik Aşıldı",
    sahmNote:
      "Sahm kuralı: işsizlik oranının üç aylık ortalaması, önceki 12 ayın en düşük üç aylık ortalamasının {threshold} puan üzerine çıktığında resesyonun başladığına dair tarihsel bir sinyal verir. Gösterge sinyaldir, tahmin değil.",
    curveNormalStatus: "Normal Eğri",
    curveInvertedStatus: "Ters Eğri",
    curveNote:
      "10 yıllık tahvil faizinden 3 aylık bono faizi çıkarılır. Fark eksiye düştüğünde (ters eğri) kısa vadeli borçlanma uzun vadeliden pahalıdır; bu durum geçmişte resesyonlardan önce görülmüştür ama zamanlaması değişkendir.",
    fomcTitle: "Sonraki FOMC Kararı",
    fomcDaysLeft: "Gün Kaldı",
    fomcCalendar: "Bugünden toplantı gününe kadar günler",
    fomcProjections: "Nokta Grafiği ile",
    fomcTarget: "Mevcut Hedef Aralık",
    observed: "Gözlem",
    fomcNoPricing:
      "Piyasanın faiz beklentisini gösteren vadeli fiyatlamaya erişimimiz yok; bu yüzden karar olasılığı yazılmıyor. Tarih Fed'in yayımladığı toplantı takviminden.",

    /* ---- Takvim türleri ve temettü ---- */
    calendarKinds: "Takvim Türü",
    calendarEconomic: "Ekonomik Takvim",
    calendarDividends: "Temettü Takvimi",
    dividendTitle: "Temettü Takvimi",
    dividendSubtitle: "Endeks şirketlerinin yaklaşan hak kesim günleri, tutarları ve temettüyü almak için son alım günü",
    dividendMeta: "Önümüzdeki {weeks} Hafta · {n} Ödeme",
    /* Kahramandaki özet ve dört haftalık şerit. */
    dividendNext: "Sıradaki Hak Kesim",
    dividendNextCompanies: "Sıradaki hak kesim gününde ödeyen şirketler",
    dividendPaymentsUnit: "Ödeme",
    dividendPaymentsCount: "{n} ödeme",
    dividendMore: "+{n}",
    dividendStripLabel: "Önümüzdeki dört haftanın hak kesim günleri",
    dividendEmpty: "Bu dönemde hak kesimi olan temettü yok",
    dividendEmptyHint: "Liste endeks üyelerini kapsar; şirketler temettüyü genellikle hak kesimden birkaç hafta önce ilan eder.",
    exDate: "Hak Kesim Günü",
    lastBuy: "Almak İçin Son Gün",
    perShare: "Hisse Başı",
    special: "Özel Temettü",
    payable: "Ödeme",
    payableLong: "Ödeme Tarihi",
    yieldEstimate: "Yıllık Getiri Tahmini",
    freqMonthly: "Aylık Ödeme",
    freqQuarterly: "Çeyreklik Ödeme",
    freqSemiannual: "Altı Ayda Bir",
    freqAnnual: "Yıllık Ödeme",
    t1Rule:
      "ABD'de takas T+1: temettüyü almak için hisseyi hak kesim gününden önceki işlem gününün kapanışına kadar almış olmalısın. Hak kesim günü ya da sonrasında alınan hisse o temettüyü almaz.",
    yieldMethod:
      "Yıllık getiri tahmini son olağan temettü × yıllık ödeme sayısı ÷ son fiyattır; ödeme sıklığı geçmiş ödemelerden kanıtlanamıyorsa, ödeme özel ya da yabancı ihraççıdansa yazılmaz.",
    withholding:
      "ABD temettülerinden kaynakta vergi kesilir: Türkiye ile ABD arasındaki anlaşma gereği bireysel yatırımcıda W-8BEN formu verilmişse %20, verilmemişse %30. Tutarlar vergi öncesi, hisse başı brüttür.",
    taxGuide: "Vergi Rehberi",
    w8benGuide: "W-8BEN Nedir",
    dividendCoverage: "Kapsam: S&P 500, Nasdaq 100 ve Dow Jones üyeleri; iki sınıflı şirketler tek satır.",
    dividendSource: "Alpaca Kurumsal İşlemler",
    panelTitle: "Temettü",
    panelNone: "Son üç yılda nakit temettü ödemesi yok.",
    nextExDate: "Sıradaki Hak Kesim",
    amount: "Tutar",
    partialYear: "Kısmi Yıl",
    payments: "{n} Ödeme",
    paymentsOne: "{n} Ödeme",
    recentPayments: "Son Ödemeler",
    howTitle: "Nasıl Hesaplanıyor",
  },
  /* ---- Programatik sayfalar: sözlük, temalar, karşılaştırma çiftleri ----
     Üç yeni rota ailesinin metni; içerik (terim tanımları, tema ve çift
     paragrafları) `content/` altında, burada yalnızca arayüz. */
  glossary: {
    eyebrow: "Piyasa Terimleri",
    title: "Sözlük",
    subtitle:
      "Borsada, bilançoda ve Fed kararlarında geçen terimlerin kısa ve düz tanımı.",
    filterLabel: "Terimlerde ara",
    filterPlaceholder: "Terim ara: F/K, RSI, stopaj…",
    categoryLabel: "Kategoriye göre süz",
    allCategories: "Tümü",
    noResults: "Eşleşen Terim Yok",
    noResultsHint: "Kısaltmayı ya da Türkçe adını dene; süzgeçleri temizlemek de işe yarar.",
    count: "{count} Terim",
    letterLabel: "Baş harfe göre süz",
    clear: "Süzgeçleri Temizle",
    clearQuery: "Aramayı temizle",
    links: "{count} Bağlantı",
    metricTerms: "Terim",
    metricCategories: "Kategori",
    metricLinks: "Terimler Arası Bağlantı",
    example: "Örnek",
    conceptTitle: "Kavramın Şekli",
    conceptNote: "Kavramsal çizim; gerçek bir seriyi göstermiyor.",
    concept: {
      maturity: "Vade",
      yield: "Getiri",
      short: "Kısa",
      long: "Uzun",
      overbought: "Aşırı Alım",
      oversold: "Aşırı Satım",
      neutral: "Nötr Bölge",
    },
    neighbors: "Kategoride gezin",
    previous: "Önceki Terim",
    next: "Sonraki Terim",
    backToList: "Sözlüğe Dön",
    definition: "Tanım",
    related: "İlgili Terimler",
    guide: "Rehberde Ayrıntısı",
    metaTitle: "{term} Nedir?",
    /* Dizinin keşif yüzeyi (28 Eylül, ikinci tur): günün terimi, kategori
       atlası ve terim sayfasındaki kategori konumu. */
    spotlight: "Günün Terimi",
    readDefinition: "Tanımı Oku",
    openCategory: "Kategoriyi Aç",
    position: "Kategoride {index} / {total}",
    /* Terim penceresi (29 Eylül): kart ayrı sayfaya değil pencereye açılıyor. */
    openFull: "Terim Sayfasını Aç",
    close: "Kapat",
    peekError: "Tanım şu an yüklenemedi; terim sayfasından okuyabilirsin.",
  },
  themes: {
    eyebrow: "Tematik Listeler",
    title: "Temalar",
    subtitle:
      "Bir hikâyenin etrafında toplanan ABD hisseleri, günün hareketi ve piyasa değeriyle.",
    backToList: "Temalara Dön",
    todayTitle: "Temanın Günü",
    companies: "{count} Şirket",
    median: "Günün Medyanı",
    medianSession: "Bu Seans",
    medianLastClose: "Son Kapanış",
    medianPreMarket: "Açılış Öncesi",
    /* Sıralamanın künyesi pencereye göre tek ifade — "Günün Medyanı · Son
       Kapanış" aynı satırda iki ayrı günü söylüyordu. */
    medianPre: "Açılış Öncesi Medyanı",
    medianClose: "Son Kapanış Medyanı",
    /* Medyana giren üye sayısı, tüm üyelerden azsa (künye). */
    coverage: "{count}/{total} Üye",
    medianMissing:
      "Üyelerin yüzdeleri farklı seansları anlatıyor; iki günden tek bir medyan kurulmuyor.",
    breadth: "Yükselen / Düşen",
    tableTitle: "Şirketler",
    tableRegion: "Tema şirketleri tablosu",
    colCompany: "Şirket",
    colPrice: "Son Fiyat",
    colDay: "Günlük Değişim",
    colCap: "Piyasa Değeri",
    benchmark: "Karşılaştırma Ölçütü",
    lastClose: "Son Kapanış",
    whyTitle: "Neden Bu Şirketler",
    listNote:
      "Liste editoryal bir seçimdir, yatırım tavsiyesi değildir. Sıralama piyasa değerine göredir; ana borsası ABD dışında olan şirketlerin piyasa değeri karşılaştırılamadığı için boş kalır.",
    compareTop: "İlk Dördü Karşılaştır",
    quotesUnavailable: "Fiyatlar şu an alınamadı; liste fiyatsız gösteriliyor.",
    katilimPool:
      "Endeks üyeleri arasından piyasa değeri en büyük {pool} şirket tarandı; ön elemeyi geçenlerin en büyük {max} tanesi gösteriliyor.",
    katilimEmpty:
      "Bugün ön elemeyi geçen şirket bulunamadı ya da bilanço oranları alınamadı.",
    /* GÖRSEL KATMAN (28 Eylül): dizinin sıralaması ve dağılım şeridi,
       detayın kare haritası, ölçüt kıyası ve sıralanabilir tablo. */
    rankTitle: "Günün Sıralaması",
    rankTitlePre: "Açılış Öncesi Sıralaması",
    /* Sıralamanın künyesi yalnızca ÖLÇÜYÜ söylüyor; pencere başlıkta.
       "Açılış Öncesi Sıralaması · Açılış Öncesi Medyanı" 768 pikselde
       başlık satırını ikiye kırıyordu (ölçüldü). */
    rankMeta: "Üye Medyanı",
    rankTitleClose: "Son Kapanış Sıralaması",
    strongest: "Günün En Güçlüsü",
    weakest: "Günün En Zayıfı",
    strongestPre: "Açılış Öncesi En Güçlü",
    weakestPre: "Açılış Öncesi En Zayıf",
    strongestClose: "Son Kapanışta En Güçlü",
    weakestClose: "Son Kapanışta En Zayıf",
    /* Kapaktaki günün özeti (28 Eylül). */
    themesRising: "Yükselen Tema",
    themesFalling: "Düşen Tema",
    /* Kapaktaki oran çubuğunun başlığı (29 Eylül). */
    themesBreadth: "Temaların Yönü",
    up: "Yükselen",
    down: "Düşen",
    spreadLabel: "{count} üyenin hareketi: {up} yükselen, {down} düşen.",
    spreadMissing: "Üyelerin hareketi henüz aynı seansı anlatmıyor.",
    mapTitle: "Temanın Haritası",
    mapHint: "Karo boyu piyasa değerini, rengi günün hareketini gösterir.",
    mapLastClose:
      "Yüzdeler son kapanışa ait; yön rengi yalnızca bu seansın hareketinde kullanılır.",
    mapUnsized: "Piyasa Değeri Karşılaştırılamayan",
    /* Haritanın küçük üyeleri ve künye kartı (28 Eylül). */
    mapSmall: "Diğer {count}",
    mapSmallTitle: "Haritada Küçük Kalanlar",
    mapShare: "Temadaki Payı",
    mapOpen: "Şirkete Git",
    benchTitle: "Ölçütle Kıyas",
    benchMedian: "Tema Medyanı",
    benchAbove: "Tema medyanı ölçütün {diff} puan üstünde.",
    benchBelow: "Tema medyanı ölçütün {diff} puan altında.",
    benchEven: "Tema medyanı ölçütle aynı yerde.",
    benchMixed: "Tema ve ölçüt farklı seansları anlatıyor; kıyas kurulmuyor.",
    best: "En Güçlü Üye",
    worst: "En Zayıf Üye",
    otherThemes: "Diğer Temalar",
    sortBy: "{column} sütununa göre sırala",
  },
  pairs: {
    eyebrow: "Karşı Karşıya",
    title: "{names}",
    metaTitle: "{names} Karşılaştırması",
    subtitle:
      "Aynı grafikte, aynı ölçekte: getiri, değerleme ve risk ölçüleri yan yana.",
    introTitle: "Bu İkili Neden Karşılaştırılır",
    others: "Diğer Karşılaştırmalar",
    /* Kahramanda iki şirketin arasındaki mühür ve paylaştırma çubuğu. */
    versus: "ve",
    capShare: "Toplam Piyasa Değerinden Pay",
    joiner: " ve ",
  },
  /* HİSSE SAYFASININ DERİNLİK PANELLERİ (28 Eylül) — içeriden işlemler,
     beklenen hareket, analist dağılımı değişimi, skor kartı, teknik
     fotoğraf ve şirket özeti. Ayrı ad alanı: `stock` bloğu zaten yüz
     altmış satır ve bu paneller kendi kaynaklarını ve kendi künyelerini
     taşıyor. `{ek}` Türkçe ek yer tutucusu (lib/scorecard.ts → trAblative);
     İngilizce metinde yok. */
  /* Değerleme oranları — canlı fiyattan kurulanlar (2 Ekim). */
  valuation: {
    priceToBook: "PD/DD",
  },

  /* Analist kartındaki ortalama hedef fiyat şeridi (30 Eylül). Kaynak en son
     bilanço analizi; künye hangi analizden ve hangi tarihte olduğunu söyler. */
  /* Portföyde teknik analizi yapılan pozisyonların planı (2 Ekim). */
  portfolioTechnical: {
    title: "Teknik Plan",
    meta: "{n} Pozisyon Teknik Analizde",
    metaOne: "1 Pozisyon Teknik Analizde",
    intro: "Portföyündeki hisselerden günlük teknik analizi yapılanların alım bölgesi, satış hedefleri ve stop seviyesi.",
    avgCost: "Maliyetin",
    toTarget: "İlk Hedefe",
    toSellLevel: "İlk Satış Seviyesine",
    targetsPassed: "Hedefler Geçildi",
    toStop: "Stopa",
    belowStop: "Stopun Altında",
    stopVsCost: "Stop Maliyetinin {dir}",
    stopAboveCost: "Üstünde",
    stopBelowCost: "Altında",
    note: "Seviyeler günlük teknik analizden gelir ve her yayında yenilenir; uzaklıklar pozisyon tablosundaki fiyatla hesaplanır. Yatırım tavsiyesi değildir.",
  },
  /* Hisse seçimi (3 Ekim) — kural tabanlı eleme ve uyum puanı. */
  screening: {
    eyebrow: "Önce Ele, Sonra İncele",
    title: "Hisse Seçimi",
    description: "Bir hisseyi incelemeye değer kılan kuralları elimizdeki verilerle ölç: büyüklük, büyüme, kârlılık, sağlık, fiyat gücü ve sahiplik.",
    pickLabel: "Hisse Seç",
    pickPlaceholder: "Örn. MU",
    pickAction: "Kuralları Uygula",
    pickHint: "Takip edilen ABD hisselerinden birini yaz; değerlendirme sitenin kendi verileriyle yapılır.",
    quickTitle: "Hızlı Bakış",
    quickMeta: "Teknik Analizde Takip Edilen {n} Hisse",
    quickNote: "Puanlar kurallara uyumu ölçer; sıralama bir alım listesi değil, araştırma sırasıdır.",
    rulesTitle: "Kurallar",
    rulesMeta: "{n} Ölçülebilir Kural",
    rulesIntro: "Kurallar iki işe yarar: zayıf adayları baştan elemek ve güçlü adayları neden güçlü olduklarıyla göstermek. Eşikler yaygın büyüme hissesi taramalarının tabanlarıdır.",
    whyLabel: "Neden",
    measureLabel: "Nasıl Ölçülüyor",
    stepsTitle: "Nasıl Kullanılır",
    steps: [
      { title: "Ele", body: "Küçük, sığ ve nakdi tükenen şirketler eleme kurallarına takılır; bunlar puanı ne olursa olsun araştırma listesinin dışında kalır." },
      { title: "Ölç", body: "Büyüme, kârlılık, sağlık ve fiyat gücü kuralları geçti, dikkat ya da kaldı diye işaretlenir; ölçülemeyen kural puana girmez." },
      { title: "İncele", body: "Puan bir başlangıç noktası. Şirketin hikâyesini, değerlemesini ve grafiğini ayrıca oku; sıradaki adımlar listesi nereden başlayacağını söyler." },
      { title: "Bekle", body: "Her fırsatı yakalamak zorunda değilsin. Kuralları rahatça geçen aday çıkana kadar beklemek de bir karardır." },
    ],
    principlesTitle: "Üç İlke",
    principles: [
      { title: "Düşmüş Hisse Ucuz Değildir", body: "Zirvesinin yarısına inmiş bir hisse çoğu zaman bir sebeple indi. Fiyatın eskiden ne olduğu bugünkü değerini anlatmaz." },
      { title: "Taramadan Geçmek Alım Sebebi Değildir", body: "Kurallar araştırmaya değer adayı bulur. Alım kararı şirketi, değerlemeyi ve riski ayrıca tartmayı ister." },
      { title: "Büyümenin Bir Nedeni Olmalı", body: "Yeni bir ürün, sözleşme, yönetim değişikliği ya da sektör dönüşümü: beklentinin arkasında somut bir neden aranır." },
    ],
    categories: {
      gate: "Eleme",
      growth: "Büyüme",
      profitability: "Kârlılık",
      health: "Finansal Sağlık",
      strength: "Fiyat Gücü",
      ownership: "Sahiplik",
      catalyst: "Katalizör Sinyalleri",
    },
    categoryWhy: {
      gate: "Çok küçük ya da az işlem gören hisselerde fiyat birkaç emirle oynar; gerektiğinde çıkamayacağın pozisyon taşınmaz.",
      growth: "Fiyatı uzun vadede taşıyan hisse başına kârdır. Kârın çift haneli büyümesi ve satışın onu desteklemesi aranır.",
      profitability: "Büyüyen ama zarar eden şirket büyümeyi finansmana borçludur; kâr eden şirket kendi büyümesini taşır.",
      health: "Nakdi tükenen şirket ya borçlanır ya da yeni hisse çıkarır; ikisi de mevcut ortağın payını küçültür.",
      strength: "Piyasa iyi şirketi genellikle fiyatıyla önceden fark eder. Sektörünün ve endeksin gerisinde kalan hisse sırasını beklemez.",
      ownership: "Hisse sayısı sürekli artıyorsa şirket büyüse bile hisse başına düşen değer büyümez. Başarılı fonların ilgisi ikinci bir teyittir.",
      catalyst: "Analist beklentisinin yönü, hedef fiyata potansiyel ve son bilançonun niteliği büyümenin arkasındaki nedeni dolaylı olarak gösterir.",
    },
    checks: {
      marketCap: { name: "Piyasa Değeri", rule: "En az 300 milyon dolar" },
      price: { name: "Hisse Fiyatı", rule: "En az 5 dolar" },
      liquidity: { name: "Likidite", rule: "Günde ortalama 500 bin adet ve 10 milyon dolar" },
      epsGrowthQ: { name: "Çeyreklik EPS Büyümesi", rule: "Geçen yılın aynı çeyreğine göre en az %10" },
      salesGrowthQ: { name: "Çeyreklik Satış Büyümesi", rule: "Geçen yılın aynı çeyreğine göre en az %10" },
      epsGrowth3Y: { name: "Üç Yıllık EPS Büyümesi", rule: "Yıllıklandırılmış en az %10" },
      growthSource: { name: "Büyümenin Kaynağı", rule: "Kâr büyürken satış da en az %5 büyümeli" },
      profitable: { name: "Kârlılık", rule: "Son on iki ayda hisse başına kâr pozitif" },
      margins: { name: "Marjlar", rule: "Brüt, faaliyet ve net marj pozitif" },
      currentRatio: { name: "Cari Oran", rule: "En az 1 — kısa vadeli varlık borçları karşılamalı" },
      debt: { name: "Borç / Özsermaye", rule: "En fazla 1; 2'nin üstü kaldı" },
      runway: { name: "Nakit Pisti", rule: "Serbest nakit akışı pozitif ya da en az iki yıllık nakit" },
      vsMarket: { name: "Piyasaya Göre", rule: "Altı aylık getiri S&P 500'ün gerisinde değil" },
      vsSector: { name: "Sektörüne Göre", rule: "Altı aylık getiri sektör fonunun gerisinde değil" },
      aboveLow: { name: "52 Haftalık Dipten Uzaklık", rule: "Dibin en az %30 üstünde" },
      nearHigh: { name: "52 Haftalık Zirveye Uzaklık", rule: "Zirvenin en fazla %25 altında" },
      dilution: { name: "Sulandırma", rule: "Hisse sayısı yılda en fazla %2 artmalı" },
      funds: { name: "Ünlü Fon İlgisi", rule: "Takip edilen fonlarda artıranlar azaltanlardan az değil" },
      insiders: { name: "İçeriden İşlemler", rule: "Son altı ayda güçlü net satış yok" },
      analystTrend: { name: "Analist Eğilimi", rule: "Al önerilerinin payı üç ayda artıyor" },
      upside: { name: "Hedef Fiyata Potansiyel", rule: "Ortalama hedefe en az %10" },
      earningsQuality: { name: "Son Bilançonun Niteliği", rule: "Bilanço analizi skoru en az 60" },
    },
    pro: {
      marketCap: "Piyasa değeri {value}; büyüklük tabanının rahatça üstünde.",
      price: "Hisse fiyatı {value}; kuruşluk hisse bölgesinin dışında.",
      liquidity: "Günde ortalama {value} adet işlem görüyor; pozisyon rahatça açılıp kapanır.",
      epsGrowthQ: "Hisse başına kâr son çeyrekte yıllık {value} büyüdü.",
      salesGrowthQ: "Satışlar son çeyrekte yıllık {value} büyüdü.",
      epsGrowth3Y: "Hisse başına kâr üç yıldır yılda ortalama {value} büyüyor.",
      growthSource: "Kâr büyümesi satış büyümesiyle destekleniyor.",
      profitable: "Son on iki ayda hisse başına {value} kâr etti.",
      margins: "Brüt, faaliyet ve net marjların hepsi pozitif; faaliyet marjı {value}.",
      currentRatio: "Cari oran {value}; kısa vadeli borçları rahatça karşılıyor.",
      debt: "Borç / özsermaye {value}; borç yükü hafif.",
      runway: "Serbest nakit akışı pozitif; şirket kendi nakdini üretiyor.",
      vsMarket: "Son altı ayda S&P 500'ü {value} geride bıraktı.",
      vsSector: "Son altı ayda sektörünü {value} geride bıraktı.",
      aboveLow: "Fiyat 52 haftalık dibinin {value} üstünde.",
      nearHigh: "Fiyat 52 haftalık zirvesine yakın; zirvenin {value} altında.",
      dilution: "Hisse sayısı yılda {value} değişti; ortaklık payı korunuyor.",
      funds: "Takip edilen ünlü fonlardan {value} tanesi pozisyonda ve ilgi azalmıyor.",
      insiders: "Son altı ayda içeriden net alım var.",
      analystTrend: "Al önerilerinin payı üç ayda {value} arttı.",
      upside: "Ortalama hedef fiyata {value} potansiyel var.",
      earningsQuality: "Son bilanço analizinin skoru {value}.",
    },
    con: {
      marketCap: "Piyasa değeri {value}; 300 milyon dolarlık tabanın altında, eleme kuralına takılıyor.",
      price: "Hisse fiyatı {value}; 5 doların altında, eleme kuralına takılıyor.",
      liquidity: "İşlem hacmi sığ: günde ortalama {value} adet.",
      epsGrowthQ: "Hisse başına kâr son çeyrekte yıllık {value} değişti; %10'luk tabanın altında.",
      salesGrowthQ: "Satışlar son çeyrekte yıllık {value} değişti; %10'luk tabanın altında.",
      epsGrowth3Y: "Üç yıllık kâr büyümesi yılda {value}; %10'luk tabanın altında.",
      growthSource: "Kâr büyüyor ama satış büyümesi {value}; büyüme işin kendisinden gelmiyor olabilir.",
      profitable: "Son on iki ayda hisse başına {value}; şirket zarar ediyor.",
      margins: "Marjların en az biri negatif; faaliyet marjı {value}.",
      currentRatio: "Cari oran {value}; kısa vadeli borçlar dönen varlıklardan fazla.",
      debt: "Borç / özsermaye {value}; borç yükü ağır.",
      runway: "Nakit yakıyor; eldeki nakit bu hızla yaklaşık {value} yıl yeter.",
      vsMarket: "Son altı ayda S&P 500'ün {value} gerisinde kaldı.",
      vsSector: "Son altı ayda sektörünün {value} gerisinde kaldı.",
      aboveLow: "Fiyat 52 haftalık dibine yakın; dibin yalnızca {value} üstünde.",
      nearHigh: "Fiyat 52 haftalık zirvesinin {value} altında.",
      dilution: "Hisse sayısı yılda {value} arttı; mevcut ortakların payı küçülüyor.",
      funds: "Takip edilen ünlü fonlarda azaltanlar artıranlardan fazla.",
      insiders: "Son altı ayda içeriden güçlü net satış var.",
      analystTrend: "Al önerilerinin payı üç ayda {value} düştü.",
      upside: "Ortalama hedef fiyata potansiyel {value}; sınırlı.",
      earningsQuality: "Son bilanço analizinin skoru {value}; zayıf bir çeyrek.",
    },
    suggestions: {
      catalyst: "Büyümeyi taşıyacak somut nedeni yaz: yeni ürün, sözleşme, yönetim ya da sektör dönüşümü. Bir cümleyle anlatamıyorsan beklemek daha iyi bir seçenek olabilir.",
      fallen: "Hisse zirvesinden çok uzak. Düşüşün nedenini (bilanço, rekabet, sektör) bulmadan ucuzladı diye değerlendirme; dönüşün teyidini fiyattan bekle.",
      earlyBase: "Fiyat dibinden yeni ayrılıyor. Trendin oturduğunu görmek için 50 ve 200 günlük ortalamaların üzerine kalıcı çıkışı izle.",
      laggard: "Piyasa ya da sektör yükselirken geride kalıyor. Aynı sektörün öncüleriyle karşılaştır; geride kalmanın bir nedeni olabilir.",
      earningsSoon: "Bilanço {days} gün sonra. Sonuç fiyatı sert oynatabilir; bu riski hesaba kat.",
      dilution: "Hisse sayısı artıyor. Büyümenin ne kadarının hisse başına kaldığına bak: geri alım mı var, yeni hisse ihracı mı?",
      growthSource: "Kâr satıştan hızlı büyüyor. Marj genişlemesinin kalıcı mı (fiyatlama gücü) yoksa geçici mi (maliyet kesintisi, tek seferlik kalem) olduğunu kontrol et.",
      burn: "Şirket nakit yakıyor. Son bilançoda finansman planına (borç, hisse ihracı, nakit tamponu) bak.",
      richValuation: "İleri F/K {pe}. Beklentinin büyük kısmı fiyatlanmış olabilir; değerlemeyi sektördeki benzerleriyle karşılaştır.",
      liquidity: "İşlem hacmi düşük. Alım-satım farkı ve büyük emirlerin fiyatı oynatma riski var.",
    },
    bands: {
      strong: "Güçlü Aday",
      worth: "Araştırmaya Değer",
      mixed: "Karışık Tablo",
      weak: "Zayıf",
      eliminated: "Eleme Kuralına Takıldı",
      limited: "Veri Yetersiz",
    },
    bandHints: {
      strong: "Kuralların büyük çoğunluğunu rahatça geçiyor. Sıradaki iş hikâyeyi ve değerlemeyi incelemek.",
      worth: "Güçlü yanları ağır basıyor; zayıf yanların nedenini anlamak için araştırmaya değer.",
      mixed: "Güçlü ve zayıf yanlar dengede. Kalan kuralların neden geçmediği kararı belirler.",
      weak: "Kuralların çoğunda geride. Bu yaklaşımla öncelikli bir aday değil.",
      eliminated: "Eleme kurallarından en az birine takılıyor; puanı ne olursa olsun bu yaklaşımda araştırma listesine girmez.",
      limited: "Kuralların yeterince büyük bir kısmı ölçülemedi; puan bir hüküm vermiyor.",
    },
    status: { pass: "Geçti", warn: "Dikkat", fail: "Kaldı", na: "Veri Yok", notApplicable: "Uygulanmaz" },
    reportTitle: "{symbol} Kural Kontrolü",
    scoreLabel: "Uyum Puanı",
    coverage: "Kuralların %{n} Kadarı Ölçüldü",
    categoriesTitle: "Kategoriler",
    checksTitle: "Kural Kural",
    prosTitle: "Güçlü Yanlar",
    consTitle: "Zayıf Yanlar",
    nextTitle: "Sıradaki Adımlar",
    manualTitle: "Senin Kontrol Edeceklerin",
    manual: [
      "Büyümeyi taşıyacak somut bir neden var mı ve bunu bir cümleyle anlatabiliyor musun?",
      "Değerleme sektördeki benzerlerine göre nerede duruyor?",
      "Grafik trendi teyit ediyor mu, yoksa düşen bir fiyata mı karşı geliyorsun?",
      "Pozisyon büyüklüğü, yanılırsan kaldırabileceğin kaybı aşmıyor mu?",
    ],
    financialNote: "Banka ve sigortada cari oran, borç / özsermaye ve serbest nakit akışı işin doğası gereği farklı okunur; bu kurallar uygulanmaz.",
    noneLabel: "Yok",
    links: { company: "Şirket Sayfası", technical: "Teknik Analiz", analysis: "Son Bilanço Analizi", compare: "Piyasayla Karşılaştır" },
    methodNote: "Puan, ölçülebilen kuralların kategori ağırlıklarıyla ortalamasıdır: büyüme 30, fiyat gücü 20, kârlılık 15, sağlık 15, sahiplik 10, katalizör 10. Geçti tam, dikkat yarım puan; ölçülemeyen kural puana girmez. Eleme kuralına takılan hissenin puanı 45 ile sınırlıdır.",
    sourcesNote: "Kaynaklar: fiyat Alpaca, temel finansallar ve analist dağılımı Finnhub, hisse sayısı SEC dosyaları, ünlü fonlar 13F bildirimleri, hedef fiyat ve bilanço skoru sitenin kendi analizleri.",
    notAdvice: "Bu bir yatırım tavsiyesi değildir; kurallara uyumu ölçen bir araştırma aracıdır.",
    notFoundTitle: "Bu Sembol Değerlendirilemedi",
    notFoundBody: "Sembol için fiyat ya da şirket bilgisi alınamadı. Yazımı kontrol et ya da biraz sonra yeniden dene.",
    stockLink: "Kural Kontrolü",
    shareTitle: "Bu Kural Kontrolünü Paylaş",
    reportSubtitle: "{name} kuralların karşısında: hangi kuralı geçiyor, hangisinde geride ve sırada ne var.",
    metaReport: "{name} ({symbol}) hisse seçimi kurallarına göre: büyüme, kârlılık, finansal sağlık, fiyat gücü ve sahiplik kontrolleri, artı ve eksi yönler.",
    unitPoints: "{n} Puan",
    unitPointsText: "{n} puan",
    unitYears: "{n} Yıl",
    unitShares: "{n} Adet",
    unitFunds: "{n} Fon",
    outOf: "/ 100",
    colRule: "Kural",
    colValue: "Ölçü",
    colStatus: "Durum",
    weight: "Ağırlık {n}",
    measured: "{m}/{n} Ölçüldü",
    marketCapLabel: "Piyasa Değeri",
    priceLabel: "Fiyat",
    earningsLabel: "Sonraki Bilanço",
    earningsIn: "{days} Gün Sonra",
    earningsToday: "Bugün",
    linksLabel: "İlgili sayfalar",
    openReport: "Raporu Aç",
    quickUnavailable: "Hızlı bakış şu an hesaplanamadı; tek tek semboller yine açılıyor.",
    otherTitle: "Başka Bir Hisse",
  },
  analystTarget: {
    current: "Güncel Ortalama Hedef",
    range: "Hedef Aralığı",
    label: "Ortalama Hedef Fiyat",
    upside: "Potansiyel",
    analysts: "{n} Analist",
    from: "{period} Analizinden · {date}",
  },

  stockDepth: {
    insiderTitle: "İçeriden İşlemler",
    insiderWindow: "Son 90 Gün",
    insiderBuy: "Açık Piyasa Alım",
    insiderSell: "Açık Piyasa Satış",
    insiderNet: "Net",
    insiderPersonOne: "{n} Kişi",
    insiderPersonMany: "{n} Kişi",
    insiderNoOpenMarket:
      "Son 90 günde açık piyasadan alım ya da satış yok; listedeki hareketler ödül, vergi kesintisi, hediye ya da opsiyon kaynaklı.",
    insiderEmpty: "Son 90 günde dosyalanmış içeriden işlem yok.",
    insiderEmptyHint:
      "ABD dışındaki ihraççılar Form 4 dosyalamak zorunda değil; ADR'lerde bu liste çoğu zaman boştur.",
    insiderColDate: "Tarih",
    insiderColName: "Kişi",
    insiderColType: "İşlem",
    insiderColShares: "Pay",
    insiderColPrice: "Fiyat",
    insiderColValue: "Tutar",
    insiderDerivative: "Türev",
    /* Kişinin görevi — Form 4'ün bildirim sahibi bayraklarından. Unvanın
       kendisi lib/insider-people.ts'teki parça sözlüğüyle çevriliyor. */
    insiderRoleDirector: "Yönetim Kurulu Üyesi",
    insiderRoleTenPercent: "%10 Hissedar",
    insiderRoleOfficer: "Üst Yönetici",
    insiderRolesNote:
      "İsmin altındaki görev, kişinin son Form 4 dosyasındaki beyanından okunur; dosya okunamadığında satır yalnızca isimle kalır. Sözlükte karşılığı olmayan unvanlar dosyadaki hâliyle, İngilizce yazılır.",
    insiderMore: "Tabloda en yeni {shown} işlem var; daha eski {n} işlem listelenmedi.",
    /* Dar ekranda katlanan satırların anahtarı (FoldToggle). */
    insiderShowMore: "{n} İşlem Daha Göster",
    investorsShowMore: "{n} Yatırımcı Daha Göster",
    peersShowMore: "{n} Şirket Daha Göster",
    insiderCodes: {
      P: "Açık Piyasa Alım",
      S: "Açık Piyasa Satış",
      A: "Hisse Ödülü",
      D: "Şirkete Devir",
      F: "Vergi Kesintisi",
      M: "Opsiyon Kullanımı",
      X: "Opsiyon Kullanımı",
      O: "Opsiyon Kullanımı",
      C: "Dönüştürme",
      G: "Hediye",
      J: "Diğer",
      K: "Swap",
      I: "Takdirî İşlem",
      W: "Miras",
      V: "Gönüllü Bildirim",
      E: "Vade Sonu",
      H: "Vade Sonu",
      U: "Devralma Teklifi",
      L: "Küçük Alım",
      Z: "Oy Tröstü",
    },
    insiderCodeOther: "Diğer ({code})",
    insiderPriceDropped:
      "{n} işlemin fiyatı hisse fiyatıyla tutmuyor (kayıt başka bir menkulün ya da para biriminin fiyatını taşıyor olabilir); bu işlemlerin fiyatı ve tutarı gösterilmiyor, özete katılmıyor.",
    /* Panelin okuma katmanı (29 Eylül): işlem çipi, alım/satış dengesi
       çubuğu, MSPR ekseninin yön etiketleri ve notları toplayan "Nasıl
       Okunur" açılır satırı. Gerekçe InsiderPanel.tsx başında. */
    insiderChipBuy: "Alım",
    insiderChipSell: "Satış",
    insiderBalance: "Alım ve Satış Dengesi",
    insiderBalanceShare: "Alım %{buy} · Satış %{sell}",
    insiderLegend:
      "Renkli çipler açık piyasa kararlarıdır; sönük satırlar ödül, vergi kesintisi, hediye ya da opsiyon kullanımı gibi karar olmayan hareketlerdir.",
    insiderHowTitle: "Nasıl Okunur",
    howRead: "Nasıl Okunur",
    sentimentLatest: "Son Değer ({month}): {value}",
    sentimentTitle: "Aylık Alım Oranı (MSPR)",
    sentimentNote:
      "MSPR −100 ile 100 arasında: 100 o ay yalnızca alım, −100 yalnızca satış demek. Boş ay, kaynakta o ay için hesaplanmış bir değer olmadığını gösterir; son aylar kaynağa gecikmeli düşebilir.",
    insiderNote:
      "Satırlar SEC Form 4 dosyalarından; aynı dosyanın parçaları tek işlem olarak birleştirildi. Özet yalnızca açık piyasa alım ve satışlarını sayar: ödül, vergi kesintisi, hediye ve opsiyon kullanımı bir alım satım kararı değildir. Önceden planlanmış (10b5-1) satışlar kaynakta ayrıca işaretlenmez.",

    emTitle: "Beklenen Hareket",
    emHowTitle: "Nasıl Hesaplanıyor",
    emImplied: "Opsiyonların Fiyatladığı",
    emImpliedDetail: "{expiry} Vadesi · {strike} Kullanım · Straddle {straddle}",
    emIndicative: "Gösterge Fiyat",
    emImpliedNote:
      "Başa baş alım ve satım opsiyonlarının orta fiyatları toplamının hisse fiyatına oranı. Vadeye kadar olan bütün hareketi fiyatlar, yalnızca bilançoyu değil. Kotasyonlar türetilmiş gösterge beslemesinden gelir, OPRA'nın kendisi değildir.",
    emReason: {
      "no-quotes": "Bu vade için opsiyon kotasyonu alınamadı.",
      "wide-spread":
        "Başa baş opsiyonların alış satış aralığı çok geniş; orta fiyat güvenilir bir tahmin olmadığı için sayı gösterilmiyor.",
      "no-atm": "Hisse fiyatına yakın bir kullanım fiyatında kotasyon yok.",
      "no-expiry": "Raporu kapsayan bir opsiyon vadesi bulunamadı.",
      stale: "Opsiyon kotasyonları güncel değil; sayı gösterilmiyor.",
      "bad-spot": "Hisse fiyatı alınamadığı için oran kurulamadı.",
    },
    emHistory: "Geçmiş Raporların Ertesinde",
    emAverage: "Ortalama Mutlak Hareket",
    emAverageCount: "Son {n} Rapor",
    emAverageTooFew: "Ortalama için en az {n} ölçülmüş rapor gerekiyor.",
    emHistoryEmpty: "Bu şirket için kayıtlı geçmiş rapor tarihi henüz yok.",
    emColReport: "Rapor",
    emColTiming: "Zaman",
    emColMove: "Hareket",
    emTimingUnknown: "Saat Bilinmiyor",
    emBarsMissing: "Fiyat Yok",
    emHistoryNote:
      "Açılış öncesi raporda önceki kapanıştan rapor gününün kapanışına, kapanış sonrası raporda rapor gününün kapanışından ertesi seansın kapanışına kadar ölçülür. Saati bilinmeyen rapor ortalamaya girmez. Rapor tarihleri sitenin kendi takviminden; takvim biriktikçe liste sekiz rapora uzar.",

    atTitle: "Analist Dağılımı Değişimi",
    atChange: "Değişim",
    /* Telefonda sütun başlığı — altı sütun kaydırmasız sığsın diye. */
    atChangeShort: "Fark",
    atTotal: "Toplam",
    atBuyShare: "Al Tarafı",
    atNote:
      "Aylık dağılımın net değişimi: bir kovadaki artış not değiştiren ya da yeni katılan analistten gelebilir. Tek tek not ve hedef fiyat kaynakta yok.",

    scTitle: "Hisse Skor Kartı",
    scPeers: "{n} Şirket",
    scAxes: {
      valuation: "Değerleme",
      growth: "Büyüme",
      profitability: "Kârlılık",
      health: "Bilanço Sağlığı",
      momentum: "Momentum",
    },
    scSentence: {
      valuation: "Sektörünün %{p}{ek} ucuz",
      growth: "Sektörünün %{p}{ek} hızlı büyüyor",
      profitability: "Sektörünün %{p}{ek} kârlı",
      health: "Borç ve likiditede sektörünün %{p}{ek} önde",
      momentum: "Son 6 ayda sektörünün %{p}{ek} önde",
    },
    scMetrics: {
      earningsYield: "Kâr Getirisi",
      salesYield: "Satış Getirisi",
      revenueGrowth: "Gelir Büyümesi",
      epsGrowth: "EPS Büyümesi",
      operatingMargin: "Faaliyet Marjı",
      netMargin: "Net Marj",
      roe: "Özsermaye Getirisi",
      debtToEquity: "Borç / Özsermaye",
      currentRatio: "Cari Oran",
      momentum: "6 Aylık Getiri",
    },
    scNote:
      "Aynı GICS sektöründeki endeks üyeleri arasında konum; not ya da tavsiye değil. Çentikler şirketler, dikey çizgi medyan. Değerleme canlı fiyatla kurulur.",
    scStrip: "Sektördeki {n} şirketin dağılımı: medyan {m}, bu şirket {p}",
    scOldest: "En Eski Ölçü {date}",

    tsTitle: "Teknik Fotoğraf",
    tsAsOf: "{date} Kapanışı",
    tsMa20: "20 Günlük Ortalama",
    tsCrossGolden: "50 Günlük Ortalama 200 Günlüğün Üstüne Geçti",
    tsCrossDeath: "50 Günlük Ortalama 200 Günlüğün Altına İndi",
    tsNote:
      "Göstergeler son tamamlanmış seansın kapanışından hesaplanır ve yorum içermez; aynı hesap Teknik Analiz sayfasındaki hisselerde de kullanılıyor. 50, 100 ve 200 günlük ortalamalar Değerleme bölümündeki panelde.",

    sumTitle: "Şirket Özeti",
    sumNextApprox: "{clock} · {window}",
    sumIndexOne: "{ad}, {list} endeksinin üyesi.",
    sumIndexMany: "{ad}, {list} endekslerinin üyesi.",
    sumSector: "Şirket {sektor} sektöründe yer alıyor.",
    sumSectorSub: "Şirket {sektor} sektöründe, {alt} alt sektöründe yer alıyor.",
    sumNext: "Sonraki bilanço {date} tarihinde {window} açıklanacak.",
    sumNextUnknown: "Sonraki bilanço {date} tarihinde bekleniyor; açıklama saati henüz belli değil.",
    sumPeers: "Aynı alt sektörde {n} endeks şirketi daha var.",
    sumGuides: "İlgili Rehber",
    sumFactIndex: "Endeks Üyeliği",
    sumFactSector: "Sektör",
    sumFactSub: "Alt Sektör",
    sumFactNext: "Sonraki Bilanço",
    sumFactPeers: "Aynı Alt Sektörde",
    sumPeerCount: "{n} Endeks Şirketi",
    listJoin: " ve ",
    metaIndex: "{list} üyesi.",
    metaNext: "Sonraki bilanço: {date}.",
  },
  /* ==========================================================================
     TL perspektifi, vergi hesaplayıcısı ve portföy (gerekçeler lib/fx.ts ve
     lib/tax.ts başında). Tek ad alanı: dört ekranın ortak kur dili burada.
     ========================================================================== */
  lira: {
    compare: {
      currencyLabel: "Para Birimi",
      currencies: { usd: "USD", tl: "TL", reel: "Reel TL" },
      currencyLongs: {
        usd: "Dolar Cinsinden",
        tl: "Lira Cinsinden",
        reel: "Enflasyondan Arındırılmış Lira",
      },
      currencyAnnounce: "Para birimi {currency} olarak değiştirildi",
      periodColumns: {
        usd: "{range} Getirisi",
        tl: "{range} TL Getirisi",
        reel: "{range} Reel Getiri",
      },
      partUsd: "USD",
      partFx: "Kur",
      partTl: "TL",
      partInflation: "TÜFE",
      fxNote:
        "Kur: {from} {fromRate} ₺, {to} {toRate} ₺ ({pct}). TCMB döviz alış, bülten günleriyle.",
      fxPathNote:
        "Uçlar TCMB'nin günlük kuru; aradaki aylar FRED aylık ortalaması, noktalar arası doğrusal. Dönem getirisi yalnızca iki uçtan hesaplanır.",
      fxPathFlat:
        "Aylık kur serisi alınamadı; grafikte ara noktalar iki uç arasında doğrusal. Dönem getirisi bundan etkilenmez.",
      cpiNote:
        "TÜFE: {from} ile {to} arası {pct} (TCMB EVDS, 2025=100). Son açıklanan aydan sonrası için enflasyon sıfır sayılır.",
      fxPathShort:
        "Aralık kısa; aradaki günler iki ucun günlük kuru arasında doğrusal. Dönem getirisi yalnızca iki uçtan hesaplanır.",
      multiplyNote:
        "Bileşenler toplanmaz, çarpılır: (1 + USD getirisi) × (1 + kur değişimi) − 1 = TL getirisi.",
      fxFailed: "Kur Alınamadı",
      fxFailedHint: "TCMB bültenine ya da enflasyon verisine şu an ulaşılamıyor; dolar görünümü çalışıyor.",
    },
    chart: {
      currencyGroup: "Para Birimi",
      usd: "USD",
      tl: "TL",
      usdLong: "Dolar Cinsinden",
      tlLong: "Lira Cinsinden",
      fxNote: "TL: TCMB döviz alış, {from} {fromRate} ₺ ile {to} {toRate} ₺ arası.",
      fxMonthly: "Ara aylar FRED aylık ortalaması, noktalar arası doğrusal.",
      fxLinear: "Aradaki günler iki uç arasında doğrusal.",
      fxFailed: "Kur alınamadı; grafik dolar cinsinden gösteriliyor.",
    },
    favorites: {
      tlNote: "TL karşılıkları TCMB döviz alış kuruyla: 1 USD = {rate} ₺ ({date} bülteni).",
      tlUnavailable: "Kur alınamadı; TL karşılıkları şu an gösterilmiyor.",
    },
    tax: {
      eyebrow: "Hesaplayıcı",
      title: "Yurt Dışı Hisse Vergisi",
      subtitle:
        "Sattığın hisse ve aldığın temettü için beyan gerekip gerekmediğini ve tahmini vergiyi gör. Hesap tarayıcında kalır, hiçbir şey kaydedilmez.",
      paths: {
        label: "Sorunu Seç",
        saleTitle: "Hisse Sattım",
        saleHint: "Kazanç, Matrah ve Tahmini Vergi",
        dividendTitle: "Temettü Aldım",
        dividendHint: "Beyan Sınırı ve ABD Stopajı",
        filingTitle: "Ne Zaman Beyan Ederim?",
        filingHint: "Takvim, Yer ve Belgeler",
      },
      calcTitle: "Vergini Hesapla",
      modeLabel: "Hesap Türü",
      tabSale: "Hisse Satışı",
      tabDividend: "Temettü",
      yearLabel: "Vergi Yılı",
      notAdvice: "Vergi Danışmanlığı Değildir",
      notAdviceBody:
        "GİB rehberlerine dayanan bir tahmindir; beyannamen için mali müşavirine danış. Kuralların kaynakları sayfanın sonunda.",
      rateDayLabel: "Kur Günü",
      rateDaySame: "İşlem Günü",
      rateDayPrevious: "Bir Önceki İş Günü",
      rateDayHint:
        "Varsayılan, işlem gününde ilan edilen kur; hafta sonu ve tatilde son iş günü. Uygulamada bir önceki iş gününün kurunu kullananlar da var.",
      settingsTitle: "Hesap Ayarları",
      stepBuy: "Alış",
      stepSell: "Satış",
      stepIndex: "Yİ-ÜFE Endeksi",
      symbol: "Sembol",
      quantity: "Adet",
      sellQuantity: "Satılan Adet",
      buyDate: "Alış Tarihi",
      sellDate: "Satış Tarihi",
      date: "Tarih",
      priceUsd: "Hisse Başı Fiyat (USD)",
      commissionToggle: "Komisyon Ekle",
      buyCommission: "Alış Komisyonu (USD)",
      sellCommission: "Satış Komisyonu (USD)",
      commissionUsd: "Komisyon (USD)",
      rateChip: "TCMB Alış Kuru · {date}",
      bulletinOf: "{date} Bülteni",
      rateLoading: "Kur Getiriliyor",
      rateMissing: "Kur Yok",
      sellBeforeBuy: "Satış tarihi alış tarihinden önce olamaz.",
      yearMoved: "Satış {year} yılında; vergi yılı {year} olarak seçildi.",
      advancedOn: "Birden Fazla İşlem",
      advancedOff: "Tek Alış ve Satış",
      advancedHint:
        "Farklı günlerde alıp sattıysan her işlemi ayrı gir; satışlar en eski alıştan başlayarak eşleşir (ilk giren ilk çıkar).",
      side: "Tür",
      sideBuy: "Alış",
      sideSell: "Satış",
      addBuy: "Alış Ekle",
      addSell: "Satış Ekle",
      removeAria: "{row}. satırı sil",
      emptyTrades: "Henüz işlem yok. Bir alış ve bir satış ekleyerek başla.",
      imported: "Portföyden {count} pozisyon alış olarak aktarıldı; satışlarını ekle.",
      indexAuto: "Endeksler TCMB EVDS'den (Yİ-ÜFE, 2003=100) otomatik geliyor.",
      indexManual:
        "Endeks kaynağı şu an kapalı; TÜİK'in Yİ-ÜFE (2003=100) değerlerini yaz. Boş bırakırsan endeksleme yapılmaz.",
      indexMonthLabel: "Yİ-ÜFE · {month}",
      indexNote:
        "Endeksleme yalnızca kazançlı satışa uygulanır ve kazancı en fazla sıfıra indirir; zarar doğurup doğuramayacağına dair açık bir düzenleme bulunamadığı için temkinli yol seçildi.",
      resultLabel: "Sonuç",
      resultEmptySale: "Alışı ve satışı girdiğinde sonuç burada belirir.",
      resultEmptyDividend: "Temettüyü girdiğinde sonuç burada belirir.",
      verdictYes: "Beyan Etmen Gerekiyor",
      verdictNo: "Beyan Gerekmiyor",
      verdictYesBody:
        "Menkul kıymet kazancında yıllık istisna yok: net kazanç varsa tutar ne olursa olsun beyan edilir.",
      verdictNoBody:
        "Bu yıl net kazanç yok. Zarar yalnızca aynı yılın menkul kıymet kazançlarından düşülür, sonraki yıla devretmez.",
      netGain: "Net Kazanç",
      netLoss: "Net Zarar",
      estTax: "Tahmini Vergi",
      estTaxBetween: "ile",
      estTaxHint:
        "Alt uç, bu kazanç tek gelirinse {year} tarifesiyle; üst uç en yüksek dilim olan %{top}. Ücret ya da başka gelirin varsa sonuç ikisinin arasına düşer.",
      flowTitle: "Kazanç Nasıl Oluştu",
      flowCostTl: "TL Maliyet",
      flowIndexed: "Endeksli Maliyet",
      flowProceeds: "Satış Bedeli",
      flowGain: "Kazanç",
      flowLoss: "Zarar",
      flowManyRates: "Her Lot Kendi Kuruyla",
      flowIndexUp: "Yİ-ÜFE +%{pct}, Maliyet Endekslendi",
      flowIndexBelow: "Yİ-ÜFE +%{pct}, %10 Eşiğinin Altında",
      flowIndexNone: "Endeks Girilmedi",
      flowIndexNoGain: "Satış Kazançlı Değil, Endeks Yok",
      lotsTitle: "Lot Dökümü",
      costTl: "TL Maliyet",
      indexRatio: "Yİ-ÜFE Oranı",
      taxCostTl: "Vergiye Esas Maliyet",
      proceedsTl: "TL Satış Bedeli",
      gainTl: "Kazanç / Zarar",
      buyRate: "Alış Kuru",
      sellRate: "Satış Kuru",
      indexedBadge: "Endeksli",
      shortfall: "{symbol}: {date} satışında {quantity} adedin alışı girilmemiş; bu kısım hesaba katılmadı.",
      incomplete: "Bazı kur ya da endeksler eksik; toplam yalnızca tamamlanan satırları içeriyor.",
      noSalesInYear: "Seçili yılda satış yok; kazanç, satışın yılına göre hesaplanır.",
      ratesFailed: "Bazı kurlar alınamadı; tarihi kontrol edip yeniden dene.",
      retry: "Tekrar Dene",
      dividendHint: "Temettü brüt tutarıyla beyan edilir ve ödeme gününün kuruyla liraya çevrilir.",
      paymentDate: "Ödeme Tarihi",
      grossUsd: "Brüt Tutar (USD)",
      w8Label: "W-8BEN Verdin mi?",
      w8Yes: "Evet · %20",
      w8No: "Hayır · %30",
      w8Statement: "Ekstre · %{pct}",
      readAs: "{value} olarak okundu; ondalık için virgül kullan.",
      symbolInvalid: "Sembol harfle başlar; yalnızca harf, nokta ve tire içerir.",
      notNumber: "Sayı olarak okunamadı.",
      notPositive: "Sıfırdan büyük bir sayı yaz.",
      notNegative: "Eksi bir tutar olamaz.",
      taxBase: "Matrah",
      taxBaseHint: "Vergiye esas kazanç; net zararda sıfır.",
      bracketTableTitle: "{year} Gelir Vergisi Tarifesi",
      bracketTableHint:
        "Vergi dilim dilim hesaplanır: her oran yalnızca o dilime düşen kısma uygulanır. İşaretli satır, bu kazanç tek gelirinse matrahının düştüğü dilim.",
      bracketYours: "Senin Matrahın",
      bracketOver: "{amount} Üstü",
      bracketSlice: "Bu Dilimden",
      bracketRange: "Gelir Aralığı",
      bracketRate: "Oran",
      thresholdCarried: "{year} beyan sınırı henüz yayımlanmadı; {from} sınırı kullanılıyor, değiştirebilirsin.",
      bracket: "Dilim",
      bracketHint: "{year} tarifesinde, bu kazanç tek gelirse.",
      rangeLow: "Alt Uç",
      rangeHigh: "Üst Uç · %{top}",
      rangeLabel: "Tahmini vergi aralığı: alt uç {low}, üst uç {high}",
      basisTitle: "Hesabın Dayanağı",
      basisRate: "TCMB Alış Kuru",
      import: {
        open: "Ekstreden Aktar",
        formats: "Midas PDF · IBKR CSV ya da PDF",
        privacy: "Dosyan Cihazından Çıkmaz",
        privacyBody:
          "Ekstre yalnızca bu sekmede, tarayıcında okunur. Hiçbir sunucuya yüklenmez, hiçbir yere kaydedilmez.",
        drop: "Ekstreni Buraya Bırak",
        choose: "Dosya Seç",
        ibkrTip:
          "IBKR kullanıyorsan en güvenilir yol CSV: Performance & Reports → Statements → Activity, biçim olarak CSV seç.",
        reading: "Ekstre Okunuyor",
        readingPage: "Sayfa {page}/{total}",
        passwordTitle: "Şifreli PDF",
        passwordBody: "Bu ekstre şifreli. Şifre yalnızca dosyayı bu sekmede açmak için kullanılır.",
        passwordWrong: "Şifre dosyayı açmadı, tekrar dene.",
        passwordLabel: "PDF Şifresi",
        unlock: "Dosyayı Aç",
        errorTitle: "Dosya Okunamadı",
        errorBody:
          "Bu dosyadan metin çıkarılamadı. Taranmış bir görüntü PDF'i olabilir; ekstreyi kurumunun uygulamasından yeniden indirmeyi dene.",
        errorType: "Yalnızca PDF ve CSV dosyaları okunabiliyor.",
        errorSize: "Dosya çok büyük; en fazla {mb} MB.",
        emptyTitle: "İşlem Bulunamadı",
        emptyBody:
          "Bu dosyada alış, satış ya da temettüye benzeyen bir satır tanıyamadık. İşlem dökümünü (hesap ekstresi) seçtiğinden emin ol.",
        brokerMidas: "Midas",
        brokerIbkr: "Interactive Brokers",
        brokerUnknown: "Tanınmayan Biçim",
        unknownNote:
          "Kurumu tanıyamadık; satırlar genel bir tanıyıcıyla okundu. Aktarmadan önce her satırı ekstrenle karşılaştır.",
        found: "{trades} İşlem · {dividends} Temettü",
        skippedCount: "{count} Satır Atlandı",
        skippedCountOne: "{count} Satır Atlandı",
        reviewTitle: "Okunanları Kontrol Et",
        reviewBody:
          "Yalnızca işaretli satırlar aktarılır. Hücreleri burada düzeltebilirsin; okunamayan alanlar boş bırakıldı, uydurulmadı.",
        tradesTitle: "İşlemler",
        dividendsTitle: "Temettüler",
        colNote: "Durum",
        colGross: "Brüt ($)",
        colWithheld: "Kesilen ($)",
        selectAll: "Bu tablodaki bütün satırları seç",
        selectRow: "{symbol} satırını aktar",
        skippedTitle: "Atlanan Satırlar",
        skippedHint:
          "İşleme benzeyen ama sembol, yön, adet ya da fiyatı okunamayan satırlar. Gerekirse hesaplayıcıya elle ekle.",
        reasons: {
          noSymbol: "Sembol Yok",
          noSide: "Yön Yok",
          noQuantity: "Adet Yok",
          noPrice: "Fiyat Yok",
          notStock: "Hisse Değil",
          unreadable: "Okunamadı",
        },
        flags: {
          noDate: "Tarih Yok",
          noCommission: "Komisyon Yok",
          currency: "Dolar Değil",
          amountMismatch: "Tutar Tutmuyor",
          symbolOdd: "Sembol Şüpheli",
          dateRange: "Tarih Aralık Dışı",
          noWithholding: "Kesinti Yok",
          unverified: "Doğrulanamadı",
        },
        flagHelp: {
          noDate: "Tarih okunamadı; kur için tarihi yaz.",
          noCommission: "Komisyon okunamadı; sıfır sayılır.",
          currency: "İşlem dolar değil; hesaplayıcı dolar bekliyor.",
          amountMismatch: "Adet × fiyat ekstredeki tutarı tutmuyor; sütunlar kaymış olabilir.",
          symbolOdd: "Sembol hesaplayıcının biçimine uymuyor.",
          dateRange: "TCMB kurunun olmadığı ya da gelecekteki bir gün.",
          noWithholding: "Kesilen vergi okunamadı; W-8BEN oranı varsayılır.",
          unverified: "Sütun sırası bilinmeyen bir belge; adet ve fiyatı ekstrenle karşılaştır.",
        },
        ok: "Tamam",
        apply: "{count} Satırı Aktar",
        cancel: "Vazgeç",
        another: "Başka Dosya",
        applied: "Ekstreden {trades} işlem ve {dividends} temettü aktarıldı; kurlar her satıra kendiliğinden geliyor.",
      },
      withholding: "ABD Stopajı",
      addDividend: "Temettü Ekle",
      grossTl: "Brüt TL",
      withheldTl: "ABD'de Kesilen",
      withheldHint: "Türkiye'de bu gelire düşen vergiden mahsup edilir, fazlası iade edilmez. Belgesi aracı kurumun 1042-S formu.",
      totalGrossTl: "Toplam Brüt TL",
      dividendOver: "Toplam {total}, {year} sınırı {limit} tutarını aşıyor; temettünün tamamı beyan edilir.",
      dividendUnder: "Toplam {total}, {year} sınırı {limit} altında kalıyor; bu gelir tek başına beyan gerektirmez.",
      meterLimit: "{limit} Sınır",
      thresholdLabel: "Beyan Sınırı ({year})",
      thresholdSource: "GVK 86/1-c, {source}",
      thresholdHint:
        "Sınır, stopaja tabi tutulmamış bütün menkul ve gayrimenkul sermaye iratlarının toplamına uygulanır; başka yurt dışı gelirin varsa onları da ekle.",
      exportCsv: "CSV İndir",
      csvName: "yurt-disi-hisse-vergisi-{year}.csv",
      how: {
        title: "Nasıl Hesaplanır",
        label: "Hesap Adımları",
        lead: "Hesaplayıcı bu altı adımı senin yerine yapar; sen yalnızca işlemlerini girersin. Sayılar {year} vergi yılının kurallarından.",
        step1Title: "İşlemlerini Gir",
        step1Body:
          "Alış ve satışı elle yaz ya da ekstreni yükle; dosya cihazından çıkmaz. Satış, ilk giren ilk çıkar sırasıyla en eski alıştan düşülür.",
        step2Title: "TCMB Kuruyla Liraya Çevir",
        step2Body:
          "Maliyet alış, satış bedeli satış, temettü ödeme gününün TCMB döviz alış kuruyla çevrilir. Kur farkı da vergilenir; komisyon kazancı azaltır.",
        step3Title: "Yİ-ÜFE ile Endeksle",
        step3Body:
          "Yİ-ÜFE alıştan önceki aydan satıştan önceki aya %{pct} ya da daha çok arttıysa maliyet endekslenir; yalnızca kazançlı satışta ve kazancı en fazla sıfıra indirerek.",
        step4Title: "Kazanç ve Temettüyü Topla",
        step4Body:
          "Yıl içindeki kazanç ve zarar mahsup edilir; hisse satışında istisna yoktur. Tevkifatsız sermaye iratlarının toplamı {thresholdYear} sınırı olan {threshold} tutarını aşarsa temettünün tamamı beyana girer.",
        step5Title: "Dilimlere Göre Vergi",
        step5Body:
          "Matrah tarifeden geçer: {first} tutarına kadar %{min}, en üst dilimde %{max}. ABD'de kesilen stopaj (W-8BEN ile %{w8}, yoksa %{none}) bu gelire düşen vergiden mahsup edilir.",
        step6Title: "Mart'ta Beyan Et",
        step6Body:
          "{year} geliri {filing} Mart'ında Hazır Beyan Sistemi'nden beyan edilir; vergi 31 Mart ve 31 Temmuz'da iki taksitte ödenir.",
        step6Link: "Takvim ve Belgeler",
        start: "Hesaplamaya Başla",
        tariffSource: "Kaynak: {source}.",
      },
      filing: {
        title: "Ne Zaman, Nereye, Hangi Belgeyle",
        lead: "{year} yılının satış kazancı ve temettüsü {filing} Mart'ında yıllık gelir vergisi beyannamesiyle bildirilir.",
        timelineLabel: "{year} Geliri İçin Beyan Takvimi",
        tradeYear: "İşlem Yılı",
        tradeYearDate: "{year} Boyunca",
        open: "Beyan Başlar",
        form: "1042-S Gelir",
        formDate: "{date}'a Kadar",
        deadline: "Son Gün ve 1. Taksit",
        second: "2. Taksit",
        today: "Bugün",
        installments: "Vergi iki eşit taksitte ödenir: ilki 31 Mart, ikincisi 31 Temmuz.",
        whereTitle: "Nereye",
        whereBody:
          "Beyanname GİB Hazır Beyan Sistemi'nden verilir; e-Devlet şifrenle kendin verebilir ya da mali müşavirine verdirebilirsin.",
        whereLink: "Hazır Beyan Sistemi",
        docsTitle: "Hazırlaman Gerekenler",
        docStatement: "Aracı Kurum Ekstresi",
        docStatementBody: "Alış ve satış tarihleri, adet, fiyat ve komisyon.",
        docForm: "Form 1042-S",
        docFormBody: "ABD'de kesilen temettü vergisini gösterir; aracı kurum en geç 15 Mart'ta gönderir.",
        docW8: "W-8BEN",
        docW8Body: "Verdiysen temettüde %20, vermediysen %30 kesilir.",
        docCsv: "Bu Sayfanın Dökümü",
        docCsvBody: "CSV olarak indir: kurlar ve hesap satır satır.",
        readW8: "W-8BEN Rehberi",
        readGuide: "Yurt Dışı Hisse Vergisi Rehberi",
      },
      guideTitle: "Bilmen Gerekenler",
      sections: {
        changesTitle: "2026'da Ne Değişti",
        changesBody:
          "Doğrudan yurt dışı hisse satış kazancının vergilemesinde 2026 için bir rejim değişikliği yok: kazanç yine yıllık beyannameyle bildiriliyor. Değişenler şunlar: tarife dilimleri güncellendi (ilk dilim 190.000 TL), temettü için beyan sınırı 22.000 TL'ye çıktı, yurt dışı iştirak kazancı istisnasının sermaye şartı %50'den %20'ye indi (CBK 11257; portföy yatırımcısını ilgilendirmez) ve serbest fonlarda stopaj oranları değişti (7566 sayılı Kanun ve 27 Mart 2026 tarihli karar). Araştırma Eylül 2026 itibarıyladır.",
        w8Title: "W-8BEN ve 1042-S",
        w8Body:
          "W-8BEN, ABD'ye vergi mukimi olmadığını bildiren formdur. Verilmişse Türkiye ile ABD arasındaki anlaşma temettü stopajını bireysel yatırımcıda %20 ile sınırlar; verilmemişse %30 kesilir. 1042-S, yıl içinde kesilen vergiyi gösteren belgedir ve Türkiye'deki mahsup için kullanılır; hesaplayıcıdaki oranı bu formdaki oranla karşılaştır.",
        sourcesTitle: "Kaynaklar",
      },
      sources: {
        dki: "GİB, Diğer Kazanç ve İratlar Rehberi 2025",
        msi: "GİB, Menkul Sermaye İradı Rehberi (Şubat 2026)",
        ykb: "Yapı Kredi, Yabancı Hisse Senedi Gelirlerinde (2026 Yılı) Vergi Durumu",
        turmob: "TÜRMOB Sirküleri 2026/65 (CBK 11257)",
        irs: "IRS, Form 1042-S Talimatı",
      },
      dataNote: "Kurlar: TCMB döviz alış (günlük bülten). Endeks: TÜİK Yİ-ÜFE, 2003=100.",
      notAdviceFoot: "Bu sayfadaki hesaplar GİB rehberlerine dayanan bir tahmindir; beyannameni vermeden önce mali müşavirine danış.",
    },
    portfolio: {
      eyebrow: "Hesabım",
      title: "Portföy",
      subtitle: "Pozisyonlarının dolar ve lira kâr/zararı; TL maliyet alış gününün kuruyla, bugünkü değer bugünün kuruyla.",
      unavailableTitle: "Portföy Şu An Açılamıyor",
      unavailableBody:
        "Portföy kaydı bu sunucuda henüz hazır değil. Takip listelerin ve hesabın etkilenmedi; biraz sonra yeniden dene.",
      emptyTitle: "Henüz Pozisyon Yok",
      emptyBody: "Elindeki hisseyi tek tek ekle ya da aracı kurum ekstreni yükle; kâr/zarar dolar ve lira olarak hesaplanır.",
      addTitle: "Pozisyon Ekle",
      symbol: "Sembol",
      quantity: "Adet",
      costUsd: "Alış Fiyatı (USD)",
      boughtAt: "Alış Tarihi",
      note: "Not",
      notePlaceholder: "İsteğe bağlı, örn. aracı kurum",
      add: "Ekle",
      adding: "Ekleniyor",
      remove: "Sil",
      removeAria: "{symbol} pozisyonunu sil",
      errors: {
        invalid: "Alanları kontrol et: sembol, pozitif adet ve fiyat, bugünden ileri olmayan bir tarih.",
        limit: "En fazla {max} pozisyon eklenebilir.",
        rateLimited: "Çok hızlı denedin; bir dakika sonra yeniden dene.",
        failed: "Kaydedilemedi; biraz sonra yeniden dene.",
        signedOut: "Oturumun kapanmış; yeniden giriş yap.",
      },
      positionsTitle: "Pozisyonlar",
      price: "Fiyat",
      value: "Değer",
      pnlUsd: "K/Z (USD)",
      pnlTl: "K/Z (TL)",
      costTl: "TL Maliyet",
      valueTl: "TL Değer",
      rateAt: "{date} Kuru {rate} ₺",
      noQuote: "Fiyat Yok",
      totals: "Toplam",
      totalValue: "Toplam Değer",
      totalPnlUsd: "Dolar K/Z",
      totalPnlTl: "Lira K/Z",
      fxEffect: "Kurun Katkısı",
      fxEffectHint: "Lira K/Z ile dolar K/Z'nin bugünkü kurla çevrilmiş hâli arasındaki fark.",
      sectorTitle: "Sektör Ağırlığı",
      sectorHint: "Güncel dolar değerine göre.",
      otherSector: "Diğer",
      todayRate: "Bugünkü kur: 1 USD = {rate} ₺ ({date} bülteni, TCMB döviz alış).",
      fxMissing: "Kur alınamadı; TL sütunları şu an boş.",
      staleNote: "Fiyatlar güncel olmayabilir; kâr/zarar son alınan fiyatla hesaplandı.",
      exportToTax: "Vergi Hesaplayıcıya Aktar",
      exportHint: "Pozisyonların alış olarak vergi hesaplayıcısına geçer; hiçbir şey sunucuya gönderilmez.",
      notAdvice: "Yatırım tavsiyesi değildir.",
      /* Kahramandaki dağılım halkası ve toplam şeridinin kaynak çubuğu. */
      allocationTitle: "Dağılım",
      positionsUnit: "Pozisyon",
      allocationEmpty: "İlk pozisyonunu eklediğinde dağılım burada çizilir.",
      weight: "Ağırlık",
      sourceTitle: "Lira K/Z'nin Kaynağı",
      fromStock: "Hisseden",
      fromFx: "Kurdan",
      /* Getiri bölümü ve pozisyon listesi (2 Ekim yeniden düzeni). */
      returnsTitle: "Getiri",
      usdBasis: "Dolar Bazında",
      tlBasis: "Lira Bazında",
      breakdownTitle: "Lira Getirin Nereden Geldi",
      fromStockHint: "Dolar kârının bugünkü kurla karşılığı",
      fromFxHint: "Doların alıştan bu yana değer kazanması",
      tlTotal: "Lira Getirisi",
      fxStoryUp:
        "Pozisyonlarını aldığın günlerde dolar ortalama {buy} idi, bugün {today}; kur {chg} yükseldi. Lira getirinin dolar getirisinden {gap} puan yüksek olmasının sebebi bu.",
      fxStoryDown:
        "Pozisyonlarını aldığın günlerde dolar ortalama {buy} idi, bugün {today}; kur {chg} düştü. Lira getirinin dolar getirisinden {gap} puan düşük olmasının sebebi bu.",
      fxStoryFlat: "Pozisyonlarını aldığın günlerin kuru bugünkünden farksız; lira ve dolar getirisi aynı yerde.",
      usdReturn: "Dolar Getirisi",
      tlReturn: "Lira Getirisi",
      costShort: "Maliyet",
      buyRateShort: "Alış Kuru",
      fxPart: "Kur Katkısı",
      /* Elle sıralama (2 Ekim). */
      sortDefault: "En Büyük Pozisyon Üstte",
      sortManual: "Senin Sıran",
      sortEdit: "Sırayı Düzenle",
      sortDone: "Bitti",
      sortReset: "En Büyük Üstte",
      sortHint: "Okları kullanarak pozisyonları istediğin sıraya koy.",
      moveUp: "{symbol} pozisyonunu yukarı taşı",
      moveDown: "{symbol} pozisyonunu aşağı taşı",
      sortFailed: "Sıra kaydedilemedi; biraz sonra yeniden dene.",
      /* Yeni ekleme akışı (28 Eylül): sembol arama, fiyat önerisi, düzenleme,
         geri alma ve ekstreden içe aktarma. */
      emptyAddTitle: "İlk Pozisyonunu Ekle",
      emptyAddBody: "Hisseyi ara, adedi yaz; son bir yıl içindeki bir gün için kapanış fiyatını önerelim.",
      emptyImportTitle: "PDF'ten İçe Aktar",
      emptyImportBody: "Midas ya da Interactive Brokers ekstreni seç; işlemler cihazında okunur.",
      importAction: "PDF'ten İçe Aktar",
      edit: "Düzenle",
      editAria: "{symbol} pozisyonunu düzenle",
      actionsAria: "{symbol} için işlemler",
      openStock: "Hisse Sayfası",
      undo: "Geri Al",
      toastAdded: "{symbol} portföye eklendi.",
      toastUpdated: "{symbol} güncellendi.",
      toastRemoved: "{symbol} silindi.",
      toastRestored: "{symbol} geri geldi.",
      toastImported: "{n} satır portföye eklendi.",
      toastImportUndone: "Aktarım geri alındı.",
      toastFailed: "İşlem tamamlanamadı; biraz sonra yeniden dene.",
      dismiss: "Kapat",
      composer: {
        addTitle: "Pozisyon Ekle",
        editTitle: "Pozisyonu Düzenle",
        close: "Kapat",
        symbolLabel: "Hisse",
        symbolPlaceholder: "Ad ya da sembol, örn. Apple veya AAPL",
        searching: "Aranıyor",
        noResults: "Sonuç bulunamadı.",
        searchError: "Arama şu an yanıt vermiyor.",
        useTyped: "{symbol} Sembolünü Kullan",
        change: "Değiştir",
        quantityLabel: "Adet",
        quantityPlaceholder: "örn. 10 ya da 0,5",
        priceModeLabel: "Fiyatı Nasıl Gireceksin",
        perShare: "Hisse Başı",
        total: "Toplam Tutar",
        priceLabel: "Alış Fiyatı (USD)",
        totalLabel: "Ödediğin Toplam (USD)",
        dateLabel: "Alış Tarihi",
        suggestLoading: "O günün fiyatına bakılıyor",
        suggestClose: "{date} Kapanışı",
        suggestPrevious: "{date} Kapanışı, Son İşlem Günü",
        suggestLast: "Son Fiyat",
        suggestUse: "Kullan",
        suggestNone: "Bu gün için kapanış fiyatı yok; fiyatı kendin yaz.",
        perShareIs: "Hisse Başı {price}",
        summaryCost: "Maliyet",
        summaryFx: "{date} Kuru {rate} ₺",
        summaryFxMissing: "Alış günü kuru alınamadı; TL maliyet tabloda boş kalır.",
        noteToggle: "Not Ekle",
        noteLabel: "Not",
        notePlaceholder: "İsteğe bağlı, örn. aracı kurum",
        submitAdd: "Portföye Ekle",
        submitEdit: "Değişiklikleri Kaydet",
        saving: "Kaydediliyor",
        cancel: "Vazgeç",
        readAs: "{value} olarak okundu",
        errSymbol: "Bir hisse seç ya da sembolü yaz.",
        errSymbolFormat: "Sembol yalnızca harf, nokta ve tire taşıyabilir.",
        errQuantity: "Sıfırdan büyük bir adet yaz.",
        errPrice: "Sıfırdan büyük bir tutar yaz.",
        errDate: "{min} ile bugün arasında bir tarih seç.",
      },
      importer: {
        title: "PDF'ten İçe Aktar",
        close: "Kapat",
        dropTitle: "Ekstreni Buraya Bırak",
        dropBody: "Birden fazla aylık ekstre birlikte seçilebilir.",
        choose: "Dosya Seç",
        privacy: "Dosyan cihazında okunur, sunucuya gönderilmez.",
        supportedTitle: "Desteklenen Ekstreler",
        supportedMidas: "Midas: aylık Hesap Ekstresi (PDF). Uygulamada Profil, Belgeler, Ekstreler.",
        supportedIbkr: "Interactive Brokers: Activity Statement (PDF ya da CSV).",
        reading: "{file} okunuyor",
        readingPage: "Sayfa {page}/{pages}",
        passwordTitle: "Bu PDF Şifreli",
        passwordBody: "Ekstrenin şifresini yaz; şifre de cihazından çıkmaz.",
        passwordWrong: "Şifre tutmadı; yeniden dene.",
        passwordLabel: "PDF Şifresi",
        unlock: "Aç",
        errorTitle: "Ekstre Okunamadı",
        errorType: "Yalnızca PDF ya da CSV dosyası okunabiliyor.",
        errorSize: "Dosya {mb} MB sınırını aşıyor.",
        errorBody: "Bu dosyada okunabilir işlem satırı bulunamadı. Taranmış, yani resim olarak kaydedilmiş PDF'ler okunamıyor.",
        errorUnknown: "Aracı kurum tanınmadı ve hiçbir işlem güvenle okunamadı.",
        errorNoTrades: "Ekstre okundu ama içinde hisse alış ya da satışı yok.",
        another: "Başka Dosya Seç",
        reviewTitle: "Bulunan İşlemler",
        brokerMidas: "Midas",
        brokerIbkr: "Interactive Brokers",
        brokerUnknown: "Tanınmayan Biçim",
        unknownHint: "Biçim tanınmadı; satırlar tahminle okundu ve hiçbiri seçili gelmedi. Her satırı kaynağıyla karşılaştırıp kendin seç.",
        tradesCount: "{n} İşlem",
        tradesCountOne: "{n} İşlem",
        selectedCount: "{n} Seçili",
        selectAll: "Tümünü Seç",
        colInclude: "Dahil",
        colSymbol: "Sembol",
        colDate: "Tarih",
        colSide: "Yön",
        colQuantity: "Adet",
        colPrice: "Fiyat (USD)",
        sideBuy: "Alış",
        sideSell: "Satış",
        includeRow: "{symbol}, {date}, {side} işlemini dahil et",
        flagHint: "İşaretli satırlar seçili gelmez; kaynağını kontrol edip kendin seçebilirsin.",
        flags: {
          noDate: "Tarih Okunamadı",
          currency: "USD Değil",
          amountMismatch: "Tutar Tutmuyor",
          symbolOdd: "Sembol Şüpheli",
          dateRange: "Tarih Aralık Dışı",
          unverified: "Doğrulanamadı",
          noCommission: "Komisyon Yok",
          noWithholding: "Stopaj Yok",
        },
        positionsTitle: "Eklenecek Pozisyonlar",
        modeLabel: "Satır Düzeni",
        modeLots: "Alış Başına",
        modeSymbol: "Sembol Başına",
        statusNew: "Yeni",
        statusConflict: "Portföyde Var",
        statusClosed: "Kapanmış",
        statusIncomplete: "Eksik Geçmiş",
        statusDuplicate: "Zaten Ekli",
        lots: "{n} Satır",
        avgCost: "Ortalama {price}",
        closedNote: "Tamamı satılmış; eklenmeyecek.",
        incompleteNote: "Satışlar ekstredeki alışlardan {qty} adet fazla. Önceki ekstreler olmadan kalan bilinemiyor; eklenmeyecek.",
        duplicateNote: "{n} satır portföyünde birebir var; atlandı.",
        conflictQuestion: "Portföyünde {symbol} zaten var. Yeni alışlar yanına eklensin mi?",
        merge: "Birleştir",
        skip: "Atla",
        mergeAll: "Hepsini Birleştir",
        skipAll: "Hepsini Atla",
        conflictsPending: "{n} sembol için karar bekleniyor.",
        nothingToAdd: "Eklenecek açık pozisyon yok.",
        apply: "{n} Satırı Portföye Ekle",
        applying: "Ekleniyor",
        limit: "Bu aktarımla portföy {max} satır sınırını aşıyor; Sembol Başına düzenini dene ya da daha az satır seç.",
        methodTitle: "Hesap Yöntemi",
        method: "Satışlar ilk giren ilk çıkar (FIFO) yöntemiyle en eski alıştan düşülür. Kalan her alış kendi tarihi ve fiyatıyla ayrı satır olur; TL maliyet o günün kuruyla hesaplanır. Ortalama maliyet, kalan alışların adet ağırlıklı ortalamasıdır. Komisyon maliyete eklenmez.",
        methodSymbol: "Sembol Başına düzeninde tarih en eski kalan alışın günüdür ve TL maliyet yalnızca o günün kuruyla hesaplanır.",
        methodScope: "Ekstre bütün geçmişini kapsamıyorsa satış yanlış alıştan düşebilir; bütün aylık ekstreleri birlikte seç.",
        back: "Geri",
      },
    },
  },
  /* Bilanço analizinin ekleri ("30 Saniyede", segment ve KPI verisi) ve
     Haftalık Bilanço Takvimi. Ayrı ad alanı: iki özellik de sonradan geldi
     ve `analysis` ile `earnings` zaten yüzlerce anahtar taşıyor. */
  earningsExtra: {
    summaryTitle: "Bilanço Özeti",
    summaryMeta: "30 Saniyede",
    /* Liste kartındaki tek satırlık ipucunun künyesi. */
    teaserLabel: "30 Saniyede",
    dataTitle: "Segment ve KPI Verisi",
    segmentsTitle: "Segment Gelirleri",
    kpisTitle: "Şirkete Özgü Ölçüler",
    segmentsHeading: "Gelirin Segmentlere Dağılımı",
    kpisHeading: "Öne Çıkan Ölçüler",
    share: "Pay",
    yearly: "Yıllık",
    sourceLabel: "Kaynak",
    /* Künye cümleleri — paragraf, Title Case değil. */
    segmentBasis: "Paylar segment toplamı üzerinden hesaplandı: {total}.",
    segmentGap:
      "Segment toplamı konsolide gelirden ({revenue}) farklı; şirketin eliminasyon ve diğer satırları bu tabloda yok.",
    kpiNote:
      "Ölçüler yalnızca şirketin kendi belgelerinden alınır; her birinin yanında hangi belge olduğu yazılı.",
    sources: {
      "press-release": "Basın Bülteni",
      "shareholder-letter": "Hissedar Mektubu",
      "10-Q": "10-Q",
      "10-K": "10-K",
      "8-K": "8-K",
    },
    week: {
      eyebrow: "Bilanço Haftası",
      title: "Haftalık Bilanço Takvimi",
      /* PageHeader açıklaması — cümle. */
      description:
        "Gelecek haftanın kayda değer bilançoları, gün gün ve Türkiye saatiyle: açılış öncesi ve kapanış sonrası.",
      metaTitle: "Haftalık Bilanço Takvimi · {range}",
      metaDescription:
        "{range} haftasında bilanço açıklayacak kayda değer şirketler, gün gün, açılış öncesi ve kapanış sonrası.",
      boardTitle: "Açıklayacak Şirketler",
      prevWeek: "Önceki Hafta",
      nextWeek: "Sonraki Hafta",
      thisWeek: "Bu Hafta",
      navLabel: "Hafta seçimi",
      beforeOpen: "Açılış Öncesi",
      afterClose: "Kapanış Sonrası",
      otherTime: "Saati Belirsiz",
      marketClosed: "Borsa Kapalı",
      emptyDay: "Kayda değer bilanço yok",
      empty: "Bu hafta için kayda değer bilanço bulunamadı",
      emptyHint:
        "Takvim sağlayıcıdan her gün tazeleniyor; uzak haftalar henüz boş olabilir.",
      countCompanies: "{count} Şirket",
      countOf: "Takvimdeki {total} şirketin {count} tanesi gösteriliyor.",
      statCompanies: "Şirket",
      statBeforeOpen: "Açılış Öncesi",
      statAfterClose: "Kapanış Sonrası",
      statBusiest: "En Yoğun Gün",
      imagesTitle: "Paylaşım Görselleri",
      imageLandscape: "Yatay · 1200×630",
      imagePortrait: "Dikey · 1080×1350",
      download: "Görseli İndir",
      /* Kahramandaki indirme düğmeleri — hangi biçim olduğu düğmenin adında. */
      downloadLandscape: "Yatay Görsel",
      downloadPortrait: "Dikey Görsel",
      /* Kahramandaki yoğunluk grafiğinin başlığı. */
      pulseTitle: "Günlere Göre",
      shareTitle: "Bu Haftayı Paylaş",
      landscapeAlt: "{range} haftasının bilanço takvimi, yatay paylaşım görseli",
      portraitAlt: "{range} haftasının bilanço takvimi, dikey paylaşım görseli",
      /* Künye paragrafları — cümle. */
      noteTimes:
        "Saatler yaklaşık: sağlayıcı dakika değil yalnızca pencereyi veriyor. Açılış öncesi bilançolar çoğunlukla ana seanstan bir buçuk saat önce, kapanış sonrası bilançolar kapanış zilinden hemen sonra açıklanıyor.",
      noteSelection:
        "Seçim: S&P 500, Nasdaq-100 ve Dow üyeleri, 10 milyar doların üzerindeki şirketler ve takip listemizdeki adlar; en fazla {max} şirket, büyükten küçüğe.",
      openCalendar: "Takvimin Tamamı",
      /* Takvim sekmesindeki bağlantı. */
      calendarLink: "Haftalık Takvim Görseli",
      calendarLinkHint: "Gelecek haftanın bilançoları tek görselde, indirilebilir.",
      ogFooter: "Saatler Türkiye Saatiyle, Yaklaşık",
      ogMore: "+{count}",
    },
  },

  /* Haftalık sekme (29 Eylül) — /bilancolar/hafta: En Çok Beklenenler
     ızgarası ve haftanın tam takvimi. Görsel ve eski sayfanın metinleri
     `earningsExtra.week`te kalıyor. */
  earningsWeek: {
    tab: "Haftalık",
    /* PageHeader açıklaması — cümle. */
    description:
      "Pazartesiden cumaya bir hafta: en büyük bilançolar tek bakışta, altında gün gün tam takvim. Saatler Türkiye saatiyle.",
    anticipatedTitle: "En Çok Beklenenler",
    anticipatedMeta: "Piyasa Değerine Göre",
    scheduleTitle: "Haftanın Takvimi",
    colCompany: "Şirket",
    colTime: "Saat",
    colEps: "EPS Beklentisi",
    colEpsActual: "Gerçekleşen EPS",
    colRevenue: "Gelir Beklentisi",
    colCap: "Piyasa Değeri",
    colAnalysis: "Analiz",
    epsShort: "EPS",
    revenueShort: "Gelir",
    capShort: "Değer",
    actualShort: "Gerçekleşen",
    beat: "Beklentiyi Aştı",
    miss: "Beklentinin Altında",
    inline: "Beklentiye Eşit",
    pending: "Bekleniyor",
    analysis: "Analiz",
    /* Boş ve hata durumları — başlık Title Case, gövde cümle. */
    dayEmpty: "Bu gün takvimde bilanço yok.",
    errorTitle: "Takvim Alınamadı",
    errorHint: "Bilanço takvimi şu an okunamıyor; bu bir boş hafta değil. Birazdan yeniden dene.",
    /* Künye paragrafları — cümle. */
    noteCriterion:
      "Sıralama ölçütü piyasa değeri. Duyarlılık ya da ilgi puanı kullanmıyoruz: elimizde dürüstçe ölçebildiğimiz bir tane yok.",
    noteTiers:
      "Büyük karo 500 milyar doların, orta karo 100 milyar doların üzerindeki şirketler; karonun altındaki çizgi haftanın en büyüğüne göre uzunluk.",
    noteSchedule:
      "Her gün piyasa değeri 1 milyar doların üzerindeki şirketler adıyla listeleniyor, en fazla {max}; kalanlar günün altındaki açılır listede.",
    noteSurprise: "Gerçekleşen EPS'nin yanındaki yüzde, beklentiden sapma.",
  },

  /* Ünlü yatırımcılar (28 Eylül) — /yatirimcilar, detay ve hisse paneli. */
  /* Şirket kartı — logo ve karoların üstünde açılan ortak okuma
     (components/ui/CompanyCard.tsx). Künyeler Title Case: cümle değiller. */
  companyCard: {
    sector: "Sektör",
    marketCap: "Piyasa Değeri",
    price: "Fiyat",
    session: "Seans İçi",
    sessionClose: "Seans Kapanışı",
    preMarket: "Açılış Öncesi",
    afterHours: "Kapanış Sonrası",
    lastClose: "Son Kapanış",
    portfolioShare: "Portföydeki Pay",
    quarterMove: "Bu Çeyrek",
  },
  ark: {
    title: "ARK'ın Son İşlemleri",
    meta: "ETF Dosyaları · Günlük",
    buys: "Alımlar",
    sells: "Satışlar",
    dayMeta: "{from} ile {to} Dosyaları Arası",
    opened: "Yeni Pozisyon",
    closed: "Pozisyonu Kapattı",
    shares: "{count} Adet",
    sharesOne: "{count} Adet",
    empty: "Bu tarafta işlem yok.",
    first: "ARK dosyaları {date} tarihinden beri kaydediliyor; ilk karşılaştırma bir sonraki işlem gününün dosyasıyla gelecek.",
    earlierTitle: "Önceki Günler",
    dayCounts: "{buys} Alış · {sells} Satış",
    noTrades: "İşlem Yok",
    note:
      "ARK altı aktif ETF'sinin (ARKK, ARKW, ARKQ, ARKG, ARKF, ARKX) elindeki hisseleri her gün yayımlıyor; iki günün dosyası arasındaki fark bir önceki işlem günündeki alım ve satımları gösterir. ETF'ye para girip çıktığında bütün pozisyonlar aynı oranda büyüyüp küçüldüğü için bu ortak oran ayıklanıyor; kalan sapma işlem sayılıyor.",
    noteValue: "Tutar, dosyadaki kapanış fiyatıyla yaklaşık hesaplanır. Nakit fonu ve sembolü olmayan satırlar gösterilmez.",
  },
  investors: {
    capitalTitle: "Takip Edilen Sermaye Kimde",
    capitalAria: "Takip edilen hisse portföylerinin yatırımcılara göre payı",
    capitalRest: "Diğer {count} Yatırımcı",
    eyebrow: "Ünlü Yatırımcılar",
    title: "Kim Ne Tutuyor",
    subtitle: "Buffett'tan Pelosi'ye ünlü yatırımcıların portföyleri, bu çeyrek aldıkları ve sattıkları.",
    trackedValue: "Takip Edilen Hisse Portföyü",
    investorsCount: "{count} Yatırımcı",
    investorsCountOne: "{count} Yatırımcı",
    lastFiled: "Son Bildirim",
    periodLabel: "Dönem",
    quarter: "{q}. Çeyrek {year}",
    asOf: "{date} İtibarıyla",
    filedOn: "{date} Bildirildi",
    moversTitle: "Bu Çeyreğin Hareketleri",
    moversMeta: "{period} · {count} Yatırımcı",
    buysTitle: "En Çok Alınanlar",
    sellsTitle: "En Çok Satılanlar",
    moversScale: "Yatırımcı Sayısı",
    opened: "{count} Yeni Aldı",
    added: "{count} Artırdı",
    trimmed: "{count} Azalttı",
    exited: "{count} Tamamen Sattı",
    moversEmpty: "Bu çeyrekte iki ya da daha çok yatırımcının aynı yöne gittiği bir hisse yok.",
    moversNote: "Yalnızca bu çeyreği bildirmiş yatırımcılar sayılıyor; aynı hisseye en az iki yatırımcının aynı yönde gittiği satırlar listede.",
    moversAgainstBuy: "Karşısında {count} Satıcı",
    moversAgainstSell: "Karşısında {count} Alıcı",
    balanceTitle: "Kim Alıyor, Kim Satıyor",
    balanceMeta: "{period} · Pozisyon Sayısı",
    balanceBuyers: "Net Alıcı",
    balanceBuyersOne: "Net Alıcı",
    balanceSellers: "Net Satıcı",
    balanceSellersOne: "Net Satıcı",
    balanceEven: "Dengede",
    balanceSellSide: "Satış Yönünde",
    balanceBuySide: "Alım Yönünde",
    balanceCenter: "Denge",
    balanceMoves: "{count} Hareket",
    balanceMovesOne: "{count} Hareket",
    balanceAria: "{name}: {buy} alım yönünde, {sell} satış yönünde pozisyon hareketi",
    balanceNote: "Şerit, yatırımcının bu çeyrekteki pozisyon hareketlerini ikiye böler: solda azaltılan ve tamamen satılan, sağda yeni alınan ve artırılan pozisyonlar; koyu ton tamamen satış ve yeni alım. Portre ikisinin sınırında durur. Ölçü dolar değil pozisyon sayısıdır; yalnızca bu çeyreği bildirmiş ve önceki çeyrekle karşılaştırılabilen fonlar listede.",
    cardsTitle: "Yatırımcılar",
    portfolioValue: "Hisse Portföyü",
    positions: "{count} Pozisyon",
    positionsOne: "{count} Pozisyon",
    positionsLabel: "Pozisyon",
    topHoldings: "En Büyük Pozisyonlar",
    otherHoldings: "Diğerleri",
    moveNew: "Yeni",
    moveIncreased: "Artırdı",
    moveDecreased: "Azalttı",
    moveSoldOut: "Tamamen Sattı",
    moveUnchanged: "Aynı",
    moveFirst: "İlk Bildirim",
    fundClosed: "Fon Kapandı",
    closedNote: "{firm}, {date} itibarıyla SEC kaydını kapattı. Son bildirim {quarter} dönemine ait; aşağıdaki hareketler o dönemi anlatıyor, bugünü değil.",
    closedNoteUndated: "{firm} SEC kaydını kapattı. Son bildirim {quarter} dönemine ait; aşağıdaki hareketler o dönemi anlatıyor, bugünü değil.",
    lastQuarterTitle: "Son Bildirimde Ne Yaptı",
    congressBadge: "Kongre Bildirimi",
    recentTrades: "Son İşlemler",
    buys: "{count} Alış",
    buysOne: "{count} Alış",
    sells: "{count} Satış",
    sellsOne: "{count} Satış",
    tradesCount: "{count} İşlem",
    tradesCountOne: "{count} İşlem",
    txBuy: "Alış",
    txSell: "Satış",
    txPartial: "Kısmi Satış",
    txExchange: "Değişim",
    ownerSpouse: "Eşi",
    ownerJoint: "Ortak",
    ownerChild: "Çocuğu",
    ownerSelf: "Kendisi",
    amountUnknown: "Tutar Yok",
    amountOver: "{low} Üstü",
    optionShort: "Opsiyon",
    optionCall: "Alım Opsiyonu",
    optionPut: "Satım Opsiyonu",
    detailOptions: "{contracts} Kontrat {right} · Kullanım {strike} · Vade {expiry}",
    detailExercise: "{contracts} Kontrat {right} Kullanıldı · {shares} Hisse · Kullanım {strike}",
    detailBuyShares: "{shares} Hisse Alındı",
    detailSellShares: "{shares} Hisse Satıldı",
    detailOriginal: "Bildirimin Açıklaması",
    back: "Tüm Yatırımcılar",
    stripFiled: "Bildirim",
    stripOptions: "Opsiyonlar · Dayanak",
    stripSource: "Kaynak",
    sourceSec: "SEC Dosyası",
    sourcePdf: "Bildirim PDF",
    mapTitle: "Portföy Dağılımı",
    mapHint: "Karonun alanı pozisyonun değeriyle orantılı; rengi bu çeyrekteki hareketi.",
    mapHintClosed: "Karonun alanı pozisyonun değeriyle orantılı; rengi son bildirimdeki hareketi.",
    mapTop: "Haritada en büyük {count} pozisyon var; tamamı aşağıdaki tabloda.",
    mapSmall: "Diğer {count}",
    mapSmallTitle: "Küçük Pozisyonlar",
    mapUnlisted: "Sembolü Bilinmeyenler",
    share: "Pay",
    valueLabel: "Değer",
    sharesLabel: "Adet",
    openStock: "Hisseye Git",
    didTitle: "Bu Çeyrek Ne Yaptı",
    didMeta: "{prev} ile {cur} Arası",
    didEmpty: "Bu grupta pozisyon yok.",
    didFirst: "Önceki dönemin bildirimi olmadığı için alım ve satım hesaplanamıyor.",
    more: "+{count} Daha",
    tableTitle: "Tüm Pozisyonlar",
    colRank: "Sıra",
    colCompany: "Şirket",
    colShares: "Adet",
    colValue: "Değer",
    colWeight: "Ağırlık",
    colChange: "Değişim",
    tableRest: "Kalan {count} Pozisyonu Göster",
    /* "{ratio}'e" eki sayıya göre değişiyor ("10'a", "2'ye"); oran iki
       nokta ile yazılıyor, ek gerekmiyor. Ters bölünme ayrı kalıp. */
    splitNote: "{ratio}:1 Bölünmeye Göre",
    reverseSplitNote: "1:{ratio} Ters Bölünmeye Göre",
    optionsTitle: "Opsiyonlar",
    optionsNote: "Opsiyon satırındaki değer ödenen prim değil, opsiyonun kapsadığı dayanak hisselerin çeyrek sonu değeridir. Bu satırlar hisse portföyüne ve ağırlıklara katılmaz.",
    colType: "Tür",
    colUnderlying: "Dayanak Değer",
    historyTitle: "Son Çeyrekler",
    historyNote: "Her çubuk o çeyreğin sonundaki hisse portföyü; opsiyonlar dahil değil.",
    note13f: "13F yalnızca ABD'de işlem gören uzun pozisyonları ve opsiyonları gösterir; açığa satışlar, nakit ve yurt dışı hisseler görünmez. Bildirim çeyrek bitiminden 45 gün sonraya kadar gecikebilir.",
    noteMoves: "Alım ve satım iki ardışık bildirimin HİSSE ADEDİ farkından hesaplanıyor; fiyat değişimi alım sayılmıyor. Hisse bölünmesi adetlerden ayıklanıyor.",
    noteScaled: "Bu yönetici değerleri bin dolar olarak bildirdi; ekranda dolara çevrildi.",
    noteAmend: "Bu dönem sonradan verilen {count} düzeltme dosyasıyla birlikte okunuyor.",
    noteTickers: "Sembolü bulunamayan pozisyonlar (tahvil, yurt dışı hisse, kapanmış şirket) bildirimdeki adıyla yazılıyor.",
    congressNote: "Kongre üyeleri ve eşleri 1.000 doları aşan hisse işlemlerini 45 gün içinde bildirmek zorunda. Tutar yalnızca aralık olarak bildiriliyor; işlemin gerçek büyüklüğü bilinmiyor.",
    congressOwnerNote: "\"Eşi\" satırları Paul Pelosi adına bildirilen işlemler.",
    disclaimerTitle: "Yatırım Tavsiyesi Değildir",
    disclaimer: "Bu ekran kamuya açık bildirimleri gösterir. Bu yatırımcıların işlemlerini taklit etmek bir öneri değildir; veriler haftalar hatta aylar gecikmelidir ve pozisyonun tamamını göstermez.",
    photoCredit: "Fotoğraf",
    photoCropped: "Kırpıldı",
    publicDomain: "Kamu Malı",
    tradesTitle: "İşlem Listesi",
    byTickerTitle: "Hisse Bazında",
    byTickerHint: "Her satır bir şirket; çubuk bildirilen işlem sayısı.",
    colDate: "İşlem Tarihi",
    colAsset: "Varlık",
    colAmount: "Tutar Aralığı",
    colOwner: "Sahip",
    colDetail: "Ayrıntı",
    colNotified: "Bildirim",
    stripTrades: "İşlem",
    stripBuys: "Alış",
    stripSells: "Satış",
    stripLastFiled: "Son Bildirim",
    panelTitle: "Ünlü Yatırımcılar",
    panelWeight: "Portföyde {weight}",
    panelExited: "Son Dönemde Tamamen Sattı",
    panelCongress: "Kongre İşlemleri",
    panelAll: "Tümünü Gör",
    emptyTitle: "Henüz Veri Yok",
    emptyHint: "Bildirimler günlük senkronla çekiliyor; ilk senkrondan sonra burada görünecek.",
  },
  /* Tarih seçici — metin ayrı dosyada, gerekçesi orada. */
  datePicker: datePickerTr,
};

export default tr;
