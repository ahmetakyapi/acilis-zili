import { z } from "zod";
import type { IcsEvent } from "./ics";
import type { Locale } from "./i18n/config";
import type { calendarFeedTr } from "./i18n/dictionaries/calendar-feed";
import { etDateTimeToUtc } from "./market-hours";
import { absoluteUrl, SITE_URL } from "./site";
import { isValidSymbol } from "./utils";

/**
 * Takvim olayları → `.ics` etkinliği ve abonelik akışının sözleşmesi.
 *
 * İKİ UÇ, TEK KURUCU (14 Kasım 2026). "Takvime Ekle" (`/api/takvim`, tek
 * olay) ile takvim aboneliği (`/api/takvim/akis`, canlı akış) aynı olayı
 * AYNI kimlik ve aynı metinle yazar: okur bir bilançoyu önce tek tek ekleyip
 * sonra abone olursa takviminde iki ayrı anlatım durmasın. Etkinliğin
 * metni sözlükten (`calendarFeed`), anı `lib/market-hours.ts`ten; burada
 * ET↔UTC aritmetiği yok.
 *
 * AKIŞ HERKESE AÇIK VE ADRESLE TANIMLI. Şema, migration, kullanıcıya özel
 * belirteç yok: bilanço akışı sembol listesini adreste taşır. Takip listesi
 * değişince adres de değişir (okur yeniden abone olur); karşılığında
 * sızacak bir sır, iptal edilecek bir belirteç yok.
 *
 * Saf modül: veritabanı ve istek yok, testi `tests/calendar-feed.test.ts`.
 */

type FeedCopy = typeof calendarFeedTr;

/** Bir akışın taşıyabileceği en çok sembol. */
export const FEED_MAX_SYMBOLS = 40;

/* Pencereler (ET günü). Geçmişe kısa bir pay var: abone istemci akışı her
   çekişte bütünüyle değiştirir, yani pencereden çıkan olay okurun
   takviminden de silinir; dün açıklanan veri sabah takvimden kaybolmasın.
   İleri uç tohumlanan takvimin ve sağlayıcının bilanço ufkunun (yaklaşık
   bir çeyrek) biraz ötesi. */
export const MACRO_FEED_DAYS = { back: 14, ahead: 120 } as const;
export const EARNINGS_FEED_DAYS = { back: 7, ahead: 120 } as const;

/** İstemcinin akışı yeniden çekmesini istediğimiz aralık (saat). */
export const FEED_REFRESH_HOURS = 6;

export const FEED_IMPACTS = ["high", "medium", "low"] as const;
export type FeedImpact = (typeof FEED_IMPACTS)[number];

export type FeedQuery =
  | { kind: "makro"; locale: Locale; impact: FeedImpact | null }
  | { kind: "bilanco"; locale: Locale; symbols: string[] };

/* Ham dize tavanı: 40 sembol × en çok 10 karakter + virgüller 439 eder.
   Ayrıştırmadan önce bakılıyor ki megabaytlık bir sorgu bölünüp
   sıralanmasın. */
const SYMBOLS_RAW_MAX = 480;

/**
 * `semboller=NVDA,AAPL` → sıralı, tekil, büyük harfli liste.
 *
 * SIKI: boş parça (çift ya da sondaki virgül), boşluk, tanınmayan karakter
 * ve tavanı aşan liste REDDEDİLİR, sessizce düzeltilmez. Düzeltilen girdi
 * okura "abone oldum" dedirtip eksik takvim verirdi; ayrıca aynı listenin
 * sayısız yazımı ayrı önbellek anahtarı olurdu. Tek hoşgörü harf büyüklüğü
 * (tek olay ucu da öyle). Biçim ölçütü sitenin ortak süzgeci
 * (`isValidSymbol`): tablo sorgusuna yalnız sembol kılığındaki dize gider.
 */
export function parseFeedSymbols(raw: string): string[] | null {
  if (raw.length === 0 || raw.length > SYMBOLS_RAW_MAX) return null;
  const parts = raw.split(",").map((part) => part.toUpperCase());
  if (!parts.every(isValidSymbol)) return null;
  const unique = [...new Set(parts)].sort();
  return unique.length <= FEED_MAX_SYMBOLS ? unique : null;
}

const querySchema = z.discriminatedUnion("tur", [
  z.object({
    tur: z.literal("makro"),
    dil: z.enum(["tr", "en"]).default("tr"),
    onem: z.enum(FEED_IMPACTS).optional(),
  }),
  z.object({
    tur: z.literal("bilanco"),
    dil: z.enum(["tr", "en"]).default("tr"),
    semboller: z.string(),
  }),
]);

/**
 * Sorgu dizesi → doğrulanmış akış isteği; geçersizse `null` (uç 400 döner).
 *
 * Dil ADRESTEN (`dil=`), çerezden değil: akışı okurun tarayıcısı değil
 * takvim sağlayıcısının sunucusu çeker, çerez taşımaz; ayrıca çereze bağlı
 * yanıt `Cache-Control: public` ile paylaşılamazdı. Tanınmayan `onem`
 * değeri de 400: yok sayılsaydı "yalnız yüksek" isteyen okur haber
 * verilmeden bütün takvime abone olurdu.
 */
export function parseFeedQuery(params: URLSearchParams): FeedQuery | null {
  const parsed = querySchema.safeParse({
    tur: params.get("tur") ?? undefined,
    dil: params.get("dil") ?? undefined,
    onem: params.get("onem") ?? undefined,
    semboller: params.get("semboller") ?? undefined,
  });
  if (!parsed.success) return null;
  const query = parsed.data;
  if (query.tur === "makro") {
    return { kind: "makro", locale: query.dil, impact: query.onem ?? null };
  }
  const symbols = parseFeedSymbols(query.semboller);
  return symbols ? { kind: "bilanco", locale: query.dil, symbols } : null;
}

/**
 * Akışın site içi yolu. Semboller sıralı ve tekil yazılır: aynı liste her
 * zaman aynı adresi (ve aynı önbellek kaydını) üretir. Tavanı aşan listenin
 * ilk `FEED_MAX_SYMBOLS` sembolü alınır; çağıran bunu okura söyler.
 */
export function feedPath(query: FeedQuery): string {
  const params = new URLSearchParams({ tur: query.kind });
  if (query.kind === "makro") {
    if (query.impact) params.set("onem", query.impact);
  } else {
    /* Takip listesinden gelen sembol ucun süzgecinden geçmeyebilir (rakamlı
       ya da uzun kayıt); adrese girerse uç bütün aboneliği 400 ile
       reddederdi. Geçmeyen düşer, kalanlarla adres geçerli kalır. */
    const symbols = [...new Set(query.symbols.map((s) => s.toUpperCase()))].filter(isValidSymbol).sort();
    params.set("semboller", symbols.slice(0, FEED_MAX_SYMBOLS).join(","));
  }
  params.set("dil", query.locale);
  /* Virgül sorgu dizesinde güvenli; `%2C` adresi kopyalayan okur için
     okunmaz kılıyordu. */
  return `/api/takvim/akis?${params.toString().replace(/%2C/g, ",")}`;
}

/**
 * Abonelik adresleri: `https` (kopyalanıp Google Takvim'e yapıştırılan) ve
 * `webcal` (tıklanınca işletim sisteminin takvim uygulamasını açan). Alan
 * adı `SITE_URL`den, tarayıcının `location`ından değil (önizleme adresine
 * abone olunmasın). Akış dil öneki taşımaz: `/api` proxy eşleşmesinin
 * dışında, dil `dil=` parametresinde.
 */
export function feedUrls(query: FeedQuery, siteUrl: string = SITE_URL): { https: string; webcal: string } {
  const https = `${siteUrl}${feedPath(query)}`;
  return { https, webcal: https.replace(/^https?:\/\//, "webcal://") };
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Ham `importance` değeri sözlükteki karşılığına çevrilir (`t.calendar`). */
export function impactLabel(
  importance: string | null,
  labels: { impactHigh: string; impactMedium: string; impactLow: string },
): string {
  if (importance === "high") return labels.impactHigh;
  if (importance === "medium") return labels.impactMedium;
  if (importance === "low") return labels.impactLow;
  return importance ?? "-";
}

const WINDOWS = ["bmo", "amc", "dmh"] as const;
type EarningsWindow = (typeof WINDOWS)[number];

function windowOf(hour: string | null): EarningsWindow | null {
  const value = hour?.trim();
  return WINDOWS.find((w) => w === value) ?? null;
}

/**
 * Bilanço satırı → TÜM GÜN etkinliği.
 *
 * SAATİ BİLMİYORSAK TÜM GÜN. Sağlayıcı dakika vermiyor, yalnızca "açılış
 * öncesi / kapanış sonrası" diyor (`hour` = bmo/amc/dmh). Sahte bir saat
 * yazmak (ör. amc için 16:30) takvimde ölçülmüş bir randevu gibi görünürdü;
 * oysa elimizde pencere var, an yok. Pencere adı başlıkta ve açıklamada.
 *
 * KİMLİK sembol + rapor günü (`bilanco-NVDA-2026-11-19@acilis-zili`): aynı
 * satır her yayında aynı UID. Sağlayıcı tarihi revize ederse bu YENİ bir
 * kimliktir; abone istemci akışı bütünüyle değiştirdiği için eski gün
 * kendiliğinden düşer.
 */
export function earningsIcsEvent(
  row: { symbol: string; reportDate: string; hour: string | null; updatedAt?: Date | null },
  company: string | null,
  locale: Locale,
  copy: FeedCopy,
): IcsEvent {
  const window = windowOf(row.hour);
  const summary = fill(copy.earningsSummary, { symbol: row.symbol });
  const description = [
    fill(copy.earningsBody, { company: company || row.symbol, date: row.reportDate }),
    window
      ? fill(copy.earningsWindowKnown, { window: copy.windowInline[window] })
      : copy.earningsWindowUnknown,
    ...(window === "amc" ? [copy.earningsDateNote] : []),
  ].join(" ");

  return {
    uid: `bilanco-${row.symbol}-${row.reportDate}@acilis-zili`,
    summary: window ? `${summary} · ${copy.window[window]}` : summary,
    description,
    url: absoluteUrl(`/hisse/${row.symbol}`, locale),
    // Saat yok: tüm gün. Gerekçe yukarıdaki notta.
    date: row.reportDate,
    ...(row.updatedAt ? { lastModified: row.updatedAt } : {}),
  };
}

/**
 * Ekonomik olay → saati ilan edildiyse zamanlı (UTC), edilmediyse tüm gün.
 *
 * Saat ET olarak duruyor; UTC'ye çevrimi tek yerden geçiyor
 * (`lib/market-hours.ts`) — burada elle aritmetik yapılmıyor. `.ics` saati
 * UTC taşıdığı için etkinlik okurun takviminde onun kendi diliminde
 * görünür; yaz/kış saati farkı çevrimin içinde.
 *
 * KİMLİK `slug` + gün. Tohumlanan satırların slug'ı günü zaten taşıyor
 * (`cpi-2026-08-12`); eşitlemeden gelen bazı satırlarınki taşımıyor
 * (`lib/calendar-sync.ts`) ve tablonun tekil anahtarı (slug, gün) çifti.
 * Gün yalnız eksikse eklenir: tarihli slug'ın kimliği tek olay ucunun
 * bugüne dek yazdığıyla aynı kalır (`olay-cpi-2026-08-12@acilis-zili`),
 * tarihsiz slug'ın ayları aynı kimliği paylaşmaz.
 */
export function economicIcsEvent(
  row: {
    slug: string;
    eventDate: string;
    eventTimeEt: string | null;
    titleTr: string;
    titleEn: string;
    updatedAt?: Date | null;
  },
  /** Sözlükten çevrilmiş önem adı ("Yüksek"); ham `high` basılmaz. */
  impactLabel: string,
  locale: Locale,
  copy: FeedCopy,
): IcsEvent {
  const start = row.eventTimeEt ? etDateTimeToUtc(row.eventDate, row.eventTimeEt) : null;
  const body = fill(copy.economicBody, { impact: impactLabel });

  return {
    uid: `olay-${row.slug.endsWith(row.eventDate) ? row.slug : `${row.slug}-${row.eventDate}`}@acilis-zili`,
    summary: locale === "tr" ? row.titleTr : row.titleEn,
    description: start ? body : `${body} ${copy.economicNoTime}`,
    url: absoluteUrl("/takvim", locale),
    ...(start ? { start } : { date: row.eventDate }),
    ...(row.updatedAt ? { lastModified: row.updatedAt } : {}),
  };
}
