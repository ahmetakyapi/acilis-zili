import type { CSSProperties } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { verdictPillClass, verdictStroke, type VerdictKey } from "@/lib/analysis";

/**
 * Görüş hapı — AL / TUT / SAT'ın sitedeki TEK çizimi (30 Ekim).
 *
 * NEDEN TEK BİLEŞEN: on ayrı yerde on ayrı hap vardı — kimi `rounded-md`,
 * kimi tam yuvarlak, kimi 6px köşeli; dolgular 2px ile 22px arası; skor kimi
 * yerde "AL · 81" diye ara noktayla metne yapışık, kimi yerde yok. Sahibinin
 * itirazı: "badge'ler çok kötü duruyor, her yerde daha görsel ve premium".
 * Görsel dil tek yerde kurulup her ekrana aynı gidiyor:
 *
 *   · YÖN İKONU: AL ↗, TUT →, SAT ↘. Renk tek başına anlam taşımasın
 *     (renk körü okur, gri baskı) — ikon görüşü ŞEKİLLE de söylüyor.
 *   · SKOR VARSA MİNİ HALKA: 0–100 skor bir yayın uzunluğu (ScoreRing'in
 *     dili, aynı `--verdict-*` tonu, aynı kendini çizme animasyonu); sayı
 *     yanında yazılı. Skorlu hapta yön ikonu yok: iki çizim yan yana
 *     kalabalık, halka zaten görüşün renginde.
 *   · İÇ HALKA: zeminden ayrılan ince kenar (`ring-current/20`) — gölge
 *     değil ton farkı (CLAUDE.md "derinlik tonla").
 *
 * Ölçü `size` ile; bağlamın kendi CSS modülü ölçüyü veriyorsa (teknik kapak,
 * hisse kartı) `size="custom"` + `className` — ikon `em` cinsinden, puntoyla
 * birlikte büyür.
 */

const ICON = { buy: ArrowUpRight, hold: ArrowRight, sell: ArrowDownRight } as const;

const SIZE = {
  xs: "h-6 gap-1 px-2 text-nano",
  sm: "h-7 gap-1.5 px-2.5 text-tiny",
  md: "h-8 gap-1.5 px-3 text-small",
  custom: "gap-[0.4em]",
} as const;

export type VerdictPillSize = keyof typeof SIZE;

/** Mini skor halkası — 0–100 skor yayın uzunluğu. Sayı yanında yazılı. */
const METER_RADIUS = 7;
const METER_CIRCUMFERENCE = 2 * Math.PI * METER_RADIUS;

export function ScoreMeter({ score, verdict, className }: { score: number; verdict: VerdictKey; className?: string }) {
  const filled = (Math.min(100, Math.max(0, score)) / 100) * METER_CIRCUMFERENCE;
  return (
    <svg viewBox="0 0 18 18" className={cn("size-[1.4em] shrink-0", className)} aria-hidden>
      <circle cx="9" cy="9" r={METER_RADIUS} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={2.5} />
      <circle
        className="ring-fill"
        style={{ "--ring-circumference": METER_CIRCUMFERENCE } as CSSProperties}
        cx="9"
        cy="9"
        r={METER_RADIUS}
        fill="none"
        stroke={verdictStroke(verdict)}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`${filled.toFixed(2)} ${METER_CIRCUMFERENCE.toFixed(2)}`}
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

export function VerdictPill({
  verdict,
  label,
  score,
  size = "sm",
  className,
}: {
  verdict: VerdictKey;
  label: string;
  /** 0–100 — verilirse yön ikonu yerine mini halka ve sayı basılır. */
  score?: number | null;
  size?: VerdictPillSize;
  className?: string;
}) {
  const Icon = ICON[verdict];
  const hasScore = typeof score === "number";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-bold leading-none ring-1 ring-current/20 ring-inset",
        SIZE[size],
        verdictPillClass(verdict),
        className,
      )}
    >
      {hasScore ? (
        <ScoreMeter score={score} verdict={verdict} />
      ) : (
        <Icon aria-hidden weight="bold" className="size-[1.1em] shrink-0" />
      )}
      <span className="tracking-[0.03em]">{label}</span>
      {hasScore && <span className="figure font-semibold opacity-75">{score}</span>}
    </span>
  );
}
