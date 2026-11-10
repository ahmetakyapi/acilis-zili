import { barScale } from "@/lib/theme-view";
import { cn, directionOf, formatPercent } from "@/lib/utils";
import styles from "./ThemeStrip.module.css";

/**
 * Temanın şeridi — detay kapağında medyanın (ve ölçüt fonunun) çizimi
 * (10 Kasım 2026).
 *
 * TARİHÇE (aynı gün, üç hâl):
 *   1. Sabah: her üye, günlük hareketi kadar sağda ya da solda bir çentik;
 *      dolu düğme temanın medyanı, içi boş kare im ölçüt fonu. Dizin
 *      panosunun satırında ve detay kapağında aynı çizimdi.
 *   2. Öğlen, KALIN YATAY ŞERİT (sahibinin itirazı: "böyle nokta nokta ne
 *      anlatıyor anlamıyorum; çizgi grafiği yerine yatayda uzun kalın çizgi
 *      seviyorum"). Üç ayrı im aynı şeritteydi ve okur neye bakacağını
 *      bilmiyordu. Şerit TEK şey söyler oldu: sıfırdan temanın medyanına
 *      uzanan dolu çubuk, yönü renginde. Üyelerin dağılımı tabloya ve
 *      haritaya gitti. Ölçüt fonu ince, koyu bir çentik olarak kaldı.
 *   3. Akşam, ÖLÇÜT DE ÇUBUK. Çentik aynı itirazın kapsamındaydı (çözülmesi
 *      gereken tek başına bir im) ve ölçeğe girmediği için çoğu gün şeridin
 *      ucuna yapışıyordu (SMH −%1,47, ölçek ±%1: çentik sol kenarda,
 *      "nerede" sorusuna yanlış cevap). Şimdi kıyas iki kalın çubuk, aynı
 *      eksende alt alta: üstte temanın medyanı (14 piksel), altında ölçüt
 *      fonu (8 piksel; ikincil olduğu için ince). Fark iki çubuğun UZUNLUK
 *      farkı olarak okunur; ölçüt artık ölçeğe giriyor.
 *      Dizin panosu bu bileşeni bırakıp kendi çubuğunu çiziyor (sayı çubuğun
 *      ucunda, eksen günün aralığı kadar — ThemeBoard.tsx).
 *
 * EKSEN: iki çubuk varken günün aralığı (sıfır, iki değerin işaretine göre
 * kenarda ya da arada; en uzun çubuk kulvarın ucuna dayanır, uç etiketi
 * yok: iki sayı da yanında yazıyor). Tek çubuk varken (ölçütsüz tema ya da
 * ölçüt başka seansı anlatıyor) çubuğun boyu bir şeye göre okunmalı: eksen
 * `barScale` basamağına kadar uzar ve ucunda basamağın etiketi durur.
 *
 * Renk son kapanışta da işaretten (15 Ekim, sahibinin isteği); dönemi
 * çağıranın künyesi söylüyor.
 */
export function ThemeStrip({
  median,
  bench,
  benchLane = false,
  names,
  label,
  locale,
  className,
}: {
  median: number | null;
  /** Ölçüt fonunun yüzdesi; yalnız temayla aynı seansı anlatıyorsa verilir. */
  bench?: number;
  /** Ölçüt kulvarının yeri tutulsun (temanın ölçütü var ama veri henüz
      inmedi ya da kıyas kurulmuyor): akış inince kapak oynamaz. */
  benchLane?: boolean;
  /** İki çubuğun satır başı etiketi ("Tema", "SMH"): hangi çubuğun ne
      olduğu çubuğun yanında yazar, künyeden çözülmez. */
  names?: { theme: string; bench: string | null };
  label: string;
  locale: string;
  className?: string;
}) {
  const values = [...(median === null ? [] : [median]), ...(bench === undefined ? [] : [bench])];
  /* Tek değerde eksen basamağa uzar; iki değerde uçlar değerlerin kendisi. */
  const solo = values.length === 1 ? barScale(values) : 0;
  const pos = Math.max(0, ...values, values.length === 1 && values[0] >= 0 ? solo : 0);
  const neg = Math.max(0, ...values.map((value) => -value), values.length === 1 && values[0] < 0 ? solo : 0);
  const total = pos + neg;
  const zero = total === 0 ? 50 : (neg / total) * 100;
  const bar = (value: number, kind: "theme" | "bench") => {
    const width = `${Math.max(total === 0 ? 0 : (Math.abs(value) / total) * 100, 0.6).toFixed(2)}%`;
    return (
      <i
        className={cn("bar-fill", styles.fill)}
        data-kind={kind}
        data-tone={directionOf(value)}
        style={value >= 0 ? { left: `${zero.toFixed(2)}%`, width } : { right: `${(100 - zero).toFixed(2)}%`, width }}
      />
    );
  };
  return (
    <span className={cn(styles.strip, className)} role="img" aria-label={label}>
      <span className={styles.plot} data-named={names ? "" : undefined} style={{ ["--zero" as string]: `${zero.toFixed(2)}%` }} aria-hidden>
        {names && <span className={styles.rowName}>{names.theme}</span>}
        <span className={styles.lane} data-kind="theme" data-axis={values.length > 0 ? "" : undefined}>
          {median !== null && bar(median, "theme")}
        </span>
        {(bench !== undefined || benchLane) && (
          <>
            {names && <span className={cn("numeral", styles.rowName)}>{names.bench}</span>}
            <span className={styles.lane} data-kind="bench" data-axis={values.length > 0 ? "" : undefined}>
              {bench !== undefined && bar(bench, "bench")}
            </span>
          </>
        )}
        {names && <span />}
      <span className={cn("numeral", styles.axis)}>
        <span>{solo > 0 && neg > 0 ? formatPercent(-solo, locale, 0) : values.length > 0 && zero < 1 ? "0" : ""}</span>
        <span style={{ left: `${zero.toFixed(2)}%` }} data-zero>
          {values.length > 0 && zero >= 1 && zero <= 99 ? "0" : ""}
        </span>
        <span>{solo > 0 && pos > 0 ? formatPercent(solo, locale, 0) : values.length > 0 && zero > 99 ? "0" : ""}</span>
      </span>
      </span>
    </span>
  );
}
