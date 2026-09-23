"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";

/* Fiyat noktasının yolculuğu: bant çizildikten (650 ms) 150 ms sonra
   başlıyor ve nokta (`spark-dot`, 700 ms'de beliriyor) o ana kadar analiz
   anındaki yerinde bekliyor. */
const TRAVEL_DELAY_MS = 800;
const TRAVEL_DURATION_MS = 700;
/* Süzgeç yapışıkken seçim değişince ilk kartın çubuğun altında bırakacağı
   pay — ızgaranın kendi satır aralığıyla aynı. */
const STUCK_SCROLL_GAP_PX = 14;

/** Native radios own filtering (including before hydration). This layer only
 * animates the change in position: no URL navigation, duplicated filter state,
 * or invented loading delay. Capture before the browser changes :checked. */
export function TechnicalBoard({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();

  /* YAPIŞIK HÂL VE SÜZGEÇTEN SONRA KONUM (23 Eylül). Hangi öğenin yapıştığı
     genişliğe bağlı (masaüstünde bütün araç çubuğu, telefonda yalnızca
     süzgeç), o yüzden ikisi de `data-sticky-bar` taşıyor ve soru CSS'e
     soruluyor: hesaplanmış konumu `sticky` olan hangisi. Öznitelik React'in
     değil, bağlandıktan sonra yazılıyor — sunucu çizimiyle çatışmıyor.

     Yapışıkken seçim değişince sayfa ızgaranın başına dönüyor: 390'da
     ızgaranın ortasında SAT'a basan okuyucunun belgesi 10.855 pikselden iki
     bin küsura iniyor, kaydırma dibe çakılıyor ve tek kart ekranın dışında
     kalıyordu. Bu bir hareket değil konum düzeltmesi; azaltılmış harekette
     de çalışıyor. */
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const bars = Array.from(root.querySelectorAll<HTMLElement>("[data-sticky-bar]"));
    let frame = 0;
    const check = () => {
      frame = 0;
      for (const bar of bars) {
        const style = getComputedStyle(bar);
        if (style.position !== "sticky") {
          delete bar.dataset.stuck;
          continue;
        }
        const top = Number.parseFloat(style.top) || 0;
        if (window.scrollY > 0 && bar.getBoundingClientRect().top <= top + 0.5) bar.dataset.stuck = "";
        else delete bar.dataset.stuck;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    /* Çubuğun YAPIŞIKKEN duracağı alt kenar, şu anki kutusu değil: belge
       kısalınca tarayıcı kaydırmayı hemen yeni dibe kırpıyor ve pano
       görünümün üstüne kaydığı için çubuk da yapışık yerinden kalkıyor —
       390'da SAT seçildiğinde kutusu ekranın 700 piksel üstündeydi ve
       düzeltme hiç tetiklenmiyordu (ölçüldü: tek kart -724'te kaldı). */
    const realign = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.name !== "technical-stance") return;
      const stuck = bars.find((bar) => bar.dataset.stuck !== undefined);
      const grid = root.querySelector<HTMLElement>("[data-motion-stagger]");
      if (!stuck || !grid) return;
      const stuckBottom = (Number.parseFloat(getComputedStyle(stuck).top) || 0) + stuck.offsetHeight;
      const offset = grid.getBoundingClientRect().top - stuckBottom - STUCK_SCROLL_GAP_PX;
      if (offset < 0) window.scrollTo({ top: window.scrollY + offset, behavior: "instant" });
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    root.addEventListener("change", realign);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.removeEventListener("change", realign);
    };
  }, []);

  /* Fiyat noktası analiz anındaki yerinden şimdiki yerine gidiyor
     (`LevelTrack` → `data-travel-from`). Kart görünüme girdiğinde bir kez;
     azaltılmış harekette hiç — orada iki işaret yan yana durur. */
  useEffect(() => {
    const root = ref.current;
    if (!root || reduced || !("IntersectionObserver" in window)) return;
    const dots = Array.from(root.querySelectorAll<HTMLElement>("[data-travel-from]"));
    const animations: Animation[] = [];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const dot = entry.target as HTMLElement;
        const from = dot.dataset.travelFrom;
        if (!from || !("animate" in dot)) continue;
        const animation = dot.animate([{ left: from }, { left: dot.style.left }], {
          duration: TRAVEL_DURATION_MS,
          delay: TRAVEL_DELAY_MS,
          easing: "cubic-bezier(.22,1,.36,1)",
          fill: "backwards",
        });
        animations.push(animation);
      }
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
    dots.forEach((dot) => observer.observe(dot));
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, [reduced]);

  useEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    let before = new Map<HTMLElement, DOMRect>();
    let animations: Animation[] = [];
    let frame = 0;
    const cells = () => Array.from(root.querySelectorAll<HTMLElement>("[data-verdict]"))
      .filter((element) => element.parentElement?.hasAttribute("data-motion-stagger"));
    const capture = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest("label, input");
      const control = target instanceof HTMLLabelElement ? target.control : target;
      if (!(control instanceof HTMLInputElement) || control.name !== "technical-stance" || !root.contains(control)) return;
      animations.forEach((animation) => animation.cancel());
      animations = [];
      before = new Map(cells().filter((cell) => cell.getClientRects().length).map((cell) => [cell, cell.getBoundingClientRect()]));
    };
    const transition = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.name !== "technical-stance") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        cells().filter((cell) => cell.getClientRects().length).forEach((cell, index) => {
          const old = before.get(cell);
          const next = cell.getBoundingClientRect();
          const dx = old ? old.left - next.left : 0;
          const dy = old ? old.top - next.top : 16;
          // Long jumps are a short entrance; the user should not have to
          // follow a card flying through several screens of content.
          const offset = Math.abs(dy) > window.innerHeight ? 16 : dy;
          const animation = cell.animate([
            { transform: `translate(${dx}px, ${offset}px)`, opacity: old ? 1 : .35 },
            { transform: "none", opacity: 1 },
          ], { duration: 420, delay: Math.min(index * 20, 100), easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
          animation.onfinish = () => animation.cancel();
          animations.push(animation);
        });
        before.clear();
      });
    };
    document.addEventListener("pointerdown", capture, true);
    document.addEventListener("keydown", capture, true);
    root.addEventListener("change", transition);
    return () => {
      document.removeEventListener("pointerdown", capture, true);
      document.removeEventListener("keydown", capture, true);
      root.removeEventListener("change", transition);
      cancelAnimationFrame(frame);
      animations.forEach((animation) => animation.cancel());
    };
  }, [reduced]);
  return <section ref={ref} className={className} aria-labelledby="technical-board">{children}</section>;
}
