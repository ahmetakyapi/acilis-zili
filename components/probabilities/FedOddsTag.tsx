import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { Dictionary, Locale } from "@/lib/i18n";
import { eventProbabilities, liquidityOf, resolvedOutcome, topOutcome, type FedMove } from "@/lib/probabilities";
import { getProbabilityBoard } from "@/lib/probability-data";
import { cn } from "@/lib/utils";
import { etOf, pct } from "./ProbabilityParts";
import styles from "./Probabilities.module.css";

/**
 * Bir FOMC toplantısının piyasa fiyatlaması — tek satırlık künye (25 Ekim).
 * Makro'nun "Sonraki FOMC Kararı" kartı ve takvimin FOMC satırı basıyor;
 * ayrıntı /olasiliklar'da.
 *
 * YALNIZ AYNI GÜN EŞLEŞİRSE: takvimin toplantı günü (`dateEt`) kaynaktaki
 * toplantının ET günüyle aynı değilse künye basılmaz — iki ayrı toplantının
 * sayısını yan yana koymak sessiz bir yanlış olurdu. Az işlem gören ya da
 * gizlenen toplantıda da basılmaz. Veri sayfayla AYNI kayıttan
 * (`getProbabilityBoard`, istek içinde önbellekli), yani iki ekran aynı
 * sayıyı söyler.
 */
export type FedOdds = { move: FedMove; p: number };

/** Takvimdeki toplantı gününün fiyatlaması ya da null (kurallar yukarıda). */
export async function fedOddsFor(dateEt: string): Promise<FedOdds | null> {
  const board = await getProbabilityBoard();
  const meeting = board?.snapshot.fed.find((m) => m.strikeAt && etOf(m.strikeAt).date === dateEt);
  if (!meeting || resolvedOutcome(meeting) !== null || liquidityOf(meeting) !== "liquid") return null;
  const probs = eventProbabilities(meeting);
  const top = probs ? topOutcome(probs) : null;
  return top ? { move: top.key as FedMove, p: top.p } : null;
}

export function FedOddsTag({
  odds,
  locale,
  t,
  className,
}: {
  /** Yoksa hiçbir şey basılmaz (çağıran ayrıca denetlemesin). */
  odds: FedOdds | null | undefined;
  locale: Locale;
  t: Dictionary;
  className?: string;
}) {
  if (!odds) return null;
  const p = t.probabilities;
  return (
    <span className={cn(styles.scope, styles.tag, className)}>
      <span>{p.tagLabel}:</span>
      <b>
        {p.fedOutcomes[odds.move]} {pct(odds.p, locale)}
      </b>
      <span aria-hidden>·</span>
      <span>{p.sourceLabel}</span>
      <span aria-hidden>·</span>
      <Link href="/olasiliklar" prefetch={false} className="tap-44">
        {p.tagLink}
      </Link>
    </span>
  );
}
