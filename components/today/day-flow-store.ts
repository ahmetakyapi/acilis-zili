import { useSyncExternalStore } from "react";
import type { DayFlowSnapshot } from "@/lib/day-flow";

/**
 * GÜN AKIŞININ TEK KAYNAĞI, İKİ YÜZEY.
 *
 * Seans şeridi kahramana taşındı (geri sayımın altında, `SessionRail`) ama
 * günün olaylarını okuyan ve otuz saniyede bir yoklayan bileşen hâlâ
 * `DayFlow`. Şeride ayrı bir istek ya da ikinci bir çizim eklemek, aynı
 * olayın iki yerde iki farklı durumla durabilmesi demekti. Onun yerine
 * `DayFlow` her birleştirilmiş fotoğrafı buraya yazıyor, şerit buradan
 * okuyor; şeritteki bir işarete basmak da seçimi buradan akışa iletiyor.
 * Sunucu çiziminde fotoğraf yok (`null`): şerit o anda yalnızca seansın
 * iskeletini çiziyor, işaretler akış bağlandığında geliyor.
 */
type Listener = () => void;

let current: DayFlowSnapshot | null = null;
const listeners = new Set<Listener>();
const selectors = new Set<(id: string) => void>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishFlow(snapshot: DayFlowSnapshot) {
  current = snapshot;
  listeners.forEach((listener) => listener());
}

export function useFlowSnapshot(): DayFlowSnapshot | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Şeritteki işaret: akışta o olayı seç. */
export function requestFlowSelect(id: string) {
  selectors.forEach((select) => select(id));
}

export function onFlowSelect(select: (id: string) => void) {
  selectors.add(select);
  return () => {
    selectors.delete(select);
  };
}
