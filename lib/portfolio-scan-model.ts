import { z } from "zod";
import { adviceMatches } from "@/lib/advice-guard";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import type { Locale } from "@/lib/i18n/config";
import { formatPercentText } from "@/lib/utils";

/**
 * GÜNLÜK PORTFÖY TARAMASI — saf hesap (10 Kasım, sahibinin isteği: "her gün
 * portföye AI taraması yapsak… ana sayfadaki kısımda da gözüksün… AI
 * analizi çok detaylı çalışmalı").
 *
 * İKİYE BÖLÜNDÜ. Ekrandaki ÇİZİM (pozisyon başına beş seanslık şerit, üç
 * aylık banttaki yer, bilanço/teknik/haber işaretleri) burada, sunucunun
 * kendi hesabıyla; Claude yalnız METNİ yazıyor (başlık, özet, temalar,
 * pozisyon notları). Model bir sayı uydursa bile çizim yanılmaz, metin
 * de sayı denetiminden düşer (lib/ai-grounding.ts). Bu modül veritabanına
 * ve sağlayıcıya dokunmaz; okuma ve Claude çağrısı `lib/portfolio-scan.ts`.
 *
 * YAZMA KATMANI (veri dürüstlüğü 4-5): her sayı son TAMAMLANMIŞ seansın
 * kapanışından; canlı kotasyon girdide yok.
 */

export type ScanBar = { close: number; high: number; low: number };

export type ScanHoldingInput = {
  symbol: string;
  name: string;
  sector: string | null;
  quantity: number;
  /** Toplam maliyet (adet × ortalama), dolar. */
  cost: number;
  /** Tamamlanmış seansa kadar günlük barlar, eskiden yeniye. */
  bars: readonly ScanBar[];
  earnings: { date: string; timing: string | null } | null;
  technical: { stance: "buy" | "hold" | "sell"; headline: string | null } | null;
  /** Sitenin teknik analizindeki seviyeler (yayımlanmışsa) — kişisel planın girdisi. */
  levels?: { stop: number | null; entryLow: number | null; entryHigh: number | null; targets: number[]; supports: number[]; resistances: number[] } | null;
  news: { headline: string; source: string | null }[];
};

export type ScanFlag =
  | { kind: "earnings"; date: string; timing: string | null }
  | { kind: "technical"; stance: "buy" | "hold" | "sell" }
  | { kind: "nearHigh" }
  | { kind: "nearLow" }
  | { kind: "news"; count: number };

export type ScanRow = {
  symbol: string;
  name: string;
  sector: string | null;
  value: number;
  close: number;
  averageCost: number | null;
  high3m: number;
  low3m: number;
  levels: ScanHoldingInput["levels"];
  /** Portföydeki pay, yüzde (0–100). */
  weight: number;
  day: number | null;
  fiveSession: number | null;
  month: number | null;
  sinceCost: number | null;
  /** Son kapanışın üç aylık bandaki yeri: 0 dip, 100 zirve. */
  rangePosition: number | null;
  flags: ScanFlag[];
};

/** Pencereler: ay = 21 seans, bant = elde ne varsa (3M, ~63 seans). */
const MONTH = 21;
const NEAR_EDGE = 10;

const change = (now: number, then: number | undefined) =>
  then !== undefined && then > 0 ? ((now - then) / then) * 100 : null;

/** Pozisyon başına ölçüler ve işaretler. Barı 6'dan kısa olan pozisyon dışarıda. */
export function scanRows(holdings: readonly ScanHoldingInput[]): ScanRow[] {
  const measured = holdings.flatMap((h) => {
    const bars = h.bars;
    if (bars.length < 6) return [];
    const last = bars[bars.length - 1]!;
    const close = last.close;
    const high = Math.max(...bars.map((b) => b.high));
    const low = Math.min(...bars.map((b) => b.low));
    const avg = h.quantity > 0 ? h.cost / h.quantity : 0;
    return [{
      h,
      close,
      high,
      low,
      avg,
      value: close * h.quantity,
      day: change(close, bars[bars.length - 2]?.close),
      fiveSession: change(close, bars[bars.length - 6]?.close),
      month: bars.length > MONTH ? change(close, bars[bars.length - 1 - MONTH]?.close) : null,
      sinceCost: avg > 0 ? ((close - avg) / avg) * 100 : null,
      rangePosition: high > low ? ((close - low) / (high - low)) * 100 : null,
    }];
  });
  const total = measured.reduce((sum, m) => sum + m.value, 0);
  return measured
    .map((m) => {
      const flags: ScanFlag[] = [];
      if (m.h.earnings) flags.push({ kind: "earnings", date: m.h.earnings.date, timing: m.h.earnings.timing });
      if (m.h.technical) flags.push({ kind: "technical", stance: m.h.technical.stance });
      if (m.rangePosition !== null && m.rangePosition >= 100 - NEAR_EDGE) flags.push({ kind: "nearHigh" });
      if (m.rangePosition !== null && m.rangePosition <= NEAR_EDGE) flags.push({ kind: "nearLow" });
      if (m.h.news.length > 0) flags.push({ kind: "news", count: m.h.news.length });
      return {
        symbol: m.h.symbol,
        name: m.h.name,
        sector: m.h.sector,
        value: m.value,
        close: m.close,
        averageCost: m.avg > 0 ? m.avg : null,
        high3m: m.high,
        low3m: m.low,
        levels: m.h.levels ?? null,
        weight: total > 0 ? (m.value / total) * 100 : 0,
        day: m.day,
        fiveSession: m.fiveSession,
        month: m.month,
        sinceCost: m.sinceCost,
        rangePosition: m.rangePosition,
        flags,
      };
    })
    .sort((a, b) => b.value - a.value);
}

/** Portföyün ağırlıklı günlük ve beş seanslık değişimi (yalnız ölçülen pozisyonlar). */
export function weightedChange(rows: readonly ScanRow[], key: "day" | "fiveSession"): number | null {
  let sum = 0;
  let weight = 0;
  for (const row of rows) {
    const value = row[key];
    if (value === null) continue;
    sum += value * row.weight;
    weight += row.weight;
  }
  return weight > 0 ? sum / weight : null;
}

export const SCAN_THEME_KINDS = ["concentration", "momentum", "calendar", "technical", "news", "sector", "risk"] as const;
export type ScanThemeKind = (typeof SCAN_THEME_KINDS)[number];

export const ScanSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  themes: z.array(z.object({ kind: z.enum(SCAN_THEME_KINDS), title: z.string(), detail: z.string() })),
  positions: z.array(z.object({ symbol: z.string(), note: z.string() })),
});
export type ScanOutput = z.infer<typeof ScanSchema>;

/** Girdide en çok kaç pozisyon; notu yazılacak en çok kaç pozisyon. */
export const INPUT_POSITIONS = 15;
export const NOTE_POSITIONS = 8;

/**
 * Modele giden girdi. Sayılar biçimlenmiş (dilin yüzde kalıbıyla) ve
 * metinde aynen geçmek zorunda; sayım ve pencere de girdide ("5 seans",
 * "21 seans", pozisyon sayısı), doğal ifadeler denetime takılmasın.
 */
export function scanInput(rows: readonly ScanRow[], session: string, locale: Locale, dayLabel: (date: string) => string, extra: { newsBySymbol: Map<string, { headline: string }[]>; technicalBySymbol: Map<string, string | null> }): string {
  const pct = (value: number | null, digits = 1) => (value === null ? null : formatPercentText(value, locale, digits));
  const share = (value: number) => `${locale === "en" ? "" : "%"}${Math.round(value)}${locale === "en" ? "%" : ""}`;
  const bySector = new Map<string, number>();
  for (const row of rows) if (row.sector) bySector.set(row.sector, (bySector.get(row.sector) ?? 0) + row.weight);
  const stanceWord = (stance: string) =>
    locale === "en" ? ({ buy: "BUY", hold: "HOLD", sell: "SELL" } as Record<string, string>)[stance] : ({ buy: "AL", hold: "TUT", sell: "SAT" } as Record<string, string>)[stance];
  return JSON.stringify({
    session: dayLabel(session),
    windows: locale === "en" ? ["1 session", "5 sessions", "21 sessions", "3 months"] : ["1 seans", "5 seans", "21 seans", "3 ay"],
    positionCount: rows.length,
    sectorCount: bySector.size,
    portfolio: {
      lastSession: pct(weightedChange(rows, "day"), 2),
      lastFiveSessions: pct(weightedChange(rows, "fiveSession")),
      top5Weight: share(rows.slice(0, 5).reduce((sum, row) => sum + row.weight, 0)),
    },
    positions: rows.slice(0, INPUT_POSITIONS).map((row) => {
      const flag = <K extends ScanFlag["kind"]>(kind: K) => row.flags.find((f) => f.kind === kind) as Extract<ScanFlag, { kind: K }> | undefined;
      const earnings = flag("earnings");
      const technical = flag("technical");
      return {
        symbol: row.symbol,
        name: row.name,
        sector: row.sector,
        weight: share(row.weight),
        lastSession: pct(row.day, 2),
        lastFiveSessions: pct(row.fiveSession),
        last21Sessions: pct(row.month),
        sinceAverageCost: pct(row.sinceCost),
        threeMonthRange: row.rangePosition === null ? null : flag("nearHigh") ? "near-high" : flag("nearLow") ? "near-low" : "middle",
        earningsSoon: earnings ? { day: dayLabel(earnings.date), timing: earnings.timing } : null,
        siteTechnicalView: technical ? { stance: stanceWord(technical.stance), headline: extra.technicalBySymbol.get(row.symbol) ?? null } : null,
        recentHeadlines: (extra.newsBySymbol.get(row.symbol) ?? []).slice(0, 2).map((n) => n.headline),
      };
    }),
    sectors: [...bySector].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([sector, weight]) => ({ sector, weight: share(weight) })),
  });
}

export type ScanText = {
  headline: string;
  summary: string;
  themes: { kind: ScanThemeKind; title: string; detail: string }[];
  /** Sembol → not. */
  notes: Record<string, string>;
};

/**
 * Çıktının iki son kontrolü; biri tutmazsa metin HİÇ basılmaz (çizim
 * ekranda kalır). 1) Sayı: metindeki her sayı girdide geçer. 2) Tavsiye:
 * al/sat yönlendirmesi (lib/advice-guard.ts). Girdide olmayan sembolün
 * notu, boş temalar ve fazlası atılır.
 */
export function checkScan(
  out: ScanOutput,
  input: string,
  symbols: readonly string[],
  locale: Locale,
  options: { adviceAllowed?: boolean } = {},
): { ok: true; text: ScanText } | { ok: false; reason: string } {
  const known = new Set(symbols);
  const themes = out.themes
    .map((t) => ({ kind: t.kind, title: t.title.trim(), detail: t.detail.trim() }))
    .filter((t) => t.title && t.detail)
    .slice(0, 4);
  const notes: Record<string, string> = {};
  for (const p of out.positions) {
    const symbol = p.symbol.trim().toUpperCase();
    if (known.has(symbol) && p.note.trim() && !notes[symbol] && Object.keys(notes).length < NOTE_POSITIONS) notes[symbol] = p.note.trim();
  }
  const text: ScanText = { headline: out.headline.trim(), summary: out.summary.trim(), themes, notes };
  if (!text.headline || !text.summary) return { ok: false, reason: "empty" };
  const all = [text.headline, text.summary, ...themes.flatMap((t) => [t.title, t.detail]), ...Object.values(notes)].join(" ");
  /* Sembol adları ("SNDK", "MU") sayı değil; "3M" gibi rakamlı semboller
     girdide zaten geçiyor. */
  const missing = ungroundedNumbers(all, input);
  if (missing.length) return { ok: false, reason: `ungrounded (${missing.join(" ")})` };
  /* Tavsiye denetimi yalnız site sahibinin kişisel planında kapalı (aşağıda). */
  const advice = options.adviceAllowed ? [] : adviceMatches(all, locale);
  if (advice.length) return { ok: false, reason: `advice (${advice.join(" | ")})` };
  return { ok: true, text };
}

/* ---------------------------------------------------------------------------
   KİŞİSEL PLAN — YALNIZ SİTE SAHİBİ (10 Kasım, sahibinin isteği: "bu sadece
   bana özgü olacağı için… satabilirsin, buradan kâr al, buradan zarar kes").
   Kişiye özel al/sat önerisi SPK'ya göre lisanslı yatırım danışmanlığıdır;
   site bunu ÜYELERE vermez (tavsiye denetimi yerinde). Sahip kendi
   portföyü için Claude'un görüşünü istiyor: katman yalnız `role = admin`
   oturumunda açılır (lib/portfolio-scan.ts → getAdmin), önbellek anahtarı
   ayrı, uç başka hiçbir okura dönmez.
   SEVİYE UYDURULMAZ: model kâr al / zarar kes seviyesini YALNIZ sunucunun
   verdiği listeden seçer (sitenin teknik analizinin stop/hedef/destek/
   direnç seviyeleri, üç aylık zirve ve dip, ortalama maliyet). Listede
   olmayan seviye düşer; gerekçe metni yine sayı denetiminden geçer.
   --------------------------------------------------------------------------- */

export const PLAN_ACTIONS = ["add", "hold", "trim", "sell"] as const;
export type PlanAction = (typeof PLAN_ACTIONS)[number];

export const ScanPlanSchema = ScanSchema.extend({
  plans: z.array(
    z.object({
      symbol: z.string(),
      action: z.enum(PLAN_ACTIONS),
      takeProfit: z.string().nullable(),
      stopLoss: z.string().nullable(),
      rationale: z.string(),
    }),
  ),
});
export type ScanPlanOutput = z.infer<typeof ScanPlanSchema>;

export type PlanLevel = { label: string; value: number; source: PlanLevelSource };
export type PlanLevelSource = "stop" | "target" | "support" | "resistance" | "entry" | "high3m" | "low3m" | "cost";

export type ScanPlan = {
  symbol: string;
  action: PlanAction;
  takeProfit: PlanLevel | null;
  stopLoss: PlanLevel | null;
  rationale: string;
};

/** Bir pozisyonun izinli seviyeleri, biçimlenmiş etiketiyle (modelin seçeceği liste). */
export function planLevels(row: ScanRow, format: (value: number) => string): PlanLevel[] {
  const out: PlanLevel[] = [];
  const add = (value: number | null | undefined, source: PlanLevelSource) => {
    if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return;
    const label = format(value);
    if (!out.some((l) => l.label === label)) out.push({ label, value, source });
  };
  const lv = row.levels;
  if (lv) {
    add(lv.stop, "stop");
    lv.targets.forEach((v) => add(v, "target"));
    lv.resistances.forEach((v) => add(v, "resistance"));
    lv.supports.forEach((v) => add(v, "support"));
    add(lv.entryLow, "entry");
    add(lv.entryHigh, "entry");
  }
  add(row.high3m, "high3m");
  add(row.low3m, "low3m");
  add(row.averageCost, "cost");
  return out;
}

/**
 * Plan çıktısının denetimi. Seviye listede yoksa ya da yönü tutmuyorsa
 * (kâr al son kapanışın ÜSTÜNDE, zarar kes ALTINDA) o seviye düşer; plan
 * yine kalır. Gerekçe sayı denetiminden geçmezse o pozisyonun planı düşer.
 */
export function checkPlans(
  plans: ScanPlanOutput["plans"],
  rows: readonly ScanRow[],
  levelsOf: (row: ScanRow) => PlanLevel[],
  input: string,
): ScanPlan[] {
  const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
  const seen = new Set<string>();
  const out: ScanPlan[] = [];
  for (const plan of plans) {
    const symbol = plan.symbol.trim().toUpperCase();
    const row = bySymbol.get(symbol);
    if (!row || seen.has(symbol)) continue;
    const rationale = plan.rationale.trim();
    if (!rationale || ungroundedNumbers(rationale, input).length) continue;
    const levels = levelsOf(row);
    const pick = (label: string | null) => (label ? levels.find((l) => l.label === label.trim()) ?? null : null);
    const tp = pick(plan.takeProfit);
    const sl = pick(plan.stopLoss);
    seen.add(symbol);
    out.push({
      symbol,
      action: plan.action,
      takeProfit: tp && tp.value > row.close ? tp : null,
      stopLoss: sl && sl.value < row.close ? sl : null,
      rationale,
    });
  }
  return out;
}
