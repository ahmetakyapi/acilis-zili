import Link from "next/link";
import { Sparkline } from "@/components/ui/Sparkline";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getChartBars } from "@/lib/providers";
import type { ChartRange } from "@/lib/providers/types";
import { getI18n } from "@/lib/i18n";
import { cn, directionOf, formatPercent, formatPrice } from "@/lib/utils";

/**
 * Yazının içine gömülen gerçek fiyat grafiği.
 *
 * Neden stok fotoğraf değil de bu: bir piyasa yazısında en anlamlı görsel,
 * anlatılan hisseye ne olduğudur. Veriyi zaten kendi sağlayıcımızdan
 * çekiyoruz — telif sorunu yok, her açılışta güncel ve yazının iddiasını
 * doğrudan gösteriyor.
 *
 * Sunucuda çizilir (Sparkline SVG üretir), istemciye ek JS inmez. Veri
 * gelmezse blok tamamen düşer; yazı boş bir kutuyla kalmaz.
 */

const RANGE_LABEL: Record<string, string> = {
  "1D": "Bugün",
  "1W": "Son 1 hafta",
  "1M": "Son 1 ay",
  "3M": "Son 3 ay",
  "6M": "Son 6 ay",
  YTD: "Yılbaşından beri",
  "1Y": "Son 1 yıl",
  "5Y": "Son 5 yıl",
};

export async function ArticleChart({
  symbol,
  range,
  caption,
}: {
  symbol: string;
  range: ChartRange;
  caption?: string;
}) {
  const { locale } = await getI18n();
  const status = await getStatus();
  const [bars, meta] = await Promise.all([
    getChartBars(symbol, range, status),
    getSymbolNames([symbol]),
  ]);

  if (!bars.ok || bars.data.length < 2) return null;

  const points = bars.data.map((bar) => ({ value: bar.close }));
  const first = bars.data[0].open || bars.data[0].close;
  const last = bars.data[bars.data.length - 1].close;
  const changePct = first ? ((last - first) / first) * 100 : 0;
  const tone = directionOf(changePct);
  const name = meta[symbol]?.name;

  return (
    <figure className="flex flex-col gap-0 overflow-hidden rounded-(--radius-lg) border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <Link
            href={`/hisse/${symbol}`}
            className="numeral text-[15px] font-bold tracking-[-0.02em] text-strong transition-colors hover:text-primary"
          >
            {symbol}
          </Link>
          {name && (
            <span className="text-[12.5px] text-muted">{name}</span>
          )}
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="tote text-[17px]">{formatPrice(last, locale)}</span>
          <span
            className={cn(
              "numeral text-[13px] font-semibold",
              tone === "up"
                ? "text-up"
                : tone === "down"
                  ? "text-down"
                  : "text-muted",
            )}
          >
            {formatPercent(changePct, locale)}
          </span>
        </div>
      </div>

      <Sparkline
        points={points}
        title={`${symbol} · ${RANGE_LABEL[range] ?? range}`}
        tone={tone}
        height={96}
        strokeWidth={1.8}
        className="mt-2 h-24 w-full"
      />

      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[11.5px] text-muted sm:px-5">
        <span>{caption ?? `${symbol} · ${RANGE_LABEL[range] ?? range}`}</span>
        <span className="numeral shrink-0">
          {RANGE_LABEL[range] ?? range} · Alpaca
        </span>
      </figcaption>
    </figure>
  );
}
