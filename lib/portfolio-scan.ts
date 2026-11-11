import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { getAdmin } from "@/lib/admin";
import { verdictOf } from "@/lib/analysis";
import { memberClient } from "@/lib/claude-budget";
import { companySector } from "@/lib/company-sector";
import { getNewsForSymbol, getSymbolNames } from "@/lib/data";
import type { Locale } from "@/lib/i18n/config";
import { getPortfolioPositions } from "@/lib/portfolio-data";
import {
  checkPlans,
  checkScan,
  planLevels,
  ScanPlanSchema,
  type ScanPlan,
  INPUT_POSITIONS,
  scanInput,
  scanRows,
  ScanSchema,
  weightedChange,
  type ScanHoldingInput,
  type ScanRow,
  type ScanText,
} from "@/lib/portfolio-scan-model";
import { formatPrice } from "@/lib/utils";
import { callClaude, completedDailyBars, expectedLastSession, insightsConfigured, upcomingEarnings } from "@/lib/stock-insights";
import { getTechnicalBoard } from "@/lib/technical-data";

/**
 * GÜNLÜK PORTFÖY TARAMASI (10 Kasım) — eski "Portföyünün Kısa Okuması"nın
 * (lib/portfolio-note.ts, 18 Ekim) yerini aldı. O not üç maddeydi ve
 * yalnız ağırlık, beş seans ve bilanço tarihini okuyordu; sahibi "çok
 * detaylı çalışmalı" dedi. Tarama pozisyon başına beş girdiyi birleştiriyor:
 * son seans / beş seans / 21 seans değişimi ve maliyete göre getiri (tamam-
 * lanmış barlardan), üç aylık banttaki yer, yaklaşan bilanço (10 gün),
 * sitenin kendi teknik görüşü (yayımlanmışsa, /teknik-analiz), son 48 saatin
 * manşetleri. Çıktı: başlık, özet, en çok dört tema, en çok sekiz
 * pozisyon notu. Çizim sunucunun (lib/portfolio-scan-model.ts).
 *
 * HER GÜN, OKUR BAŞINA BİR KEZ. Önbellek anahtarı okur + tamamlanmış seans
 * + pozisyon parmak izi + dil: o günün ilk açılışı yazar, sonraki her
 * açılış (ana sayfa kartı, /portfoy) aynı kaydı okur; seans kapanınca yeni
 * gün yeni tarama. Önceden üretme (gece işi) bilerek yok: portföyüne
 * bakmayan okur için de ücret yazardı. Çağrı okurun bütçe kimliğiyle
 * (`memberClient`, lib/claude-budget.ts) ve küresel tavandan.
 *
 * Claude yazamazsa (anahtar yok, bütçe bitti, sayı ya da tavsiye denetimi)
 * ÇİZİM yine döner, metin `null`: okur kendi ölçülerini görür, cümle yok.
 */

export type PortfolioScan = {
  rows: ScanRow[];
  text: ScanText | null;
  /** Yalnız site sahibinin oturumunda dolu (kişisel plan); başka her okurda `null`. */
  plans: ScanPlan[] | null;
  portfolio: { day: number | null; fiveSession: number | null };
  session: string;
  covered: number;
  total: number;
  generatedAt: string;
};

const SYSTEM = {
  tr: `Açılış Zili'nde okurun KENDİ PORTFÖYÜNÜN günlük taramasını yazıyorsun. Okur her gün buraya bakıp "dün portföyümde ne oldu, bugün neye dikkat etmeliyim" sorusunun cevabını arıyor. Ayrıntılı ama sıkı yaz.

Çıktı:
- headline: günün tek cümlelik okuması, en çok 12 kelime, sonunda nokta yok. Portföyün son seansını ya da öne çıkan durumu söylesin.
- summary: 2-3 cümle, en çok 60 kelime: son seans ve 5 seansta portföy ne yaptı, bunu hangi pozisyonlar taşıdı, öne çıkan bir sonraki olay.
- themes: 3 ya da 4 tema. Her biri bir tür (kind): concentration (ağırlık ve ilk beşin payı), momentum (5 ve 21 seansta güçlenen/zayıflayan, 3 aylık bandın zirvesine/dibine yakın olanlar), calendar (yaklaşan bilançolar, gün ve zamanlamasıyla), technical (sitenin teknik görüşü olan pozisyonlar: görüş ve başlık), news (son manşetlerin portföydeki hisselere ilişkin söyledikleri), sector (sektör dağılımı), risk (birden çok pozisyonun aynı yönde hareketi, maliyetin çok altındaki pozisyonlar). Verisi olmayan türü yazma. title kısa ve Title Case (en çok 5 kelime); detail 2-3 cümle, somut: hisse adı ve verilen sayıyla.
- positions: ağırlığı en büyük pozisyonlardan en çok 8'i için birer not (note, en çok 28 kelime): o hissede son seans, 5 ve 21 seans, varsa bilanço tarihi, teknik görüş ya da manşet. Her not o hisseye özgü olsun; kalıp tekrar etme.

HUKUKİ ÇİZGİ (kesin): Türkiye'de kişiye özel al/sat önerisi SPK lisanslı yatırım danışmanlığıdır ve bu site lisanslı değildir. Hiçbir hisseyi almayı, satmayı, eklemeyi, azaltmayı, tutmayı ÖNERME; "almalısın", "satmalısın", "eklemelisin", "azaltmalısın", "çeşitlendirmelisin", "öneririm", "tavsiye ederim", "düşünebilirsin", "değerlendirebilirsin", "dikkatli olmalısın" gibi kalıplar YASAK; emir kipi yok. Gözlem yaz: ne oldu, ne zaman ne var, hangi ölçü ne gösteriyor. Sitenin teknik görüşünü aktarırken "sitenin teknik görüşü SAT" gibi KAYNAĞIYLA yaz, kendi önerin gibi değil.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, olay ya da sebep yazma; hesap yapma; manşette olmayan sebep uydurma. Sayıyı verilen biçimde aynen yaz.
- Fiyat yönü tahmini yok. Sakin, günlük Türkçe; "sen" diye hitap edebilirsin. Ünlem, emoji ve madde işareti yok. İngilizce manşeti Türkçe özetle.`,
  en: `You write the daily scan of the reader's OWN PORTFOLIO on Açılış Zili. The reader checks this every day to answer "what happened in my portfolio, what is coming up". Be detailed but tight.

Output:
- headline: one-sentence reading of the day, at most 12 words, no trailing period.
- summary: 2-3 sentences, at most 60 words: what the portfolio did over the last session and 5 sessions, which positions drove it, the next notable event.
- themes: 3 or 4 themes. Each has a kind: concentration (weights, top-five share), momentum (strengthening/weakening over 5 and 21 sessions, near the top/bottom of the 3-month range), calendar (upcoming earnings with day and timing), technical (positions with the site's technical view: stance and headline), news (what recent headlines say about the holdings), sector (sector mix), risk (several positions moving together, positions far below cost). Skip kinds with no data. title short, in Title Case (at most 5 words); detail 2-3 concrete sentences naming the stock and the given number.
- positions: a note (at most 28 words) for up to 8 of the largest positions: last session, 5 and 21 sessions, earnings date, technical view or headline if any. Each note specific to that stock; no boilerplate.

LEGAL LINE (strict): in Türkiye, personalised buy/sell advice is licensed investment advisory and this site is not licensed. Never recommend buying, selling, adding, trimming or holding anything; phrases like "you should", "I recommend", "consider buying/selling", "be careful" are FORBIDDEN; no imperatives. Write observations. When citing the site's technical view, attribute it ("the site's technical view is SELL"), never as your own advice.

Rules:
- Use ONLY the data given; no number, date, event or cause not given; no computation; never invent causes the headlines do not state. Copy numbers exactly as formatted.
- No price predictions. Calm, plain English; address the reader as "you". No exclamation marks, emoji or bullets.`,
} as const;

/* SAHİBİN KİŞİSEL PLANI — gerekçe lib/portfolio-scan-model.ts → "KİŞİSEL
   PLAN". Taramanın bütün kuralları + pozisyon başına açık görüş ve
   seviyeler. Hukuki çizgi burada bilinçli olarak YOK: metin yalnız site
   sahibine, kendi portföyü için basılıyor. */
const PLAN_SYSTEM = {
  tr: `${SYSTEM.tr.split("HUKUKİ ÇİZGİ")[0]}KİŞİSEL PLAN (bu metni yalnız portföyün sahibi okuyor ve açıkça görüşünü istiyor):
- plans: girdideki her pozisyon için bir plan. action: add (ekle), hold (tut), trim (azalt / kısmi kâr al), sell (sat). takeProfit: kâr alma seviyesi, stopLoss: zarar kesme seviyesi; ikisi de YALNIZ o pozisyonun allowedLevels listesinden, "level" değeri harfi harfine aynı yazılarak seçilir. takeProfit son kapanışın (lastClose) ÜSTÜNDE, stopLoss ALTINDA olmalı; uygun seviye yoksa null. rationale: 2-3 cümle, en çok 45 kelime: neden bu görüş ve bu seviyeler (teknik görüş, momentum, maliyete göre durum, bandaki yer, bilanço tarihi riski, ağırlık). Açık ve net yaz ("SNDK'de kârın bir kısmını almak mantıklı" gibi); kararsız kalıp yok.
- headline, summary, themes ve positions notlarında da görüş bildirebilirsin.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, olay ya da sebep yazma; hesap yapma (yüzde, hedef fiyat türetme yok). Sayıyı verilen biçimde aynen yaz.
- Kesin fiyat tahmini yok ("kesin yükselir" değil); görüşün gerekçesi veriden. Sakin, günlük Türkçe; "sen" diye hitap et. Ünlem, emoji, madde işareti yok.`,
  en: `${SYSTEM.en.split("LEGAL LINE")[0]}PERSONAL PLAN (only the portfolio's owner reads this and explicitly asks for your view):
- plans: one plan per position in the input. action: add, hold, trim (partial profit-taking), sell. takeProfit and stopLoss are chosen ONLY from that position's allowedLevels, copying "level" exactly. takeProfit must be ABOVE lastClose, stopLoss BELOW; null if none fits. rationale: 2-3 sentences, at most 45 words: why this view and these levels (technical view, momentum, position vs cost, place in the range, earnings-date risk, weight). Be clear and direct; no hedging boilerplate.
- You may state views in headline, summary, themes and position notes too.

Rules:
- Use ONLY the data given; no number, date, event or cause not given; no computation (no derived percentages or targets). Copy numbers exactly as formatted.
- No certain price predictions; ground every view in the data. Calm, plain English; address the reader as "you". No exclamation marks, emoji or bullets.`,
} as const;

const failures = new Map<string, number>();
const FAILURE_TTL = 20 * 60_000;
const NEWS_WINDOW_MS = 48 * 3600_000;

/* DIŞA AÇILDI (11 Kasım): "Portföyüne Sor" (lib/portfolio-question.ts)
   aynı pozisyon birleştirmesini, aynı veri toplamayı ve aynı gün
   biçimini kullanıyor; ikinci bir kopya iki ekranda aynı pozisyonun iki
   ayrı ağırlığını basabilirdi (veri dürüstlüğü 3). Davranış değişmedi. */
export type Holding = [string, { quantity: number; cost: number }];

export async function holdingsOf(userId: string): Promise<Holding[] | null> {
  const result = await getPortfolioPositions(userId);
  if (!result.ok || result.positions.length === 0) return null;
  /* Aynı hissenin lotları birleşir: adet toplanır, maliyet adetle ağırlıklı. */
  const holdings = new Map<string, { quantity: number; cost: number }>();
  for (const p of result.positions) {
    const h = holdings.get(p.symbol) ?? { quantity: 0, cost: 0 };
    holdings.set(p.symbol, { quantity: h.quantity + p.quantity, cost: h.cost + p.quantity * p.costUsd });
  }
  return [...holdings].sort(([a], [b]) => a.localeCompare(b));
}

export async function gather(holdings: Holding[], locale: Locale) {
  const symbols = holdings.map(([symbol]) => symbol);
  const [names, bars, ahead, board, news] = await Promise.all([
    getSymbolNames(symbols),
    Promise.all(symbols.map((symbol) => completedDailyBars(symbol).catch(() => null))),
    Promise.all(symbols.map((symbol) => upcomingEarnings(symbol))),
    getTechnicalBoard(),
    Promise.all(symbols.map((symbol) => getNewsForSymbol(symbol, 6).catch(() => []))),
  ]);
  const technical = new Map(board.map((entry) => [entry.row.symbol, entry.row]));
  const since = Date.now() - NEWS_WINDOW_MS;
  const inputs: ScanHoldingInput[] = holdings.map(([symbol, h], i) => {
    const tech = technical.get(symbol);
    const copy = tech ? (locale === "en" ? tech.copy.en ?? tech.copy.tr : tech.copy.tr) : null;
    const recent = news[i]!
      .filter((n) => n.publishedAt.getTime() >= since)
      .slice(0, 3)
      .map((n) => ({ headline: (locale === "tr" ? n.headlineTr : null) ?? n.headline, source: n.source ?? null }));
    return {
      symbol,
      name: names[symbol]?.name ?? symbol,
      sector: companySector(symbol, names[symbol]?.industry, locale),
      quantity: h.quantity,
      cost: h.cost,
      bars: bars[i] ?? [],
      earnings: ahead[i] ? { date: ahead[i]!.reportDate, timing: ahead[i]!.hour ?? null } : null,
      technical: tech ? { stance: verdictOf(tech.stance), headline: copy?.headline ?? null } : null,
      levels: tech
        ? { stop: tech.stop, entryLow: tech.entryLow, entryHigh: tech.entryHigh, targets: tech.targets, supports: tech.supports, resistances: tech.resistances }
        : null,
      news: recent,
    };
  });
  return inputs;
}

export function dayLabel(locale: Locale) {
  return (date: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

async function measure(holdings: Holding[], session: string, locale: Locale) {
  const inputs = await gather(holdings, locale);
  const rows = scanRows(inputs);
  if (rows.length < 1 || rows.length * 2 < holdings.length) throw new Error("bars");
  return { inputs, rows };
}

function scanOf(rows: ScanRow[], text: ScanText | null, session: string, total: number, plans: ScanPlan[] | null = null): PortfolioScan {
  return {
    rows,
    text,
    plans,
    portfolio: { day: weightedChange(rows, "day"), fiveSession: weightedChange(rows, "fiveSession") },
    session,
    covered: rows.length,
    total,
    generatedAt: new Date().toISOString(),
  };
}

async function buildScan(holdings: Holding[], session: string, locale: Locale, client: string, owner: boolean): Promise<PortfolioScan> {
  const { inputs, rows } = await measure(holdings, session, locale);
  let input = scanInput(rows, session, locale, dayLabel(locale), {
    newsBySymbol: new Map(inputs.map((h) => [h.symbol, h.news])),
    technicalBySymbol: new Map(inputs.map((h) => [h.symbol, h.technical?.headline ?? null])),
  });
  const symbols = rows.slice(0, INPUT_POSITIONS).map((r) => r.symbol);
  if (!owner) {
    const out = await callClaude(SYSTEM[locale], ScanSchema, input, client);
    if (!out) throw new Error("no-output");
    const checked = checkScan(out, input, symbols, locale);
    if (!checked.ok) throw new Error(checked.reason);
    return scanOf(rows, checked.text, session, holdings.length);
  }
  /* Sahip: aynı girdi + pozisyon başına son kapanış, ortalama maliyet ve
     seçilebilir seviyelerin listesi. */
  const price = (value: number) => formatPrice(value, locale, { currency: true, digits: 2 });
  const levelsOf = (row: ScanRow) => planLevels(row, price);
  const base = JSON.parse(input) as { positions: { symbol: string }[] } & Record<string, unknown>;
  const byRow = new Map(rows.map((r) => [r.symbol, r]));
  base.positions = base.positions.map((p) => {
    const row = byRow.get(p.symbol)!;
    return {
      ...p,
      lastClose: price(row.close),
      averageCost: row.averageCost === null ? null : price(row.averageCost),
      allowedLevels: levelsOf(row).map((l) => ({ level: l.label, kind: l.source })),
    };
  });
  input = JSON.stringify(base);
  const out = await callClaude(PLAN_SYSTEM[locale], ScanPlanSchema, input, client);
  if (!out) throw new Error("no-output");
  const checked = checkScan(out, input, symbols, locale, { adviceAllowed: true });
  if (!checked.ok) throw new Error(checked.reason);
  const plans = checkPlans(out.plans, rows.slice(0, INPUT_POSITIONS), levelsOf, input);
  return scanOf(rows, checked.text, session, holdings.length, plans);
}

export async function getPortfolioScan(userId: string, locale: Locale): Promise<PortfolioScan | null> {
  const holdings = await holdingsOf(userId);
  if (!holdings) return null;
  const session = await expectedLastSession();
  const fingerprint = createHash("sha256")
    .update(holdings.map(([s, h]) => `${s}:${h.quantity}:${h.cost.toFixed(4)}`).join("|"))
    .digest("hex")
    .slice(0, 16);
  const failKey = `${userId}:${locale}:${session}:${fingerprint}`;
  const failed = failures.get(failKey);
  /* Sahip planı yalnız `role = admin` oturumunda; anahtar ayrı ("plan"),
     iki kayıt asla karışmaz. */
  const owner = (await getAdmin())?.userId === userId;
  const textAllowed = insightsConfigured() && !(failed && Date.now() - failed < FAILURE_TTL);

  if (textAllowed) {
    try {
      return await unstable_cache(
        () => buildScan(holdings, session, locale, memberClient(userId), owner),
        ["portfolio-scan-v1", owner ? "plan" : "scan", userId, session, fingerprint, locale],
        { revalidate: 24 * 3600, tags: ["portfolio-scan"] },
      )();
    } catch (error) {
      failures.set(failKey, Date.now());
      console.error(`[portföy taraması] ${userId}: ${error instanceof Error ? error.message : "?"}`);
    }
  }
  /* Metinsiz yedek: ölçüler ve işaretler yine okurun. */
  try {
    const { rows } = await measure(holdings, session, locale);
    return scanOf(rows, null, session, holdings.length);
  } catch {
    return null;
  }
}
