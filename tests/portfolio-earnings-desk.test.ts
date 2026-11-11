import test from "node:test";
import assert from "node:assert/strict";
import {
  bellOf,
  buildCard,
  checkDesk,
  checkViews,
  classifyRow,
  deskInput,
  deskSessions,
  deskSignature,
  historyOf,
  pickDeskRows,
  reactionOf,
  reactionSession,
  type DeskCalendarRow,
  type DeskFormatters,
} from "../lib/portfolio-earnings-desk-model";
import { planLevels, scanRows } from "../lib/portfolio-scan-model";
import type { MarketHoliday } from "../lib/market-hours";
import { formatMoneyCompact, formatPercentText, formatPrice } from "../lib/utils";

/** Bilanço Masası — saf hesap (lib/portfolio-earnings-desk-model.ts). */

const NONE: MarketHoliday[] = [];
const THANKSGIVING: MarketHoliday[] = [
  { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null },
  { date: "2026-11-27", nameTr: "Şükran Günü (Yarım)", nameEn: "Day after Thanksgiving", earlyCloseEt: "13:00" },
];

const row = (symbol: string, reportDate: string, extra: Partial<DeskCalendarRow> = {}): DeskCalendarRow => ({
  symbol,
  reportDate,
  hour: "amc",
  epsEstimate: 1,
  epsActual: null,
  revenueEstimate: 1e9,
  revenueActual: null,
  quarter: 3,
  year: 2026,
  ...extra,
});

/* Salı 10 Kasım 2026 tamamlanmış seans; bugün çarşamba. */
const SESSION = "2026-11-10";

test("seans pencereleri: önümüzdeki üç ve tamamlanmış son üç işlem günü", () => {
  const { upcoming, recent } = deskSessions(SESSION, NONE);
  assert.deepEqual(upcoming, ["2026-11-11", "2026-11-12", "2026-11-13"]);
  assert.deepEqual(recent, ["2026-11-10", "2026-11-09", "2026-11-06"]);
  /* Tatil atlanır: 25 Kasım'dan sonra 26 (tam tatil) yok, 27 yarım gün var. */
  assert.deepEqual(deskSessions("2026-11-24", THANKSGIVING).upcoming, ["2026-11-25", "2026-11-27", "2026-11-30"]);
});

test("tepki seansı: kapanış sonrası ertesi işlem günü, açılış öncesi aynı gün, hafta sonu sonraki seans", () => {
  assert.equal(reactionSession("2026-11-13", "amc", NONE), "2026-11-16");
  assert.equal(reactionSession("2026-11-12", "bmo", NONE), "2026-11-12");
  assert.equal(reactionSession("2026-11-14", null, NONE), "2026-11-16");
  assert.equal(reactionSession("2026-11-25", "amc", THANKSGIVING), "2026-11-27");
});

test("evre: açıklanmamış yaklaşan öncesi; açıklanmış son seanslar sonrası; tepki bekleyen işaretli; uzak satır elenir", () => {
  assert.deepEqual(classifyRow(row("A", "2026-11-12"), SESSION, NONE), { phase: "before", reactionSession: "2026-11-13", pending: true });
  /* Cuma kapanış sonrası: tepki pazartesi, üç seanslık pencerenin dışı. */
  assert.equal(classifyRow(row("B", "2026-11-13"), SESSION, NONE), null);
  assert.deepEqual(classifyRow(row("C", "2026-11-09", { epsActual: 1.1 }), SESSION, NONE), { phase: "after", reactionSession: "2026-11-10", pending: false });
  /* Dün kapanış sonrası açıkladı: tepki bugün, seans kapanmadı. */
  assert.deepEqual(classifyRow(row("D", "2026-11-10", { epsActual: 1.1 }), SESSION, NONE), { phase: "after", reactionSession: "2026-11-11", pending: true });
  /* Dört seans önce: masanın dışı. */
  assert.equal(classifyRow(row("E", "2026-11-04", { epsActual: 1.1 }), SESSION, NONE), null);
  /* Tepki seansı geçmiş ama gerçekleşen yok: söylenecek bir şey yok. */
  assert.equal(classifyRow(row("F", "2026-11-09"), SESSION, NONE), null);
});

test("seçim: yalnız portföy sembolleri, sembol başına bir satır, önce sonrası (yeniden eskiye) sonra öncesi (yakından uzağa)", () => {
  const picked = pickDeskRows(
    [
      row("NVDA", "2026-11-12"),
      row("MU", "2026-11-11", { hour: "bmo" }),
      row("AAPL", "2026-11-06", { epsActual: 2 }),
      row("AAPL", "2026-11-12"),
      row("TSLA", "2026-11-09", { epsActual: 1 }),
      row("XYZ", "2026-11-11"),
    ],
    new Set(["NVDA", "MU", "AAPL", "TSLA"]),
    SESSION,
    NONE,
  );
  assert.deepEqual(
    picked.map((p) => `${p.row.symbol}:${p.phase}`),
    ["TSLA:after", "AAPL:after", "MU:before", "NVDA:before"],
  );
});

const bar = (date: string, close: number) => ({ date, close });
const BARS = [bar("2026-11-05", 100), bar("2026-11-06", 104), bar("2026-11-09", 98.8), bar("2026-11-10", 100)];

test("ilk tepki: tepki seansının kapanışı / önceki kapanış; bar yoksa null", () => {
  const amc = reactionOf(BARS, "2026-11-06", "amc")!;
  assert.equal(amc.session, "2026-11-09");
  assert.ok(Math.abs(amc.pct - -5) < 1e-9);
  const bmo = reactionOf(BARS, "2026-11-06", "bmo")!;
  assert.equal(bmo.session, "2026-11-06");
  assert.ok(Math.abs(bmo.pct - 4) < 1e-9);
  assert.equal(reactionOf(BARS, "2026-11-10", "amc"), null);
  assert.equal(reactionOf(BARS, "2026-11-01", "bmo"), null);
});

test("geçmiş çeyrekler: son dört, eskiden yeniye, açıklanmamış ve gelecek satır dışarıda", () => {
  const past = [
    row("MU", "2025-09-20", { epsActual: 1.2, quarter: 4, year: 2025 }),
    row("MU", "2025-12-18", { epsActual: 0.9, quarter: 1, year: 2026 }),
    row("MU", "2026-03-20", { epsActual: 1.0, quarter: 2, year: 2026 }),
    row("MU", "2026-06-20", { epsActual: 1.3, quarter: 3, year: 2026 }),
    row("MU", "2026-11-06", { epsActual: 1.1, quarter: 4, year: 2026 }),
    row("MU", "2026-11-20", { quarter: 1, year: 2027 }),
  ];
  const history = historyOf(past, BARS, "2026-11-12");
  assert.deepEqual(history.map((q) => q.label), ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"]);
  assert.deepEqual(history.map((q) => q.direction), ["miss", "inline", "beat", "beat"]);
  assert.equal(history[0]!.reaction, null);
  assert.ok(Math.abs(history[3]!.reaction! - -5) < 1e-9);
});

test("zil saati TR önce: kış saatinde açılış 17:30, kapanış 00:00; yarım günde 21:00; pencere bilinmiyorsa yok", () => {
  assert.equal(bellOf("2026-11-12", "bmo", NONE, "tr"), "17:30");
  assert.equal(bellOf("2026-11-12", "amc", NONE, "tr"), "00:00");
  assert.equal(bellOf("2026-11-12", "amc", NONE, "en"), "16:00");
  assert.equal(bellOf("2026-11-27", "amc", THANKSGIVING, "tr"), "21:00");
  assert.equal(bellOf("2026-11-12", null, NONE, "tr"), null);
  /* Yaz saatinde fark yedi saat: açılış 16:30. */
  assert.equal(bellOf("2026-07-15", "bmo", NONE, "tr"), "16:30");
});

const holdingBars = (closes: number[]) => closes.map((close) => ({ close, high: close + 1, low: close - 1 }));
const ROWS = scanRows([
  { symbol: "MU", name: "MU", sector: null, quantity: 10, cost: 900, bars: holdingBars([90, 91, 92, 93, 94, 95, 96, 100]), earnings: null, technical: null, levels: { stop: 92, entryLow: null, entryHigh: null, targets: [110], supports: [], resistances: [] }, news: [] },
  { symbol: "AAPL", name: "AAPL", sector: null, quantity: 30, cost: 3000, bars: holdingBars([100, 100, 100, 100, 100, 100, 100, 100]), earnings: null, technical: null, news: [] },
]);

function cards() {
  const picked = pickDeskRows(
    [row("MU", "2026-11-12", { epsEstimate: 1.25, revenueEstimate: 8.9e9 }), row("AAPL", "2026-11-09", { epsActual: 1.5, epsEstimate: 1.4, revenueActual: 9e10, revenueEstimate: 9.1e10 })],
    new Set(["MU", "AAPL"]),
    SESSION,
    NONE,
  );
  return picked.map((p) =>
    buildCard(
      {
        picked: p,
        name: p.row.symbol === "MU" ? "Micron" : "Apple",
        currency: null,
        past: p.row.symbol === "MU" ? [row("MU", "2026-11-06", { epsActual: 1.1, quarter: 4, year: 2026 })] : [],
        bars: BARS,
        row: ROWS.find((r) => r.symbol === p.row.symbol) ?? null,
        analysisHref: p.row.symbol === "AAPL" ? "/bilancolar/aapl/4c-2026" : null,
      },
      NONE,
      "tr",
    ),
  );
}

test("kart: sonrası gerçekleşen ve tepki, öncesi beklenti ve geçmiş; ağırlık bütün portföyden", () => {
  const [aapl, mu] = cards();
  assert.equal(aapl!.phase, "after");
  assert.equal(aapl!.eps.direction, "beat");
  assert.equal(aapl!.revenue.direction, "miss");
  assert.equal(aapl!.reaction!.session, "2026-11-10");
  assert.equal(aapl!.reactionPending, false);
  assert.equal(aapl!.history.length, 0);
  assert.equal(aapl!.analysisHref, "/bilancolar/aapl/4c-2026");
  assert.equal(mu!.phase, "before");
  assert.equal(mu!.eps.actual, null);
  assert.equal(mu!.eps.direction, null);
  assert.equal(mu!.bell, "00:00");
  assert.equal(mu!.history.length, 1);
  assert.equal(Math.round(mu!.weight!), 25);
  assert.ok(Math.abs(aapl!.weight! + mu!.weight! - 100) < 1e-9);
});

test("imza evreden bağımsız: semboller ve rapor tarihleri", () => {
  assert.equal(deskSignature(cards()), "AAPL@2026-11-09,MU@2026-11-12");
});

const F: DeskFormatters = {
  pct: (v, d = 1) => formatPercentText(v, "tr", d),
  share: (v) => `%${Math.round(v)}`,
  money: (v, c) => formatPrice(v, "tr", { currency: c ?? true }),
  compact: (v, c) => formatMoneyCompact(v, "tr", c),
  day: (d) => d,
};

test("girdi: öncesinde gerçekleşen ve tepki yok, sonrasında geçmiş çeyrek yok; sayılar biçimli", () => {
  const input = JSON.parse(deskInput(cards(), SESSION, "tr", F)) as { cards: Record<string, unknown>[] };
  const [aapl, mu] = input.cards;
  assert.equal(aapl!.phase, "reported");
  assert.equal(aapl!.recentQuarters, undefined);
  assert.deepEqual((aapl!.firstReaction as { closeToClose: string }).closeToClose, "+%1,21");
  assert.equal(mu!.phase, "upcoming");
  assert.equal(mu!.firstReaction, undefined);
  assert.equal((mu!.eps as { actual: string | null }).actual, null);
  assert.equal((mu!.position as { weight: string }).weight, "%25");
});

test("denetim: uydurma sayı ve üyede tavsiye metni düşürür; bilinmeyen sembol atılır", () => {
  const cs = cards();
  const input = deskInput(cs, SESSION, "tr", F);
  const good = checkDesk(
    { headline: "Apple beklentiyi aştı, Micron perşembe açıklıyor", cards: [{ symbol: "aapl", note: "Apple ilk seansı +%1,21 ile kapattı." }, { symbol: "ZZZ", note: "x" }] },
    input,
    cs,
    "tr",
  );
  assert.ok(good.ok);
  if (good.ok) {
    assert.deepEqual(Object.keys(good.text.notes), ["AAPL"]);
    assert.equal(good.text.notes.AAPL!.phase, "after");
  }
  const invented = checkDesk({ headline: "Masa", cards: [{ symbol: "MU", note: "Micron %37 yükselebilir." }] }, input, cs, "tr");
  assert.equal(invented.ok, false);
  const advice = checkDesk({ headline: "Masa", cards: [{ symbol: "MU", note: "Bilanço öncesi pozisyonu azaltmalısın." }] }, input, cs, "tr");
  assert.equal(advice.ok, false);
  const owner = checkDesk({ headline: "Masa", cards: [{ symbol: "MU", note: "Bilanço öncesi pozisyonu azaltmalısın." }] }, input, cs, "tr", { adviceAllowed: true });
  assert.ok(owner.ok);
});

test("sahip görüşü: seviye yalnız listeden ve yönü tutarak; masada olmayan sembol düşer", () => {
  const cs = cards();
  const price = (v: number) => formatPrice(v, "tr", { currency: true, digits: 2 });
  const levelsOf = (r: (typeof ROWS)[number]) => planLevels(r, price);
  const input = deskInput(cs, SESSION, "tr", F, {
    levels: new Map([["MU", { lastClose: price(100), averageCost: price(90), allowed: levelsOf(ROWS[0]!).map((l) => ({ level: l.label, kind: l.source })) }]]),
  });
  const views = checkViews(
    [
      { symbol: "MU", action: "trim", takeProfit: price(110), stopLoss: price(92), rationale: "Ağırlık %25, bilanço öncesi kârın bir kısmı alınabilir." },
      { symbol: "AAPL", action: "hold", takeProfit: price(150), stopLoss: null, rationale: "Beklentiyi aştı, tut." },
      { symbol: "NVDA", action: "add", takeProfit: null, stopLoss: null, rationale: "Yok." },
    ],
    cs,
    ROWS,
    levelsOf,
    input,
  );
  assert.deepEqual(views.map((v) => v.symbol), ["MU", "AAPL"]);
  assert.equal(views[0]!.takeProfit!.value, 110);
  assert.equal(views[0]!.stopLoss!.value, 92);
  /* Listede olmayan seviye düşer, görüş kalır. */
  assert.equal(views[1]!.takeProfit, null);
});
