import { adviceMatches } from "@/lib/advice-guard";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import type { Locale } from "@/lib/i18n/config";
import { formatPercentText } from "@/lib/utils";

/**
 * HAFTALIK PORTFÖY KARNESİ — saf hesap (11 Kasım, sahibinin isteği: pazar
 * postasında portföyü olan üyeye kişisel bölüm). Okuma, Claude çağrısı ve
 * önbellek `lib/portfolio-weekly-note.ts`; şablon `lib/notify-emails.ts`.
 *
 * AYRI POSTA DEĞİL, PAZAR ÖZETİNİN İÇİNDE. Ayrı tür, günlük posta bütçesinden
 * (EMAIL_DAILY_BUDGET, varsayılan 80) her portföy sahibi için ikinci bir
 * posta, yeni bir çıkış kapsamı ve yeni bir KVKK satırı demekti; bütçe zaten
 * pazar özetine yetmiyor (pazartesi telafisi). Bölüm aynı posta, aynı
 * `weekly:<pazartesi>:<kullanıcı>` anahtarı ve aynı "Bu Postadan Çık" ile
 * gider.
 *
 * TUTAR YOK, YALNIZ ORAN. Pazar özeti ONAYSIZ adrese de gider
 * (lib/email-notify.ts → weeklyRecipients); adresini yanlış yazmış bir
 * üyenin portföy tutarı bir yabancının kutusuna düşmesin. Postada ve
 * modele giden girdide adet, maliyet ve dolar yok: haftalık yüzde,
 * pozisyonun yüzdesi ve portföye katkısı (yüzde puan), bilanço günleri.
 *
 * HESAP (veri dürüstlüğü 4-5): her pozisyonun haftası kapanıştan kapanışa
 * (önceki haftanın son kapanışı → haftanın son seansı; lib/weekly-digest.ts
 * → weeklyMoves, endekslerle aynı ölçü, son seansı kanıtlamayan seri düşer).
 * Ağırlık haftanın BAŞINDAKİ değerle: adet × başlangıç kapanışı.
 * HAFTA İÇİNDE ALINAN LOT HESABA GİRMEZ (alış günü ≥ pazartesi): o lotun
 * haftası alış fiyatından başlar, kapanıştan kapanışa ölçü onu yanlış
 * sayardı; sayısı künyede ("1 lot hafta içinde alındı, hesapta yok").
 * Satış tablosu okunmaz: hafta içinde satılan pozisyon bugünkü listede
 * yoksa haftada da yok (künyede "bugünkü pozisyonlarla").
 */

export type WeeklyLot = { symbol: string; quantity: number; boughtAt: string };
export type WeeklyMove = { changePct: number; price: number };
export type WeeklyAhead = { date: string; timing: "bmo" | "amc" | "other" };

export type PortfolioWeekMover = { symbol: string; changePct: number; contribution: number; weight: number };

export type PortfolioWeek = {
  /** Portföyün haftası, yüzde — başlangıç değeriyle ağırlıklı. */
  changePct: number;
  /** Ölçülen / tutulan sembol sayısı. */
  covered: number;
  total: number;
  /** Hafta içinde alındığı için dışarıda kalan lot sayısı. */
  skippedLots: number;
  /** Haftayı en çok taşıyan pozisyonlar — mutlak katkıya göre. */
  movers: PortfolioWeekMover[];
  best: PortfolioWeekMover | null;
  worst: PortfolioWeekMover | null;
  /** Yeni haftada bilanço açıklayacak pozisyonlar (bugünkü bütün pozisyonlar). */
  ahead: ({ symbol: string } & WeeklyAhead)[];
};

export const MAX_MOVERS = 4;
export const MAX_AHEAD = 6;

/**
 * Portföyün haftası. Ölçülebilen pozisyon yoksa ya da tutulanların
 * yarısından azı ölçülebildiyse null: yarım portföyün yüzdesi "portföyün
 * haftası" diye basılmaz (lib/portfolio-scan.ts → measure ile aynı eşik).
 */
export function portfolioWeek(
  lots: readonly WeeklyLot[],
  moves: ReadonlyMap<string, WeeklyMove>,
  aheadAll: ReadonlyMap<string, WeeklyAhead>,
  pastMonday: string,
): PortfolioWeek | null {
  const held = new Map<string, number>();
  const symbols = new Set<string>();
  let skippedLots = 0;
  for (const lot of lots) {
    if (!(lot.quantity > 0)) continue;
    symbols.add(lot.symbol);
    if (lot.boughtAt >= pastMonday) {
      skippedLots += 1;
      continue;
    }
    held.set(lot.symbol, (held.get(lot.symbol) ?? 0) + lot.quantity);
  }
  const measured = [...held].flatMap(([symbol, quantity]) => {
    const move = moves.get(symbol);
    if (!move || !Number.isFinite(move.changePct) || !(move.price > 0) || move.changePct <= -100) return [];
    const start = move.price / (1 + move.changePct / 100);
    return [{ symbol, changePct: move.changePct, startValue: quantity * start, endValue: quantity * move.price }];
  });
  if (measured.length === 0 || measured.length * 2 < held.size) return null;
  const startTotal = measured.reduce((sum, m) => sum + m.startValue, 0);
  if (!(startTotal > 0)) return null;
  const endTotal = measured.reduce((sum, m) => sum + m.endValue, 0);
  const rows: PortfolioWeekMover[] = measured.map((m) => {
    const weight = (m.startValue / startTotal) * 100;
    return { symbol: m.symbol, changePct: m.changePct, weight, contribution: (weight * m.changePct) / 100 };
  });
  const byImpact = [...rows].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || a.symbol.localeCompare(b.symbol));
  const byChange = [...rows].sort((a, b) => b.changePct - a.changePct || a.symbol.localeCompare(b.symbol));
  const ahead = [...symbols]
    .flatMap((symbol) => {
      const hit = aheadAll.get(symbol);
      return hit ? [{ symbol, date: hit.date, timing: hit.timing }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))
    .slice(0, MAX_AHEAD);
  return {
    changePct: ((endTotal - startTotal) / startTotal) * 100,
    covered: measured.length,
    total: symbols.size,
    skippedLots,
    movers: byImpact.slice(0, MAX_MOVERS),
    /* Tek pozisyonda en iyi ve en kötü aynı satır olurdu — ikisi de basılmaz. */
    best: rows.length > 1 && byChange[0]!.changePct > 0 ? byChange[0]! : null,
    worst: rows.length > 1 && byChange[byChange.length - 1]!.changePct < 0 ? byChange[byChange.length - 1]! : null,
    ahead,
  };
}

/* ---- Biçim: posta ve modelin girdisi AYNI dizgeleri görür (sayı denetimi) ---- */

export const weekPct = (value: number, locale: Locale, digits = 1) => formatPercentText(value, locale, digits);

/** Katkı, yüzde puan: "+1,2 puan" / "+1.2 pts". */
export function weekPoints(value: number, locale: Locale): string {
  const abs = new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(value));
  const sign = abs === "0,0" || abs === "0.0" ? "" : value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${abs} ${locale === "en" ? "pts" : "puan"}`;
}

/** Pozisyonun portföydeki payı: "%34" / "34%". */
export const weekShare = (value: number, locale: Locale) => (locale === "en" ? `${Math.round(value)}%` : `%${Math.round(value)}`);

/**
 * Modele giden girdi. Kimlik, adet, maliyet, tutar YOK (yukarıda "TUTAR
 * YOK"). Pozisyon sayımı girdide ki doğal ifadeler ("3 pozisyon") sayı
 * denetimine takılmasın.
 */
export function portfolioWeekInput(
  week: PortfolioWeek,
  locale: Locale,
  context: { pastWeek: string; sp500: number | null; dayLabel: (date: string) => string },
): string {
  const mover = (m: PortfolioWeekMover) => ({
    symbol: m.symbol,
    weeklyChange: weekPct(m.changePct, locale),
    weightAtWeekStart: weekShare(m.weight, locale),
    contributionToPortfolio: weekPoints(m.contribution, locale),
  });
  return JSON.stringify({
    pastWeek: context.pastWeek,
    /* Seans sayısı yazılmaz: tatilli hafta dört seans, "5 seans" uydurma olurdu. */
    window: locale === "en" ? "the week, close to close" : "hafta, kapanıştan kapanışa",
    portfolioWeeklyChange: weekPct(week.changePct, locale),
    sp500WeeklyChange: context.sp500 === null ? null : weekPct(context.sp500, locale),
    positionsMeasured: week.covered,
    positionsHeld: week.total,
    biggestImpact: week.movers.map(mover),
    bestPerformer: week.best ? mover(week.best) : null,
    worstPerformer: week.worst ? mover(week.worst) : null,
    earningsNextWeek: week.ahead.map((a) => ({ symbol: a.symbol, day: context.dayLabel(a.date), timing: a.timing })),
  });
}

/**
 * Notun son kontrolü — tutmazsa null ve bölüm sayılarla, metinsiz gider.
 * 1) Her sayı girdide geçer (lib/ai-grounding.ts). 2) Tavsiye denetimi
 * (lib/advice-guard.ts) — YALNIZ site sahibinde kapalı (`adviceAllowed`;
 * gerekçe lib/portfolio-scan-model.ts → "KİŞİSEL PLAN"). 3) Boş ya da
 * aşırı uzun metin düşer (2–3 cümle istendi; 600 karakter bol pay).
 */
export function checkPortfolioWeekNote(
  text: string,
  input: string,
  locale: Locale,
  options: { adviceAllowed?: boolean } = {},
): { ok: true; text: string } | { ok: false; reason: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { ok: false, reason: "empty" };
  if (clean.length > 600) return { ok: false, reason: "long" };
  const missing = ungroundedNumbers(clean, input);
  if (missing.length) return { ok: false, reason: `ungrounded (${missing.join(" ")})` };
  const advice = options.adviceAllowed ? [] : adviceMatches(clean, locale);
  if (advice.length) return { ok: false, reason: `advice (${advice.join(" | ")})` };
  return { ok: true, text: clean };
}
