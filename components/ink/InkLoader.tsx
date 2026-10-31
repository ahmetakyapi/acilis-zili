"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { INK_SCENES, type InkSceneName } from "@/lib/ink/scenes";
import { BrandWord } from "@/components/brand/BellMark";
import { InkCanvas } from "./InkCanvas";

/**
 * Gezinme beklemesinin kartı — hedefe göre seçilmiş KISA FİLM (31 Ekim).
 *
 * SAHNE HIZLANDIRILMIŞ (`LOADER_RATE`). Kart ancak gezinme 420 ms'yi
 * geçince çıkıyor ve çoğu bekleyiş bir-iki saniyede bitiyor; yazıldığı
 * hızda oynayan bir sahnenin yalnızca ilk çizgileri görünürdü.
 *
 * İKİ PERDE, DONMA YOK. Sahne son karesinde durup bekliyordu; uzun bir
 * bekleyişte kart donmuş bir resim gibi kalıyor, okuyucu "takıldı" sanıp
 * yeniden tıklıyordu (sahibinin itirazı: "kısa film gibi ilerlesin").
 * Birinci perde hedefin sahnesi (habere giderken pres, bilançoya terazi);
 * o bitince ikinci perde: çalan zil, döngülü — sahnelerin "dönmez" kuralının
 * belgeli tek istisnası olan yükleme göstergesi (lib/ink/scenes.ts →
 * `loop`). Perdeler arası geçiş çapraz sönme.
 *
 * YAZI DA İLERLİYOR, YÜZDE DEĞİL. Perde yazıları süreye bağlı (`PHASE_AT`):
 * kaç saniye geçtiğini söyler, ne kadar kaldığını değil — bilmediğimiz bir
 * şeyi ilerleme gibi çizmek veri dürüstlüğüyle çelişirdi. Yazının altındaki
 * film şeridi perdeleri sayar (hangi perdedeyiz), kalanı ölçmez.
 *
 * Hareketi azaltana tek kare ve ilk yazı: tuval son kareyi basıyor
 * (InkCanvas), yazı değişmiyor. Etiket `status` rolüyle okunuyor; tuval
 * süs, `aria-hidden`.
 */
const LOADER_RATE = 1.5;
/** Perde yazılarının başladığı an (ms) — yazı dizisiyle aynı sırada. */
const PHASE_AT = [0, 1800, 4500, 9000] as const;
/** Saatin adımı; yazı geçişleri saniyenin altında hassasiyet istemiyor. */
const TICK_MS = 250;

export function InkLoader({
  scene,
  label,
  phases,
  brand,
}: {
  scene: InkSceneName;
  label: string;
  phases?: readonly string[];
  brand: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const reduced = useReducedMotion() ?? false;

  useEffect(() => {
    if (reduced) return;
    const started = performance.now();
    const timer = window.setInterval(() => setElapsed(performance.now() - started), TICK_MS);
    return () => window.clearInterval(timer);
  }, [reduced]);

  const firstActMs = (INK_SCENES[scene].end / LOADER_RATE) * 1000;
  const act = !reduced && elapsed >= firstActMs && scene !== "ringing" ? 2 : 1;
  const lines = phases && phases.length > 0 ? phases : [label];
  let phase = 0;
  for (let i = 0; i < Math.min(lines.length, PHASE_AT.length); i += 1) if (elapsed >= PHASE_AT[i]!) phase = i;
  const caption = reduced ? lines[0]! : lines[phase]!;

  return (
    <div className="route-loader-card" role="status" aria-live="polite">
      <span aria-hidden className="route-loader-brand">
        <BrandWord name={brand} />
      </span>
      <span className="route-loader-stage" aria-hidden>
        {/* Perdeler üst üste: biri sönerken öteki beliriyor. `key` perde
            değişince ikinci sahneyi baştan oynatıyor. */}
        <span className="route-loader-act" data-out={act === 2 || undefined}>
          <InkCanvas scene={scene} seed={13} rate={LOADER_RATE} className="route-loader-canvas" />
        </span>
        {act === 2 && (
          <span key="act-2" className="route-loader-act" data-in="">
            <InkCanvas scene="ringing" seed={13} className="route-loader-canvas" />
          </span>
        )}
      </span>
      <span key={caption} className="route-loader-label">
        {caption}
      </span>
      {lines.length > 1 && (
        <span aria-hidden className="route-loader-reel">
          {lines.map((line, index) => (
            <i key={line} data-on={index <= phase || undefined} data-now={index === phase || undefined} />
          ))}
        </span>
      )}
    </div>
  );
}
