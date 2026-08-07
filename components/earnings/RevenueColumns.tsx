import { ChartFooter, type FooterStat } from "@/components/earnings/ChartFooter";
import { cn } from "@/lib/utils";

/**
 * Çeyreklik gelir sütun grafiği — sunucuda çizilir, istemci JS'i yok.
 *
 * Tek seri, tek soru: "gelir hangi hızla büyüyor?" Sütunlar soldan sağa
 * koyulaşıyor (`--share-4` → `--share-1`): renk basamağı zamanı taşıyor, en
 * yeni çeyrek en koyu. Öngörü sütunu KESİKLİ çerçeveli ve içi boş — henüz
 * gerçekleşmemiş bir sayının dolu bir sütunla aynı ağırlıkta durması, o
 * sayıyı ölçülmüş gibi gösteriyordu.
 *
 * Grafik `viewBox` ile ölçekleniyor ama etiketler SVG dışında, HTML olarak
 * basılıyor: SVG `<text>` font yüklenene kadar ölçüsüz kalıyor ve sütunun
 * üstünde kayıyor (skor halkasındaki sayının HTML olmasıyla aynı gerekçe).
 */

export type RevenueBar = {
  label: string;
  value: number;
  projected?: boolean | null;
  /** Sütunun üstünde yazan metin; yoksa değerin kendisi yazılır. */
  note?: string | null;
};

/** Sütun renkleri, en eskiden en yeniye — beşten fazlası en koyuda kalır. */
const SHADES = [
  "var(--share-4)",
  "var(--share-4)",
  "var(--share-3)",
  "var(--share-2)",
  "var(--share-1)",
] as const;

const CHART_HEIGHT = 132;

export function RevenueColumns({
  bars,
  title,
  legendActual,
  legendProjected,
  format,
  footer = [],
  className,
}: {
  bars: RevenueBar[];
  title: string;
  legendActual: string;
  legendProjected: string;
  /** Sütun üstündeki sayıyı biçimlendirir — dil sunum katmanına ait. */
  format: (value: number) => string;
  footer?: FooterStat[];
  className?: string;
}) {
  if (bars.length === 0) return null;

  const max = Math.max(...bars.map((bar) => bar.value));
  if (!Number.isFinite(max) || max <= 0) return null;

  const actualCount = bars.filter((bar) => !bar.projected).length;

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-[16px] border border-line bg-surface p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h3 className="text-[13.5px] font-bold text-strong">{title}</h3>
        <div className="flex items-center gap-3 text-[10.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ background: "var(--share-1)" }}
            />
            {legendActual}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-[2px] border border-dashed border-primary"
            />
            {legendProjected}
          </span>
        </div>
      </div>

      {/* Sütunlar CSS ızgarasıyla: SVG'de sabit genişlik varsayımı yapmadan
          her sütun eşit pay alıyor ve dar ekranda kendiliğinden daralıyor. */}
      <ul
        className="grid items-end gap-2"
        style={{
          gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
          height: CHART_HEIGHT + 22,
        }}
      >
        {bars.map((bar, index) => {
          const ratio = Math.max(0.02, bar.value / max);
          const shade =
            SHADES[
              Math.min(
                SHADES.length - 1,
                SHADES.length - actualCount + index,
              )
            ] ?? SHADES[SHADES.length - 1];
          return (
            <li key={`${bar.label}-${index}`} className="flex h-full flex-col justify-end gap-1.5">
              <p
                className={cn(
                  "figure whitespace-nowrap text-center text-[10.5px] font-bold",
                  bar.projected ? "text-primary" : "text-strong",
                )}
              >
                {bar.note ?? format(bar.value)}
              </p>
              <div
                className={cn(
                  "w-full rounded-t-[3px]",
                  bar.projected && "border border-dashed border-primary bg-primary-tint",
                )}
                style={{
                  height: Math.round(ratio * CHART_HEIGHT),
                  ...(bar.projected ? {} : { background: shade }),
                }}
              />
            </li>
          );
        })}
      </ul>

      <ul
        className="grid gap-2 border-t border-line pt-2"
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, index) => (
          <li
            key={`${bar.label}-label-${index}`}
            className={cn(
              "truncate text-center text-[10.5px] font-semibold",
              bar.projected ? "text-primary" : "text-muted",
            )}
          >
            {bar.label}
          </li>
        ))}
      </ul>

      <ChartFooter stats={footer} />
    </section>
  );
}
