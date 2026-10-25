/**
 * Rehber — okurun okuduğu yazılar, tarayıcı deposunda.
 *
 * Kalıp `components/changelog/seen-store.ts`: düz modül (`"use client"`
 * değil), bileşenler `useSyncExternalStore` ile okur — efekt içinde durum
 * yazılmaz, sunucu çiziminde değer yok (`undefined`: "henüz bilinmiyor"),
 * hidrasyon farkı çıkmaz. Depo kapalı ya da boşsa (gizli pencere, silinmiş
 * site verisi) her erişim try/catch içinde ve liste boş: yol haritası
 * "hiç okunmamış" hâline düşer, sayfa kırılmaz.
 *
 * Anlık görüntü HAM DİZE: aynı dize aynı değer, `useSyncExternalStore`
 * her çağrıda yeni bir dizi görüp sonsuz döngüye girmez. Çözümü
 * (`parseReadList`) okuyan bileşen yapar.
 */
import { parseReadList, withRead } from "@/lib/guide-progress";

const READ_KEY = "az-rehber-okunan-v1";

const listeners = new Set<() => void>();

/** Bu sekmedeki yazma ve başka sekmelerin `storage` olayı. */
export function subscribeRead(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === READ_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function readSnapshot(): string {
  try {
    return window.localStorage.getItem(READ_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Sunucuda ve hidrasyonda: bilinmiyor — sayaçlar basılmaz. */
export function readServerSnapshot(): undefined {
  return undefined;
}

/** Yazının sonuna inildi: okundu say. Geri alınmaz. */
export function markRead(slug: string): void {
  const current = parseReadList(readSnapshot());
  const next = withRead(current, slug);
  if (next === current) return;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(next));
  } catch {
    // Depo kapalıysa ilerleme tutulamaz; yol haritası "okunmamış" kalır.
    return;
  }
  for (const listener of listeners) listener();
}
