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
 * (CLAUDE.md "Karşılaştırılan her büyüklük bir de ÇİZGİ olarak okunur").
 * Soldan sağa eskiden yeniye — sitenin okuma yönü zamanla aynı.
 *
 * MERMİ GRAFİĞİ (26 Eylül). İlk sürüm bir "lollipop"tu: halka beklenti,
 * nokta gerçekleşen, aralarında saç teli. Boş alanda yüzen noktalar bir
 * sütun grafiği gibi okunmuyordu ve "sütun grafiği kötü" diye bildirildi.
 * Şimdi beklenti kesik çizgili geniş bir çerçeve, gerçekleşen onun içinde
 * dolu bir sütun; ikisi de sıfırdan.
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
/** Sıfırın altına inen çeyrekte alt uca bırakılan pay. */
const DOMAIN_PAD = 0.12;
/** Üst uçtaki pay: en yüksek sütunun sapma künyesi oraya iner. */
const DOMAIN_PAD_TOP = 0.26;

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
  /* SÜTUNLAR SIFIRDAN (26 Eylül). Mermi grafiğinde uzunluk değerin kendisi;
     taban sıfır olmazsa 1,30 ile 2,22 arasındaki fark olduğundan büyük
     görünürdü. Aralık bu yüzden sıfırı her zaman içeriyor; zarar eden
     çeyrek sıfır çizgisinin ALTINA iniyor. Üstte sapma künyesine pay. */
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const spanV = hi - lo || 1;
  const top = hi + spanV * DOMAIN_PAD_TOP;
  const bottom = lo < 0 ? lo - spanV * DOMAIN_PAD : lo;
  const y = (value: number) => ((value - bottom) / (top - bottom)) * 100;
  const zero = y(0);
  const crossesZero = lo < 0;
  /** Değerden sıfıra uzanan sütunun yeri: alt kenar ve boy (yüzde). */
  const bar = (value: number) => ({
    bottom: `${Math.min(zero, y(value))}%`,
    height: `${Math.max(Math.abs(y(value) - zero), 0.8)}%`,
  });

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
        <span><i aria-hidden className={styles.legendEstimate} />{t.calendar.forecast}</span>
        <span><i aria-hidden className={styles.legendActual} />{t.calendar.actual}</span>
      </figcaption>
      {/* SIFIR ÇİZGİSİ yalnızca aralık sıfırı geçiyorsa (zarardan kâra ya
          da tersi). Her sütunun çizim alanı onu kendi içinde çiziyor;
          sütunlar arasında boşluk olmadığı için tek bir çizgi gibi okunuyor. */}
      <ol
        className={styles.columns}
        style={{
          gridTemplateColumns: `repeat(${quarters.length}, minmax(0, 1fr))`,
          "--eps-zero": `${zero}%`,
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
                {/* Sapma künyesi iki sütunun YÜKSEĞİNİN hemen üstünde — hangi
                    sayının hangi çeyreğe ait olduğu çizgi izlenmeden okunuyor. */}
                {surprise && est !== null && act !== null && (
                  <span
                    className={cn("numeral", styles.surprise)}
                    data-tone={surprise.direction}
                    style={{ bottom: `calc(${y(Math.max(est, act, 0))}% + 6px)` }}
                  >
                    {formatEpsSurprise(surprise, locale, currency)}
                  </span>
                )}
                {/* BEKLENTİ: geniş, kesik çizgili bir çerçeve. GERÇEKLEŞEN:
                    onun içinde dolu, daha dar bir sütun. Dolu sütun çerçeveyi
                    aşıyorsa beklenti aşıldı, altında kalıyorsa ıskalandı —
                    göz okumadan görüyor. İkisi de sıfırdan uzanıyor ve
                    görünüme girince bir kez büyüyor (`data-motion-draw`). */}
                {est !== null && (
                  <span className={styles.estimate} data-motion-draw="bar" style={bar(est)} />
                )}
                {act !== null && (
                  <span
                    className={styles.actual}
                    data-tone={surprise?.direction ?? "flat"}
                    data-motion-draw="bar"
                    style={bar(act)}
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
