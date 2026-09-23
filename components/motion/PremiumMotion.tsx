"use client";

import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import styles from "./PremiumMotion.module.css";
import { useMotionPreference } from "./useMotionPreference";

function classes(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

/**
 * Sunucu HTML'i görünür gelir. Yalnızca hidratasyondan sonra, henüz ekranın
 * altında duran bölümler giriş için hazırlanır; JS yoksa içerik kaybolmaz.
 * Dönüşüm bitince Motion onu kaldırır, iç içe sticky katmanlar bozulmaz.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opacity = useMotionValue(1);
  const y = useMotionValue(0);
  const reducedMotion = useMotionPreference();

  useEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion || !("IntersectionObserver" in window)) {
      opacity.set(1);
      y.set(0);
      return;
    }

    const rect = element.getBoundingClientRect();
    // İlk ekrandaki veri sabit kalır; giriş hareketi okumaya başladıktan
    // sonra karşılaşılan bölümlere ayrılır ve bir kez oynatılır.
    if (rect.top < window.innerHeight * 0.94) return;

    opacity.set(0);
    y.set(26);
    let stopAnimation: (() => void) | undefined;
    let revealed = false;
    const reveal = () => {
        if (revealed) return;
        revealed = true;
        observer.disconnect();
        window.removeEventListener("scroll", passedBy);
        const opacityAnimation = animate(opacity, 1, {
          duration: 0.55,
          delay: Math.min(Math.max(delay, 0), 0.3),
          ease: [0.22, 1, 0.36, 1],
        });
        const positionAnimation = animate(y, 0, {
          type: "spring",
          stiffness: 105,
          damping: 24,
          mass: 0.8,
          delay: Math.min(Math.max(delay, 0), 0.3),
        });
        stopAnimation = () => {
          opacityAnimation.stop();
          positionAnimation.stop();
        };
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal();
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0 },
    );
    // Bir kerede ATLANAN bölüm hiç açılmıyordu: End tuşu ya da uzun bir
    // parmak kaydırması bölümü iki kare arasında geçtiğinde gözlemci kesişme
    // görmüyor ve bölüm görünmez kalıyordu (teknik detayda Göstergeler
    // bölümü ölçüldü: 549px'lik bölüm 2271px'lik sıçramada kayboldu).
    // Kaydırmada bölüm görünüm alanının ÜSTÜNDE kaldıysa hemen açılır.
    const passedBy = () => {
      if (element.getBoundingClientRect().bottom < 0) reveal();
    };
    observer.observe(element);
    window.addEventListener("scroll", passedBy, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", passedBy);
      stopAnimation?.();
      opacity.set(1);
      y.set(0);
    };
  }, [delay, opacity, reducedMotion, y]);

  return (
    <motion.div ref={ref} className={classes(styles.reveal, className)} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

/**
 * Fiyat ve metinleri eğmeden imleci izleyen ışık. Hareket değerleri React
 * render'ı üretmez; dokunmatik ve azaltılmış hareket tercihi ışığı kapatır.
 * Dolgu, kenarlık ve yüzey tonu çağırana aittir; bu sarmal link değildir.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const enabled = useRef(false);
  const reducedMotion = useMotionPreference();
  const pointerX = useMotionValue(50);
  const pointerY = useMotionValue(50);
  const visible = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 250, damping: 32, mass: 0.45 });
  const y = useSpring(pointerY, { stiffness: 250, damping: 32, mass: 0.45 });
  const opacity = useSpring(visible, { stiffness: 200, damping: 28 });
  const background = useMotionTemplate`radial-gradient(520px circle at ${x}% ${y}%, var(--primary-faint), transparent 66%)`;

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    function update() {
      enabled.current = query.matches && !reducedMotion;
      if (!enabled.current) visible.set(0);
    }
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [reducedMotion, visible]);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!enabled.current || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX.set(((event.clientX - rect.left) / rect.width) * 100);
    pointerY.set(((event.clientY - rect.top) / rect.height) * 100);
    visible.set(0.7);
  }

  return (
    <div
      className={classes(styles.spotlight, className)}
      onPointerMove={onPointerMove}
      onPointerLeave={() => visible.set(0)}
      onPointerCancel={() => visible.set(0)}
    >
      {children}
      <motion.span
        aria-hidden="true"
        className={styles.spotlightGlow}
        style={{ background, opacity }}
      />
    </div>
  );
}

/** Okuma ilerlemesidir; sunucu isteğinin durumunu temsil etmez. */
export function ScrollProgress({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 32,
    restDelta: 0.001,
  });
  const reducedMotion = useMotionPreference();

  return (
    <motion.div
      aria-hidden="true"
      className={classes(styles.scrollProgress, className)}
      style={{ scaleX: reducedMotion ? scrollYProgress : smoothProgress }}
    />
  );
}

type SectionItem = { id: string; label: string };

/**
 * Doğal #çapalar JS olmadan da çalışır. IO yalnızca aktif bölümü değiştirir;
 * her scroll karesinde React durumu veya pencere dinleyicisi çalışmaz.
 */
export function SectionNav({
  items,
  label,
  className,
  trackAtNav = false,
}: {
  items: SectionItem[];
  label?: string;
  className?: string;
  /** Compact sections can end before the usual 30%-of-viewport reading line. */
  trackAtNav?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const navId = useId();
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const itemIds = items.map((item) => item.id).join("\n");
  const selectedId = items.some((item) => item.id === activeId) ? activeId : items[0]?.id;

  useEffect(() => {
    const nav = ref.current;
    if (!nav || !("IntersectionObserver" in window)) return;
    const sections = itemIds
      .split("\n")
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    if (!sections.length) return;

    // html zaten uygulama başlığı kadar scroll-padding taşıyor. Yalnızca
    // bu ek çubuğun payı eklenir; iki ofseti yeniden toplamak aşırı boşluk
    // yaratır. Önceki inline stil çıkışta geri konur.
    const previousMargins = sections.map((section) => section.style.scrollMarginBlockStart);
    function measureOffsets() {
      if (!nav) return;
      const top = Number.parseFloat(getComputedStyle(nav).top) || 0;
      const rootPadding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const extra = Math.max(0, top + nav.getBoundingClientRect().height + 18 - rootPadding);
      sections.forEach((section) => {
        section.style.scrollMarginBlockStart = `${extra}px`;
      });
    }
    measureOffsets();
    const resizeObserver = new ResizeObserver(measureOffsets);
    resizeObserver.observe(nav);

    let observer: IntersectionObserver;
    let settledReading: (() => void) | undefined;
    function observeReadingLine() {
      observer?.disconnect();
      if (settledReading) window.removeEventListener("scrollend", settledReading);
      if (!nav) return;
      const top = Number.parseFloat(getComputedStyle(nav).top) || 0;
      // Clamped at zero: a viewport shorter than the bar (a resize in
      // flight, a headless capture) yielded a negative line and an
      // invalid "--2px" root margin that threw on construction.
      const readingLine = Math.max(0, Math.min(window.innerHeight - 2, Math.max(
        top + nav.getBoundingClientRect().height + 24,
        trackAtNav ? 0 : window.innerHeight * 0.3,
      )));
      const updateActive = () => {
        const passed = sections.filter((section) => section.getBoundingClientRect().top <= readingLine + 2);
        const last = sections.at(-1)!;
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3;
        const current = atBottom && last.getBoundingClientRect().top < window.innerHeight
          ? last
          : passed.at(-1) ?? sections[0];
        setActiveId((previous) => {
          // Side-by-side sections share a top edge. Keep the selected member
          // of that row instead of immediately switching to its neighbour.
          const peer = passed.find((section) => section.id === previous &&
            Math.abs(section.getBoundingClientRect().top - current.getBoundingClientRect().top) < 2);
          return peer?.id ?? current.id;
        });
      };
      // Pixel margins keep the observation line aligned with the reading
      // threshold. Percentage root margins resolve against width, which
      // produced stale active tabs on wide screens and after anchor jumps.
      observer = new IntersectionObserver(updateActive, {
        rootMargin: `-${Math.round(readingLine)}px 0px -${Math.max(0, Math.round(window.innerHeight - readingLine - 2))}px 0px`,
        threshold: 0,
      });
      sections.forEach((section) => observer.observe(section));
      settledReading = updateActive;
      window.addEventListener("scrollend", settledReading);
      updateActive();
    }
    observeReadingLine();
    window.addEventListener("resize", observeReadingLine);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", observeReadingLine);
      if (settledReading) window.removeEventListener("scrollend", settledReading);
      resizeObserver.disconnect();
      sections.forEach((section, index) => {
        section.style.scrollMarginBlockStart = previousMargins[index];
      });
    };
  }, [itemIds, trackAtNav]);

  /* YAPIŞINCA BANT (23 Eylül). Yapışkan çubuk uygulama başlığının 12 piksel
     altında yüzen bir haptı: aradaki boşluktan ve hapın iki yanından
     içerik akıyor, panellerin kenarları çubuğun üstünde görünüyordu
     (teknik detayda hap 602 piksel, sağında panel başlıkları altından
     geçiyordu; telefonda yeşil panelin kenarı başlıkla hap arasında).
     Yapıştığı an arkasında tam genişlikte, başlıkla aynı zeminde bir bant
     açılıyor ve çubuk ikinci bir araç satırı gibi duruyor. Bant görünüm
     alanının solundan başlamalı; çubuğun kendi sol ofseti `--nav-x` ile
     veriliyor. Öznitelik React'in değil: bağlandıktan sonra yazılıyor,
     sunucu çizimiyle çatışmıyor. Yapışkan olmayan kullanımda (ana
     sayfanın akış sekmesi) hiç açılmıyor. */
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const style = getComputedStyle(nav);
      if (style.position !== "sticky") {
        delete nav.dataset.stuck;
        return;
      }
      const top = Number.parseFloat(style.top) || 0;
      const rect = nav.getBoundingClientRect();
      nav.style.setProperty("--nav-x", `${rect.left}px`);
      if (window.scrollY > 0 && rect.top <= top + 0.5) nav.dataset.stuck = "";
      else delete nav.dataset.stuck;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  /* AKTİF SEKME GÖRÜNÜRDE KALIR VE KENAR SOLAR.
     Beş sekme 390 pikselde 513 piksel istiyor (ölçüldü), yani şerit yatay
     kayıyor. Kaydırma kendi başına sorun değil; sorun İKİ eksikti. Birincisi
     okuyucu sayfayı aşağı kaydırdıkça aktif sekme şeridin dışına çıkıyordu:
     "Görüş Geçmişi"ni okurken çubukta hâlâ ilk üç sekme duruyor ve nerede
     olduğun hiçbir yerde yazmıyor. İkincisi kenarda kesilen sekme, kesildiği
     belli olmadan duruyordu — kaydırılacak bir şey olduğu anlaşılmıyordu.
     Kaydırma YATAY kutunun kendi içinde yapılıyor (`scrollLeft`), sayfa
     kaydırması değil: `scrollIntoView` burada sayfayı da zıplatırdı. */
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const markEdges = () => {
      const max = strip.scrollWidth - strip.clientWidth;
      strip.dataset.edge = max <= 1
        ? "none"
        : strip.scrollLeft <= 1 ? "end" : strip.scrollLeft >= max - 1 ? "start" : "both";
    };
    const active = strip.querySelector<HTMLElement>('[aria-current="location"]');
    if (active && strip.scrollWidth > strip.clientWidth + 1) {
      const target = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }
    markEdges();
    strip.addEventListener("scroll", markEdges, { passive: true });
    const resizeObserver = new ResizeObserver(markEdges);
    resizeObserver.observe(strip);
    return () => {
      strip.removeEventListener("scroll", markEdges);
      resizeObserver.disconnect();
    };
  }, [selectedId, itemIds]);

  if (!items.length) return null;

  return (
    <nav ref={ref} aria-label={label} className={classes(styles.sectionNav, className)}>
      <div ref={stripRef} className={styles.navItems}>
        {items.map((item) => {
          const active = selectedId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={styles.navLink}
              aria-current={active ? "location" : undefined}
              onClick={() => setActiveId(item.id)}
            >
              <span className={styles.navText}>{item.label}</span>
              {active && (
                <motion.span
                  aria-hidden="true"
                  layoutId={`${navId}-section-indicator`}
                  className={styles.navIndicator}
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                />
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * A scroll scene without pinned pages or spacer elements. Content reaches
 * its natural scale before the reading line; no values are counted from 0.
 */
export function ScrollStage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 22%"] });
  const scale = useTransform(scrollYProgress, [0, .85, 1], [.965, 1, 1]);
  const y = useTransform(scrollYProgress, [0, .85, 1], [38, 0, 0]);
  return <div ref={ref} className={classes(styles.stage, className)}>
    {/* CSS disables transforms for reduced motion before first paint. Keeping
        the same style on the server and client avoids a hydration mismatch. */}
    <motion.div className={styles.stageContent} style={{ scale, y }}>{children}</motion.div>
  </div>;
}

/**
 * Streamed server panels retain their HTML and accessibility. This leaf
 * stages marked rows and draws marked chart shapes when they enter view.
 * MutationObserver only watches inserted children, never animation styles.
 */
export function MotionExperience({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();
  useEffect(() => {
    const root = ref.current;
    if (!root || reduced || !("animate" in root) || !("IntersectionObserver" in window)) return;
    const prepared = new Map<Element, Animation>();
    const selector = "[data-motion-reveal], [data-motion-draw], [data-motion-stagger] > *, [data-motion-article] .oku-blok, .page-heading-copy > *, [data-motion-intro] > *, .spark-line, .spark-area, .spark-dot, .ring-fill, .panel";
    /* GÖZLENEN KUTU ÇİZGİNİN KENDİSİ DEĞİL, SVG'Sİ. Mini grafik çizgisi
       kırpmayla açılıyor ve giriş pozunda tamamen kırpık; Chrome kırpık
       öğeyi hiç kesişmiyor sayıyor ve ilk ekranın altındaki çizgiler
       görünür olduklarında da oynamıyor, kırpık kalıyordu (makro kartlarının
       ikinci sırası — ölçüldü). Çizgi, kırpılmayan SVG'si görününce oynuyor. */
    const targetOf = (element: Element) =>
      element.classList.contains("spark-line") ? (element as SVGElement).ownerSVGElement ?? element : element;
    const waiting = new Map<Element, Element[]>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        for (const element of waiting.get(entry.target) ?? []) {
          const animation = prepared.get(element);
          if (animation?.playState === "paused") animation.play();
        }
        waiting.delete(entry.target);
      }
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
    const watch = (element: Element) => {
      const target = targetOf(element);
      const list = waiting.get(target);
      if (list) list.push(element);
      else { waiting.set(target, [element]); observer.observe(target); }
    };
    const unwatch = (element: Element) => {
      const target = targetOf(element);
      observer.unobserve(target); waiting.delete(target);
    };
    function prepare() {
      if (!root) return;
      // Filtering directories replaces rows inside this persistent wrapper.
      // Release their animation objects instead of retaining every old list.
      for (const [element, animation] of prepared) {
        if (root.contains(element)) continue;
        animation.cancel(); unwatch(element); prepared.delete(element);
      }
      const elements = root.querySelectorAll<HTMLElement | SVGElement>(selector);
      elements.forEach((element) => {
        if (prepared.has(element) || element.closest("[data-motion-root]") !== root) return;
        const parent = element.parentElement;
        const intro = parent?.hasAttribute("data-motion-intro") || parent?.classList.contains("page-heading-copy");
        const siblings = intro || parent?.hasAttribute("data-motion-stagger") ? Array.from(parent!.children) : [];
        const delay = Math.min(240, Math.max(0, siblings.indexOf(element)) * (intro ? 55 : 65));
        const bar = element.dataset.motionDraw === "bar";
        const line = element.dataset.motionDraw === "line";
        const spark = element.classList.contains("spark-line");
        const arc = element.dataset.motionDraw === "arc";
        const area = element.classList.contains("spark-area");
        const dot = element.classList.contains("spark-dot");
        const ring = element.classList.contains("ring-fill");
        const origin = element.style.transformOrigin || "left center";
        const tall = element.getBoundingClientRect().height > window.innerHeight * .7;
        // Signed distance bars start at their zero reference: negative
        // values grow from the right. Existing lines retain their origin.
        // Curves reveal along the actual SVG path, never squeeze the series.
        /* Mini grafik çizgisi kırpmayla açılıyor, kesikle değil: gerekçesi
           globals.css → .spark-line (non-scaling-stroke kesiği kısaltıyor).
           Yay (`arc`) ölçeklenmiyor; orada kesik doğru ölçüyü veriyor. */
        const frames: Keyframe[] = spark
          ? [{ clipPath: "inset(-25% 100% -25% -2%)" }, { clipPath: "inset(-25% -2% -25% -2%)" }]
          : arc ? [{ strokeDashoffset: "1" }, { strokeDashoffset: "0" }]
          : ring ? [{ strokeDashoffset: element.style.getPropertyValue("--ring-circumference") }, { strokeDashoffset: getComputedStyle(element).strokeDashoffset }]
          : area ? [{ opacity: 0 }, { opacity: element.getAttribute("opacity") || 1 }]
          : dot ? [{ opacity: 0, transform: "scale(.5)" }, { opacity: 1, transform: "none" }]
          : bar ? [{ transform: "scaleY(.04)", transformOrigin: "center bottom" }, { transform: "scaleY(1)", transformOrigin: "center bottom" }]
          : line ? [{ transform: "scaleX(.04)", transformOrigin: origin }, { transform: "scaleX(1)", transformOrigin: origin }]
          : [{ opacity: intro ? .6 : .35, transform: tall ? "none" : `translateY(${intro ? 12 : 20}px)` }, { opacity: 1, transform: "none" }];
        /* Web Animations paints without mutating style/data attributes.
           Inline mutations on streamed Link nodes raced their hydration
           and produced a server/client mismatch. No timing guess is needed.
           Finish/cancel releases transforms for sticky descendants. CSS
           leaves charts fully drawn when JavaScript is absent. */
        const animation = element.animate(frames, {
          duration: spark || arc || bar || ring ? 1000 : 650,
          delay: delay + (area ? 220 : dot ? 700 : 0),
          easing: "cubic-bezier(.22,1,.36,1)", fill: "both",
        });
        animation.pause();
        animation.currentTime = 0;
        animation.onfinish = () => animation.cancel();
        prepared.set(element, animation);
        // A zero threshold also admits flat SVG strokes with zero-height bounds.
        watch(element);
      });
    }
    prepare();
    // Aynı atlama sorunu (bkz. Reveal): tek sıçramada geçilen kartlar ve
    // çubuklar giriş pozunda (%35 opaklık, 20px aşağıda) takılı kalıyordu.
    let passFrame = 0;
    const playPassed = () => {
      if (passFrame) return;
      passFrame = requestAnimationFrame(() => {
        passFrame = 0;
        for (const [element, animation] of prepared) {
          if (animation.playState !== "paused") continue;
          if (element.getBoundingClientRect().bottom < 0) { unwatch(element); animation.play(); }
        }
      });
    };
    window.addEventListener("scroll", playPassed, { passive: true });
    let frame = 0;
    const relevantNode = (node: Node) => node instanceof Element &&
      (prepared.has(node) || node.matches(selector) || Boolean(node.querySelector(selector)));
    const mutations = new MutationObserver((records) => {
      // The clock changes every second. Text-only updates need no DOM scan;
      // streamed cards and filter replacements are batched into one frame.
      if (!records.some((record) => [...record.addedNodes, ...record.removedNodes].some(relevantNode))) return;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; prepare(); });
    });
    mutations.observe(root, { childList: true, subtree: true });
    // A keyboard jump to an offscreen link reveals its entire ancestry at
    // once; no focused control should remain in its pending entrance pose.
    const revealFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      for (const [element, animation] of prepared) {
        if (element === event.target || element.contains(event.target)) {
          animation.cancel(); unwatch(element);
        }
      }
    };
    root.addEventListener("focusin", revealFocus);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(passFrame);
      window.removeEventListener("scroll", playPassed);
      observer.disconnect(); mutations.disconnect();
      root.removeEventListener("focusin", revealFocus);
      prepared.forEach((animation) => animation.cancel());
    };
  }, [reduced]);
  return <div ref={ref} className={classes(styles.experience, className)} data-motion-root>{children}</div>;
}
