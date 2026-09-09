"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { LogoTile } from "@/components/ui/primitives";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import type { Dictionary } from "@/lib/i18n";
import styles from "./CompanyLeaders.module.css";

type Leader = { symbol: string; name: string; logoUrl: string | null; cap: string };

/** A company selector, not an invented price chart. Every amount is supplied
 * by the same company directory; the orbital lines are decorative only. */
export function CompanyLeaders({ leaders, labels, capLabel }: {
  leaders: Leader[];
  labels: Dictionary["directory"];
  capLabel: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const reduced = useMotionPreference();
  const visible = leaders.slice(0, 10);
  const leader = visible.find((item) => item.symbol === selected) ?? visible[0];
  if (!leader) return null;

  return <section className={styles.leaders} aria-label={labels.marketLeaders}>
    <div className={styles.heading}>
      <h2>{labels.marketLeaders}</h2>
      <span>{labels.selectCompany}</span>
    </div>
    {/* The old 270/250px orbit enclosed an unrelated-looking metric and
        a second box around the active logo. The open shelf separated
        selection from the reading. Ten companies now use two ranked
        rows, with the same unframed selection and shared information. */}
    <div className={styles.shelf}>
      <svg className={styles.arc} viewBox="0 0 480 180" preserveAspectRatio="none" aria-hidden="true">
        <path d="M24 44H456M24 134H456" />
        <path className={styles.trace} d="M24 44H456M24 134H456" />
      </svg>
      <div className={styles.choices} role="group" aria-label={labels.selectCompany}>
        {visible.map((item, index) => <button
          key={item.symbol}
          type="button"
          className={styles.company}
          aria-pressed={leader.symbol === item.symbol}
          aria-label={`${item.name} · ${item.cap}`}
          onClick={() => setSelected(item.symbol)}
        >
          <span className={styles.rank} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className={styles.logo}><LogoTile symbol={item.symbol} logoUrl={item.logoUrl} className="size-11" /></span>
          <span className={styles.symbol}>{item.symbol}</span>
          <span className={styles.selection} aria-hidden="true" />
        </button>)}
      </div>
    </div>
    <div className={styles.reading}>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={leader.symbol}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: .14 }}
        >
          <Link href={`/hisse/${leader.symbol}`} prefetch={false} className={styles.detail}>
            <div className={styles.identity}>
              <span>{leader.symbol}</span>
              <h3 className="display-ink display-ink-tight">{leader.name}</h3>
            </div>
            <dl className={styles.cap}><dt>{capLabel}</dt><dd>{leader.cap}</dd></dl>
            <span className={styles.open}>{labels.openCompany}<ArrowUpRight size={14} aria-hidden="true" /></span>
          </Link>
        </motion.div>
      </AnimatePresence>
    </div>
  </section>;
}
