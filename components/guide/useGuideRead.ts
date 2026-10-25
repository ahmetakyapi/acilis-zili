"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseReadList } from "@/lib/guide-progress";
import { readServerSnapshot, readSnapshot, subscribeRead } from "./guide-progress-store";

/**
 * Okunan yazıların kümesi. Sunucuda ve hidrasyonda `null` ("henüz
 * bilinmiyor"): sayaçlar o anda basılmaz, ilk istemci çiziminde gelir —
 * sunucu HTML'i ile ilk istemci çizimi aynı kalır.
 */
export function useGuideRead(): ReadonlySet<string> | null {
  const raw = useSyncExternalStore(subscribeRead, readSnapshot, readServerSnapshot);
  return useMemo(() => (raw === undefined ? null : new Set(parseReadList(raw))), [raw]);
}
