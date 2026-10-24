"use client";

import { useEffect, useMemo, useState } from "react";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { playBellSound, primeBellSound } from "@/components/sound/bell-sound";
import { makeHeroTap, type InkSceneName } from "@/lib/ink/scenes";
import { cn } from "@/lib/utils";
import { BELL_RANG_EVENT } from "./bell-event";
import { readBellEnergy } from "./bell-energy";
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
 * - ŞİDDET GÜNDEN (24 Ekim): kapanıştan sonra künye (DaySeal) o günün
 *   tek yönlülüğünü yazıyor (`bellEnergy`, lib/day-poster.ts; köprü
 *   `bell-energy.ts`) ve vuruş sahnesi onunla kuruluyor (`makeHeroTap`).
 *   Sıfırken kayıttaki `heroTap` ile birebir aynı sahne.
 *   ŞİDDET BASIŞ ANINDA DONDURULUYOR (25 Ekim): ilk sürüm şiddete abone
 *   olup sahneyi `energy`ye bağlı kuruyordu; okur zile bastıktan SONRA
 *   künye gelip şiddeti yazınca yeni sahne nesnesi InkCanvas'ın etkisini
 *   yeniden kuruyor ve vuruş kendiliğinden bir daha oynuyordu ("sahne bir
 *   kez oynar"). Şimdi değer basışta okunup `tap`e yazılıyor; sahne yalnız
 *   yeni bir basışla değişiyor. Abonelik de gereksizleşti: şiddet bir
 *   çizim girdisi değil, basışın girdisi.
 * - SES (24 Ekim, varsayılan kapalı — components/sound/bell-sound.ts):
 *   basınca tıklamanın içinde çalıyor; sayaç sıfırlanınca yalnızca bu
 *   sayfada bir etkileşimle açılmış bağlam varsa. Sayfadaki ilk dokunuş ya
 *   da tuş, ayar açıksa bağlamı açıyor ki zil anı da duyulsun. Ayar
 *   kapalıyken bağlam hiç kurulmuyor (`primeBellSound` önce tercihe bakıyor).
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
  /* Basış sayısı ve O BASIŞTAKİ şiddet (0…1; yalnız tamamlanmış seansın
     künyesi yazar). Sahne yalnız bu ikiliden kuruluyor. */
  const [tap, setTap] = useState({ count: 0, energy: 0 });
  const taps = tap.count;
  const tapScene = useMemo(() => (tap.energy > 0 ? makeHeroTap(tap.energy) : undefined), [tap]);
  useEffect(() => {
    const ring = () => {
      const energy = readBellEnergy();
      setTap((current) => ({ count: current.count + 1, energy }));
      playBellSound({ gesture: false, energy });
    };
    window.addEventListener(BELL_RANG_EVENT, ring);
    return () => window.removeEventListener(BELL_RANG_EVENT, ring);
  }, []);
  useEffect(() => {
    const prime = () => {
      primeBellSound();
    };
    const options = { once: true, capture: true } as const;
    window.addEventListener("pointerdown", prime, options);
    window.addEventListener("keydown", prime, options);
    return () => {
      window.removeEventListener("pointerdown", prime, options);
      window.removeEventListener("keydown", prime, options);
    };
  }, []);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(styles.button, className)}
      onClick={() => {
        const energy = readBellEnergy();
        setTap((current) => ({ count: current.count + 1, energy }));
        playBellSound({ gesture: true, energy });
      }}
    >
      <InkCanvas
        key={taps}
        scene={taps ? "heroTap" : scene}
        def={taps ? tapScene : undefined}
        seed={taps ? 11 + (taps % 5) : 11}
        delay={taps ? 0 : 0.55}
        className={styles.canvas}
      />
    </button>
  );
}
