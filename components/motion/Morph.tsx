"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Kartla sayfa arası geçiş — tıklanan kartın logosu yeni sayfanın başlığına
   UÇUYOR.

   NEDEN VIEW TRANSITIONS DEĞİL. Tarayıcının kendi API'si
   (`document.startViewTransition`) güncelleme bitene kadar ekranı DONDURUYOR.
   Detay sayfalarımız sunucudan geliyor ve gezinme yüzlerce milisaniye
   sürüyor: o süre boyunca okuyucu takılmış bir ekran görür, 420 ms'den sonra
   çıkması gereken yükleme kartı (RouteProgress) da donmuş karenin arkasında
   kalırdı. React'in `ViewTransition` bileşeni de bu sürümde yok.

   ONUN YERİNE "VARDIKTAN SONRA UÇUŞ". Tıklamada kaynağın (`data-morph`)
   ekrandaki yeri not ediliyor; yeni sayfa açılınca hedef (`MorphTarget`)
   kendini gizliyor, bir KOPYASI o noktadan kalkıp hedefin yerine uçuyor ve
   iniş anında gerçeğiyle yer değiştiriyor. Ekran hiç donmuyor; yavaş bir
   gezinmede yükleme kartı olağan biçimde çıkıyor ve uçuş sayfa geldiğinde
   başlıyor.

   KOPYA `body`de. Hedef sayfa girişinin (`.page-enter`, 0,35'ten yükselen
   bloklar) içinde; uçan öğe orada kalsaydı yarı saydam kalkardı.

   Kaynak yer EKRAN koordinatı: App Router yeni sayfada en üste kaydırıyor
   ve hedef de ekran koordinatıyla ölçülüyor, yani uçuş okuyucunun gözünün
   gördüğü yoldan gidiyor. Kayıt `FRESH_MS`ten eskiyse uçulmuyor — uzun bir
   bekleyişte okuyucu eski sayfayı kaydırmış olabilir ve logo artık orada
   durmayan bir yerden kalkardı.
   -------------------------------------------------------------------------- */

type Flight = {
  key: string;
  rect: { left: number; top: number; width: number; height: number };
  at: number;
};

/** Son tıklamanın kaynağı — tek bir bekleyen uçuş yeter. */
let pending: Flight | null = null;

/** Kayıt bundan eskiyse uçuş yok (gezinme başlangıcından ms). */
const FRESH_MS = 2500;
/** Uçuş süresi — sayfa başlığının imzasıyla (0,76 sn) aynı ailede, biraz kısa. */
const FLIGHT_MS = 560;

/**
 * Hedefin VARACAĞI yer — atalarında süren giriş animasyonlarının kaydırması
 * çıkarılarak.
 *
 * Ölçü anında sayfanın kendi girişi (`.page-enter`, 0,36 sn) kapağı 8 piksel
 * aşağıda tutuyordu; kopya oraya iniyor, gerçeği 8 piksel yukarıda
 * duruyordu ve inişte logo sıçrıyordu (ölçüldü, /teknik → /teknik/MU: kopya
 * y=186, hedef y=178). Uçuş o girişten uzun sürdüğü için iniş anında atalar
 * yerine oturmuş oluyor; yalnızca ölçünün düzeltilmesi yeterli.
 */
function settledRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.getAnimations().length === 0) continue;
    const m = new DOMMatrixReadOnly(getComputedStyle(node).transform);
    dx += m.e;
    dy += m.f;
  }
  return { left: r.left - dx, top: r.top - dy, width: r.width, height: r.height };
}

/** Kabukta bir kez: bağlantı tıklamalarında kaynağın yerini not eder. */
export function MorphRecorder() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!anchor) return;
      /* Kart bağlantısı çoğu zaman logoyu İÇERMİYOR (başlıktaki bağlantı
         kartı kaplıyor); kaynak, bağlantının kartında aranıyor. */
      const scope = anchor.closest("[data-morph-scope]") ?? anchor;
      const source = scope.querySelector<HTMLElement>("[data-morph]");
      const key = source?.dataset.morph;
      if (!source || !key) return;
      const r = source.getBoundingClientRect();
      pending = { key, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, at: performance.now() };
    };
    /* Geri ve ileri tuşları tıklama değil: bekleyen bir kayıt kalmışsa
       silinir, yoksa geri dönülen sayfada eski bir yerden uçuş başlardı. */
    const onHistory = () => {
      pending = null;
    };
    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onHistory);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onHistory);
    };
  }, []);
  return null;
}

/** Uçuşun hedefi — içindeki öğe, eşleşen bir kayıt varsa oradan gelir. */
export function MorphTarget({
  morphKey,
  className,
  children,
}: {
  morphKey: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const flight = pending;
    if (!el || !flight || flight.key !== morphKey) return;
    pending = null;
    if (performance.now() - flight.at > FRESH_MS) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof el.animate !== "function") return;

    /* Hedef ÖNCE gizleniyor, ölçü bir sonraki karede: App Router en üste
       kaydırmayı bu çizimin ardından yapıyor ve erken bir ölçü, sayfanın
       eski kaydırma konumuna göre olurdu. */
    el.style.visibility = "hidden";
    let clone: HTMLElement | null = null;
    let animation: Animation | null = null;
    const restore = () => {
      clone?.remove();
      clone = null;
      el.style.visibility = "";
    };
    const frame = requestAnimationFrame(() => {
      const to = settledRect(el);
      if (!to.width || !to.height) return restore();
      clone = el.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      Object.assign(clone.style, {
        position: "fixed",
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        margin: "0",
        zIndex: "40",
        pointerEvents: "none",
        transformOrigin: "top left",
        visibility: "visible",
      });
      document.body.appendChild(clone);
      const { rect } = flight;
      animation = clone.animate(
        [
          {
            transform: `translate(${rect.left - to.left}px, ${rect.top - to.top}px) scale(${rect.width / to.width}, ${rect.height / to.height})`,
          },
          { transform: "none" },
        ],
        { duration: FLIGHT_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      animation.onfinish = restore;
      animation.oncancel = restore;
    });
    return () => {
      cancelAnimationFrame(frame);
      animation?.cancel();
      restore();
    };
  }, [morphKey]);

  return (
    <span ref={ref} className={cn("inline-flex shrink-0", className)}>
      {children}
    </span>
  );
}
