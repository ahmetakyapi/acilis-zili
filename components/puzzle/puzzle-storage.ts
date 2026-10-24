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
import { emptyStats, parseProgress, parseStats, type PuzzleProgress, type PuzzleStats } from "@/lib/stock-puzzle";

const PROGRESS_KEY = "az-bulmaca-ilerleme-v1";
const STATS_KEY = "az-bulmaca-istatistik-v1";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Bu sekmedeki yazmalar ve başka sekmelerin `storage` olayı. */
export function subscribeStorage(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROGRESS_KEY || event.key === STATS_KEY || event.key === null) listener();
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

export function writeProgress(progress: PuzzleProgress): void {
  write(PROGRESS_KEY, progress);
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
