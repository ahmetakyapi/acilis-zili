import type { AnalysisIndexRow, SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  formatCompact,
  formatEtDateCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";

/**
 * Görüş ve skorun tek kaynağı.
 *
 * Kayıtta `buy | hold | sell` duruyor, ekranda AL/TUT/SAT ya da BUY/HOLD/SELL
 * yazıyor: karar bir veri değeri, üç harfli kısaltma onun çevirisi. Rutin
 * yanlış bir dize gönderirse `hold`'a düşülür — sayfa çökmez, en nötr karar
 * gösterilir.
 */
export type VerdictKey = "buy" | "hold" | "sell";

export function verdictOf(raw: string | null | undefined): VerdictKey {
  const key = raw?.trim().toLowerCase();
  if (key === "buy" || key === "al") return "buy";
  if (key === "sell" || key === "sat") return "sell";
  return "hold";
}

export function verdictLabel(verdict: VerdictKey, t: Dictionary): string {
  return verdict === "buy"
    ? t.analysis.verdictBuy
    : verdict === "sell"
      ? t.analysis.verdictSell
      : t.analysis.verdictHold;
}

/**
 * GÖRÜŞ RENKLERİ — tek üçlü, her ekranda aynı (25 Ekim, site geneli renk kararı;
 * sahibi: "renkli olabilir ekranlar, hep renksiz de olmasın; dengesini tutturalım").
 *
 * AL yeşil ailesi, TUT PİRİNÇ (`--brass` ailesi), SAT kırmızı ailesi. TUT mavi
 * boyanıyordu: mavi sitede etkileşimin rengi, TUT'u tıklanır bir öğe gibi
 * okutuyordu; pirinç "bekle" diyen sıcak bir ara ton ve sitede zaten "dikkat"
 * anlamında. Rozet, halka, şerit ve dağılım hep bu üçlüden; çizimdeki yumuşak
 * tonlar `VERDICT_INK`. Bilanço, teknik ve Claude ekranları aynı fonksiyonları
 * çağırıyor, yani renk tek yerden döner.
 */
const VERDICT_TEXT: Record<VerdictKey, string> = { buy: "text-up", hold: "text-brass-ink", sell: "text-down" };
export function verdictTextClass(verdict: VerdictKey): string {
  return VERDICT_TEXT[verdict];
}

/**
 * Rozet zemini — aynı üçlü, yıkanmış hâli. TUT `--brass-ink` (`--brass` değil):
 * mürekkep kendi yıkaması üstünde iki temada AA'yı geçen ton bu çift için var.
 */
const VERDICT_PILL: Record<VerdictKey, string> = {
  buy: "bg-up-wash text-up",
  hold: "bg-brass-wash text-brass-ink",
  sell: "bg-down-wash text-down",
};
export function verdictPillClass(verdict: VerdictKey): string {
  return VERDICT_PILL[verdict];
}

/** SVG halkasının `stroke` değeri — CSS değişkeni doğrudan verilir. */
export function verdictStroke(verdict: VerdictKey): string {
  return VERDICT_INK[verdict];
}

/**
 * Görüşün çizimdeki YUMUŞAK tonu (halka, dağılım şeridi, kart üst çizgisi): yön
 * renginin kendisi değil, kart zeminiyle karışmış hâli — "+%2,1"in doygun
 * yeşiliyle yan yana durunca görüş bir fiyat hareketi gibi okunmasın.
 *
 * TEK KAYNAK `--verdict-*` (app/globals.css, oranlar ve ölçülen kontrastlar
 * orada). Burada ve CSS modüllerinde yüzde yazılmaz: önceden burada %72/%85,
 * analist kovalarında %74/%58, analiz kartlarında %62/%70 vardı — aynı "Al"
 * üç ekranda üç ton çıkıyordu. Analist kovaları (`BUCKET_INK`) bu nesneyi
 * çağırır; yalnız ara "Al"/"Sat" kovası `-soft` basamağını kullanır.
 */
export const VERDICT_INK: Record<VerdictKey, string> = {
  buy: "var(--verdict-buy)",
  hold: "var(--verdict-hold)",
  sell: "var(--verdict-sell)",
};

/** Analist kovalarının ara basamağı (Al/Sat): güçlü uçtan bir ton açık. */
export const VERDICT_INK_SOFT: Record<Exclude<VerdictKey, "hold">, string> = {
  buy: "var(--verdict-buy-soft)",
  sell: "var(--verdict-sell-soft)",
};

export function analysisHref(symbol: string, period: string): string {
  /* Dönem tek kalıba iner: eski biçimli satırdan üretilen bağlantı da
     sayfanın canonical'ını yazsın, yönlendirmeden geçmesin. */
  return `/bilancolar/${symbol.toLowerCase()}/${canonicalPeriod(period)}`;
}

/**
 * Dönem etiketinden URL parçası.
 *
 * "4Ç FY2026" → "4c-fy2026". Türkçe harfler ASCII'ye indirilir çünkü bu bir
 * adres: `Ç` yüzdelik kaçışla yazılınca bağlantı paylaşılamaz hâle geliyor.
 */
export function periodSlug(label: string): string {
  return canonicalPeriod(
    label
      /* İngilizce etiket ("Q3 2026", "Q4 FY2026") Türkçe kalıba çevrilir;
         adres dile bağlı değil — gerekçe `canonicalPeriod`. */
      .trim()
      .replace(/^q([1-4])(?=[\s-])/i, "$1Ç")
      .toLocaleLowerCase("tr-TR")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
  );
}

/**
 * DÖNEM ADRESİ TEK KALIPTA: "3c-2026", "4c-fy2026" (25 Ekim).
 *
 * Bir analizin iki dili AYNI satır anahtarını (sembol + dönem) paylaşıyor;
 * adres dilden bağımsız. Rutin İngilizce gövdeyi `period` vermeden
 * gönderdiğinde parça "Q3 2026" etiketinden "q3-2026" türüyordu ve
 * META ile TXN için 21 Ekim'de ayrı birer satır açıldı: aynı metin
 * `/en/bilancolar/txn/3c-2026` ve `/en/bilancolar/txn/q3-2026` adresinde,
 * ikisi de site haritasında (kopya içerik). Hem türetilen hem açıkça
 * verilen parça buradan geçer.
 */
export function canonicalPeriod(period: string): string {
  return period.replace(/^q([1-4])-/, "$1c-");
}

/**
 * Bir dönem adresinin veritabanında karşılık gelebileceği İKİ yazım:
 * tek kalıp ("3c-2026") ve eski biçim ("q3-2026") (25 Ekim).
 *
 * Adres her zaman tek kalıp; satır ise iki yazımdan birinde durabilir.
 * Bir dilde yalnız `q3-…`, ötekinde yalnız `3c-…` satırı varsa iki sayfa
 * aynı adresi paylaşmalı ve birbirini hreflang ile göstermeli; okuma bu
 * yüzden iki yazımı birden sorar. 25 Ekim'de canlıda eski biçimli satır
 * sayısı 0'dı (salt okuma sayımı); bu, rutinin yine `period` vermeden
 * yazdığı güne karşı.
 */
export function periodVariants(period: string): string[] {
  const canon = canonicalPeriod(period);
  const legacy = canon.replace(/^([1-4])c-/, "q$1-");
  return legacy === canon ? [canon] : [canon, legacy];
}

/**
 * İki yazımdan dönen satırlar arasından okuyucuya gösterilecek olan:
 * önce okuyucunun dili, dil içinde tek kalıplı satır; dil yoksa tek kalıp,
 * o da yoksa ilk satır (sayfa "orijinal dil" notunu kendi basar).
 */
export function pickAnalysisRow<T extends { period: string; locale: string }>(
  rows: readonly T[],
  locale: string,
): T | null {
  const isCanon = (row: T) => canonicalPeriod(row.period) === row.period;
  return (
    rows.find((row) => row.locale === locale && isCanon(row)) ??
    rows.find((row) => row.locale === locale) ??
    rows.find(isCanon) ??
    rows[0] ??
    null
  );
}

/**
 * Listede tek kalıplı ikizi olan eski biçimli dönemleri düşürür — site
 * haritası ikisini birden yazmasın. İkizi yoksa satır kalır (adresi tek).
 */
export function dropShadowedPeriods<T extends { symbol: string; period: string }>(
  rows: readonly T[],
): T[] {
  const keys = new Set(rows.map((row) => `${row.symbol.toUpperCase()}|${row.period}`));
  return rows.filter((row) => {
    const canon = canonicalPeriod(row.period);
    return canon === row.period || !keys.has(`${row.symbol.toUpperCase()}|${canon}`);
  });
}

/* --------------------------------------------------------------------------
   Tablo satırının görünüm modeli

   Analiz tablosu ARTIK bir istemci bileşeni (anlık arama için) ama sözlüğün
   tamamını istemciye taşımak istemiyoruz — `lib/i18n/dictionaries/tr.ts` yedi
   yüz satır ve tablonun ihtiyacı olan on beş dize. Bu yüzden hücrelerin
   metinleri SUNUCUDA hesaplanıyor; istemciye yalnızca basılacak dizeler
   gidiyor. Biçimlendirme (binlik ayracı, yüzde işaretinin yeri) da böylece
   sunucuda ve dile göre kalıyor.
   -------------------------------------------------------------------------- */

export type CellTone = "up" | "down" | "muted";

export type AnalysisRowView = {
  key: string;
  href: string;
  symbol: string;
  company: string;
  periodLabel: string;
  logoUrl: string | null;
  reported: string;
  revenue: string;
  revenueTone: CellTone;
  eps: string;
  epsTone: CellTone;
  reaction: string;
  reactionTone: CellTone;
  score: number;
  verdict: VerdictKey;
  verdictText: string;
  /* Kart görünümünün HAM sayıları (25 Ekim görsel zirve): tepki şeridi
     ortak ölçekte çiziliyor, oran istemcide kuruluyor. Biçimli metinler
     yukarıdaki alanlarda, sunucuda. */
  reactionPct: number | null;
  revenueYoyPct: number | null;
  epsSurprisePct: number | null;
  /** "▲ %26" — yalnız yüzde; gelir tutarı kartta yok. */
  revenueYoyText: string | null;
  /** "−%30" / "+%7,8" — işaretli sürpriz. */
  epsSurpriseText: string | null;
  /** Aramanın taradığı alan — küçültülmüş sembol + şirket + dönem. */
  search: string;
  /**
   * Satırı kaplayan bağlantının erişilebilir adı.
   *
   * Satır artık `div[role="row"]` ve bağlantı onu kaplayan boş bir katman;
   * boş bir bağlantının adı da olmaz. Ekran okuyucu "NVDA · 2Ç 2026
   * analizini aç" duyuyor, dokuz hücreyi tek tek okumak zorunda kalmıyor.
   */
  linkLabel: string;
};

function toneOf(value: number | null | undefined): CellTone {
  if (value === null || value === undefined || Number.isNaN(value)) return "muted";
  return value >= 0 ? "up" : "down";
}

/** Türkçe küçültme: `toLowerCase()` "I" harfini yanlış çeviriyor. */
export function foldForSearch(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

/**
 * Açıklama penceresinin kısa adı: "Açılış Öncesi" · "Seans İçi" · "Kap.
 * Sonrası". Saat bilinmiyorsa `null` — ne yazılacağına çağıran karar verir:
 * tablo "Saat Belirsiz" diyor, öne çıkan kart ve yaklaşan satırları hiçbir
 * şey demiyor (uydurma kesinlik yok, boş etiket de yok).
 *
 * Analiz kaydının `timing` alanı ile takvimin `hour` alanı aynı sağlayıcı
 * kodlarını taşıyor; iki ekran aynı eşlemeyi ayrı ayrı yazıyordu.
 */
export function timingLabel(
  timing: string | null | undefined,
  t: Dictionary,
): string | null {
  if (timing === "bmo") return t.earnings.beforeOpenShort;
  if (timing === "amc") return t.earnings.afterCloseShort;
  if (timing === "dmh") return t.earnings.duringMarket;
  return null;
}

/**
 * Kayıt satırını tablo satırına çevirir.
 *
 * Sunucuda koşar (sözlük ve biçimlendirme orada kalsın diye) ve çıktısı
 * tamamen serileştirilebilir — istemci bileşenine prop olarak geçer.
 */
export function toAnalysisRowView(
  row: AnalysisIndexRow,
  meta: SymbolMeta | undefined,
  locale: Locale,
  t: Dictionary,
): AnalysisRowView {
  const timing = timingLabel(row.timing, t) ?? t.earnings.timeUnknown;

  const revenueTone = toneOf(row.revenueYoyPct);
  const revenue =
    row.revenue !== null
      ? `${formatCompact(row.revenue, locale)} $` +
        (row.revenueYoyPct !== null
          ? ` ${row.revenueYoyPct >= 0 ? "▲" : "▼"} ${formatPercentPlain(row.revenueYoyPct, locale, 0)}`
          : "")
      : NO_VALUE;

  const eps =
    row.eps !== null
      ? formatPrice(row.eps, locale, { currency: true }) +
        (row.epsSurprisePct !== null
          ? ` · ${formatPercent(row.epsSurprisePct, locale, 0)}`
          : "")
      : NO_VALUE;

  const reaction =
    row.reactionPct !== null
      ? `${row.reactionPct >= 0 ? "▲" : "▼"} ${formatPercentPlain(row.reactionPct, locale, 1)}`
      : NO_VALUE;

  const verdict = verdictOf(row.verdict);

  return {
    key: `${row.symbol}-${row.period}`,
    href: analysisHref(row.symbol, row.period),
    symbol: row.symbol,
    company: row.company,
    periodLabel: row.periodLabel,
    logoUrl: meta?.logoUrl ?? null,
    reported: `${formatEtDateCompact(row.reportDate, locale)} · ${timing}`,
    revenue,
    revenueTone,
    eps,
    epsTone: toneOf(row.epsSurprisePct),
    reaction,
    reactionTone: toneOf(row.reactionPct),
    score: row.score,
    verdict,
    verdictText: verdictLabel(verdict, t),
    reactionPct: row.reactionPct,
    revenueYoyPct: row.revenueYoyPct,
    epsSurprisePct: row.epsSurprisePct,
    revenueYoyText:
      row.revenueYoyPct !== null
        ? `${row.revenueYoyPct >= 0 ? "▲" : "▼"} ${formatPercentPlain(row.revenueYoyPct, locale, 0)}`
        : null,
    epsSurpriseText: row.epsSurprisePct !== null ? formatPercent(row.epsSurprisePct, locale, 1) : null,
    search: foldForSearch(
      `${row.symbol} ${row.company} ${row.periodLabel} ${row.sector ?? ""}`,
    ),
    linkLabel: t.analysis.rowLink
      .replace("{symbol}", row.symbol)
      .replace("{period}", row.periodLabel),
  };
}

/** Tablonun (ve kart görünümünün) ihtiyaç duyduğu dizeler — sözlüğün tamamı yerine bu gider. */
export function analysisTableLabels(t: Dictionary) {
  return {
    tableRegion: t.analysis.tableRegion,
    colSymbol: t.analysis.colSymbol,
    colCompany: t.analysis.colCompany,
    colReported: t.analysis.colReported,
    colRevenue: t.analysis.colRevenue,
    colEps: t.analysis.colEps,
    colReaction: t.analysis.colReaction,
    colScore: t.analysis.colScore,
    colVerdict: t.analysis.colVerdict,
    colCard: t.analysis.colCard,
    cardLink: t.analysis.analysisLink,
    searchPlaceholder: t.analysis.searchPlaceholder,
    searchEmpty: t.analysis.searchEmpty,
    searchClear: t.analysis.searchClear,
    resultCountOne: t.analysis.resultCountOne,
    resultCountMany: t.analysis.resultCountMany,
    verdictLabel: t.analysis.verdictLabel,
    viewLabel: t.analysisVisuals.list.view,
    viewCards: t.analysisVisuals.list.cards,
    viewRows: t.analysisVisuals.list.rows,
    reactionLabel: t.analysisVisuals.list.reaction,
    revenueLabel: t.analysisVisuals.list.revenue,
    epsLabel: t.analysisVisuals.list.eps,
    noReaction: t.analysisVisuals.list.noReaction,
    more: t.analysisVisuals.list.more,
    scale: t.analysisVisuals.list.scale,
    shown: t.analysisVisuals.list.shown,
  };
}
