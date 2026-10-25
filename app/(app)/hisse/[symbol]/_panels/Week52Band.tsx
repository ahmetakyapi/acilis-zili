import styles from "../stock.module.css";
import { PriceRail } from "@/components/ui/PriceRail";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";
import type { week52Band } from "./shared";

type Band = NonNullable<ReturnType<typeof week52Band>>;

/**
 * 52 hafta bandı — iki yerde aynı çizim (15 Ekim).
 *
 * GENİŞ EKRANDA GRAFİĞİN BAŞLIĞINDA. Bant profil kartının dibindeydi ve
 * kartı 132 piksel uzatıyordu; kolon grafiği geriyor, grafik 280'lik
 * tabanından 640'a uzuyordu ve kapak 900 piksellik ekranda 1214'te
 * bitiyordu (sahibi: "grafik uzun hissettiriyor, ilk girişte ekrana
 * otursun"). Fiyatın sağı ise boştu: bant fiyatın kendi bağlamı — "şu
 * fiyat, yılın şurasında" — o boşluğa oturuyor. Dar ekranda başlık zaten
 * alt alta dizildiği için bant profilde kalıyor; ikisi CSS ile seçiliyor
 * (stock.module.css → "İLK EKRANA OTURAN KAPAK").
 *
 * Gerekçeler değişmedi (ProfileCard'daki 24 Eylül / 28 Eylül / 1 Ekim
 * notları): uçlar metin, ray yalnızca çizim; ADR'de ray ve uzaklık yok.
 */
export function Week52Band({
  band,
  price,
  locale,
  t,
  className,
  quoteLabel = true,
}: {
  band: Band;
  price: number | null;
  locale: Locale;
  t: Dictionary;
  className?: string;
  /** Rayın üstündeki "Son Fiyat" etiketi. Başlıktaki bantta YOK (25 Ekim):
      aynı fiyat hemen solunda büyük puntoyla yazılı, etiket kartı 20 piksel
      uzatıp aynı sayıyı ikinci kez basıyordu. Profildeki bantta duruyor. */
  quoteLabel?: boolean;
}) {
  /* Dipten ve zirveden uzaklık — yalnız ray çizildiğinde (dolar cinsinden
     fiyat banda aitse); ADR'de fiyat ile uçlar farklı para biriminde. */
  const distance =
    band.onRail && price !== null && band.low > 0 && band.high > 0
      ? { fromLow: ((price - band.low) / band.low) * 100, fromHigh: ((band.high - price) / band.high) * 100 }
      : null;
  return (
    <div className={className}>
      <div className={styles.bandHead}>
        <span className={styles.profileBandLabel}>{t.stock.week52Range}</span>
        {band.position !== null && (
          <span className={cn("numeral", styles.bandPosition)}>
            {t.stock.week52Position.replace("{value}", formatPercentPlain(band.position, locale, 0))}
          </span>
        )}
      </div>
      {band.onRail && price !== null && (
        <PriceRail
          marks={[
            { kind: "band", from: band.low, to: band.high, tone: "range" },
            {
              kind: "point",
              at: price,
              variant: "live",
              ...(quoteLabel
                ? { label: t.stock.currentQuote, value: formatPrice(price, locale, { currency: band.para }), side: "above" as const }
                : {}),
            },
          ]}
          pad={0}
          className={styles.bandRail}
        />
      )}
      <dl className={styles.bandEnds}>
        <div>
          <dt>{t.chart.periodLow}</dt>
          <dd className="numeral">{formatPrice(band.low, locale, { currency: band.para })}</dd>
          {distance && (
            <dd className={cn("numeral", styles.bandDistance)}>
              {t.stock.bandFromLow.replace("{value}", formatPercentPlain(distance.fromLow, locale, 0))}
            </dd>
          )}
        </div>
        <div>
          <dt>{t.chart.periodHigh}</dt>
          <dd className="numeral">{formatPrice(band.high, locale, { currency: band.para })}</dd>
          {distance && (
            <dd className={cn("numeral", styles.bandDistance)}>
              {t.stock.bandFromHigh.replace("{value}", formatPercentPlain(distance.fromHigh, locale, 0))}
            </dd>
          )}
        </div>
      </dl>
    </div>
  );
}
