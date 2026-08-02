import Link from "next/link";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { getSeries } from "@/lib/providers/fred";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, formatEtDateShort, formatPercent, formatPrice } from "@/lib/utils";

/**
 * Nabız kartı — Brent petrol ve VIX.
 *
 * Yan kolondaki diğer kartlar hisse ve tahvil tarafını okuyor; bu ikisi o
 * ikisinin arka planı. Petrol enflasyon beklentisinin en hızlı okunan
 * göstergesi, VIX ise piyasanın kendi hakkındaki gerginliği.
 *
 * BRENT NEDEN FON ÜZERİNDEN: FRED'in spot Brent serisi (DCOILBRENTEU) resmî
 * ama YAPISAL OLARAK GECİKMELİ — yayın takvimi gereği son gözlem çoğu zaman
 * dört-beş iş günü geride kalıyor ve kartta bayat bir sayı duruyordu. BNO
 * (United States Brent Oil Fund) ABD borsasında işlem gördüğü için son
 * seansın kapanışını veriyor. Bu, ürünün başka yerde de kullandığı
 * konvansiyon: endeks kartları da endeksin kendisini değil onu izleyen
 * ETF'i gösteriyor (Nasdaq 100 → QQQ). Seviye fonun fiyatıdır, varil
 * fiyatı değil; kartın altındaki not bunu açıkça söylüyor.
 *
 * VIX tarafında bu sorun yok: VIXCLS bir önceki kapanışı ertesi gün veriyor
 * ve hücre kendi gözlem tarihini yazıyor.
 */

const BRENT_SYMBOL = "BNO";
const VIX = { seriesId: "VIXCLS", slug: "vix", units: "lin" };

type BandKey =
  | "fearCalm"
  | "fearNormal"
  | "fearTense"
  | "fearHigh"
  | "fearPanic";

/** VIX bantları — uzun dönem ortalaması ~20. */
function vixBand(level: number): { key: BandKey; tone: string } {
  if (level < 15) return { key: "fearCalm", tone: "text-up" };
  if (level < 20) return { key: "fearNormal", tone: "text-body" };
  if (level < 30) return { key: "fearTense", tone: "text-brass" };
  if (level < 50) return { key: "fearHigh", tone: "text-down" };
  return { key: "fearPanic", tone: "text-down" };
}

export async function PulseCard({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [brentResult, vix] = await Promise.all([
    getQuotes([BRENT_SYMBOL], status),
    getSeries(VIX, 3),
  ]);

  const brent = brentResult.ok ? brentResult.data[BRENT_SYMBOL] : undefined;

  const vixValue = vix.ok ? vix.data.latestValue : null;
  const vixPrev = vix.ok ? vix.data.prevValue : null;
  const vixDate = vix.ok ? (vix.data.observations.at(-1)?.date ?? null) : null;

  if (!brent && vixValue === null) return null;

  const vixDelta =
    vixValue !== null && vixPrev !== null ? vixValue - vixPrev : null;
  const band = vixValue !== null ? vixBand(vixValue) : null;

  return (
    <Panel>
      <PanelHeader
        title={t.markets.pulseTitle}
        action={<PanelLink href="/piyasalar">{t.common.showAll}</PanelLink>}
      />
      <div className="grid grid-cols-2 border-t border-line">
        {/* ---- Brent ---- */}
        <Link
          href={`/hisse/${BRENT_SYMBOL}`}
          className="px-4 py-3.5 transition-colors hover:bg-primary-tint"
        >
          <p className="plate text-[10px] tracking-[0.08em]">{t.markets.brent}</p>
          <p className="tote mt-1 text-lg">
            {brent ? (
              <>
                <span className="mr-0.5 text-xs text-muted">$</span>
                {formatPrice(brent.price, locale)}
              </>
            ) : (
              "—"
            )}
          </p>
          <p className="numeral mt-0.5 text-[11px]">
            {brent ? (
              <span
                className={cn(
                  "font-semibold",
                  brent.changePct > 0
                    ? "text-up"
                    : brent.changePct < 0
                      ? "text-down"
                      : "text-muted",
                )}
              >
                {brent.changePct !== 0 && (
                  <span aria-hidden>{brent.changePct > 0 ? "▲ " : "▼ "}</span>
                )}
                {formatPercent(brent.changePct, locale)}
              </span>
            ) : (
              <span className="text-muted">{t.common.noData}</span>
            )}
          </p>
        </Link>

        {/* ---- VIX ---- */}
        <Link
          href="/rehber/volatilite"
          className="border-l border-line px-4 py-3.5 transition-colors hover:bg-primary-tint"
        >
          <p className="plate text-[10px] tracking-[0.08em]">
            {t.markets.fearTitle}
          </p>
          <p className="tote mt-1 text-lg">
            {vixValue !== null
              ? formatPrice(vixValue, locale, { digits: 2 })
              : "—"}
          </p>
          <p className="numeral mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
            {band && (
              <span className={cn("font-semibold", band.tone)}>
                {t.markets[band.key]}
              </span>
            )}
            {vixDelta !== null && vixDelta !== 0 && (
              <>
                {/* Yükselen VIX gerginliktir: yön rengi hisse sözlüğünün
                    tersine kurulu. */}
                <span
                  aria-hidden
                  className={cn(
                    "font-semibold",
                    vixDelta > 0 ? "text-down" : "text-up",
                  )}
                >
                  {vixDelta > 0 ? "▲" : "▼"}
                </span>
                <span>
                  {formatPrice(Math.abs(vixDelta), locale, { digits: 2 })}
                </span>
              </>
            )}
          </p>
        </Link>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[10.5px] leading-relaxed text-muted">
        {t.markets.pulseHint}
        {vixDate ? ` · VIX ${formatEtDateShort(vixDate, locale)}` : ""}
      </p>
    </Panel>
  );
}
