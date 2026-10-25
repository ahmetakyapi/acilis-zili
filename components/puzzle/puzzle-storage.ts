/**
 * "Hisseyi Bil" tarayıcı deposu — günün ilerlemesi ve istatistik.
 *
 * İLK SÜRÜMDE VERİTABANI YOK (24 Ekim): oturum açık olsa da seri bu
 * tarayıcıda. Depo kapalı ya da boşsa (gizli pencere, silinmiş site
 * verisi) oyun yine baştan oynanır; her erişim try/catch içinde. Düz modül,
 * `"use client"` değil: hem oyun hem ana sayfa girişi buradan okuyor.
 *
 * Bileşenler `useSyncExternalStore` ile okur (efekt içinde durum yazmadan,
 * sunucu çiziminde `null`). Anlık görüntü HAM DİZEYE göre önbellekli: aynı
 * dize aynı nesneyi döndürür, yoksa her çizim yeni nesne görüp döngüye
 * girerdi.
 */
import {
  ARCHIVE_COOKIE,
  HISTORY_LIMIT,
  PROGRESS_COOKIE,
  PROGRESS_COOKIE_MAX_AGE,
  emptyStats,
  parseHistory,
  parseProgress,
  parseStats,
  progressCookieValue,
  type HistoryEntry,
  type PuzzleHistory,
  type PuzzleProgress,
  type PuzzleStats,
} from "@/lib/stock-puzzle";

const PROGRESS_KEY = "az-bulmaca-ilerleme-v1";
const STATS_KEY = "az-bulmaca-istatistik-v1";
/** Gün başına oyun geçmişi — arşiv ızgarasının rozetleri (25 Ekim). */
const HISTORY_KEY = "az-bulmaca-gecmis-v1";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Bu sekmedeki yazmalar ve başka sekmelerin `storage` olayı. */
export function subscribeStorage(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROGRESS_KEY || event.key === STATS_KEY || event.key === HISTORY_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Depo kapalıysa ilerleme yalnızca bu sekmede yaşar.
  }
  emit();
}

/** Bugünün ilerlemesi; başka günün kaydı yok sayılır. */
export function readProgress(day: string): PuzzleProgress | null {
  const progress = parseProgress(parseJson(readRaw(PROGRESS_KEY)));
  return progress && progress.day === day ? progress : null;
}

function writeCookie(name: string, day: string, guesses: readonly string[]): void {
  try {
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${name}=${progressCookieValue(day, guesses)}; path=/; max-age=${PROGRESS_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  } catch {
    // Çerez kapalıysa geri yükleme depodan, istemcide.
  }
}

/** Günlük bulmacanın ilerlemesi: depo + sunucunun ilk çizimi için çerez
    kopyası (gerekçe `PROGRESS_COOKIE`). */
export function writeProgress(progress: PuzzleProgress): void {
  write(PROGRESS_KEY, progress);
  writeCookie(PROGRESS_COOKIE, progress.day, progress.guesses);
}

/** Arşiv oyununun çerezi — günlüğün çerezini ezmesin diye ayrı. */
export function writeArchiveCookie(day: string, guesses: readonly string[]): void {
  writeCookie(ARCHIVE_COOKIE, day, guesses);
}

export function readHistory(): PuzzleHistory {
  return parseHistory(parseJson(readRaw(HISTORY_KEY)));
}

/** Bir günün geçmiş kaydını yazar; tavanı aşan en eski günler düşer. */
export function writeHistoryEntry(day: string, entry: HistoryEntry): void {
  const next = { ...readHistory(), [day]: entry };
  const days = Object.keys(next).sort().reverse().slice(0, HISTORY_LIMIT);
  write(HISTORY_KEY, Object.fromEntries(days.map((key) => [key, next[key]])));
}

let historyCache: { raw: string | null; value: PuzzleHistory } = { raw: null, value: {} };

/** Geçmiş — `useSyncExternalStore` anlık görüntüsü (ham dizeye göre önbellekli). */
export function historySnapshot(): PuzzleHistory {
  const raw = readRaw(HISTORY_KEY);
  if (raw !== historyCache.raw) historyCache = { raw, value: parseHistory(parseJson(raw)) };
  return historyCache.value;
}

export function readStats(): PuzzleStats {
  const raw = parseJson(readRaw(STATS_KEY));
  return raw ? parseStats(raw) : emptyStats();
}

export function writeStats(stats: PuzzleStats): void {
  write(STATS_KEY, stats);
}

let progressCache: { raw: string | null; value: PuzzleProgress | null } = { raw: null, value: null };
let statsCache: { raw: string | null; value: PuzzleStats | null } = { raw: null, value: null };

/** İlerleme (gün süzmesi çağıranda) — `useSyncExternalStore` anlık görüntüsü. */
export function progressSnapshot(): PuzzleProgress | null {
  const raw = readRaw(PROGRESS_KEY);
  if (raw !== progressCache.raw) progressCache = { raw, value: parseProgress(parseJson(raw)) };
  return progressCache.value;
}

/** İstatistik; hiç oynanmamışsa boş istatistik. */
export function statsSnapshot(): PuzzleStats | null {
  const raw = readRaw(STATS_KEY);
  if (raw !== statsCache.raw || statsCache.value === null) {
    const parsed = parseJson(raw);
    statsCache = { raw, value: parsed ? parseStats(parsed) : emptyStats() };
  }
  return statsCache.value;
}
