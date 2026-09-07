"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import { Bell } from "@phosphor-icons/react";
import { motion, useReducedMotion, useScroll, useTransform, useMotionValue, useSpring } from "motion/react";
import styles from "./MarketScene.module.css";

/**
 * Zil sahnesi süre göstermez; gerçek geri sayım children içindeki ayrı
 * yapraktır. Kaydırma zili ve yankı halkalarını derinlikte açar. Metin ve
 * sayılar sabit kalır, sahne mobilde kısalır, hareket tercihi korunur.
 */
export function MarketScene({
  trading,
  sessionLabel,
  children,
}: {
  trading: boolean;
  sessionLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const tiltX = useSpring(pointerX, { stiffness: 120, damping: 20 });
  const tiltY = useSpring(pointerY, { stiffness: 120, damping: 20 });
  const light = useTransform(tiltX, [-8, 8], ["18%", "82%"]);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left - rect.width / 2) / rect.width * 16);
    pointerY.set(-(event.clientY - rect.top - rect.height / 2) / rect.height * 10);
  }
  function leave() { pointerX.set(0); pointerY.set(0); }
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [-13, 8]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -42]);
  const ringScale = useTransform(scrollYProgress, [0, 1], [1, 1.28]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [-22, -5]);

  return (
    <div ref={ref} className={styles.scene}>
      <div className={styles.content}>{children}</div>
      <div className={styles.visual} onPointerMove={move} onPointerLeave={leave} onPointerCancel={leave}>
        <motion.div className={styles.lightSweep} style={{ left: light }} aria-hidden="true" />
        <div className={styles.halo} aria-hidden="true" />
        <motion.div className={styles.echoes} style={{ scale: ringScale, rotate: ringRotate }} aria-hidden="true">
          <i /><i /><i />
        </motion.div>
        <span className={styles.exchange}>NYSE / NASDAQ</span>
        <motion.div className={styles.sculpture} style={{ y, rotate, rotateY: tiltX, rotateX: tiltY }} aria-hidden="true">
          <div className={styles.bellFloat}>
          <span className={styles.bellBack}><Bell weight="fill" /></span>
          <span className={styles.bellFront}><Bell weight="duotone" /></span>
          <span className={styles.bellHighlight} />
          </div>
        </motion.div>
        <div className={styles.pedestal} aria-hidden="true" />
        <div className={styles.session}>
          <span className={trading ? styles.liveDot : styles.closedDot} aria-hidden="true" />
          {sessionLabel}
        </div>
      </div>
    </div>
  );
}
