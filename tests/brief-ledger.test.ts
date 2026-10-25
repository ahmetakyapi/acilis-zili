import test from "node:test";
import assert from "node:assert/strict";
import {
  findStockMentions,
  ledgerMove,
  ledgerScale,
  ledgerStory,
  ledgerStoryText,
  ledgerWindow,
  metricFromObservations,
  nameCore,
  splitLedgerRefs,
  INDEX_ALIASES,
  type LedgerMove,
  type LedgerStoryFormat,
} from "../lib/brief-ledger";
import { briefLedgerEn, briefLedgerTr } from "../lib/i18n/dictionaries/brief-ledger";
import type { MarketHoliday } from "../lib/market-hours";
import type { Bar } from "../lib/providers/types";

/**
 * Kayıt Defteri — kurallar `lib/brief-ledger.ts`. Örnekler gerçek
 * sayılardan: 24 Ekim Cumartesi bülteni (23 Ekim Cuma seansı: DIA −%1,24,
 * SPY −%0,52, IWM −%0,33, QQQ +%0,06).
 */

const bar = (day: string, close: number): Bar =>
  ({ time: Date.parse(`${day}T04:00:00Z`) / 1000, open: close, high: close, low: close, close, volume: 1 }) as Bar;

const NO_HOLIDAYS: MarketHoliday[] = [];
const COLUMBUS_FREE_THANKSGIVING: MarketHoliday[] = [
  { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null },
  { date: "2026-11-27", nameTr: "Şükran Günü Ertesi", nameEn: "Day after Thanksgiving", earlyCloseEt: "13:00" },
];

test("günlük pencere: sabah bülteni bir önceki seansı anlatır", () => {
  const saturday = ledgerWindow("2026-10-24", "daily", NO_HOLIDAYS)!;
  assert.equal(saturday.session, "2026-10-23");
  assert.equal(saturday.prevSession, "2026-10-22");
  const monday = ledgerWindow("2026-10-26", "daily", NO_HOLIDAYS)!;
  assert.equal(monday.session, "2026-10-23", "pazartesi sabahı cuma kapanışı");
  const tuesday = ledgerWindow("2026-10-20", "daily", NO_HOLIDAYS)!;
  assert.equal(tuesday.session, "2026-10-19");
});

test("haftalık pencere: pazartesi–cuma, tatil hücresi işaretli", () => {
  const week = ledgerWindow("2026-11-23", "weekly", COLUMBUS_FREE_THANKSGIVING)!;
  assert.equal(week.from, "2026-11-23");
  assert.equal(week.to, "2026-11-27");
  assert.equal(week.session, "2026-11-27", "yarım gün de seans");
  assert.equal(week.prevSession, "2026-11-20");
  assert.deepEqual(
    week.days.map((day) => day.trading),
    [true, true, true, false, true],
  );
});

test("günlük hareket posterin hesabı: iki belirli kapanış", () => {
  const window = ledgerWindow("2026-10-24", "daily", NO_HOLIDAYS)!;
  const move = ledgerMove("DIA", [bar("2026-10-21", 530), bar("2026-10-22", 527.91), bar("2026-10-23", 521.37)], window, NO_HOLIDAYS)!;
  assert.ok(Math.abs(move.change - -1.2388) < 0.001);
  assert.deepEqual(move.steps, []);
  assert.equal(ledgerMove("DIA", [bar("2026-10-23", 521.37)], window, NO_HOLIDAYS), null, "önceki kapanış yoksa yüzde yok");
});

test("haftalık hareket: kapanıştan kapanışa, beş hücre, tatil null", () => {
  const window = ledgerWindow("2026-11-23", "weekly", COLUMBUS_FREE_THANKSGIVING)!;
  const bars = [
    bar("2026-11-20", 100),
    bar("2026-11-23", 101),
    bar("2026-11-24", 99.99),
    bar("2026-11-25", 102),
    bar("2026-11-27", 103),
  ];
  const move = ledgerMove("SPY", bars, window, COLUMBUS_FREE_THANKSGIVING)!;
  assert.ok(Math.abs(move.change - 3) < 1e-9);
  assert.equal(move.steps.length, 5);
  assert.equal(move.steps[3].change, null);
  assert.ok(Math.abs((move.steps[4].change ?? 0) - (103 / 102 - 1) * 100) < 1e-9, "tatilden sonra önceki seansa göre");
  const missing = bars.filter((_, index) => index !== 2);
  assert.equal(ledgerMove("SPY", missing, window, COLUMBUS_FREE_THANKSGIVING), null, "eksik gün şeridi düşürür");
});

test("ölçek tabanı: sakin gün tam boy şerit çizmez", () => {
  const calm: LedgerMove[] = [{ symbol: "SPY", change: 0.2, steps: [] }];
  assert.equal(ledgerScale(calm, false), 1);
  assert.equal(ledgerScale([{ symbol: "QQQ", change: -2.4, steps: [] }], false), 2.4);
});

test("ölçü: günlükte gözlem o seansın gününde olmalı", () => {
  const window = ledgerWindow("2026-10-24", "daily", NO_HOLIDAYS)!;
  const obs = [
    { date: "2026-10-21", value: 4.95 },
    { date: "2026-10-22", value: 4.95 },
    { date: "2026-10-23", value: 4.99 },
  ];
  const metric = metricFromObservations("us10y", obs, window)!;
  assert.equal(metric.value, 4.99);
  assert.equal(metric.prev, 4.95);
  assert.equal(metric.prevDate, "2026-10-22");
  assert.equal(metricFromObservations("us10y", obs.slice(0, 2), window), null, "dünkü değer bugünün diye basılmaz");
});

test("ölçü: haftalıkta dönemin son gözlemi ve dönem öncesi", () => {
  const window = ledgerWindow("2026-10-12", "weekly", NO_HOLIDAYS)!;
  const obs = [
    { date: "2026-10-09", value: 5.25 },
    { date: "2026-10-13", value: 5.2 },
    { date: "2026-10-16", value: 5.1 },
    { date: "2026-10-19", value: 5.0 },
  ];
  const metric = metricFromObservations("us10y", obs, window)!;
  assert.equal(metric.value, 5.1);
  assert.equal(metric.prev, 5.25);
});

const moves = (entries: [string, number][]): LedgerMove[] => entries.map(([symbol, change]) => ({ symbol, change, steps: [] }));
const NAMES: Record<string, string> = { QQQ: "Nasdaq 100", SPY: "S&P 500", DIA: "Dow Jones", IWM: "Russell 2000" };

function format(locale: "tr" | "en"): LedgerStoryFormat {
  const list = new Intl.ListFormat(locale === "tr" ? "tr-TR" : "en-US", { type: "conjunction" });
  const L = locale === "tr" ? briefLedgerTr : briefLedgerEn;
  const num = (value: number) => Math.abs(value).toFixed(2).replace(".", locale === "tr" ? "," : ".");
  return {
    name: (symbol) => NAMES[symbol] ?? symbol,
    signed: (value) => (locale === "tr" ? `${value < 0 ? "−" : "+"}%${num(value)}` : `${value < 0 ? "−" : "+"}${num(value)}%`),
    plain: (value) => (locale === "tr" ? `%${num(value)}` : `${num(value)}%`),
    list: (items) => list.format(items),
    dayName: (index) => L.weekdaysLong[index],
  };
}

test("günün cümlesi: 23 Ekim, Nasdaq 100 yatay, üçü düştü", () => {
  const story = ledgerStory(moves([["QQQ", 0.06], ["SPY", -0.52], ["DIA", -1.24], ["IWM", -0.33]]), "daily")!;
  assert.equal(story.kind, "mixed");
  assert.equal(
    ledgerStoryText(story, briefLedgerTr.story, format("tr")),
    "S&P 500, Dow Jones ve Russell 2000 geriledi, Nasdaq 100 yatay kaldı.",
  );
  assert.equal(
    ledgerStoryText(story, briefLedgerEn.story, format("en")),
    "S&P 500, Dow Jones, and Russell 2000 fell, Nasdaq 100 ended flat.",
  );
});

test("günün cümlesi: dördü aynı yöndeyse en büyük hareket", () => {
  const story = ledgerStory(moves([["QQQ", -1.8], ["SPY", -1.1], ["DIA", -0.6], ["IWM", -2.3]]), "daily")!;
  assert.equal(ledgerStoryText(story, briefLedgerTr.story, format("tr")), "Dört endeks de geriledi; en sert düşüş Russell 2000, −%2,30.");
  const split = ledgerStory(moves([["QQQ", 0.8], ["SPY", 0.3], ["DIA", -0.4], ["IWM", 0.02]]), "daily")!;
  assert.equal(
    ledgerStoryText(split, briefLedgerTr.story, format("tr")),
    "Endeksler ayrıştı: Nasdaq 100 ve S&P 500 yükseldi, Dow Jones geriledi, Russell 2000 yatay kaldı.",
  );
});

test("haftanın cümlesi: seans sayısı tatili sayar, en sert gün", () => {
  const spy: LedgerMove = {
    symbol: "SPY",
    change: -1.97,
    steps: [
      { date: "2026-11-23", change: 0.4 },
      { date: "2026-11-24", change: -1.42 },
      { date: "2026-11-25", change: 0.3 },
      { date: "2026-11-26", change: null },
      { date: "2026-11-27", change: -1.2 },
    ],
  };
  const story = ledgerStory([spy], "weekly")!;
  assert.equal(
    ledgerStoryText(story, briefLedgerTr.story, format("tr")),
    "S&P 500 haftayı %1,97 düşüşle kapattı; 4 seansın 2 tanesi artıda, en sert gün Salı (−%1,42).",
  );
  assert.equal(
    ledgerStoryText(story, briefLedgerEn.story, format("en")),
    "S&P 500 ended the week down 1.97%; 2 of 4 sessions closed higher, the sharpest day was Tuesday (−1.42%).",
  );
});

const MEMBERS = [
  { symbol: "AXP", name: "American Express" },
  { symbol: "T", name: "AT&T" },
  { symbol: "TMUS", name: "T-Mobile US" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "ET", name: "Energy Transfer" },
  { symbol: "POOL", name: "Pool Corporation" },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "SPY", name: "S&P 500 ETF" },
];

test("bültende geçen hisseler: özel ad ve uzun sembol, ilk geçiş sırası", () => {
  const text =
    "Cuma 09:30 ET'de açılış. Kaybı derinleştiren American Express oldu; AT&T %8, T-Mobile %7,7 düştü. AMD yükseldi. Pool party yok, Tesla'nın planı masada. SPY %0,52 geriledi.";
  const found = findStockMentions(text, MEMBERS, new Set(["SPY"]));
  assert.deepEqual(
    found.map((mention) => mention.symbol),
    ["AXP", "T", "TMUS", "AMD", "TSLA"],
    "ET saat dilimi, Pool gündelik sözcük, SPY endeks bandında",
  );
  assert.equal(found[0].alias, "American Express");
  assert.equal(findStockMentions("american express kartları", MEMBERS).length, 0, "küçük harf özel ad değil");
  assert.equal(findStockMentions("Talep (POOL) tarafında", MEMBERS)[0]?.symbol, "POOL", "parantez kalıbı her zaman");
});

test("yanlış şirket yok: yer, kişi ve gün adı ilk kelime değil", () => {
  const members = [
    { symbol: "BSX", name: "Boston Scientific" },
    { symbol: "PM", name: "Philip Morris International" },
    { symbol: "LVS", name: "Las Vegas Sands" },
    { symbol: "MLM", name: "Martin Marietta Materials" },
    { symbol: "LMT", name: "Lockheed Martin" },
    { symbol: "ITW", name: "Illinois Tool Works" },
    { symbol: "JKHY", name: "Jack Henry & Associates" },
    { symbol: "BEN", name: "Franklin Resources" },
    { symbol: "FLEX", name: "Flex Ltd." },
    { symbol: "KEY", name: "KeyCorp" },
    { symbol: "LOW", name: "Lowe's" },
    { symbol: "COST", name: "Costco" },
    { symbol: "CAT", name: "Caterpillar Inc." },
    { symbol: "RTX", name: "RTX Corporation" },
  ];
  const negatives = [
    "Boston Fed Başkanı Susan Collins faiz indirimine temkinli yaklaştı.",
    "Fed Başkan Yardımcısı Philip Jefferson enflasyonun inatçı olduğunu söyledi.",
    "Las Vegas'taki CES fuarında yapay zekâ cihazları öne çıktı.",
    "Martin Luther King Günü nedeniyle piyasalar kapalı.",
    "Illinois eyaleti, Jack Ma ve Franklin Templeton raporu; Flex çalışma düzeni.",
    "KEY TAKEAWAYS: LOW volatility, COST pressures, CAT scan, RTX PRO 5500 kartları.",
  ];
  for (const sentence of negatives) {
    assert.deepEqual(findStockMentions(sentence, members), [], sentence);
  }
  const positives = findStockMentions(
    "Boston Scientific yükseldi, Philip Morris'ten 2,36 dolar, Las Vegas Sands geriledi; Martin Marietta ve Lockheed Martin. Caterpillar ile (KEY) ve $LOW.",
    members,
  );
  assert.deepEqual(
    positives.map((mention) => mention.symbol),
    ["BSX", "PM", "LVS", "MLM", "LMT", "CAT", "KEY", "LOW"],
  );
});

test("ad çekirdeği: son ek ve gündelik ilk kelime", () => {
  assert.equal(nameCore("Tesla, Inc."), "Tesla");
  assert.equal(nameCore("American Express"), "American Express");
  assert.equal(nameCore("Bank of America Corp"), "Bank of America");
  assert.equal(nameCore("Pool Corporation"), null);
  assert.equal(nameCore("Meta Platforms"), "Meta", "markalaşmış tek kelime");
  assert.equal(nameCore("Boston Scientific"), "Boston Scientific", "marka değil: iki kelime");
  assert.equal(nameCore("Las Vegas Sands"), "Las Vegas Sands", "iki kelime yer adı: üç");
  assert.equal(nameCore("Arthur J. Gallagher & Co."), "Arthur J. Gallagher", "baş harf: üç");
  assert.equal(nameCore("Deere & Company"), "Deere", "sondaki bağlaç atılır");
  assert.equal(nameCore("Packaging Corporation of America"), null, "ikinci kelime son ek");
  assert.equal(nameCore("Flex Ltd."), null, "tek kelime, marka değil");
});

test("metindeki geçişler: uzun biçim önce, ardındaki yüzde bağa dahil", () => {
  const refs = Object.entries(INDEX_ALIASES).map(([key, aliases]) => ({ key, aliases }));
  const pieces = splitLedgerRefs("Dow'u izleyen DIA %1,24, SPY %0,52 düştü; Dow Jones yatay.", refs);
  const linked = pieces.filter((piece): piece is { key: string; text: string } => typeof piece !== "string");
  assert.deepEqual(
    linked.map((piece) => [piece.key, piece.text]),
    [
      ["DIA", "Dow"],
      ["DIA", "DIA %1,24"],
      ["SPY", "SPY %0,52"],
      ["DIA", "Dow Jones"],
    ],
  );
  assert.equal(pieces.map((piece) => (typeof piece === "string" ? piece : piece.text)).join(""), "Dow'u izleyen DIA %1,24, SPY %0,52 düştü; Dow Jones yatay.");
  assert.equal(splitLedgerRefs("Nasdaq bileşik endeksi", refs).length, 1, "Nasdaq 100 değil");
});
