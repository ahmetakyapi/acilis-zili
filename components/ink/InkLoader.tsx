"use client";

import type { InkSceneName } from "@/lib/ink/scenes";
import { InkCanvas } from "./InkCanvas";

/**
 * Gezinme beklemesinin kartı — hedefe göre seçilmiş kısa film ve tek kelime.
 *
 * SAHNE HIZLANDIRILMIŞ (`LOADER_RATE`). Kart ancak gezinme 420 ms'yi
 * geçince çıkıyor ve çoğu bekleyiş bir-iki saniyede bitiyor; yazıldığı
 * hızda oynayan bir sahnenin yalnızca ilk çizgileri görünürdü. 1,5 hızda
 * açılış 1,5, terazi 2,1 saniyede tamamlanıyor. Bekleyiş daha uzunsa sahne
 * son karesinde durup bekliyor — dönmüyor (WCAG 2.2.2, sahnelerin kuralı).
 *
 * Etiket `status` rolüyle okunuyor; tuval süs, `aria-hidden`.
 */
const LOADER_RATE = 1.5;

export function InkLoader({ scene, label }: { scene: InkSceneName; label: string }) {
  return (
    <div className="route-loader-card" role="status" aria-live="polite">
      <InkCanvas scene={scene} seed={13} rate={LOADER_RATE} className="route-loader-canvas" />
      <span className="route-loader-label">{label}</span>
    </div>
  );
}
