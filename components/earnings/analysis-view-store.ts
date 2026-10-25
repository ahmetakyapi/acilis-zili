/**
 * Analiz listesinin görünüm tercihi (kart / liste) — tarayıcı deposunda,
 * yalnız bu okur için bir kolaylık (25 Ekim görsel zirve).
 *
 * Kalıp `components/changelog/seen-store.ts`: düz modül, bileşen
 * `useSyncExternalStore` ile okur — efekt içinde durum yazılmaz, sunucu
 * çiziminde ve hidrasyonda varsayılan (kart), hidrasyon farkı çıkmaz.
 * Depo kapalıysa (gizli pencere, engelli site verisi) seçim bellekte
 * tutulur ve yalnız bu açılışta geçerli kalır.
 */
export type AnalysisView = "cards" | "rows";

const VIEW_KEY = "az-analysis-view";
const listeners = new Set<() => void>();
let memory: AnalysisView | null = null;

export function subscribeView(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === VIEW_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function viewSnapshot(): AnalysisView {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "rows" || stored === "cards") return stored;
  } catch {
    /* Depo kapalı — bellekteki seçim. */
  }
  return memory ?? "cards";
}

export function viewServerSnapshot(): AnalysisView {
  return "cards";
}

export function setView(view: AnalysisView): void {
  memory = view;
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* Depo kapalı — seçim yalnız bu açılışta. */
  }
  for (const listener of listeners) listener();
}
