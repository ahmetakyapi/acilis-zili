import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { epsSurprise, formatEpsSurprise, type PastQuarter } from "./past-quarters";
import styles from "./EpsTrack.module.css";

/**
 * EPS İZİ — geçmiş bilançolar tablosunun üstünde, çeyrek başına bir sütun
 * (23 Eylül).
 *
 * NEDEN: bölümün tek görseli dört bölmeli "Beklenti Karnesi" idi ve tablo
 * dört sayıyı 1318 piksele yayıyordu; EPS değerleri 173-212 piksellik
 * sütunlarda ~35 piksel yer tutuyor, gidişat (1,30 → 1,62 → 1,87 → 2,22)
 * rakam rakam okunarak çıkarılıyordu. İz aynı sayıları UZUNLUK olarak veriyor
 * (CLAUDE.md "Karşılaştırılan her büyüklük bir de ÇİZGİ olarak okunur"):
 * halka beklenti, dolu nokta gerçekleşen, aradaki çizgi sapma. Soldan sağa
 * eskiden yeniye — sitenin okuma yönü zamanla aynı.
 *
 * Satırlar tablonunkiyle AYNI dizi (`buildPastQuarters`) ve sapma aynı
 * kuralla yazılıyor (`formatEpsSurprise`: yüzde tek ondalık ya da dolar
 * farkı), yani iz ile tablo bir çeyrek için iki farklı sayı gösteremez.
 * Renk tek taşıyıcı değil: yön yazının içinde işaretli (+/−).
 *
 * Çizim `aria-hidden` değil ama erişilebilir veri TABLODA; şekil yalnızca
 * tek cümlelik bir özetle adlanıyor. İstemci JavaScript'i yok: konumlar
 * sunucuda yüzde olarak hesaplanıyor, çizgiler `data-motion-draw="bar"` ile
 * bir kez büyüyor, noktalar `spark-dot` ile oturuyor.
 */
/** İzde en çok bu kadar çeyrek — tablonun gösterdiği kadar. */
const MAX_QUARTERS = 8;
/** Değer aralığının alt ucuna bırakılan pay: halka kenara yapışmasın. */
const DOMAIN_PAD = 0.14;
/** Üst uçtaki pay daha geniş: en yüksek işaretin sapma künyesi oraya iner. */
const DOMAIN_PAD_TOP = 0.42;

export function EpsTrack({
  rows,
  locale,
  currency,
  t,
}: {
  /** En yeni çeyrek başta — tablonun sırası. */
  rows: readonly PastQuarter[];
  locale: Locale;
  currency: string | true;
  t: Dictionary;
}) {
  const quarters = rows
    .filter((row) => row.epsActual !== null || row.epsEstimate !== null)
    .slice(0, MAX_QUARTERS)
    .reverse();
  const paired = quarters.filter((row) => row.epsActual !== null && row.epsEstimate !== null);
  // Tek çeyrekte bir iz çizilmez: gidişatı olmayan tek nokta tablonun kopyası.
  if (paired.length < 2) return null;

  const values = quarters.flatMap((row) =>
    [row.epsEstimate, row.epsActual].filter((value): value is number => value !== null),
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * DOMAIN_PAD || Math.abs(max) * DOMAIN_PAD || DOMAIN_PAD;
  const lo = min - pad;
  const hi = max + ((max - min) * DOMAIN_PAD_TOP || pad * 3);
  const y = (value: number) => ((value - lo) / (hi - lo)) * 100;
  const crossesZero = lo < 0 && hi > 0;

  const beat = paired.filter((row) => row.epsActual! > row.epsEstimate!).length;
  const summary = (
    beat === paired.length
      ? t.earnings.beatRecordAll
      : beat === 0
        ? t.earnings.beatRecordNone
        : t.earnings.beatRecordLine
  )
    .replace("{total}", String(paired.length))
    .replace("{beat}", String(beat));

  return (
    <figure className={styles.track} aria-label={summary}>
      {/* Lejant künyedir: iki işaretin adı, cümle değil. */}
      <figcaption className={styles.legend}>
        <span><i aria-hidden className={styles.legendRing} />{t.calendar.forecast}</span>
        <span><i aria-hidden className={styles.legendDot} />{t.calendar.actual}</span>
      </figcaption>
      {/* SIFIR ÇİZGİSİ yalnızca aralık sıfırı geçiyorsa (zarardan kâra ya
          da tersi). Her sütunun çizim alanı onu kendi içinde çiziyor;
          sütunlar arasında boşluk olmadığı için tek bir çizgi gibi okunuyor. */}
      <ol
        className={styles.columns}
        style={{
          gridTemplateColumns: `repeat(${quarters.length}, minmax(0, 1fr))`,
          ...(crossesZero ? { "--eps-zero": `${y(0)}%` } : {}),
        } as React.CSSProperties}
        data-zero={crossesZero || undefined}
      >
        {quarters.map((row) => {
          const surprise = epsSurprise(row.epsEstimate, row.epsActual);
          const est = row.epsEstimate;
          const act = row.epsActual;
          return (
            <li key={row.key} className={styles.column}>
              <span aria-hidden className={styles.plot}>
                {/* KÜNYE İŞARETİN HEMEN ÜSTÜNDE. Sütunun tepesinde sabit bir
                    satırdaydı ve işaretler ölçeğin altına düştüğünde (NVDA'da
                    en eski çeyrek) sayı ile nokta arasında 90 piksel boş bir
                    saç teli kalıyordu; hangi sayının hangi noktaya ait olduğu
                    çizgiyi izleyerek okunuyordu. */}
                {surprise && est !== null && act !== null && (
                  <span
                    className={cn("numeral", styles.surprise)}
                    data-tone={surprise.direction}
                    style={{ bottom: `calc(${y(Math.max(est, act))}% + 9px)` }}
                  >
                    {formatEpsSurprise(surprise, locale, currency)}
                  </span>
                )}
                {est !== null && act !== null && Math.abs(act - est) > 0 && (
                  <span
                    className={styles.stem}
                    data-motion-draw="bar"
                    style={{ bottom: `${y(Math.min(est, act))}%`, height: `${Math.abs(y(act) - y(est))}%` }}
                  />
                )}
                {est !== null && (
                  <span className={styles.ring} style={{ bottom: `${y(est)}%` }} />
                )}
                {act !== null && (
                  <span
                    className={cn(styles.dot, "spark-dot")}
                    data-tone={surprise?.direction ?? "flat"}
                    style={{ bottom: `${y(act)}%` }}
                  />
                )}
              </span>
              <span className={cn("numeral", styles.axis)}>{row.shortLabel ?? ""}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
