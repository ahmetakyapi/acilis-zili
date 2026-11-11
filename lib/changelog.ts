import {
  CHANGELOG_EN,
  CHANGELOG_TR,
  CHANGE_AREAS,
  CHANGE_KINDS,
  CHANGE_SCREENS,
  TELEGRAM_HREF,
  type ChangeArea,
  type ChangeKind,
  type ChangeScreen,
} from "@/content/changelog";
import { formatIsoDate } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";

/**
 * Yenilikler — içerikten sayfaya giden saf katman (25 Ekim).
 *
 * İçerik (`content/changelog.ts`) iki dilli kaynak demeti; burada dile göre
 * düz girişlere çevriliyor, adresteki süzgeçler (tür, alan, ekran)
 * uygulanıyor, aylara ve haftalara bölünüyor. Sayfa, RSS akışı, paylaşım
 * görseli ve testler aynı fonksiyonları okuyor: akıştaki giriş ile
 * sayfadaki giriş ayrı düşemez.
 *
 * Düz modül (`server-only` değil): test `node --test` ile çağırıyor. İstemci
 * bileşenleri bunu İÇE AKTARMAZ — içerik demeti istemci paketine girerdi;
 * rozet yalnız en son günü prop olarak alır (`LATEST_CHANGE_DATE`).
 */

export { CHANGE_KINDS, type ChangeArea, type ChangeKind, type ChangeScreen };

export type ChangeItem = {
  kind: ChangeKind;
  area: ChangeArea;
  /** Etkilenen ekran — içerikte yazılıysa o, yoksa bağlantının rotasından (`screenOf`). */
  screen: ChangeScreen;
  title: string;
  /** Tek satırlık özet; yalnız en üstteki girişte zorunlu, öteki girişlerde `null`. */
  short: string | null;
  body: string;
  /** Dilsiz site içi yol ya da dış adres (Telegram); yoksa "Dene" basılmaz. */
  href: string | null;
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

/**
 * ROTA → EKRAN (6 Kasım). Bağlantının ilk segmenti ekranı söyler; ekranlar
 * okurun zihnindeki bölümler, rota başına bir ekran DEĞİL: Şirketler, Makro,
 * Temalar, Olasılıklar, Tarama ve Karşılaştır "Piyasalar"da; Günün Posteri,
 * Günün Grafiği ve oyunlar "Günün Parçaları"nda; haberler ve bülten Mercek'in
 * yanında. On iki ekrandan fazlası süzgeç şeridini kalabalıklaştırıyordu
 * (rotalar 30'u aşıyor). Listede olmayan rota ve dış adres "Site Geneli".
 */
const SCREEN_OF_ROUTE: Readonly<Record<string, ChangeScreen>> = {
  "": "anasayfa",
  piyasalar: "piyasalar",
  sirketler: "piyasalar",
  makro: "piyasalar",
  temalar: "piyasalar",
  olasiliklar: "piyasalar",
  tarama: "piyasalar",
  karsilastir: "piyasalar",
  hisse: "hisse",
  claude: "hisse",
  "hisse-secimi": "hisse",
  "teknik-analiz": "teknik",
  bilancolar: "bilancolar",
  takvim: "takvim",
  mercek: "mercek",
  bulten: "mercek",
  haberler: "mercek",
  topluluk: "mercek",
  "seans-silueti": "gunluk",
  "gunun-grafigi": "gunluk",
  bulmaca: "gunluk",
  favoriler: "portfoy",
  portfoy: "portfoy",
  "zil-raporu": "portfoy",
  analizlerim: "portfoy",
  rehber: "rehber",
  sozluk: "rehber",
  vergi: "rehber",
  "araci-kurumlar": "rehber",
  yatirimcilar: "rehber",
  ayarlar: "hesap",
  bildirimler: "hesap",
  giris: "hesap",
  kvkk: "hesap",
};

/** Maddenin ekranı: içerikte yazılı olan, yoksa bağlantının rotası, yoksa "Site Geneli". */
export function screenOf(explicit: ChangeScreen | undefined, href: string | undefined): ChangeScreen {
  if (explicit) return explicit;
  if (!href || !href.startsWith("/")) return "site";
  const first = href.split(/[?#]/)[0].split("/").filter(Boolean)[0] ?? "";
  return SCREEN_OF_ROUTE[first] ?? "site";
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
      items: source.items.map((item, itemIndex) => {
        const rawHref = "href" in item ? item.href : undefined;
        return {
          kind: item.kind,
          area: item.area,
          screen: screenOf("screen" in item ? item.screen : undefined, rawHref),
          title: items[itemIndex].title,
          short: items[itemIndex].short ?? null,
          body: items[itemIndex].body,
          href: resolveHref(rawHref, telegramUrl),
        };
      }),
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

/** Adresteki `?ekran=` değeri; tanınmayan değer süzgeçsiz sayılır. */
export function parseScreen(value: string | string[] | undefined): ChangeScreen | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return CHANGE_SCREENS.find((screen) => screen === raw) ?? null;
}

export type ChangeFilter = { kind: ChangeKind | null; area: ChangeArea | null; screen: ChangeScreen | null };

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
  /** Ekran süzgeci (6 Kasım) — aynı kural. */
  screen: ChangeScreen | null = null,
): ChangeEntry[] {
  if (!kind && !area && !screen) return [...entries];
  return entries
    .map((entry) => ({
      ...entry,
      items: entry.items.filter(
        (item) => (!kind || item.kind === kind) && (!area || item.area === area) && (!screen || item.screen === screen),
      ),
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
 * Alanların GÖSTERİM sırası (25 Ekim, mobil turu): süzgeç çipleri bu
 * sırayla. Claude sonda: sahibinin sözü, "ilk giren kullanıcı sadece Claude
 * ile karşılaşmasın". İçerikteki `CHANGE_AREAS` sırası değişmedi.
 */
export const AREA_DISPLAY_ORDER: readonly ChangeArea[] = ["piyasa", "bilanco", "kisisel", "icerik", "claude"];

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

type DigestColumn = { kind: ChangeKind; items: ChangeItem[] };

/**
 * SON GÜNCELLEMEDE (6 Kasım; sahibinin sözü: "son güncellemeyle ne geldi,
 * neler iyileşti, neler değişti hem onlar görünsün"). Son sürüm TÜR TÜR üç
 * sütun: Yeni, İyileştirme, Düzeltme — boş tür de sütun olarak döner (sayfa
 * "0" yazar; sütunun yokluğu "düzeltme yok"u söylemezdi).
 *
 * Önceki düzen (25 Ekim): en çok dört "Öne Çıkan" kart her alandan bir,
 * Claude maddeleri ayrı "Claude ile" grubunda, kalanı "Bu Sürümde Ayrıca"
 * (`splitLatest`). Okur sürümde neyin YENİ, neyin onarım olduğunu kartın
 * köşesindeki etiketten çıkarıyordu; tür artık sütunun kendisi.
 *
 * Alan çeşitliliği kararı korunuyor (25 Ekim, mobil turu; "ilk giren
 * kullanıcı sadece Claude ile karşılaşmasın"): her sütunda Claude maddeleri
 * sona iner, öteki maddeler girişteki sırasını korur.
 */
export function latestDigest(entry: ChangeEntry): DigestColumn[] {
  return CHANGE_KINDS.map((kind) => {
    const items = entry.items.filter((item) => item.kind === kind);
    return { kind, items: [...items.filter((i) => i.area !== "claude"), ...items.filter((i) => i.area === "claude")] };
  });
}

export type ScreenSummary = {
  screen: ChangeScreen;
  counts: Record<ChangeKind | "all", number>;
  /** O ekrana dokunan en yeni girişin günü; hiç madde yoksa `null`. */
  last: string | null;
};

/**
 * EKRAN HARİTASI (6 Kasım): ekran başına madde sayısı, türlere bölünmüş, ve
 * ekranın son değiştiği gün. `CHANGE_SCREENS` sırasıyla; hiç maddesi
 * olmayan ekran da döner (sayfa onu soldurur, süzgeçle boşalan ekran yerinde
 * kalır, ızgara zıplamaz). Girişler en yeni üstte geldiği için ilk görülen
 * gün en yenisidir.
 */
export function screenSummary(entries: readonly ChangeEntry[]): ScreenSummary[] {
  const map = new Map<ChangeScreen, ScreenSummary>(
    CHANGE_SCREENS.map((screen) => [screen, { screen, counts: { all: 0, yeni: 0, iyilestirme: 0, duzeltme: 0 }, last: null }]),
  );
  for (const entry of entries) {
    for (const item of entry.items) {
      const row = map.get(item.screen)!;
      row.counts.all += 1;
      row.counts[item.kind] += 1;
      if (!row.last || entry.date > row.last) row.last = entry.date;
    }
  }
  return [...map.values()];
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

const DAY_MS = 86_400_000;

const dayMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Günün haftasının pazartesisi (ISO gün). Hafta pazartesi başlar (TR takvimi). */
export function weekStart(iso: string): string {
  const ms = dayMs(iso);
  const weekday = (new Date(ms).getUTCDay() + 6) % 7; // pazartesi 0
  return isoOf(ms - weekday * DAY_MS);
}

export type FlowWeek = {
  /** Haftanın pazartesisi. */
  start: string;
  /** Bütün geçmişte o haftanın maddeleri, türe göre. */
  counts: Record<ChangeKind, number>;
  total: number;
  /** Süzgeçten geçen maddeler (süzgeç yoksa `counts` ile aynı). */
  matched: Record<ChangeKind, number>;
  matchedTotal: number;
  /** Haftadaki sürüm sayısı (bütün geçmiş). */
  releases: number;
  /** Sütuna basınca gidilecek giriş: haftanın süzgeçten geçen en yeni girişi; yoksa `null`. */
  anchor: string | null;
};

/**
 * HAFTALIK AKIŞ (6 Kasım; sahibinin sözü: "çubuklar ince ve küçük, son sürüm
 * dışında hepsi aynı boyda gibi"). 31 Ekim'in "Sürüm Akışı" her SÜRÜMÜ gün
 * ölçeğinde bir çubuk yapıyordu: 98 günlük eksende çubuk 1440'ta ~10, 390'da
 * ~3 piksel; sürümlerin çoğu 5-6 maddeydi ve tek istisna (16) ölçeği
 * belirlediği için ötekiler aynı kısa boyda okunuyordu. Şimdi her HAFTA bir
 * sütun (ilk girişin haftasından son girişin haftasına, boş hafta da sütun —
 * sessizlik görünür kalır): sütunlar alanı eşit böler (1440'ta ~80 piksel),
 * yığın TÜRE göre (alan değil: sayfanın sorusu "ne geldi, ne düzeldi") ve
 * süzgeç açıkken eşleşmeyen pay soluk kulvarda kalır, ölçek değişmez.
 * Eskiden yeniye sıralı.
 */
export function weeklyFlow(all: readonly ChangeEntry[], shown: readonly ChangeEntry[] = all): FlowWeek[] {
  if (all.length === 0) return [];
  const zero = (): Record<ChangeKind, number> => ({ yeni: 0, iyilestirme: 0, duzeltme: 0 });
  const dates = all.map((entry) => entry.date).sort();
  const first = dayMs(weekStart(dates[0]));
  const last = dayMs(weekStart(dates.at(-1)!));
  const weeks = new Map<string, FlowWeek>();
  for (let ms = first; ms <= last; ms += 7 * DAY_MS) {
    const start = isoOf(ms);
    weeks.set(start, { start, counts: zero(), total: 0, matched: zero(), matchedTotal: 0, releases: 0, anchor: null });
  }
  for (const entry of all) {
    const week = weeks.get(weekStart(entry.date))!;
    week.releases += 1;
    for (const item of entry.items) {
      week.counts[item.kind] += 1;
      week.total += 1;
    }
  }
  for (const entry of shown) {
    const week = weeks.get(weekStart(entry.date));
    if (!week) continue;
    if (!week.anchor || entry.date > week.anchor) week.anchor = entry.date;
    for (const item of entry.items) {
      week.matched[item.kind] += 1;
      week.matchedTotal += 1;
    }
  }
  return [...weeks.values()];
}
