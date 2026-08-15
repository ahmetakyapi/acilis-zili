import { cn, titleCaseLabel } from "@/lib/utils";

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
 *
 * Sayılar grafik kartının geri kalanıyla aynı ailede (`.numeral`); mono
 * `.figure` metrik kartlarına ayrılmış durumda.
 */
export type FooterStat = {
  label: string;
  value: string;
  note?: string | null;
  tone?: string | null;
};

export function ChartFooter({
  stats,
  locale,
  className,
}: {
  stats: FooterStat[];
  /** Not satırı Title Case'e çekilirken gerekiyor: Türkçede i → İ. */
  locale: string;
  className?: string;
}) {
  if (stats.length === 0) return null;
  return (
    <dl
      className={cn(
        "mt-auto grid gap-x-3 gap-y-2.5 border-t border-line pt-3",
        /* Üçlü künye telefonda ALT ALTA: 390 pikselde üç sütun etiketleri
           kırpıyor ("Serbest Nakit Akı...") ve değerler satır ortasından
           kırılıyordu. Kırpılmış bir etiket hiç etiket olmamasından kötü. */
        stats.length >= 3
          ? /* Telefonda üçü alt alta ve aralarında AYRAÇ var: ayraçsızken
               üç ölçü gevşek bir liste gibi akıyor, hangi değerin hangi
               etikete ait olduğu ancak dikkatle okunuyordu. Hairline
               sitenin geri kalanıyla aynı dil. Üçlü sıraya geçince
               ayraç kalkıyor, orada sütunlar zaten ayırıyor. */
            "grid-cols-1 divide-y divide-line-soft sm:grid-cols-3 sm:divide-y-0"
          : "grid-cols-2",
        className,
      )}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "min-w-0",
            stats.length >= 3 && "py-2 first:pt-0 last:pb-0 sm:py-0",
          )}
        >
          <dt className="truncate text-tiny font-medium text-muted">
            {stat.label}
          </dt>
          {/* Değerin KENDİSİ tona boyanıyor, karnedeki gibi: "▲ %372"
              yeşil, "▼ %32" kırmızı. Renk yalnız kalmasın diye ok işareti
              değerin metnine ait — ton yoksa nötr koyu yazı. */}
          <dd
            className={cn(
              "numeral mt-px flex flex-wrap items-baseline gap-x-1.5 text-read font-bold",
              stat.tone === "up"
                ? "text-up"
                : stat.tone === "down"
                  ? "text-down"
                  : "text-strong",
            )}
          >
            {stat.value}
            {stat.note && (
              <span className="text-tiny font-semibold text-muted">
                {titleCaseLabel(stat.note, locale)}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
