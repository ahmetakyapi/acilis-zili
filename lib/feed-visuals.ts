import { formatInZone, zoneDateKey } from "./session-clock";

/**
 * AKIŞ VE LİSTE EKRANLARININ GÖRSEL KATMANI — saf hesaplar (25 Ekim).
 *
 * Sahibinin isteği: "tablo/liste hâlindeki yazılar görsel olarak eksik ve
 * okunamıyor hissettiriyor". Haberler, Analizlerim, Yenilikler ve
 * Bildirimler'in tepe cümlesi, sayım şeritleri ve gruplamaları burada;
 * sayfalar yalnız çiziyor. Veritabanı ve sağlayıcı yok: test `node --test`
 * ile çağırıyor (tests/feed-visuals.test.ts).
 *
 * Cümleler ŞABLON + VERİ: uydurma yorum yok, her sayı girdiden sayılıyor.
 * Sayıya ek getiren kalıp yok ("7'si" gibi), ek sayının okunuşuna bağlı.
 */

/* ---------------------------------------------------------------- Haberler */

export type PulseInput = { publishedAt: Date; mentions: readonly string[] };
export type PulseCompany = { symbol: string; count: number };
export type NewsPulse = {
  total: number;
  /** Akışın kapsadığı süre, en yeni haberden en eskiye, yukarı yuvarlanmış saat. */
  spanHours: number;
  top: PulseCompany[];
};

/** Şeritte kaç şirket — 1440'ta tek satır, telefonda kayan şerit. */
export const PULSE_TOP = 6;
/** Tek haberde geçen şirket "konuşulan" sayılmaz: şerit en az iki haber ister. */
export const PULSE_MIN_COUNT = 2;
const HOUR_MS = 3_600_000;

/**
 * Akışın nabzı: kaç haber, ne kadar zamanı kapsıyor, en çok hangi şirketler
 * geçiyor. Bir haber bir şirketi bir kez sayar (aynı başlıkta iki kez geçse
 * de). Eşitlikte önce daha yeni habere sahip olan, sonra alfabe: sıra her
 * çizimde aynı kalsın.
 */
export function newsPulse(items: readonly PulseInput[], top = PULSE_TOP): NewsPulse {
  if (items.length === 0) return { total: 0, spanHours: 0, top: [] };
  const times = items.map((item) => item.publishedAt.getTime());
  const spanHours = Math.max(1, Math.ceil((Math.max(...times) - Math.min(...times)) / HOUR_MS));
  const counts = new Map<string, { count: number; newest: number }>();
  for (const item of items) {
    for (const symbol of new Set(item.mentions)) {
      const entry = counts.get(symbol) ?? { count: 0, newest: 0 };
      entry.count += 1;
      entry.newest = Math.max(entry.newest, item.publishedAt.getTime());
      counts.set(symbol, entry);
    }
  }
  const ranked = [...counts.entries()]
    .filter(([, entry]) => entry.count >= PULSE_MIN_COUNT)
    .sort((a, b) => b[1].count - a[1].count || b[1].newest - a[1].newest || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([symbol, entry]) => ({ symbol, count: entry.count }));
  return { total: items.length, spanHours, top: ranked };
}

export type PulseLabels = {
  /** "{n}" haber, "{span}" süre parçası. */
  lead: string;
  leadOne: string;
  hours: string;
  hourOne: string;
  days: string;
  /** "{list}" — "NVDA (7), TSLA (5) ve MU (4)". */
  most: string;
  and: string;
};

/** Saat 48'i geçince gün: "son 52 saat" okunmuyor. */
const DAY_SWITCH_HOURS = 48;

/** "NVDA (7), TSLA (5) ve MU (4)" — son ikisinin arası bağlaç. */
export function joinList(parts: readonly string[], and: string): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts.at(-1)}`;
}

/** Tepe cümlesi — ilk üç şirket, sayılarıyla. */
export function pulseSentence(pulse: NewsPulse, L: PulseLabels): string | null {
  if (pulse.total === 0) return null;
  const span =
    pulse.spanHours >= DAY_SWITCH_HOURS
      ? L.days.replace("{n}", String(Math.round(pulse.spanHours / 24)))
      : pulse.spanHours === 1
        ? L.hourOne
        : L.hours.replace("{n}", String(pulse.spanHours));
  const lead = (pulse.total === 1 ? L.leadOne : L.lead).replace("{n}", String(pulse.total)).replace("{span}", span);
  const named = pulse.top.slice(0, 3).map((entry) => `${entry.symbol} (${entry.count})`);
  return named.length ? `${lead} ${L.most.replace("{list}", joinList(named, L.and))}` : lead;
}

export type HourGroup<T> = {
  /** "2026-10-25T14" — gün + en yeni saat, sayfada anahtar. */
  key: string;
  /** En eski saat dilimi "09:00" (tek dilimde tek saat). */
  from: string;
  /** En yeni saat diliminin BİTİŞİ "12:00"; tek dilimde `null`. */
  to: string | null;
  /** Okurun gününe göre: 0 bugün, -1 dün, daha eskisi tarih. */
  dayOffset: number;
  day: string;
  items: T[];
};

/** Saat durağı en az bu kadar haber taşır: tek haberlik durak iki sütunlu
    ızgarada yarım satır boş bırakıyordu (ilk denemenin 1440 görüntüsünde
    sabah saatlerinin dördü üst üste tek haberdi). Seyrek saatler komşusuyla
    birleşir. */
export const HOUR_GROUP_MIN = 2;

const pad = (hour: number) => `${String(hour % 24).padStart(2, "0")}:00`;

/**
 * Haberleri okurun saat dilimindeki SAAT duraklarına böler (zaman çizgisi).
 * Girdi en yeniden eskiye sıralı gelir, gruplar da öyle çıkar. Bir durak
 * `min` haberden azsa bir sonraki (daha eski) saatle birleşir ve "09:00–
 * 12:00" gibi aralık olur; gün sınırı aşılmaz (dünün haberi bugünün
 * durağına girmez). Son durak azınlıkta kalabilir — birleşecek komşu yok.
 */
export function groupByHour<T extends { publishedAt: Date }>(
  items: readonly T[],
  zone: string,
  now: Date = new Date(),
  min = HOUR_GROUP_MIN,
): HourGroup<T>[] {
  const today = Date.parse(`${zoneDateKey(now, zone)}T00:00:00Z`);
  const groups: (HourGroup<T> & { newest: number; oldest: number })[] = [];
  for (const item of items) {
    const day = zoneDateKey(item.publishedAt, zone);
    const hour = Number(formatInZone(item.publishedAt, zone).slice(0, 2));
    const last = groups.at(-1);
    if (last && last.day === day && (last.oldest === hour || last.items.length < min)) {
      last.items.push(item);
      last.oldest = Math.min(last.oldest, hour);
      continue;
    }
    const dayOffset = Math.round((Date.parse(`${day}T00:00:00Z`) - today) / 86_400_000);
    groups.push({ key: `${day}T${String(hour).padStart(2, "0")}`, from: "", to: null, dayOffset, day, items: [item], newest: hour, oldest: hour });
  }
  return groups.map(({ newest, oldest, ...group }) => ({
    ...group,
    from: pad(oldest),
    to: newest === oldest ? null : pad(newest + 1),
  }));
}

/* ------------------------------------------------------------- Analizlerim */

export const VERDICT_ORDER = ["buy", "hold", "sell", "insufficient"] as const;
export type VerdictKey = (typeof VERDICT_ORDER)[number];

/** Görüş dağılımı — sıra sabit (Al → Tut → Sat → Yetersiz), sıfırlar dahil. */
export function verdictMix(verdicts: readonly (string | null)[]): { key: VerdictKey; count: number; share: number }[] {
  const counts = new Map<VerdictKey, number>(VERDICT_ORDER.map((key) => [key, 0]));
  for (const raw of verdicts) {
    const key = (VERDICT_ORDER as readonly string[]).includes(raw ?? "") ? (raw as VerdictKey) : "insufficient";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = verdicts.length || 1;
  return VERDICT_ORDER.map((key) => ({ key, count: counts.get(key) ?? 0, share: (counts.get(key) ?? 0) / total }));
}

/**
 * "Rapordan Bugüne" kovaları — sıfırın iki yanında simetrik. Kova sınırı
 * yüzde puan; uçtaki kovalar açık uçlu. Sıfır tam ortada: soldaki kovalar
 * düşüş, sağdakiler yükseliş (renk yalnız bu yönden gelir).
 */
export const SINCE_EDGES = [-10, -5, 0, 5, 10] as const;

export type SinceBin = { from: number | null; to: number | null; count: number; side: "down" | "up" };

export function sinceBins(values: readonly number[]): SinceBin[] {
  const bins: SinceBin[] = [];
  const edges: (number | null)[] = [null, ...SINCE_EDGES, null];
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i];
    const to = edges[i + 1];
    bins.push({ from, to, count: 0, side: to !== null && to <= 0 ? "down" : "up" });
  }
  for (const value of values) {
    /* Sıfır yükseliş tarafına değil "değişmedi"ye ait; tam 0 nadir ve
       sağdaki ilk kovaya düşüyor (0 ≤ x < 5). */
    const index = bins.findIndex((bin) => (bin.from === null || value >= bin.from) && (bin.to === null || value < bin.to));
    if (index >= 0) bins[index].count += 1;
  }
  return bins;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Yükselen/düşen sayısı — tam sıfır ikisine de girmez. */
export function sinceSplit(values: readonly number[]): { up: number; down: number } {
  return { up: values.filter((v) => v > 0).length, down: values.filter((v) => v < 0).length };
}

/* ------------------------------------------------------------- Bildirimler */

export type DayGroup<T> = { day: string; dayOffset: number; items: T[] };

/** Gelen kutusu gün başlıkları — okurun diliminde; en yeni üstte. */
export function groupByDay<T extends { createdAt: Date }>(
  items: readonly T[],
  zone: string,
  now: Date = new Date(),
): DayGroup<T>[] {
  const today = Date.parse(`${zoneDateKey(now, zone)}T00:00:00Z`);
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const day = zoneDateKey(item.createdAt, zone);
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, dayOffset: Math.round((Date.parse(`${day}T00:00:00Z`) - today) / 86_400_000), items: [item] });
  }
  return groups;
}

/** Türe göre sayım — sıfır olan tür dönmez, sıra verilen sıra. */
export function countByKind<K extends string>(items: readonly { kind: K }[], order: readonly K[]): { kind: K; count: number }[] {
  return order
    .map((kind) => ({ kind, count: items.filter((item) => item.kind === kind).length }))
    .filter((entry) => entry.count > 0);
}

/* -------------------------------------------------------------- Yenilikler */

/**
 * "Dene" bağlantısının hedef ekranı — ikonun anahtarı. Dilsiz yol ya da dış
 * adres gelir; ilk yol parçası ekranı söyler ("/hisse/NVDA" → "/hisse").
 * Dış adres "external".
 */
export function tryTarget(href: string): string {
  if (/^https?:\/\//.test(href)) return "external";
  const path = href.split(/[?#]/)[0];
  const first = path.split("/").filter(Boolean)[0];
  return first ? `/${first}` : "/";
}
