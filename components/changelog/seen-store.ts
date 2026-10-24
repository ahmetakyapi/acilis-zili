/**
 * Yenilikler — okurun son gördüğü giriş günü, tarayıcı deposunda.
 *
 * Kalıp `components/puzzle/puzzle-storage.ts`: düz modül (`"use client"`
 * değil), bileşenler `useSyncExternalStore` ile okur — efekt içinde durum
 * yazılmaz, sunucu çiziminde değer yok, hidrasyon farkı çıkmaz. Depo kapalı
 * ya da boşsa (gizli pencere, silinmiş site verisi) her erişim try/catch
 * içinde ve değer `null`: rozet o zaman `shouldBadge`in boş depo kuralına
 * düşer (`lib/changelog-seen.ts`).
 *
 * Anlık görüntü DİZE: aynı dize aynı değer, önbelleğe gerek yok.
 */
import { parseSeen } from "@/lib/changelog-seen";

const SEEN_KEY = "az-yenilikler-gorulen-v1";

const listeners = new Set<() => void>();

/** Bu sekmedeki yazma ve başka sekmelerin `storage` olayı. */
export function subscribeSeen(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SEEN_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function seenSnapshot(): string | null {
  try {
    return parseSeen(window.localStorage.getItem(SEEN_KEY));
  } catch {
    return null;
  }
}

/** Sunucuda ve hidrasyonda: "henüz bilinmiyor" — rozet basılmaz. */
export function seenServerSnapshot(): undefined {
  return undefined;
}

/** /yenilikler açılınca en son giriş okundu sayılır; geri gitmez. */
export function markSeen(date: string): void {
  const current = seenSnapshot();
  if (current && current >= date) return;
  try {
    window.localStorage.setItem(SEEN_KEY, date);
  } catch {
    // Depo kapalıysa okundu bilgisi tutulamaz: anlık görüntü boş kalır ve
    // rozet boş depo kuralına (yalnız taze girişte) düşer.
  }
  for (const listener of listeners) listener();
}
