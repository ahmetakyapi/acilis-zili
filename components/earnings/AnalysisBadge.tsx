import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictPillClass,
} from "@/lib/analysis";
import type { AnalysisBadge as AnalysisBadgeData } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";

/**
 * Takvim satırındaki "AL · 77 · Analiz →" rozeti.
 *
 * Analizler sekmesi aranmasın diye var: bilançosu okunmuş bir şirketi
 * takvimde gören okuyucu, listeye dönüp aramadan doğrudan analize geçer.
 *
 * Rozet KENDİ bağlantısını taşıyor ve içinde bulunduğu kart başka bir yere
 * (şirket sayfasına) gidiyor. İç içe `<a>` geçersiz HTML olduğu için kart,
 * yüzeyi kaplayan ayrı bir bağlantı katmanıyla kuruluyor; rozet o katmanın
 * üstünde duruyor (`relative z-10`).
 */
export function AnalysisBadge({
  badge,
  t,
  size = "md",
  className,
}: {
  badge: AnalysisBadgeData;
  t: Dictionary;
  size?: "sm" | "md";
  className?: string;
}) {
  const verdict = verdictOf(badge.verdict);
  return (
    <Link
      href={analysisHref(badge.symbol, badge.period)}
      prefetch={false}
      className={cn(
        "relative z-10 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-bold transition-opacity hover:opacity-80",
        verdictPillClass(verdict),
        size === "sm"
          ? "px-2 py-[3px] text-[10px]"
          : "px-2.5 py-1 text-[11px]",
        className,
      )}
    >
      <span>{verdictLabel(verdict, t)}</span>
      <span aria-hidden className="opacity-45">
        ·
      </span>
      <span className="figure">{badge.score}</span>
      <span aria-hidden className="opacity-45">
        ·
      </span>
      <span>{t.analysis.analysisLink}</span>
    </Link>
  );
}
