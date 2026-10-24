import { epsSurprise, revenueSurprise, type Surprise } from "@/lib/earnings-week";
import type { EarningsSeasonLabels } from "@/lib/i18n/dictionaries/earnings-season";
import type { Locale } from "@/lib/i18n/config";
import type { MarketStatus } from "@/lib/market-hours";
import { CLOSE_SETTLE_MINUTES } from "@/lib/telegram-plan";
import { formatPercentText } from "@/lib/utils";
import {
  averageAbsMove,
  historicalMoves,
  type DailyClose,
  type ReportEvent,
  type ReportTiming,
} from "@/lib/expected-move";

/**
 * Bilanço Hikâye Kartları — SAF mantık (hangi kart basılır, çizginin
 * konumları, tepkinin ölçüsü). Veri `lib/earnings-story-data.ts`, sayfa
 * `app/(app)/bilancolar/[symbol]/[period]/hikaye`, görsel
 * `lib/earnings-story-og.tsx`.
 *
 * NEDEN. Analiz sayfası uzun bir okuma (1440'ta ~3.900 piksel gövde) ve
 * paylaşılan bir bağlantı karşı tarafa yalnızca kapak kartını gösteriyor.
 * Hikâye çeyreği beş durağa bölüyor: beklenti ve gerçekleşen, rehberlik,
 * fiyat tepkisi, tek cümle, skor. Her durak kendi başına paylaşılabilir
 * bir görsel; okur sırayla kaydırarak ya da oklarla geçiyor. OTOMATİK
 * İLERLEME YOK — okurun hızını site belirlemiyor.
 *
 * VERİ OLMAYAN KART BASILMAZ. Rehberliği yazılmamış çeyrekte rehberlik
 * kartı, tepkisi ölçülemeyen raporda tepki kartı yok; yerine boş bir kutu
 * ya da "veri yok" kartı konmuyor. Üçten az kart kalırsa hikâye hiç
 * açılmıyor (`STORY_MIN_CARDS`).
 */

/** Adresteki kart adları — sıra hikâyenin sırası. */
export const STORY_KINDS = ["beklenti", "rehberlik", "tepki", "ozet", "skor"] as const;
export type StoryKind = (typeof STORY_KINDS)[number];

export function isStoryKind(value: unknown): value is StoryKind {
  return typeof value === "string" && (STORY_KINDS as readonly string[]).includes(value);
}

/** Bundan az kart "hikâye" değil, analiz sayfasının bir kopyası. */
export const STORY_MIN_CARDS = 3;

/** Özet kartında ilk cümlenin altında en fazla kaç madde daha. */
export const STORY_SUMMARY_MORE = 2;

/** Rehberlik kartında en fazla kaç satır — dikey kartın 1350 pikseline sığan. */
export const STORY_GUIDANCE_MAX = 3;

/* ---------------------------------------------------------------------------
   Tek çizgi — beklenti ve gerçekleşen aynı eksende
   --------------------------------------------------------------------------- */

/**
 * İki değerin aynı çizgideki konumları (0–1).
 *
 * `CompareScale`ın mantığı: sayı yerinde durur, çizgi aynı sayıyı bir de
 * UZUNLUK olarak söyler. Burada iki sayı (beklenti, gerçekleşen) aynı
 * rayda iki işaret; arası işaretin rengiyle (yukarı/aşağı) dolu bir bant.
 * Renk yalnız farkın İŞARETİNDEN geliyor, büyüklüğünden değil.
 *
 * Eksen iki değeri çevreleyen pencere; aralığın iki yanına farkın
 * `STORY_RAIL_PAD` katı kadar pay bırakılıyor ki işaretler rayın ucuna
 * yapışmasın. Fark sıfırsa (denk) pencere değerin %10'u kadar açılır,
 * değer de sıfırsa birim pencere — sıfıra bölme yok.
 */
export const STORY_RAIL_PAD = 0.75;

export function railPositions(estimate: number, actual: number): { estimate: number; actual: number } {
  const lo = Math.min(estimate, actual);
  const hi = Math.max(estimate, actual);
  const span = hi - lo || Math.abs(hi) * 0.1 || 1;
  const from = lo - span * STORY_RAIL_PAD;
  const width = hi - lo + 2 * span * STORY_RAIL_PAD;
  return {
    estimate: (estimate - from) / width,
    actual: (actual - from) / width,
  };
}

/**
 * Rehberlik aralığı ve piyasa beklentisi aynı rayda. Bant şirketin
 * aralığı, nokta beklenti. Pencere üçünü çevreleyen aralık + iki yana
 * aralık genişliğinin yarısı.
 */
export function rangePositions(
  low: number,
  high: number,
  consensus: number | null,
): { low: number; high: number; consensus: number | null } {
  const values = consensus === null ? [low, high] : [low, high, consensus];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) * 0.1 || 1;
  const from = lo - span * 0.5;
  const width = hi - lo + span;
  const at = (value: number) => (value - from) / width;
  return { low: at(low), high: at(high), consensus: consensus === null ? null : at(consensus) };
}

/* ---------------------------------------------------------------------------
   Fiyat tepkisi
   --------------------------------------------------------------------------- */

/**
 * Bu raporun ilk tam seanstaki hareketi ve ÖNCEKİ raporların mutlak
 * ortalaması.
 *
 * TAMAMLANMIŞ SEANS. `closes` yalnızca kapanmış seansların barlarını
 * taşımalı (çağıran süzüyor): açık seansın barı o anın fiyatı, "tepki"
 * diye yazılırsa gün içinde değişen bir sayı kalıcı bir hükme döner
 * (CLAUDE.md "Veri dürüstlüğü" 4). Kapanış sonrası raporda tepki ertesi
 * seansın kapanışını istiyor; o seans bitmeden kart basılmıyor.
 *
 * BEKLENEN HAREKETLE KARŞILAŞTIRMA NEDEN GEÇMİŞ ORTALAMA. Hisse
 * sayfasındaki "beklenen hareket" opsiyonların RAPORDAN ÖNCE fiyatladığı
 * hareket ve o an saklanmıyor; bugünkü opsiyon zinciri geçmiş bir raporun
 * beklentisini veremez. Elimizdeki dürüst karşılaştırma şirketin önceki
 * raporlarının ertesindeki ortalama hareket — `lib/expected-move.ts`teki
 * aynı ölçü, aynı kurallarla. Ortalama ancak iki ölçümle yazılıyor
 * (`MIN_MOVES_FOR_AVERAGE`); yoksa kart yalnız hareketi söylüyor.
 */
export type StoryReaction = {
  movePct: number;
  timing: "bmo" | "amc";
  average: { avg: number; count: number } | null;
  /**
   * Önceki raporların TEK TEK tepkileri, yeniden eskiye, en fazla
   * `STORY_REACTION_HISTORY`. Ortalamanın arkasındaki sayılar: kart bunları
   * kulvar üstünde 5 piksellik şeritler olarak çiziyor (24 Ekim görsel
   * denetimi — tepki kartının altında ~350 piksel boşluk kalıyordu; boşluk
   * esnetilmez, veriyle doldurulur). Ölçülemeyen rapor (saat yok, bar yok)
   * listeye girmez; ortalamayla aynı küme.
   */
  history: { date: string; movePct: number }[];
};

/** Tepki kartında listelenen önceki rapor sayısı — son bir yıl. */
export const STORY_REACTION_HISTORY = 4;

/**
 * KAPANMIŞ seansların barları. Açık seansın barı o anın fiyatı; tepki
 * kartı kalıcı bir hüküm yazıyor ve yarım seansla yazamaz (CLAUDE.md
 * "Veri dürüstlüğü" 4).
 *
 * Bugünün barı ancak kapanıştan `CLOSE_SETTLE_MINUTES` sonra tamam
 * (besleme 15 dakika gecikmeli + kapanış müzayedesinin tape'e düşme payı;
 * Telegram göndericisi ve Günün Posteri aynı ölçüyü bekliyor). Önceki
 * sürüm akşam seansı başlar başlamaz (16:00 ET) barı tamam sayıyordu;
 * o anda gecikmeli besleme seansın son çeyreğini henüz vermemiş oluyor ve
 * "ilk tam seans" yüzdesi 15:45'in fiyatıyla yazılıyordu. Kapanış
 * `status.closeMinutes`ten, yani yarım günde 13:00 ET.
 */
export function completedCloses<T extends { date: string }>(
  bars: readonly T[],
  status: Pick<MarketStatus, "etDate" | "etMinutes" | "closeMinutes" | "tradingToday">,
): T[] {
  const todayDone = status.tradingToday && status.etMinutes >= status.closeMinutes + CLOSE_SETTLE_MINUTES;
  return bars.filter((bar) => bar.date < status.etDate || (todayDone && bar.date === status.etDate));
}

export function storyReaction(
  report: ReportEvent,
  priorEvents: readonly ReportEvent[],
  closes: readonly DailyClose[],
): StoryReaction | null {
  if (report.timing !== "bmo" && report.timing !== "amc") return null;
  /* `historicalMoves` bugünden ileriyi eliyor; burada "bugün" barların
     bittiği yerin ertesi — süzülmüş barların sonrası zaten ölçülemez. */
  const horizon = "9999-12-31";
  const [own] = historicalMoves([report], closes, horizon, 1);
  if (!own || own.movePct === null) return null;
  const prior = historicalMoves(
    priorEvents.filter((event) => event.date < report.date),
    closes,
    report.date,
  );
  const history = prior
    .filter((move): move is typeof move & { movePct: number } => move.movePct !== null)
    .slice(0, STORY_REACTION_HISTORY)
    .map((move) => ({ date: move.date, movePct: move.movePct }));
  return { movePct: own.movePct, timing: report.timing, average: averageAbsMove(prior), history };
}

/**
 * Tepki kartının ORTAK ölçeği — bu raporun hareketi, önceki raporların
 * tek tek hareketleri ve ortalama aynı işaretli rayda (sıfır ortada).
 * `peak` en büyük mutlak değer (yarım ray), `guide` ±ortalamanın yarım
 * raydaki oranı (yoksa null). Sayfa ve paylaşım görseli aynı ölçeği
 * kullanıyor; görselde başka, sayfada başka uzunluk çıkamaz.
 */
export function reactionScale(
  movePct: number,
  history: readonly { movePct: number }[],
  average: number | null,
): { peak: number; guide: number | null } {
  const peak = Math.max(Math.abs(movePct), ...history.map((row) => Math.abs(row.movePct)), average ?? 0) || 1;
  return { peak, guide: average === null ? null : average / peak };
}

/* ---------------------------------------------------------------------------
   Kartlar
   --------------------------------------------------------------------------- */

export type StoryFigure = {
  estimate: number;
  actual: number;
  surprise: Surprise;
};

export type StoryGuidanceRow = {
  label: string;
  low: number;
  high: number;
  consensus: number | null;
  unit: string | null;
  evaluation: string | null;
  tone: string | null;
};

export type StoryCard =
  | {
      kind: "beklenti";
      eps: StoryFigure | null;
      revenue: StoryFigure | null;
      /** Takvimde beklenti yokken analizin kaydettiği EPS ve sapma. */
      recorded: { eps: number; surprisePct: number } | null;
    }
  | { kind: "rehberlik"; rows: StoryGuidanceRow[] }
  | { kind: "tepki"; reaction: StoryReaction }
  | {
      kind: "ozet";
      text: string;
      source: "takeaway" | "headline";
      /**
       * "30 Saniyede"nin SONRAKİ maddeleri, ilk cümleleriyle, en fazla
       * `STORY_SUMMARY_MORE`. Kart destenin en uzun kardeşine gerili ve tek
       * cümle altında ~250 piksel boş kalıyordu (1280, ölçüldü); boşluk
       * analizin kendi maddeleriyle doluyor. Paylaşım görseli yalnız ilk
       * cümleyi taşır (görselin tek iddiası).
       */
      more: string[];
    }
  | { kind: "skor"; score: number; verdict: string; headline: string };

export type StoryInput = {
  calendar: {
    epsEstimate: number | null;
    epsActual: number | null;
    revenueEstimate: number | null;
    revenueActual: number | null;
  } | null;
  recorded: { eps: number | null; epsSurprisePct: number | null };
  guidance: readonly {
    label: string;
    low: number;
    high: number;
    consensus?: number | null;
    unit?: string | null;
    evaluation?: string | null;
    tone?: string | null;
  }[] | null;
  reaction: StoryReaction | null;
  takeaways: readonly string[] | null;
  headline: string;
  score: number;
  verdict: string;
};

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

function figure(estimate: number | null, actual: number | null, kind: "eps" | "revenue"): StoryFigure | null {
  if (!finite(estimate) || !finite(actual)) return null;
  const surprise = kind === "eps" ? epsSurprise(actual, estimate) : revenueSurprise(actual, estimate);
  return surprise ? { estimate, actual, surprise } : null;
}

/**
 * "30 Saniyede"nin İLK maddesi — tek cümle. Madde birden çok cümle
 * taşıyorsa ilk cümlede kesiliyor; kart bir alıntı, paragraf değil.
 * Ondalık virgül/nokta ("8,97 milyar") cümle sonu sayılmıyor: nokta ancak
 * boşluk ve büyük harf izliyorsa bitiş.
 */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = /^(.+?[.!?])\s+(?=[A-ZÇĞİÖŞÜ"“(])/u.exec(trimmed);
  return match ? match[1] : trimmed;
}

export function buildStoryCards(input: StoryInput): StoryCard[] {
  const cards: StoryCard[] = [];

  const eps = figure(input.calendar?.epsEstimate ?? null, input.calendar?.epsActual ?? null, "eps");
  const revenue = figure(input.calendar?.revenueEstimate ?? null, input.calendar?.revenueActual ?? null, "revenue");
  const recorded =
    !eps && finite(input.recorded.eps) && finite(input.recorded.epsSurprisePct)
      ? { eps: input.recorded.eps, surprisePct: input.recorded.epsSurprisePct }
      : null;
  if (eps || revenue || recorded) cards.push({ kind: "beklenti", eps, revenue, recorded });

  const rows = (input.guidance ?? [])
    .filter((row) => finite(row.low) && finite(row.high) && row.label.trim() !== "")
    .slice(0, STORY_GUIDANCE_MAX)
    .map((row) => ({
      label: row.label,
      low: Math.min(row.low, row.high),
      high: Math.max(row.low, row.high),
      consensus: finite(row.consensus) ? row.consensus : null,
      unit: row.unit ?? null,
      evaluation: row.evaluation ?? null,
      tone: row.tone ?? null,
    }));
  if (rows.length > 0) cards.push({ kind: "rehberlik", rows });

  if (input.reaction) cards.push({ kind: "tepki", reaction: input.reaction });

  const items = (input.takeaways ?? []).filter((item) => item.trim() !== "");
  if (items.length > 0) {
    cards.push({
      kind: "ozet",
      text: firstSentence(items[0]),
      source: "takeaway",
      more: items.slice(1, 1 + STORY_SUMMARY_MORE).map(firstSentence),
    });
  } else if (input.headline.trim() !== "") {
    cards.push({ kind: "ozet", text: input.headline.trim(), source: "headline", more: [] });
  }

  cards.push({ kind: "skor", score: input.score, verdict: input.verdict, headline: input.headline });
  return cards;
}

/**
 * Analiz sayfasının hikâye bağlantısı için UCUZ bir ön koşul: sayfanın
 * zaten elinde tuttuğu alanlarla en az üç kartı GARANTİ eden durum. Özet ve
 * skor her analizde var; üçüncüsü analizin kaydettiği EPS sapması ya da
 * rehberlik. Takvim satırı ve fiyat barları hikâye sayfasında okunuyor —
 * bağlantı onlara bakmadığı için ölü bir hikâyeye (404) hiç götürmüyor,
 * yalnızca bazı hikâyeleri bağlamadan bırakabilir.
 */
export function storyGuaranteed(row: {
  eps: number | null;
  epsSurprisePct: number | null;
  guidance: readonly unknown[] | null;
}): boolean {
  return (finite(row.eps) && finite(row.epsSurprisePct)) || (row.guidance?.length ?? 0) > 0;
}

/** Bir kartın paylaşım görselinin adresi. */
export function storyImagePath(
  analysisPath: string,
  kind: StoryKind,
  size: "dikey" | "yatay",
): string {
  return `${analysisPath}/hikaye/gorsel?kart=${kind}&boyut=${size}`;
}

/* ---------------------------------------------------------------------------
   Metin — sayfa ve görsel aynı dizeyi yazsın
   --------------------------------------------------------------------------- */

export function storyCardTitle(card: StoryCard, labels: EarningsSeasonLabels["story"]): string {
  if (card.kind === "beklenti") return labels.expectTitle;
  if (card.kind === "rehberlik") return labels.guidanceTitle;
  if (card.kind === "tepki") return labels.reactionTitle;
  if (card.kind === "ozet") return card.source === "headline" ? labels.summaryHeadline : labels.summaryTitle;
  return labels.scoreTitle;
}

/** Sapmanın metni: oran varsa işaretli yüzde, yoksa yön adı (oran sıfıra yakın paydada yok). */
export function surpriseText(
  figure: StoryFigure,
  locale: Locale,
  labels: Pick<EarningsSeasonLabels, "story" | "vote">,
): string {
  if (figure.surprise.ratio !== null) {
    return labels.story.expectSurprise.replace("{pct}", formatPercentText(figure.surprise.ratio * 100, locale, 1));
  }
  return figure.surprise.direction === "beat"
    ? labels.vote.outcomeBeat
    : figure.surprise.direction === "miss"
      ? labels.vote.outcomeMiss
      : labels.vote.outcomeInline;
}

export type { ReportTiming };
