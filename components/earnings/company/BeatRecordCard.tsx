import { ArrowDownRight, ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { VoteOutcome } from "@/lib/earnings-vote";
import { cn } from "@/lib/utils";
import css from "./CompanyEarnings.module.css";

/**
 * BEKLENTİ KARNESİ — çeyrek başına bir hücre (31 Ekim).
 *
 * NEDEN: karne "0/4" ve dört kırmızı çizgiden ibaretti; hangi çeyreğin,
 * ne kadarla kaçtığı okunmuyordu ("böyle çok eksik hissettiriyor").
 * Hücre sitenin kart dilinde: nötr zemin, durum TEPEDEKİ 3 piksellik
 * şeritte (bilanço/teknik/risk kartları), sonuç ikonlu yazıyla — renk tek
 * taşıyıcı değil (↗ geçti, ↘ kaçırdı, → denk). Hücrede yazan iki sayı
 * (gerçekleşen, beklenti) sağlayıcının aynı satırından; sayım bu
 * hücrelerden çıkıyor (`beatQuarters`), ikisi ayrışamaz.
 */

export type BeatCell = {
  key: string;
  period: string;
  outcome: VoteOutcome;
  actual: string;
  estimate: string;
};

const ICON = { beat: ArrowUpRight, miss: ArrowDownRight, inline: ArrowRight } as const;

export function BeatRecordCard({
  cells,
  beats,
  title,
  note,
  labels,
}: {
  cells: readonly BeatCell[];
  beats: number;
  title: string;
  note: string;
  labels: { beat: string; miss: string; inline: string; estimate: string };
}) {
  return (
    <section className={css.karne} aria-label={title}>
      <div className={css.karneHead}>
        <p className={css.karneLabel}>{title}</p>
        <p className={cn("figure", css.karneValue)}>
          {beats}
          <span>/{cells.length}</span>
        </p>
      </div>
      <ol className={css.karneQuarters}>
        {cells.map((cell) => {
          const Icon = ICON[cell.outcome];
          return (
            <li key={cell.key} className={css.karneQuarter} data-mark={cell.outcome}>
              <span className={css.qPeriod}>{cell.period}</span>
              <span className={css.qOutcome}>
                <Icon aria-hidden weight="bold" size={13} />
                {cell.outcome === "beat" ? labels.beat : cell.outcome === "miss" ? labels.miss : labels.inline}
              </span>
              <span className={cn("figure", css.qActual)}>{cell.actual}</span>
              <span className={css.qEstimate}>
                {labels.estimate} <span className="figure">{cell.estimate}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className={css.karneNote}>{note}</p>
    </section>
  );
}
