import type { Locale } from "@/lib/i18n/config";
import type { EarningsSeasonLabels } from "@/lib/i18n/dictionaries/earnings-season";
import { closeMinutesFor, etDateTimeToUtc, SESSION_BOUNDS, type MarketHoliday } from "@/lib/market-hours";
import { clockOf, displayZone, timePair, zoneDateKey, zoneTag } from "@/lib/session-clock";

/**
 * Şirket bazlı bilanço sayfası (`/bilancolar/[symbol]`) — SAF metin mantığı.
 *
 * NEDEN AYRI BİR SAYFA. "NVIDIA bilançosu ne zaman" sorusunun cevabı
 * sitede vardı ama dağınıktı: hisse sayfasının özet künyesinde bir satır,
 * takvimde günün kartlarından biri. Arama sonucunda bu soruya doğrudan
 * cevap veren bir adres yoktu; hisse sayfasının başlığı "NVIDIA (NVDA)",
 * analiz sayfalarınınki geçmiş bir çeyrek. Bu sayfanın `<title>`ı soruyu
 * sorar ve cevabı taşır, `h1` altı tek cümleyle, ilk paragraf ayrıntıyla
 * cevaplar — üçü de aynı kaynaktan (takvim satırı) ve aynı kuralla.
 *
 * TR ÖNCE (CLAUDE.md "Saat"): Türkçede Türkiye saati, İngilizcede New York.
 * Sabit saat yazılmıyor; ABD yaz saati farkı tarihle hesaplanıyor
 * (`timePair`).
 *
 * DÜRÜSTLÜK (CLAUDE.md "Veri dürüstlüğü" 1): sağlayıcı dakika vermiyor.
 *   amc — "~23:00 TR": kapanış zili bilinen bir an, kapanış sonrası
 *         raporlar onun hemen ardından; yaklaşık işaretiyle yazılıyor.
 *   bmo — saat YOK, yalnız "açılıştan önce" ve açılışın saati. Rapor
 *         sabah erken herhangi bir anda gelebiliyor.
 *   dmh — pencerenin adı.
 *   pencere bilinmiyor — tarih "tahmini". Sağlayıcı takvimi gelecek
 *         raporları şirket duyurmadan da listeliyor ve pencere boşsa
 *         şirketin duyurduğuna dair elimizde bir işaret yok.
 * Event/FAQ yapılandırılmış verisi BİLİNÇLİ OLARAK YOK (gerekçe
 * `components/seo/JsonLd.tsx` başında); cevap görünen metinde.
 */

/** Sayfanın adresi — sembol küçük harf, `analysisHref` ile aynı yazım. */
export function earningsHref(symbol: string): string {
  return `/bilancolar/${symbol.toLowerCase()}`;
}

export type ReportWindow = "amc" | "bmo" | "dmh" | "unknown";

export function reportWindowOf(hour: string | null | undefined): ReportWindow {
  const value = hour?.trim().toLowerCase();
  return value === "amc" || value === "bmo" || value === "dmh" ? value : "unknown";
}

const DAY_MONTH = new Map<string, Intl.DateTimeFormat>();

/** "2026-11-19" → "19 Kasım" / "November 19" (yılsız, gün adsız — başlık için). */
export function dayMonth(dateEt: string, locale: Locale): string {
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  let format = DAY_MONTH.get(tag);
  if (!format) {
    format = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", timeZone: "UTC" });
    DAY_MONTH.set(tag, format);
  }
  return format.format(new Date(`${dateEt}T12:00:00Z`));
}

export type WindowNames = { afterClose: string; beforeOpen: string; duringMarket: string };

export type CompanyWhen = {
  window: ReportWindow | "none";
  /** Tarih pencere bilinmediği için tahmini mi. */
  estimated: boolean;
  /** `<title>`ın soru işaretinden sonraki kısmı; tarih yoksa null. */
  titleWhen: string | null;
  /** Okurun birincil saatiyle kapanış (amc) — "23:00". */
  closeClock: string | null;
  /** Okurun birincil saatiyle açılış (bmo) — "16:30". */
  openClock: string | null;
  /** İkincil dilimdeki karşılık: amc'de kapanış, bmo'da açılış. */
  secondaryClock: string | null;
  /** Pencere adı (Title Case, rozet); tarih yoksa null. */
  windowName: string | null;
};

/**
 * `next` takvim satırı (sağlayıcının tarihi), `dateLong` sayfanın uzun tarih
 * biçimi ("19 Kasım Perşembe") — cümlelerin içinde o kullanılıyor, başlıkta
 * yılsız gün-ay.
 */
export function companyWhen(
  next: { date: string; hour: string | null } | null,
  holidays: readonly MarketHoliday[],
  locale: Locale,
  names: WindowNames,
): CompanyWhen {
  if (!next) {
    return {
      window: "none",
      estimated: false,
      titleWhen: null,
      closeClock: null,
      openClock: null,
      secondaryClock: null,
      windowName: null,
    };
  }
  const window = reportWindowOf(next.hour);
  const tag = zoneTag(locale).primary;
  const day = dayMonth(next.date, locale);
  if (window === "amc") {
    const closeEt = clockOf(closeMinutesFor(next.date, [...holidays]));
    const pair = timePair(next.date, closeEt, locale);
    /* GECE YARISINI GEÇEN KAPANIŞ. ABD kış saatinde 16:00 ET, Türkiye'de
       ERTESİ GÜNÜN 00:00'ı: "19 Kasım, ~00:00 TR" okura bir gün erken bir
       an söylerdi. Okurun duvar takviminde gün değişiyorsa başlık o günü,
       saat de günüyle yazılıyor ("20 Kasım 00:00"); rapor tarihi (ET)
       cümlelerde ayrıca duruyor. Ölçü `zoneDateKey` — 24 saatlik fark değil
       takvim günü. */
    const localDate = zoneDateKey(etDateTimeToUtc(next.date, closeEt), displayZone(locale));
    const shifted = localDate !== next.date;
    const localDay = shifted ? dayMonth(localDate, locale) : day;
    return {
      window,
      estimated: false,
      titleWhen: `${localDay}, ~${pair.primary} ${tag} · ${names.afterClose}`,
      closeClock: shifted ? `${localDay} ${pair.primary}` : pair.primary,
      openClock: null,
      secondaryClock: pair.secondary,
      windowName: names.afterClose,
    };
  }
  if (window === "bmo") {
    const pair = timePair(next.date, clockOf(SESSION_BOUNDS.regularOpen), locale);
    return {
      window,
      estimated: false,
      titleWhen: `${day} · ${names.beforeOpen}`,
      closeClock: null,
      openClock: pair.primary,
      secondaryClock: pair.secondary,
      windowName: names.beforeOpen,
    };
  }
  if (window === "dmh") {
    return {
      window,
      estimated: false,
      titleWhen: `${day} · ${names.duringMarket}`,
      closeClock: null,
      openClock: null,
      secondaryClock: null,
      windowName: names.duringMarket,
    };
  }
  return {
    window,
    estimated: true,
    titleWhen: day,
    closeClock: null,
    openClock: null,
    secondaryClock: null,
    windowName: null,
  };
}

/** Şablon doldurucu — `{anahtar}` yerlerine değer. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Üç metin TEK yerden: `<title>`, açıklama, `h1` altı ve ilk paragraf.
 * Hepsi aynı `CompanyWhen`i okuyor ki başlık "~23:00" derken paragraf başka
 * bir saat söyleyemesin (CLAUDE.md "Veri dürüstlüğü" 3).
 */
export function companyCopy(input: {
  name: string;
  symbol: string;
  when: CompanyWhen;
  /** "19 Kasım Perşembe" — uzun tarih. */
  dateLong: string | null;
  /** "19 Kasım" — başlık ve açıklama. */
  dateShort: string | null;
  /** Tahmini etiketi ("Tahmini") — başlıkta parantezle. */
  labels: EarningsSeasonLabels["company"];
  windowLower: string | null;
}): { title: string; metaTitle: string; description: string; answer: string; lead: string } {
  const { name, symbol, when, labels } = input;
  const base = { name, symbol };
  const title = fill(labels.title, base);
  if (when.window === "none" || !input.dateLong || !input.dateShort) {
    return {
      title,
      metaTitle: fill(labels.metaTitleNone, base),
      description: fill(labels.metaDescriptionNone, base),
      answer: labels.answerNone,
      lead: fill(labels.leadNone, base),
    };
  }
  const values = {
    ...base,
    date: input.dateLong,
    clock: when.closeClock ?? "",
    open: when.openClock ?? "",
    window: input.windowLower ?? "",
  };
  const titleWhen = when.estimated ? `${when.titleWhen} (${labels.estimatedTag})` : (when.titleWhen ?? "");
  const metaTitle = fill(labels.metaTitle, { ...base, when: titleWhen });
  const description = when.estimated
    ? fill(labels.metaDescriptionEstimated, { ...values, date: input.dateShort })
    : fill(labels.metaDescription, { ...values, date: input.dateShort });
  const answerTemplate =
    when.window === "amc"
      ? labels.answerAmc
      : when.window === "bmo"
        ? labels.answerBmo
        : when.window === "dmh"
          ? labels.answerDmh
          : labels.answerUnknown;
  const leadTemplate =
    when.window === "amc"
      ? labels.leadAmc
      : when.window === "bmo"
        ? labels.leadBmo
        : when.window === "dmh"
          ? labels.leadDmh
          : labels.leadUnknown;
  return {
    title,
    metaTitle,
    description,
    answer: fill(answerTemplate, values),
    lead: fill(leadTemplate, values),
  };
}

const LOCK_FORMATS = new Map<string, Intl.DateTimeFormat>();

/**
 * Oylamanın kapanış anı okurun duvar saatiyle: "20 Kas 00:00 TR" /
 * "Nov 19, 16:00 NY". Kilit sitenin SEÇTİĞİ kesin bir an (gerekçe
 * `voteLockAt`), yaklaşık işareti taşımıyor. Sunucuda biçimleniyor:
 * istemcide biçimlemek tarayıcının saat dilimine göre farklı metin üretip
 * hidrasyonu bozardı.
 */
export function lockLabel(lockAt: Date, locale: Locale): string {
  const zone = displayZone(locale);
  const key = `${locale}|${zone}`;
  let format = LOCK_FORMATS.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: zone,
    });
    LOCK_FORMATS.set(key, format);
  }
  return `${format.format(lockAt)} ${zoneTag(locale).primary}`;
}
