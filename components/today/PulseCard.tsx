import Link from "next/link";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { getSeries } from "@/lib/providers/fred";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, formatEtDateShort, formatPrice } from "@/lib/utils";

/**
 * Nabız kartı — Brent petrol ve VIX.
 *
 * Yan kolondaki diğer kartlar hisse ve tahvil tarafını okuyor; bu ikisi o
 * ikisinin arka planı. Petrol enflasyon beklentisinin en hızlı okunan
 * göstergesi, VIX ise piyasanın kendi hakkındaki gerginliği. İkisi tek
 * kartta çünkü ikisi de tek sayıdan ibaret ve ayrı ayrı kart olmayı hak
 * edecek kadar derin değil.
 *
 * FRED günlük kapanış yayımlar ve bir-iki iş günü gecikebilir; bu yüzden
 * her hücre kendi gözlem tarihini yazar. "Canlı fiyat" iddiası yok —
 * ekrandaki tarih neyse o.
 */

const BRENT = { seriesId: "DCOILBRENTEU", slug: "brent", units: "lin" };
const VIX = { seriesId: "VIXCLS", slug: "vix", units: "lin" };

/** VIX bantları — uzun dönem ortalaması ~20. */
function vixBand(level: number): { key: keyof Dictionary["markets"]; tone: string } {
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
  const [brent, vix] = await Promise.all([
    getSeries(BRENT, 3),
    getSeries(VIX, 3),
  ]);

  const brentValue = brent.ok ? brent.data.latestValue : null;
  const brentPrev = brent.ok ? brent.data.prevValue : null;
  const brentDate = brent.ok ? (brent.data.observations.at(-1)?.date ?? null) : null;

  const vixValue = vix.ok ? vix.data.latestValue : null;
  const vixPrev = vix.ok ? vix.data.prevValue : null;
  const vixDate = vix.ok ? (vix.data.observations.at(-1)?.date ?? null) : null;

  if (brentValue === null && vixValue === null) return null;

  const brentDelta =
    brentValue !== null && brentPrev !== null && brentPrev !== 0
      ? ((brentValue - brentPrev) / brentPrev) * 100
      : null;
  const vixDelta = vixValue !== null && vixPrev !== null ? vixValue - vixPrev : null;
  const band = vixValue !== null ? vixBand(vixValue) : null;

  return (
    <Panel>
      <PanelHeader
        title={t.markets.pulseTitle}
        action={<PanelLink href="/piyasalar">{t.common.showAll}</PanelLink>}
      />
      <div className="grid grid-cols-2 border-t border-line">
        {/* ---- Brent ---- */}
        <div className="px-4 py-3.5">
          <p className="plate text-[10px] tracking-[0.08em]">
            {t.markets.brent}
          </p>
          <p className="tote mt-1 text-lg">
            {brentValue !== null ? (
              <>
                <span className="mr-0.5 text-xs text-muted">$</span>
                {formatPrice(brentValue, locale, { digits: 2 })}
              </>
            ) : (
              "—"
            )}
          </p>
          <p className="numeral mt-0.5 text-[11px] text-muted">
            {brentDelta === null || brentDelta === 0 ? (
              brentDate ? formatEtDateShort(brentDate, locale) : t.common.noData
            ) : (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "font-semibold",
                    brentDelta > 0 ? "text-up" : "text-down",
                  )}
                >
                  {brentDelta > 0 ? "▲" : "▼"}
                </span>{" "}
                {formatPrice(Math.abs(brentDelta), locale, { digits: 1 })}%
              </>
            )}
          </p>
        </div>

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
                <span>{formatPrice(Math.abs(vixDelta), locale, { digits: 2 })}</span>
              </>
            )}
          </p>
        </Link>
      </div>
      <p className="numeral border-t border-line px-4 py-2 text-[10.5px] text-muted">
        FRED
        {brentDate ? ` · ${t.markets.brent} ${formatEtDateShort(brentDate, locale)}` : ""}
        {vixDate ? ` · VIX ${formatEtDateShort(vixDate, locale)}` : ""}
      </p>
    </Panel>
  );
}
