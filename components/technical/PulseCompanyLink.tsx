"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LocaleLink } from "@/components/layout/LocaleLink";
import styles from "./CompanyBalloon.module.css";

/* Balonun genişliği CSS'te (`min(260px, 100vw - 24px)`); burada yalnızca
   kenar payı ve aralıklar. 320 pikselde 260 + 2×12 = 284, rahat sığıyor. */
const EDGE = 12;
/** Logo ile balon arası. */
const GAP = 10;
/** Güvenli bandın başlığa ve alt çubuğa uzaklığı. */
const BAND_INSET = 8;
/* NİYET GECİKMESİ 60 ms. İmleç dağılımın üstünden geçip aşağıdaki kartlara
   inerken on beş logonun her biri balon açmasın; 60 ms bir süpürmeyi
   eliyor ama bilerek durulan bir logoda gecikme hissedilmiyor. */
const OPEN_DELAY_MS = 60;
/* LOGODAN LOGOYA GEÇİŞ BEKLEMİYOR. Bir balon az önce kapandıysa okuyucu
   zaten okuyor demektir: komşu logonun balonu gecikmesiz ve giriş
   hareketi olmadan açılıyor, okuma yerinde değişiyor. */
const SWAP_WINDOW_MS = 240;

/* TEK BALON. Eski ipucu her logoda kendi 150 ms'lik kapanış sayacını
   tutuyordu ve A'dan B'ye hızlı geçişte ikisi birden açık kalıyordu
   (ölçüldü, /teknik 1440/1024/768'de iki [role=tooltip]). Artık açık balonun
   kapatıcısı modül düzeyinde tek bir yerde; yenisi açılmadan önce eskisi
   kapanıyor. */
let active: (() => void) | null = null;
let lastClosedAt = Number.NEGATIVE_INFINITY;

/**
 * Balonun sığabileceği dikey bant: yapışkan başlığın dibi ile alttaki sabit
 * çubuğun (masaüstünde borsa şeridi, telefonda sekme çubuğu) tepesi arası.
 *
 * TAHMİN DEĞİL, ÖLÇÜ. Eski ipucu "logo 290 pikselden aşağıdaysa üste aç"
 * diyordu; balonun gerçek boyu 187, başlık 0-69 (z 30), borsa şeridi
 * 863-900 idi ve z-90'daki ipucu ikisinin de üstüne boyanabiliyordu. Bant
 * artık açılış anında `.chrome` çubuklarından okunuyor: görünmeyen çubuk
 * (0 boyut) sayılmıyor, ekranın üst yarısındaki başlık, alt yarısındaki
 * alt çubuk.
 *
 * Ölçüldü (22 Eylül, 900 piksel yükseklik): bant masaüstünde 77-855,
 * telefon genişliğinde 77-812 (sekme çubuğu 820'de başlıyor). Balon
 * 296×208. /teknik 1440'ta MU logosu 199-231, balon altında 240-447;
 * ana sayfada logo 760'a kaydırılınca balon üstte 542-749. 320'de balon
 * 12-308, iki yanda 12 piksel. TR/EN × açık/koyu × 1440/1024/768/390/320
 * matrisinde her açılışta tek balon, hiçbiri bandın dışında değil ve
 * örttüğü komşu logoların hepsi `elementFromPoint`te hâlâ erişilebilir.
 */
function safeBand(): { top: number; bottom: number } {
  const height = window.innerHeight;
  let top = 0;
  let bottom = height;
  document.querySelectorAll<HTMLElement>(".chrome").forEach((bar) => {
    const box = bar.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const position = getComputedStyle(bar).position;
    if (position !== "fixed" && position !== "sticky") return;
    if (box.top < height / 2) top = Math.max(top, box.bottom);
    else bottom = Math.min(bottom, box.top);
  });
  return { top: top + BAND_INSET, bottom: bottom - BAND_INSET };
}

/**
 * Dağılım logosu — bağlantı ve üstünde açılan şirket balonu.
 *
 * Balonun içeriği (`summary`) sunucuda çizilip hazır geliyor
 * (`CompanyBalloon`); bu bileşen yalnızca ne zaman ve nerede açılacağına
 * karar veriyor. Portal gövdeye: kenar çubuğunun kırpması ve hareket
 * sisteminin dönüşümleri balonu kesmesin.
 *
 * DOKUNMATİKTE BALON YOK. Parmak doğrudan analize gidiyor (ölçüldü:
 * 390/320'de dokunuş /teknik/mu'ya gidiyor, 60 ms sonra balon yok) — logonun
 * işi bir bağlantı olmak, balon imleçli ekranın zenginleştirmesi. Klavye
 * odağı da açıyor ama yalnızca `:focus-visible` ise: Android Chrome
 * dokunulan bağlantıya odak veriyor ve kapı olmasaydı dokunuşta balon
 * bir an yanıp sönerdi.
 */
export function PulseCompanyLink({ href, label, className, children, summary }: {
  href: string;
  label: string;
  className: string;
  children: ReactNode;
  summary: ReactNode;
}) {
  const id = useId();
  const anchor = useRef<HTMLAnchorElement>(null);
  const balloon = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swap = useRef(false);
  const [open, setOpen] = useState(false);

  const close = useCallback(function closeBalloon() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (active === closeBalloon) {
      active = null;
      lastClosedAt = performance.now();
    }
    setOpen(false);
  }, []);

  const show = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (active && active !== close) active();
    swap.current = performance.now() - lastClosedAt < SWAP_WINDOW_MS;
    active = close;
    setOpen(true);
  }, [close]);

  /* YERLEŞİM ÖLÇÜLEREK. Balon önce görünmez çiziliyor (`data-side` yok →
     `visibility:hidden`), gerçek boyu okunuyor, sonra bant içinde yeri
     seçiliyor: sığıyorsa logonun altı, sığmıyorsa üstü, ikisi de
     sığmıyorsa geniş olan taraf banda kırpılarak. Konum React durumu
     değil, doğrudan düğüme yazılıyor — ölçüm karesi için ikinci bir
     çizim turu gerekmiyor. */
  useLayoutEffect(() => {
    const node = balloon.current;
    const link = anchor.current;
    if (!open || !node || !link) return;
    const rect = link.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const band = safeBand();
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, EDGE),
      viewport - width - EDGE,
    );
    const below = rect.bottom + GAP;
    const above = rect.top - GAP - height;
    let side: "below" | "above";
    let top: number;
    if (below + height <= band.bottom) {
      side = "below";
      top = below;
    } else if (above >= band.top) {
      side = "above";
      top = above;
    } else {
      side = band.bottom - rect.bottom >= rect.top - band.top ? "below" : "above";
      top = Math.min(
        Math.max(side === "below" ? below : above, band.top),
        Math.max(band.top, band.bottom - height),
      );
    }
    node.style.left = `${Math.max(EDGE, left)}px`;
    node.style.top = `${top}px`;
    if (swap.current) node.dataset.swap = "";
    node.dataset.side = side;
  }, [open]);

  /* KAPANIŞ: Escape, pencere boyutu, sayfadan ayrılış ve KAYDIRMA — ama
     yalnızca logoyu taşıyan kaydırma. Eski dinleyici yakalama evresinde
     HER öğenin kaydırmasını dinliyordu; sayfadaki ilgisiz bir tablonun ya
     da şeridin kaydırması da balonu kapatıyordu. Belgenin kendisi ya da
     logonun atası kayarsa balon logodan kopar, o zaman kapanıyor. */
  useEffect(() => {
    if (!open) return;
    const link = anchor.current;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const scroll = (event: Event) => {
      const target = event.target;
      if (target === document || (link && target instanceof Node && target.contains(link))) close();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("pagehide", close);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("pagehide", close);
    };
  }, [open, close]);

  /* Söküldüğünde (istemci gezinmesi) sayaç ve tekil kayıt temizleniyor:
     yoksa bir sonraki sayfanın ilk balonu var olmayan bir kapatıcıyı
     çağırırdı. */
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (active === close) active = null;
  }, [close]);

  return <>
    <LocaleLink
      ref={anchor}
      href={href}
      prefetch={false}
      className={className}
      aria-label={label}
      aria-describedby={open ? id : undefined}
      /* Açık balonun sahibi belli: balon ekran kenarına kırpılınca logonun
         tam üstünde durmayabiliyor, halka hangi logoya ait olduğunu söylüyor. */
      data-open={open ? "" : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        if (performance.now() - lastClosedAt < SWAP_WINDOW_MS) {
          show();
          return;
        }
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(show, OPEN_DELAY_MS);
      }}
      onPointerLeave={close}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) show();
      }}
      onBlur={close}
      onClick={close}
    >
      {children}
    </LocaleLink>
    {open && createPortal(
      <div ref={balloon} id={id} role="tooltip" className={styles.balloon}>{summary}</div>,
      document.body,
    )}
  </>;
}
