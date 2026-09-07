"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { LogoTile } from "@/components/ui/primitives";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import type { Dictionary } from "@/lib/i18n";
import styles from "@/components/motion/DirectoryVisuals.module.css";

type Leader = { symbol: string; name: string; logoUrl: string | null; cap: string };
const positions = [{ x: 12, y: 46 }, { x: 30, y: 9 }, { x: 70, y: 9 }, { x: 88, y: 46 }, { x: 70, y: 86 }, { x: 30, y: 86 }];

/** A company selector, not an invented price chart. Every amount is supplied
 * by the same company directory; the orbital lines are decorative only. */
export function CompanyLeaders({ leaders, labels, capLabel }: { leaders: Leader[]; labels: Dictionary["directory"]; capLabel: string }) {
  const [selected, setSelected] = useState(0);
  const reduced = useMotionPreference();
  const leader = leaders[selected] ?? leaders[0];
  if (!leader) return null;
  return <div className={styles.leaders}>
    <div className={styles.visualHeader}><h2>{labels.marketLeaders}</h2><span>{labels.exploreCompanies}</span></div>
    <div className={styles.constellation}>
      <svg className={styles.orbits} viewBox="0 0 420 270" aria-hidden="true"><ellipse cx="210" cy="135" rx="158" ry="104" /><ellipse className={styles.orbitSweep} cx="210" cy="135" rx="132" ry="85" /><path d="M50 124H370M126 24L294 232M294 24L126 232" /></svg>
      {leaders.slice(0, 6).map((item, index) => <button key={item.symbol} className={styles.companyNode} style={{ left: `${positions[index].x}%`, top: `${positions[index].y}%` }} data-selected={selected === index} aria-pressed={selected === index} aria-label={`${item.name} · ${item.cap}`} onClick={() => setSelected(index)}>
        <LogoTile symbol={item.symbol} logoUrl={item.logoUrl} className="size-10" /><span>{item.symbol}</span>
      </button>)}
      <div className={styles.leaderCenter}>
        <AnimatePresence initial={false} mode="wait"><motion.div key={leader.symbol} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -5 }} transition={{ duration: .16 }}>
          <span>{capLabel}</span><strong>{leader.cap}</strong><p>{leader.name}</p>
          <Link href={`/hisse/${leader.symbol}`} prefetch={false}>{labels.openCompany}<ArrowUpRight size={14} /></Link>
        </motion.div></AnimatePresence>
      </div>
    </div>
  </div>;
}
