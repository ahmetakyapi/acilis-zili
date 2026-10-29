"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { MAX_GUESSES, currentStreak, dayNumberOf, isJoker, type HistoryEntry } from "@/lib/stock-puzzle";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { historySnapshot, progressSnapshot, statsSnapshot, subscribeStorage } from "./puzzle-storage";
import { fill } from "./puzzle-format";
import styles from "./PuzzleArchive.module.css";

/**
 * Arşiv ızgarası (25 Ekim) — her gün bir kart: numara, tarih, ve okurun o
 * günkü durumu (oynanmadı / yarım / kaçıncı tahminde bildi / bilemedi).
 *
 * OYUN ARŞİVİ GİBİ (29 Ekim, sahibinin isteği: "arşiv kısmı daha görsel
 * olsun, bunun bir oyun olduğu daha belirgin olsun"). Kartlar düz bir
 * liste gibi duruyordu: numara, logo ya da siluet, tarih, rozet. Şimdi:
 *   - üstte KARNE: çözülen, bilinemeyen, bekleyen gün ve seri — dört sayı;
 *   - SÜZGEÇ çipleri (Tümü · Oynanmadı · Çözüldü · Bilinemedi), sayılarıyla;
 *   - kartın üst kenarı durumun renginde (bildin yeşil, bilemedin kırmızı,
 *     yarım pirinç), altında altı TAHMİN YUVASI — o günün oyunu bir bakışta
 *     (paylaşım ızgarasının kart hâli: doğru yeşil, joker pirinç, ıska dolu,
 *     kullanılmayan boş);
 *   - kartın dibinde eylem: "Oyna", "Devam Et", "Sonucu Gör";
 *   - bugünün kartı iki sütun genişliğinde, büyük siluetle.
 *
 * ÇÖZÜLEN GÜNDE LOGO, ÇÖZÜLMEYENDE SİLUET. Logo ve sembol SUNUCUDAN
 * GELMEZ: arşiv sayfasının HTML'i hiçbir günün cevabını taşımıyor; logo,
 * okurun bitirdiği oyunun bu tarayıcıdaki geçmiş kaydından
 * (`historySnapshot`, cevap oyun bitince uçtan gelmişti). Siluet
 * bulmacanın zaten açık ilk ipucu.
 *
 * Durum yalnız bu tarayıcıda: sunucu çiziminde kartlar rozetsiz ve
 * yuvalar boş basılır (depo okununca dolar; yerleri baştan ayrılmış, kayma
 * yok).
 */
export type ArchiveItem = {
  day: string;
  number: number;
  dateLabel: string;
  points: number[] | null;
  today?: boolean;
};

type Status = "none" | "playing" | "won" | "lost";
type Filter = "all" | "none" | "won" | "lost";
const FILTERS: readonly Filter[] = ["all", "none", "won", "lost"];

export function PuzzleArchive({ items, labels }: { items: ArchiveItem[]; labels: StockPuzzleLabels }) {
  const history = useSyncExternalStore(subscribeStorage, historySnapshot, () => null);
  const progress = useSyncExternalStore(subscribeStorage, progressSnapshot, () => null);
  const stats = useSyncExternalStore(subscribeStorage, statsSnapshot, () => null);
  const [filter, setFilter] = useState<Filter>("all");
  const A = labels.archiveBoard;

  const rows = items.map((item) => {
    const entry: HistoryEntry | undefined =
      history?.[item.day] ??
      (item.today && progress?.day === item.day ? { guesses: progress.guesses, status: progress.status, answer: null } : undefined);
    const status: Status | null = !history ? null : !entry || entry.guesses.length === 0 ? "none" : entry.status;
    return { item, entry, status };
  });
  const count = (status: Status) => rows.filter((row) => row.status === status).length;
  const known = history !== null;
  const totals = { won: count("won"), lost: count("lost"), none: count("none") + count("playing") };
  const today = items.find((item) => item.today);
  const streak = stats && today ? currentStreak(stats, dayNumberOf(today.day)) : 0;
  const shown = rows.filter(({ status }) =>
    filter === "all" || !known ? true : filter === "none" ? status === "none" || status === "playing" : status === filter,
  );
  const filterCount = (key: Filter) => (key === "all" ? rows.length : totals[key]);

  return (
    <>
      {/* ---- Karne: dört sayı ---- */}
      <dl className={styles.scores}>
        {[
          { key: "won", label: A.solved, value: totals.won },
          { key: "lost", label: A.missed, value: totals.lost },
          { key: "none", label: A.waiting, value: totals.none },
          { key: "streak", label: labels.streak, value: streak },
        ].map(({ key, label, value }) => (
          <div key={key} className={styles.score} data-kind={key}>
            <dt>{label}</dt>
            <dd className="numeral">{known ? value : "–"}</dd>
          </div>
        ))}
      </dl>

      {/* ---- Süzgeç ---- */}
      <div role="group" aria-label={A.filterLabel} className={styles.filters}>
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            className={styles.filter}
            onClick={() => setFilter(key)}
            disabled={!known && key !== "all"}
          >
            {A.filters[key]}
            {known && <span className={cn(styles.filterCount, "numeral")}>{filterCount(key)}</span>}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>{A.filterEmpty}</p>
      ) : (
        <ol className={styles.grid}>
          {shown.map(({ item, entry, status }) => {
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
            const action =
              status === "won" || status === "lost" ? labels.homeResult : status === "playing" ? labels.homeContinue : labels.homePlay;
            return (
              <li key={item.day} className={cn(item.today && styles.todayItem)}>
                <Link
                  href={item.today ? "/bulmaca" : `/bulmaca/${item.day}`}
                  className={cn(styles.card, item.today && styles.today)}
                  data-status={status ?? undefined}
                >
                  <span className={styles.head}>
                    <span className={cn(styles.number, "numeral")}>#{item.number}</span>
                    {item.today && <span className={styles.todayTag}>{labels.archiveToday}</span>}
                    <span className={styles.badge} data-status={status ?? undefined}>{badge}</span>
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
                  <Slots entry={entry} status={status} label={A.slotsLabel} />
                  <span className={styles.foot}>
                    <span className={styles.date}>{item.dateLabel}</span>
                    <span className={styles.action}>
                      {action}
                      <ArrowRight aria-hidden size={12} weight="bold" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

/** Altı tahmin yuvası — o günün oyunu (doğru, joker, ıska, boş). */
function Slots({ entry, status, label }: { entry: HistoryEntry | undefined; status: Status | null; label: string }) {
  const guesses = entry?.guesses ?? [];
  const kinds = Array.from({ length: MAX_GUESSES }, (_, i) => {
    const symbol = guesses[i];
    if (symbol === undefined) return "empty";
    if (isJoker(symbol)) return "joker";
    if (status === "won" && i === guesses.length - 1) return "hit";
    return "miss";
  });
  return (
    <span className={styles.slots} role="img" aria-label={fill(label, { n: guesses.length })}>
      {kinds.map((kind, i) => (
        <span key={i} className={styles.slot} data-kind={kind} />
      ))}
    </span>
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
