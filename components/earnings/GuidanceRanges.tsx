import { cn } from "@/lib/utils";

/**
 * Gelecek çeyrek şirket öngörüsü — yatay aralık barları.
 *
 * Her satır bir ölçü: şirketin verdiği alt–üst bandı dolu bar, piyasa
 * beklentisi onun üstündeki nokta. Sayfadaki en yoğun bilgi burada:
 * "şirket ne diyor" ile "piyasa ne bekliyordu" arasındaki fark, hissenin
 * neden düştüğünü tek bakışta gösteriyor — üç paragraf metin aynı şeyi
 * anlatmak için üç paragraf sürüyordu.
 *
 * Ölçek satır başına AYRI hesaplanıyor: gelir milyar dolar, marj yüzde,
 * hisse başı kâr dolar — üçünü ortak eksene oturtmak anlamsız. Eksen
 * bandın ve beklentinin ikisini de kapsayacak şekilde %12 payla açılıyor;
 * pay olmadan bandın ucundaki nokta kenara yapışıyordu.
 */

export type GuidanceRow = {
  label: string;
  low: number;
  high: number;
  consensus?: number | null;
  unit?: string | null;
  note?: string | null;
  tone?: string | null;
};

const PAD_RATIO = 0.12;

export function GuidanceRanges({
  rows,
  title,
  legendRange,
  legendConsensus,
  formatRange,
  className,
}: {
  rows: GuidanceRow[];
  title: string;
  legendRange: string;
  legendConsensus: string;
  /** Aralığın TAMAMINI biçimlendirir — birim iki kez yazılmasın diye tek
      çağrı: "10,3 – 10,8 Mr $", "%83 – %85". */
  formatRange: (low: number, high: number, unit?: string | null) => string;
  className?: string;
}) {
  if (rows.length === 0) return null;

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
            <span aria-hidden className="h-2 w-3 rounded-full bg-primary" />
            {legendRange}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-strong" />
            {legendConsensus}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-3.5">
        {rows.map((row, index) => {
          const lo = Math.min(row.low, row.high);
          const hi = Math.max(row.low, row.high);
          /* `!= null`: alan hem eksik hem açıkça null olabiliyor (bkz.
             lib/schema.ts jsonb tipleri). `!== undefined` null'ı geçiriyor
             ve nokta eksenin dışına düşüyordu. */
          const consensus = row.consensus ?? null;
          const marks = [lo, hi, ...(consensus !== null ? [consensus] : [])];
          const min = Math.min(...marks);
          const max = Math.max(...marks);
          const span = max - min || Math.abs(max) || 1;
          const axisMin = min - span * PAD_RATIO;
          const axisMax = max + span * PAD_RATIO;
          const pos = (value: number) =>
            ((value - axisMin) / (axisMax - axisMin)) * 100;

          return (
            <li key={`${row.label}-${index}`} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[12px] font-semibold text-body">
                  {row.label}
                </span>
                <span className="figure whitespace-nowrap text-[12.5px] font-bold text-strong">
                  {formatRange(lo, hi, row.unit)}
                </span>
              </div>

              <div className="relative h-2 w-full rounded-full bg-surface-elevated">
                <span
                  aria-hidden
                  className="absolute inset-y-0 rounded-full bg-primary"
                  style={{
                    left: `${pos(lo)}%`,
                    width: `${Math.max(2, pos(hi) - pos(lo))}%`,
                  }}
                />
                {consensus !== null && (
                  /* Nokta bandın ÜSTÜNE biniyor ve kendi zemin renginde bir
                     halka taşıyor: bandın içine düştüğünde maviye karışıp
                     kayboluyordu. */
                  <span
                    aria-hidden
                    className="absolute top-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-strong ring-2 ring-surface"
                    style={{ left: `${pos(consensus)}%` }}
                  />
                )}
              </div>

              {row.note && (
                <p
                  className={cn(
                    "text-[10.5px] font-semibold",
                    row.tone === "up"
                      ? "text-up"
                      : row.tone === "down"
                        ? "text-down"
                        : "text-muted",
                  )}
                >
                  {row.note}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
