"use client";
import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ElementType } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";

/** Görünür sayılmak için kutunun bu kadarı ekranda olmalı. */
const THRESHOLD = 0.25;
/** Bir kez oynayan sayaçta süre; halka çizimiyle (0,9 sn) aynı tempoda. */
const COUNT_MS = 900;

/**
 * Raporun çizimleri (fiyat eğrisi, puan şeritleri, sayaçlar) YÜKLENİNCE
 * değil GÖRÜNÜNCE oynar. Rapor tıklamadan sonra panele iniyor; yükleme
 * anında başlayan CSS animasyonu telefonda ekranın altındaki grafiği kimse
 * görmeden bitiriyordu. Kap `data-inview` alır, CSS animasyonlar
 * `[data-inview]` altında başlar. Hareketi azaltan için baştan görünür.
 */
export function InView<T extends ElementType = "div">({ as, ...props }: { as?: T } & ComponentPropsWithoutRef<T>) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  // İlk çizimde sunucu ile aynı (false): sunucuda gözlemci yok, ilk değeri ona bağlamak hidrasyon farkı yapıyordu.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    // Gözlemcisi olmayan tarayıcı görünür sayar; ertelenmiş geri çağrıda, effect gövdesinde eşzamanlı setState yok.
    if (typeof IntersectionObserver === "undefined") { const id = setTimeout(() => setSeen(true)); return () => clearTimeout(id); }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); observer.disconnect(); }
    }, { threshold: THRESHOLD });
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);
  const Tag = (as ?? "div") as ElementType;
  return <Tag ref={ref} data-inview={seen || reduced ? "" : undefined} {...props} />;
}

/** Sayı görününce marka eğrisine yakın bir yavaşlamayla (1 − (1 − t)⁴) sayar; ekran okuyucu yalnız son değeri duyar. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useMotionPreference();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || typeof IntersectionObserver === "undefined") return;
    let frame = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / COUNT_MS);
        setShown(Math.round(value * (1 - (1 - p) ** 4)));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: THRESHOLD });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [reduced, value]);
  // Panel yalnız istemcide çiziliyor: hareket açıksa sayaç 0'dan başlar, gerçek değeri gösterip geri sarmaz.
  return <span ref={ref}><span aria-hidden>{reduced ? value : shown ?? 0}</span><span className="sr-only">{value}</span></span>;
}
