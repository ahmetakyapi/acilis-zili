"use client";

import { useEffect, useState } from "react";
import { InkCanvas } from "@/components/ink/InkCanvas";
import type { InkSceneName } from "@/lib/ink/scenes";
import { cn } from "@/lib/utils";
import { BELL_RANG_EVENT } from "./bell-event";
import styles from "./HeroBell.module.css";

/**
 * Kahraman zili bir DÜĞME (14 Ekim) — "Zili Çal".
 *
 * Zil süstü: `aria-hidden`, tıklamayı geçiriyordu. Sahibi onu "daha
 * kullanışlı" istedi ve sitenin adını taşıyan karakterin tek yapamadığı
 * şey çalmaktı. Tıklanınca `heroTap` sahnesi oynuyor (lib/ink/scenes.ts —
 * kırpma, kurulma, iki vuruş, kıvılcım); her basış tuvali yeniden kurup
 * sahneyi baştan oynatıyor (`key`), yani sabırsız parmak zili istediği
 * kadar çalabiliyor.
 *
 * - Tohum basış sayısından türetiliyor: her vuruşun fırça dokusu ve
 *   kıvılcım saçılımı bir öncekinden ince farklı — deterministik, ama
 *   mekanik değil.
 * - İlk sahne (seansa göre uyuyan/bekleyen/çalan zil) ilk basışa kadar
 *   aynen korunuyor; `delay` yalnızca o açılış sahnesinin (sayfayla
 *   birlikte gelen tek kendiliğinden oynayış) bekleme payı.
 * - Hareketi azaltan okuyucuda InkCanvas son kareyi basar: düğme görsel
 *   olarak sessiz kalır ama odak halkası ve ad ("Zili Çal") durur —
 *   davranış eksik değil, hareketsiz.
 * - Ekran okuyucu için tek ad `aria-label`; tuval `aria-hidden` kalıyor.
 * - SAYAÇ SIFIRA VARINCA da aynı zil çalıyor: Countdown `BELL_RANG_EVENT`
 *   yayınlıyor (gerekçe bell-event.ts) ve zil anında markanın karakteri
 *   kendisi vuruyor — yanda beliren ikinci bir zil yok.
 */
export function HeroBell({
  scene,
  label,
  className,
}: {
  /** Seansa göre açılış sahnesi — page.tsx seçiyor. */
  scene: InkSceneName;
  label: string;
  className?: string;
}) {
  const [taps, setTaps] = useState(0);
  useEffect(() => {
    const ring = () => setTaps((count) => count + 1);
    window.addEventListener(BELL_RANG_EVENT, ring);
    return () => window.removeEventListener(BELL_RANG_EVENT, ring);
  }, []);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(styles.button, className)}
      onClick={() => setTaps((count) => count + 1)}
    >
      <InkCanvas
        key={taps}
        scene={taps ? "heroTap" : scene}
        seed={taps ? 11 + (taps % 5) : 11}
        delay={taps ? 0 : 0.55}
        className={styles.canvas}
      />
    </button>
  );
}
