import "server-only";
import { and, gte, inArray, lte } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getAdmin } from "@/lib/admin";
import { analysisHref, verdictOf } from "@/lib/analysis";
import { memberClient } from "@/lib/claude-budget";
import { getHolidays, getStatus, getSymbolNames, guncelBilanco } from "@/lib/data";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import { addEtDays, type MarketHoliday } from "@/lib/market-hours";
import { barDate } from "@/lib/period-returns";
import {
  buildCard,
  checkDesk,
  checkViews,
  deskInput,
  DeskPlanSchema,
  DeskSchema,
  deskSignature,
  pickDeskRows,
  type DeskBar,
  type DeskCalendarRow,
  type DeskCard,
  type DeskFormatters,
  type DeskText,
  type DeskView,
} from "@/lib/portfolio-earnings-desk-model";
import { getPortfolioPositions } from "@/lib/portfolio-data";
import { planLevels, scanRows, type ScanHoldingInput, type ScanRow } from "@/lib/portfolio-scan-model";
import { getChartBars } from "@/lib/providers";
import { earningsAnalyses, earningsCalendar } from "@/lib/schema";
import { callClaude, completedDailyBars, expectedLastSession, insightsConfigured } from "@/lib/stock-insights";
import { getTechnicalBoard } from "@/lib/technical-data";
import { formatMoneyCompact, formatPercentText, formatPrice } from "@/lib/utils";

/**
 * BİLANÇO MASASI — sunucu tarafı (11 Kasım, sahibinin isteği). Saf hesap ve
 * kartın tanımı lib/portfolio-earnings-desk-model.ts; uç
 * app/api/ai/bilanco-masasi; arayüz components/portfolio/EarningsDesk.tsx.
 *
 * MASA BOŞSA CLAUDE ÇAĞRILMAZ. Önce yalnız veritabanı: portföy sembollerinin
 * takvim satırları. Önümüzdeki üç seansta açıklayacak ya da son üç seansta
 * açıklamış pozisyon yoksa `null` döner — bar, teknik, Claude hiçbiri
 * istenmez; bileşen hiçbir şey basmaz.
 *
 * OKUR BAŞINA GÜNDE TEK ÇAĞRI, bütün masa tek çağrıda. Önbellek anahtarı
 * okur + tamamlanmış seans + masadaki semboller ve rapor tarihleri + dil
 * (+ sahipte "plan"). EVRE (öncesi/sonrası) ANAHTARDA BİLEREK YOK: sabah
 * açılış öncesi açıklayan hisse gün içinde "öncesi"nden "sonrası"na geçer;
 * anahtarda olsaydı aynı gün ikinci çağrı yazılırdı. Bunun yerine ÇİZİM her
 * istekte tazeden hesaplanır (DB + önbellekli barlar), METİN önbellekten
 * gelir ve her not yazıldığı evreyi taşır: evre değiştiyse o kartın notu
 * basılmaz (kartın ölçüleri gerçekleşeni gösterir), ertesi seans yeni not.
 *
 * HİSSE SAYFASININ BİLANÇO NOTU YENİDEN ÜRETİLMEZ. "Son Bilançonun Kısa
 * Notu" (lib/stock-insights.ts → getEarningsInsight) sembol başına ayrı
 * bir çağrı; masadan onu çağırmak beş hisselik portföyde beş çağrı daha
 * demekti (önbellekte değilse — nöbet yalnız öne çıkan ve endeks
 * üyelerini ısıtıyor). Masa aynı veriyi (takvim + tamamlanmış barlar)
 * kendisi okuyor, notu kendi tek çağrısında yazıyor; kart hisse sayfasına
 * ve varsa sitenin bilanço analizine bağlanıyor.
 *
 * SİTE SAHİBİ: kart başına bilanço anı görüşü (Tut / Azalt / Ekle) ve
 * seviye yalnız sunucunun listesinden (`planLevels`). Kural ve gerekçe
 * taramanın Kişisel Planı (lib/portfolio-scan.ts → PLAN_SYSTEM); tavsiye
 * denetimi yalnız orada kapalı, sayı denetimi açık.
 */

export type EarningsDesk = {
  cards: DeskCard[];
  /** Başlık, evresi değişmiş bir not düştüyse `null` (eski durumu anlatabilir). */
  text: (Omit<DeskText, "headline"> & { headline: string | null }) | null;
  /** Yalnız site sahibinin oturumunda dolu; başka her okurda `null`. */
  views: DeskView[] | null;
  session: string;
  generatedAt: string;
};

const SYSTEM = {
  tr: `Açılış Zili'nde okurun KENDİ PORTFÖYÜNDEKİ hisselerin bilançoları için "Bilanço Masası" notlarını yazıyorsun. Her kart bir pozisyon; iki evre var:
- phase "upcoming": bilanço önümüzdeki seanslarda. Not: ne zaman (gün ve pencere: açılış öncesi / kapanış sonrası; "bell" verilmişse zilin saati), beklenti (HBK ve gelir), son çeyreklerde beklentiyi aşma/kaçırma geçmişi ve ilk tepkiler, pozisyonun ağırlığı ve son 5/21 seansı.
- phase "reported": bilanço açıklandı. Not: gerçekleşen ile beklenti (HBK ve gelir, sürprizleriyle), ilk tepki (verilmişse; "bekleniyor" ise tepkinin henüz oluşmadığını söyle), pozisyonun ağırlığı.

Çıktı:
- headline: masanın tek cümlelik okuması, en çok 14 kelime, sonunda nokta yok (ör. hangi pozisyon ne zaman açıklıyor ya da ne oldu).
- cards: girdideki HER kart için bir not (note), 2-3 cümle, en çok 50 kelime, o hisseye özgü; kalıp tekrar etme.

HUKUKİ ÇİZGİ (kesin): Türkiye'de kişiye özel al/sat önerisi SPK lisanslı yatırım danışmanlığıdır ve bu site lisanslı değildir. Hiçbir hisseyi almayı, satmayı, eklemeyi, azaltmayı, tutmayı ÖNERME; "almalısın", "satmalısın", "eklemelisin", "azaltmalısın", "öneririm", "tavsiye ederim", "düşünebilirsin", "değerlendirebilirsin", "dikkatli olmalısın" gibi kalıplar YASAK; emir kipi yok. Gözlem yaz.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, olay, rehberlik ya da sebep yazma; hesap yapma. Sayıyı verilen biçimde aynen yaz. null olan değer bilinmiyor; biliniyormuş gibi anma.
- Şirketin beklentiyi aşıp aşmayacağını ya da hissenin nasıl tepki vereceğini TAHMİN ETME.
- Sakin, günlük Türkçe; "sen" diye hitap edebilirsin. Ünlem, emoji, madde işareti yok.`,
  en: `You write the "Earnings Desk" notes on Açılış Zili for the earnings of stocks in the reader's OWN PORTFOLIO. Each card is one position, in one of two phases:
- phase "upcoming": reports in the coming sessions. Note: when (day and window: before the open / after the close; the bell time if given), the estimates (EPS and revenue), the record of beating or missing in recent quarters and the first reactions, the position's weight and its last 5/21 sessions.
- phase "reported": has reported. Note: actual vs estimate (EPS and revenue, with surprises), the first reaction (if given; if "pending", say the reaction has not formed yet), the position's weight.

Output:
- headline: one-sentence reading of the desk, at most 14 words, no trailing period.
- cards: one note for EVERY card in the input, 2-3 sentences, at most 50 words, specific to that stock; no boilerplate.

LEGAL LINE (strict): in Türkiye, personalised buy/sell advice is licensed investment advisory and this site is not licensed. Never recommend buying, selling, adding, trimming or holding anything; phrases like "you should", "I recommend", "consider buying/selling", "be careful" are FORBIDDEN; no imperatives. Write observations.

Rules:
- Use ONLY the data given; no number, date, event, guidance or cause not given; no computation. Copy numbers exactly as formatted. A null value is unknown; never mention it as if known.
- Never predict whether the company will beat or miss, or how the stock will react.
- Calm, plain English; address the reader as "you". No exclamation marks, emoji or bullets.`,
} as const;

/* SAHİBİN GÖRÜŞÜ — taramanın PLAN_SYSTEM'i ile aynı sözleşme: hukuki çizgi
   bilerek yok (metin yalnız site sahibine, kendi portföyü için). */
const PLAN_SYSTEM = {
  tr: `${SYSTEM.tr.split("HUKUKİ ÇİZGİ")[0]}KİŞİSEL GÖRÜŞ (bu metni yalnız portföyün sahibi okuyor ve bilanço anı için açıkça görüşünü istiyor):
- views: girdideki her kart için bir görüş. action: add (ekle), hold (tut), trim (azalt / kısmi kâr al). "upcoming" kartta bilanço ÖNCESİ pozisyonla ne yapılmalı (ağırlık, son seanslar, sürpriz geçmişi, maliyete göre durum); "reported" kartta açıklama SONRASI. takeProfit: kâr alma seviyesi, stopLoss: zarar kesme seviyesi; ikisi de YALNIZ o kartın allowedLevels listesinden, "level" değeri harfi harfine aynı yazılarak seçilir. takeProfit son kapanışın (lastClose) ÜSTÜNDE, stopLoss ALTINDA; uygun seviye ya da allowedLevels yoksa null. rationale: 2-3 cümle, en çok 45 kelime, açık ve net; kararsız kalıp yok.
- Notlarda da görüş bildirebilirsin.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, olay ya da sebep yazma; hesap yapma (yüzde, hedef fiyat türetme yok). Sayıyı verilen biçimde aynen yaz.
- Kesin fiyat tahmini yok; görüşün gerekçesi veriden. Sakin, günlük Türkçe; "sen" diye hitap et. Ünlem, emoji, madde işareti yok.`,
  en: `${SYSTEM.en.split("LEGAL LINE")[0]}PERSONAL VIEW (only the portfolio's owner reads this and explicitly asks for your view around earnings):
- views: one view per card in the input. action: add, hold, trim (partial profit-taking). For "upcoming" cards, what to do with the position BEFORE the report (weight, recent sessions, surprise record, position vs cost); for "reported" cards, AFTER it. takeProfit and stopLoss are chosen ONLY from that card's allowedLevels, copying "level" exactly; takeProfit ABOVE lastClose, stopLoss BELOW; null if none fits or no allowedLevels. rationale: 2-3 sentences, at most 45 words, clear and direct.
- You may state views in the notes too.

Rules:
- Use ONLY the data given; no number, date, event or cause not given; no computation (no derived percentages or targets). Copy numbers exactly as formatted.
- No certain price predictions; ground every view in the data. Calm, plain English; address the reader as "you". No exclamation marks, emoji or bullets.`,
} as const;

const failures = new Map<string, number>();
const FAILURE_TTL = 20 * 60_000;

async function holdingsOf(userId: string): Promise<Map<string, { quantity: number; cost: number }> | null> {
  const result = await getPortfolioPositions(userId);
  if (!result.ok || result.positions.length === 0) return null;
  /* Aynı hissenin lotları birleşir — taramanın kuralı (lib/portfolio-scan.ts → holdingsOf). */
  const holdings = new Map<string, { quantity: number; cost: number }>();
  for (const p of result.positions) {
    const h = holdings.get(p.symbol) ?? { quantity: 0, cost: 0 };
    holdings.set(p.symbol, { quantity: h.quantity + p.quantity, cost: h.cost + p.quantity * p.costUsd });
  }
  return holdings;
}

const CAL_COLUMNS = {
  symbol: earningsCalendar.symbol,
  reportDate: earningsCalendar.reportDate,
  hour: earningsCalendar.hour,
  epsEstimate: earningsCalendar.epsEstimate,
  epsActual: earningsCalendar.epsActual,
  revenueEstimate: earningsCalendar.revenueEstimate,
  revenueActual: earningsCalendar.revenueActual,
  quarter: earningsCalendar.quarter,
  year: earningsCalendar.year,
};

/** Masanın aday satırları: tamamlanmış seansın bir hafta öncesinden on gün sonrasına. Okunamazsa boş (masa basılmaz). */
async function calendarRows(symbols: string[], session: string): Promise<DeskCalendarRow[]> {
  try {
    return await db
      .select(CAL_COLUMNS)
      .from(earningsCalendar)
      .where(
        and(
          inArray(earningsCalendar.symbol, symbols),
          gte(earningsCalendar.reportDate, addEtDays(session, -7)),
          lte(earningsCalendar.reportDate, addEtDays(session, 10)),
          guncelBilanco,
        ),
      );
  } catch {
    return [];
  }
}

/** Öncesi kartlarının geçmiş çeyrekleri: son ~13 ay. */
async function pastRows(symbols: string[], session: string): Promise<DeskCalendarRow[]> {
  if (symbols.length === 0) return [];
  try {
    return await db
      .select(CAL_COLUMNS)
      .from(earningsCalendar)
      .where(
        and(
          inArray(earningsCalendar.symbol, symbols),
          gte(earningsCalendar.reportDate, addEtDays(session, -400)),
          lte(earningsCalendar.reportDate, session),
          guncelBilanco,
        ),
      );
  } catch {
    return [];
  }
}

/** Sonrası kartlarına sitenin bilanço analizi: rapor tarihinin üç gün yakınında, önce okurun dili. */
async function analysisLinks(cards: { symbol: string; reportDate: string }[], locale: Locale): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (cards.length === 0) return out;
  try {
    const dates = cards.map((c) => c.reportDate).sort();
    const rows = await db
      .select({ symbol: earningsAnalyses.symbol, period: earningsAnalyses.period, locale: earningsAnalyses.locale, reportDate: earningsAnalyses.reportDate })
      .from(earningsAnalyses)
      .where(
        and(
          inArray(earningsAnalyses.symbol, cards.map((c) => c.symbol)),
          gte(earningsAnalyses.reportDate, addEtDays(dates[0]!, -3)),
          lte(earningsAnalyses.reportDate, addEtDays(dates[dates.length - 1]!, 3)),
        ),
      );
    for (const card of cards) {
      const near = rows.filter(
        (r) => r.symbol === card.symbol && r.reportDate >= addEtDays(card.reportDate, -3) && r.reportDate <= addEtDays(card.reportDate, 3),
      );
      const pick = near.find((r) => r.locale === locale) ?? near[0];
      if (pick) out.set(card.symbol, analysisHref(pick.symbol, pick.period));
    }
  } catch {
    /* Analiz bağlantısı süs değil ama zorunlu da değil: okunamazsa kart bağlantısız. */
  }
  return out;
}

/** Bir yıllık TAMAMLANMIŞ seans barları (geçmiş çeyreklerin tepkisi için); olmazsa üç aylık. */
async function deskBars(symbol: string, session: string): Promise<DeskBar[]> {
  const toDesk = (bars: { time: number; close: number }[]) => bars.map((b) => ({ date: barDate(b), close: b.close })).filter((b) => b.date <= session);
  try {
    const result = await getChartBars(symbol, "1Y", await getStatus());
    if (result.ok && !result.stale) {
      const bars = toDesk(result.data);
      if (bars.length > 0 && bars[bars.length - 1]!.date === session) return bars;
    }
  } catch {
    /* üç aylık yedeğe düş */
  }
  const fallback = await completedDailyBars(symbol).catch(() => null);
  return fallback ? toDesk(fallback) : [];
}

function formatters(locale: Locale): DeskFormatters {
  return {
    pct: (value, digits = 1) => formatPercentText(value, locale, digits),
    share: (value) => `${locale === "en" ? "" : "%"}${Math.round(value)}${locale === "en" ? "%" : ""}`,
    money: (value, currency) => formatPrice(value, locale, { currency: currency ?? true }),
    compact: (value, currency) => formatMoneyCompact(value, locale, currency),
    day: (date) =>
      new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
        new Date(`${date}T12:00:00Z`),
      ),
  };
}

async function measure(userId: string, locale: Locale, holidays: MarketHoliday[]) {
  const holdings = await holdingsOf(userId);
  if (!holdings) return null;
  const session = await expectedLastSession();
  const symbols = [...holdings.keys()].sort();
  const picked = pickDeskRows(await calendarRows(symbols, session), new Set(symbols), session, holidays);
  /* Masa boş: bar yok, teknik yok, Claude yok. */
  if (picked.length === 0) return { session, cards: [] as DeskCard[], rows: [] as ScanRow[] };

  const deskSymbols = picked.map((p) => p.row.symbol);
  const beforeSymbols = picked.filter((p) => p.phase === "before").map((p) => p.row.symbol);
  const [names, threeMonth, board, yearBars, past, links] = await Promise.all([
    getSymbolNames(deskSymbols),
    Promise.all(symbols.map((s) => completedDailyBars(s).catch(() => null))),
    getTechnicalBoard(),
    Promise.all(deskSymbols.map((s) => deskBars(s, session))),
    pastRows(beforeSymbols, session),
    analysisLinks(picked.filter((p) => p.phase === "after").map((p) => ({ symbol: p.row.symbol, reportDate: p.row.reportDate })), locale),
  ]);
  /* Ağırlık bütün portföyün içinde: ölçüler taramanın saf hesabından
     (scanRows), aynı tamamlanmış barlarla — iki panelde aynı pozisyonun
     iki farklı ağırlığı durmasın (veri dürüstlüğü 3). */
  const technical = new Map(board.map((entry) => [entry.row.symbol, entry.row]));
  const inputs: ScanHoldingInput[] = symbols.map((symbol, i) => {
    const h = holdings.get(symbol)!;
    const tech = technical.get(symbol);
    return {
      symbol,
      name: symbol,
      sector: null,
      quantity: h.quantity,
      cost: h.cost,
      bars: threeMonth[i] ?? [],
      earnings: null,
      technical: tech ? { stance: verdictOf(tech.stance), headline: null } : null,
      levels: tech
        ? { stop: tech.stop, entryLow: tech.entryLow, entryHigh: tech.entryHigh, targets: tech.targets, supports: tech.supports, resistances: tech.resistances }
        : null,
      news: [],
    };
  });
  const rows = scanRows(inputs);
  const byRow = new Map(rows.map((r) => [r.symbol, r]));
  const cards = picked.map((p, i) =>
    buildCard(
      {
        picked: p,
        name: names[p.row.symbol]?.name ?? p.row.symbol,
        currency: names[p.row.symbol]?.currency && names[p.row.symbol]!.currency !== "USD" ? names[p.row.symbol]!.currency! : null,
        past: past.filter((r) => r.symbol === p.row.symbol),
        bars: yearBars[i]!,
        row: byRow.get(p.row.symbol) ?? null,
        analysisHref: links.get(p.row.symbol) ?? null,
      },
      holidays,
      locale,
    ),
  );
  return { session, cards, rows };
}

type DeskTextResult = { text: DeskText; views: DeskView[] | null };

async function writeText(cards: DeskCard[], rows: ScanRow[], session: string, locale: Locale, client: string, owner: boolean): Promise<DeskTextResult> {
  const f = formatters(locale);
  if (!owner) {
    const input = deskInput(cards, session, locale, f);
    const out = await callClaude(SYSTEM[locale], DeskSchema, input, client);
    if (!out) throw new Error("no-output");
    const checked = checkDesk(out, input, cards, locale);
    if (!checked.ok) throw new Error(checked.reason);
    return { text: checked.text, views: null };
  }
  const price = (value: number) => formatPrice(value, locale, { currency: true, digits: 2 });
  const levelsOf = (row: ScanRow) => planLevels(row, price);
  const byRow = new Map(rows.map((r) => [r.symbol, r]));
  const levels = new Map(
    cards.flatMap((c) => {
      const row = byRow.get(c.symbol);
      if (!row) return [];
      return [[c.symbol, { lastClose: price(row.close), averageCost: row.averageCost === null ? null : price(row.averageCost), allowed: levelsOf(row).map((l) => ({ level: l.label, kind: l.source })) }]] as const;
    }),
  );
  const input = deskInput(cards, session, locale, f, { levels });
  const out = await callClaude(PLAN_SYSTEM[locale], DeskPlanSchema, input, client);
  if (!out) throw new Error("no-output");
  const checked = checkDesk(out, input, cards, locale, { adviceAllowed: true });
  if (!checked.ok) throw new Error(checked.reason);
  return { text: checked.text, views: checkViews(out.views, cards, rows, levelsOf, input) };
}

export async function getEarningsDesk(userId: string, locale: Locale): Promise<EarningsDesk | null> {
  const holidays = await getHolidays();
  const measured = await measure(userId, locale, holidays);
  if (!measured) return null;
  const { session, cards, rows } = measured;
  const base: EarningsDesk = { cards, text: null, views: null, session, generatedAt: new Date().toISOString() };
  if (cards.length === 0) return base;

  const owner = (await getAdmin())?.userId === userId;
  const signature = deskSignature(cards);
  const failKey = `${userId}:${locale}:${session}:${signature}:${owner ? "plan" : "desk"}`;
  const failed = failures.get(failKey);
  if (!insightsConfigured() || (failed && Date.now() - failed < FAILURE_TTL)) return base;
  try {
    const result = await unstable_cache(
      () => writeText(cards, rows, session, locale, memberClient(userId), owner),
      ["earnings-desk-v1", owner ? "plan" : "desk", userId, session, signature, locale],
      { revalidate: 24 * 3600, tags: ["earnings-desk"] },
    )();
    /* Not yazıldığı evreyi taşır: sabah "öncesi" yazılan not, bilanço
       düştükten sonra basılmaz (gerekçe dosya başında). Görüş de aynı. */
    const phase = new Map(cards.map((c) => [c.symbol, c.phase]));
    const notes = Object.fromEntries(Object.entries(result.text.notes).filter(([symbol, n]) => phase.get(symbol) === n.phase));
    const live = new Set(Object.keys(notes));
    return {
      ...base,
      text:
        live.size > 0
          ? { headline: live.size === Object.keys(result.text.notes).length ? result.text.headline : null, notes }
          : null,
      views: owner && result.views ? result.views.filter((v) => live.has(v.symbol)) : null,
    };
  } catch (error) {
    failures.set(failKey, Date.now());
    console.error(`[bilanço masası] ${userId}: ${error instanceof Error ? error.message : "?"}`);
    return base;
  }
}
