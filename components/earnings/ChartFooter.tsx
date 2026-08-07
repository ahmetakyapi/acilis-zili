import { cn } from "@/lib/utils";

/**
 * Grafik kartlarının altındaki üçlü mini künye.
 *
 * Karnede olan ama sayfada olmayan parça buydu: sütunların altında yıllık
 * büyüme ve segment payları, öngörü kartının altında faaliyet gideri ve
 * hisse sayısı. Grafiği tamamlayan bağlam — onsuz kart "işte bir grafik"
 * diyor, onunla birlikte bir sayfa oluyor.
 *
 * Hairline ile ayrılıyor ve `mt-auto` ile kartın TABANINA yapışıyor: yan
 * yana duran iki kart farklı yükseklikte içerik taşıyor, künyeler aynı
 * hizada olmazsa satır tırtıklı görünüyor.
 */
export type FooterStat = {
  label: string;
  value: string;
  note?: string | null;
  tone?: string | null;
};

export function ChartFooter({
  stats,
  className,
}: {
  stats: FooterStat[];
  className?: string;
}) {
  if (stats.length === 0) return null;
  return (
    <dl
      className={cn(
        "mt-auto grid gap-3 border-t border-line pt-3",
        stats.length >= 3 ? "grid-cols-3" : "grid-cols-2",
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0">
          <dt className="truncate text-[10px] font-medium text-muted">
            {stat.label}
          </dt>
          <dd className="figure mt-px flex flex-wrap items-baseline gap-x-1.5 text-[14px] font-bold text-strong">
            {stat.value}
            {stat.note && (
              <span
                className={cn(
                  "text-[10.5px] font-bold",
                  stat.tone === "up"
                    ? "text-up"
                    : stat.tone === "down"
                      ? "text-down"
                      : "text-muted",
                )}
              >
                {stat.note}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
