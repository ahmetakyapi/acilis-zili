import type { CSSProperties } from "react";
import styles from "../stock.module.css";
import { PlayOnView } from "@/components/motion/PlayOnView";
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
 *
 * ÇİZİM YENİDEN (10 Kasım): DİP–TEPE EKSENİ. Önce ortak `PriceRail` (14
 * piksellik gömülü bant + mavi halkalı nokta) ve altında iki satırlık uç
 * listesi vardı; başlıkta bunlar kenarlıklı, gömülü bir kartın içindeydi
 * (panelin içinde kart, 111 piksel). Şimdi uç değerleri eksenin İKİ
 * UCUNDA aynı satırda duruyor ("164,27 $ ──●──── 243,37 $"): göz sayıyı
 * çizginin bittiği yerde buluyor, ayrı etiket satırı gerekmiyor. Eksen
 * sayfanın şerit dilinde: kulvar (`--line-soft`) üstünde 5 piksel, dipten
 * fiyata kadar sitenin büyüklük tonuyla (`--bar-soft`) dolu, im en koyu
 * mürekkep: Skor Kartı şeritleriyle AYNI dil (çentik yok, 11 Ekim kararı).
 * Mavi yok, konum bir ölçü. Altında uçlara uzaklık. Başlıkta
 * kutu kalktı, yerine tek dikey kıl çizgi (ölçüler stock.module.css →
 * "FİYAT BLOĞU, TEK OKUMA").
 * Profildeki "Son Fiyat" etiketi de kalktı: konum başlıkta yazılı, fiyat
 * sayfanın başında; etiket rayın üstünde 20 piksellik ayrı bir satırdı.
 *
 * HAREKET: im dipten yerine kayar, dolgu onunla birlikte uzar (tek okuma:
 * "dipten buraya geldi"). Yalnız `transform`; sunucu son kareyi basar.
 * Başlıkta ilk ekran koreografisinin bir adımı (CSS, yüklemede), profilde
 * ekranın altında olduğu için `PlayOnView` ile görünce bir kez.
 */
export function Week52Band({
  band,
  price,
  locale,
  t,
  className,
}: {
  band: Band;
  price: number | null;
  locale: Locale;
  t: Dictionary;
  className?: string;
}) {
  /* Dipten ve zirveden uzaklık — yalnız eksen çizildiğinde (dolar cinsinden
     fiyat banda aitse); ADR'de fiyat ile uçlar farklı para biriminde. */
  const distance =
    band.onRail && price !== null && band.low > 0 && band.high > 0
      ? { fromLow: ((price - band.low) / band.low) * 100, fromHigh: ((band.high - price) / band.high) * 100 }
      : null;
  const drawn = band.onRail && price !== null && band.position !== null;
  return (
    <PlayOnView className={cn(styles.band52, className)}>
      <div className={styles.bandHead}>
        <span className={styles.profileBandLabel}>{t.stock.week52Range}</span>
        {band.position !== null && (
          <span className={cn("numeral", styles.bandPosition)}>
            {t.stock.week52Position.replace("{value}", formatPercentPlain(band.position, locale, 0))}
          </span>
        )}
      </div>
      {/* Uçlar bir tanım listesi: ad (`dt`) eksen çizilince yalnız ekran
          okuyucuya — "Dibin %9 Üstünde" ucun hangisi olduğunu zaten
          söylüyor; ADR'de uzaklık yok, ad görünür kalıyor. */}
      <div className={styles.bandBody} data-drawn={drawn ? "" : undefined}>
        {drawn && (
          <div aria-hidden className={styles.bandAxis} style={{ "--band-p": (band.position ?? 0) / 100 } as CSSProperties}>
            <i className={styles.bandLane} />
            <i className={styles.bandFill} />
            <i className={styles.bandTravel}>
              <i className={styles.bandPin} />
            </i>
          </div>
        )}
        <dl className={styles.bandEnds}>
          <div data-end="low">
            <dt className={distance ? "sr-only" : undefined}>{t.chart.periodLow}</dt>
            <dd className="numeral">{formatPrice(band.low, locale, { currency: band.para })}</dd>
            {distance && (
              <dd className={cn("numeral", styles.bandDistance)}>
                {t.stock.bandFromLow.replace("{value}", formatPercentPlain(distance.fromLow, locale, 0))}
              </dd>
            )}
          </div>
          <div data-end="high">
            <dt className={distance ? "sr-only" : undefined}>{t.chart.periodHigh}</dt>
            <dd className="numeral">{formatPrice(band.high, locale, { currency: band.para })}</dd>
            {distance && (
              <dd className={cn("numeral", styles.bandDistance)}>
                {t.stock.bandFromHigh.replace("{value}", formatPercentPlain(distance.fromHigh, locale, 0))}
              </dd>
            )}
          </div>
        </dl>
      </div>
    </PlayOnView>
  );
}
