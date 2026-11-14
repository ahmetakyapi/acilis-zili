import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { indexMemberOf } from "@/db/seed/indices";
import { selectNews } from "@/lib/ai-analysis-core";
import { CACHE_ONLY, ClaudeBudgetError, memberClient } from "@/lib/claude-budget";
import { getConsensusTarget } from "@/lib/analyst-target-data";
import { getEarningsForSymbol, getNextEarnings, getStatus, getSymbolNames } from "@/lib/data";
import { getSymbolDividends } from "@/lib/dividend-data";
import { annualYieldPct } from "@/lib/dividends";
import { epsSurprise, revenueSurprise } from "@/lib/earnings-week";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { addEtDays, boundedTtl, candleTtlSeconds, daysBetweenEt, todayEt } from "@/lib/market-hours";
import { barDate } from "@/lib/period-returns";
import { getQuotes } from "@/lib/providers";
import { getPeriodChanges } from "@/lib/providers/alpaca";
import { getCompanyNews, getKeyMetrics, getRecommendations } from "@/lib/providers/finnhub";
import { getRawMetrics } from "@/lib/providers/finnhub-depth";
import { MOMENTUM_SESSIONS, SCORECARD_MIN_PEERS, scoreCard, storedMetricsFrom, type ScoreSubject } from "@/lib/scorecard";
import {
  callClaude,
  completedDailyBars,
  expectedLastSession,
  getEarningsInsight,
  getMoveInsight,
  getPreviewInsight,
  type InsightText,
} from "@/lib/stock-insights";
import {
  ASK_SOURCES,
  citedNews,
  createQuestionQuota,
  decideAnswer,
  historyKey,
  questionKey,
  usedSources,
  type AskSource,
  type HistoryTurn,
  type QuotaStore,
} from "@/lib/stock-question-core";
import { MOVE_PCT_DIGITS, nearRangeEdge, rankSuggestions, type SuggestCopy, type Suggestion } from "@/lib/stock-question-suggest";
import { GROUNDING, NO_ADVICE, NUMBERS, UNTRUSTED_READER, VOICE } from "@/lib/claude-prompt-rules";
import { isTechnicalSymbol } from "@/lib/technical";
import { getTechnicalDetail } from "@/lib/technical-data";
import { getSectorMetrics } from "@/lib/symbol-metrics";
import { bandFiyatiKapsiyorMu, formatMoneyCompact, formatPercentPlain, formatPercentText, formatPrice, peRatioOf, safeExternalUrl } from "@/lib/utils";

/**
 * BU HİSSEYE SOR (24 Ekim, "sayfanın içinde Claude") — /hisse/[symbol]'da
 * okurun Türkçe ya da İngilizce sorusunu YALNIZ o sayfanın sunucuda
 * toplanan verisinden yanıtlar: son tamamlanmış seans, değerleme, skor
 * kartı, analist dağılımı, bilanço geçmişi ve sıradaki tarih, temettü, haber
 * başlıkları ve hissenin var olan Claude notları.
 *
 * YAZMA KATMANI KURALLARI (CLAUDE.md "Claude'un site içi notları"):
 * - Canlı kotasyon girdide YOK; fiyat ve yüzdeler son TAMAMLANMIŞ seansın
 *   barından (`completedDailyBars`). F/K ve 52 hafta bandı da o kapanışla
 *   kurulur; skor kartı, panelin kendisi gibi yalnız bayat olmayan
 *   kotasyonla (`ScorecardPanel`, aynı hesap).
 * - Modele yalnız okurun dilinde BİÇİMLENMİŞ sayı gider; yanıttaki her sayı
 *   girdide geçmek zorunda (`decideAnswer`, lib/stock-question-core.ts).
 *   Geçmezse yanıt okura GİTMEZ; okura dürüstçe "sayfadaki veriyle
 *   cevaplayamıyorum" denir.
 * - Al/sat sorusu kibarca geri çevrilir, veri anlatılır (`advice`). Çıktı
 *   ayrıca tavsiye denetiminden geçer (lib/advice-guard.ts, `decideAnswer`):
 *   yönlendirme kalıbı varsa yanıt basılmaz.
 * - Hissenin Claude notları yalnız ÖNBELLEKTEYSE girer (`CACHE_ONLY`):
 *   soru, notları yazdırıp bütçe harcatmaz.
 * - Soru ve haber metni güvenilmeyen metin; içlerindeki talimat izlenmez.
 *
 * MALİYET VE ERİŞİM: oturum ister; okur başına günde `QUESTION_DAILY_LIMIT`
 * soru ve `QUESTION_DAILY_MISSES` boşa giden deneme (`questionQuota`) ve çağrı okurun bütçe kimliğiyle (`memberClient`,
 * ortak günlük tavan — lib/claude-budget.ts). Aynı soru aynı seansta ve aynı
 * veriyle ikinci kez sorulursa yanıt önbellekten gelir ve HAK DÜŞMEZ (örnek
 * soru çipleri en çok bu yoldan geçer). Botlar uca hiç ulaşmaz
 * (app/api/ai/hisse-sor).
 */

export type AskAnswer = {
  kind: "answered" | "advice" | "unanswerable";
  /** Okura giden metin; `unanswerable`da null (arayüz sabit cümleyi basar). */
  text: string | null;
  sources: AskSource[];
  news: { headline: string; url: string; source: string | null }[];
  /** Verinin anlattığı son tamamlanmış seansın ET günü. */
  session: string;
};

type AskResult =
  | { ok: true; answer: AskAnswer; remaining: number }
  | { ok: false; reason: "quota" | "busy" | "budget" | "error"; remaining: number };

/* SAYAÇ `globalThis`TE. Turbopack üretim derlemesi sayfayı ve `/api` ucunu
   iki ayrı çalışma zamanına koyuyor, her birinin kendi modül önbelleği var
   (gerekçe lib/day-flow-data.ts): modül düzeyindeki bir Map'te uç hakkı
   düşerken panelin gösterdiği "kalan hak" hep 10 kalırdı. Aynı süreçteki
   iki çalışma zamanı aynı `globalThis`i görüyor. */
const shared = globalThis as typeof globalThis & { __azQuestionQuota?: QuotaStore; __azQuestionInflight?: Set<string> };
shared.__azQuestionQuota ??= new Map();
shared.__azQuestionInflight ??= new Set();

/** Okur kotası — süreç belleğinde (gerekçe lib/stock-question-core.ts). */
export const questionQuota = createQuestionQuota(shared.__azQuestionQuota);
/* Okur başına aynı anda tek soru: çift tıklama iki çağrı ve iki hak olmasın. */
const inflight = shared.__azQuestionInflight;

const NEWS_DAYS = 14;
const NEWS_LIMIT = 8;
const PAST_QUARTERS = 4;
const MOMENTUM_MIN_TTL_S = 60 * 60;
const ANSWER_TTL_S = 12 * 3600;
/**
 * Teknik analiz bloğu en çok bu kadar takvim günü eski olabilir (11 Kasım).
 * Rutin her seans yazıyor; uzun hafta sonu ya da tatil iki üç günü atlar.
 * Daha eskisi "bugünün teknik görünümü" değil: blok girmez, öneri sorusu da
 * çıkmaz (veri dürüstlüğü 5, yazma katmanı bayat veri kullanmaz).
 */
const TECHNICAL_MAX_AGE_DAYS = 7;
/** Destek/direnç listesinin girdiye giren ilk elemanları (yakından uzağa). */
const TECHNICAL_LEVELS = 3;

/* İSTEM (14 Kasım turu). Üç değişiklik:
   1. GİRDİ ŞEMASI anlatılıyor (blok blok, null = yok). Eski istem yalnız
      "technical" ve "target"ı tanımlıyordu; model `meanVersusLastClose` ya da
      `firstReaction` gibi alanların ne olduğunu addan çıkarıyordu.
   2. CEVAP İLK CÜMLEDE. 90 kelimelik yanıtlar "Şirketin son bilançosuna
      bakıldığında…" diye açılıp cevabı üçüncü cümleye bırakıyordu.
   3. YARIM VERİ "not_in_data" DEĞİL: sorunun bir kısmı veride varsa o kısım
      yanıtlanır, eksik tek cümleyle söylenir. Eski kuralda model iki parçalı
      soruda bütünü geri çeviriyordu.
   Ortak kurallar (yalnız veri, sayı yazımı, tavsiye, güvenilmeyen metin,
   dil) lib/claude-prompt-rules.ts'ten; örnek bilerek SAYISIZ. */
const SYSTEM = {
  tr: `Açılış Zili'nde (ABD hisselerini izleyen Türk bireysel yatırımcılar için bir site) bir hisse sayfasındaki "Bu Hisseye Sor" kutusunu yanıtlıyorsun. Okur piyasayı izleyen ama uzman olmayan biri; sorusunu YALNIZ verilen JSON'daki sayfa verisiyle yanıtla.

<girdi>
- question: okurun sorusu.
- previousTurns (varsa): aynı sohbetin önceki soru ve yanıtları. Yalnız yeni sorunun neye gönderme yaptığını anlamak için oku ("peki geçen çeyrek?"); önceki yanıtı tekrar etme.
- page: sayfanın verisi; sayılar okurun dilinde biçimlenmiş. null olan blok ya da alan YOK demektir.
  - session: son TAMAMLANMIŞ seans: kapanış, o seansın değişimi, son beş ve son yirmi seansın toplam değişimi, aynı seansta S&P 500. Canlı fiyat girdide yok.
  - technical: sitenin kendi teknik analizinin seviyeleri (destekler, dirençler, hareketli ortalamalar, RSI). Görüş içermez.
  - valuation: çarpanlar, net marj, borç/özsermaye, beta; week52Range bandın iki ucu ve son kapanışın uçlara uzaklığı (fromHigh, fromLow).
  - scorecard: sektör içi yüzdelikler; yüksek olan sektördeki daha çok şirketten iyi.
  - analysts: analistlerin görüş dağılımı. target: analistlerin ortalama hedefi ve son kapanışa uzaklığı (meanVersusLastClose). İkisi de analistlerin görüşüdür, senin değil.
  - earnings: açıklanan son çeyrekler, yeniden eskiye: gerçekleşen, beklenti, sürpriz. En yenisinde firstReaction varsa açıklamadan sonraki ilk seansın değişimidir.
  - nextEarnings: sıradaki bilançonun günü, zamanlaması ve beklentiler.
  - dividends: temettü. news: son haber başlıkları. notes: hissenin sitede hazır duran kısa notları.
</girdi>

<cikti>
- verdict: "answered" (veriyle yanıtlanıyor), "advice" (soru al/sat/tut, hedef fiyat ya da "yükselir mi" gibi bir tavsiye ya da tahmin istiyor), "not_in_data" (veride sorunun HİÇBİR kısmının karşılığı yok ya da soru bu hisseyle ilgili değil).
- answer: en çok 90 kelime, tek düz paragraf. İLK CÜMLE sorunun cevabıdır: evet/hayır, istenen sayı ya da "veride bu yok". Sonraki bir iki cümle dayanağı verir. Soruyu tekrar etme; "verilere göre", "bakıldığında" gibi girişle başlama; sorulmayan veriyi sıralama. Sorunun bir kısmı veride yoksa olan kısmı yanıtla, eksik olanı tek cümleyle söyle (verdict "answered"). "advice"ta ilk cümle kısa ret ("Tavsiye veremem."), ardından soruyla ilgili veri; okurun al/sat kipindeki sözlerini tekrar etme. "not_in_data"da boş bırak.
- sources: yanıtta gerçekten kullandığın blokların adları (session, technical, valuation, scorecard, analysts, target, earnings, nextEarnings, dividends, news, notes).
- newsCited: yararlandığın haberlerin "index" değerleri (yoksa boş).
</cikti>

<kurallar>
- ${GROUNDING.tr}
- ${NUMBERS.tr}
- ${NO_ADVICE.tr} Analist dağılımını, analist hedefini ve sitenin teknik seviyelerini KAYNAĞIYLA aktarmak serbest ("analistlerin ortalama hedefi", "sitenin teknik analizindeki destek"); kendi görüşün gibi yazma.
- "Neden" sorusunda sebebi yalnız news ya da notes'tan al. İkisi de hareketi açıklamıyorsa bunu açıkça söyle ve fiyat verisinin gösterdiğini anlat; sebep yakıştırma.
- ${UNTRUSTED_READER.tr}
- ${VOICE.tr} "Sen" diye hitap edebilirsin. Madde işareti ve başlık yok.
</kurallar>

<ornek>
Soru: "Son bilançoda beklentiyi aştı mı?"
Zayıf: "Şirketin son bilançosuna bakıldığında çeşitli göstergeler öne çıkıyor…" (cevap gecikiyor, dolgu cümlesi)
İyi: "Evet, hisse başına kâr piyasa beklentisinin üstünde geldi; gelir de beklentiyi aştı." Ardından gerçekleşen ve beklenen değerler, verideki yazımıyla.
</ornek>`,
  en: `You answer the "Ask About This Stock" box on a stock page of Açılış Zili (a site for Turkish individual investors following US stocks). The reader follows the market but is not a professional; answer the question using ONLY the page data in the supplied JSON.

<input>
- question: the reader's question.
- previousTurns (when present): earlier questions and answers in the same conversation. Read them only to understand what the new question refers to ("and the quarter before?"); do not repeat the earlier answer.
- page: the page data, with numbers formatted for the reader's language. A null block or field means the data does NOT exist.
  - session: the last COMPLETED session: close, that session's change, the total change over the last five and the last twenty sessions, the S&P 500 in the same session. There is no live price.
  - technical: levels from the site's own technical analysis (supports, resistances, moving averages, RSI). It carries no view.
  - valuation: multiples, net margin, debt to equity, beta; week52Range holds both ends of the range and how far the last close is from each (fromHigh, fromLow).
  - scorecard: percentiles within the sector; higher means better than more sector peers.
  - analysts: the split of analyst ratings. target: the analysts' average target and its distance from the last close (meanVersusLastClose). Both are the analysts' view, not yours.
  - earnings: the latest reported quarters, newest first: actual, estimate, surprise. When the newest has firstReaction, it is the change in the first session after the release.
  - nextEarnings: the day, timing and estimates of the next report.
  - dividends: dividends. news: recent headlines. notes: the short notes the site already holds on this stock.
</input>

<output>
- verdict: "answered" (the data answers it), "advice" (the question asks for buy/sell/hold advice, a price target or a prediction such as "will it go up"), "not_in_data" (the data covers NO part of the question, or the question is not about this stock).
- answer: at most 90 words, one plain paragraph. The FIRST SENTENCE is the answer: yes/no, the figure asked for, or "the data does not have this". The next one or two sentences give the basis. Do not restate the question; do not open with "based on the data" or "looking at"; do not list data nobody asked for. If only part of the question is covered, answer that part and say in one sentence what is missing (verdict "answered"). For "advice", open with a short refusal ("I can't give advice."), then give the data relevant to the question; do not repeat the reader's buy/sell wording. Leave it empty for "not_in_data".
- sources: names of the blocks you actually used (session, technical, valuation, scorecard, analysts, target, earnings, nextEarnings, dividends, news, notes).
- newsCited: the "index" values of the news items you used (empty if none).
</output>

<rules>
- ${GROUNDING.en}
- ${NUMBERS.en}
- ${NO_ADVICE.en} Reporting the analyst split, the analyst target and the site's technical levels WITH their source is fine ("the analysts' average target", "support in the site's technical analysis"); never as your own view.
- For a "why" question, take the cause only from news or notes. If neither explains the move, say so plainly and describe what the price data shows; do not assign a cause.
- ${UNTRUSTED_READER.en}
- ${VOICE.en} Address the reader as "you". No bullets or headings.
</rules>

<example>
Question: "Did it beat estimates last quarter?"
Weak: "Looking at the company's latest report, several indicators stand out…" (the answer is delayed; filler)
Good: "Yes, earnings per share came in above estimates, and revenue beat as well." Then the actual and expected values, exactly as formatted in the data.
</example>`,
} as const;

const Schema = z.object({
  verdict: z.enum(["answered", "advice", "not_in_data"]),
  answer: z.string(),
  sources: z.array(z.string()),
  newsCited: z.array(z.number().int()),
});

type NewsRef = { headline: string; url: string; source: string | null };
type Context = { input: string; grounding: string; available: Set<AskSource>; news: NewsRef[]; session: string };

/** Hissenin önbellekteki Claude notunun okurun dilindeki metni. */
const noteText = (text: { tr: InsightText; en: InsightText } | undefined, locale: Locale) =>
  text ? [text[locale].summary, ...text[locale].points.map((p) => `${p.title}: ${p.detail}`)].join(" ") : null;

/**
 * Sayfanın verisi, okurun dilinde biçimlenmiş. Her blok bağımsız düşer:
 * sağlayıcı yanıt vermezse o blok `null` ve künyeye giremez. Sayılar
 * kodda biçimlenir, model hiçbir şey hesaplamaz.
 */
async function buildContext(symbol: string, locale: Locale): Promise<Context> {
  const t = getDictionary(locale);
  const session = await expectedLastSession();
  const [names, bars, spy, metrics, recos, history, next, dividends, newsResult, move, earningsNote, preview, scorecard, technical, target] = await Promise.all([
    getSymbolNames([symbol]),
    completedDailyBars(symbol).catch(() => null),
    completedDailyBars("SPY").catch(() => null),
    getKeyMetrics(symbol).catch(() => null),
    getRecommendations(symbol).catch(() => null),
    getEarningsForSymbol(symbol, 8).catch(() => []),
    getNextEarnings(symbol).catch(() => null),
    getSymbolDividends(symbol).catch(() => null),
    getCompanyNews(symbol, addEtDays(todayEt(), -NEWS_DAYS), todayEt()).catch(() => null),
    getMoveInsight(symbol, CACHE_ONLY).catch(() => null),
    getEarningsInsight(symbol, CACHE_ONLY).catch(() => null),
    getPreviewInsight(symbol, CACHE_ONLY).catch(() => null),
    scorecardOf(symbol).catch(() => null),
    freshTechnical(symbol, session).catch(() => null),
    getConsensusTarget(symbol).catch(() => null),
  ]);
  const company = names[symbol]?.name ?? symbol;
  const currency = names[symbol]?.currency && names[symbol]!.currency !== "USD" ? names[symbol]!.currency! : null;
  const pct = (value: number, digits = 2) => formatPercentText(value, locale, digits);
  const usd = (value: number) => formatPrice(value, locale, { currency: true });
  const money = (value: number | null) => (value === null ? null : formatPrice(value, locale, { currency: currency ?? true }));
  const compact = (value: number | null) => (value === null ? null : formatMoneyCompact(value, locale, currency));
  const day = (date: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const timing = (hour: string | null | undefined) =>
    hour?.trim() === "bmo" ? (locale === "en" ? "before the open" : "açılış öncesi") : hour?.trim() === "amc" ? (locale === "en" ? "after the close" : "kapanış sonrası") : null;

  /* Son tamamlanmış seans — fiyatın tek kaynağı. */
  const closes = bars?.map((bar) => bar.close) ?? [];
  const close = closes.at(-1) ?? null;
  const change = (back: number) => (closes.length > back && closes[closes.length - 1 - back]! > 0 ? ((close! - closes[closes.length - 1 - back]!) / closes[closes.length - 1 - back]!) * 100 : null);
  const spyAligned = spy && bars && barDate(spy[spy.length - 1]!) === barDate(bars[bars.length - 1]!);
  const spyChange = spyAligned && spy.length > 1 ? ((spy[spy.length - 1]!.close - spy[spy.length - 2]!.close) / spy[spy.length - 2]!.close) * 100 : null;
  const sessionBlock =
    bars && close !== null
      ? {
          lastCompletedSession: day(barDate(bars[bars.length - 1]!)),
          close: usd(close),
          sessionChange: change(1) === null ? null : pct(change(1)!),
          /* Çok seanslı toplamlar TEK ondalıklı (14 Kasım): öneri hapı aynı
             yüzdeyi aynı yazımla soruyor ("neden %12,7 düştü"); model soruda
             gördüğü sayıyı tekrar ederse girdide karşılığı olsun
             (`MOVE_PCT_DIGITS`, lib/stock-question-suggest.ts). */
          last5Sessions: change(5) === null ? null : pct(change(5)!, MOVE_PCT_DIGITS),
          last20Sessions: change(20) === null ? null : pct(change(20)!, MOVE_PCT_DIGITS),
          sp500SameSession: spyChange === null ? null : pct(spyChange),
        }
      : null;

  /* Değerleme — MetricsCard'ın kuralları, fiyat yerine son kapanış. ADR'de
     (para birimi dolar değil) mutlak tutarlar ana borsanın parasında: F/K
     sağlayıcının kendi oranı, 52 hafta bandı hiç girmez. */
  const m = metrics?.ok ? metrics.data : null;
  const { consistent, pe, band } = multiplesOf(m, close, currency);
  const valuation = m
    ? {
        priceToEarningsTtm: pe ? formatPrice(pe, locale) : null,
        forwardPriceToEarnings: m.forwardPe ? formatPrice(m.forwardPe, locale) : null,
        earningsPerShareTtm: consistent && m.eps !== null ? money(m.eps) : null,
        dividendYield: m.dividendYield !== null && m.dividendYield !== undefined ? formatPercentPlain(m.dividendYield, locale, 2) : null,
        netMargin: m.netMarginPct !== null && m.netMarginPct !== undefined ? formatPercentPlain(m.netMarginPct, locale, 1) : null,
        debtToEquity: m.debtToEquity !== null && m.debtToEquity !== undefined ? formatPrice(m.debtToEquity, locale) : null,
        beta: m.beta ? formatPrice(m.beta, locale) : null,
        /* Uçlara uzaklık KODDA hesaplanır (14 Kasım): "zirvesine ne kadar
           yakın" sorusunda model iki fiyattan yüzde çıkaramaz (hesap yasak,
           çıkarsa sayı denetimi düşürür). */
        week52Range:
          band && close !== null
            ? {
                label: locale === "en" ? "52-week range" : "52 haftalık bant",
                low: usd(band.low),
                high: usd(band.high),
                fromHigh: pct(((close - band.high) / band.high) * 100, 1),
                fromLow: pct(((close - band.low) / band.low) * 100, 1),
              }
            : null,
      }
    : null;

  const latestReco = recos?.ok ? recos.data[0] : undefined;
  const analysts = latestReco
    ? {
        period: latestReco.period,
        collectedFor: latestReco.symbol && latestReco.symbol.toUpperCase() !== symbol ? latestReco.symbol : null,
        strongBuy: latestReco.strongBuy,
        buy: latestReco.buy,
        hold: latestReco.hold,
        sell: latestReco.sell,
        strongSell: latestReco.strongSell,
        total: latestReco.strongBuy + latestReco.buy + latestReco.hold + latestReco.sell + latestReco.strongSell,
      }
    : null;

  const verdict = (s: ReturnType<typeof epsSurprise>) => (s ? { direction: s.direction, surprise: s.ratio === null ? null : pct(s.ratio * 100) } : null);
  const reported = history.filter((row) => row.epsActual !== null && row.reportDate <= todayEt()).slice(0, PAST_QUARTERS);
  /* İlk tepki seansı yalnız EN YENİ bilançoda (14 Kasım): "hisse bilançoya
     nasıl tepki verdi" sorusunun yanıtı. Bilanço notuyla aynı kural
     (`firstReactionOf`); seans henüz kapanmadıysa alan null. */
  const reaction = reported[0] ? firstReactionOf(bars, reported[0]) : null;
  const earnings = reported.length
    ? reported.map((row, i) => ({
        ...(i === 0 ? { firstReaction: reaction ? { session: day(reaction.date), closeToClose: pct(reaction.pct) } : null } : {}),
        reportDate: day(row.reportDate),
        fiscalPeriod: row.quarter && row.year ? `Q${row.quarter} ${row.year}` : null,
        eps: { actual: money(row.epsActual), estimate: money(row.epsEstimate), verdict: verdict(epsSurprise(row.epsActual, row.epsEstimate)) },
        revenue: { actual: compact(row.revenueActual), estimate: compact(row.revenueEstimate), verdict: verdict(revenueSurprise(row.revenueActual, row.revenueEstimate)) },
      }))
    : null;
  const nextEarnings =
    next && next.epsActual === null
      ? {
          reportDate: day(next.reportDate),
          timing: timing(next.hour),
          fiscalPeriod: next.quarter && next.year ? `Q${next.quarter} ${next.year}` : null,
          consensusEps: money(next.epsEstimate),
          consensusRevenue: compact(next.revenueEstimate),
        }
      : null;

  /* Temettü — tutar dolar (Alpaca kaydı); verim son kapanışla, canlı fiyatla değil. */
  const regular = dividends?.ok ? dividends.past.filter((item) => !item.special) : [];
  const lastPaid = regular.at(-1) ?? null;
  const dividendYield = dividends?.ok && lastPaid ? annualYieldPct(lastPaid, dividends.frequency, close) : null;
  const dividendBlock =
    dividends?.ok && (lastPaid || dividends.next)
      ? {
          paymentsPerYear: dividends.frequency,
          lastRegular: lastPaid ? { exDate: day(lastPaid.exDate), perShare: usd(lastPaid.rate) } : null,
          next: dividends.next ? { exDate: day(dividends.next.exDate), perShare: usd(dividends.next.rate), lastDayToBuy: dividends.nextLastBuy ? day(dividends.nextLastBuy) : null } : null,
          annualYieldAtLastClose: dividendYield === null ? null : formatPercentPlain(dividendYield, locale, 2),
        }
      : dividends?.ok
        ? { paysDividend: false }
        : null;

  const newsItems = newsResult?.ok ? selectNews(newsResult.data, symbol, company, NEWS_LIMIT) : [];
  const linked = newsItems.flatMap((item) => {
    const url = safeExternalUrl(item.url);
    return url ? [{ headline: item.headline, url, source: item.source, date: day(item.publishedAt.toISOString().slice(0, 10)) }] : [];
  });
  const news: NewsRef[] = linked.map(({ headline, url, source }) => ({ headline, url, source }));
  const newsBlock = linked.length ? linked.map((item, index) => ({ index, headline: item.headline, source: item.source, date: item.date })) : null;

  const notes = {
    thisWeeksMove: move ? noteText(move.text, locale) : null,
    latestEarnings: earningsNote ? noteText(earningsNote.text, locale) : null,
    earningsPreview: preview ? noteText(preview.text, locale) : null,
  };
  const notesBlock = notes.thisWeeksMove || notes.latestEarnings || notes.earningsPreview ? notes : null;

  const scorecardBlock = scorecard?.length
    ? {
        meaning: locale === "en" ? "percentile within the sector, 0–100; higher means better than more sector peers" : "sektör içi yüzdelik, 0–100; yüksek, sektördeki daha çok şirketten iyi demek",
        axes: scorecard.map((axis) => ({ axis: t.stockDepth.scAxes[axis.axis], percentile: axis.percentile, peers: axis.peers })),
      }
    : null;

  /* Teknik (11 Kasım): seviyeler ve ortalamalar. Görüş (AL/TUT/SAT), giriş
     bölgesi, stop ve hedefler GİRMEZ: üyeye açık kutuda model onları
     "sitenin önerisi" diye aktarırdı, tavsiye denetiminin konusu. Fiyat da
     girmez: anlık görüntünün fiyatı seans içinde yazılmış olabilir. */
  const technicalBlock = technical
    ? {
        analysisSession: day(technical.sessionDate),
        supports: technical.supports.slice(0, TECHNICAL_LEVELS).map(usd),
        resistances: technical.resistances.slice(0, TECHNICAL_LEVELS).map(usd),
        movingAverage50: technical.snapshot.sma50 ? usd(technical.snapshot.sma50) : null,
        movingAverage200: technical.snapshot.sma200 ? usd(technical.snapshot.sma200) : null,
        rsi14: typeof technical.snapshot.rsi14 === "number" ? formatPrice(technical.snapshot.rsi14, locale) : null,
      }
    : null;
  /* Analist hedefi (11 Kasım): en çok on günlük ortalama
     (lib/analyst-target-data.ts); son kapanışa uzaklığı kodda hesaplanır,
     model hesap yapmaz. Tutar kotasyon parasında (ADR'de dolar, şema notu). */
  const targetBlock = target
    ? {
        asOf: day(target.asOf),
        mean: usd(target.mean),
        median: target.median ? usd(target.median) : null,
        high: target.high ? usd(target.high) : null,
        low: target.low ? usd(target.low) : null,
        analystCount: target.analystCount,
        meanVersusLastClose: close !== null && close > 0 ? pct(((target.mean - close) / close) * 100) : null,
        source: target.source,
      }
    : null;

  const blocks: Record<AskSource, unknown> = {
    session: sessionBlock,
    technical: technicalBlock,
    valuation,
    scorecard: scorecardBlock,
    analysts,
    target: targetBlock,
    earnings,
    nextEarnings,
    dividends: dividendBlock,
    news: newsBlock,
    notes: notesBlock,
  };
  const available = new Set(ASK_SOURCES.filter((key) => blocks[key] !== null));
  const payload = { symbol, company, today: day(todayEt()), ...blocks };
  /* Sayı denetiminin metni haber dizinsiz (gerekçe `decideAnswer`). */
  const grounding = JSON.stringify({ ...payload, news: newsBlock?.map((item) => ({ headline: item.headline, source: item.source, date: item.date })) ?? null });
  return { input: JSON.stringify(payload), grounding, available, news, session };
}

type MetricsLike = { eps: number | null; peRatio?: number | null; forwardPe?: number | null; low52?: number | null; high52?: number | null } | null;

/**
 * F/K ve 52 hafta bandı — `buildContext` ve öneri soruları AYNI kuralı
 * kullansın diye tek yerde: bant son kapanışı kapsamıyorsa (bayat ölçü)
 * F/K da bant da girmez; ADR'de F/K sağlayıcının oranı, bant hiç yok.
 */
function multiplesOf(m: MetricsLike, close: number | null, currency: string | null) {
  const consistent = Boolean(m) && (currency !== null || bandFiyatiKapsiyorMu(close, m!.low52, m!.high52));
  const pe = m && consistent ? (currency ? (m.peRatio ?? null) : peRatioOf(close, m.eps)) : null;
  const band = m && consistent && !currency && m.low52 && m.high52 ? { low: m.low52, high: m.high52 } : null;
  return { consistent, pe, band };
}

/**
 * Bilançonun ilk tepki seansı: açılış öncesi açıklamada aynı gün, kapanış
 * sonrasında ertesi seans; saati bilinmiyorsa aynı gün (bilanço notunun
 * kuralı, lib/stock-insights.ts → `getEarningsInsightOnce`). Seans
 * tamamlanmış barlarda yoksa null.
 */
function firstReactionOf(bars: Awaited<ReturnType<typeof completedDailyBars>>, row: { reportDate: string; hour: string | null }) {
  if (!bars) return null;
  const index = bars.findIndex((bar) => (row.hour?.trim() === "amc" ? barDate(bar) > row.reportDate : barDate(bar) >= row.reportDate));
  if (index <= 0 || !(bars[index - 1]!.close > 0)) return null;
  return { date: barDate(bars[index]!), pct: ((bars[index]!.close - bars[index - 1]!.close) / bars[index - 1]!.close) * 100 };
}

/** Sitenin teknik analizi: yalnız kapsamdaki sembolde ve en çok `TECHNICAL_MAX_AGE_DAYS` eskiyse. */
async function freshTechnical(symbol: string, session: string) {
  if (!isTechnicalSymbol(symbol)) return null;
  const detail = await getTechnicalDetail(symbol);
  if (!detail || daysBetweenEt(detail.row.sessionDate, session) > TECHNICAL_MAX_AGE_DAYS) return null;
  return detail.row;
}

/** Skor kartı — ScorecardPanel'in hesabı (tabloya yazmadan). Endeks üyesi değilse ya da sektör dolmadıysa null. */
async function scorecardOf(symbol: string) {
  const sector = indexMemberOf(symbol)?.sector;
  if (!sector) return null;
  const [rows, raw, meta, status] = await Promise.all([getSectorMetrics(sector), getRawMetrics(symbol), getSymbolNames([symbol]), getStatus()]);
  if (!rows) return null;
  const own = rows.find((row) => row.symbol === symbol);
  const ownMetrics = raw.ok ? storedMetricsFrom(raw.data) : own?.metrics ?? null;
  const peerRows = rows.filter((row) => row.symbol !== symbol);
  if (!ownMetrics || peerRows.length < SCORECARD_MIN_PEERS) return null;
  const universe = [symbol, ...peerRows.map((row) => row.symbol)];
  const [quotes, momentum] = await Promise.all([
    getQuotes(universe, status),
    getPeriodChanges(universe, MOMENTUM_SESSIONS, boundedTtl(Math.max(candleTtlSeconds("6M", status), MOMENTUM_MIN_TTL_S), status)),
  ]);
  /* Bayat kotasyon değerlemeye girmez (panelle aynı kural). */
  if (!quotes.ok || quotes.stale) return null;
  const subjectOf = (s: string, currency: string | null, metrics: ScoreSubject["metrics"]): ScoreSubject => ({
    symbol: s,
    currency,
    metrics,
    price: quotes.data[s]?.price ?? null,
    momentum: momentum.ok ? (momentum.data[s] ?? null) : null,
  });
  return scoreCard(
    subjectOf(symbol, meta[symbol]?.currency ?? null, ownMetrics),
    peerRows.map((row) => subjectOf(row.symbol, row.currency, row.metrics)),
  );
}

/**
 * Okurun sorusu. Kota ve uçuştaki soru burada; uç (app/api/ai/hisse-sor)
 * kimlik, köken, bot ve sembol denetimini yapmış olarak çağırır.
 */
export async function askStock(userId: string, symbol: string, question: string, locale: Locale, history: readonly HistoryTurn[] = []): Promise<AskResult> {
  const remaining = () => questionQuota.left(userId);
  if (remaining() <= 0) return { ok: false, reason: "quota", remaining: 0 };
  if (inflight.has(userId)) return { ok: false, reason: "busy", remaining: remaining() };
  inflight.add(userId);
  /* Geri çağrı modelden çıktı aldıysa Claude'a gidildi demek; önbellekten
     gelen yanıtta hak düşmez (yukarıdaki MALİYET notu). */
  let wrote = false;
  try {
    const context = await buildContext(symbol, locale);
    const contextHash = createHash("sha256").update(context.input).digest("hex").slice(0, 16);
    const answer = await unstable_cache(
      async (): Promise<AskAnswer> => {
        const input = { question, ...(history.length ? { previousTurns: history } : {}), page: JSON.parse(context.input) };
        const out = await callClaude(SYSTEM[locale], Schema, JSON.stringify(input), memberClient(userId));
        wrote = true;
        if (!out) throw new Error("no-output");
        const decision = decideAnswer(out, context.grounding, locale);
        /* Denetimden düşen yanıt ÖNBELLEĞE GİRMEZ ve hak düşmez: okur
           sabit cümleyi görür, aynı soruyu sonra yeniden sorabilir. Deneme
           boşa giden sayacına yazılır (aşağıda, `miss`). */
        if (!decision.charge) {
          throw new UngroundedAnswer(decision.kind === "unanswerable" ? decision.reason : "empty", decision.kind === "unanswerable" ? (decision.missing ?? []) : []);
        }
        const sources = decision.kind === "unanswerable" ? [] : usedSources(out.sources, context.available);
        const news = decision.kind === "unanswerable" ? [] : citedNews(out.newsCited, context.news.length).map((i) => context.news[i]!);
        return { kind: decision.kind, text: decision.kind === "unanswerable" ? null : decision.text, sources, news, session: context.session };
      },
      /* v2 (24 Ekim): tavsiye denetimi eklendi — v1'de önbelleğe girmiş,
         denetimden geçmemiş yanıt yeni koda gitmesin.
         v3 (11 Kasım): istem teknik/hedef bloklarını ve sohbet geçmişini
         tanıyor; geçmiş anahtarın son parçası. Geçmişsiz soruda boş dize:
         bölümün ilk soruları (öneri hapları) okurlar arasında paylaşılmaya
         devam eder (gerekçe lib/stock-question-core.ts → "Sohbet geçmişi"). */
      /* v4 (14 Kasım): istem yeniden yazıldı (cevap ilk cümlede, girdi
         şeması, yarım veride "answered"); girdiye `firstReaction` ve 52
         hafta uzaklıkları girdi, çok seanslı yüzdeler tek ondalık. */
      ["stock-question-v4", symbol, locale, context.session, contextHash, questionKey(question, locale), historyKey(history, locale)],
      { revalidate: ANSWER_TTL_S, tags: ["stock-question"] },
    )();
    if (wrote) questionQuota.charge(userId);
    return { ok: true, answer, remaining: remaining() };
  } catch (error) {
    if (error instanceof UngroundedAnswer) {
      questionQuota.miss(userId);
      console.error(`[hisseye sor] ${symbol}: ${error.reason} (${error.missing.join(" ")})`);
      const session = await expectedLastSession().catch(() => "");
      return { ok: true, answer: { kind: "unanswerable", text: null, sources: [], news: [], session }, remaining: remaining() };
    }
    if (error instanceof ClaudeBudgetError) return { ok: false, reason: "budget", remaining: remaining() };
    /* Claude'a gidildi ama çıktı gelmedi (boş/şemasız): çağrı ödendi, boşa
       giden deneme. API hatasında çağrının ödenip ödenmediği bilinmiyor;
       sayılmaz. */
    if (wrote) questionQuota.miss(userId);
    console.error(`[hisseye sor] ${symbol}: ${error instanceof Error ? error.message : "?"}`);
    return { ok: false, reason: "error", remaining: remaining() };
  } finally {
    inflight.delete(userId);
  }
}

class UngroundedAnswer extends Error {
  constructor(
    readonly reason: string,
    readonly missing: string[],
  ) {
    super(reason);
  }
}

/**
 * Öneri soruları (11 Kasım) — sayfa çizilirken, Claude çağrısı OLMADAN.
 * Gerekçe ve sıra kuralı lib/stock-question-suggest.ts. Buradaki her
 * okuma sayfanın kendi panellerinin de sorduğu önbellekli yükleyici
 * (bilanço takvimi, son seans barları, teknik analiz, analist hedefi ve
 * dağılımı, skor kartı, temettü) ve `buildContext`le AYNI kural: öneri
 * ancak yanıtın dayanacağı blok girdiye girecekse çıkar. Bir okuma düşerse
 * yalnız o konunun sorusu düşer; hepsi düşerse liste boş ve kutu hap
 * basmaz (14 Kasım: sabit örnek yedeği kalktı, gerekçe
 * lib/stock-question-suggest.ts).
 */
export async function stockSuggestions(symbol: string, locale: Locale, copy: SuggestCopy): Promise<Suggestion[]> {
  const session = await expectedLastSession().catch(() => null);
  const [next, bars, technical, target, recos, scorecard, metrics, history, dividends, names, newsResult] = await Promise.all([
    getNextEarnings(symbol).catch(() => null),
    completedDailyBars(symbol).catch(() => null),
    session ? freshTechnical(symbol, session).catch(() => null) : null,
    getConsensusTarget(symbol).catch(() => null),
    getRecommendations(symbol).catch(() => null),
    scorecardOf(symbol).catch(() => null),
    getKeyMetrics(symbol).catch(() => null),
    getEarningsForSymbol(symbol, 8).catch(() => []),
    getSymbolDividends(symbol).catch(() => null),
    getSymbolNames([symbol]).catch(() => ({}) as Awaited<ReturnType<typeof getSymbolNames>>),
    getCompanyNews(symbol, addEtDays(todayEt(), -NEWS_DAYS), todayEt()).catch(() => null),
  ]);
  const today = todayEt();
  const closes = bars?.map((bar) => bar.close) ?? [];
  const close = closes.at(-1) ?? null;
  const base = closes.length > 5 ? closes[closes.length - 6]! : 0;
  const m = metrics?.ok ? metrics.data : null;
  const currency = names[symbol]?.currency && names[symbol]!.currency !== "USD" ? names[symbol]!.currency! : null;
  const { pe, band } = multiplesOf(m, close, currency);
  const reported = history.filter((row) => row.epsActual !== null && row.reportDate <= today);
  const upcoming = next && next.epsActual === null ? next : null;
  const regular = dividends?.ok ? dividends.past.filter((item) => !item.special) : [];
  const lastPaid = regular.at(-1) ?? null;
  /* `buildContext`in haber bloğuyla aynı süzgeç: bağlantısı güvenli olmayan haber girdiye girmez. */
  const hasNews = Boolean(
    newsResult?.ok && selectNews(newsResult.data, symbol, names[symbol]?.name ?? symbol, NEWS_LIMIT).some((item) => safeExternalUrl(item.url)),
  );
  return rankSuggestions(
    {
      earningsInDays: upcoming ? daysBetweenEt(today, upcoming.reportDate) : null,
      hasConsensus: Boolean(upcoming && (upcoming.epsEstimate !== null || upcoming.revenueEstimate !== null)),
      reportedDaysAgo: reported[0] ? daysBetweenEt(reported[0].reportDate, today) : null,
      hasEarningsReaction: Boolean(reported[0] && firstReactionOf(bars, reported[0])),
      /* `buildContext` → `last5Sessions` ile aynı pencere (beş adım, altı kapanış). */
      movePct: base > 0 && close !== null ? ((close - base) / base) * 100 : null,
      /* Nedeni anlatacak tek kaynak haber başlıkları; hazır not da onlardan yazılıyor. */
      hasMoveEvidence: hasNews,
      near52: band ? nearRangeEdge(close, band.low, band.high) : null,
      /* Soru "destek ve direnç nerede" diyor: seviye listesi boşsa (yalnız ortalamalar varsa) sorulmaz. */
      hasTechnical: Boolean(technical && (technical.supports.length > 0 || technical.resistances.length > 0)),
      hasTarget: target !== null,
      hasAnalysts: Boolean(recos?.ok && recos.data[0]),
      hasScorecard: Boolean(scorecard?.length),
      hasValuation: Boolean(pe || m?.forwardPe),
      hasPastEarnings: reported.length > 0,
      paysDividend: Boolean(dividends?.ok && (lastPaid || dividends.next)),
      hasDividendYield: Boolean(
        (dividends?.ok && lastPaid && annualYieldPct(lastPaid, dividends.frequency, close) !== null) ||
          (m && m.dividendYield !== null && m.dividendYield !== undefined && m.dividendYield > 0),
      ),
      hasNews,
      hasBeta: Boolean(m?.beta),
      hasSession: closes.length > 1,
    },
    copy,
    (abs) => formatPercentPlain(abs, locale, MOVE_PCT_DIGITS),
  );
}
