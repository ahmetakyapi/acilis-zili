import {
  CHANGELOG_EN,
  CHANGELOG_TR,
  CHANGE_AREAS,
  CHANGE_KINDS,
  TELEGRAM_HREF,
  type ChangeArea,
  type ChangeKind,
} from "@/content/changelog";
import { formatIsoDate } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";

/**
 * Yenilikler — içerikten sayfaya giden saf katman (25 Ekim).
 *
 * İçerik (`content/changelog.ts`) iki dilli kaynak demeti; burada dile göre
 * düz girişlere çevriliyor, adresteki etiket süzgeci uygulanıyor, aylara
 * bölünüyor. Sayfa, RSS akışı, paylaşım görseli ve testler aynı
 * fonksiyonları okuyor: akıştaki giriş ile sayfadaki giriş ayrı düşemez.
 *
 * Düz modül (`server-only` değil): test `node --test` ile çağırıyor. İstemci
 * bileşenleri bunu İÇE AKTARMAZ — içerik demeti istemci paketine girerdi;
 * rozet yalnız en son günü prop olarak alır (`LATEST_CHANGE_DATE`).
 */

export { CHANGE_AREAS, CHANGE_KINDS, type ChangeArea, type ChangeKind };

export type ChangeItem = {
  kind: ChangeKind;
  area: ChangeArea;
  title: string;
  /** Tek satırlık özet; yalnız en üstteki girişte zorunlu, öteki girişlerde `null`. */
  short: string | null;
  body: string;
  /** Dilsiz site içi yol ya da dış adres (Telegram); yoksa "Dene" basılmaz. */
  href: string | null;
  /** İçerikte elle "öne çıkar" işareti (`featured: true`); yoksa `false`. */
  featured: boolean;
};

export type ChangeEntry = {
  /** Girişin son günü — sayfadaki çapanın ve akıştaki kimliğin anahtarı. */
  date: string;
  /** Giriş bir aralığı anlatıyorsa ilk gün. */
  from: string | null;
  title: string;
  summary: string;
  items: ChangeItem[];
};

/** En yeni girişin günü — "Yeni" rozeti bununla okurun son gördüğünü kıyaslar. */
export const LATEST_CHANGE_DATE: string = CHANGELOG_TR[0].date;

/** Sitede kaç giriş var — künye ve testler için. */
export const CHANGE_ENTRY_COUNT: number = CHANGELOG_TR.length;

/**
 * Bağlantı çözümü. `TELEGRAM_HREF` yer tutucusu kanal adresine döner; kanal
 * tanımlı değilse (henüz kurulmadı) madde bağlantısız kalır — var olmayan
 * kanala götüren "Dene" tıklamayı yutardı (`lib/site.ts` → TELEGRAM_URL).
 */
export function resolveHref(href: string | undefined, telegramUrl: string | null): string | null {
  if (!href) return null;
  if (href === TELEGRAM_HREF) return telegramUrl;
  return href;
}

/** Dile göre girişler, en yeni üstte. */
export function changelogEntries(locale: Locale, telegramUrl: string | null): ChangeEntry[] {
  return CHANGELOG_TR.map((source, index) => {
    const text = locale === "en" ? CHANGELOG_EN[index] : source;
    const items: readonly { title: string; short?: string; body: string }[] = text.items;
    return {
      date: source.date,
      from: "from" in source ? source.from : null,
      title: text.title,
      summary: text.summary,
      items: source.items.map((item, itemIndex) => ({
        kind: item.kind,
        area: item.area,
        title: items[itemIndex].title,
        short: items[itemIndex].short ?? null,
        body: items[itemIndex].body,
        href: resolveHref("href" in item ? item.href : undefined, telegramUrl),
        featured: "featured" in item && item.featured === true,
      })),
    };
  });
}

/** Adresteki `?tur=` değeri; tanınmayan değer süzgeçsiz sayılır. */
export function parseKind(value: string | string[] | undefined): ChangeKind | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return CHANGE_KINDS.find((kind) => kind === raw) ?? null;
}

/** Adresteki `?alan=` değeri; tanınmayan değer süzgeçsiz sayılır. */
export function parseArea(value: string | string[] | undefined): ChangeArea | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return CHANGE_AREAS.find((area) => area === raw) ?? null;
}

/**
 * Etiket süzgeci MADDE düzeyinde: "Düzeltme" seçilince her girişin yalnız
 * düzeltmeleri kalır, hiç düzeltmesi olmayan giriş düşer. Giriş düzeyinde
 * tek etiket seçilseydi en üstteki on beş maddelik sürüm tek bir "Yeni"
 * olurdu ve içindeki düzeltme hiç bulunamazdı.
 */
export function filterEntries(
  entries: readonly ChangeEntry[],
  kind: ChangeKind | null,
  /** Alan süzgeci (25 Ekim kompakt düzen) — aynı kural: madde düzeyinde, boş giriş düşer. */
  area: ChangeArea | null = null,
): ChangeEntry[] {
  if (!kind && !area) return [...entries];
  return entries
    .map((entry) => ({
      ...entry,
      items: entry.items.filter((item) => (!kind || item.kind === kind) && (!area || item.area === area)),
    }))
    .filter((entry) => entry.items.length > 0);
}

/** Alan başına madde sayısı — alan çiplerinin künyesi. */
export function areaCounts(entries: readonly ChangeEntry[]): Record<ChangeArea, number> {
  const counts = Object.fromEntries(CHANGE_AREAS.map((area) => [area, 0])) as Record<ChangeArea, number>;
  for (const entry of entries) for (const item of entry.items) counts[item.area] += 1;
  return counts;
}

/**
 * Girişin baskın alanı — sürüm akışında çubuğun rengi. En çok maddesi olan
 * alan; eşitlikte `CHANGE_AREAS` sırasında önce gelen (deterministik, iki
 * çizim aynı rengi verir).
 */
export function dominantArea(entry: ChangeEntry): ChangeArea {
  const counts = areaCounts([entry]);
  return CHANGE_AREAS.reduce((best, area) => (counts[area] > counts[best] ? area : best), CHANGE_AREAS[0]);
}

/** Öne çıkan kart sayısının tavanı — 1440'ta tek sıra, telefonda dört satır. */
export const FEATURED_MAX = 4;

/**
 * Alanların GÖSTERİM sırası (25 Ekim, mobil turu): süzgeç çipleri ve öne
 * çıkan kartlar bu sırayla. Claude sonda: sahibinin sözü, "ilk giren
 * kullanıcı sadece Claude ile karşılaşmasın". İçerikteki `CHANGE_AREAS`
 * sırası (baskın alanın eşitlik kuralı) değişmedi.
 */
export const AREA_DISPLAY_ORDER: readonly ChangeArea[] = ["piyasa", "bilanco", "kisisel", "icerik", "claude"];

/** Claude maddelerinin kendi küçük grubu ("Claude ile") — bu alan öne çıkan karta girmez. */
export const CLAUDE_AREA: ChangeArea = "claude";

export type LatestSplit = {
  /** Büyük kartlar: her alandan en çok BİR, `AREA_DISPLAY_ORDER` sırasıyla. */
  featured: ChangeItem[];
  /** "Claude ile" grubu: öne çıkan kart başka alanlardan seçildiyse Claude maddeleri. */
  claude: ChangeItem[];
  /** "Bu Sürümde Ayrıca": kalanlar, girişteki sırasıyla. */
  rest: ChangeItem[];
};

/**
 * ÖNE ÇIKANLAR — ALAN ÇEŞİTLİLİĞİ (25 Ekim, mobil turu). Önceki kural
 * alan turunu `CHANGE_AREAS` sırasıyla yapıp kartları girişteki sıraya
 * diziyordu; son sürümün ilk üç maddesi Claude olduğu için ilk kart hep
 * Claude'du ve telefonda ilk ekran yalnız Claude gösteriyordu.
 *
 * Seçim içerikten: bir maddede `featured: true` varsa yalnız işaretliler
 * (sırasıyla, tavana kadar). İşaret yoksa KURAL:
 *   1. her alanın ilk "yeni" ve denenebilir (bağlantılı) maddesi, alan
 *      başına EN ÇOK BİR, `AREA_DISPLAY_ORDER` sırasıyla (Piyasa,
 *      Bilanço, Kişisel, İçerik); kart sırası da bu;
 *   2. Claude kart olmaz, kendi grubunda toplanır — TEK İSTİSNA başka
 *      alandan aday yoksa (süzgeç `?alan=claude`): o zaman Claude'un ilk
 *      maddesi kart, grup açılmaz.
 * Kartın işi "Dene" demek: bağlantısız madde kart olmaz. Grup ve kalanlar
 * girişteki sırasını korur.
 */
export function splitLatest(items: readonly ChangeItem[], max: number = FEATURED_MAX): LatestSplit {
  let featured: ChangeItem[];
  if (items.some((item) => item.featured)) {
    featured = items.filter((item) => item.featured).slice(0, max);
  } else {
    const candidates = items.filter((item) => item.kind === "yeni" && item.href);
    const others = candidates.filter((item) => item.area !== CLAUDE_AREA);
    const pool = others.length > 0 ? others : candidates;
    featured = [];
    for (const area of AREA_DISPLAY_ORDER) {
      const first = pool.find((item) => item.area === area);
      if (first && featured.length < max) featured.push(first);
    }
  }
  const groupClaude = featured.some((item) => item.area !== CLAUDE_AREA);
  const left = items.filter((item) => !featured.includes(item));
  return {
    featured,
    claude: groupClaude ? left.filter((item) => item.area === CLAUDE_AREA) : [],
    rest: groupClaude ? left.filter((item) => item.area !== CLAUDE_AREA) : left,
  };
}

/** Etiket başına madde sayısı — süzgeç çiplerinin künyesi. */
export function kindCounts(entries: readonly ChangeEntry[]): Record<ChangeKind | "all", number> {
  const counts = { all: 0, yeni: 0, iyilestirme: 0, duzeltme: 0 };
  for (const entry of entries) {
    for (const item of entry.items) {
      counts.all += 1;
      counts[item.kind] += 1;
    }
  }
  return counts;
}

export type ChangeMonth = { month: string; entries: ChangeEntry[] };

/** "2026-10" anahtarlı ay grupları, sıra korunur (en yeni ay üstte). */
export function groupByMonth(entries: readonly ChangeEntry[]): ChangeMonth[] {
  const months: ChangeMonth[] = [];
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === month) last.entries.push(entry);
    else months.push({ month, entries: [entry] });
  }
  return months;
}

/** Sayfa içi çapa — ay bölümü. */
export function monthAnchor(month: string): string {
  return `ay-${month}`;
}

/** Sayfa içi çapa — giriş (akıştaki bağlantı da buna gider). */
export function entryAnchor(date: string): string {
  return `g-${date}`;
}

/**
 * Girişin günü ya da aralığı: "25 Ekim 2026", "24-25 Ekim 2026". Aralık
 * tireyle (arayüz metninde en dash yok); aynı ayın iki günü tek ay adıyla.
 */
export function entryDateLabel(entry: ChangeEntry, locale: Locale): string {
  const end = formatIsoDate(entry.date, locale, "long");
  if (!entry.from) return end;
  if (entry.from.slice(0, 7) === entry.date.slice(0, 7)) {
    const fromDay = Number(entry.from.slice(8));
    return locale === "tr" ? `${fromDay}-${end}` : end.replace(/(\w+) (\d+),/, `$1 ${fromDay}-$2,`);
  }
  return `${formatIsoDate(entry.from, locale, "long")} - ${end}`;
}

/**
 * Son sürümün maddeleri ALANA göre (25 Ekim): sıra `CHANGE_AREAS`, madde
 * sırası girişteki sıra; boş alan dönmez.
 */
export function groupByArea(items: readonly ChangeItem[]): { area: ChangeArea; items: ChangeItem[] }[] {
  return CHANGE_AREAS.map((area) => ({ area, items: items.filter((item) => item.area === area) })).filter(
    (group) => group.items.length > 0,
  );
}

/** Bir girişte geçen alanlar, `CHANGE_AREAS` sırasıyla — tek satırdaki renk noktaları. */
export function entryAreas(entry: ChangeEntry): ChangeArea[] {
  return CHANGE_AREAS.filter((area) => entry.items.some((item) => item.area === area));
}

const DAY_MS = 86_400_000;

export type ReleasePoint = {
  date: string;
  title: string;
  items: number;
  x: number;
  /** Baskın alan — çubuğun rengi (25 Ekim kompakt düzen). */
  area: ChangeArea;
};

/**
 * SÜRÜM ŞERİDİ (25 Ekim): her giriş bir çubuk; `x` ilk ve son giriş
 * arasında 0-1 (gün ölçeği, eşit aralık değil: sessiz haftalar boşluk
 * olarak görünsün), boyu madde sayısından, rengi baskın alandan. Eskiden
 * yeniye sıralı.
 */
export function releaseTimeline(entries: readonly ChangeEntry[]): ReleasePoint[] {
  if (entries.length === 0) return [];
  const day = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
  const sorted = [...entries].sort((a, b) => day(a.date) - day(b.date));
  const first = day(sorted[0].date);
  const span = Math.max(DAY_MS, day(sorted.at(-1)!.date) - first);
  return sorted.map((entry) => ({
    date: entry.date,
    title: entry.title,
    items: entry.items.length,
    x: (day(entry.date) - first) / span,
    area: dominantArea(entry),
  }));
}

/** Şeridin ay işaretleri: aralıktaki her ayın 1'i, 0-1 konumuyla. */
export function monthTicks(points: readonly ReleasePoint[]): { month: string; x: number }[] {
  if (points.length < 2) return [];
  const day = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
  const first = day(points[0].date);
  const span = Math.max(DAY_MS, day(points.at(-1)!.date) - first);
  const ticks: { month: string; x: number }[] = [];
  const cursor = new Date(`${points[0].date.slice(0, 7)}-01T12:00:00Z`);
  while (cursor.getTime() <= first + span) {
    const x = (cursor.getTime() - first) / span;
    if (x >= 0) ticks.push({ month: cursor.toISOString().slice(0, 7), x });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ticks;
}
