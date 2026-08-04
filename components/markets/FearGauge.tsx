import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Panel } from "@/components/ui/primitives";
import { getSeries } from "@/lib/providers/fred";
import type { Locale } from "@/lib/i18n";
import { cn, formatEtDateShort, formatPrice } from "@/lib/utils";

/**
 * VIX — piyasanın önümüzdeki 30 gün için beklediği oynaklık.
 *
 * Ürünün bütün ölçüleri "ne oldu" diyor; bu tek kart "piyasa ne bekliyor"
 * diyor ve endekslerin yanında durması bu yüzden anlamlı. Seviye tek başına
 * bir şey ifade etmediği için bant yorumu ve ölçek çubuğu birlikte
 * gösteriliyor: 17 sayısı, "uzun dönem ortalamasının biraz altında" cümlesi
 * olmadan okunmuyor.
 *
 * Veri FRED'in VIXCLS serisinden geliyor; MACRO_SERIES'e eklenmedi çünkü VIX
 * makro gösterge değil, piyasa ölçüsü — `SeriesRequest` tam olarak bunun
 * için var. Veri yoksa kart tamamen düşer.
 *
 * DİKKAT: FRED kapanış değeri yayımlar ve bir iş günü gecikmeli olabilir.
 * Kart bu yüzden tarihini açıkça yazar; "canlı VIX" iddiası taşımaz.
 */

export const VIX_SERIES = { seriesId: "VIXCLS", slug: "vix", units: "lin" };

/** Bantlar piyasa dilindeki yaygın eşikler; uzun dönem ortalaması ~20. */
const BANDS = [
  { max: 15, key: "calm", tone: "up" },
  { max: 20, key: "normal", tone: "flat" },
  { max: 30, key: "tense", tone: "warn" },
  { max: 50, key: "fear", tone: "down" },
  { max: Infinity, key: "panic", tone: "down" },
] as const;

export type VixBand = (typeof BANDS)[number];

/** Eşikler tek yerde: ana sayfadaki tahvil kartı da bu bandı okuyor. */
export function vixBand(level: number): VixBand {
  return BANDS.find((entry) => level < entry.max) ?? BANDS[BANDS.length - 1];
}

/** Ölçek çubuğunun üst sınırı — 50 üstü zaten "panik", ayrıntısı önemsiz. */
const SCALE_MAX = 50;

export type FearGaugeLabels = {
  title: string;
  hint: string;
  bands: Record<"calm" | "normal" | "tense" | "fear" | "panic", string>;
  average: string;
  guideCta: string;
};

export async function FearGauge({
  locale,
  labels,
}: {
  locale: Locale;
  labels: FearGaugeLabels;
}) {
  const result = await getSeries(VIX_SERIES, 2);
  if (!result.ok || result.data.latestValue === null) return null;

  /* periodLabel aylık makro serileri için "2026-07" üretiyor; VIX günlük bir
     seri, o yüzden gözlemin tam tarihi yazılır — yoksa dünkü kapanış bir ay
     öncesine aitmiş gibi okunuyordu. */
  const observedAt = result.data.observations.at(-1)?.date ?? null;
  const level = result.data.latestValue;
  const prev = result.data.prevValue;
  const delta = prev !== null ? level - prev : null;
  const band = BANDS.find((entry) => level < entry.max) ?? BANDS[BANDS.length - 1];
  const fill = Math.min(100, Math.max(2, (level / SCALE_MAX) * 100));

  return (
    <Panel className="flex flex-col gap-3.5 px-[18px] py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
          {labels.title}
        </h2>
        <span className="numeral text-[11px] text-muted">
          VIX · {observedAt ? formatEtDateShort(observedAt, locale) : "—"}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-1">
        <p className="tote text-[34px] leading-none">
          {formatPrice(level, locale, { digits: 2 })}
        </p>
        <span
          className={cn(
            "mb-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold",
            band.tone === "up" && "bg-up-wash text-up",
            band.tone === "flat" && "bg-surface-elevated text-body",
            band.tone === "warn" && "bg-brass-wash text-brass",
            band.tone === "down" && "bg-down-wash text-down",
          )}
        >
          {labels.bands[band.key]}
        </span>
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              "numeral mb-1 text-[12.5px] font-semibold",
              // Yükselen VIX gerginlik demek — burada "yukarı" iyi haber
              // değil, o yüzden yön rengi hisse sözlüğünün tersine kurulu.
              delta > 0 ? "text-down" : "text-up",
            )}
          >
            <span aria-hidden>{delta > 0 ? "▲" : "▼"}</span>{" "}
            {formatPrice(Math.abs(delta), locale, { digits: 2 })}
          </span>
        )}
      </div>

      {/* Ölçek — sayının nereye düştüğünü tek bakışta gösterir. */}
      <div className="flex flex-col gap-1.5">
        <div
          className="relative h-2 overflow-hidden rounded-full bg-surface-sunken"
          role="img"
          aria-label={`${labels.title}: ${level}`}
        >
          <span
            className={cn(
              "block h-full rounded-full",
              band.tone === "up" && "bg-up",
              band.tone === "flat" && "bg-primary",
              band.tone === "warn" && "bg-brass",
              band.tone === "down" && "bg-down",
            )}
            style={{ width: `${fill}%` }}
          />
          {/* Uzun dönem ortalaması işareti — 20 civarı. */}
          <span
            aria-hidden
            className="absolute inset-y-0 w-px bg-line-strong"
            style={{ left: `${(20 / SCALE_MAX) * 100}%` }}
          />
        </div>
        <p className="numeral flex justify-between text-[10px] text-muted">
          <span>0</span>
          <span>{labels.average}</span>
          <span>{SCALE_MAX}+</span>
        </p>
      </div>

      <p className="text-[12px] leading-[19px] text-muted">{labels.hint}</p>

      <Link
        href="/rehber/volatilite"
        className="-my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-hover"
      >
        {labels.guideCta}
        <ArrowRight weight="bold" size={12} />
      </Link>
    </Panel>
  );
}
