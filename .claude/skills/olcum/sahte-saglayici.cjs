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
function dbRows(table, sql, params) {
  if (table === "symbols") return [...MEMBERS.values()].map(symbolRow);
  if (table === "symbol_metrics") { const sector = params.find((v) => typeof v === "string" && /[a-z]/.test(v)); return [...MEMBERS.values()].filter((m) => !sector || m.sector === sector).map((m) => ({ symbol: m.symbol, sector: m.sector, currency: "USD", metrics: stored(m.symbol), updated_at: new Date().toISOString() })); }
  if (table === "earnings_calendar") {
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
    const m = /^\s*select\s+([\s\S]+?)\s+from\s+"([a-z_]+)"/i.exec(sql);
    const empty = { fields: [], command: /^\s*select/i.test(sql) ? "SELECT" : "INSERT", rowCount: 0, rows: [], rowAsArray: true };
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
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") return realFetch(input, init);
    if (!seen.has(u.hostname)) { seen.add(u.hostname); process.stderr.write(`[mock-fetch] engellendi: ${u.hostname}${u.pathname}\n`); }
    return json({}, 503);
  } catch (e) {
    return realFetch(input, init);
  }
};
