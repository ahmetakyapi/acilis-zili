import test from "node:test";
import assert from "node:assert/strict";

import {
  earningsIcsEvent,
  economicIcsEvent,
  FEED_MAX_SYMBOLS,
  feedPath,
  feedUrls,
  parseFeedQuery,
  parseFeedSymbols,
} from "../lib/calendar-feed";
import { calendarFeedEn, calendarFeedTr } from "../lib/i18n/dictionaries/calendar-feed";
import { buildIcs } from "../lib/ics";
import { absoluteUrl } from "../lib/site";

/**
 * Takvim aboneliğinin sözleşmesi: adres doğrulaması (herkese açık uç, sıkı
 * girdi), olay kimliğinin kararlılığı ve saat dürüstlüğü (bilinmeyen dakika
 * yazılmaz; bilinen saat yaz/kış saatinde doğru UTC anına düşer).
 */

const query = (qs: string) => parseFeedQuery(new URLSearchParams(qs));

/** `n` adet geçerli, birbirinden farklı sembol: AA, AB, … */
const symbols = (n: number) =>
  Array.from({ length: n }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);

test("sembol listesi: sıralı, tekil, büyük harfli", () => {
  assert.deepEqual(parseFeedSymbols("NVDA,AAPL"), ["AAPL", "NVDA"]);
  assert.deepEqual(parseFeedSymbols("nvda,NVDA,brk.b,BF-B"), ["BF-B", "BRK.B", "NVDA"]);
  assert.deepEqual(parseFeedSymbols("A"), ["A"]);
});

test("sembol biçimi sıkı: bozuk parça listeyi tümüyle düşürür", () => {
  for (const raw of [
    "",
    ",",
    "NVDA,",
    ",NVDA",
    "NVDA,,AAPL",
    "NVDA, AAPL",
    " NVDA",
    "NVDA;AAPL",
    "NV DA",
    "NVDA1",
    "1NVDA",
    ".NVDA",
    "ABCDEFGHIJK",
    "NVDA'--",
    "NVDA%00",
    "ŞİRKET",
    "NVDA\n",
    "<script>",
  ]) {
    assert.equal(parseFeedSymbols(raw), null, JSON.stringify(raw));
  }
});

test("tavan: kırk sembol geçer, kırk bir geçmez; yineleme tavana sayılmaz", () => {
  assert.equal(FEED_MAX_SYMBOLS, 40);
  assert.equal(parseFeedSymbols(symbols(40).join(","))?.length, 40);
  assert.equal(parseFeedSymbols(symbols(41).join(",")), null);
  assert.equal(parseFeedSymbols([...symbols(40), "AA", "AB"].join(","))?.length, 40);
  /* Ham dize tavanı: bölünmeden reddedilir. */
  assert.equal(parseFeedSymbols(Array(500).fill("NVDA").join(",")), null);
});

test("sorgu: iki tür, dil varsayılanı ve önem süzgeci", () => {
  assert.deepEqual(query("tur=makro"), { kind: "makro", locale: "tr", impact: null });
  assert.deepEqual(query("tur=makro&onem=high&dil=en"), { kind: "makro", locale: "en", impact: "high" });
  assert.deepEqual(query("tur=bilanco&semboller=NVDA,AAPL&dil=en"), {
    kind: "bilanco",
    locale: "en",
    symbols: ["AAPL", "NVDA"],
  });
});

test("geçersiz sorgu reddedilir", () => {
  for (const qs of [
    "",
    "tur=temettu",
    "tur=MAKRO",
    "tur=makro&dil=de",
    "tur=makro&dil=",
    "tur=makro&onem=kritik",
    "tur=makro&onem=",
    "tur=bilanco",
    "tur=bilanco&semboller=",
    "tur=bilanco&semboller=NVDA,",
    "tur=bilanco&semboller=NVDA&dil=fr",
    `tur=bilanco&semboller=${symbols(41).join(",")}`,
    "semboller=NVDA",
  ]) {
    assert.equal(query(qs), null, qs);
  }
});

test("adres: aynı liste her yazımda aynı yolu üretir ve kendi ayrıştırıcısından geçer", () => {
  const a = feedPath({ kind: "bilanco", locale: "tr", symbols: ["NVDA", "AAPL", "nvda"] });
  const b = feedPath({ kind: "bilanco", locale: "tr", symbols: ["AAPL", "NVDA"] });
  assert.equal(a, "/api/takvim/akis?tur=bilanco&semboller=AAPL,NVDA&dil=tr");
  assert.equal(a, b);
  assert.deepEqual(query(a.split("?")[1]), { kind: "bilanco", locale: "tr", symbols: ["AAPL", "NVDA"] });

  assert.equal(feedPath({ kind: "makro", locale: "tr", impact: null }), "/api/takvim/akis?tur=makro&dil=tr");
  assert.equal(
    feedPath({ kind: "makro", locale: "en", impact: "high" }),
    "/api/takvim/akis?tur=makro&onem=high&dil=en",
  );

  /* Ucun süzgecinden geçmeyen takip kaydı adrese girmez. */
  assert.equal(
    feedPath({ kind: "bilanco", locale: "tr", symbols: ["NVDA", "BTC1", "", "AAPL"] }),
    "/api/takvim/akis?tur=bilanco&semboller=AAPL,NVDA&dil=tr",
  );

  /* Tavanı aşan takip listesi: ilk kırk sembol, adres yine geçerli. */
  const capped = feedPath({ kind: "bilanco", locale: "tr", symbols: symbols(55) });
  const parsed = query(capped.split("?")[1]);
  assert.equal(parsed?.kind === "bilanco" ? parsed.symbols.length : 0, 40);
});

test("abonelik adresleri: https kopyalanır, webcal takvim uygulamasını açar", () => {
  const q = { kind: "makro", locale: "tr", impact: null } as const;
  assert.deepEqual(feedUrls(q, "https://aciliszili.com"), {
    https: "https://aciliszili.com/api/takvim/akis?tur=makro&dil=tr",
    webcal: "webcal://aciliszili.com/api/takvim/akis?tur=makro&dil=tr",
  });
  assert.equal(
    feedUrls(q, "http://localhost:3122").webcal,
    "webcal://localhost:3122/api/takvim/akis?tur=makro&dil=tr",
  );
});

test("bilanço: saat uydurulmaz — tüm gün, pencere adı başlıkta ve açıklamada", () => {
  const row = { symbol: "NVDA", reportDate: "2026-11-19", hour: "amc", updatedAt: new Date("2026-11-13T06:00:00Z") };
  const event = earningsIcsEvent(row, "NVIDIA Corporation", "tr", calendarFeedTr);
  assert.equal(event.start, undefined);
  assert.equal(event.date, "2026-11-19");
  assert.equal(event.summary, "NVDA Bilanço · Kapanış Sonrası");
  assert.match(event.description, /^NVIDIA Corporation 2026-11-19 tarihinde/);
  assert.match(event.description, /Sağlayıcı kesin saat vermiyor; açıklama kapanış sonrası bekleniyor\./);
  assert.match(event.description, /New York takvimine göredir/);
  assert.equal(event.url, absoluteUrl("/hisse/NVDA", "tr"));
  assert.equal(event.lastModified?.toISOString(), "2026-11-13T06:00:00.000Z");

  const body = buildIcs([event], { now: new Date("2026-11-14T00:00:00Z") });
  assert.ok(body.includes("DTSTART;VALUE=DATE:20261119"));
  assert.equal(/DTSTART:\d{8}T\d{6}Z/.test(body), false);

  const en = earningsIcsEvent({ ...row, hour: "bmo" }, null, "en", calendarFeedEn);
  assert.equal(en.summary, "NVDA Earnings · Before the Open");
  assert.match(en.description, /^NVDA reports quarterly results on 2026-11-19\. No exact time is published/);
  assert.equal(en.url, absoluteUrl("/hisse/NVDA", "en"));
  assert.ok(en.url.endsWith("/en/hisse/NVDA"));
});

test("bilanço: penceresi bilinmeyen ya da tanınmayan satır pencere adı taşımaz", () => {
  for (const hour of [null, "", "  ", "16:30", "xyz"]) {
    const event = earningsIcsEvent({ symbol: "JPM", reportDate: "2026-10-13", hour }, "JPMorgan", "tr", calendarFeedTr);
    assert.equal(event.summary, "JPM Bilanço", String(hour));
    assert.match(event.description, /Sağlayıcı açıklama saatini vermiyor\.$/);
    assert.equal(event.date, "2026-10-13");
    assert.equal(event.start, undefined);
  }
});

test("kimlik kararlı: aynı olay her yayında aynı UID, farklı olay farklı UID", () => {
  const row = { symbol: "NVDA", reportDate: "2026-11-19", hour: "amc" };
  const first = earningsIcsEvent({ ...row, updatedAt: new Date("2026-11-01T00:00:00Z") }, "NVIDIA", "tr", calendarFeedTr);
  /* Yeniden yayın: damga, dil, pencere ve şirket adı değişse de kimlik aynı. */
  const second = earningsIcsEvent({ ...row, hour: null, updatedAt: new Date("2026-11-14T00:00:00Z") }, null, "en", calendarFeedEn);
  assert.equal(first.uid, "bilanco-NVDA-2026-11-19@acilis-zili");
  assert.equal(second.uid, first.uid);
  assert.notEqual(earningsIcsEvent({ ...row, reportDate: "2027-02-24" }, null, "tr", calendarFeedTr).uid, first.uid);
  assert.notEqual(earningsIcsEvent({ ...row, symbol: "AMD" }, null, "tr", calendarFeedTr).uid, first.uid);

  const cpi = { slug: "cpi-2026-12-10", eventDate: "2026-12-10", eventTimeEt: "08:30", titleTr: "TÜFE", titleEn: "CPI" };
  assert.equal(economicIcsEvent(cpi, "Yüksek", "tr", calendarFeedTr).uid, "olay-cpi-2026-12-10@acilis-zili");
  assert.equal(
    economicIcsEvent({ ...cpi, eventTimeEt: null }, "High", "en", calendarFeedEn).uid,
    "olay-cpi-2026-12-10@acilis-zili",
  );
  /* Tarihsiz slug: iki ayın açıklaması aynı kimliği paylaşmaz. */
  const dec = economicIcsEvent({ ...cpi, slug: "core-pce" }, "Yüksek", "tr", calendarFeedTr);
  const jan = economicIcsEvent({ ...cpi, slug: "core-pce", eventDate: "2027-01-28" }, "Yüksek", "tr", calendarFeedTr);
  assert.equal(dec.uid, "olay-core-pce-2026-12-10@acilis-zili");
  assert.notEqual(dec.uid, jan.uid);
});

test("ekonomik olay: ET saati yaz ve kış saatinde doğru UTC anına düşer", () => {
  const event = (eventDate: string, eventTimeEt: string) =>
    economicIcsEvent(
      { slug: `x-${eventDate}`, eventDate, eventTimeEt, titleTr: "Veri", titleEn: "Data" },
      "Yüksek",
      "tr",
      calendarFeedTr,
    ).start?.toISOString();

  /* Yaz saati (EDT, UTC−4): 08:30 ET = 12:30 UTC = 15:30 İstanbul. */
  assert.equal(event("2026-07-14", "08:30"), "2026-07-14T12:30:00.000Z");
  /* Kış saati (EST, UTC−5): 08:30 ET = 13:30 UTC = 16:30 İstanbul. */
  assert.equal(event("2026-12-10", "08:30"), "2026-12-10T13:30:00.000Z");
  /* Fed kararı 14:00 ET: yazın 18:00, kışın 19:00 UTC. */
  assert.equal(event("2026-06-17", "14:00"), "2026-06-17T18:00:00.000Z");
  assert.equal(event("2026-12-09", "14:00"), "2026-12-09T19:00:00.000Z");
  /* Geçiş günleri: 8 Mart 2026 (ileri) ve 1 Kasım 2026 (geri), sabah
     saati geçişten SONRA. */
  assert.equal(event("2026-03-08", "08:30"), "2026-03-08T12:30:00.000Z");
  assert.equal(event("2026-11-01", "08:30"), "2026-11-01T13:30:00.000Z");
  /* Geçişten önceki cuma hâlâ eski kaymada. */
  assert.equal(event("2026-03-06", "08:30"), "2026-03-06T13:30:00.000Z");
  assert.equal(event("2026-10-30", "08:30"), "2026-10-30T12:30:00.000Z");

  const body = buildIcs(
    [economicIcsEvent({ slug: "cpi-2026-07-14", eventDate: "2026-07-14", eventTimeEt: "08:30", titleTr: "Haziran TÜFE Verisi", titleEn: "June CPI" }, "Yüksek", "tr", calendarFeedTr)],
    { now: new Date("2026-07-01T00:00:00Z") },
  );
  assert.ok(body.includes("DTSTART:20260714T123000Z\r\nDTEND:20260714T130000Z"));
  assert.ok(body.includes("SUMMARY:Haziran TÜFE Verisi"));
  assert.ok(body.includes("DESCRIPTION:Ekonomik veri açıklaması. Önem: Yüksek."));
});

test("ekonomik olay: saati ilan edilmemişse tüm gün ve açıklamada söylenir", () => {
  const event = economicIcsEvent(
    { slug: "jackson-hole-2026-08-21", eventDate: "2026-08-21", eventTimeEt: null, titleTr: "Jackson Hole", titleEn: "Jackson Hole" },
    "High",
    "en",
    calendarFeedEn,
  );
  assert.equal(event.start, undefined);
  assert.equal(event.date, "2026-08-21");
  assert.equal(event.description, "Economic data release. Importance: High. No time has been announced; written as an all-day event.");
  assert.ok(event.url.endsWith("/en/takvim"));
});

test("sözlük: iki dilde aynı yer tutucular", () => {
  const holders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
  for (const key of Object.keys(calendarFeedTr) as (keyof typeof calendarFeedTr)[]) {
    const tr = calendarFeedTr[key];
    const en = calendarFeedEn[key];
    if (typeof tr === "string" && typeof en === "string") assert.equal(holders(en), holders(tr), key);
  }
});
