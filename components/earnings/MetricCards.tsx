import { cn } from "@/lib/utils";

/**
 * Altı metrik kartı — karnedeki 3×2 ızgaranın sayfa karşılığı.
 *
 * Eskiden sağ kolonda etiket–değer listesiydi ve sayfanın en önemli
 * rakamları, yanındaki dokuz paragraflık metnin gölgesinde kalıyordu.
 * Kart olarak ve ana kolonda: değer 21px, altında renkli tek satır bağlam.
 * Rakamı gören okuyucu metne inmek zorunda değil.
 *
 * Etiket de değer de SERBEST METİN, çünkü hangi ölçünün öne çıkacağı
 * şirkete göre değişiyor: bankada net faiz marjı, bellek üreticisinde brüt
 * marj. Site biçimlendirmiyor, analiz yazarken karar veriliyor.
 */

export type Metric = {
  label: string;
  value: string;
  note?: string;
  tone?: string;
};

export function MetricCards({
  metrics,
  className,
}: {
  metrics: Metric[];
  className?: string;
}) {
  if (metrics.length === 0) return null;
  return (
    <ul
      className={cn(
        "grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]",
        className,
      )}
    >
      {metrics.map((metric) => (
        <li
          key={metric.label}
          className="flex min-w-0 flex-col gap-[3px] rounded-[14px] border border-line bg-surface px-4 py-3.5"
        >
          <p className="truncate text-[10.5px] font-semibold text-muted">
            {metric.label}
          </p>
          <p className="figure text-[21px] font-bold leading-none tracking-[-0.03em] text-strong">
            {metric.value}
          </p>
          {metric.note && (
            /* Bağlam satırı KIRILMAZ: "▲ Yıllık %372 · Beklenti Üstü" iki
               satıra düşünce kartlar farklı yükseklikte kalıyor ve ızgara
               tırtıklı görünüyordu. Sığmazsa kesilir. */
            <p
              className={cn(
                "truncate text-[11.5px] font-bold",
                metric.tone === "up"
                  ? "text-up"
                  : metric.tone === "down"
                    ? "text-down"
                    : "text-primary",
              )}
            >
              {metric.note}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
