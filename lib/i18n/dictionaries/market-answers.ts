/**
 * Soru sayfalarının metinleri (14 Kasım 2026, SEO denetimi) — dört ad alanı:
 *
 *   `marketHours`     /abd-borsasi-saatleri
 *   `marketHolidays`  /abd-borsasi-tatil-gunleri
 *   `eventPages`      /takvim/fomc · /takvim/tufe · /takvim/tarim-disi-istihdam · /takvim/pce
 *   `quickAnswers`    bu sayfaları birbirine ve /takvim'e bağlayan şerit
 *
 * Ayrı dosyada: paralel paketler sözlüğün ortasına anahtar serpiştirmesin.
 *
 * METİNDE SAAT YOK. Bütün saatler `{open}`, `{close}`, `{time}` gibi yer
 * tutucular; değerler `lib/market-answers.ts` ve `lib/session-clock.ts`ten
 * o günün tarihiyle gelir (yazın 16:30, kışın 17:30).
 *
 * SAATE EK BİTİŞMEZ. "17:30'da açılır" yazılsaydı ek saatin OKUNUŞUNA bağlı
 * olurdu (otuzda, sıfırda, on üçte) ve sabit yazılamazdı; `lib/session-clock.ts`
 * → `dayBoundaryNote` ile aynı kural. Cümleler saati eksiz taşıyacak biçimde
 * kuruldu ("17:30–00:00 arasında", "21:00 itibarıyla"). Tek ekli yer tutucu
 * `{yearsIn}`: eki `trLocative` hesaplar ("2026 ve 2027'de").
 */

export const marketHoursTr = {
  metaTitle: "ABD Borsası Kaçta Açılıyor, Kaçta Kapanıyor?",
  /* {summer} / {winter}: "16:30–23:00". Dönemler ABD yaz saatine göre. */
  metaDescription:
    "ABD borsası (NYSE, Nasdaq) Türkiye saatiyle yazın {summer}, kışın {winter} arasında açık. Ön seans, akşam seansı, yaz saati geçişleri ve yarım günler.",
  /* Yıl içinde iki geçiş bulunamazsa (kural değişirse) tek dönemlik cümle. */
  metaDescriptionSingle:
    "ABD borsası (NYSE, Nasdaq) Türkiye saatiyle {hours} arasında açık. Ön seans ve akşam seansı saatleri, yaz saati geçişleri, yarım günler ve tatiller.",
  title: "ABD Borsası Saatleri (Türkiye Saatiyle)",
  /* İlk cümlenin dalları (`DayAnswerKind`). {open}/{close} Türkiye saati,
     {openNy}/{closeNy} New York; {next} aşağıdaki `next*` kalıplarından. */
  answer: {
    beforeOpen:
      "ABD borsası bugün Türkiye saatiyle {open}–{close} arasında açık; şu an kapalı, açılış zili henüz çalmadı.",
    preMarket:
      "ABD borsası bugün Türkiye saatiyle {open}–{close} arasında açık; şu an ön seans sürüyor, açılış zili henüz çalmadı.",
    open: "ABD borsası şu an açık: bugün Türkiye saatiyle {open}–{close} arasında işlem görüyor.",
    afterHours:
      "ABD borsası bugünkü seansını Türkiye saatiyle {close} itibarıyla kapattı; şu an akşam seansı sürüyor. Sıradaki açılış {next}.",
    closed:
      "ABD borsası bugünkü seansını Türkiye saatiyle {close} itibarıyla kapattı; şu an kapalı. Sıradaki açılış {next}.",
    weekend: "ABD borsası bugün kapalı (hafta sonu). Sıradaki açılış {next}.",
    holiday: "ABD borsası bugün {holiday} nedeniyle kapalı. Sıradaki açılış {next}.",
  },
  /* İşlem günü yarım günse cümlenin ardına eklenir. */
  answerHalfDay: " Bugün yarım gün: kapanış zili erken çalıyor.",
  nextToday: "bugün, Türkiye saatiyle {open}",
  nextTomorrow: "yarın, Türkiye saatiyle {open}",
  /* {date}: "16 Kasım Pazartesi". */
  nextDate: "{date}, Türkiye saatiyle {open}",

  /* Ölçü ızgarası. */
  factsLabel: "Günün Saatleri",
  factOpen: "Açılış Zili",
  factClose: "Kapanış Zili",
  factState: "Şu An",
  /* Bugün işlem yoksa ölçüler sıradaki seansı anlatır; künye günü söyler. */
  factNextOpen: "Sıradaki Açılış",
  factNextClose: "Sıradaki Kapanış",
  dayToday: "Bugün",
  dayTomorrow: "Yarın",
  state: {
    beforeOpen: "Kapalı",
    preMarket: "Ön Seans",
    open: "Açık",
    afterHours: "Akşam Seansı",
    closed: "Kapalı",
    weekend: "Hafta Sonu",
    holiday: "Tatil",
  },
  halfDayTag: "Yarım Gün",

  /* Seans tablosu ve şeridi. */
  sessionsTitle: "Seans Saatleri",
  sessionsBandLabel: "Günün üç seansı, süreleriyle orantılı",
  colSession: "Seans",
  colTr: "Türkiye Saati",
  colNy: "New York Saati",
  sessionPre: "Ön Seans",
  sessionRegular: "Asıl Seans",
  sessionAfter: "Akşam Seansı",
  sessionsNote:
    "Endeksler ve kapanış fiyatları asıl seansta oluşur. Ön seans ve akşam seansında işlem hacmi düşük, alım satım farkı geniştir; her aracı kurum bu saatlerde emir kabul etmez.",

  /* Yaz saati. */
  dstTitle: "Yaz Saati Geçişleri",
  /* Türkiye'nin o yıllarda saat değişikliği YOKSA basılır (hesaplanır). */
  dstLead:
    "Türkiye yaz saati uygulamıyor, ABD uyguluyor. Bu yüzden ABD'de saatler değiştiğinde açılış ve kapanış Türkiye saatiyle bir saat kayar.",
  dstLeadGeneric: "ABD'de saatler değiştiğinde açılış ve kapanış Türkiye saatiyle kayar.",
  colDate: "Tarih",
  colShift: "Geçiş",
  colAfter: "Sonrasında Asıl Seans",
  colLead: "Saat Farkı",
  shiftStart: "ABD Yaz Saati Başlıyor",
  shiftEnd: "ABD Yaz Saati Bitiyor",
  /* {n}: Türkiye'nin New York'tan kaç saat ileride olduğu. */
  leadHours: "{n} Saat",
  passed: "Geçti",

  /* Yarım günler. */
  halfTitle: "Yarım Günler",
  /* {hours}: akşam seansının süresi (saat), `AFTER_HOURS_MINUTES`ten. */
  halfLead:
    "Yarım günlerde kapanış zili erken çalar; akşam seansı da kapanıştan {hours} saat sonra biter.",
  halfEmpty: "Takvimde yaklaşan yarım gün yok.",
  colHalfDay: "Gün",
  colHalfClose: "Kapanış Zili",
  allHolidays: "Tüm Tatil Günleri",

  stampSource: "NYSE ve Nasdaq İşlem Saatleri",
  stampNote: "Saatler Her Günün Tarihiyle Hesaplanır",
};

export const marketHoursEn: typeof marketHoursTr = {
  metaTitle: "US Stock Market Hours in Türkiye Time",
  metaDescription:
    "NYSE and Nasdaq trade {summer} Türkiye time in summer and {winter} in winter. Pre-market and after-hours times, daylight saving shifts and early closes.",
  metaDescriptionSingle:
    "NYSE and Nasdaq trade {hours} Türkiye time. Pre-market and after-hours sessions, daylight saving shifts, early closes and market holidays.",
  title: "US Stock Market Hours (Türkiye Time)",
  answer: {
    beforeOpen:
      "The US stock market is open today from {open} to {close} Türkiye time ({openNy}–{closeNy} New York); it is closed right now and the opening bell has not rung yet.",
    preMarket:
      "The US stock market is open today from {open} to {close} Türkiye time ({openNy}–{closeNy} New York); pre-market trading is under way and the opening bell has not rung yet.",
    open: "The US stock market is open right now: it trades today from {open} to {close} Türkiye time ({openNy}–{closeNy} New York).",
    afterHours:
      "The US stock market closed today's session at {close} Türkiye time ({closeNy} New York); after-hours trading is under way. It next opens {next}.",
    closed:
      "The US stock market closed today's session at {close} Türkiye time ({closeNy} New York); it is closed now. It next opens {next}.",
    weekend: "The US stock market is closed today (weekend). It next opens {next}.",
    holiday: "The US stock market is closed today for {holiday}. It next opens {next}.",
  },
  answerHalfDay: " Today is a half day: the closing bell rings early.",
  nextToday: "today at {open} Türkiye time ({openNy} New York)",
  nextTomorrow: "tomorrow at {open} Türkiye time ({openNy} New York)",
  nextDate: "on {date} at {open} Türkiye time ({openNy} New York)",

  factsLabel: "Today's Hours",
  factOpen: "Opening Bell",
  factClose: "Closing Bell",
  factState: "Right Now",
  factNextOpen: "Next Open",
  factNextClose: "Next Close",
  dayToday: "Today",
  dayTomorrow: "Tomorrow",
  state: {
    beforeOpen: "Closed",
    preMarket: "Pre-Market",
    open: "Open",
    afterHours: "After Hours",
    closed: "Closed",
    weekend: "Weekend",
    holiday: "Holiday",
  },
  halfDayTag: "Half Day",

  sessionsTitle: "Session Hours",
  sessionsBandLabel: "The day's three sessions, drawn to scale",
  colSession: "Session",
  colTr: "Türkiye Time",
  colNy: "New York Time",
  sessionPre: "Pre-Market",
  sessionRegular: "Regular Session",
  sessionAfter: "After Hours",
  sessionsNote:
    "Index levels and closing prices are set in the regular session. Pre-market and after-hours trading is thin and spreads are wide; not every broker accepts orders in those hours.",

  dstTitle: "Daylight Saving Shifts",
  dstLead:
    "Türkiye does not observe daylight saving time; the US does. So when US clocks change, the open and close move by an hour in Türkiye time.",
  dstLeadGeneric: "When US clocks change, the open and close move in Türkiye time.",
  colDate: "Date",
  colShift: "Shift",
  colAfter: "Regular Session After",
  colLead: "Time Difference",
  shiftStart: "US Daylight Time Starts",
  shiftEnd: "US Daylight Time Ends",
  leadHours: "{n} Hours",
  passed: "Passed",

  halfTitle: "Half Days",
  halfLead:
    "On half days the closing bell rings early, and after-hours trading ends {hours} hours after that close.",
  halfEmpty: "No upcoming half day in the calendar.",
  colHalfDay: "Day",
  colHalfClose: "Closing Bell",
  allHolidays: "All Market Holidays",

  stampSource: "NYSE and Nasdaq Trading Hours",
  stampNote: "Times Are Computed for Each Day's Date",
};

export const marketHolidaysTr = {
  /* {years}: "2026 ve 2027" — veriden. */
  metaTitle: "ABD Borsası Tatil Günleri {years}",
  metaTitleBare: "ABD Borsası Tatil Günleri",
  /* {yearsIn}: "2026 ve 2027'de" — ek `trLocative`ten. */
  metaDescription:
    "ABD borsaları (NYSE, Nasdaq) {yearsIn} hangi günler kapalı, hangi günler erken kapanıyor? Yarım günlerin Türkiye saatiyle kapanışı ve sıradaki tatil.",
  metaDescriptionBare:
    "ABD borsaları (NYSE, Nasdaq) hangi günler kapalı, hangi günler erken kapanıyor? Yarım günlerin Türkiye saatiyle kapanışı ve sıradaki tatil.",
  yearJoin: " ve ",
  /* İlk cümle. {date}: "26 Kasım 2026 Perşembe". */
  answerNext: "ABD borsalarında sıradaki tatil {date}: {name}. NYSE ve Nasdaq o gün kapalı.",
  answerToday: "ABD borsaları bugün kapalı: {name}.",
  /* Sıradaki yarım gün, cümlenin ardına. {close} Türkiye saati. */
  answerEarly: " Sıradaki yarım gün {date}; kapanış zili Türkiye saatiyle {close}.",
  answerNone: "Takvimde ilan edilmiş sıradaki tatil yok.",

  factsLabel: "Sıradaki Tatil ve Yarım Gün",
  factNext: "Sıradaki Tatil",
  factEarly: "Sıradaki Yarım Gün",
  factEarlyClose: "Yarım Günde Kapanış",
  /* "12 Gün Sonra" — sayı + künye. */
  daysAway: "{n} Gün Sonra",
  today: "Bugün",
  tomorrow: "Yarın",

  /* {year}: tablo başlığı, veriden. */
  yearTitle: "{year} Tatil Günleri",
  /* Panel künyesi: "10 Tam Gün · 2 Yarım Gün". */
  yearCount: "{closed} Tam Gün · {early} Yarım Gün",
  colDate: "Tarih",
  colDay: "Gün",
  colHoliday: "Tatil",
  colStatus: "Durum",
  colClose: "Kapanış (Türkiye Saati)",
  statusClosed: "Kapalı",
  statusEarly: "Yarım Gün",
  passed: "Geçti",

  notesTitle: "Kısa Notlar",
  noteSame:
    "NYSE ve Nasdaq aynı tatil takvimini uygular. Tam tatilde ön seans ve akşam seansı da yapılmaz; yarım günde kapanış zili erken çalar ve akşam seansı da erken biter.",
  /* Yalnız veride gözlem günü varsa basılır. */
  noteObserved:
    "\"Gözlem\" notu taşıyan tatiller hafta sonuna denk geldiği için en yakın iş gününde uygulanır.",
  noteTurkiye:
    "Bu takvim yalnız ABD tatillerini gösterir; Türkiye'deki resmî tatillerde ABD borsaları açıktır.",
  hoursLink: "Borsa Saatleri",

  emptyTitle: "Tatil Takvimi Okunamadı",
  emptyHint: "Birazdan yeniden dene.",

  stampSource: "NYSE Tatil ve Erken Kapanış Takvimi",
  stampNote: "Yarım Gün Saatleri Günün Tarihiyle Hesaplanır",
};

export const marketHolidaysEn: typeof marketHolidaysTr = {
  metaTitle: "US Stock Market Holidays {years}",
  metaTitleBare: "US Stock Market Holidays",
  metaDescription:
    "Which days NYSE and Nasdaq are closed or close early in {yearsIn}, with early-close times in Istanbul time and the next holiday.",
  metaDescriptionBare:
    "Which days NYSE and Nasdaq are closed or close early, with early-close times in Istanbul time and the next market holiday.",
  yearJoin: " and ",
  answerNext: "The next US stock market holiday is {date}: {name}. NYSE and Nasdaq are closed that day.",
  answerToday: "US stock markets are closed today: {name}.",
  answerEarly: " The next half day is {date}; the closing bell rings at {close} Türkiye time.",
  answerNone: "The calendar has no announced upcoming holiday.",

  factsLabel: "Next Holiday and Half Day",
  factNext: "Next Holiday",
  factEarly: "Next Half Day",
  factEarlyClose: "Half-Day Close",
  daysAway: "In {n} Days",
  today: "Today",
  tomorrow: "Tomorrow",

  yearTitle: "{year} Market Holidays",
  yearCount: "{closed} Full Days · {early} Half Days",
  colDate: "Date",
  colDay: "Day",
  colHoliday: "Holiday",
  colStatus: "Status",
  colClose: "Close (Türkiye Time)",
  statusClosed: "Closed",
  statusEarly: "Half Day",
  passed: "Passed",

  notesTitle: "Quick Notes",
  noteSame:
    "NYSE and Nasdaq follow the same holiday calendar. On a full holiday there is no pre-market or after-hours trading either; on a half day the closing bell rings early and after-hours ends early too.",
  noteObserved:
    "Holidays marked \"observed\" fell on a weekend, so they are observed on the nearest business day.",
  noteTurkiye:
    "This calendar lists US holidays only; US markets stay open on public holidays in Türkiye.",
  hoursLink: "Market Hours",

  emptyTitle: "Holiday Calendar Unavailable",
  emptyHint: "Try again in a moment.",

  stampSource: "NYSE Holiday and Early Closings Calendar",
  stampNote: "Half-Day Times Are Computed for the Day's Date",
};

/* Olay sayfaları. `pages` anahtarları `lib/event-pages.ts` → `EventPageSlug`
   ile aynı; biri eksikse `eventPagesEn` derlenmez. */
export const eventPagesTr = {
  /* İlk cümle. {subject}: sayfanın `subject`i; {date}: "9 Aralık 2026
     Çarşamba"; {time} Türkiye saati, {timeNy} New York. */
  answerNext: "Sıradaki {subject} {date} günü, Türkiye saatiyle {time} (New York {timeNy}).",
  answerToday: "Sıradaki {subject} bugün, Türkiye saatiyle {time} (New York {timeNy}).",
  answerTomorrow: "Sıradaki {subject} yarın, Türkiye saatiyle {time} (New York {timeNy}).",
  /* Saati ilan edilmemiş olay: uydurma saat yok. */
  answerUntimed: "Sıradaki {subject} {date} günü; saati henüz ilan edilmedi.",
  answerNone:
    "Takvimde ilan edilmiş sıradaki {subject} tarihi yok; kurum yeni takvimini yayımladığında burada görünür.",
  /* Takvim okunamadı: boşluk iddiası basılmaz. */
  answerUnavailable: "Takvim şu an okunamadı; birazdan yeniden dene.",

  factsLabel: "Sıradaki Açıklama",
  factDate: "Sıradaki Tarih",
  factTime: "Türkiye Saati",
  factLeft: "Kalan Süre",
  daysLeft: "{n} Gün",
  today: "Bugün",
  tomorrow: "Yarın",
  /* Saat hücresindeki ikincil künye. */
  nyTag: "New York {time}",

  datesTitle: "Yaklaşan Tarihler",
  /* Panel künyesi: "8 Tarih". */
  datesCount: "{n} Tarih",
  colDate: "Tarih",
  colDay: "Gün",
  colTime: "Türkiye Saati",
  colNy: "New York",
  colWhat: "Açıklama",
  timeUnknown: "Saati İlan Edilmedi",
  projections: "Nokta Grafiği",

  recentTitle: "Son Açıklamalar",
  colActual: "Gerçekleşen",
  colForecast: "Beklenti",
  colPrevious: "Önceki",

  aboutTitle: "Bu Açıklama Nedir",
  /* {term}: sözlük teriminin adı. */
  glossaryLink: "Sözlükte: {term}",
  calendarLink: "Ekonomik Takvim",
  breadcrumb: "Ekonomik Takvim",

  yearJoin: "–",

  pages: {
    fomc: {
      /* {years}: "2026–2027" — yaklaşan toplantıların yılları, veriden. */
      metaTitle: "FOMC Toplantısı Ne Zaman? {years} Fed Takvimi",
      metaTitleBare: "FOMC Toplantısı Ne Zaman? Fed Takvimi",
      /* {date}: "9 Aralık 2026", {time} Türkiye saati. */
      metaDescription:
        "Fed'in sıradaki faiz kararı {date}, Türkiye saatiyle {time}. Yılın kalan FOMC toplantı tarihleri, son kararlar ve nokta grafikli toplantılar.",
      metaDescriptionBare:
        "Fed'in FOMC toplantı tarihleri, faiz kararının Türkiye saatiyle açıklanma saati, son kararlar ve nokta grafiği yayımlanan toplantılar.",
      title: "FOMC Toplantı Tarihleri",
      subject: "FOMC faiz kararı",
      link: "FOMC Toplantı Tarihleri",
      about:
        "FOMC (Federal Açık Piyasa Komitesi) Fed'in faiz kurulu; yılda sekiz kez toplanır ve politika faizini belirler. Karar toplantının ikinci günü açıklanır, yarım saat sonra Fed Başkanı basın toplantısı yapar. Dört toplantıda üyelerin faiz tahminlerini gösteren nokta grafiği de yayımlanır; piyasa çoğu zaman karardan çok bu tahminlere ve basın toplantısındaki cümlelere tepki verir.",
      source: "Federal Reserve Toplantı Takvimi",
    },
    tufe: {
      metaTitle: "ABD Enflasyon Verisi (TÜFE) Ne Zaman Açıklanacak?",
      metaTitleBare: "ABD Enflasyon Verisi (TÜFE) Ne Zaman Açıklanacak?",
      metaDescription:
        "ABD TÜFE (enflasyon) verisi {date}, Türkiye saatiyle {time} açıklanacak. Yaklaşan açıklama tarihleri, son verilerde beklenti ve gerçekleşen değerler.",
      metaDescriptionBare:
        "ABD TÜFE (enflasyon) verisinin açıklama tarihleri ve Türkiye saatiyle açıklanma saati, son verilerde beklenti ve gerçekleşen değerler.",
      title: "ABD TÜFE Açıklama Tarihleri",
      subject: "ABD TÜFE (enflasyon) verisi",
      link: "TÜFE Açıklama Tarihleri",
      about:
        "TÜFE (Tüketici Fiyat Endeksi), ABD'de tüketicinin ödediği fiyatların değişimini ölçer ve enflasyonun en çok izlenen göstergesidir. Çalışma İstatistikleri Bürosu (BLS) veriyi ayda bir, piyasa açılmadan önce açıklar. Beklentinin üstünde gelen veri Fed'in faiz indirmesini zorlaştırır; tahvil faizleri ve büyüme hisseleri ilk tepkiyi verir.",
      source: "BLS Yayın Takvimi · FRED",
    },
    "tarim-disi-istihdam": {
      metaTitle: "Tarım Dışı İstihdam Verisi Ne Zaman Açıklanacak?",
      metaTitleBare: "Tarım Dışı İstihdam Verisi Ne Zaman Açıklanacak?",
      metaDescription:
        "Tarım dışı istihdam verisi {date}, Türkiye saatiyle {time} açıklanacak. Yaklaşan istihdam raporu tarihleri, son verilerde beklenti ve gerçekleşen.",
      metaDescriptionBare:
        "ABD tarım dışı istihdam verisinin açıklama tarihleri ve Türkiye saatiyle açıklanma saati, son istihdam raporlarında beklenti ile gerçekleşen.",
      title: "Tarım Dışı İstihdam Açıklama Tarihleri",
      subject: "tarım dışı istihdam verisi",
      link: "Tarım Dışı İstihdam Tarihleri",
      about:
        "Tarım dışı istihdam, ABD ekonomisinin bir ayda tarım dışı sektörlerde eklediği ya da kaybettiği iş sayısıdır. BLS'nin istihdam raporuyla, çoğunlukla ayın ilk cuma günü piyasa açılmadan önce açıklanır; işsizlik oranı ve ücret artışı da aynı rapordadır. Ekonominin gidişatına dair en yakından izlenen veridir ve Fed'in faiz kararlarını doğrudan etkiler.",
      source: "BLS Yayın Takvimi · FRED",
    },
    pce: {
      metaTitle: "Çekirdek PCE Enflasyonu Ne Zaman Açıklanacak?",
      metaTitleBare: "Çekirdek PCE Enflasyonu Ne Zaman Açıklanacak?",
      metaDescription:
        "ABD çekirdek PCE enflasyonu {date}, Türkiye saatiyle {time} açıklanacak. Fed'in izlediği ölçünün yaklaşan tarihleri, son beklenti ve gerçekleşen.",
      metaDescriptionBare:
        "ABD çekirdek PCE enflasyonunun açıklama tarihleri ve Türkiye saatiyle açıklanma saati; Fed'in izlediği ölçüde beklenti ve gerçekleşen değerler.",
      title: "Çekirdek PCE Açıklama Tarihleri",
      subject: "çekirdek PCE verisi",
      link: "Çekirdek PCE Tarihleri",
      about:
        "Çekirdek PCE (gıda ve enerji hariç kişisel tüketim harcamaları fiyat endeksi), Fed'in enflasyon hedefinde esas aldığı ölçüdür. Ekonomik Analiz Bürosu (BEA) veriyi ayda bir, piyasa açılmadan önce açıklar. TÜFE'den farklı bir sepet kullandığı için iki sayı ayrışabilir; Fed'in açıklamalarında geçen enflasyon çoğu zaman budur.",
      source: "BEA Yayın Takvimi · FRED",
    },
  },
};

export const eventPagesEn: typeof eventPagesTr = {
  answerNext: "The next {subject} is on {date}, at {timeNy} New York time ({time} in Türkiye).",
  answerToday: "The next {subject} is today, at {timeNy} New York time ({time} in Türkiye).",
  answerTomorrow: "The next {subject} is tomorrow, at {timeNy} New York time ({time} in Türkiye).",
  answerUntimed: "The next {subject} is on {date}; the time has not been announced yet.",
  answerNone:
    "The calendar has no announced date for the next {subject}; it will appear here once the agency publishes its new schedule.",
  answerUnavailable: "The calendar could not be read right now; try again in a moment.",

  factsLabel: "Next Release",
  factDate: "Next Date",
  factTime: "Türkiye Time",
  factLeft: "Time Left",
  daysLeft: "{n} Days",
  today: "Today",
  tomorrow: "Tomorrow",
  nyTag: "New York {time}",

  datesTitle: "Upcoming Dates",
  datesCount: "{n} Dates",
  colDate: "Date",
  colDay: "Day",
  colTime: "Türkiye Time",
  colNy: "New York",
  colWhat: "Release",
  timeUnknown: "Time Not Announced",
  projections: "Dot Plot",

  recentTitle: "Recent Releases",
  colActual: "Actual",
  colForecast: "Forecast",
  colPrevious: "Previous",

  aboutTitle: "What This Release Is",
  glossaryLink: "In the Glossary: {term}",
  calendarLink: "Economic Calendar",
  breadcrumb: "Economic Calendar",

  yearJoin: "–",

  pages: {
    fomc: {
      metaTitle: "When Is the Next FOMC Meeting? {years} Fed Dates",
      metaTitleBare: "When Is the Next FOMC Meeting? Fed Calendar",
      metaDescription:
        "The Fed's next rate decision is on {date}, at {time} Türkiye time. Remaining FOMC meeting dates, recent decisions and dot plot meetings.",
      metaDescriptionBare:
        "FOMC meeting dates, the time the Fed's rate decision lands in Türkiye, recent decisions and the meetings that come with a dot plot.",
      title: "FOMC Meeting Dates",
      subject: "FOMC rate decision",
      link: "FOMC Meeting Dates",
      about:
        "The FOMC (Federal Open Market Committee) is the Fed's rate-setting body; it meets eight times a year and sets the policy rate. The decision comes on the second day of the meeting, followed half an hour later by the Fed Chair's press conference. Four meetings also bring the dot plot of officials' rate projections; markets often react more to those projections and the press conference than to the decision itself.",
      source: "Federal Reserve Meeting Calendar",
    },
    tufe: {
      metaTitle: "When Is the Next US CPI Release?",
      metaTitleBare: "When Is the Next US CPI Release?",
      metaDescription:
        "The next US CPI inflation report is on {date}, at {time} Türkiye time. Upcoming release dates, with recent forecast and actual values.",
      metaDescriptionBare:
        "US CPI inflation release dates and the time the report lands in Türkiye, plus forecast and actual values from recent reports.",
      title: "US CPI Release Dates",
      subject: "US CPI inflation report",
      link: "CPI Release Dates",
      about:
        "CPI (the Consumer Price Index) measures the change in prices US consumers pay and is the most watched inflation gauge. The Bureau of Labor Statistics (BLS) publishes it once a month, before the market opens. A hotter-than-expected print makes Fed rate cuts harder to justify; bond yields and growth stocks react first.",
      source: "BLS Release Schedule · FRED",
    },
    "tarim-disi-istihdam": {
      metaTitle: "When Is the Next Nonfarm Payrolls Report?",
      metaTitleBare: "When Is the Next Nonfarm Payrolls Report?",
      metaDescription:
        "The next US nonfarm payrolls report is on {date}, at {time} Türkiye time. Upcoming jobs report dates, with recent forecast and actual values.",
      metaDescriptionBare:
        "US nonfarm payrolls release dates and the time the jobs report lands in Türkiye, plus forecast and actual values from recent reports.",
      title: "Nonfarm Payrolls Release Dates",
      subject: "nonfarm payrolls report",
      link: "Nonfarm Payrolls Dates",
      about:
        "Nonfarm payrolls is the number of jobs the US economy added or lost outside farming in a month. It comes with the BLS Employment Situation report, usually on the first Friday of the month before the market opens; the unemployment rate and wage growth are in the same report. It is the most closely watched read on the economy and feeds directly into Fed rate decisions.",
      source: "BLS Release Schedule · FRED",
    },
    pce: {
      metaTitle: "When Is the Next Core PCE Release?",
      metaTitleBare: "When Is the Next Core PCE Release?",
      metaDescription:
        "The next US core PCE report is on {date}, at {time} Türkiye time. Upcoming dates for the Fed's preferred gauge, with recent forecasts and actuals.",
      metaDescriptionBare:
        "US core PCE inflation release dates and the time the report lands in Türkiye; forecast and actual values for the Fed's preferred gauge.",
      title: "Core PCE Release Dates",
      subject: "core PCE inflation report",
      link: "Core PCE Dates",
      about:
        "Core PCE (the personal consumption expenditures price index excluding food and energy) is the gauge the Fed's inflation target is built on. The Bureau of Economic Analysis (BEA) publishes it once a month, before the market opens. It uses a different basket than CPI, so the two can diverge; when the Fed talks about inflation, this is usually the number it means.",
      source: "BEA Release Schedule · FRED",
    },
  },
};

/* Soru sayfalarını birbirine bağlayan şerit. `hours` ve `holidays` alt
   bilginin "Piyasa" sütununda da kullanılır. */
export const quickAnswersTr = {
  title: "Sık Sorulanlar",
  navLabel: "Sık sorulan soruların sayfaları",
  hours: "Borsa Saatleri",
  holidays: "Tatil Günleri",
  dividends: "Temettü Takvimi",
};

export const quickAnswersEn: typeof quickAnswersTr = {
  title: "Common Questions",
  navLabel: "Pages for common questions",
  hours: "Market Hours",
  holidays: "Market Holidays",
  dividends: "Dividend Calendar",
};
