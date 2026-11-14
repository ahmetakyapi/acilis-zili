/* Piyasa sağlayıcıları: Finnhub, Alpaca, Hazine/Cboe/FRED. Biçim gerçek
   uçlarla aynı; sayılar tohumlu, yani her açılışta aynı.

   SEMBOL SENARYOLARI (tablo: SKILL.md → Senaryolar):
   ZETA  küçük şirket, eksik veri (F/K yok, içeriden işlem yok, bilanço yok)
   BE    hiç bar yok (grafik boş durumu)        SNDK  yalnız 60 seans (yeni halka arz)
   TSN/PDD  bilanço sürprizi yok                RKLB  zarar eden şirket
   NOCAP kümesi  piyasa değeri yok ("–" satırı) */
const { hash, rng, oku, et, etToUtc, addDays, isTrading, prevTrading, tradingDaysBack, day, durum } = require("./ortak.cjs");

const PRICES = { NVDA: [181.77, 178.67], AVGO: [319.92, 319.47], MU: [739.09, 733.15], AMD: [507.78, 508.6], INTC: [58.86, 59.37], TXN: [293.5, 295.72], ARM: [186.4, 186.31], ADI: [390.2, 394.66], QCOM: [170.2, 171.47], AAPL: [271.4, 270.1], MSFT: [512.3, 509.9], ZETA: [17.42, 17.9], HD: [352.1, 344.8], WMT: [101.3, 104.9], RKLB: [58.2, 57.1], TSN: [58.4, 58.1] };
function px(sym) { return PRICES[sym] ?? [20 + hash(sym) * 400, (20 + hash(sym) * 400) * (0.985 + hash(sym + "p") * 0.03)]; }

const NAMES = { NVDA: "NVIDIA Corporation", AVGO: "Broadcom", MU: "Micron Technology", AMD: "Advanced Micro Devices", INTC: "Intel", TXN: "Texas Instruments", ARM: "Arm Holdings", ADI: "Analog Devices", QCOM: "Qualcomm", ZETA: "Zeta Global Holdings Corp.",
  HD: "The Home Depot, Inc.", DIS: "The Walt Disney Company", VIK: "Viking Holdings Ltd", WSM: "Williams-Sonoma Inc", DLB: "Dolby Laboratories, Inc.", CAAP: "Corporacion America Airports S.A.", BDVC: "Franklin BSP Capital Corporation", PANW: "Palo Alto Networks, Inc.", TJX: "The TJX Companies, Inc.", LOW: "Lowe's Companies Inc", ROST: "Ross Stores Inc", TGT: "Target Corp", CPRT: "Copart Inc", SNEX: "StoneX Group Inc", NJR: "New Jersey Resources Corporation", WMT: "Walmart Inc.", INTU: "Intuit Inc.", KEYS: "Keysight Technologies, Inc.", ROAD: "Construction Partners, Inc.", BULL: "Webull Corp", QNME: "Quanome Technologies, Inc", BJ: "BJ's Wholesale Club Holdings", BMNR: "BitMine Immersion Technologies", TSN: "Tyson Foods Inc", ARMK: "Aramark", PSKY: "Paramount Skydance Corporation", SHAZ: "SharonAI Holdings Inc", ACM: "AECOM", CNGO: "Cengage Learning Holdings II", ALLR: "Allarity Therapeutics Inc", RKLB: "Rocket Lab Corporation", PDD: "PDD Holdings Inc.", SJM: "The J. M. Smucker Company",
  SNDK: "Sandisk Corporation", SPCX: "SpaceX Holdings", NBIS: "Nebius Group N.V.", BE: "Bloom Energy Corporation", ONDS: "Ondas Holdings Inc.", MRVL: "Marvell Technology, Inc.", PLTR: "Palantir Technologies Inc." };
/* Piyasa değeri, milyon dolar (Finnhub birimi). */
const CAPS = { NVDA: 4380000, AVGO: 1530000, MU: 836000, AMD: 829000, INTC: 313000, TXN: 268000, ARM: 199000, ADI: 189000, QCOM: 179000, ZETA: 4100,
  HD: 347000, DIS: 204000, VIK: 39900, WSM: 29900, DLB: 5960, CAAP: 4130, BDVC: 1010, PANW: 269000, TJX: 148000, LOW: 128000, ROST: 74100, TGT: 73300, CPRT: 29600, SNEX: 6900, NJR: 5640, WMT: 1010000, INTU: 90900, KEYS: 50700, ROAD: 4570, BULL: 2800, QNME: 10.5, BJ: 12400, BMNR: 3100, TSN: 20700, ARMK: 14200, PSKY: 11000, SHAZ: 798, ACM: 9010, CNGO: 1660, ALLR: 14.9, RKLB: 31000, PDD: 152000, SJM: 11800 };

/* Endeks üyeleri tohumdan; teknik takip listesi ve bilanço haftasının
   şirketleri endekste olmasa da sembol tablosunda durur. */
const MEMBERS = new Map();
for (const m of oku("db/seed/indices.ts").matchAll(/\{ symbol: "([^"]+)", name: "([^"]+)", sector: "([^"]+)"/g)) if (!MEMBERS.has(m[1])) MEMBERS.set(m[1], { symbol: m[1], name: m[2], sector: m[3] });
const TECHNICAL_SYMBOLS = ((/TECHNICAL_SYMBOLS = \[([\s\S]*?)\] as const/.exec(oku("lib/technical.ts")) || [0, ""])[1].replace(/\/\*[\s\S]*?\*\//g, "").match(/"[A-Z.]+"/g) || []).map((s) => s.slice(1, -1));
for (const s of [...TECHNICAL_SYMBOLS, ...Object.keys(NAMES)]) {
  if (s !== "ZETA" && !MEMBERS.has(s)) MEMBERS.set(s, { symbol: s, name: NAMES[s] ?? s, sector: TECHNICAL_SYMBOLS.includes(s) ? "Information Technology" : s === "RKLB" ? "Industrials" : "Consumer Discretionary" });
}
/* Piyasa değeri OLMAYAN endeks üyeleri: sıralı tabloda "–" satırı. İkinci
   sınıf hisse (GOOG, FOX, NWS) seçilmez: şirket listesi onları zaten eler. */
const NOCAP = new Set(["SOLV", "VLTO", "KVUE"].filter((s) => MEMBERS.has(s)));
for (const s of [...MEMBERS.keys()].sort().reverse()) { if (NOCAP.size >= 3) break; if (!CAPS[s] && !TECHNICAL_SYMBOLS.includes(s)) NOCAP.add(s); }
const NOBARS = new Set(["BE"]);
const SHORTBARS = { SNDK: 60 };
function capOf(s) { return NOCAP.has(s) ? null : (CAPS[s] ?? 8000 + hash(s + "cap") ** 3 * 900000) * 1e6; }

function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", date: new Date().toUTCString() } }); }
function text(body, type) { return new Response(body, { status: 200, headers: { "content-type": type, date: new Date().toUTCString() } }); }

/* ---- Gün barları: son seansın kapanışı bugünkü fiyata iner ----
   Barın damgası seansın ET gece yarısıdır (Alpaca böyle verir; UTC gece
   yarısı ET'de bir ÖNCEKİ güne düşer ve seans tarihleri bir gün kayardı). */
const DAILY_SESSIONS = 1300;
const dailyMemo = new Map();
function gunluk(sym) {
  if (NOBARS.has(sym)) return [];
  const { tradeDay } = durum();
  const key = `${sym}:${tradeDay}`;
  if (dailyMemo.has(key)) return dailyMemo.get(key);
  const days = tradingDaysBack(tradeDay, SHORTBARS[sym] ?? DAILY_SESSIONS);
  const n = days.length; const [p, pc] = px(sym); const r = rng(sym + "1Day");
  const vol = 0.021; const drift = sym === "NVDA" ? -0.0006 : 0.0006;
  const closes = new Array(n); closes[n - 1] = p; let c = pc;
  for (let i = n - 2; i >= 0; i--) { closes[i] = c; c = c / (1 + drift + (r() - 0.5) * 2 * vol); }
  const out = days.map((date, i) => {
    const loud = sym === "NVDA" && i >= n - 6 ? [3.0, 1.8, 1, 4.6, 2.2, 1][n - 1 - i] : 0;
    const cl = closes[i]; const o = i ? closes[i - 1] * (1 + (r() - 0.5) * 0.008) : cl * 0.997;
    return { date, t: etToUtc(date).toISOString(), o: +o.toFixed(2), h: +(Math.max(o, cl) * (1 + r() * vol * 0.6)).toFixed(2), l: +(Math.min(o, cl) * (1 - r() * vol * 0.6)).toFixed(2), c: +cl.toFixed(2), v: Math.round(1.6e8 * (loud ? loud * 1.05 : 0.5 + r())), n: 1000, vw: +cl.toFixed(2) };
  });
  if (dailyMemo.size > 4000) dailyMemo.clear();
  dailyMemo.set(key, out);
  return out;
}
/** Tamamlanmış ya da süren seansların gün barları: açılıştan önce bugünün barı YOK. */
function gunlukSimdi(sym) {
  const d = durum(); const all = gunluk(sym);
  return d.tradeDay === d.date && !d.barToday ? all.slice(0, -1) : all;
}
function tfMs(tf) {
  const m = /^(\d+)(Min|Hour|Day|Week|Month)$/.exec(tf) || [0, "1", "Day"];
  return Number(m[1]) * { Min: 60e3, Hour: 3600e3, Day: 86400e3, Week: 7 * 86400e3, Month: 30 * 86400e3 }[m[2]];
}
function bars(sym, tf, start, end, limit) {
  if (NOBARS.has(sym)) return [];
  const strip = ({ date, ...bar }) => bar;
  const cap = Math.min(Number(limit) || 10000, 10000);
  const d = durum();
  const endMs = Math.min(end ? Date.parse(end) : Infinity, d.tradeAt.getTime());
  if (tf === "1Day") {
    const startMs = start ? Date.parse(start) : -Infinity;
    return gunlukSimdi(sym).filter((b) => { const t = Date.parse(b.t); return t >= startMs && t <= endMs; }).slice(-cap).map(strip);
  }
  const step = tfMs(tf); const [last] = px(sym); const r = rng(sym + tf);
  const stamps = [];
  if (step < 86400e3) {
    /* Gün içi: yalnız işlem günlerinin 04:00–20:00 ET penceresi. */
    const startMs = start ? Date.parse(start) : endMs - step * 300;
    for (let date = et(new Date(startMs)).date; date <= d.tradeDay; date = addDays(date, 1)) {
      if (!isTrading(date)) continue;
      const open = etToUtc(date, "04:00").getTime();
      for (let t = open; t < open + 16 * 3600e3; t += step) if (t >= startMs && t <= endMs) stamps.push(t);
    }
    if (SHORTBARS[sym]) { const first = Date.parse(gunluk(sym)[0].t); while (stamps.length && stamps[0] < first) stamps.shift(); }
  } else {
    const startMs = start ? Date.parse(start) : endMs - step * 300;
    for (let t = Math.ceil(startMs / step) * step; t <= endMs; t += step) stamps.push(t);
    if (SHORTBARS[sym]) stamps.splice(0, Math.max(0, stamps.length - Math.ceil((SHORTBARS[sym] * 1.45 * 86400e3) / step)));
  }
  const keep = stamps.slice(-Math.min(stamps.length, cap));
  const n = keep.length; const intraday = step < 86400e3;
  const vol = intraday ? 0.0016 : 0.035; const drift = intraday ? 0 : sym === "NVDA" ? -0.0006 : 0.0006;
  let c = last; const closes = new Array(n);
  for (let i = n - 1; i >= 0; i--) { closes[i] = c; c = c / (1 + drift + (r() - 0.5) * 2 * vol); }
  return keep.map((t, i) => {
    const cl = closes[i]; const o = i ? closes[i - 1] : cl * 0.997;
    return { t: new Date(t).toISOString(), o: +o.toFixed(2), h: +(Math.max(o, cl) * (1 + r() * vol * 0.6)).toFixed(2), l: +(Math.min(o, cl) * (1 - r() * vol * 0.6)).toFixed(2), c: +cl.toFixed(2), v: Math.round((intraday ? 4e5 : 8e8) * (0.5 + r())), n: 1000, vw: cl };
  });
}
/* Kotasyon: açılış öncesinde gün barı DÜNKÜ seanstır, son işlem bugünün ön
   seansı; kapalıyken son işlem son seansın 19:59 ET'si. */
function snapshot(sym) {
  const [p, pc] = px(sym); const d = durum();
  const bar = (date, close, prev) => ({ t: etToUtc(date).toISOString(), o: +(prev * 1.002).toFixed(2), h: +(Math.max(close, prev) * 1.008).toFixed(2), l: +(Math.min(close, prev) * 0.985).toFixed(2), c: close, v: 152_400_000 });
  const preOpen = d.tradeDay === d.date && !d.barToday;
  const barDay = preOpen ? prevTrading(d.date) : d.tradeDay;
  const minute = new Date(Math.floor(d.tradeAt.getTime() / 60e3) * 60e3).toISOString();
  return {
    latestTrade: { p, t: d.tradeAt.toISOString() },
    minuteBar: { t: minute, o: p, h: p, l: p, c: p, v: 12000 },
    dailyBar: preOpen ? bar(barDay, pc, pc * 0.99) : bar(barDay, p, pc),
    prevDailyBar: preOpen ? bar(prevTrading(barDay), +(pc * 0.99).toFixed(2), pc * 0.98) : bar(prevTrading(barDay), pc, pc * 0.99),
  };
}

const NVDA_METRIC = { peTTM: 22.5, epsTTM: 7.91, forwardPE: 14.47, dividendYieldIndicatedAnnual: 0.03, beta: 2.35, "52WeekHigh": 243.37, "52WeekLow": 164.27, bookValuePerShareQuarterly: 9.48, pbQuarterly: 19.0, "totalDebt/totalEquityQuarterly": 0.15, cashPerSharePerShareQuarterly: 2.4, netProfitMarginTTM: 63.7, roeTTM: 104, revenueGrowthTTMYoy: 85, epsGrowthTTMYoy: 92, operatingMarginTTM: 62, currentRatioQuarterly: 4.1, psTTM: 22, grossMarginTTM: 74 };
function metric(sym) {
  if (sym === "NVDA") return NVDA_METRIC;
  if (sym === "ZETA") return { peTTM: null, beta: 1.9, "52WeekHigh": 26.1, "52WeekLow": 11.2 };
  const h = (k) => hash(sym + k); const [p] = px(sym);
  const eps = p / (8 + h("pe") * 60);
  return { peTTM: p / eps, epsTTM: eps, forwardPE: 10 + h("f") * 30, dividendYieldIndicatedAnnual: h("d") * 3, beta: 0.6 + h("b") * 1.6, "52WeekHigh": p * 1.3, "52WeekLow": p * 0.6, bookValuePerShareQuarterly: p / (1 + h("pb") * 12), pbQuarterly: 1 + h("pb") * 12, "totalDebt/totalEquityQuarterly": h("de") * 1.6, cashPerSharePerShareQuarterly: 3, netProfitMarginTTM: -5 + h("nm") * 45, roeTTM: h("roe") * 50, revenueGrowthTTMYoy: -10 + h("rg") * 50, epsGrowthTTMYoy: -20 + h("eg") * 70, operatingMarginTTM: h("om") * 40, currentRatioQuarterly: 0.8 + h("cr") * 3, psTTM: 1 + h("ps") * 14, grossMarginTTM: 20 + h("gm") * 50 };
}
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
const q4 = (rows, sym) => rows.map(([actual, estimate, period, quarter, year]) => ({ actual, estimate, period, quarter, year, symbol: sym }));
const SURPRISES = {
  TSN: [], PDD: [], ZETA: [],
  RKLB: [[-0.13, -0.09, "2026-06-30", 2, 2026], [-0.02, -0.07, "2026-03-31", 1, 2026], [0.04, -0.01, "2025-12-31", 4, 2025], [-0.1, -0.1, "2025-09-30", 3, 2025]],
  HD: [[4.02, 3.95, "2026-10-31", 3, 2026], [4.68, 4.71, "2026-07-31", 2, 2026], [3.56, 3.6, "2026-04-30", 1, 2026], [3.13, 3.04, "2026-01-31", 4, 2025]],
};
const SURPRISE_DEFAULT = [[2.22, 2.14, "2026-07-31", 2, 2027], [1.87, 1.79, "2026-04-30", 1, 2027], [1.62, 1.56, "2026-01-31", 4, 2026], [1.3, 1.27, "2025-10-31", 3, 2026]];
function finnhub(path, q) {
  const sym = q.get("symbol") || "";
  if (sym === "ZETA" && path.includes("insider")) return { data: [], symbol: sym };
  switch (path) {
    case "/stock/profile2": { const cap = capOf(sym); return { name: NAMES[sym] ?? MEMBERS.get(sym)?.name ?? `${sym} Holdings Incorporated`, ticker: sym, exchange: "NASDAQ NMS - GLOBAL MARKET", finnhubIndustry: sym === "ZETA" ? "Software" : "Semiconductors", logo: "", country: "US", currency: "USD", marketCapitalization: cap === null ? 0 : cap / 1e6, shareOutstanding: cap === null ? 0 : cap / 1e6 / px(sym)[0], ipo: sym === "ZETA" ? "2021-06-10" : "1999-01-22", weburl: sym === "ZETA" ? "https://zetaglobal.com/" : "https://www.nvidia.com/" }; }
    case "/quote": { const [p, pc] = px(sym); return { c: p, d: p - pc, dp: ((p - pc) / pc) * 100, h: p * 1.01, l: p * 0.99, o: pc, pc, t: Math.floor(durum().tradeAt.getTime() / 1000) }; }
    case "/stock/metric": return { metric: metric(sym), series: { annual: {}, quarterly: {} } };
    case "/stock/recommendation": return sym === "ZETA" ? [] : [0, 1, 2, 3].map((i) => ({ symbol: sym, period: new Date(Date.UTC(Number(day(0).slice(0, 4)), Number(day(0).slice(5, 7)) - 1 - i, 1)).toISOString().slice(0, 10), strongBuy: 25 - (i > 1 ? 1 : 0), buy: 41 - (i > 1 ? 1 : 0), hold: i > 1 ? 4 : 2, sell: 1, strongSell: 0 }));
    case "/stock/earnings": return q4(SURPRISES[sym] ?? SURPRISE_DEFAULT, sym);
    case "/calendar/earnings": {
      const from = q.get("from") || "", to = q.get("to") || "9";
      const num = (v) => (v === null ? null : Number(v));
      return { earningsCalendar: require("./tablolar.cjs").veri().earnings_calendar.filter((e) => (!sym || e.symbol === sym) && e.report_date >= from && e.report_date <= to).slice(0, 400)
        .map((e) => ({ date: e.report_date, epsActual: num(e.eps_actual), epsEstimate: num(e.eps_estimate), hour: e.hour ?? "", quarter: num(e.quarter), revenueActual: num(e.revenue_actual), revenueEstimate: num(e.revenue_estimate), symbol: e.symbol, year: num(e.year) })) };
    }
    case "/company-news": return (sym === "ZETA" ? HEADLINES.slice(8) : HEADLINES).map((headline, i) => ({ category: "company", datetime: Math.floor(Date.now() / 1000) - (i + 2) * 3400, headline, id: 9000 + i, image: i === 3 ? "https://s.yimg.com/ny/api/res/1.2/x.jpg" : "", related: sym, source: i % 4 === 3 ? "MarketWatch" : "Yahoo", summary: "Özet metni.", url: `https://example.com/n/${i}` }));
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
    return { corporate_actions: { cash_dividends: syms.includes("NVDA") ? divs.filter((d) => d.ex_date >= (q.get("start") || "") && d.ex_date <= (q.get("end") || "9")) : [] }, next_page_token: null };
  }
  if (p.includes("/options/")) {
    if (!p.includes("/snapshots")) return {};
    const und = p.split("/").pop(); const exp = new Date(Date.now() + 8 * 86400e3); while (exp.getUTCDay() !== 5) exp.setUTCDate(exp.getUTCDate() + 1);
    const ymd = exp.toISOString().slice(2, 10).replace(/-/g, ""); const snaps = {}; const t = durum().tradeAt.toISOString(); const [spot] = px(und);
    const stepK = spot > 250 ? 5 : spot > 60 ? 2.5 : 1; const mid = Math.round(spot / stepK) * stepK;
    for (let k = mid - 13 * stepK; k <= mid + 13 * stepK; k += stepK) { const occ = (side) => `${und}${ymd}${side}${String(Math.round(k * 1000)).padStart(8, "0")}`; const tv = spot * 0.047; const cv = Math.max(spot - k, 0) + tv, pv = Math.max(k - spot, 0) + tv; snaps[occ("C")] = { latestQuote: { bp: +(cv - 0.05).toFixed(2), ap: +(cv + 0.05).toFixed(2), t } }; snaps[occ("P")] = { latestQuote: { bp: +(pv - 0.05).toFixed(2), ap: +(pv + 0.05).toFixed(2), t } }; }
    return { snapshots: snaps, next_page_token: null };
  }
  if (p.endsWith("/snapshots")) return Object.fromEntries(syms.map((s) => [s, snapshot(s)]));
  if (p.endsWith("/bars/latest")) return { bars: Object.fromEntries(syms.map((s) => [s, snapshot(s).minuteBar])) };
  if (p.endsWith("/bars")) return { bars: Object.fromEntries(syms.map((s) => [s, bars(s, q.get("timeframe") || "1Day", q.get("start"), q.get("end"), q.get("limit"))])), next_page_token: null };
  return {};
}

/* Dış günlük kaynaklar: Hazine getiri eğrisi (XML), Cboe VIX (CSV), FRED. */
function weekdays(n) { return tradingDaysBack(prevTrading(addDays(durum().tradeDay, 1)), n); }
function treasuryXml() {
  const r = rng("ust");
  return "<feed>" + weekdays(40).map((dt, i) => { const k = (i - 39) * 0.004 + (i === 39 ? 0 : (r() - 0.5) * 0.03); const cell = (tag, v) => `<d:${tag} m:type="Edm.Double">${(v + k).toFixed(2)}</d:${tag}>`; return `<entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">${dt}T00:00:00</d:NEW_DATE>${cell("BC_2YEAR", 4.56)}${cell("BC_5YEAR", 4.67)}${cell("BC_10YEAR", 4.88)}${cell("BC_30YEAR", 5.02)}</m:properties></content></entry>`; }).join("") + "</feed>";
}
function vixCsv() { const r = rng("vix"); const days = weekdays(260); return "DATE,OPEN,HIGH,LOW,CLOSE\n" + days.map((dt, i) => { const v = i === days.length - 1 ? 19.92 : i === days.length - 2 ? 25.64 : 14 + r() * 12; const [y, m, d2] = dt.split("-"); return `${m}/${d2}/${y},${v},${v},${v},${v.toFixed(2)}`; }).join("\n"); }
function fredSeries(q) { const id = q.get("series_id") || "X"; const base = { VIXCLS: 19.9, DGS2: 4.56, DGS5: 4.67, DGS10: 4.88, DGS30: 5.02, BAMLH0A0HYM2: 3.4, SP500: 6800 }[id] ?? 2 + hash(id) * 4; const r = rng(id); const days = weekdays(Math.min(Number(q.get("limit")) || 260, 400)); const obs = days.map((date) => ({ date, value: (base * (0.97 + r() * 0.06)).toFixed(2) })); return { observations: q.get("sort_order") === "desc" ? obs.reverse() : obs }; }

/** Bilinen sağlayıcı adresi ise yanıt, değilse null. */
function yanit(u) {
  if (u.hostname === "finnhub.io") return json(finnhub(u.pathname.replace("/api/v1", ""), u.searchParams));
  if (u.hostname.endsWith("alpaca.markets")) return json(alpaca(u));
  if (u.hostname === "home.treasury.gov") return text(treasuryXml(), "application/xml");
  if (u.hostname === "cdn-api.cboe.com") return text(vixCsv(), "text/csv");
  if (u.hostname === "api.stlouisfed.org" && u.pathname.endsWith("/series/observations")) return json(fredSeries(u.searchParams));
  return null;
}

module.exports = { px, NAMES, MEMBERS, TECHNICAL_SYMBOLS, NOCAP, NOBARS, SHORTBARS, capOf, metric, gunluk, gunlukSimdi, yanit, json };
