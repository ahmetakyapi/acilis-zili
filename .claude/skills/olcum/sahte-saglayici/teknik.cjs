/* `technical_analyses` satırları. Semboller `lib/technical.ts` →
   `TECHNICAL_SYMBOLS`ten okunur (liste değişince sahte veri de değişir);
   fotoğraf (`snapshot`) aynı sahte gün barlarından, `computeSnapshot`ın
   alanlarıyla hesaplanır: grafikteki ortalama ile kayıttaki ortalama aynı
   barlardan gelir.

   SENARYOLAR (sembol → durum; listede olmayan sembol karmayla seçilir):
   NVDA  SAT, plan yok; iki gün önce TUT'tan döndü; EN metni var
   AMD   AL, bölge + stop + üç hedef; dün TUT'tan döndü; EN metni var
   MU    AL, TEK seviyeli giriş (alt = üst), tek hedef
   TSLA  bölgeli TUT            AAPL  bölgesiz TUT          INTC  SAT
   PLTR  yayını HİÇ yok ("ilk yayından sonra" künyesi)
   MRVL  yayını bayat (son yayın 8 işlem günü önce: panodan düşer)
   BE    gün barı yok: fotoğraf boş (ortalama, RSI, tepe/dip yok)
   SNDK  60 seans: 100 ve 200 günlük ortalama yok */
const { hash, uid, et, etToUtc, isTrading, prevTrading, durum } = require("./ortak.cjs");
const { px, NAMES, TECHNICAL_SYMBOLS, gunlukSimdi } = require("./piyasa.cjs");

const SLOTS = [["premarket", "08:45"], ["midsession", "12:45"], ["lateday", "14:45"]];
const PLAN = { NVDA: "sell", AMD: "buy", MU: "buy1", TSLA: "holdZone", AAPL: "hold", INTC: "sell" };
const HIC_YOK = new Set(["PLTR"]);
const BAYAT = { MRVL: 8 };
/* Görüş geçmişi, yeniden eskiye; her harf bir yayın (A = AL, T = TUT, S = SAT). */
const GECMIS = { NVDA: "SSSSSSTTTTTTTTT", AMD: "AAATTTTTTSSSTTT", MU: "AAAAAAAAAAAATTT", TSLA: "TTTTTTTTTAAAAAA", AAPL: "TTTTTTTTTTTTTTT", INTC: "SSSSSSSSSSSSSSS" };
const STANCE = { A: "buy", T: "hold", S: "sell" };

const r2 = (v) => Math.round(v * (Math.abs(v) >= 1 ? 100 : 10000)) / (Math.abs(v) >= 1 ? 100 : 10000);
const sma = (a, n) => (a.length < n ? null : a.slice(-n).reduce((s, v) => s + v, 0) / n);
function ema(values, period) { if (values.length < period) return []; const k = 2 / (period + 1); let e = values.slice(0, period).reduce((s, v) => s + v, 0) / period; const out = [e]; for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); } return out; }
function rsi(c, n = 14) { if (c.length <= n) return null; let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; } g /= n; l /= n; for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; } return l === 0 ? 100 : 100 - 100 / (1 + g / l); }
function macd(c) { const f = ema(c, 12), s = ema(c, 26); if (s.length < 9) return null; const line = s.map((v, i) => f[i + 14] - v); const sig = ema(line, 9); const hist = sig.map((v, i) => line[i + 8] - v); let cross = null; for (let i = hist.length - 1; i > 0; i--) if (Math.sign(hist[i]) !== Math.sign(hist[i - 1])) { cross = hist.length - 1 - i; break; } const h = hist[hist.length - 1]; return { macd: +line[line.length - 1].toFixed(3), signal: +sig[sig.length - 1].toFixed(3), histogram: +h.toFixed(3), crossSessions: cross }; }
function atr(b, n = 14) { if (b.length <= n) return null; const tr = []; for (let i = 1; i < b.length; i++) tr.push(Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c))); let a = tr.slice(0, n).reduce((s, v) => s + v, 0) / n; for (let i = n; i < tr.length; i++) a = (a * (n - 1) + tr[i]) / n; return a; }
function cross(c) { const n = c.length; if (n < 201) return null; const diff = (end) => sma(c.slice(0, end), 50) - sma(c.slice(0, end), 200); let later = diff(n); for (let back = 1; back <= 30 && n - back >= 200; back++) { const earlier = diff(n - back); if (later !== 0 && Math.sign(earlier) !== Math.sign(later)) return { kind: later > 0 ? "golden" : "death", sessions: back - 1 }; later = earlier; } return null; }
function swings(b, price) {
  const s = b.slice(-120); const highs = [], lows = [];
  for (let i = 3; i < s.length - 3; i++) { let hi = true, lo = true; for (let j = i - 3; j <= i + 3; j++) { if (j === i) continue; if (s[j].h >= s[i].h) hi = false; if (s[j].l <= s[i].l) lo = false; } if (hi) highs.push(s[i].h); if (lo) lows.push(s[i].l); }
  const cluster = (levels) => { const kept = []; for (const v of levels) { if (kept.every((k) => Math.abs(k - v) / k > 0.015)) kept.push(v); if (kept.length === 3) break; } return kept.map(r2); };
  return { highs: cluster(highs.filter((h) => h > price).sort((a, b2) => a - b2)), lows: cluster(lows.filter((l) => l < price).sort((a, b2) => b2 - a)) };
}
function snapshotOf(symbol, asOf) {
  const b = gunlukSimdi(symbol); const c = b.map((x) => x.c); const last = b[b.length - 1] ?? null; const [price, pc] = px(symbol);
  const year = b.slice(-252); const vols = b.slice(-20).map((x) => x.v); const sw = swings(b, price);
  const n = (v) => (v === null ? null : r2(v));
  let pivots = null;
  if (last) { const p = (last.h + last.l + last.c) / 3; pivots = { p: r2(p), r1: r2(2 * p - last.l), r2: r2(p + last.h - last.l), s1: r2(2 * p - last.h), s2: r2(p - (last.h - last.l)) }; }
  return {
    asOf, lastSession: last ? last.date : null, sessions: c.length, price: r2(price), prevClose: r2(pc), changePct: +(((price - pc) / pc) * 100).toFixed(2),
    sma20: n(sma(c, 20)), sma50: n(sma(c, 50)), sma100: n(sma(c, 100)), sma200: n(sma(c, 200)), rsi14: c.length > 14 ? +rsi(c).toFixed(1) : null, macd: macd(c), atr14: n(atr(b)),
    avgVolume20: vols.length === 20 ? Math.round(vols.reduce((s, v) => s + v, 0) / 20) : null, lastVolume: last ? last.v : null, todayVolume: null,
    high52: year.length ? r2(Math.max(...year.map((x) => x.h))) : null, low52: year.length ? r2(Math.min(...year.map((x) => x.l))) : null, pivots, cross: cross(c), swingHighs: sw.highs, swingLows: sw.lows,
  };
}

const AD = { buy: "AL", hold: "TUT", sell: "SAT" };
function copyOf(symbol, stance, plan, snap, levels) {
  const ad = NAMES[symbol] ?? symbol; const f = (v) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tr = {
    headline: stance === "buy" ? `${ad} ${f(levels.resistances[0])} dolarlık direnci zorluyor; geri çekilmeler alım bölgesine kadar sağlıklı.`
      : stance === "sell" ? `${ad} SAT'ta; sektör yükselirken hisse 50 günlük ortalamasının altında ayrışmayı sürdürüyor ve her tepki satışla karşılanıyor.`
      : `${ad} yatay bantta; yön için ${f(levels.resistances[0])} ile ${f(levels.supports[0])} dolar arasındaki sıkışmanın çözülmesi bekleniyor.`,
    summary: stance === "buy" ? "Fiyat 20 ve 50 günlük ortalamaların üstünde, ortalamalar yukarı eğimli. RSI aşırı alım sınırına yaklaşmadan yükseliş sürüyor; MACD histogramı pozitif bölgede genişliyor."
      : stance === "sell" ? "Fiyat kısa vadeli ortalamaların altında; 20 günlük ortalama 50 günlüğü aşağı kesti. Hacim satış günlerinde artıyor, alış günlerinde kuruyor. Tablo düzelene kadar yeni alım için erken."
      : "Fiyat ortalamaların arasında sıkıştı; RSI 50 çevresinde yönsüz. Bant kırılana kadar görüş nötr.",
    bull: `${f(levels.resistances[0])} doların üstünde günlük kapanış ${f(levels.resistances[1] ?? levels.resistances[0] * 1.05)} doları hedefe koyar.`,
    bear: `${f(levels.supports[0])} doların altında kapanış ${f(levels.supports[1] ?? levels.supports[0] * 0.95)} dolara kadar boşluk açar.`,
    volume: snap.avgVolume20 ? "Son seansın hacmi 20 günlük ortalamanın 1,4 katı; hareket hacimle destekleniyor." : "Hacim ortalaması için yeterli seans yok.",
    watch: symbol === "NVDA" ? ["Çarşamba kapanış sonrası bilanço: sonuç öncesi oynaklık artabilir.", "Yönetim soruşturmasına ilişkin yeni haber akışı.", "Yarı iletken endeksinin 50 günlük ortalaması."] : ["Açılıştaki ilk yarım saatin hacmi.", "Perşembe günkü haftalık işsizlik başvuruları."],
    entryNote: plan === "buy" ? "50 günlük ortalama ile önceki kırılım seviyesi arası." : plan === "buy1" ? "Önceki tepe, tek seviye." : plan === "holdZone" ? "Bandın alt sınırı; görüş AL'a dönerse geçerli." : null,
    stopNote: levels.stop ? "Son yükselen dibin altı." : null,
    targetsNote: levels.targets.length > 1 ? "Önceki tepe, ardından 52 haftalık zirve." : levels.targets.length === 1 ? "52 haftalık zirve." : null,
  };
  const en = symbol === "NVDA" || symbol === "AMD" ? {
    ...tr,
    headline: stance === "buy" ? `${ad} is pressing the $${levels.resistances[0].toFixed(2)} resistance; pullbacks stay healthy down to the entry zone.` : `${ad} stays at SELL: the stock keeps lagging below its 50-day average while the sector rallies.`,
    summary: "Price sits on the wrong side of its short-term averages and volume confirms the move.",
    bull: `A daily close above $${levels.resistances[0].toFixed(2)} opens the way higher.`, bear: `A close below $${levels.supports[0].toFixed(2)} leaves a gap lower.`,
    volume: "Last session's volume ran 1.4 times the 20-day average.", watch: ["Volume in the first half hour.", "Thursday's jobless claims."],
    entryNote: tr.entryNote && "Between the 50-day average and the prior breakout.", stopNote: tr.stopNote && "Below the last higher low.", targetsNote: tr.targetsNote && "Prior high, then the 52-week peak.",
  } : null;
  return { tr, en };
}

/** Son yayın: bugünün geçmiş slotu, yoksa önceki işlem gününün son slotu; oradan geriye `n` yayın. */
function editions(n, skipDays = 0) {
  const d = durum(); const out = [];
  let date = isTrading(d.date) ? d.date : prevTrading(d.date);
  let slot = isTrading(d.date) ? SLOTS.filter(([, t]) => d.min >= Number(t.slice(0, 2)) * 60 + Number(t.slice(3))).length - 1 : 2;
  if (slot < 0) { date = prevTrading(date); slot = 2; }
  for (let i = 0; i < skipDays; i++) date = prevTrading(date);
  if (skipDays) slot = 2;
  while (out.length < n) { out.push({ date, slot: SLOTS[slot][0], at: new Date(etToUtc(date, SLOTS[slot][1]).getTime() + 3 * 60e3).toISOString() }); if (--slot < 0) { slot = 2; date = prevTrading(date); } }
  return out;
}

function rows() {
  const out = []; let id = 0;
  TECHNICAL_SYMBOLS.forEach((symbol) => {
    if (HIC_YOK.has(symbol)) return;
    const plan = PLAN[symbol] ?? ["hold", "sell", "buy", "holdZone"][Math.floor(hash(symbol + "plan") * 4)];
    const now = plan.startsWith("buy") ? "A" : plan.startsWith("hold") ? "T" : "S";
    const past = GECMIS[symbol] ?? now.repeat(6) + "TAS"[Math.floor(hash(symbol + "g") * 3)].repeat(9);
    const list = editions(15, BAYAT[symbol] ?? 0);
    const [price] = px(symbol); const snap = snapshotOf(symbol, list[0].at);
    const levels = {
      supports: (snap.swingLows.length ? snap.swingLows : [price * 0.96, price * 0.91]).slice(0, 3), resistances: (snap.swingHighs.length ? snap.swingHighs : [price * 1.04, price * 1.09]).slice(0, 3),
      entryLow: plan === "buy" || plan === "holdZone" ? r2(price * 0.955) : plan === "buy1" ? r2(price * 0.98) : null,
      entryHigh: plan === "buy" || plan === "holdZone" ? r2(price * 0.985) : plan === "buy1" ? r2(price * 0.98) : null,
      stop: plan === "buy" || plan === "buy1" || plan === "holdZone" ? r2(price * 0.92) : null,
      targets: plan === "buy" ? [r2(price * 1.06), r2(price * 1.12), r2(price * 1.19)] : plan === "buy1" ? [r2(price * 1.08)] : [],
    };
    list.forEach((ed, i) => {
      const stance = STANCE[past[i] ?? now];
      /* Plan yalnız o yayının görüşü AL (ya da bölgeli TUT) ise dolu: geçmiş şeridi boş hücreyi de göstersin. */
      const withPlan = i === 0 || stance === "buy";
      out.push({
        id: uid(5, id++), symbol, session_date: ed.date, slot: ed.slot, stance,
        entry_low: withPlan && levels.entryLow !== null ? String(levels.entryLow) : null, entry_high: withPlan && levels.entryHigh !== null ? String(levels.entryHigh) : null, stop: withPlan && levels.stop !== null ? String(levels.stop) : null,
        targets: JSON.stringify(i === 0 ? levels.targets : []), supports: JSON.stringify(levels.supports), resistances: JSON.stringify(levels.resistances),
        copy: JSON.stringify(copyOf(symbol, stance, i === 0 ? plan : stance, snap, levels)), snapshot: JSON.stringify({ ...snap, asOf: ed.at }),
        generated_by: "claude", published_at: ed.at, updated_at: ed.at,
      });
    });
  });
  return out;
}

module.exports = { rows };
