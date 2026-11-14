/* Veritabanı tabloları: satırlar sütun adıyla (snake_case), değerler metin
   (Neon HTTP böyle verir). Süzme, sıralama ve sınır BURADA DEĞİL
   `sorgu.cjs`te: tablo bütün satırları taşır, sorgunun WHERE'i seçer.
   Yeni tablo eklemek = `kur()`a bir anahtar eklemek.

   Tarihler bugüne (ET, `MOCK_NOW` varsa ona) göre; `veri()` on beş dakikada
   bir yeniden kurulur, gece yarısını geçen sunucu bayat "bugün" taşımaz.

   BİLANÇO SENARYOLARI (sembol → durum):
   NVDA  sıradaki bilanço haftanın salısı (kapanış sonrası), iki çeyrek geçmiş + iki analiz
   HD    son işlem günü açıkladı, beklentiyi AŞTI; sıradaki tarih yok
   WMT   son işlem günü açıkladı, KAÇIRDI; sıradaki 95 gün sonra, saati belirsiz
   TSN   takvimde HİÇ yok, sürpriz geçmişi yok
   PDD   yalnız tahmini tarih (40 gün), beklenti ve geçmiş yok
   RKLB  zarar eden şirket, 12 gün sonra
   ZETA  takvim yok, analiz yok (eksik verili küçük şirket) */
const { hash, rng, uid, oku, HOLIDAYS, addDays, dow, isTrading, today, day, isGunu, et } = require("./ortak.cjs");
const { px, NAMES, MEMBERS, NOCAP, capOf, metric } = require("./piyasa.cjs");
const teknik = require("./teknik.cjs");

const BRIEF_BODY = [
  "Petrol haftaya sert düşüşle başladı: Brent sabah saatlerinde %4'ten fazla gerileyerek varil başına 94 dolar civarına indi. Cuma kapanışı 98,3 dolardı. Düşüşü Başkan Donald Trump'ın Pazar günü CNN'e verdiği röportaj tetikledi.",
  "- Trump, İran'a yeni saldırı gerekip gerekmeyeceğini anlaşmaya bağladı. Ardından ekledi: **\"The answer is, highly unlikely it's going to be necessary.\"** Hürmüz Boğazı'ndaki risk ise sürüyor; İran Devrim Muhafızları Cumartesi gecesi iki tankerin mayına çarparak alev aldığını açıkladı.\n- Ucuzlayan petrol vadeli işlemleri yukarı taşıdı. Salı açıklanacak TÜFE öncesinde enerji fiyatlarındaki düşüş, Aralıkta faiz artırımı beklentisini taşıyan enflasyon baskısını hafifletiyor. Ama endeksin en büyük hissesi bu yükselişe katılmıyor.\n- Nvidia'nın yönetim kurulu Pazar günü, CEO Jensen Huang'ın bir yabancı istihbarat girişiminin hedefi olup olmadığını araştırmak için iç soruşturma başlattı. Huang çalışanlarına gönderdiği mesajda tüm sorumluluğu üstlendiğini yazdı.",
  "Hisse açılış öncesinde %4'e yakın geriledi; yarı iletken endeksinin geri kalanı ise AMD öncülüğünde yükseliyor. Micron ve Broadcom cuma günkü kazançlarını koruyor.",
  "Tahvil tarafında 10 yıllık faiz %4,88'de yatay. Piyasa Aralık toplantısında 25 baz puanlık artırıma %38 olasılık veriyor; bir hafta önce bu oran %52 idi.",
  "Bugünün takviminde Ekim TÜFE verisi ve beş bilanço var. CoreWeave kapanış sonrası açıklayacak; şirketin yapay zekâ altyapı talebi hakkında söyleyecekleri haftanın tonunu belirleyebilir.",
  "Asya'da Nikkei %0,4, KOSPI %1,1 geriledi; Avrupa'da DAX %0,3 yükselişle açıldı. Dolar endeksi 104,2'de, altın ons başına 4.120 dolar civarında.",
].join("\n\n");
const STORY_BODY = "SoftBank nisan-eylülde 4,8 milyar dolar zarar etti.\n\n::: sayilar Sayılarla\n4,8 Mr $ | Altı Aylık Net Zarar\n3,73 Mr $ | Türbin Siparişlerinde Silinen Tutar\n%15,9 | 30 Eylül'de Borç-varlık Oranı\n%13,9 | Hissenin 10 Kasım Yükselişi\n:::\n\nOhio'daki veri merkezleri için ayırdığı türbin ve jeneratör siparişleri en büyük kalem oldu.";
const STORY_SEED = [
  ["softbank-turbin", "SoftBank Türbin Siparişinde 3,7 Milyar Dolar Zarar Yazdı, Musk'ı Yalanladı", "SoftBank nisan-eylülde 4,8 milyar dolar zarar etti; Ohio'daki veri merkezleri için ayırdığı türbin ve jeneratör siparişleri en büyük kalem oldu. Şirket Elon Musk'ın temerrüt iddiasını reddetti, ama borç-varlık oranı OpenAI ve çip hisselerindeki düşüşle yükseldi.", 0, ["SFTBY", "GEV", "NVDA", "ARM", "INTC"]],
  ["sp500-petrol", "S&P 500 Petrol Düşünce %2,35 Yükseldi, Tahvil Faizi Yerinde Kaldı", "Brent, Trump'ın İran'a yeni saldırıyı pek olası görmediğini söylemesiyle %4,7 düştü; AMD %12,9 yükselirken Nvidia CEO soruşturması yüzünden %4,27 geriledi. 10 yıllık faiz ise %4,88'e çıktı, Fed'in aralık artırımı fiyatlaması yerinde kaldı.", -1, ["SPY", "QQQ"]],
  ["nvidia-huang", "Nvidia CEO'su Huang İlişkiyi Kabul Etti, Yönetim Kurulu Soruşturma Açtı", "Jensen Huang, ABD istihbaratının Çin adına çalıştığından şüphelendiği Megaspeed yöneticisi Alice Huang ile ilişkisini kabul etti; Nvidia kurulu bağımsız soruşturma başlattı. Trump Huang'ı savundu, hisse açılış öncesi %4 geriledi.", -2, ["NVDA", "TSM"]],
  ["berkshire-geri-alim", "Berkshire Rekor Hisse Geri Alımı Yaptı, Sigorta Kârı %43 Düştü", "Greg Abel yönetimindeki Berkshire Hathaway üçüncü çeyrekte kendi hissesine 9,6 milyar dolar harcadı ve ekimde de almayı sürdürdü. GEICO'daki hasar artışıyla faaliyet kârı %5,8 geriledi; piyasa sonuçları pazartesi fiyatlayacak.", -3, ["BRK.B"]],
  ["fed-aralik", "Fed Tutanakları Aralık İçin Kapıyı Açık Bıraktı", "Üyelerin çoğu enflasyonun hedefe dönüş hızından rahatsız.", -5, []],
  ["amd-rekor", "AMD Veri Merkezi Gelirinde Rekor Kırdı", "Şirket dördüncü çeyrek beklentisini yükseltti.", -6, ["AMD"]],
];
const ANALYSIS_SEED = [
  ["ASTS", "AST SpaceMobile", 44, "sell", 187, -10.0, -0.7, "AST SpaceMobile üçüncü çeyrekte 42,3 milyon dolar gelirle yıllık %187 büyüdü ama beklentinin %7,4 altında kaldı; hisse başına zarar da beklentiden %10 büyük çıktı. Hisse gün içinde Rakuten ortaklığı haberiyle %14 yükseldiği için kapanış sonrası yalnızca %0,7 geriledi."],
  ["RKLB", "Rocket Lab", 60, "hold", 73, -71.4, -6.7, "Rocket Lab rekor gelir açıkladı, Neutron takvimi kaydı."],
  ["AAOI", "Applied Optoelectronics", 52, "hold", 128, 21.4, -8.0, "Gelir ikiye katlandı, marj beklentinin altında."],
  ["SO", "Southern Company", 80, "buy", 13, 13.5, 0.2, "Veri merkezi talebi yük tahminini yükseltti."],
  ["DUK", "Duke Energy", 72, "buy", 7, 6.4, 0.4, "Düzenlenmiş gelir tabanı büyüdü."],
  ["ARM", "Arm Holdings", 71, "buy", 27, 10.6, -13.1, "Lisans geliri güçlü, yönlendirme temkinli."],
  ["PLTR", "Palantir Technologies", 77, "buy", 48, 12.2, 3.1, "Ticari gelir hızlandı."],
  ["UBER", "Uber Technologies", 66, "hold", 18, -4.2, -2.9, "Brüt rezervasyon beklentide, marj daraldı."],
  ["PFE", "Pfizer", 58, "hold", -3, 8.8, 1.2, "Maliyet kesintileri kârı taşıdı."],
  ["SMCI", "Super Micro Computer", 38, "sell", 9, -22.5, -11.4, "Marj baskısı sürüyor."],
  ["SHOP", "Shopify", 74, "buy", 31, 5.1, 6.8, "Brüt mal hacmi beklentiyi aştı."],
  ["QCOM", "Qualcomm", 69, "hold", 10, 3.9, -1.8, "Otomotiv gelirleri rekor."],
  ["DIS", "Walt Disney", 63, "hold", 4, 7.7, 2.4, "Yayın kârlılığı arttı."],
  ["ABNB", "Airbnb", 61, "hold", 11, -1.0, -3.5, "Rezervasyon büyümesi yavaşladı."],
  ["MELI", "MercadoLibre", 79, "buy", 39, 2.8, 4.9, "Fintech kredi portföyü genişledi."],
  ["LYFT", "Lyft", 55, "hold", 16, 0, 0.6, "Sürüş sayısı rekor."],
];
const NEWS_HEADS = [
  ["Nvidia yönetim kurulu Jensen Huang hakkında soruşturma başlattı, Wall Street yapay zeka darbelerini atlatmaya çalışıyor", "Nasdaq, yapay zeka çip hisselerine alıcıların dönmesiyle %2,7 yükseldi; Nvidia ise CEO Jensen Huang'a ilişkin endişelerle düştü.", "ChartMill", ["NVDA"]],
  ["Gelecekteki nakit akışına göre \"Yedi Dev\" hisseleri en cazipten en az cazibeliye sıralanıyor", "", "Yahoo", []],
  ["Nvidia yönetim kurulu, Jensen Huang'ın iddia edilen bir Çinli istihbarat varlığıyla ilişkisini soruşturuyor", "", "Yahoo", ["NVDA"]],
  ["Stanley Black & Decker konsensüs hedef fiyatı %11,20 artırılarak 111,38 dolara yükseltildi", "", "Fintel", ["SWK"]],
  ["Solventum (SOLV) hisseleri neden yükseliyor", "", "Yahoo", ["SOLV"]],
  ["Bu 5 internet platformu hissesi reklam gelirleriyle çalışıyor", "", "Yahoo", []],
  ["USA Rare Earth (USAR) 3. çeyrek 2026 bilanço görüşmesi metni", "", "Yahoo", ["USAR"]],
  ["TSM hissesi neden gece yükseliyor?", "", "Yahoo", ["TSM"]],
];
/* Bilanço haftası: [gün (haftanın kaçıncı işlem günü), [sembol, saat, HBK beklentisi, gelir beklentisi][], dolgu satırı sayısı].
   Dolgu canlıdaki yoğunluğu taşır (salı günü yüzden fazla küçük şirket). */
const WEEK = [
  [0, [["SJM", "bmo", 2.1, 2.28e9], ["ARMK", "bmo", 0.77, 5.41e9], ["PSKY", "amc", -0.04, 16.6e9], ["SHAZ", "amc", -0.52, 27.5e6], ["ACM", "amc", 1.59, 1.94e9], ["CNGO", null, null, null]], 126],
  [1, [["NVDA", "amc", 2.53, 111e9], ["DIS", "bmo", 1.69, 25.4e9], ["VIK", "bmo", 1.28, 2.23e9], ["WSM", "bmo", 2.2, 2.02e9], ["DLB", "amc", 1.21, 376e6], ["CAAP", null, 0.6, 558e6], ["BDVC", null, null, null]], 101],
  [2, [["PANW", "amc", 0.99, 3.37e9], ["TJX", "bmo", 1.35, 16.0e9], ["LOW", "bmo", 2.91, 22.6e9], ["ROST", null, 1.88, 6.37e9], ["TGT", "bmo", 2.07, 26.7e9], ["CPRT", null, 0.41, 1.21e9], ["SNEX", null, 0.9, 698e6], ["NJR", "amc", 0.13, 344e6]], 83],
  [3, [["INTU", null, 2.71, 4.39e9], ["KEYS", "amc", 3.44, 1.98e9], ["ROAD", "amc", 1.13, 1.11e9], ["BULL", null, 0.06, 223e6], ["QNME", null, null, null]], 35],
  [4, [["BJ", null, 1.1, 5.4e9], ["BMNR", null, -0.02, 0]], 4],
];
const TODAY_EARN = [["BN", null, 0.75, 1.85e9], ["TDG", "bmo", 12.33, 2.98e9], ["CRWV", "amc", -1.18, 3.62e9], ["TNGX", null, -0.36, 0], ["COAG", "bmo", -0.53, 0], ["ALLR", null, -0.21, 0]];
const HOURS = ["bmo", "amc", null, "amc", "bmo", null, "amc"];
const s = (v) => (v === null || v === undefined ? null : String(v));

function monthly(latest, prev, n = 24) { const out = []; const r = rng("m" + latest); const [y, m] = today().split("-").map(Number); for (let i = n - 1; i >= 0; i--) { const v = i === 0 ? latest : i === 1 ? prev : prev - (i - 1) * (latest - prev) * 0.3 + (r() - 0.5) * 0.2; out.push({ date: new Date(Date.UTC(y, m - 2 - i, 1)).toISOString().slice(0, 10), value: +v.toFixed(2) }); } return out; }

/* Ekonomik takvim: ilan edilmiş tarihler tohumdan (TÜFE, FOMC, istihdam),
   haftalık başvurular kuraldan, PCE ve 2027 TÜFE satırları FRED senkronunun
   yazdığı biçimde. Geçmiş olay gerçekleşen/beklenti/önceki taşır, yakın
   gelecek beklenti/önceki, uzak gelecek boş. */
function economicEvents(now) {
  const src = oku("db/seed/economic-events.ts");
  const block = (name) => (new RegExp(`const ${name}[^=]*= \\[([\\s\\S]*?)\\n\\];`).exec(src) || [0, ""])[1];
  const rows = [];
  const add = (date, time, family, tr, en, importance, unit, fred, source) => rows.push({ event_date: date, event_time_et: time, slug: `${family}-${date}`, family, title_tr: tr, title_en: en, importance, unit, fred_series_id: fred, source });
  for (const m of block("CPI_RELEASES").matchAll(/date: "([^"]+)", refTr: "([^"]+)", refEn: "([^"]+)"/g)) { add(m[1], "08:30", "cpi", `${m[2]} TÜFE Verisi`, `${m[3]} CPI Data`, "high", "%", "CPIAUCSL", "bls-schedule"); add(m[1], "08:30", "core-cpi", `${m[2]} Çekirdek TÜFE Verisi`, `${m[3]} Core CPI Data`, "high", "%", "CPILFESL", "bls-schedule"); }
  for (const m of block("FOMC_DECISIONS").matchAll(/date: "([^"]+)", sep: (true|false)/g)) { add(m[1], "14:00", "fomc-rate", "Fed Faiz Kararı (FOMC)", "Fed Rate Decision (FOMC)", "high", "%", "DFEDTARU", "federalreserve"); add(m[1], "14:30", "fomc-presser", "Fed Başkanı Basın Toplantısı", "Fed Chair Press Conference", "high", null, null, "federalreserve"); if (m[2] === "true") add(m[1], "14:00", "fomc-sep", "Fed Ekonomik Projeksiyonları (Nokta Grafiği)", "Fed Economic Projections (Dot Plot)", "high", null, null, "federalreserve"); }
  for (const m of block("PAYROLL_RELEASES").matchAll(/date: "([^"]+)", refTr: "([^"]+)", refEn: "([^"]+)"/g)) { add(m[1], "08:30", "nfp", `${m[2]} Tarım Dışı İstihdam Verisi`, `${m[3]} Nonfarm Payrolls Data`, "high", "bin", "PAYEMS", "bls-rule"); add(m[1], "08:30", "unemployment", `${m[2]} İşsizlik Oranı Verisi`, `${m[3]} Unemployment Rate Data`, "high", "%", "UNRATE", "bls-rule"); }
  let thu = addDays(now, -84); while (dow(thu) !== 4) thu = addDays(thu, 1);
  for (let i = 0; i < 64; i++, thu = addDays(thu, 7)) add(isTrading(thu) ? thu : addDays(thu, -1), "08:30", "jobless-claims", "Haftalık İşsizlik Başvuruları", "Initial Jobless Claims", "medium", "bin", "ICSA", "dol-rule");
  for (const d of ["2026-08-28", "2026-09-25", "2026-10-30", "2026-11-25", "2026-12-23", "2027-01-29", "2027-02-26"]) add(d, "08:30", "fred-core-pce", "Çekirdek PCE, Fed'in Baktığı Enflasyon Ölçüsü", "Core PCE, the Fed's Preferred Gauge", "high", "%", "PCEPILFE", "fred");
  for (const d of ["2027-01-13", "2027-02-10", "2027-03-10"]) add(d, "08:30", "fred-cpi", "TÜFE Enflasyon Verisi", "CPI Inflation Data", "high", "%", "CPIAUCSL", "fred");
  /* Bugüne göre kurulan uç örnekler: bugünün verisi, saatsiz olay, uzun ad. */
  add(isGunu(0), "08:30", "retail-sales", "Perakende Satışlar (Aylık)", "Retail Sales (MoM)", "medium", "%", null, "seed");
  add(isGunu(-3), "08:30", "ppi", "Ekim ÜFE Verisi", "October PPI Data", "medium", "%", null, "seed");
  add(day(5), null, "fed-konusma", "Fed Başkanı'nın Konuşması; Soru-Cevap, Basın Toplantısı (Saat İlan Edilmedi)", "Fed Chair Speech; Q&A, Press Conference (Time Not Announced)", "high", null, null, "seed");
  add(day(12), "10:00", "umich", "Michigan Üniversitesi Tüketici Güveni Endeksi ve Beş Yıllık Enflasyon Beklentisi, Öncü Okuma", "University of Michigan Consumer Sentiment and Five-Year Inflation Expectations, Preliminary", "low", null, null, "seed");
  const BASE = { cpi: [3.1, 0.3, 1], "core-cpi": [3.2, 0.2, 1], "fomc-rate": [3.88, 0, 2], nfp: [95, 120, 0], unemployment: [4.2, 0.2, 1], "jobless-claims": [222, 14, 0], "fred-core-pce": [3.0, 0.2, 1], "fred-cpi": [3.1, 0.3, 1], "retail-sales": [0.3, 0.6, 1], ppi: [2.6, 0.4, 1] };
  rows.sort((a, b) => (a.event_date + (a.event_time_et ?? "")).localeCompare(b.event_date + (b.event_time_et ?? "")));
  const latestPast = {}; for (const r of rows) if (r.event_date < now) latestPast[r.family] = r.slug;
  return rows.map(({ family, ...r }, i) => {
    const base = BASE[family]; const past = r.event_date < now; const near = !past && r.event_date <= addDays(now, 14);
    const val = (k) => (base ? (base[0] + (hash(k + r.slug) - 0.5) * base[1]).toFixed(base[2]) : null);
    /* Haftalık başvuruların son satırı gerçekleşen değersiz: "veri bekleniyor" hâli ölçülsün. */
    const waiting = family === "jobless-claims" && latestPast[family] === r.slug;
    return { id: uid(4, i), ...r, actual: past && !waiting ? val("a") : null, forecast: past || near ? val("f") : null, previous: past || near ? val("p") : null, updated_at: new Date().toISOString() };
  });
}

function kur() {
  const NOW_ISO = new Date().toISOString(); const now = today();
  const symbols = [...MEMBERS.values()].map((mb) => {
    const sym = mb.symbol; const [p] = px(sym); const cap = capOf(sym);
    return { symbol: sym, name: NAMES[sym] ?? mb.name, exchange: "NASDAQ", sector: mb.sector, industry: mb.sector, logo_url: null, description: null, country: "US", currency: "USD", market_cap: s(cap), share_outstanding: cap === null ? null : s(cap / p), ipo_date: "1999-01-22", weburl: "https://www.example.com/", is_index_proxy: "f", updated_at: NOW_ISO, volume: "1000000", price: s(p) };
  });
  const stored = (sym) => { const m = metric(sym); return JSON.stringify({ epsTTM: m.epsTTM, revenuePerShareTTM: m.epsTTM * 4, revenueGrowthTTMYoy: m.revenueGrowthTTMYoy, epsGrowthTTMYoy: m.epsGrowthTTMYoy, operatingMarginTTM: m.operatingMarginTTM, netProfitMarginTTM: m.netProfitMarginTTM, roeTTM: m.roeTTM, debtToEquity: m["totalDebt/totalEquityQuarterly"], currentRatio: m.currentRatioQuarterly, high52: m["52WeekHigh"], low52: m["52WeekLow"] }); };
  const symbol_metrics = [...MEMBERS.values()].filter((m) => !NOCAP.has(m.symbol)).map((m) => ({ symbol: m.symbol, sector: m.sector, currency: "USD", metrics: stored(m.symbol), updated_at: NOW_ISO }));

  let eI = 0;
  const cal = (symbol, date, hour, epsE, epsA, revE, revA, q = 3, y = 2026) => ({ id: uid(3, eI++), symbol, report_date: date, hour, eps_estimate: s(epsE), eps_actual: s(epsA), revenue_estimate: s(revE), revenue_actual: s(revA), quarter: s(q), year: s(y), updated_at: NOW_ISO });
  const earnings_calendar = [];
  for (const [sym, hour, eps, rev] of TODAY_EARN) earnings_calendar.push(cal(sym, isGunu(0), hour, eps, null, rev, null));
  /* Hafta: bugün pazartesi-cuma ise içinde bulunulan hafta, hafta sonuysa gelecek hafta. */
  const monday = addDays(now, dow(now) === 0 ? 1 : dow(now) === 6 ? 2 : 1 - dow(now));
  for (const [k, list, fill] of WEEK) {
    const date = addDays(monday, k);
    for (const [sym, hour, eps, rev] of list) earnings_calendar.push(cal(sym, date, hour, eps, null, rev, null, 3, sym === "NVDA" ? 2027 : 2026));
    for (let j = 0; j < fill; j++) { const h = hash(`x${k}${j}`); const sym = "ZQ" + String.fromCharCode(65 + (j % 26)) + String.fromCharCode(65 + ((j * 7 + k) % 26)) + (j >= 26 ? String.fromCharCode(65 + Math.floor(j / 26)) : ""); earnings_calendar.push(cal(sym, date, HOURS[Math.floor(h * 7)], h > 0.5 ? +(h - 0.3).toFixed(2) : null, null, h > 0.5 ? Math.round(h * 4e8) : null, null)); }
  }
  const last = isGunu(-1);
  earnings_calendar.push(
    cal("NVDA", "2026-08-26", "amc", 2.14, 2.22, 94e9, 96.2e9, 2, 2027), cal("NVDA", "2026-05-20", "amc", 1.79, 1.87, null, 81.6e9, 1, 2027), cal("NVDA", day(96), null, null, null, null, null, 4, 2027),
    cal("HD", last, "bmo", 3.95, 4.02, 44.0e9, 44.6e9), cal("HD", "2026-08-18", "bmo", 4.71, 4.68, 45.4e9, 45.3e9, 2),
    cal("WMT", day(95), null, 0.71, null, 195e9, null, 4, 2027), cal("WMT", last, "bmo", 0.64, 0.61, 189e9, 187.4e9, 3, 2027),
    cal("PDD", day(40), null, null, null, null, null), cal("RKLB", day(12), "amc", -0.05, null, 152e6, null), cal("RKLB", "2026-08-06", "amc", -0.09, -0.13, 135e6, 144e6, 2),
    cal("AAPL", day(12), "amc", 1.92, null, 104e9, null, 1, 2027), cal("JPM", day(20), null, 5.1, null, 46e9, null, 4), cal("BRK.B", day(40), "dmh", null, null, null, null), cal("MSFT", day(400), "amc", null, null, null, null, 2, 2028),
  );
  earnings_calendar.sort((a, b) => a.report_date.localeCompare(b.report_date));

  const analysis = (symbol, company, period, label, date, score, verdict, yoy, sur, rea, headline, revenue, eps) => ({ symbol, period, period_label: label, locale: "tr", company, sector: "Technology", report_date: date, timing: "amc", score: s(score), verdict, headline, revenue: s(revenue), revenue_yoy_pct: s(yoy), eps: s(eps), eps_surprise_pct: s(sur), reaction_pct: s(rea), target_price: null, analyst_count: null, summary: JSON.stringify(["Gelir beklentiyi aştı.", "Marj genişledi."]), analysis: JSON.stringify([{ title: "Gelir", body: "Veri merkezi geliri büyümeyi taşıdı." }]), updated_at: NOW_ISO, published_at: NOW_ISO });
  const earnings_analyses = [
    ...ANALYSIS_SEED.map(([sym, company, score, verdict, yoy, sur, rea, headline], i) => analysis(sym, company, "2026-Q3", "3Ç 2026", isGunu(-1 - Math.floor(i / 2)), score, verdict, yoy, sur, rea, headline, 4.23e7 * (i + 1), -0.42)),
    analysis("NVDA", "NVIDIA Corporation", "2c-fy2027", "2Ç FY2027", "2026-08-26", 84, "buy", 106, 4.3, -1.2, "NVIDIA'nın ikinci çeyrek geliri bir yılda iki katından fazlasına, 96,22 milyar dolara çıktı; veri merkezi 89 milyar dolara ulaştı ve 108 milyar dolarlık üçüncü çeyrek öngörüsü piyasa beklentisinin %3,8 üzerinde.", 96.2e9, 2.22),
    analysis("NVDA", "NVIDIA Corporation", "1c-fy2027", "1Ç FY2027", "2026-05-20", 88, "buy", 85, 5.6, -1.8, "NVIDIA mali yılın ilk çeyreğinde 81,62 milyar dolar gelir açıkladı; yıllık %85 artışla yeni bir rekor kırdı.", 81.6e9, 1.87),
  ];

  return {
    symbols, symbol_metrics, earnings_calendar, earnings_analyses,
    market_holidays: HOLIDAYS,
    economic_events: economicEvents(now),
    technical_analyses: teknik.rows(),
    daily_briefs: ["daily", "weekly"].map((period, i) => ({ id: uid(1, i), brief_date: isGunu(-1), locale: "tr", period, headline: period === "daily" ? "Petrol %4 Düştü, Nvidia Huang Soruşturmasıyla Geriledi" : "TÜFE Haftası: Enflasyon Verisi ve CoreWeave Bilançosu Bekleniyor", body_md: BRIEF_BODY, generated_by: "claude", generated_at: NOW_ISO })),
    stories: STORY_SEED.map(([slug, title, dek, off, syms], i) => ({ id: uid(2, i), slug, locale: "tr", title, dek, body_md: STORY_BODY, event_date: day(off), symbols: JSON.stringify(syms), sources: "[]", read_minutes: String(6 - (i % 3)), generated_by: "claude", published_at: NOW_ISO, updated_at: NOW_ISO })),
    daily_charts: [{ chart_date: isGunu(-1), locale: "tr", title: "Çip Hisseleri Uçarken Nvidia Ters Yönde Geriledi", chart_md: "::: bar Teknoloji Hisseleri, Günlük Değişim %\nCoherent (COHR) | +16,79\nMonolithic Power Systems (MPWR) | +16,60\nAdvanced Micro Devices (AMD) | +13,26\nMicron Technology (MU) | +11,90\nApplied Materials (AMAT) | +11,37\nNvidia (NVDA) | -4,27\n:::", body_md: "Yarı iletken endeksi günü %6 yükselişle kapattı; Nvidia ise yönetim soruşturması haberiyle ayrıştı.", updated_at: NOW_ISO }],
    news: Array.from({ length: 40 }, (_, i) => { const [h, sum, src, syms] = NEWS_HEADS[i % NEWS_HEADS.length]; const head = i < NEWS_HEADS.length ? h : `${h} (${i})`; return { id: uid(6, i), provider_id: `m${i}`, headline: head, summary: sum, headline_tr: head, summary_tr: sum, url: `https://example.com/haber/${i}`, image_url: null, source: src, category: "general", symbols: `{${syms.join(",")}}`, published_at: new Date(Date.now() - (i * 37 + 35) * 60e3).toISOString(), fetched_at: NOW_ISO }; }),
    macro_series: [["CPIAUCSL", "cpi", "TÜFE (Yıllık)", "CPI (YoY)", 3.72, 3.35, "Eylül 2026"], ["PCEPILFE", "core-pce", "Çekirdek PCE (Yıllık)", "Core PCE (YoY)", 3.12, 3.03, "Eylül 2026"], ["UNRATE", "unemployment", "İşsizlik Oranı", "Unemployment Rate", 4.1, 4.2, "Ekim 2026"], ["FEDFUNDS", "fed-funds", "Fed Politika Faizi", "Fed Funds Rate", 3.88, 3.75, "Ekim 2026"]]
      .map(([series_id, slug, title_tr, title_en, latest, prev, period_label]) => ({ series_id, slug, title_tr, title_en, latest_value: String(latest), prev_value: String(prev), unit: "%", period_label, jsonb_agg: JSON.stringify(monthly(latest, prev)) })),
  };
}

let memo = null;
function veri() {
  const { date, min } = et(); const key = `${date}:${Math.floor(min / 15)}`;
  if (!memo || memo.key !== key) memo = { key, tablolar: kur() };
  return memo.tablolar;
}

module.exports = { veri };
