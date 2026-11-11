import { z } from "zod";
import { adviceMatches } from "@/lib/advice-guard";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import type { Locale } from "@/lib/i18n/config";
import { formatMeasure } from "@/lib/portfolio-risk";
import { formatPercentPlain } from "@/lib/utils";

/**
 * "PORTFÖYÜNE SOR"UN SAF PARÇALARI (11 Kasım, sahibinin isteği: okur kendi
 * portföyü hakkında düz cümleyle soru sorar, Claude yalnız o portföyün
 * sunucuda toplanan verisiyle yanıtlar). Kalıp "Bu Hisseye Sor"
 * (lib/stock-question-core.ts): soru temizliği, okur kotası ve önbellek
 * anahtarı oradan aynen kullanılır; burada yalnız portföye özgü olanlar:
 *
 * 1. SENARYO AYRIŞTIRICISI (`parseScenario`) ve HESABI (`computeScenario`).
 *    "SNDK'yi satsam yoğunlaşmam ne olur" sorusunda model HESAP YAPMAZ
 *    (sayı denetimi: çıktıdaki her sayı girdide geçmeli). Hesabı sunucu
 *    yapar; sorudan sembol ve eylem bu ayrıştırıcıyla çıkar, yeni ağırlık,
 *    ilk-5 payı, en büyük pozisyon, etkin pozisyon sayısı ve sektör payı
 *    girdiye "scenario" olarak biçimlenmiş girer. Ayrıştırılamayan senaryo
 *    sorusu `{ computable: false }` olarak gider; model "bu senaryoyu
 *    hesaplayamıyorum" der (`scenario_unavailable`).
 * 2. ÖLÇÜ KARTLARI (`measureCatalog`, `pickMeasures`). Model yanıtta
 *    dayandığı ölçülerin KİMLİĞİNİ döner ("SNDK.weight", "risk.beta",
 *    "scenario.top5Weight"); kartın etiketi ve değeri sunucunun girdisinden
 *    gelir, modelin yazdığı sayıdan değil. Girdide olmayan kimlik düşer.
 * 3. KABUL KARARI (`decidePortfolioAnswer`): sayı denetimi her zaman,
 *    tavsiye denetimi site sahibi dışında (sahibin açık görüş istisnası:
 *    lib/portfolio-scan.ts → PLAN_SYSTEM, .claude/rules/site-ici-claude.md).
 *
 * Testler: tests/portfolio-question.test.ts.
 */

/** Okur başına günlük soru hakkı. Hisse sorusundan (10) dar: girdi bütün portföy, çağrı pahalı. */
export const PORTFOLIO_QUESTION_DAILY_LIMIT = 5;
/** Okur başına günlük boşa giden deneme tavanı (gerekçe lib/stock-question-core.ts → "Okur kotası"). */
export const PORTFOLIO_QUESTION_DAILY_MISSES = 3;
/** Ekranda en çok kaç ölçü kartı. */
export const MAX_MEASURES = 6;
/** Yanıt en çok kaç paragraf. */
export const MAX_PARAGRAPHS = 3;

/* ---------------------------------------------------------------------------
   Senaryo ayrıştırıcısı

   BİLEREK DAR. Yanlış ayrıştırılmış bir senaryo, okura başka bir sorunun
   doğru hesabını gösterir — bu, "hesaplayamıyorum"dan kötü. Bu yüzden iki
   koşul birden aranır: VARSAYIM kipi ("satsam", "çıkarırsam", "olsa",
   "if I", "what if") ve tanınan bir EYLEM. Biri yoksa soru senaryo
   sayılmaz (`none`); ikisi var ama sembol ya da tutar çıkmıyorsa
   `unparsed` (model hesaplayamadığını söyler).

   EYLEMLER ve YORUMLARI:
   - remove: "X'i satsam / çıkarsam / kapatsam", "sell / remove / drop X".
     Satıştan gelen para portföyden ÇIKAR (nakit portföyün parçası değil;
     ekran da nakit tutmuyor). Varsayım girdide yazılı.
   - scale: "X'in yarısını satsam" (0,5), "X'i ikiye katlasam" (2).
   - setWeight: "X'i %5'e indirsem / %20'ye çıkarsam", "X to 10%". Hedef
     ağırlık yeni toplamın içinde; öteki pozisyonların tutarı değişmez.
   - addAmount: "%10 X eklesem", "portföyün %10'u kadar X alsam", "add 10%
     X". Eklenen tutar BUGÜNKÜ toplamın yüzdesi, para dışarıdan gelir.
     Tutarsız ekleme ("X eklesem") hesaplanamaz: `unparsed` / "amount".
   - Tek sembol: iki sembol anılırsa (`multiple`) hesap yok — "X'i satıp Y
     alsam" iki adımlı ve bölüşümü belirsiz.

   SEMBOL TANIMA: portföydeki semboller büyük/küçük harf duyarsız tanınır
   (önbellek anahtarı soruyu küçültüyor — lib/stock-question-core.ts →
   `questionKey`; iki yazım aynı senaryoyu üretmeli), ama kısa Türkçe ve
   İngilizce sözcükler ("mu", "ne", "on", "all") yalnız BÜYÜK yazılınca
   sembol sayılır: "SNDK'yi satsam mu" ile "MU'yu satsam" ayrılsın.
   Portföyde olmayan sembol yalnız BÜYÜK yazılmışsa ve yalnız ekleme /
   hedef ağırlıkta aday olur.
   --------------------------------------------------------------------------- */

export type ScenarioAction =
  | { kind: "remove"; symbol: string }
  | { kind: "scale"; symbol: string; factor: number }
  | { kind: "setWeight"; symbol: string; weight: number }
  | { kind: "addAmount"; symbol: string; share: number };

export type ParsedScenario =
  | { status: "none" }
  | { status: "parsed"; action: ScenarioAction }
  | { status: "unparsed"; reason: "symbol" | "amount" | "multiple" | "range" };

const L = "\\p{L}\\p{N}";
const NOT_LETTER_BEFORE = `(?<![${L}])`;
const NOT_LETTER_AFTER = `(?![${L}])`;
const rx = (body: string) => new RegExp(body, "iu");

/* Varsayım kipi: -sa/-se ile biten şart fiilleri ("satsam", "çıkarırsam",
   "eklesem", "olsa", "olursa"), "eğer", "durumunda"; EN "if I", "what if". */
const HYPOTHETICAL = [
  rx(`[${L}](?:s[ae]m|s[ae]k|s[ae]n|s[ae]ydım|s[ae]ydik|s[ae]ydık)${NOT_LETTER_AFTER}`),
  rx(`${NOT_LETTER_BEFORE}(?:olsa|olursa|eğer|durumunda|halinde|hâlinde)${NOT_LETTER_AFTER}`),
  /\b(?:if\s+i\b|if\s+we\b|what\s+if|were\s+i\s+to|suppose|would\s+happen\s+if|what\s+happens\s+if)\b/i,
];

const REMOVE = [
  rx(`${NOT_LETTER_BEFORE}(?:sat|çıkar|kapat|boşalt|elden\\s+çıkar)(?:s[ae]|ır|ar|ıp|madan|t[ıi]ğ|[ıi]rs[ae])`),
  /\b(?:sell|sold|selling|remove|removed|drop|exit|exited|dump|close\s+out|get\s+rid\s+of)\b/i,
];
const HALF = [rx(`${NOT_LETTER_BEFORE}yarı(?:sı|sını|ya)${NOT_LETTER_AFTER}`), /\bhalf\b/i, /\bhalve\b/i];
const DOUBLE = [rx(`${NOT_LETTER_BEFORE}iki(?:ye)?\\s+kat|iki\\s+katına`), /\bdouble\b/i];
const ADD = [
  rx(`${NOT_LETTER_BEFORE}(?:ekle(?:s[ae]|r|y)|al(?:s[ae]|ır|ırs[ae])|satın\\s+al|artır|yükselt)`),
  /\b(?:add|added|adding|buy|bought|buying|increase|top\s+up)\b/i,
];
/* Hedef ağırlık: yüzde + yönelme eki ("%5'e", "%20'ye", "10%'a") ya da EN
   "to 10%". Ek yüzdeye BİTİŞİK aranır: "%10 eklesem"deki boşluklu "e"
   hedef sayılmasın. "dropped" EN kaldırmada yok: "what if NVDA dropped
   20%" fiyat sorusu, satış değil. */
const TARGET_TR = /(?:%\s?(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s?%)['’]?(?:y?[ae])(?![\p{L}\p{N}])/iu;
const TARGET_EN = /\bto\s+(?:%\s?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s?%)/i;
const PERCENT = /%\s?(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s?%|(\d+(?:[.,]\d+)?)\s+percent\b/i;

/* Yalnız büyük yazılınca sembol sayılan kısa sözcükler. */
const SHORT_WORDS = new Set([
  "mu", "mü", "mi", "mı", "ne", "ve", "de", "da", "bu", "şu", "o", "ya", "ki", "ile", "ama", "her", "bir", "çok", "az", "en", "var", "yok", "kar", "zarar", "son", "gün", "ay", "yıl",
  "a", "i", "an", "and", "or", "on", "in", "at", "to", "of", "it", "is", "be", "my", "me", "all", "any", "now", "so", "if", "for", "the", "how", "what", "low", "high", "big", "best", "key", "well",
]);
/* Büyük yazılsa da sembol sayılmayan kısaltmalar. */
const NOT_SYMBOLS = new Set(["ABD", "ETF", "TL", "USD", "TRY", "AI", "SPK", "EPS", "CEO", "S", "P", "SP", "I", "BIST", "TCMB", "FED", "ET", "TR", "EN", "OK"]);

const TOKEN = /(?<![\p{L}\p{N}$])\$?([A-Za-z]{1,5}(?:[.-][A-Za-z]{1,2})?)(?=['’]|[^\p{L}\p{N}]|$)/gu;

/** Soruda anılan semboller: portföydekiler ve (büyük yazılmış) portföy dışı adaylar. */
export function mentionedSymbols(question: string, held: readonly string[]): { held: string[]; others: string[] } {
  const heldSet = new Set(held.map((s) => s.toUpperCase()));
  const found = new Set<string>();
  const others = new Set<string>();
  for (const match of question.matchAll(TOKEN)) {
    const token = match[1]!;
    const upper = token.toUpperCase();
    const isUpper = token === upper;
    if (heldSet.has(upper)) {
      if (isUpper || !SHORT_WORDS.has(token.toLocaleLowerCase("tr-TR"))) found.add(upper);
    } else if (isUpper && upper.length >= 2 && !NOT_SYMBOLS.has(upper)) {
      others.add(upper);
    }
  }
  return { held: [...found], others: [...others] };
}

const toNumber = (raw: string | undefined) => (raw === undefined ? null : Number(raw.replace(",", ".")));
const any = (patterns: readonly RegExp[], text: string) => patterns.some((p) => p.test(text));

/* "En büyük pozisyonum" / "my largest position": hazır soru çipi sembol
   bilmeden senaryo sorabilsin (sözlük → portfolioAsk.examples). */
const LARGEST = [rx(`${NOT_LETTER_BEFORE}en\\s+büyük\\s+(?:pozisyon|hisse)`), /\b(?:largest|biggest|top)\s+(?:position|holding|stock)\b/i];

/**
 * Sorudan senaryo; saf ve deterministik. `held` ağırlık sırasıyla (ilki en
 * büyük pozisyon — "en büyük pozisyonum" ona çözülür).
 */
export function parseScenario(question: string, held: readonly string[]): ParsedScenario {
  const text = question.normalize("NFC");
  if (!any(HYPOTHETICAL, text)) return { status: "none" };
  const target = TARGET_EN.exec(text) ?? TARGET_TR.exec(text);
  const targetWeight = target ? toNumber(target[1] ?? target[2]) : null;
  const doubles = any(DOUBLE, text);
  const halves = any(HALF, text);
  const adds = any(ADD, text);
  const removes = any(REMOVE, text);
  if (targetWeight === null && !doubles && !halves && !adds && !removes) return { status: "none" };

  const named = mentionedSymbols(text, held);
  const mentions = named.held.length === 0 && held.length > 0 && any(LARGEST, text) ? { held: [held[0]!.toUpperCase()], others: named.others } : named;
  if (mentions.held.length > 1 || (mentions.held.length === 1 && mentions.others.length > 0 && adds)) return { status: "unparsed", reason: "multiple" };
  const heldSymbol = mentions.held[0] ?? null;
  const newSymbol = !heldSymbol && mentions.others.length === 1 ? mentions.others[0]! : null;
  if (!heldSymbol && mentions.others.length > 1) return { status: "unparsed", reason: "multiple" };

  if (targetWeight !== null) {
    const symbol = heldSymbol ?? newSymbol;
    if (!symbol) return { status: "unparsed", reason: "symbol" };
    if (!(targetWeight >= 0 && targetWeight < 100)) return { status: "unparsed", reason: "range" };
    if (targetWeight === 0) return heldSymbol ? { status: "parsed", action: { kind: "remove", symbol } } : { status: "unparsed", reason: "range" };
    return { status: "parsed", action: { kind: "setWeight", symbol, weight: targetWeight } };
  }
  if (doubles || halves) {
    if (!heldSymbol) return { status: "unparsed", reason: "symbol" };
    return { status: "parsed", action: { kind: "scale", symbol: heldSymbol, factor: doubles ? 2 : 0.5 } };
  }
  if (adds) {
    const symbol = heldSymbol ?? newSymbol;
    if (!symbol) return { status: "unparsed", reason: "symbol" };
    const pct = PERCENT.exec(text);
    const share = pct ? toNumber(pct[1] ?? pct[2] ?? pct[3]) : null;
    if (share === null) return { status: "unparsed", reason: "amount" };
    if (!(share > 0 && share <= 100)) return { status: "unparsed", reason: "range" };
    return { status: "parsed", action: { kind: "addAmount", symbol, share } };
  }
  if (!heldSymbol) return { status: "unparsed", reason: "symbol" };
  return { status: "parsed", action: { kind: "remove", symbol: heldSymbol } };
}

/* ---------------------------------------------------------------------------
   Senaryo hesabı
   --------------------------------------------------------------------------- */

export type ScenarioPosition = { symbol: string; value: number; sector: string | null };

export type ScenarioSnapshot = {
  /** Senaryodaki hissenin ağırlığı (yüzde, 0–100). */
  symbolWeight: number;
  largest: { symbol: string; weight: number };
  top5Weight: number;
  /** 1 / HHI — ağırlıklar eşit olsaydı kaç pozisyona denk. */
  effectivePositions: number;
  positionCount: number;
  /** Senaryodaki hissenin sektörünün payı; sektör bilinmiyorsa null. */
  sectorWeight: number | null;
};

export type ScenarioResult = {
  action: ScenarioAction;
  sector: string | null;
  /** Taşınan tutar, BUGÜNKÜ toplamın yüzdesi (satışta çıkan, eklemede giren). */
  movedShare: number;
  before: ScenarioSnapshot;
  after: ScenarioSnapshot;
};

function snapshot(positions: readonly ScenarioPosition[], symbol: string, sector: string | null): ScenarioSnapshot | null {
  const live = positions.filter((p) => p.value > 0);
  const total = live.reduce((sum, p) => sum + p.value, 0);
  if (!(total > 0)) return null;
  const weights = live.map((p) => ({ ...p, weight: (p.value / total) * 100 })).sort((a, b) => b.weight - a.weight);
  const hhi = weights.reduce((sum, p) => sum + (p.weight / 100) ** 2, 0);
  return {
    symbolWeight: weights.find((p) => p.symbol === symbol)?.weight ?? 0,
    largest: { symbol: weights[0]!.symbol, weight: weights[0]!.weight },
    top5Weight: weights.slice(0, 5).reduce((sum, p) => sum + p.weight, 0),
    effectivePositions: hhi > 0 ? 1 / hhi : 0,
    positionCount: weights.length,
    sectorWeight: sector === null ? null : weights.filter((p) => p.sector === sector).reduce((sum, p) => sum + p.weight, 0),
  };
}

/**
 * Senaryonun önce/sonra ölçüleri. Eylem portföyle tutmuyorsa (satılacak
 * hisse yok, sonuçta portföy boşalıyor) null: model hesaplayamadığını söyler.
 */
export function computeScenario(positions: readonly ScenarioPosition[], action: ScenarioAction, sectorOfNew: string | null = null): ScenarioResult | null {
  const total = positions.reduce((sum, p) => sum + Math.max(0, p.value), 0);
  if (!(total > 0)) return null;
  const current = positions.find((p) => p.symbol === action.symbol);
  const held = Boolean(current && current.value > 0);
  if ((action.kind === "remove" || action.kind === "scale") && !held) return null;
  const v0 = current?.value ?? 0;
  let v1: number;
  switch (action.kind) {
    case "remove":
      v1 = 0;
      break;
    case "scale":
      v1 = v0 * action.factor;
      break;
    case "setWeight": {
      const w = action.weight / 100;
      /* v1 / (total − v0 + v1) = w  →  v1 = w (total − v0) / (1 − w) */
      const rest = total - v0;
      if (!(rest > 0)) return null;
      v1 = (w * rest) / (1 - w);
      break;
    }
    case "addAmount":
      v1 = v0 + (action.share / 100) * total;
      break;
  }
  const sector = current?.sector ?? sectorOfNew;
  const next = current
    ? positions.map((p) => (p.symbol === action.symbol ? { ...p, value: v1 } : p))
    : [...positions, { symbol: action.symbol, value: v1, sector }];
  const before = snapshot(positions, action.symbol, sector);
  const after = snapshot(next, action.symbol, sector);
  if (!before || !after) return null;
  return { action, sector, movedShare: (Math.abs(v1 - v0) / total) * 100, before, after };
}

/* ---------------------------------------------------------------------------
   Biçim — modele ve karta giden dizeler AYNI fonksiyondan (sayı denetimi
   kartın değerini de girdide bulur).
   --------------------------------------------------------------------------- */

const pct1 = (value: number, locale: Locale) => formatPercentPlain(value, locale, 1);

function formatSnapshot(s: ScenarioSnapshot, locale: Locale) {
  return {
    symbolWeight: pct1(s.symbolWeight, locale),
    largest: { symbol: s.largest.symbol, weight: pct1(s.largest.weight, locale) },
    top5Weight: pct1(s.top5Weight, locale),
    effectivePositions: formatMeasure(s.effectivePositions, locale, 1),
    positionCount: s.positionCount,
    sectorWeight: s.sectorWeight === null ? null : pct1(s.sectorWeight, locale),
  };
}

export type FormattedScenario = ReturnType<typeof formatScenario>;

/** Girdinin "scenario" bloğu: hesap ve varsayımları okurun dilinde. */
export function formatScenario(result: ScenarioResult, locale: Locale) {
  const a = result.action;
  const en = locale === "en";
  const describe =
    a.kind === "remove"
      ? en ? `selling all of ${a.symbol}` : `${a.symbol} pozisyonunun tamamen satılması`
      : a.kind === "scale"
        ? a.factor === 2
          ? en ? `doubling the ${a.symbol} position` : `${a.symbol} pozisyonunun iki katına çıkması`
          : en ? `selling half of ${a.symbol}` : `${a.symbol} pozisyonunun yarısının satılması`
        : a.kind === "setWeight"
          ? en ? `bringing ${a.symbol} to ${pct1(a.weight, locale)} of the portfolio` : `${a.symbol} ağırlığının ${pct1(a.weight, locale)} olması`
          : en ? `adding ${a.symbol} worth ${pct1(a.share, locale)} of today's portfolio value` : `bugünkü portföy değerinin ${pct1(a.share, locale)} kadar ${a.symbol} eklenmesi`;
  const assumption = en
    ? "Computed by the site from the last completed session's closes. Sale proceeds leave the portfolio and new money comes from outside; other positions are unchanged."
    : "Site tarafından son tamamlanmış seansın kapanışlarıyla hesaplandı. Satıştan gelen para portföyden çıkar, ekleme için para dışarıdan gelir; öteki pozisyonlar değişmez.";
  return {
    computable: true as const,
    scenario: describe,
    symbol: a.symbol,
    sector: result.sector,
    movedShareOfToday: pct1(result.movedShare, locale),
    assumption,
    before: formatSnapshot(result.before, locale),
    after: formatSnapshot(result.after, locale),
  };
}

/** Ayrıştırılamayan / hesaplanamayan senaryonun bloğu. */
export function unavailableScenario(reason: "symbol" | "amount" | "multiple" | "range" | "data", locale: Locale) {
  const en = locale === "en";
  const why: Record<typeof reason, string> = {
    symbol: en ? "no single stock from the portfolio could be identified in the question" : "soruda portföydeki tek bir hisse tanınamadı",
    amount: en ? "the question does not say how much would be added (for example 10%)" : "soruda ne kadar ekleneceği yazmıyor (örneğin %10)",
    multiple: en ? "the question involves more than one stock" : "soruda birden çok hisse var",
    range: en ? "the requested weight is outside 0–100" : "istenen ağırlık 0–100 aralığının dışında",
    data: en ? "the position has no data for the last completed session" : "pozisyonun son tamamlanmış seans verisi yok",
  };
  return { computable: false as const, reason: why[reason] };
}

/* ---------------------------------------------------------------------------
   Ölçü kartları
   --------------------------------------------------------------------------- */

export type MeasureTone = "up" | "down" | null;
export type MeasureCard = { id: string; scope: string; label: string; value: string; tone: MeasureTone };

export type MeasureLabels = {
  scopes: { portfolio: string; risk: string; scenario: string };
  measures: Record<string, string>;
  arrow: string;
};

/** Girdinin modele giden biçimi — kart kataloğu bunun alanlarından kurulur. */
export type QuestionContext = {
  portfolio?: Record<string, unknown> | null;
  positions?: Array<Record<string, unknown> & { symbol: string }>;
  risk?: Record<string, string | null> | null;
  scenario?: FormattedScenario | ReturnType<typeof unavailableScenario> | null;
};

const POSITION_FIELDS = ["weight", "lastSession", "lastFiveSessions", "last21Sessions", "sinceAverageCost"] as const;
const PORTFOLIO_FIELDS = ["lastSession", "lastFiveSessions", "top5Weight"] as const;
const SCENARIO_FIELDS = ["symbolWeight", "top5Weight", "largest", "effectivePositions", "sectorWeight"] as const;
const SIGNED = new Set(["lastSession", "lastFiveSessions", "last21Sessions", "sinceAverageCost"]);

const toneOf = (field: string, value: string): MeasureTone =>
  SIGNED.has(field) ? (value.startsWith("+") ? "up" : value.startsWith("−") || value.startsWith("-") ? "down" : null) : null;

/** Girdideki her biçimlenmiş ölçünün kartı, kimliğiyle. */
export function measureCatalog(ctx: QuestionContext, labels: MeasureLabels): Map<string, MeasureCard> {
  const out = new Map<string, MeasureCard>();
  const add = (id: string, scope: string, field: string, value: unknown) => {
    if (typeof value !== "string" || !value) return;
    out.set(id, { id, scope, label: labels.measures[field] ?? field, value, tone: toneOf(field, value) });
  };
  for (const field of PORTFOLIO_FIELDS) add(`portfolio.${field}`, labels.scopes.portfolio, field, ctx.portfolio?.[field]);
  for (const p of ctx.positions ?? []) for (const field of POSITION_FIELDS) add(`${p.symbol}.${field}`, p.symbol, field, p[field]);
  for (const [field, value] of Object.entries(ctx.risk ?? {})) add(`risk.${field}`, labels.scopes.risk, field, value);
  const sc = ctx.scenario;
  if (sc && sc.computable) {
    for (const field of SCENARIO_FIELDS) {
      const before = sc.before[field];
      const after = sc.after[field];
      if (before === null || after === null) continue;
      const fmt = (v: typeof before) => (typeof v === "object" ? `${v.symbol} ${v.weight}` : String(v));
      const label = field === "symbolWeight" ? `${sc.symbol} · ${labels.measures.symbolWeight ?? field}` : (labels.measures[field] ?? field);
      out.set(`scenario.${field}`, { id: `scenario.${field}`, scope: labels.scopes.scenario, label, value: `${fmt(before)} ${labels.arrow} ${fmt(after)}`, tone: null });
    }
  }
  return out;
}

/** Modelin andığı kimliklerden katalogda olanlar; tekrarsız, en çok `max`. */
export function pickMeasures(claimed: readonly string[], catalog: ReadonlyMap<string, MeasureCard>, max = MAX_MEASURES): MeasureCard[] {
  const seen = new Set<string>();
  const out: MeasureCard[] = [];
  for (const raw of claimed) {
    const id = raw.trim();
    const [head, ...rest] = id.split(".");
    /* Sembol kısmı büyük harfe: "sndk.weight" de "SNDK.weight"i bulsun. */
    const key = catalog.has(id) ? id : head && rest.length ? `${head.toUpperCase()}.${rest.join(".")}` : id;
    const card = catalog.get(key);
    if (!card || seen.has(key)) continue;
    seen.add(key);
    out.push(card);
    if (out.length >= max) break;
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Model çıktısı ve kabul kararı
   --------------------------------------------------------------------------- */

export const PORTFOLIO_VERDICTS = ["answered", "advice", "not_in_data", "scenario_unavailable"] as const;

export const PortfolioAnswerSchema = z.object({
  verdict: z.enum(PORTFOLIO_VERDICTS),
  paragraphs: z.array(z.string()),
  measures: z.array(z.string()),
  /** Sorunun bir kısmı veride yok (yanıt kalanını anlatıyor). */
  partial: z.boolean(),
  /** Claude'un önerdiği 2–3 takip sorusu (11 Kasım, danışmanla sohbet). */
  followUps: z.array(z.string()),
});
export type PortfolioModelAnswer = z.infer<typeof PortfolioAnswerSchema>;

export type PortfolioDecision =
  | { kind: "answered" | "advice"; paragraphs: string[]; partial: boolean; charge: true }
  | { kind: "unanswerable" | "scenario-unavailable"; reason: "not-in-data" | "scenario"; charge: true }
  | { kind: "rejected"; reason: "empty" | "ungrounded" | "advice-pattern"; missing: string[]; charge: false };

/**
 * Yanıt okura gider mi. Sayı denetimi `grounding`e (girdi; soru metni YOK —
 * okurun "%30'a çıksa" sorusundaki 30 yanıta kaynak olamaz, gerekçe
 * lib/stock-question-core.ts → `decideAnswer`). Tavsiye denetimi site
 * sahibi dışında her okurda. Reddedilen yanıt basılmaz, önbelleğe girmez,
 * hak düşmez; boşa giden deneme sayılır.
 */
export function decidePortfolioAnswer(
  out: PortfolioModelAnswer,
  grounding: string,
  locale: Locale,
  options: { adviceAllowed?: boolean } = {},
): PortfolioDecision {
  if (out.verdict === "not_in_data") return { kind: "unanswerable", reason: "not-in-data", charge: true };
  if (out.verdict === "scenario_unavailable") return { kind: "scenario-unavailable", reason: "scenario", charge: true };
  const paragraphs = out.paragraphs.map((p) => p.trim()).filter(Boolean).slice(0, MAX_PARAGRAPHS);
  if (paragraphs.length === 0) return { kind: "rejected", reason: "empty", missing: [], charge: false };
  const all = paragraphs.join(" ");
  const missing = ungroundedNumbers(all, grounding);
  if (missing.length) return { kind: "rejected", reason: "ungrounded", missing, charge: false };
  const advice = options.adviceAllowed ? [] : adviceMatches(all, locale);
  if (advice.length) return { kind: "rejected", reason: "advice-pattern", missing: advice, charge: false };
  /* Sahipte "advice" hükmü anlamsız (görüş serbest): yanıt düz "answered". */
  return { kind: options.adviceAllowed ? "answered" : out.verdict, paragraphs, partial: out.partial, charge: true };
}

/** En çok kaç takip sorusu; soru başına en çok kaç karakter. */
export const MAX_FOLLOW_UPS = 3;
const FOLLOW_UP_MAX_CHARS = 90;

/**
 * Takip soruları (11 Kasım). Sohbetin bir sonraki adımı; okur tıklayınca
 * soru olduğu gibi gönderilir. Sayı denetimi burada da: girdide olmayan
 * sayı taşıyan soru düşer (soru da okura basılan metindir). Üyede tavsiye
 * kalıbı taşıyan soru da düşer. Tekrarlar ve uzunlar atılır.
 */
export function pickFollowUps(items: readonly string[], grounding: string, locale: Locale, adviceAllowed: boolean): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const q = raw.trim().replace(/\s+/g, " ");
    const key = q.toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR");
    if (!q || q.length > FOLLOW_UP_MAX_CHARS || seen.has(key)) continue;
    if (ungroundedNumbers(q, grounding).length) continue;
    if (!adviceAllowed && adviceMatches(q, locale).length) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= MAX_FOLLOW_UPS) break;
  }
  return out;
}

/** Önbellek anahtarının senaryo parçası — aynı soru anahtarında farklı ayrıştırma karışmasın. */
export function scenarioKey(parsed: ParsedScenario): string {
  if (parsed.status === "none") return "none";
  if (parsed.status === "unparsed") return `x:${parsed.reason}`;
  const a = parsed.action;
  return `${a.kind}:${a.symbol}:${a.kind === "scale" ? a.factor : a.kind === "setWeight" ? a.weight : a.kind === "addAmount" ? a.share : ""}`;
}
