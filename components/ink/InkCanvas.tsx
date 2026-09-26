"use client";

import { useEffect, useRef } from "react";
import type { InkPalette } from "@/lib/ink/engine";
import { INK_SCENES, sceneTime, type InkSceneName } from "@/lib/ink/scenes";
import { cn } from "@/lib/utils";

/**
 * Mürekkep sahnesini bir tuvale çizer.
 *
 * Süs: `aria-hidden`, odaklanamaz, tıklamayı geçirir. Kararlar:
 *
 * - Renkler TEMADAN okunuyor (`--text-strong`, `--brass`, `--page-bg`) ve
 *   `data-theme` değişince yeniden okunuyor; tuvalin zemini saydam, yani
 *   sahne hangi yüzeyde durursa o yüzeyin üstüne mürekkep düşüyor.
 * - Sahne İLK GÖRÜNDÜĞÜNDE başlıyor, bir kez oynuyor ve son karesinde
 *   duruyor. Sayfanın dibindeki bir boş durum, okuyucu oraya indiğinde
 *   çiziliyor — yüklenirken görünmeden oynayıp bitmiş olmuyor.
 * - Hareketi azaltan okuyucuya sahnenin son karesi TEK kez basılıyor. Motor
 *   saf olduğu için bu bir kısayol değil, aynı karenin kendisi.
 * - Ekrandan çıkarsa ya da sekme arka plana düşerse kare istenmiyor; geri
 *   gelince kaldığı saniyeden devam ediyor.
 * - Piksel yoğunluğu 2'de kesiliyor: 3x ekranda kazanç görünmüyor, maliyet
 *   dokuz kat piksel.
 * - `rate` sahnenin SAATİNİ hızlandırır, karelerini atlamaz: motor saf
 *   olduğu için 1,4 hızda da aynı çizim, yalnızca daha kısa sürede çıkar.
 *   Açılış bunu bir SON TARİHE uymak için kullanıyor (`InkSplash`).
 */
export function InkCanvas({
  scene,
  seed = 7,
  rate = 1,
  className,
  onDone,
}: {
  scene: InkSceneName;
  seed?: number;
  /** Sahne saatinin çarpanı: 1 yazıldığı hız, 1,4 aynı sahne %40 kısa. */
  rate?: number;
  className?: string;
  /** Sahne son karesine vardığında. */
  onDone?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const def = INK_SCENES[scene];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = rate > 0 ? rate : 1;

    let pal: InkPalette = readPalette();
    let raf = 0;
    let start = -1;
    let inView = false;
    let visible = false;
    let finished = false;
    let lastT = 0;

    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };

    const draw = (t: number) => {
      lastT = t;
      const { w, h } = def.box;
      const cw = canvas.width;
      const ch = canvas.height;
      const k = Math.min(cw / w, ch / h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.setTransform(k, 0, 0, k, (cw - w * k) / 2, (ch - h * k) / 2);
      def.render(ctx, sceneTime(def, t), pal, seed);
    };

    const tick = (now: number) => {
      if (start < 0) start = now;
      const t = ((now - start) / 1000) * speed;
      draw(t);
      if (t >= def.end) {
        raf = 0;
        finished = true;
        doneRef.current?.();
        return;
      }
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    const play = () => {
      if (reduce || raf || finished || !visible) return;
      // Kaldığı saniyeden devam: başlangıcı geçen süre kadar geri al.
      // Saat hızlandırılmışsa geri alınan gerçek süre de o kadar kısa.
      start = start < 0 ? -1 : performance.now() - (lastT / speed) * 1000;
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    size();
    if (reduce) {
      draw(def.end);
      finished = true;
      doneRef.current?.();
    }

    const ro = new ResizeObserver(() => {
      size();
      draw(lastT);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      visible = inView && !document.hidden;
      if (visible) play();
      else pause();
    });
    io.observe(canvas);

    const onVisibility = () => {
      visible = inView && !document.hidden;
      if (visible) play();
      else pause();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const mo = new MutationObserver(() => {
      pal = readPalette();
      draw(lastT);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      pause();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scene, seed, rate]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none block", className)}
    />
  );
}

function readPalette(): InkPalette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: v("--text-strong", "#101c2b"),
    spark: v("--brass", "#a4720f"),
    paper: v("--page-bg", "#f7f9fb"),
  };
}
