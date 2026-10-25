/**
 * `probabilities` ad alanı — Olasılıklar (25 Ekim). Sözlüğün parçası
 * (tr.ts / en.ts bunu `probabilities` anahtarına koyuyor), ayrı dosyada:
 * paralel geliştirilen paketler sözlüğün ortasına anahtar serpiştirmesin.
 *
 * KURAL: bu ad alanında hiçbir bağlantı adresi, işlem ya da bahis çağrısı
 * yok ("işlem yap", "al", "oyna"); kaynak adıyla anılır
 * (`tests/probabilities.test.ts` sınar, gerekçe lib/probabilities.ts).
 */

export const probabilitiesTr = {
  title: "Olasılıklar",
  subtitle: "Fed kararı, ara seçim ve resesyon için piyasa olasılıkları.",
  metaDescription:
    "Fed'in sıradaki faiz kararı, 2026 ABD ara seçimi ve resesyon için tahmin piyasasında fiyatlanan olasılıklar: kaynağı ve saatiyle.",
  menuHint: "Fed ve Seçim Olasılıkları",

  /* Veriden tek cümle — şablon + veri (lib/probabilities.ts → composeLead); görsel turdan beri tepe şeridinin ekran okuyucu özeti. */
  leadPrefix: "Piyasa fiyatlarına göre ",
  leadFed: "{date} Fed toplantısında {move} olasılığı {p}",
  leadCongressSame: "{party} Temsilciler Meclisi'ni kazanma olasılığı {house}, Senato'yu kazanma olasılığı {senate}",
  leadCongressSplit: "Temsilciler Meclisi'nde {houseParty} {house}, Senato'da {senateParty} {senate} olasılıkla önde",
  leadCongressOne: "{party} {chamber} kazanma olasılığı {p}",
  leadCongressResult: "{chamber} {party} kazandı",
  leadJoin: "; ",
  leadJoinResults: ", ",
  /* Cümle içi biçimler: ilgi hâli (parti) ve belirtme hâli (meclis). */
  leadMove: {
    cut50: "25 baz puandan büyük indirim",
    cut25: "25 baz puanlık indirim",
    hold: "faizin sabit kalma",
    hike25: "25 baz puanlık artış",
    hike50: "25 baz puandan büyük artış",
  },
  leadParty: { dem: "Demokratların", rep: "Cumhuriyetçilerin" },
  leadChamber: { house: "Temsilciler Meclisi'ni", senate: "Senato'yu" },
  /* Olasılık kesinlik değildir — cümlenin altında, kısa. */
  certainty: "Olasılık kesinlik değildir: %70 olasılık biçilen bir olay, on seferden üçünde gerçekleşmez.",

  /* Tepe şeridi: dört kadran (Fed, iki meclis, resesyon). */
  stripAria: "Öne çıkan olasılıklar",
  stripFed: "Fed · {date}",
  stripRecession: "Resesyon 2027",
  stripMove: { cut50: "Büyük İndirim", cut25: "İndirim", hold: "Sabit", hike25: "Artış", hike50: "Büyük Artış" },
  stripParty: { dem: "Demokrat", rep: "Cumhuriyetçi" },
  stripChance: "Olasılık",
  stripWon: "Kazandı",
  stripDelta: "24 Saatte {n}",
  stripNoChange: "24 Saatte Değişmedi",
  stripJump: "{label} kartına git",

  /* Fed paneli */
  fedTitle: "Fed'in Sıradaki Kararı",
  fedMeta: "{date} · {time}",
  fedLeadLabel: "En Olası Sonuç",
  fedOutcomes: {
    cut50: "25 bp'den Büyük İndirim",
    cut25: "25 bp İndirim",
    hold: "Sabit",
    hike25: "25 bp Artış",
    hike50: "25 bp'den Büyük Artış",
  },
  fedSides: { cut: "İndirim", hold: "Sabit", hike: "Artış" },
  /* Yığının altındaki ölçek: kısa adlar; tam adlar `fedOutcomes`te (aria). */
  fedScale: { cut50: "−50+ bp", cut25: "−25 bp", hold: "Sabit", hike25: "+25 bp", hike50: "+50+ bp" },
  fedBarLabel: "Karar seçeneklerinin olasılıkları: {list}",
  fedLineTitle: "Son 30 Gün",
  fedLineLabel: "Son 30 günde indirim, sabit ve artış olasılıkları",
  fedTarget: "Bugünkü Hedef Aralık",
  fedCountdown: "Karara",
  fedLinkCalendar: "Takvimde Gör",
  change24h: "24 Saatte",
  points: "{n} Puan",
  noChange: "Değişmedi",

  /* Patika */
  pathTitle: "Beklenen Faiz Patikası",
  pathNote:
    "Her toplantının olasılıkları kendi kontratından okunur; beklenen düzey bugünkü hedef aralığın ortasına toplantıların beklenen değişimleri eklenerek bulunur. 25 baz puandan büyük adımlar 50 sayıldı.",
  pathNoTarget: "Bugünkü hedef aralık okunamadı; patika baz puan değişimi olarak gösteriliyor.",
  pathExpected: "Beklenen Düzey",
  pathMove: "Toplantıda Beklenen",
  pathCumulative: "Bugünden Beri",
  pathThin: "Az İşlem",
  pathThinNote: "Soluk sütunlarda işlem az; olasılık gösterge niteliğinde.",
  pathAria: "Önümüzdeki toplantılarda beklenen faiz düzeyi",
  pathToday: "Bugün",
  bps: "{n} bp",

  /* Seçim */
  electionTitle: "2026 Ara Seçimi",
  electionMeta: "3 Kasım 2026",
  electionMetaDays: "3 Kasım · {n} Gün Kaldı",
  electionMetaToday: "3 Kasım · Seçim Günü",
  electionDaysLeft: "Gün Kaldı",
  electionToday: "Seçim Günü",
  electionPolls: "İlk sandıklar kapanıyor: {primary} · {secondary}",
  electionAfter: "Sonuçlar geliyor; kaynak bir meclisi sonuçlandırınca olasılığın yerine sonuç yazılır.",
  house: "Temsilciler Meclisi",
  senate: "Senato",
  parties: { dem: "Demokratlar", rep: "Cumhuriyetçiler" },
  majority: "Çoğunluk",
  chamberLead: "Kazanma Olasılığı",
  resolved: "Sonuç",
  resolvedWinner: "{party} Kazandı",
  resolvedNote: "Kaynak bu piyasayı sonuçlandırdı; gösterilen olasılık değil, sonuç.",
  chamberBarLabel: "{chamber}: {list}",
  chamberLineLabel: "{chamber} için son 30 günde parti olasılıkları",
  partyNote:
    "Renkler: partiler ABD'deki alışkanlıkla çizilir, Demokratlar mavi, Cumhuriyetçiler kırmızı; bu kırmızı sitenin düşüş renginden ayrı bir tondur. Fed kararında yön renkleri kullanılmaz: indirim mor, sabit mavi, artış pirinç tonunda.",

  /* Diğer olaylar */
  otherTitle: "Diğer Olaylar",
  recessionTitle: "2027'de ABD Resesyonu",
  recessionNote: "Resesyonun başlangıcını NBER ilan eder; ilan aylar sonra gelebilir.",
  recessionLineLabel: "2027 resesyonu olasılığı, son 30 gün",
  yes: "Evet",
  no: "Hayır",
  cpiTitle: "Sıradaki Aylık Enflasyon",
  cpiMeta: "{month} TÜFE · {date} Açıklanıyor",
  cpiAbove: "%{n} Üstü",
  cpiMedian: "Piyasanın orta tahmini: aylık ~{value}.",
  cpiNoMedian: "Orta tahmin merdivenin dışında kalıyor.",
  cpiNote: "Her basamak ayrı bir kontrat: aylık TÜFE değişiminin o eşiği aşma olasılığı.",
  cpiAria: "Aylık TÜFE'nin eşikleri aşma olasılıkları",

  /* Ortak */
  thin: "Az İşlem: Gösterge Niteliğinde",
  lineHint: "Çizginin üzerine gelin ya da dokunun; o günün olasılıkları burada görünür.",
  mid: "%50",
  noData: "Olasılıklar Şu An Alınamadı",
  noDataHint: "Kaynağa ulaşılamıyor ya da son kayıt 36 saatten eski; eski olasılık gösterilmiyor.",
  panelEmpty: "Bu bölümün verisi şu an yok.",
  sourceLabel: "Piyasa Olasılıkları",
  daily: "Günlük",

  /* Künyeler (panelin içinde, düz paragraf) */
  notesTitle: "Bu Sayılar Nedir",
  noteHow:
    "Tahmin piyasasında bir \"Evet\" kontratı olay gerçekleşirse 1 dolar öder. Kontrat 0,63 dolardan alınıp satılıyorsa piyasa olaya kabaca %63 olasılık biçiyor demektir. Birbirini dışlayan sonuçların fiyatları toplamı 1'e ölçeklenir.",
  noteSource:
    "Olasılıklar, ABD'de CFTC denetimindeki bir olay vadeli işlem piyasasının herkese açık fiyatlarından okunur. Açılış Zili kendi tahminini eklemez, Claude bu sayıları üretmez.",
  noteNoBetting:
    "Bu sayfa yalnız fiyattan okunan olasılığı gösterir. İşlem ya da bahis bağlantısı vermez, kimseyi işlem yapmaya yönlendirmez; Türkiye'de bahis siteleri yasaktır ve bu platformlara Türkiye'den erişim engellidir.",
  noteThin: "Az işlem gören piyasalar \"Az İşlem\" künyesiyle gösterilir; çok azsa hiç gösterilmez.",
  noteDaily: "Olasılıklar günde bir kez alınır; seçim gecesi ve Fed karar saatinde saatte bir.",
  disclaimer: "Yatırım Tavsiyesi Değildir.",

  /* Makro'nun FOMC kartında ve takvimin FOMC satırında küçük künye. */
  tagLabel: "Piyasa Fiyatlaması",
  tagLink: "Tüm Olasılıklar",
};

export const probabilitiesEn: typeof probabilitiesTr = {
  title: "Probabilities",
  subtitle: "What markets price for the Fed, the midterms and a recession.",
  metaDescription:
    "Prediction-market probabilities for the Fed's next rate decision, the 2026 US midterms and a recession, with source and time.",
  menuHint: "Fed and Midterm Odds",

  leadPrefix: "Market prices put ",
  leadFed: "the odds of {move} at the {date} Fed meeting at {p}",
  leadCongressSame: "{party} winning the House at {house} and the Senate at {senate}",
  leadCongressSplit: "{houseParty} ahead in the House at {house} and {senateParty} ahead in the Senate at {senate}",
  leadCongressOne: "{party} winning the {chamber} at {p}",
  leadCongressResult: "{party} won the {chamber}",
  leadJoin: "; ",
  leadJoinResults: ", ",
  leadMove: {
    cut50: "a cut larger than 25 bp",
    cut25: "a 25 bp cut",
    hold: "a hold",
    hike25: "a 25 bp hike",
    hike50: "a hike larger than 25 bp",
  },
  leadParty: { dem: "Democrats", rep: "Republicans" },
  leadChamber: { house: "House", senate: "Senate" },
  certainty: "A probability is not a certainty: an event priced at 70% fails to happen three times out of ten.",

  stripAria: "Headline probabilities",
  stripFed: "Fed · {date}",
  stripRecession: "Recession 2027",
  stripMove: { cut50: "Big Cut", cut25: "Cut", hold: "Hold", hike25: "Hike", hike50: "Big Hike" },
  stripParty: { dem: "Democrat", rep: "Republican" },
  stripChance: "Chance",
  stripWon: "Won",
  stripDelta: "{n} in 24h",
  stripNoChange: "Unchanged in 24h",
  stripJump: "Go to the {label} card",

  fedTitle: "The Fed's Next Decision",
  fedMeta: "{date} · {time}",
  fedLeadLabel: "Most Likely Outcome",
  fedOutcomes: {
    cut50: "Cut Above 25 bp",
    cut25: "25 bp Cut",
    hold: "Hold",
    hike25: "25 bp Hike",
    hike50: "Hike Above 25 bp",
  },
  fedSides: { cut: "Cut", hold: "Hold", hike: "Hike" },
  fedScale: { cut50: "−50+ bp", cut25: "−25 bp", hold: "Hold", hike25: "+25 bp", hike50: "+50+ bp" },
  fedBarLabel: "Probabilities of the decision options: {list}",
  fedLineTitle: "Last 30 Days",
  fedLineLabel: "Probabilities of a cut, hold and hike over the last 30 days",
  fedTarget: "Current Target Range",
  fedCountdown: "To the Decision",
  fedLinkCalendar: "See in Calendar",
  change24h: "In 24 Hours",
  /* Yüzde puanı: "1 Points" tekil/çoğul derdi yok, kısaltma sabit. */
  points: "{n} pp",
  noChange: "Unchanged",

  pathTitle: "Expected Rate Path",
  pathNote:
    "Each meeting's probabilities come from its own contract; the expected level adds each meeting's expected change to the midpoint of today's target range. Moves larger than 25 bp are counted as 50.",
  pathNoTarget: "Today's target range could not be read; the path is shown as a change in basis points.",
  pathExpected: "Expected Level",
  pathMove: "Expected at the Meeting",
  pathCumulative: "Since Today",
  pathThin: "Thin Trading",
  pathThinNote: "Faded columns trade thinly; their probabilities are indicative.",
  pathAria: "Expected policy rate at the coming meetings",
  pathToday: "Today",
  bps: "{n} bp",

  electionTitle: "2026 Midterm Elections",
  electionMeta: "November 3, 2026",
  electionMetaDays: "November 3 · {n} Days Left",
  electionMetaToday: "November 3 · Election Day",
  electionDaysLeft: "Days Left",
  electionToday: "Election Day",
  electionPolls: "First polls close: {primary} · {secondary}",
  electionAfter: "Results are coming in; once the source settles a chamber, the result replaces the probability.",
  house: "House",
  senate: "Senate",
  parties: { dem: "Democrats", rep: "Republicans" },
  majority: "Majority",
  chamberLead: "Chance of Winning",
  resolved: "Result",
  resolvedWinner: "{party} Won",
  resolvedNote: "The source has settled this market; what you see is the result, not a probability.",
  chamberBarLabel: "{chamber}: {list}",
  chamberLineLabel: "Party probabilities for the {chamber} over the last 30 days",
  partyNote:
    "Colors: parties follow the US convention, Democrats blue and Republicans red; this red is a different shade from the site's down color. The Fed decision avoids direction colors: cuts are purple, a hold is blue, hikes are brass.",

  otherTitle: "Other Events",
  recessionTitle: "US Recession in 2027",
  recessionNote: "The NBER dates the start of a recession; the call can come months later.",
  recessionLineLabel: "Probability of a 2027 recession, last 30 days",
  yes: "Yes",
  no: "No",
  cpiTitle: "Next Monthly Inflation",
  cpiMeta: "{month} CPI · Out {date}",
  cpiAbove: "Above {n}%",
  cpiMedian: "The market's middle estimate: about {value} month over month.",
  cpiNoMedian: "The middle estimate falls outside the ladder.",
  cpiNote: "Each step is a separate contract: the probability that monthly CPI change exceeds that threshold.",
  cpiAria: "Probabilities of monthly CPI exceeding each threshold",

  thin: "Thin Trading: Indicative Only",
  lineHint: "Hover over or tap the line to read that day's probabilities here.",
  mid: "50%",
  noData: "Probabilities Unavailable Right Now",
  noDataHint: "The source can't be reached or the latest record is older than 36 hours; stale odds are not shown.",
  panelEmpty: "No data for this section right now.",
  sourceLabel: "Market Probabilities",
  daily: "Daily",

  notesTitle: "What These Numbers Are",
  noteHow:
    "On a prediction market a \"Yes\" contract pays $1 if the event happens. If it trades at $0.63, the market is putting roughly a 63% chance on the event. Prices of mutually exclusive outcomes are scaled to add up to 1.",
  noteSource:
    "Probabilities are read from the public prices of a CFTC-regulated US event contracts market. Opening Bell adds no forecast of its own and Claude does not produce these numbers.",
  noteNoBetting:
    "This page only shows the probability read from prices. It carries no trading or betting links and steers no one to trade; betting sites are banned in Türkiye and these platforms are blocked there.",
  noteThin: "Thinly traded markets carry a \"Thin Trading\" tag; if trading is very thin they are not shown.",
  noteDaily: "Probabilities are taken once a day; hourly on election night and around the Fed's decision.",
  disclaimer: "Not Investment Advice.",

  tagLabel: "Market Pricing",
  tagLink: "All Probabilities",
};
