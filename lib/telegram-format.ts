import type { Dictionary } from "./i18n";
import type { Locale } from "./i18n/config";
import { displayZone, formatInZone, zoneTag } from "./session-clock";
import { formatEtDateLong, formatPercent, formatPrice } from "./utils";

/**
 * TELEGRAM MESAJLARI — saf biçimleyiciler (24 Ekim).
 *
 * Kanal gönderici (`lib/telegram.ts`, `/api/cron/telegram`) veriyi sitenin
 * var olan okumalarından toplar (`lib/telegram-data.ts`); burası yalnız onu
 * mesaja çevirir. Metin ÜRETİLMEZ: bülten özeti, Mercek girişi ve takvim
 * başlıkları sitede ne yazıyorsa o; sayılar sitenin biçimleyicileriyle
 * (`formatPercent`, `formatPrice`) ve sitenin saat kuralıyla (TR okuyucuya
 * İstanbul, EN okuyucuya New York — `lib/session-clock.ts`).
 *
 * BİÇİM `parse_mode: "HTML"`. Telegram bu kipte yalnız `<b> <i> <a> <code>`
 * gibi birkaç etiketi tanır ve metindeki `< > &` kaçışlanmazsa mesajı
 * REDDEDER ("can't parse entities") — bülten başlığında bir "S&P 500" bütün
 * gönderimi düşürürdü. Her dış metin `tgEscape`ten geçer; bağlantı adresi de
 * (`"` dahil).
 *
 * UZUNLUK: mesaj 4096, foto altyazısı 1024 karakter. Sınır Telegram'da
 * işaretleme AYIKLANDIKTAN sonraki metne uygulanıyor; burada ham HTML
 * ölçülüyor — ham hâl her zaman daha uzun, yani sınırın altında kalan ham
 * mesaj Telegram'da da kalır. Sığmayan mesajda önce liste satırları sondan
 * düşer ("+N" ile), en sonda gövde kelime sınırında kısalır; etiket asla
 * ortasından kesilmez.
 *
 * Bağlantılarda UTM yok: kanal okuyucusu adresi kopyalayıp paylaşıyor ve
 * izleme eki canonical adresi kirletir.
 */

export const MESSAGE_LIMIT = 4096;
export const CAPTION_LIMIT = 1024;

/** Bülten özetinin ve Mercek girişinin mesajdaki tavanı (harf). */
export const LEAD_MAX_CHARS = 600;
/** Liste satırlarının (takvim, hareket edenler) tavanı. */
export const LIST_MAX_ROWS = 8;
/** Kapanışta yükselen/düşen başına isim sayısı. */
export const MOVERS_PER_SIDE = 5;
/** Bilanço penceresinde adı yazılan şirket sayısı; fazlası "+N". */
const EARNINGS_NAMES = 6;

export type TelegramLabels = Dictionary["telegram"];

/** Telegram HTML kipinin kaçışı — metin ve öznitelik için aynı. */
export function tgEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Bağlantı — adres ve etiket kaçışlı. */
export function tgLink(href: string, label: string): string {
  return `<a href="${tgEscape(href)}">${tgEscape(label)}</a>`;
}

/** Düz metni kelime sınırında kısaltır; kesildiyse "…" ile biter. */
export function clipText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  /* Kelime sınırı çok gerideyse (tek uzun kelime) harften kesilir. */
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.–—-]+$/u, "")}…`;
}

/**
 * Markdown gövdenin İLK PARAGRAFI, düz metin — Mercek gönderisinin girişi.
 *
 * Başlıklar, `:::` blokları (yazının çizilen görselleri), liste ve tablo
 * satırları atlanır; bağlantı yalnız etiketiyle, kalın/italik işaretsiz
 * kalır. Paragraf ardışık düz satırların birleşimi; boş satırda biter.
 */
export function firstParagraph(bodyMd: string): string {
  const lines = bodyMd.split("\n");
  const out: string[] = [];
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith(":::")) {
      /* ":::tür" açar, tek başına ":::" kapatır. */
      inBlock = line !== ":::";
      if (out.length) break;
      continue;
    }
    if (inBlock) continue;
    if (!line) {
      if (out.length) break;
      continue;
    }
    if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>)/.test(line)) {
      if (out.length) break;
      continue;
    }
    out.push(line);
  }
  return out
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s("'“])[*_](?=\S)([^*_]+?)[*_](?=$|[\s.,;:!?)"'”])/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/**
 * Bloklardan mesaj kurar ve sınıra sığdırır.
 *
 * `head` ve `tail` her zaman kalır; `lists` içindeki satırlar sığmazsa
 * sondan düşer ve listenin yerine "+N" satırı girer. Hâlâ sığmıyorsa
 * `head`in son öğesi (gövde metni) kelime sınırında kısalır — `shrink`
 * o öğenin DÜZ metnini ve onu yeniden saran işlevi verir.
 */
export type MessageParts = {
  head: string[];
  lists: { title: string; rows: string[] }[];
  tail: string[];
  shrink?: { text: string; render: (text: string) => string };
};

function assemble(head: string[], lists: MessageParts["lists"], tail: string[]): string {
  const blocks = [
    head.join("\n"),
    ...lists.filter((list) => list.rows.length > 0).map((list) => [list.title, ...list.rows].join("\n")),
    tail.join("\n"),
  ];
  return blocks.filter(Boolean).join("\n\n");
}

export function fitMessage(parts: MessageParts, limit: number, more: (count: number) => string): string {
  let head = [...parts.head];
  const lists = parts.lists.map((list) => ({ ...list, rows: [...list.rows] }));
  const dropped = lists.map(() => 0);
  let text = assemble(head, lists, parts.tail);

  /* Önce listeler: en uzun listeden bir satır, "+N" ile. */
  while (text.length > limit) {
    let longest = -1;
    for (let i = 0; i < lists.length; i++) {
      const real = lists[i].rows.length - (dropped[i] > 0 ? 1 : 0);
      if (real > 0 && (longest < 0 || real > lists[longest].rows.length)) longest = i;
    }
    if (longest < 0) break;
    const list = lists[longest];
    if (dropped[longest] > 0) list.rows.pop();
    list.rows.pop();
    dropped[longest] += 1;
    list.rows.push(more(dropped[longest]));
    text = assemble(head, lists, parts.tail);
  }

  /* Sonra gövde metni. */
  if (text.length > limit && parts.shrink) {
    const over = text.length - limit;
    const room = Math.max(40, parts.shrink.text.length - over - 8);
    head = [...head.slice(0, -1), parts.shrink.render(clipText(parts.shrink.text, room))];
    text = assemble(head, lists, parts.tail);
  }

  /* Son güvence — buraya düşülmemeli; etiketi bölmeden düz metne iner. */
  if (text.length > limit) {
    const plain = text.replace(/<[^>]+>/g, "");
    text = tgEscape(clipText(plain.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"), limit - 64));
  }
  return text;
}

/** "{n}" yer tutucusu. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/** Saat ve dilim künyesi: "16:30 TR" / "09:30 NY". */
export function clockTag(at: Date, locale: Locale): string {
  return `${formatInZone(at, displayZone(locale))} ${zoneTag(locale).primary}`;
}

/* ---- Açılış öncesi ---- */

export type CalendarRow =
  | { kind: "event"; at: Date | null; title: string }
  | { kind: "earnings"; at: Date | null; window: string; symbols: string[] };

export type PreOpenInput = {
  locale: Locale;
  /** ET seans günü — başlığın tarihi. */
  date: string;
  openAt: Date;
  brief: { headline: string; summary: string; url: string } | null;
  /** null: takvim okunamadı — bölüm hiç basılmaz (boşluk iddiası yok). */
  calendar: CalendarRow[] | null;
  /** Takvim okundu ve gün gerçekten boş. */
  calendarEmpty: boolean;
  calendarUrl: string;
};

function calendarLine(row: CalendarRow, locale: Locale, t: TelegramLabels): string {
  if (row.kind === "event") {
    const time = row.at ? clockTag(row.at, locale) : t.timeUnknown;
    return `${tgEscape(time)} · ${tgEscape(row.title)}`;
  }
  /* Bilanço penceresinin dakikası bilinmiyor: "~" ve pencere adı (veri
     dürüstlüğü 1). */
  const time = row.at ? `~${clockTag(row.at, locale)}` : t.timeUnknown;
  const names = row.symbols.slice(0, EARNINGS_NAMES).join(" · ");
  const rest = row.symbols.length - EARNINGS_NAMES;
  return `${tgEscape(time)} · ${tgEscape(row.window)}: ${tgEscape(names)}${rest > 0 ? ` +${rest}` : ""}`;
}

export function formatPreOpen(input: PreOpenInput, t: TelegramLabels): string {
  const { locale } = input;
  const head = [
    `<b>${tgEscape(fill(t.preOpenTitle, { time: clockTag(input.openAt, locale) }))}</b> · ${tgEscape(formatEtDateLong(input.date, locale))}`,
  ];
  let shrink: MessageParts["shrink"];
  if (input.brief) {
    const { headline, url } = input.brief;
    const summary = clipText(input.brief.summary, LEAD_MAX_CHARS);
    head.push("", `<b>${tgEscape(t.briefTitle)}</b>`, `<i>${tgEscape(headline)}</i>`);
    const render = (text: string) => `${tgEscape(text)}\n${tgLink(url, t.readBrief)}`;
    head.push(render(summary));
    shrink = { text: summary, render };
  }
  const lists: MessageParts["lists"] = [];
  const tail: string[] = [];
  if (input.calendar && input.calendar.length > 0) {
    lists.push({
      title: `<b>${tgEscape(t.calendarTitle)}</b>`,
      rows: input.calendar.slice(0, LIST_MAX_ROWS).map((row) => calendarLine(row, locale, t)),
    });
    tail.push(tgLink(input.calendarUrl, t.openCalendar));
  } else if (input.calendar && input.calendarEmpty) {
    tail.push(`<b>${tgEscape(t.calendarTitle)}</b>`, tgEscape(t.calendarEmpty));
  }
  tail.push("", `<i>${tgEscape(t.disclaimer)}</i>`);
  return fitMessage({ head, lists, tail, shrink }, MESSAGE_LIMIT, (n) => tgEscape(fill(t.more, { n })));
}

/* ---- Kapanış ---- */

export type IndexClose = { label: string; symbol: string; close: number; changePct: number };
export type Mover = { symbol: string; changePct: number };

export type CloseInput = {
  locale: Locale;
  /** Tamamlanmış seansın ET günü. */
  date: string;
  closeAt: Date;
  indices: IndexClose[];
  /** null: sıralama eksik veriyle kurulamadı — bölüm basılmaz. */
  movers: { up: Mover[]; down: Mover[]; universe: number } | null;
  afterClose: string[];
  marketsUrl: string;
  earningsUrl: string;
};

const moverText = (row: Mover, locale: Locale) => `${row.symbol} ${formatPercent(row.changePct, locale)}`;

export function formatClose(input: CloseInput, t: TelegramLabels): string {
  const { locale } = input;
  const head = [
    `<b>${tgEscape(fill(t.closeTitle, { time: clockTag(input.closeAt, locale) }))}</b> · ${tgEscape(formatEtDateLong(input.date, locale))}`,
    "",
    `<b>${tgEscape(t.indicesTitle)}</b>`,
    ...input.indices.map(
      (row) =>
        `${tgEscape(row.label)} (${tgEscape(row.symbol)}) ${tgEscape(formatPrice(row.close, locale, { currency: true }))} · <b>${tgEscape(formatPercent(row.changePct, locale))}</b>`,
    ),
  ];
  const lists: MessageParts["lists"] = [];
  if (input.movers) {
    const up = input.movers.up.slice(0, MOVERS_PER_SIDE).map((row) => moverText(row, locale));
    const down = input.movers.down.slice(0, MOVERS_PER_SIDE).map((row) => moverText(row, locale));
    if (up.length) lists.push({ title: `<b>${tgEscape(t.gainersTitle)}</b>`, rows: [tgEscape(up.join(" · "))] });
    if (down.length) lists.push({ title: `<b>${tgEscape(t.losersTitle)}</b>`, rows: [tgEscape(down.join(" · "))] });
    if (up.length || down.length) {
      lists.push({ title: `<i>${tgEscape(fill(t.moversUniverse, { n: input.movers.universe }))}</i>`, rows: [] });
    }
  }
  const tail: string[] = [];
  if (input.afterClose.length > 0) {
    const names = input.afterClose.slice(0, EARNINGS_NAMES).join(" · ");
    const rest = input.afterClose.length - EARNINGS_NAMES;
    tail.push(`<b>${tgEscape(t.afterCloseTitle)}</b>`, `${tgEscape(names)}${rest > 0 ? ` +${rest}` : ""}`, tgLink(input.earningsUrl, t.openEarnings), "");
  }
  tail.push(tgLink(input.marketsUrl, t.openMarkets), "", `<i>${tgEscape(t.disclaimer)}</i>`);
  /* Başlıksız (satırsız) künye listesi `assemble`da düşerdi; evren notu
     sıralamanın hemen altında dursun diye son listenin satırı yapılır. */
  const universe = lists.findIndex((list) => list.rows.length === 0);
  if (universe > 0) {
    lists[universe - 1].rows.push(lists[universe].title);
    lists.splice(universe, 1);
  }
  return fitMessage({ head, lists, tail }, MESSAGE_LIMIT, (n) => tgEscape(fill(t.more, { n })));
}

/* ---- Mercek ---- */

export type StoryInput = { title: string; lead: string; url: string };

/** Foto altyazısı ise `limit` 1024, düz mesaj ise 4096. */
export function formatStory(input: StoryInput, t: TelegramLabels, limit: number = MESSAGE_LIMIT): string {
  const lead = clipText(input.lead, LEAD_MAX_CHARS);
  const render = (text: string) => (text ? `${tgEscape(text)}\n\n` : "") + tgLink(input.url, t.readStory);
  const head = [`<b>${tgEscape(t.storyKicker)}</b> · <b>${tgEscape(input.title)}</b>`, "", render(lead)];
  return fitMessage({ head, lists: [], tail: [], shrink: { text: lead, render } }, limit, (n) => tgEscape(fill(t.more, { n })));
}

/* ---- Makro veri ---- */

export type MacroInput = {
  locale: Locale;
  title: string;
  at: Date | null;
  actual: string;
  forecast?: string;
  previous?: string;
  url: string;
};

export function formatMacro(input: MacroInput, t: TelegramLabels): string {
  const figures = [
    `${tgEscape(t.actual)} <b>${tgEscape(input.actual)}</b>`,
    input.forecast ? `${tgEscape(t.forecast)} ${tgEscape(input.forecast)}` : null,
    input.previous ? `${tgEscape(t.previous)} ${tgEscape(input.previous)}` : null,
  ].filter(Boolean);
  const when = input.at ? ` · ${tgEscape(clockTag(input.at, input.locale))}` : "";
  const head = [`<b>${tgEscape(input.title)}</b>${when}`, figures.join(" · "), tgLink(input.url, t.openCalendar)];
  return fitMessage({ head, lists: [], tail: [] }, MESSAGE_LIMIT, (n) => tgEscape(fill(t.more, { n })));
}

/** Yönetim ekranındaki satırın adı — mesajın ilk satırının düz metni. */
export function postSummary(html: string, max = 120): string {
  const first = html.split("\n")[0] ?? "";
  const plain = first.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  return clipText(plain, max);
}
