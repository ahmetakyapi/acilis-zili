"use client";

import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
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
  const reducedMotion = useReducedMotion();

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
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
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
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
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
  const reducedMotion = useReducedMotion();
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
  const reducedMotion = useReducedMotion();

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
}: {
  items: SectionItem[];
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
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
      const readingLine = Math.min(window.innerHeight - 2, Math.max(
        top + nav.getBoundingClientRect().height + 24,
        window.innerHeight * 0.3,
      ));
      const updateActive = () => {
        const passed = sections.filter((section) => section.getBoundingClientRect().top <= readingLine + 2);
        const last = sections.at(-1)!;
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3;
        const current = atBottom && last.getBoundingClientRect().top < window.innerHeight
          ? last
          : passed.at(-1) ?? sections[0];
        setActiveId((previous) => previous === current.id ? previous : current.id);
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
  }, [itemIds]);

  if (!items.length) return null;

  return (
    <nav ref={ref} aria-label={label} className={classes(styles.sectionNav, className)}>
      <div className={styles.navItems}>
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
  const reduced = useReducedMotion();
  useEffect(() => {
    const root = ref.current;
    if (!root || reduced || !("animate" in root)) return;
    const prepared = new Map<Element, Animation>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        prepared.get(entry.target)?.play();
      }
    }, { threshold: .12, rootMargin: "0px 0px -3% 0px" });
    function prepare() {
      if (!root) return;
      // Filtering directories replaces rows inside this persistent wrapper.
      // Release their animation objects instead of retaining every old list.
      for (const [element, animation] of prepared) {
        if (root.contains(element)) continue;
        animation.cancel(); observer.unobserve(element); prepared.delete(element);
      }
      const elements = root.querySelectorAll<HTMLElement>("[data-motion-reveal], [data-motion-draw], [data-motion-stagger] > *");
      elements.forEach((element) => {
        if (prepared.has(element)) return;
        const siblings = element.parentElement?.hasAttribute("data-motion-stagger")
          ? Array.from(element.parentElement.children) : [];
        const delay = Math.min(400, Math.max(0, siblings.indexOf(element)) * 75);
        const bar = element.dataset.motionDraw === "bar";
        const line = element.dataset.motionDraw === "line";
        if (bar || line) element.getAnimations().forEach((animation) => animation.cancel());
        /* Web Animations paints without mutating style/data attributes.
           Inline mutations on streamed Link nodes raced their hydration
           and produced a server/client mismatch. No timing guess is needed. */
        const animation = element.animate(bar
          ? [{ transform: "scaleY(.04)", transformOrigin: "center bottom" }, { transform: "scaleY(1)", transformOrigin: "center bottom" }]
          : line ? [{ transform: "scaleX(.04)", transformOrigin: "left center" }, { transform: "scaleX(1)", transformOrigin: "left center" }]
          : [{ opacity: .25, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }],
          { duration: bar ? 1050 : 750, delay, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
        animation.pause();
        animation.currentTime = 0;
        animation.onfinish = () => animation.cancel();
        prepared.set(element, animation);
        observer.observe(element);
      });
    }
    prepare();
    const mutations = new MutationObserver(prepare);
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect(); mutations.disconnect();
      prepared.forEach((animation) => animation.cancel());
    };
  }, [reduced]);
  return <div ref={ref} className={classes(styles.experience, className)}>{children}</div>;
}
