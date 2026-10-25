"use client";

import { useSyncExternalStore } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { historySnapshot, progressSnapshot, subscribeStorage } from "./puzzle-storage";
import { fill } from "./puzzle-format";
import styles from "./PuzzleArchive.module.css";

/**
 * Arşiv ızgarası (25 Ekim) — her gün bir kart: numara, tarih, ve okurun o
 * günkü durumu (oynanmadı / yarım / kaçıncı tahminde bildi / bilemedi).
 *
 * ÇÖZÜLEN GÜNDE LOGO, ÇÖZÜLMEYENDE SİLUET. Logo ve sembol SUNUCUDAN
 * GELMEZ: arşiv sayfasının HTML'i hiçbir günün cevabını taşımıyor; logo,
 * okurun bitirdiği oyunun bu tarayıcıdaki geçmiş kaydından
 * (`historySnapshot`, cevap oyun bitince uçtan gelmişti). Siluet
 * bulmacanın zaten açık ilk ipucu.
 *
 * Durum yalnız bu tarayıcıda: sunucu çiziminde her kart "Oynanmadı"
 * rozetiyle değil, rozetsiz basılır (depo okununca rozet gelir; kart
 * boyu rozetin yerini baştan ayırıyor, kayma yok).
 */
export type ArchiveItem = {
  day: string;
  number: number;
  dateLabel: string;
  points: number[] | null;
  today?: boolean;
};

export function PuzzleArchive({ items, labels }: { items: ArchiveItem[]; labels: StockPuzzleLabels }) {
  const history = useSyncExternalStore(subscribeStorage, historySnapshot, () => null);
  const progress = useSyncExternalStore(subscribeStorage, progressSnapshot, () => null);
  const solved = history ? Object.values(history).filter((entry) => entry.status === "won").length : null;

  return (
    <>
      {solved !== null && solved > 0 && <p className={styles.summary}>{fill(labels.archiveSolved, { n: solved })}</p>}
      <ol className={styles.grid}>
        {items.map((item) => {
          const entry =
            history?.[item.day] ??
            (item.today && progress?.day === item.day ? { guesses: progress.guesses, status: progress.status, answer: null } : undefined);
          const status = !history ? null : !entry || entry.guesses.length === 0 ? "none" : entry.status;
          const badge =
            status === null
              ? ""
              : status === "won"
                ? fill(labels.archiveWon, { n: entry?.guesses.length ?? 0 })
                : status === "lost"
                  ? labels.archiveLost
                  : status === "playing"
                    ? labels.archivePlaying
                    : labels.archiveNotPlayed;
          const answer = status === "won" || status === "lost" ? entry?.answer : null;
          return (
            <li key={item.day}>
              <Link href={item.today ? "/bulmaca" : `/bulmaca/${item.day}`} className={cn(styles.card, item.today && styles.today)} data-status={status ?? undefined}>
                <span className={styles.head}>
                  <span className={cn(styles.number, "numeral")}>#{item.number}</span>
                  {item.today && <span className={styles.todayTag}>{labels.archiveToday}</span>}
                </span>
                <span className={styles.figure}>
                  {answer ? (
                    <span className={styles.answer}>
                      <LogoTile symbol={answer.symbol} logoUrl={answer.logoUrl} size="lg" />
                      <span className={styles.symbol}>{answer.symbol}</span>
                    </span>
                  ) : item.points ? (
                    <MiniSilhouette points={item.points} />
                  ) : null}
                </span>
                <span className={styles.date}>{item.dateLabel}</span>
                <span className={styles.badge} data-status={status ?? undefined}>{badge}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function MiniSilhouette({ points }: { points: number[] }) {
  const path = points
    .map((value, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * 100).toFixed(2)},${(4 + (1 - value) * 32).toFixed(2)}`)
    .join(" ");
  return (
    <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className={styles.mini}>
      <path d={`${path} L100,40 L0,40 Z`} className={styles.miniArea} />
      <path d={path} className={styles.miniLine} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
