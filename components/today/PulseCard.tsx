import Link from "next/link";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
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
 * BRENT NEDEN FON ÜZERİNDEN DEĞİL — bir geri alınmış karar
 * ------------------------------------------------------------------
 * Bir süre burada BNO (United States Brent Oil Fund) kapanışı gösterildi.
 * Gerekçe tazelikti: FRED'in spot serisi birkaç iş günü geriden geliyor,
 * BNO ise ABD seansında işlem görüyor. Sonuç kabul edilemezdi.
 *
 * "BRENT PETROL" başlığının altında "$50,37" yazınca okuyan kişi bunu VARİL
 * FİYATI olarak okur — başka türlü okunmaz. Gerçek varil fiyatı o sırada
 * ~$89'du. Kartın altındaki "seviye fonun fiyatıdır" notu bunu kurtarmıyor:
 * bir sayıyı büyük punto ile yanlış, küçük punto ile doğru göstermek yanlış
 * göstermektir.
 *
 * Endeks kartlarındaki ETF konvansiyonu (Nasdaq 100 → QQQ) buna emsal değil.
 * Bir endeksin "seviyesi" okuyucunun kafasında zaten soyut bir sayı; emtianın
 * fiyatı ise doğrudan dolar/varil demek. Aynı desen, iki farklı okuma.
 *
 * Artık DCOILBRENTEU: gerçek varil fiyatı, gözlem tarihi damgalı. Gecikmeyi
 * kabul ediyoruz çünkü yanındaki VIX hücresi de tam olarak bunu yapıyor —
 * doğru ve damgalı, taze ve yanlıştan iyidir.
 */

const BRENT = { seriesId: "DCOILBRENTEU", slug: "brent", units: "lin" };
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
  const [brentResult, vix] = await Promise.all([
    getSeries(BRENT, 3),
    getSeries(VIX, 3),
  ]);

  const brentValue = brentResult.ok ? brentResult.data.latestValue : null;
  const brentPrev = brentResult.ok ? brentResult.data.prevValue : null;
  const brentDate = brentResult.ok
    ? (brentResult.data.observations.at(-1)?.date ?? null)
    : null;
  /* Yüzde, iki gözlem arasındaki fark — "günlük değişim" DEĞİL, çünkü
     gözlemler arasında hafta sonu ya da tatil olabiliyor. Künyedeki tarih
     hangi güne ait olduğunu zaten söylüyor. */
  const brentDelta =
    brentValue !== null && brentPrev !== null && brentPrev !== 0
      ? ((brentValue - brentPrev) / brentPrev) * 100
      : null;

  const vixValue = vix.ok ? vix.data.latestValue : null;
  const vixPrev = vix.ok ? vix.data.prevValue : null;
  const vixDate = vix.ok ? (vix.data.observations.at(-1)?.date ?? null) : null;

  if (brentValue === null && vixValue === null) return null;

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
          href="/rehber/enflasyon"
          className="px-4 py-3.5 transition-colors hover:bg-primary-tint"
        >
          <p className="plate text-[10px] tracking-[0.08em]">{t.markets.brent}</p>
          <p className="tote mt-1 text-lg">
            {brentValue !== null ? (
              <>
                <span className="mr-0.5 text-xs text-muted">$</span>
                {formatPrice(brentValue, locale)}
              </>
            ) : (
              "—"
            )}
          </p>
          <p className="numeral mt-0.5 text-[11px]">
            {brentValue !== null ? (
              <span
                className={cn(
                  "font-semibold",
                  brentDelta === null
                    ? "text-muted"
                    : brentDelta > 0
                      ? "text-up"
                      : brentDelta < 0
                        ? "text-down"
                        : "text-muted",
                )}
              >
                {brentDelta !== null && brentDelta !== 0 && (
                  <span aria-hidden>{brentDelta > 0 ? "▲ " : "▼ "}</span>
                )}
                {brentDelta !== null
                  ? formatPercent(brentDelta, locale)
                  : t.markets.barrel}
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
      {/* Her iki sayı da FRED kapanışı ve ikisi de gecikebiliyor; künye her
          hücrenin kendi gözlem tarihini ayrı ayrı yazar. */}
      <p className="border-t border-line px-4 py-2.5 text-[10.5px] leading-relaxed text-muted">
        {t.markets.pulseHint}
        {brentDate ? ` · Brent ${formatEtDateShort(brentDate, locale)}` : ""}
        {vixDate ? ` · VIX ${formatEtDateShort(vixDate, locale)}` : ""}
      </p>
    </Panel>
  );
}
