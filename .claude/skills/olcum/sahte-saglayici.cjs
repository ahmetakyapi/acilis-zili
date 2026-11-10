/* Ölçüm aracı (10 Kasım): sağlayıcı çağrılarını (Finnhub, Alpaca, Neon HTTP)
   sahte ama biçimi doğru veriyle yanıtlar; bilinmeyen dış adres engellenir.
   NODE_OPTIONS=--require ile yüklenir, uygulama koduna dokunmaz. Kullanım:
   `.claude/skills/olcum/SKILL.md` → "Gerçek Sayfa, Sahte Sağlayıcı". */
const realFetch = globalThis.fetch;
const PRICES = { NVDA: [181.77, 178.67], AVGO: [319.92, 319.47], MU: [739.09, 733.15], AMD: [507.78, 508.6], INTC: [58.86, 59.37], TXN: [293.5, 295.72], ARM: [186.4, 186.31], ADI: [390.2, 394.66], QCOM: [170.2, 171.47], AAPL: [271.4, 270.1], MSFT: [512.3, 509.9] };
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function px(sym) { return PRICES[sym] ?? [20 + hash(sym) * 400, (20 + hash(sym) * 400) * (0.985 + hash(sym + "p") * 0.03)]; }
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", date: new Date().toUTCString() } });
}
function rng(seed) { let s = Math.floor(hash(seed) * 2147483647) || 1; return () => ((s = (s * 48271) % 2147483647) / 2147483647); }
function tfMs(tf) {
  const m = /^(\d+)(Min|Hour|Day|Week|Month)$/.exec(tf) || [0, "1", "Day"];
  const n = Number(m[1]); const u = { Min: 60e3, Hour: 3600e3, Day: 86400e3, Week: 7 * 86400e3, Month: 30 * 86400e3 }[m[2]];
  return n * u;
}
function bars(sym, tf, start, end, limit) {
  const step = tfMs(tf);
  const [last] = px(sym);
  const endMs = end ? Date.parse(end) : Date.now();
  let startMs = start ? Date.parse(start) : endMs - step * 300;
  const intraday = step < 86400e3;
  const out = [];
  const r = rng(sym + tf);
  const stamps = [];
  for (let t = Math.ceil(startMs / step) * step; t <= endMs; t += step) {
    const d = new Date(t); const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (intraday) { const h = d.getUTCHours() + d.getUTCMinutes() / 60; if (h < 9 || h >= 25) { if (h < 9) continue; } if (h >= 25) continue; }
    stamps.push(t);
  }
  const keep = stamps.slice(-Math.min(stamps.length, Number(limit) || 10000, 1500));
  const n = keep.length;
  // geriye doğru rastgele yürüyüş: son bar bugünkü fiyata iner
  const vol = intraday ? 0.0016 : step >= 7 * 86400e3 ? 0.035 : 0.021;
  const drift = intraday ? 0 : sym === "NVDA" ? -0.0006 : 0.0006;
  let c = last; const closes = new Array(n);
  for (let i = n - 1; i >= 0; i--) { closes[i] = c; c = c / (1 + drift + (r() - 0.5) * 2 * vol); }
  for (let i = 0; i < n; i++) {
    const loud = !intraday && step === 86400e3 && sym === 'NVDA' && i >= n - 6 ? [3.0, 1.8, 1, 4.6, 2.2, 1][n - 1 - i] : 0;
    const cl = closes[i]; const o = i ? closes[i - 1] : cl * 0.997;
    out.push({ t: new Date(keep[i]).toISOString(), o: +o.toFixed(2), h: +(Math.max(o, cl) * (1 + r() * vol * 0.6)).toFixed(2), l: +(Math.min(o, cl) * (1 - r() * vol * 0.6)).toFixed(2), c: +cl.toFixed(2), v: Math.round((intraday ? 4e5 : 1.6e8) * (loud ? loud * 1.05 : 0.5 + r() * 1.0)), n: 1000, vw: cl });
  }
  return out;
}
function snapshot(sym) {
  const [p, pc] = px(sym); const now = new Date();
  return { latestTrade: { p, t: now.toISOString() }, minuteBar: { t: now.toISOString(), o: p, h: p, l: p, c: p, v: 12000 }, dailyBar: { t: now.toISOString().slice(0, 10) + "T05:00:00Z", o: pc * 1.002, h: Math.max(p, pc) * 1.008, l: Math.min(p, pc) * 0.985, c: p, v: 152_400_000 }, prevDailyBar: { t: new Date(now - 86400e3).toISOString().slice(0, 10) + "T05:00:00Z", o: pc * 0.99, h: pc * 1.01, l: pc * 0.98, c: pc, v: 181_000_000 } };
}
const NVDA_METRIC = { peTTM: 22.5, epsTTM: 7.91, forwardPE: 14.47, dividendYieldIndicatedAnnual: 0.03, beta: 2.35, "52WeekHigh": 243.37, "52WeekLow": 164.27, bookValuePerShareQuarterly: 9.48, pbQuarterly: 19.0, "totalDebt/totalEquityQuarterly": 0.15, cashPerSharePerShareQuarterly: 2.4, netProfitMarginTTM: 63.7, roeTTM: 104, revenueGrowthTTMYoy: 85, epsGrowthTTMYoy: 92, operatingMarginTTM: 62, currentRatioQuarterly: 4.1, psTTM: 22, grossMarginTTM: 74 };
function metric(sym) {
  if (sym === "NVDA") return NVDA_METRIC;
  const h = (k) => hash(sym + k); const [p] = px(sym);
  const eps = p / (8 + h("pe") * 60);
  return { peTTM: p / eps, epsTTM: eps, forwardPE: 10 + h("f") * 30, dividendYieldIndicatedAnnual: h("d") * 3, beta: 0.6 + h("b") * 1.6, "52WeekHigh": p * 1.3, "52WeekLow": p * 0.6, bookValuePerShareQuarterly: p / (1 + h("pb") * 12), pbQuarterly: 1 + h("pb") * 12, "totalDebt/totalEquityQuarterly": h("de") * 1.6, cashPerSharePerShareQuarterly: 3, netProfitMarginTTM: -5 + h("nm") * 45, roeTTM: h("roe") * 50, revenueGrowthTTMYoy: -10 + h("rg") * 50, epsGrowthTTMYoy: -20 + h("eg") * 70, operatingMarginTTM: h("om") * 40, currentRatioQuarterly: 0.8 + h("cr") * 3, psTTM: 1 + h("ps") * 14, grossMarginTTM: 20 + h("gm") * 50 };
}
const NAMES = { NVDA: "NVIDIA Corporation", AVGO: "Broadcom", MU: "Micron Technology", AMD: "Advanced Micro Devices", INTC: "Intel", TXN: "Texas Instruments", ARM: "Arm Holdings", ADI: "Analog Devices", QCOM: "Qualcomm" };
const CAPS = { NVDA: 4380000, AVGO: 1530000, MU: 836000, AMD: 829000, INTC: 313000, TXN: 268000, ARM: 199000, ADI: 189000, QCOM: 179000 };
const HEADLINES = [
  "Wall Street, Nvidia'nın 2029'da \"bir trilyon dolarlık çip\" satacağını bekliyor; bir yatırımcı buna inanmıyor",
  "AMD hisseleri 6 ayın en iyi günü için yükseldi; ancak Michael Burry, Nvidia başlıklı işleme girmiyor",
  "Moonshot AI, Bloomberg'e göre Çin'de Nvidia'nın en gelişmiş çiplerini kiralıyor",
  "Nvidia hisselerinin ötesinde 3 ABD yapay zekâ çip hissesi",
  "Trump, Nvidia CEO'su Huang'ı Çin skandalı nedeniyle FBI'ın incelediğini söyledi",
  "Micron, FormFactor, Amkor, Teradyne ve Nvidia hisseleri fırladı: bilmeniz gerekenler",
  "Nvidia, Huang iddialarıyla ilgili toplu dava ile karşı karşıya; senatör inceleme istiyor, analist CEO'nun ayrılma olasılığını %15 olarak gösteriyor",
  "Nvidia CEO'su bir ilişkiyi kabul etti, şirket casusluk iddialarını inceleyecek",
  "Nvidia veri merkezi gelirinde yeni rekor bekleniyor",
  "Yarı iletken endeksi haftayı ekside kapattı",
];
function day(offset) { return new Date(Date.now() + offset * 86400e3).toISOString().slice(0, 10); }
function finnhub(path, q) {
  const sym = q.get("symbol") || "";
  switch (path) {
    case "/stock/profile2": return { name: NAMES[sym] ?? `${sym} Holdings Incorporated`, ticker: sym, exchange: "NASDAQ NMS - GLOBAL MARKET", finnhubIndustry: "Semiconductors", logo: "", country: "US", currency: "USD", marketCapitalization: CAPS[sym] ?? 5000 + hash(sym) * 300000, shareOutstanding: 24300, ipo: "1999-01-22", weburl: "https://www.nvidia.com/" };
    case "/quote": { const [p, pc] = px(sym); return { c: p, d: p - pc, dp: ((p - pc) / pc) * 100, h: p * 1.01, l: p * 0.99, o: pc, pc, t: Math.floor(Date.now() / 1000) }; }
    case "/stock/metric": return { metric: metric(sym), series: { annual: {}, quarterly: {} } };
    case "/stock/recommendation": return [0, 1, 2, 3].map((i) => ({ symbol: sym, period: new Date(Date.UTC(2026, 10 - i, 1)).toISOString().slice(0, 10), strongBuy: 25 - (i > 1 ? 1 : 0), buy: 41 - (i > 1 ? 1 : 0), hold: i > 1 ? 4 : 2, sell: 1, strongSell: 0 }));
    case "/stock/earnings": return [
      { actual: 2.22, estimate: 2.14, period: "2026-07-31", quarter: 2, year: 2027, symbol: sym },
      { actual: 1.87, estimate: 1.79, period: "2026-04-30", quarter: 1, year: 2027, symbol: sym },
      { actual: 1.62, estimate: 1.56, period: "2026-01-31", quarter: 4, year: 2026, symbol: sym },
      { actual: 1.3, estimate: 1.27, period: "2025-10-31", quarter: 3, year: 2026, symbol: sym },
    ];
    case "/calendar/earnings": {
      const all = [
        { date: day(7), epsActual: null, epsEstimate: 2.53, hour: "amc", quarter: 3, revenueActual: null, revenueEstimate: 111e9, symbol: "NVDA", year: 2027 },
        { date: "2026-08-26", epsActual: 2.22, epsEstimate: 2.14, hour: "amc", quarter: 2, revenueActual: 96.2e9, revenueEstimate: 94.0e9, symbol: "NVDA", year: 2027 },
        { date: "2026-05-20", epsActual: 1.87, epsEstimate: 1.79, hour: "amc", quarter: 1, revenueActual: 81.6e9, revenueEstimate: null, symbol: "NVDA", year: 2027 },
      ];
      const from = q.get("from"), to = q.get("to");
      return { earningsCalendar: all.filter((e) => (!sym || e.symbol === sym) && e.date >= from && e.date <= to) };
    }
    case "/company-news": return HEADLINES.map((headline, i) => ({ category: "company", datetime: Math.floor(Date.now() / 1000) - (i + 2) * 3400, headline, id: 9000 + i, image: i === 3 ? "https://s.yimg.com/ny/api/res/1.2/x.jpg" : "", related: sym, source: i % 4 === 3 ? "MarketWatch" : "Yahoo", summary: "Özet metni.", url: `https://example.com/n/${i}` }));
    case "/news": return [];
    case "/stock/insider-transactions": return { data: [
      { name: "COXE TENCH", share: 3_200_000, change: -500000, filingDate: day(-5), transactionDate: day(-6), transactionCode: "G", transactionPrice: 0, id: "a1" },
      { name: "COXE TENCH", share: 3_700_000, change: -500000, filingDate: day(-33), transactionDate: day(-34), transactionCode: "G", transactionPrice: 0, id: "a2" },
      { name: "Teter Timothy S.", share: 120000, change: -30460, filingDate: day(-49), transactionDate: day(-50), transactionCode: "S", transactionPrice: 222.8, id: "a3" },
      { name: "STEVENS MARK A", share: 6_000_000, change: -1366000, filingDate: day(-52), transactionDate: day(-53), transactionCode: "S", transactionPrice: 219.73, id: "a4" },
      { name: "HUANG JEN HSUN", share: 70_000_000, change: -438000, filingDate: day(-53), transactionDate: day(-54), transactionCode: "G", transactionPrice: 0, id: "a5" },
      { name: "Kress Colette", share: 2_900_000, change: -47640, filingDate: day(-60), transactionDate: day(-61), transactionCode: "S", transactionPrice: 215.11, id: "a6" },
      { name: "Shoquist Debora", share: 900000, change: -12000, filingDate: day(-70), transactionDate: day(-71), transactionCode: "S", transactionPrice: 210.4, id: "a7" },
    ] };
    case "/stock/insider-sentiment": return { data: Array.from({ length: 12 }, (_, i) => ({ symbol: sym, year: i < 1 ? 2025 : 2026, month: i < 1 ? 12 : i, change: i === 4 ? 0 : -(20000 + i * 9000), mspr: i === 4 ? 0 : i === 8 ? null : -100 })).filter((r) => r.mspr !== null), symbol: sym };
    default: return {};
  }
}
function alpaca(u) {
  const q = u.searchParams; const p = u.pathname;
  const syms = (q.get("symbols") || q.get("symbol") || "").split(",").filter(Boolean);
  if (p.includes("/corporate-actions")) {
    const mk = (d, rate) => ({ id: d, symbol: "NVDA", ex_date: d, record_date: d, payable_date: d, rate, special: false, foreign: false });
    const divs = [mk("2026-09-10", 0.25), mk("2026-06-04", 0.25), mk("2026-03-11", 0.01), mk("2025-12-04", 0.01), mk("2025-09-11", 0.01), mk("2025-06-11", 0.01), mk("2025-03-12", 0.01), mk("2024-12-05", 0.01), mk("2024-09-12", 0.01), mk("2024-06-11", 0.01), mk("2024-03-05", 0.04), mk("2023-12-05", 0.04), mk("2023-09-06", 0.04), mk("2023-06-07", 0.04), mk("2023-03-07", 0.04)];
    const want = new Set(syms);
    return { corporate_actions: { cash_dividends: want.has("NVDA") ? divs.filter((d) => d.ex_date >= (q.get("start") || "") && d.ex_date <= (q.get("end") || "9")) : [] }, next_page_token: null };
  }
  if (p.includes("/options/")) {
    if (p.includes("/snapshots")) {
      const und = p.split("/").pop(); const exp = new Date(Date.now() + 8 * 86400e3); while (exp.getUTCDay() !== 5) exp.setUTCDate(exp.getUTCDate() + 1);
      const ymd = exp.toISOString().slice(2, 10).replace(/-/g, ""); const snaps = {};
      for (let k = 150; k <= 215; k += 2.5) { const occ = (t) => `${und}${ymd}${t}${String(Math.round(k * 1000)).padStart(8, "0")}`; const cv = Math.max(181.77 - k, 0) + 8.6, pv = Math.max(k - 181.77, 0) + 8.6; snaps[occ("C")] = { latestQuote: { bp: +(cv - 0.05).toFixed(2), ap: +(cv + 0.05).toFixed(2), t: new Date().toISOString() } }; snaps[occ("P")] = { latestQuote: { bp: +(pv - 0.05).toFixed(2), ap: +(pv + 0.05).toFixed(2), t: new Date().toISOString() } }; }
      return { snapshots: snaps, next_page_token: null };
    }
    return {};
  }
  if (p.endsWith("/snapshots")) return Object.fromEntries(syms.map((s) => [s, snapshot(s)]));
  if (p.endsWith("/bars/latest")) return { bars: Object.fromEntries(syms.map((s) => [s, snapshot(s).minuteBar])) };
  if (p.endsWith("/bars")) return { bars: Object.fromEntries(syms.map((s) => [s, bars(s, q.get("timeframe") || "1Day", q.get("start"), q.get("end"), q.get("limit"))])), next_page_token: null };
  return {};
}

/* ---- Neon HTTP sahtesi: yalın `select "a","b" from "tablo"` sorguları ---- */
const fs = require("fs");
const SEED = require("path").join(process.cwd(), "db/seed/indices.ts");
const MEMBERS = new Map();
try { for (const m of fs.readFileSync(SEED, "utf8").matchAll(/\{ symbol: "([^"]+)", name: "([^"]+)", sector: "([^"]+)"/g)) if (!MEMBERS.has(m[1])) MEMBERS.set(m[1], { symbol: m[1], name: m[2], sector: m[3] }); } catch {}
function symbolRow(mb) {
  const s = mb.symbol; const [p] = px(s); const cap = (CAPS[s] ?? 8000 + hash(s + "cap") ** 3 * 900000) * 1e6;
  return { symbol: s, name: NAMES[s] ?? mb.name, market_cap: String(cap), currency: "USD", share_outstanding: String(cap / p), logo_url: null, industry: "Semiconductors", sector: mb.sector, is_index_proxy: "f", volume: "1000000", price: String(p), exchange: "NASDAQ", country: "US", ipo_date: "1999-01-22", web_url: "https://www.nvidia.com/", updated_at: new Date().toISOString() };
}
function stored(s) { const m = metric(s); return JSON.stringify({ epsTTM: m.epsTTM, revenuePerShareTTM: m.epsTTM * 4, revenueGrowthTTMYoy: m.revenueGrowthTTMYoy, epsGrowthTTMYoy: m.epsGrowthTTMYoy, operatingMarginTTM: m.operatingMarginTTM, netProfitMarginTTM: m.netProfitMarginTTM, roeTTM: m.roeTTM, debtToEquity: m["totalDebt/totalEquityQuarterly"], currentRatio: m.currentRatioQuarterly, high52: m["52WeekHigh"], low52: m["52WeekLow"] }); }
const CAL = [
  { id: "c0", symbol: "NVDA", report_date: day(7), hour: "amc", eps_estimate: "2.53", eps_actual: null, revenue_estimate: "111000000000", revenue_actual: null, quarter: "3", year: "2027" },
  { id: "c1", symbol: "NVDA", report_date: "2026-08-26", hour: "amc", eps_estimate: "2.14", eps_actual: "2.22", revenue_estimate: "94000000000", revenue_actual: "96200000000", quarter: "2", year: "2027" },
  { id: "c2", symbol: "NVDA", report_date: "2026-05-20", hour: "amc", eps_estimate: "1.79", eps_actual: "1.87", revenue_estimate: null, revenue_actual: "81600000000", quarter: "1", year: "2027" },
].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
/* ---- İçerik tabloları (10 Kasım, ikinci tur): ana sayfanın sol kolonu boş
   tabloyla kısa kalıyor, kolon dipleri ölçülemiyordu. Satırlar 10 Kasım
   canlı görüntülerindeki içeriğe benzetildi (uzun ad, eksi HBK, saati
   belirsiz bilanço, 0,00 gelir beklentisi). Tarihler bugüne göre. ---- */
const NOW_ISO = new Date().toISOString();
const uid = (group, i) => `00000000-0000-4000-8000-0000000${group}${String(i).padStart(4, "0")}`;
const BRIEF_BODY = [
  "Petrol haftaya sert düşüşle başladı: Brent sabah saatlerinde %4'ten fazla gerileyerek varil başına 94 dolar civarına indi. Cuma kapanışı 98,3 dolardı. Düşüşü Başkan Donald Trump'ın Pazar günü CNN'e verdiği röportaj tetikledi.",
  "- Trump, İran'a yeni saldırı gerekip gerekmeyeceğini anlaşmaya bağladı. Ardından ekledi: **\"The answer is, highly unlikely it's going to be necessary.\"** Hürmüz Boğazı'ndaki risk ise sürüyor; İran Devrim Muhafızları Cumartesi gecesi iki tankerin mayına çarparak alev aldığını açıkladı.\n- Ucuzlayan petrol vadeli işlemleri yukarı taşıdı. Salı açıklanacak TÜFE öncesinde enerji fiyatlarındaki düşüş, Aralıkta faiz artırımı beklentisini taşıyan enflasyon baskısını hafifletiyor. Ama endeksin en büyük hissesi bu yükselişe katılmıyor.\n- Nvidia'nın yönetim kurulu Pazar günü, CEO Jensen Huang'ın bir yabancı istihbarat girişiminin hedefi olup olmadığını araştırmak için iç soruşturma başlattı. Huang çalışanlarına gönderdiği mesajda tüm sorumluluğu üstlendiğini yazdı.",
  "Hisse açılış öncesinde %4'e yakın geriledi; yarı iletken endeksinin geri kalanı ise AMD öncülüğünde yükseliyor. Micron ve Broadcom cuma günkü kazançlarını koruyor.",
  "Tahvil tarafında 10 yıllık faiz %4,88'de yatay. Piyasa Aralık toplantısında 25 baz puanlık artırıma %38 olasılık veriyor; bir hafta önce bu oran %52 idi.",
  "Bugünün takviminde Ekim TÜFE verisi ve beş bilanço var. CoreWeave kapanış sonrası açıklayacak; şirketin yapay zekâ altyapı talebi hakkında söyleyecekleri haftanın tonunu belirleyebilir.",
  "Asya'da Nikkei %0,4, KOSPI %1,1 geriledi; Avrupa'da DAX %0,3 yükselişle açıldı. Dolar endeksi 104,2'de, altın ons başına 4.120 dolar civarında.",
].join("\n\n");
const BRIEFS = ["daily", "weekly"].map((period, i) => ({ id: uid(1, i), brief_date: day(-1), locale: "tr", period, headline: period === "daily" ? "Petrol %4 Düştü, Nvidia Huang Soruşturmasıyla Geriledi" : "TÜFE Haftası: Enflasyon Verisi ve CoreWeave Bilançosu Bekleniyor", body_md: BRIEF_BODY, generated_by: "claude", generated_at: NOW_ISO }));
const STORY_BODY = "SoftBank nisan-eylülde 4,8 milyar dolar zarar etti.\n\n::: sayilar Sayılarla\n4,8 Mr $ | Altı Aylık Net Zarar\n3,73 Mr $ | Türbin Siparişlerinde Silinen Tutar\n%15,9 | 30 Eylül'de Borç-varlık Oranı\n%13,9 | Hissenin 10 Kasım Yükselişi\n:::\n\nOhio'daki veri merkezleri için ayırdığı türbin ve jeneratör siparişleri en büyük kalem oldu.";
const STORIES = [
  ["softbank-turbin", "SoftBank Türbin Siparişinde 3,7 Milyar Dolar Zarar Yazdı, Musk'ı Yalanladı", "SoftBank nisan-eylülde 4,8 milyar dolar zarar etti; Ohio'daki veri merkezleri için ayırdığı türbin ve jeneratör siparişleri en büyük kalem oldu. Şirket Elon Musk'ın temerrüt iddiasını reddetti, ama borç-varlık oranı OpenAI ve çip hisselerindeki düşüşle yükseldi.", 0, ["SFTBY", "GEV", "NVDA", "ARM", "INTC"]],
  ["sp500-petrol", "S&P 500 Petrol Düşünce %2,35 Yükseldi, Tahvil Faizi Yerinde Kaldı", "Brent, Trump'ın İran'a yeni saldırıyı pek olası görmediğini söylemesiyle %4,7 düştü; AMD %12,9 yükselirken Nvidia CEO soruşturması yüzünden %4,27 geriledi. 10 yıllık faiz ise %4,88'e çıktı, Fed'in aralık artırımı fiyatlaması yerinde kaldı.", -1, ["SPY", "QQQ"]],
  ["nvidia-huang", "Nvidia CEO'su Huang İlişkiyi Kabul Etti, Yönetim Kurulu Soruşturma Açtı", "Jensen Huang, ABD istihbaratının Çin adına çalıştığından şüphelendiği Megaspeed yöneticisi Alice Huang ile ilişkisini kabul etti; Nvidia kurulu bağımsız soruşturma başlattı. Trump Huang'ı savundu, hisse açılış öncesi %4 geriledi.", -2, ["NVDA", "TSM"]],
  ["berkshire-geri-alim", "Berkshire Rekor Hisse Geri Alımı Yaptı, Sigorta Kârı %43 Düştü", "Greg Abel yönetimindeki Berkshire Hathaway üçüncü çeyrekte kendi hissesine 9,6 milyar dolar harcadı ve ekimde de almayı sürdürdü. GEICO'daki hasar artışıyla faaliyet kârı %5,8 geriledi; piyasa sonuçları pazartesi fiyatlayacak.", -3, ["BRK.B"]],
  ["fed-aralik", "Fed Tutanakları Aralık İçin Kapıyı Açık Bıraktı", "Üyelerin çoğu enflasyonun hedefe dönüş hızından rahatsız.", -5, []],
  ["amd-rekor", "AMD Veri Merkezi Gelirinde Rekor Kırdı", "Şirket dördüncü çeyrek beklentisini yükseltti.", -6, ["AMD"]],
].map(([slug, title, dek, off, symbols], i) => ({ id: uid(2, i), slug, locale: "tr", title, dek, body_md: STORY_BODY, event_date: day(off), symbols: JSON.stringify(symbols), sources: "[]", read_minutes: String(6 - (i % 3)), generated_by: "claude", published_at: NOW_ISO, updated_at: NOW_ISO }));
const EARN_TODAY = [
  ["BN", null, "0.75", "1850000000"], ["TDG", "bmo", "12.33", "2980000000"], ["CRWV", "amc", "-1.18", "3620000000"], ["TNGX", null, "-0.36", "0"], ["COAG", "bmo", "-0.53", "0"],
].map(([symbol, hour, eps, rev], i) => ({ id: uid(3, i), symbol, report_date: day(0), hour, eps_estimate: eps, eps_actual: null, revenue_estimate: rev, revenue_actual: null, quarter: "3", year: "2026", updated_at: NOW_ISO }));
const EVENTS = [
  { off: 0, time: "08:30", slug: "cpi", tr: "Ekim TÜFE Verisi", en: "October CPI", importance: "high", forecast: "3.6", previous: "3.72", unit: "%" },
  { off: 0, time: "08:30", slug: "core-cpi", tr: "Ekim Çekirdek TÜFE Verisi", en: "October Core CPI", importance: "high", forecast: "3.1", previous: "3.2", unit: "%" },
  { off: 2, time: "08:30", slug: "jobless-claims", tr: "Haftalık İşsizlik Başvuruları", en: "Initial Jobless Claims", importance: "medium", forecast: "224", previous: "219", unit: "K" },
].map((e, i) => ({ id: uid(4, i), event_date: day(e.off), event_time_et: e.time, slug: e.slug, title_tr: e.tr, title_en: e.en, importance: e.importance, actual: null, forecast: e.forecast, previous: e.previous, unit: e.unit, fred_series_id: null, source: "seed", updated_at: NOW_ISO }));
const ANALYSES = [
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
].map(([symbol, company, score, verdict, yoy, surprise, reaction, headline], i) => ({ symbol, period: "2026-Q3", period_label: "3Ç 2026", locale: "tr", company, sector: "Technology", report_date: day(-1 - Math.floor(i / 2)), timing: "amc", score: String(score), verdict, headline, revenue: String(4.23e7 * (i + 1)), revenue_yoy_pct: String(yoy), eps: "-0.42", eps_surprise_pct: String(surprise), reaction_pct: String(reaction), updated_at: NOW_ISO, published_at: NOW_ISO }));
const CHARTS = [{ chart_date: day(-1), locale: "tr", title: "Çip Hisseleri Uçarken Nvidia Ters Yönde Geriledi", chart_md: "::: bar Teknoloji Hisseleri, Günlük Değişim %\nCoherent (COHR) | +16,79\nMonolithic Power Systems (MPWR) | +16,60\nAdvanced Micro Devices (AMD) | +13,26\nMicron Technology (MU) | +11,90\nApplied Materials (AMAT) | +11,37\nNvidia (NVDA) | -4,27\n:::", body_md: "Yarı iletken endeksi günü %6 yükselişle kapattı; Nvidia ise yönetim soruşturması haberiyle ayrıştı.", updated_at: NOW_ISO }];
const TECH = [["AMD", "hold"], ["SPCX", "hold"], ["TSLA", "hold"], ["AAPL", "hold"], ["META", "hold"], ["ONDS", "hold"], ["MU", "sell"], ["RKLB", "sell"], ["NVDA", "sell"], ["INTC", "sell"], ["GOOGL", "sell"], ["NBIS", "sell"], ["BMNR", "sell"], ["ASTS", "sell"], ["IREN", "sell"], ["QCOM", "sell"]].map(([symbol, stance], i) => ({ id: uid(5, i), symbol, session_date: day(-1), slot: "lateday", stance, entry_low: null, entry_high: null, stop: null, targets: "[]", supports: "[]", resistances: "[]", copy: JSON.stringify({ tr: { headline: `${symbol} ${stance === "sell" ? "SAT" : "TUT"}'ta; sektör yükselirken hisse ortalamasının altında ayrışmayı sürdürüyor.`, summary: "Fiyat kısa vadeli ortalamaların altında; hacim satış yönünde.", bull: "50 günlük ortalamanın geri alınması.", bear: "Son dibin altında kapanış.", volume: "Hacim 20 günlük ortalamanın 1,4 katı.", watch: "Açılıştaki ilk yarım saat.", entryNote: null }, en: null }), snapshot: JSON.stringify({ price: px(symbol)[0], changePct: (hash(symbol) - 0.5) * 6 }), generated_by: "claude", published_at: NOW_ISO, updated_at: NOW_ISO }));
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
const NEWS = Array.from({ length: 40 }, (_, i) => { const [h, sum, src, syms] = NEWS_HEADS[i % NEWS_HEADS.length]; const head = i < NEWS_HEADS.length ? h : `${h} (${i})`; return { id: uid(6, i), provider_id: `m${i}`, headline: head, summary: sum, headline_tr: head, summary_tr: sum, url: `https://example.com/haber/${i}`, image_url: null, source: src, category: "general", symbols: `{${syms.join(",")}}`, published_at: new Date(Date.now() - (i * 37 + 35) * 60e3).toISOString(), fetched_at: NOW_ISO }; });
function monthly(latest, prev, n = 24) { const out = []; const r = rng("m" + latest); for (let i = n - 1; i >= 0; i--) { const v = i === 0 ? latest : i === 1 ? prev : prev - (i - 1) * (latest - prev) * 0.3 + (r() - 0.5) * 0.2; out.push({ date: new Date(Date.UTC(2026, 9 - i, 1)).toISOString().slice(0, 10), value: +v.toFixed(2) }); } return out; }
const MACRO = [["CPIAUCSL", "cpi", "TÜFE (Yıllık)", "CPI (YoY)", 3.72, 3.35, "Eylül 2026"], ["PCEPILFE", "core-pce", "Çekirdek PCE (Yıllık)", "Core PCE (YoY)", 3.12, 3.03, "Eylül 2026"], ["UNRATE", "unemployment", "İşsizlik Oranı", "Unemployment Rate", 4.1, 4.2, "Ekim 2026"], ["FEDFUNDS", "fed-funds", "Fed Politika Faizi", "Fed Funds Rate", 3.88, 3.75, "Ekim 2026"]].map(([series_id, slug, title_tr, title_en, latest, prev, period_label]) => ({ series_id, slug, title_tr, title_en, latest_value: String(latest), prev_value: String(prev), unit: "%", period_label, jsonb_agg: JSON.stringify(monthly(latest, prev)) }));
function contentRows(table, sql, params) {
  const dates = params.filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v))).map(String).sort();
  const between = (rows, col) => (dates.length === 0 ? rows : rows.filter((r) => r[col] >= dates[0] && r[col] <= dates[dates.length - 1]));
  if (table === "daily_briefs") return BRIEFS.filter((b) => params.includes(b.period));
  if (table === "stories") { const slug = params.find((v) => STORIES.some((st) => st.slug === v)); return slug ? STORIES.filter((st) => st.slug === slug) : STORIES; }
  if (table === "economic_events") return between(EVENTS, "event_date");
  if (table === "earnings_analyses") return /report_date" =/.test(sql) ? [] : ANALYSES;
  if (table === "daily_charts") return CHARTS;
  if (table === "technical_analyses") return TECH;
  if (table === "news") return NEWS;
  return null;
}
/* macro_series sorgusu sütun listesinde alt sorgu taşıyor (son 24 gözlem);
   yalın ayrıştırıcı onu boş döndürür, burada elle yanıtlanır. */
function macroResult() {
  const cols = ["series_id", "slug", "title_tr", "title_en", "latest_value", "prev_value", "unit", "period_label", "jsonb_agg"];
  return { fields: cols.map((name) => ({ name, dataTypeID: name === "jsonb_agg" ? 3802 : 25 })), command: "SELECT", rowCount: MACRO.length, rows: MACRO.map((r) => cols.map((c) => r[c])), rowAsArray: true };
}
/* Dış günlük kaynaklar: Hazine getiri eğrisi (XML), Cboe VIX (CSV), FRED. */
function weekdays(n) { const d = new Date(); const out = []; while (out.length < n) { d.setUTCDate(d.getUTCDate() - 1); if (d.getUTCDay() % 6) out.unshift(d.toISOString().slice(0, 10)); } return out; }
function treasuryXml() {
  const r = rng("ust");
  return "<feed>" + weekdays(40).map((dt, i) => { const k = (i - 39) * 0.004 + (i === 39 ? 0 : (r() - 0.5) * 0.03); const cell = (tag, v) => `<d:${tag} m:type="Edm.Double">${(v + k).toFixed(2)}</d:${tag}>`; return `<entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">${dt}T00:00:00</d:NEW_DATE>${cell("BC_2YEAR", 4.56)}${cell("BC_5YEAR", 4.67)}${cell("BC_10YEAR", 4.88)}${cell("BC_30YEAR", 5.02)}</m:properties></content></entry>`; }).join("") + "</feed>";
}
function vixCsv() { const r = rng("vix"); const days = weekdays(260); return "DATE,OPEN,HIGH,LOW,CLOSE\n" + days.map((dt, i) => { const v = i === days.length - 1 ? 19.92 : i === days.length - 2 ? 25.64 : 14 + r() * 12; const [y, m, d2] = dt.split("-"); return `${m}/${d2}/${y},${v},${v},${v},${v.toFixed(2)}`; }).join("\n"); }
function fredSeries(q) { const id = q.get("series_id") || "X"; const base = { VIXCLS: 19.9, DGS2: 4.56, DGS5: 4.67, DGS10: 4.88, DGS30: 5.02, BAMLH0A0HYM2: 3.4, SP500: 6800 }[id] ?? 2 + hash(id) * 4; const r = rng(id); const days = weekdays(Math.min(Number(q.get("limit")) || 260, 400)); const obs = days.map((date) => ({ date, value: (base * (0.97 + r() * 0.06)).toFixed(2) })); return { observations: q.get("sort_order") === "desc" ? obs.reverse() : obs }; }
function text(body, type) { return new Response(body, { status: 200, headers: { "content-type": type, date: new Date().toUTCString() } }); }
function dbRows(table, sql, params) {
  const content = contentRows(table, sql, params); if (content) return content;
  if (table === "symbols") return [...MEMBERS.values()].map(symbolRow);
  if (table === "symbol_metrics") { const sector = params.find((v) => typeof v === "string" && /[a-z]/.test(v)); return [...MEMBERS.values()].filter((m) => !sector || m.sector === sector).map((m) => ({ symbol: m.symbol, sector: m.sector, currency: "USD", metrics: stored(m.symbol), updated_at: new Date().toISOString() })); }
  if (table === "earnings_calendar") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(params[0]))) return EARN_TODAY.filter((r) => params.includes(r.report_date));
    const sym = params[0]; let rows = CAL.filter((r) => r.symbol === sym);
    const dates = params.filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v))).map(String).sort();
    const ge = /report_date" >=/.test(sql), le = /report_date" <=/.test(sql);
    if (ge && le && dates.length >= 2) rows = rows.filter((r) => r.report_date >= dates[0] && r.report_date <= dates[dates.length - 1]);
    else if (ge && dates.length) rows = rows.filter((r) => r.report_date >= dates[0]).reverse();
    else if (le && dates.length) rows = rows.filter((r) => r.report_date <= dates[dates.length - 1]);
    if (/eps_actual" is not null/.test(sql)) rows = rows.filter((r) => r.eps_actual !== null);
    const lim = Number(params[params.length - 1]); return Number.isInteger(lim) && lim > 0 && lim < 100 ? rows.slice(0, lim) : rows;
  }
  return [];
}
function neon(body) {
  const one = (q) => {
    const sql = q.query || ""; const params = q.params || [];
    // MOCK_SQL_LOG=<dosya>: gelen sorguları yazar; eksik tabloyu bulmak için.
    if (process.env.MOCK_SQL_LOG) fs.appendFileSync(process.env.MOCK_SQL_LOG, sql + "\n  " + JSON.stringify(params) + "\n");
    const m = /^\s*select\s+([\s\S]+?)\s+from\s+"([a-z_]+)"/i.exec(sql);
    const empty = { fields: [], command: /^\s*select/i.test(sql) ? "SELECT" : "INSERT", rowCount: 0, rows: [], rowAsArray: true };
    if (/from "macro_series"/.test(sql) && /jsonb_agg/.test(sql)) return macroResult();
    if (!m || /\(/.test(m[1])) return empty;
    const cols = m[1].split(",").map((c) => (c.trim().match(/"([a-z_0-9]+)"\s*$/) || [])[1]);
    if (cols.some((c) => !c)) return empty;
    const rows = dbRows(m[2], sql, params).map((r) => cols.map((c) => (r[c] === undefined ? null : r[c])));
    return { fields: cols.map((name) => ({ name, dataTypeID: name.startsWith("is_") ? 16 : 25 })), command: "SELECT", rowCount: rows.length, rows, rowAsArray: true };
  };
  return Array.isArray(body.queries) ? { results: body.queries.map(one) } : one(body);
}
const seen = new Set();
globalThis.fetch = async function mockFetch(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    const u = new URL(url);
    if (u.hostname === "finnhub.io") return json(finnhub(u.pathname.replace("/api/v1", ""), u.searchParams));
    if (u.hostname.endsWith("alpaca.markets")) return json(alpaca(u));
    if (u.hostname.endsWith("mockdb.test")) { const raw = init && init.body ? String(init.body) : typeof input === "object" && input.text ? await input.clone().text() : "{}"; return json(neon(JSON.parse(raw))); }
    if (u.hostname === "home.treasury.gov") return text(treasuryXml(), "application/xml");
    if (u.hostname === "cdn-api.cboe.com") return text(vixCsv(), "text/csv");
    if (u.hostname === "api.stlouisfed.org" && u.pathname.endsWith("/series/observations")) return json(fredSeries(u.searchParams));
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") return realFetch(input, init);
    if (!seen.has(u.hostname)) { seen.add(u.hostname); process.stderr.write(`[mock-fetch] engellendi: ${u.hostname}${u.pathname}\n`); }
    return json({}, 503);
  } catch (e) {
    return realFetch(input, init);
  }
};
