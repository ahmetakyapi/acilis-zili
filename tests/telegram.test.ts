import test from "node:test";
import assert from "node:assert/strict";
import tr from "../lib/i18n/dictionaries/tr";
import en from "../lib/i18n/dictionaries/en";
import {
  CAPTION_LIMIT,
  MESSAGE_LIMIT,
  clipText,
  firstParagraph,
  fitMessage,
  formatClose,
  formatMacro,
  formatPreOpen,
  formatStory,
  postSummary,
  tgEscape,
  tgLink,
} from "../lib/telegram-format";
import { closeWindow, isFresh, postKey, preOpenWindow } from "../lib/telegram-plan";
import { getMarketStatus } from "../lib/market-hours";

/** Telegram kanalının saf kısmı (lib/telegram-format.ts, lib/telegram-plan.ts). */

/** Intl ince/dar boşlukları (U+2009, U+202F, U+00A0) düz boşluğa. */
const plain = (value: string) => value.replace(/[   ]/g, " ");
/** Telegram HTML kipinin tanıdığı etiketler dışında etiket yok. */
const onlyKnownTags = (html: string) => (html.match(/<\/?([a-z]+)/g) ?? []).every((tag) => /^<\/?(b|i|a)$/.test(tag));

test("kaçış: & < > ve tırnak; bağlantı adresi de kaçışlı", () => {
  assert.equal(tgEscape(`S&P <500> "x"`), "S&amp;P &lt;500&gt; &quot;x&quot;");
  assert.equal(tgLink("https://aciliszili.com/a?b=1&c=2", "Oku"), '<a href="https://aciliszili.com/a?b=1&amp;c=2">Oku</a>');
});

test("kısaltma kelime sınırında, üç nokta ile", () => {
  assert.equal(clipText("kısa metin", 50), "kısa metin");
  const cut = clipText("Fed faiz kararını açıkladı ve piyasa sert tepki verdi", 30);
  assert.ok(cut.length <= 30);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("ver"));
});

test("ilk paragraf: başlık, blok ve liste atlanır; işaretleme temizlenir", () => {
  const md = [
    "## Giriş",
    "",
    "::: sayilar",
    "**Gelir:** 10 Mr $",
    ":::",
    "",
    "- madde",
    "",
    "**Nvidia** [beklentiyi](/hisse/NVDA) aştı",
    "ve hisse *yükseldi*.",
    "",
    "İkinci paragraf.",
  ].join("\n");
  assert.equal(firstParagraph(md), "Nvidia beklentiyi aştı ve hisse yükseldi.");
  assert.equal(firstParagraph("## Yalnız Başlık"), "");
});

test("sığdırma: liste sondan düşer, '+N' yazar ve sınır aşılmaz", () => {
  const rows = Array.from({ length: 300 }, (_, index) => `Satır ${index} ${"x".repeat(20)}`);
  const text = fitMessage({ head: ["<b>Başlık</b>"], lists: [{ title: "<b>Liste</b>", rows }], tail: ["<i>Son</i>"] }, MESSAGE_LIMIT, (n) => `+${n}`);
  assert.ok(text.length <= MESSAGE_LIMIT, String(text.length));
  assert.ok(text.startsWith("<b>Başlık</b>"));
  assert.ok(text.endsWith("<i>Son</i>"));
  assert.match(text, /\+\d+\n\n<i>Son<\/i>$/);
  assert.ok(onlyKnownTags(text));
});

test("açılış mesajı TR: İstanbul saati, bülten, takvim ve kaçış", () => {
  const status = getMarketStatus(new Date("2026-10-26T13:20:00Z"), []);
  const html = formatPreOpen(
    {
      locale: "tr",
      date: "2026-10-26",
      openAt: status.nextOpen,
      brief: { headline: "S&P <rekor> denemesi", summary: "Endeksler açılış öncesi yatay.", url: "https://aciliszili.com/bulten/2026-10-26" },
      calendar: [
        { kind: "event", at: new Date("2026-10-26T14:00:00Z"), title: "Yeni Konut Satışları" },
        { kind: "earnings", at: new Date("2026-10-26T20:00:00Z"), window: "Bilanço · Kapanış Sonrası", symbols: ["GOOGL", "MSFT", "META", "AMZN", "AAPL", "NVDA", "TSLA"] },
      ],
      calendarEmpty: false,
      calendarUrl: "https://aciliszili.com/takvim",
    },
    tr.telegram,
  );
  const text = plain(html);
  /* 26 Ekim: ABD yaz saatinde (EDT), Türkiye UTC+3 → açılış 16:30 TR. */
  assert.match(text, /^<b>Açılış 16:30 TR<\/b> · 26 Ekim/);
  assert.match(text, /S&amp;P &lt;rekor&gt; denemesi/);
  assert.match(text, /17:00 TR · Yeni Konut Satışları/);
  assert.match(text, /~23:00 TR · Bilanço · Kapanış Sonrası: GOOGL · MSFT · META · AMZN · AAPL · NVDA \+1/);
  assert.match(text, /<a href="https:\/\/aciliszili\.com\/bulten\/2026-10-26">Bülteni Oku<\/a>/);
  assert.ok(!/utm_/.test(text));
  assert.ok(onlyKnownTags(html));
});

test("açılış mesajı EN: New York saati önde; kışın aynı açılış 17:30 TR", () => {
  const status = getMarketStatus(new Date("2026-11-02T14:20:00Z"), []);
  const input = {
    date: "2026-11-02",
    openAt: status.nextOpen,
    brief: null,
    calendar: null,
    calendarEmpty: false,
    calendarUrl: "https://aciliszili.com/en/takvim",
  } as const;
  assert.match(plain(formatPreOpen({ ...input, locale: "en" }, en.telegram)), /^<b>Opening Bell 09:30 NY<\/b>/);
  /* 2 Kasım: ABD kış saatine geçti (EST) → açılış 17:30 TR. Sabit saat yok. */
  assert.match(plain(formatPreOpen({ ...input, locale: "tr" }, tr.telegram)), /^<b>Açılış 17:30 TR<\/b>/);
  /* Takvim okunamadı (null): boşluk iddiası yok. */
  assert.ok(!formatPreOpen({ ...input, locale: "tr" }, tr.telegram).includes(tr.telegram.calendarEmpty));
});

test("kapanış mesajı: fon fiyatı, dile göre yüzde, evren notu, bilançolar", () => {
  const base = {
    date: "2026-10-23",
    closeAt: new Date("2026-10-23T20:00:00Z"),
    indices: [{ label: "S&P 500", symbol: "SPY", close: 759.97, changePct: -0.52 }],
    movers: { up: [{ symbol: "CRWD", changePct: 8.6 }], down: [{ symbol: "COST", changePct: -1.59 }], universe: 512 },
    afterClose: ["INTC"],
    marketsUrl: "https://aciliszili.com/piyasalar",
    earningsUrl: "https://aciliszili.com/bilancolar",
  };
  const trText = plain(formatClose({ ...base, locale: "tr" }, tr.telegram));
  assert.match(trText, /^<b>Kapanış 23:00 TR<\/b> · 23 Ekim/);
  assert.match(trText, /S&amp;P 500 \(SPY\) 759,97 \$ · <b>− %0,52<\/b>/);
  assert.match(trText, /CRWD \+ %8,60/);
  assert.match(trText, /512 şirket arasında/);
  assert.match(trText, /Kapanış Sonrası Bilançolar<\/b>\nINTC/);
  const enText = plain(formatClose({ ...base, locale: "en" }, en.telegram));
  assert.match(enText, /^<b>Closing Bell 16:00 NY<\/b>/);
  assert.match(enText, /\$759\.97 · <b>− 0\.52%<\/b>/);
  /* Sıralama kurulamadıysa bölüm hiç yok. */
  assert.ok(!formatClose({ ...base, locale: "tr", movers: null }, tr.telegram).includes(tr.telegram.gainersTitle));
});

test("Mercek: altyazı 1024, mesaj 4096 sınırında", () => {
  const input = { title: "Uzun <Başlık>", lead: "kelime ".repeat(1000), url: "https://aciliszili.com/mercek/x" };
  const caption = formatStory(input, tr.telegram, CAPTION_LIMIT);
  const message = formatStory(input, tr.telegram);
  assert.ok(caption.length <= CAPTION_LIMIT, String(caption.length));
  assert.ok(message.length <= MESSAGE_LIMIT);
  assert.match(caption, /Uzun &lt;Başlık&gt;/);
  assert.match(caption, /<a href="https:\/\/aciliszili\.com\/mercek\/x">Yazıyı Oku<\/a>$/);
  assert.ok(onlyKnownTags(caption));
});

test("makro: gerçekleşen kalın, beklenti ve önceki varsa", () => {
  const html = formatMacro(
    { locale: "tr", title: "Eylül TÜFE Verisi", at: new Date("2026-10-15T12:30:00Z"), actual: "%0,3", forecast: "%0,2", url: "https://aciliszili.com/takvim" },
    tr.telegram,
  );
  assert.match(plain(html), /^<b>Eylül TÜFE Verisi<\/b> · 15:30 TR\nGerçekleşen <b>%0,3<\/b> · Beklenti %0,2\n/);
  assert.ok(!html.includes("Önceki"));
  assert.equal(postSummary(html), "Eylül TÜFE Verisi · 15:30 TR");
});

test("açılış penceresi: son 15 dakika, son 5'te bültensiz", () => {
  const holidays: never[] = [];
  const at = (iso: string) => {
    const now = new Date(iso);
    return preOpenWindow(getMarketStatus(now, holidays), now);
  };
  /* 26 Ekim, açılış 13:30 UTC. */
  assert.deepEqual(at("2026-10-26T13:10:00Z"), { due: false, final: false });
  assert.deepEqual(at("2026-10-26T13:16:00Z"), { due: true, final: false });
  assert.deepEqual(at("2026-10-26T13:26:00Z"), { due: true, final: true });
  assert.deepEqual(at("2026-10-26T13:31:00Z"), { due: false, final: false });
  /* Cumartesi: işlem yok. */
  assert.deepEqual(at("2026-10-24T13:20:00Z"), { due: false, final: false });
});

test("kapanış penceresi: kapanış + 30 dk ile akşam seansı sonu arası, aynı ET günü", () => {
  const at = (iso: string) => {
    const now = new Date(iso);
    return closeWindow(getMarketStatus(now, []), now);
  };
  /* 23 Ekim (EDT), kapanış 20:00 UTC. */
  assert.equal(at("2026-10-23T20:20:00Z"), false);
  assert.equal(at("2026-10-23T20:31:00Z"), true);
  assert.equal(at("2026-10-23T23:50:00Z"), true);
  /* Gece yarısından (ET) sonra dünün kapanışı gönderilmez. */
  assert.equal(at("2026-10-24T04:10:00Z"), false);
  /* Yarım gün: 27 Kasım 13:00 ET kapanış → 13:30 ET'den itibaren. */
  const half = [{ date: "2026-11-27", nameTr: "Şükran Günü Ertesi", nameEn: "Day After Thanksgiving", earlyCloseEt: "13:00" }];
  const now = new Date("2026-11-27T18:31:00Z");
  assert.equal(closeWindow(getMarketStatus(now, half), now), true);
});

test("tazelik ve defter anahtarı", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  assert.equal(isFresh(new Date("2026-10-23T07:00:00Z"), now), true);
  assert.equal(isFresh(new Date("2026-10-23T05:00:00Z"), now), false);
  assert.equal(isFresh(new Date("2026-10-23T13:00:00Z"), now), false);
  assert.equal(isFresh(null, now), false);
  assert.equal(postKey("kapanis", "2026-10-23", "tr"), "telegram:kapanis:2026-10-23:tr");
});
