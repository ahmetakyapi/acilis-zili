import { z } from "zod";
import { adviceMatches } from "@/lib/advice-guard";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import { epsSurprise, revenueSurprise } from "@/lib/earnings-week";
import type { Locale } from "@/lib/i18n/config";
import { closeMinutesFor, nextTradingDay, prevTradingDay, SESSION_BOUNDS, isTradingDay, type MarketHoliday } from "@/lib/market-hours";
import { checkPlans, type PlanLevel, type ScanPlan, type ScanRow } from "@/lib/portfolio-scan-model";
import { clockOf, timePair } from "@/lib/session-clock";

/**
 * BİLANÇO MASASI — saf hesap (11 Kasım, sahibinin isteği: okurun
 * PORTFÖYÜNDEKİ hisselerin bilançoları için Claude notları).
 *
 * İki an, tek masa:
 *  - ÖNCESİ: portföydeki hisse önümüzdeki üç seans içinde açıklayacak —
 *    tarih ve pencere (açılış öncesi / kapanış sonrası, zilin saati TR
 *    önce), takvimdeki HBK ve gelir beklentisi, son dört çeyreğin sürprizi
 *    ve ilk tepkisi, pozisyonun ağırlığı, 5 ve 21 seans.
 *  - SONRASI: son üç tamamlanmış seansta açıklamış — gerçekleşen ile
 *    beklenti, ilk tepki (yalnız TAMAMLANMIŞ seans; tepki seansı henüz
 *    kapanmadıysa "bekleniyor"), sitenin bilanço analizi varsa bağlantısı.
 *
 * Portfolyo taramasının (lib/portfolio-scan-model.ts) bölüşümü aynen: ÇİZİM
 * (kartın ölçüleri) burada sunucunun hesabıyla, Claude yalnız METNİ yazıyor.
 * Model bir sayı uydursa çizim yanılmaz, metin sayı denetiminden düşer.
 * Veritabanına ve sağlayıcıya dokunmaz; okuma `lib/portfolio-earnings-desk.ts`.
 *
 * NEDEN "SEANS", GÜN DEĞİL: bilanço kapanıştan sonra açıklanırsa ilk tepki
 * ertesi İŞLEM gününde. Cuma akşamı açıklayan hisse için "üç gün içinde"
 * hafta sonunu sayar, okur pazartesinin tepkisini kaçırırdı. Pencere tepki
 * seansıyla tanımlı (`reactionSession`), tatil takvimi dahil.
 */

export type DeskTiming = "bmo" | "amc" | "dmh" | null;
export type DeskPhase = "before" | "after";

/** `earnings_calendar` satırının masanın okuduğu kısmı. */
export type DeskCalendarRow = {
  symbol: string;
  reportDate: string;
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number | null;
  year: number | null;
};

export type DeskBar = { date: string; close: number };

export type DeskFigure = {
  estimate: number | null;
  actual: number | null;
  direction: "beat" | "miss" | "inline" | null;
  /** Sürpriz oranı (0,042 = %4,2); yön "inline" ya da payda sıfıra yakınsa null. */
  ratio: number | null;
};

export type DeskQuarter = {
  label: string;
  reportDate: string;
  direction: "beat" | "miss" | "inline";
  ratio: number | null;
  /** İlk tepki seansının kapanıştan kapanışa değişimi, yüzde; bar yoksa null. */
  reaction: number | null;
};

export type DeskCard = {
  symbol: string;
  name: string;
  phase: DeskPhase;
  reportDate: string;
  timing: DeskTiming;
  /** Zilin saati okurun birincil saatiyle (TR'de İstanbul): açılış öncesinde açılış, kapanış sonrasında kapanış. Pencere bilinmiyorsa null. */
  bell: string | null;
  /** İlk tepkinin seansı (ET günü). */
  reactionSession: string;
  fiscal: string | null;
  /** Rakamların para birimi (ISO); dolarsa null. */
  currency: string | null;
  eps: DeskFigure;
  revenue: DeskFigure;
  /** Öncesi: son dört çeyrek, eskiden yeniye. Sonrası: boş. */
  history: DeskQuarter[];
  /** Sonrası: ilk tepki (tamamlanmış seans). Seans kapanmadıysa null + `reactionPending`. */
  reaction: { session: string; pct: number } | null;
  reactionPending: boolean;
  weight: number | null;
  fiveSession: number | null;
  month: number | null;
  sinceCost: number | null;
  analysisHref: string | null;
};

/** Masada en çok kaç kart (yoğun bilanço haftasında bile tek ekran). */
export const DESK_MAX_CARDS = 6;
/** Pencere: önümüzdeki / son üç seans. */
export const DESK_SESSIONS = 3;

export function normalizeTiming(hour: string | null | undefined): DeskTiming {
  return hour === "bmo" || hour === "amc" || hour === "dmh" ? hour : null;
}

/**
 * İlk tepkinin seansı: kapanış sonrasında ertesi işlem günü, açılış öncesi /
 * seans içi / saati bilinmeyende o gün (tatil ya da hafta sonuysa sonraki
 * işlem günü). Kural hisse sayfasının bilanço notuyla aynı
 * (lib/stock-insights.ts → getEarningsInsightOnce).
 */
export function reactionSession(reportDate: string, hour: string | null, holidays: MarketHoliday[]): string {
  if (normalizeTiming(hour) === "amc") return nextTradingDay(reportDate, holidays);
  return isTradingDay(reportDate, holidays) ? reportDate : nextTradingDay(reportDate, holidays);
}

/** Son tamamlanmış seanstan sonraki ve o dahil önceki üç seans. */
export function deskSessions(session: string, holidays: MarketHoliday[]): { upcoming: string[]; recent: string[] } {
  const upcoming: string[] = [];
  let cursor = session;
  for (let i = 0; i < DESK_SESSIONS; i++) upcoming.push((cursor = nextTradingDay(cursor, holidays)));
  const recent = [session];
  cursor = session;
  for (let i = 1; i < DESK_SESSIONS; i++) recent.push((cursor = prevTradingDay(cursor, holidays)));
  return { upcoming, recent };
}

const announced = (row: DeskCalendarRow) => row.epsActual !== null || row.revenueActual !== null;

/**
 * Satırın masadaki yeri. Açıklanmamış ve tepki seansı önümüzdeki üç seans
 * içinde → öncesi. Açıklanmış ve tepki seansı son üç tamamlanmış seansta →
 * sonrası (tepki biliniyor); açıklanmış ama tepki seansı henüz kapanmamış →
 * sonrası, tepki bekleniyor. Tepki seansı geçmiş ama gerçekleşen düşmemişse
 * söylenecek bir şey yok: satır elenir.
 */
export function classifyRow(
  row: DeskCalendarRow,
  session: string,
  holidays: MarketHoliday[],
): { phase: DeskPhase; reactionSession: string; pending: boolean } | null {
  const reaction = reactionSession(row.reportDate, row.hour, holidays);
  const { upcoming, recent } = deskSessions(session, holidays);
  const last = upcoming[upcoming.length - 1]!;
  const ahead = reaction > session && reaction <= last;
  if (!announced(row)) return ahead ? { phase: "before", reactionSession: reaction, pending: true } : null;
  if (ahead) return { phase: "after", reactionSession: reaction, pending: true };
  if (recent.includes(reaction)) return { phase: "after", reactionSession: reaction, pending: false };
  return null;
}

/**
 * Portföy sembolleri için masanın satırları: sembol başına bir satır
 * (önce sonrası — olan biten bekleyenden önce gelir; sonra tepki seansına
 * en yakın olan), en çok `DESK_MAX_CARDS`. Sıra: sonrası en yeniden eskiye,
 * öncesi en yakından uzağa.
 */
export function pickDeskRows(
  rows: readonly DeskCalendarRow[],
  symbols: ReadonlySet<string>,
  session: string,
  holidays: MarketHoliday[],
): { row: DeskCalendarRow; phase: DeskPhase; reactionSession: string; pending: boolean }[] {
  const best = new Map<string, { row: DeskCalendarRow; phase: DeskPhase; reactionSession: string; pending: boolean }>();
  for (const row of rows) {
    if (!symbols.has(row.symbol)) continue;
    const c = classifyRow(row, session, holidays);
    if (!c) continue;
    const current = best.get(row.symbol);
    const better =
      !current ||
      (c.phase === "after" && current.phase === "before") ||
      (c.phase === current.phase &&
        (c.phase === "after" ? c.reactionSession > current.reactionSession : c.reactionSession < current.reactionSession));
    if (better) best.set(row.symbol, { row, ...c });
  }
  const order = (a: { phase: DeskPhase; reactionSession: string }, b: { phase: DeskPhase; reactionSession: string }) =>
    a.phase !== b.phase
      ? a.phase === "after" ? -1 : 1
      : a.phase === "after"
        ? b.reactionSession.localeCompare(a.reactionSession)
        : a.reactionSession.localeCompare(b.reactionSession);
  return [...best.values()].sort((a, b) => order(a, b) || a.row.symbol.localeCompare(b.row.symbol)).slice(0, DESK_MAX_CARDS);
}

/**
 * İlk tepki: tepki seansının kapanışı / bir önceki seansın kapanışı. Barlar
 * yalnız TAMAMLANMIŞ seanslar (çağıran süzer); tepki seansı barlarda yoksa null.
 */
export function reactionOf(bars: readonly DeskBar[], reportDate: string, hour: string | null): { session: string; pct: number } | null {
  const amc = normalizeTiming(hour) === "amc";
  const index = bars.findIndex((bar) => (amc ? bar.date > reportDate : bar.date >= reportDate));
  if (index < 1) return null;
  const prev = bars[index - 1]!.close;
  if (!(prev > 0)) return null;
  return { session: bars[index]!.date, pct: ((bars[index]!.close - prev) / prev) * 100 };
}

/** Son dört açıklanmış çeyreğin HBK sürprizi ve ilk tepkisi, eskiden yeniye. */
export function historyOf(past: readonly DeskCalendarRow[], bars: readonly DeskBar[], before: string): DeskQuarter[] {
  return past
    .filter((row) => row.reportDate < before && row.epsActual !== null && row.epsEstimate !== null)
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
    .slice(-4)
    .flatMap((row) => {
      const s = epsSurprise(row.epsActual, row.epsEstimate);
      if (!s) return [];
      return [{
        label: row.quarter && row.year ? `Q${row.quarter} ${row.year}` : row.reportDate,
        reportDate: row.reportDate,
        direction: s.direction,
        ratio: s.ratio,
        reaction: reactionOf(bars, row.reportDate, row.hour)?.pct ?? null,
      }];
    });
}

/** Zilin saati: açılış öncesinde açılış, kapanış sonrasında o günün (yarım günde erken) kapanışı. */
export function bellOf(reportDate: string, hour: string | null, holidays: MarketHoliday[], locale: Locale): string | null {
  const timing = normalizeTiming(hour);
  if (timing === "bmo") return timePair(reportDate, clockOf(SESSION_BOUNDS.regularOpen), locale).primary;
  if (timing === "amc") return timePair(reportDate, clockOf(closeMinutesFor(reportDate, holidays)), locale).primary;
  return null;
}

function figure(actual: number | null, estimate: number | null, kind: "eps" | "revenue"): DeskFigure {
  const s = kind === "eps" ? epsSurprise(actual, estimate) : revenueSurprise(actual, estimate);
  return { estimate, actual, direction: s?.direction ?? null, ratio: s?.ratio ?? null };
}

export type DeskCardSource = {
  picked: ReturnType<typeof pickDeskRows>[number];
  name: string;
  currency: string | null;
  past: readonly DeskCalendarRow[];
  bars: readonly DeskBar[];
  row: ScanRow | null;
  analysisHref: string | null;
};

export function buildCard(src: DeskCardSource, holidays: MarketHoliday[], locale: Locale): DeskCard {
  const { row: cal, phase, reactionSession: reaction, pending } = src.picked;
  const firstReaction = phase === "after" && !pending ? reactionOf(src.bars, cal.reportDate, cal.hour) : null;
  return {
    symbol: cal.symbol,
    name: src.name,
    phase,
    reportDate: cal.reportDate,
    timing: normalizeTiming(cal.hour),
    bell: bellOf(cal.reportDate, cal.hour, holidays, locale),
    reactionSession: reaction,
    fiscal: cal.quarter && cal.year ? `Q${cal.quarter} ${cal.year}` : null,
    currency: src.currency,
    eps: figure(phase === "after" ? cal.epsActual : null, cal.epsEstimate, "eps"),
    revenue: figure(phase === "after" ? cal.revenueActual : null, cal.revenueEstimate, "revenue"),
    history: phase === "before" ? historyOf(src.past, src.bars, cal.reportDate) : [],
    /* Tepki seansı kapanmış ama barı gelmemişse (sağlayıcı) bekleniyor gibi
       davranılmaz: tepki yok, uydurulmaz. */
    reaction: firstReaction && firstReaction.session === reaction ? firstReaction : null,
    reactionPending: phase === "after" && pending,
    weight: src.row?.weight ?? null,
    fiveSession: src.row?.fiveSession ?? null,
    month: src.row?.month ?? null,
    sinceCost: src.row?.sinceCost ?? null,
    analysisHref: src.analysisHref,
  };
}

/** Önbellek anahtarının semboller/tarihler parçası. Evre (öncesi/sonrası) BİLEREK yok — gerekçe lib/portfolio-earnings-desk.ts. */
export function deskSignature(cards: readonly DeskCard[]): string {
  return cards.map((c) => `${c.symbol}@${c.reportDate}`).sort().join(",");
}

/* ---------------------------------------------------------------------------
   Claude girdisi ve çıktısı
   --------------------------------------------------------------------------- */

export type DeskFormatters = {
  pct: (value: number, digits?: number) => string;
  share: (value: number) => string;
  money: (value: number, currency: string | null) => string;
  compact: (value: number, currency: string | null) => string;
  day: (date: string) => string;
};

const TIMING_WORD = {
  tr: { bmo: "açılış öncesi", amc: "kapanış sonrası", dmh: "seans içi" },
  en: { bmo: "before the open", amc: "after the close", dmh: "during the session" },
} as const;

/**
 * Modele giden girdi — biçimlenmiş sayılarla, dilin kalıbında. Her kartta
 * evre açıkça yazılı; öncesinde gerçekleşen yok, sonrasında geçmiş çeyrek
 * yok (model iki anı karıştırmasın). Pencere sözleri ("5 seans", "21
 * seans", "4 çeyrek") girdide, doğal ifadeler sayı denetimine takılmasın.
 */
export function deskInput(cards: readonly DeskCard[], session: string, locale: Locale, f: DeskFormatters, extra: { levels?: Map<string, { lastClose: string; averageCost: string | null; allowed: { level: string; kind: string }[] }> } = {}): string {
  const fig = (x: DeskFigure, money: (v: number) => string) => ({
    estimate: x.estimate === null ? null : money(x.estimate),
    actual: x.actual === null ? null : money(x.actual),
    verdict: x.direction,
    surprise: x.ratio === null ? null : f.pct(x.ratio * 100, 1),
  });
  return JSON.stringify({
    lastCompletedSession: f.day(session),
    windows: locale === "en" ? ["1 session", "3 sessions", "5 sessions", "21 sessions", "4 quarters"] : ["1 seans", "3 seans", "5 seans", "21 seans", "4 çeyrek"],
    cards: cards.map((c) => {
      const money = (v: number) => f.money(v, c.currency);
      const compact = (v: number) => f.compact(v, c.currency);
      const lv = extra.levels?.get(c.symbol);
      return {
        symbol: c.symbol,
        company: c.name,
        phase: c.phase === "before" ? "upcoming" : "reported",
        reportDay: f.day(c.reportDate),
        timing: c.timing ? TIMING_WORD[locale][c.timing] : null,
        bell: c.bell,
        fiscalPeriod: c.fiscal,
        eps: fig(c.eps, money),
        revenue: fig(c.revenue, compact),
        recentQuarters:
          c.phase === "before"
            ? c.history.map((q) => ({
                quarter: q.label,
                epsVerdict: q.direction,
                surprise: q.ratio === null ? null : f.pct(q.ratio * 100, 1),
                firstReaction: q.reaction === null ? null : f.pct(q.reaction, 1),
              }))
            : undefined,
        firstReaction:
          c.phase === "after"
            ? c.reaction
              ? { session: f.day(c.reaction.session), closeToClose: f.pct(c.reaction.pct, 2) }
              : c.reactionPending
                ? (locale === "en" ? "pending: the reaction session has not closed" : "bekleniyor: tepki seansı henüz kapanmadı")
                : null
            : undefined,
        position: {
          weight: c.weight === null ? null : f.share(c.weight),
          lastFiveSessions: c.fiveSession === null ? null : f.pct(c.fiveSession, 1),
          last21Sessions: c.month === null ? null : f.pct(c.month, 1),
          sinceAverageCost: c.sinceCost === null ? null : f.pct(c.sinceCost, 1),
        },
        siteAnalysis: c.analysisHref ? true : undefined,
        ...(lv ? { lastClose: lv.lastClose, averageCost: lv.averageCost, allowedLevels: lv.allowed } : {}),
      };
    }),
  });
}

export const DeskSchema = z.object({
  headline: z.string(),
  cards: z.array(z.object({ symbol: z.string(), note: z.string() })),
});
export type DeskOutput = z.infer<typeof DeskSchema>;

/** Sahibin görüşü: Tut / Azalt / Ekle. Sat masada yok — bilanço anı görüşü, çıkış kararı taramanın planında. */
export const DESK_ACTIONS = ["add", "hold", "trim"] as const;
export type DeskAction = (typeof DESK_ACTIONS)[number];

export const DeskPlanSchema = DeskSchema.extend({
  views: z.array(
    z.object({
      symbol: z.string(),
      action: z.enum(DESK_ACTIONS),
      takeProfit: z.string().nullable(),
      stopLoss: z.string().nullable(),
      rationale: z.string(),
    }),
  ),
});
export type DeskPlanOutput = z.infer<typeof DeskPlanSchema>;

export type DeskText = {
  headline: string;
  /** Sembol → { not, yazıldığı evre }. Evre değiştiyse (öncesi notu, bilanço düştü) not basılmaz. */
  notes: Record<string, { note: string; phase: DeskPhase }>;
};

export type DeskView = Omit<ScanPlan, "action"> & { action: DeskAction };

/**
 * Çıktının iki son kontrolü (taramayla aynı): sayı (metindeki her sayı
 * girdide) ve tavsiye (üyelerde al/sat yönlendirmesi). Biri tutmazsa metin
 * HİÇ basılmaz; kartların ölçüleri ekranda kalır. Girdide olmayan sembolün
 * notu atılır.
 */
export function checkDesk(
  out: DeskOutput,
  input: string,
  cards: readonly DeskCard[],
  locale: Locale,
  options: { adviceAllowed?: boolean } = {},
): { ok: true; text: DeskText } | { ok: false; reason: string } {
  const phases = new Map(cards.map((c) => [c.symbol, c.phase]));
  const notes: DeskText["notes"] = {};
  for (const card of out.cards) {
    const symbol = card.symbol.trim().toUpperCase();
    const phase = phases.get(symbol);
    const note = card.note.trim();
    if (phase && note && !notes[symbol]) notes[symbol] = { note, phase };
  }
  const headline = out.headline.trim();
  if (!headline || Object.keys(notes).length === 0) return { ok: false, reason: "empty" };
  const all = [headline, ...Object.values(notes).map((n) => n.note)].join(" ");
  const missing = ungroundedNumbers(all, input);
  if (missing.length) return { ok: false, reason: `ungrounded (${missing.join(" ")})` };
  const advice = options.adviceAllowed ? [] : adviceMatches(all, locale);
  if (advice.length) return { ok: false, reason: `advice (${advice.join(" | ")})` };
  return { ok: true, text: { headline, notes } };
}

/**
 * Sahibin görüşleri: seviyeler YALNIZ `planLevels` listesinden ve yönü
 * tutarak (kâr al kapanışın üstünde, zarar kes altında) — denetim taramanın
 * `checkPlans`ı, aynen. Masadaki kartı olmayan sembolün görüşü düşer.
 */
export function checkViews(
  views: DeskPlanOutput["views"],
  cards: readonly DeskCard[],
  rows: readonly ScanRow[],
  levelsOf: (row: ScanRow) => PlanLevel[],
  input: string,
): DeskView[] {
  const onDesk = new Set(cards.map((c) => c.symbol));
  const eligible = rows.filter((r) => onDesk.has(r.symbol));
  return checkPlans(views, eligible, levelsOf, input) as DeskView[];
}
