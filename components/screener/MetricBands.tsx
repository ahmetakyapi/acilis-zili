import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { median, metricBands, type MetricBand, type SwarmScale } from "@/lib/tool-visuals";
import { formatMoneyCompact, formatPercentPlain } from "@/lib/utils";
import styles from "./MetricBands.module.css";

type BandPoint = { s: string; n: string; v: number };
export type MetricKind = "ratio" | "percent" | "money";

type Labels = {
  medianLabel: string;
  universe: string;
  below: string;
  above: string;
  between: string;
  all: string;
  count: string;
  more: string;
  hint: string;
  namesHint: string;
  missing: string;
};

/** Basamağın yanında adıyla yazılan hisse sayısı; fazlası "+N". */
const NAMED = 3;

const signed = (value: number, text: string) => (value < 0 ? `−${text}` : text);

/** Sınır değeri: yuvarlak sayı, gereksiz ondalık yok. Eksi yüzde işaretini taşır. */
function formatEdge(value: number, kind: MetricKind, locale: string): string {
  /* "30,0 Mr $" → "30 Mr $": sınır yuvarlak sayı, ",0" gürültü. */
  if (kind === "money") return formatMoneyCompact(value, locale).replace(/[.,]0+(?=\D|$)/, "");
  const digits = Number.isInteger(value) ? 0 : 1;
  if (kind === "percent") return signed(value, formatPercentPlain(value, locale, digits));
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatValue(value: number, kind: MetricKind, locale: string): string {
  if (kind === "money") return formatMoneyCompact(value, locale);
  if (kind === "percent") return signed(value, formatPercentPlain(value, locale, 1));
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function bandLabel(band: MetricBand, kind: MetricKind, locale: string, labels: Labels): string {
  if (band.lo === null && band.hi === null) return labels.all;
  if (band.lo === null) return labels.below.replace("{v}", formatEdge(band.hi!, kind, locale));
  if (band.hi === null) return labels.above.replace("{v}", formatEdge(band.lo, kind, locale));
  return labels.between.replace("{a}", formatEdge(band.lo, kind, locale)).replace("{b}", formatEdge(band.hi, kind, locale));
}

/**
 * ÖLÇÜ BASAMAKLARI — /tarama'da süzgeçten geçen hisselerin seçili ölçüdeki
 * dağılımı (10 Kasım 2026).
 *
 * ÖNCE: arı kümesi (`MetricSwarm`, 25 Ekim) — her hisse bir nokta, yatayda
 * değer, logaritmik eksen, ortanca çizgisi, uçta boş halkalar, üzerine
 * gelince balon. Sahibinin itirazı (10 Kasım, Temalar panosundaki çentikler
 * için; "başka buna uyarlanacak ekran varsa onları da yapalım" diye
 * genişletti): "böyle nokta nokta ne anlatıyor anlamıyorum; çizgi grafiği
 * yerine yatayda uzun KALIN çizgi seviyorum." 514 noktalık bulutta okurun
 * çözmesi gerekenler: eksenin logaritmik olduğu, noktanın dikey yerinin
 * anlamsız olduğu (yalnız çarpışmadan kaçış), boş halkanın "ölçek dışı"
 * demek olduğu.
 *
 * ŞİMDİ: en büyük punto ORTANCANIN kendisi (bloğun söylediği tek sayı);
 * altında değer aralıkları birer satır: aralık, o aralıktaki hisse sayısı
 * kadar uzayan 8 piksellik dolu çubuk (kulvar 5), sayı ve pay. "Yığılma
 * nerede" en uzun çubuk; "uçta kim var" satırın sonunda adıyla yazılı
 * (aralığın en yüksek değerli üç hissesi, bağlantılı). Sınırlar yuvarlak
 * (`metricBands`, lib/tool-visuals.ts — testli); log/doğrusal ayrımı
 * yalnız sınır SEÇİMİNDE, okurun önünde eksen yok.
 *
 * Ton `--bar-soft` (büyüklük/sayım, 25 Ekim renk kararı): hisse sayısı bir
 * yargı değil. Sunucu bileşeni: küme istemcideydi (ölçüm, imleç, klavye);
 * satırların hepsi metin ve bağlantı, JS gerekmiyor.
 */
export function MetricBands({
  points,
  scale,
  kind,
  universeMedian,
  missing,
  locale,
  labels,
}: {
  points: BandPoint[];
  scale: SwarmScale;
  kind: MetricKind;
  /** Süzgeç evrenin bir kısmını kestiyse evrenin ortancası; değilse null. */
  universeMedian: number | null;
  /** Bu ölçüsü olmayan hisse sayısı — künyede söylenir. */
  missing: number;
  locale: string;
  labels: Labels;
}) {
  const bands = metricBands(points.map((point) => point.v), scale);
  const counted = bands.reduce((sum, band) => sum + band.count, 0);
  const middle = median(points.map((point) => point.v));
  if (counted === 0 || middle === null) return null;
  const peak = Math.max(...bands.map((band) => band.count));

  return (
    <div className={styles.wrap}>
      <p className={styles.head}>
        <span className={styles.headLabel}>{labels.medianLabel}</span>
        <b className={`numeral ${styles.headValue}`}>{formatValue(middle, kind, locale)}</b>
        {universeMedian !== null && (
          <span className={styles.headAside}>
            {labels.universe.replace("{v}", formatValue(universeMedian, kind, locale))}
          </span>
        )}
      </p>
      {/* Büyükten küçüğe: tablo da varsayılan sıralamada büyükten başlıyor. */}
      <ol className={styles.rows} data-draw>
        {[...bands].reverse().map((band, index) => {
          const named = [...band.members]
            .sort((a, b) => points[b].v - points[a].v || points[a].s.localeCompare(points[b].s))
            .slice(0, NAMED);
          const share = Math.round((band.count / counted) * 100);
          return (
            <li key={`${band.lo}-${band.hi}`} className={styles.row} style={{ ["--i" as string]: index }}>
              <span className={`numeral ${styles.range}`}>{bandLabel(band, kind, locale, labels)}</span>
              <span aria-hidden className={styles.lane}>
                {band.count > 0 && (
                  <i className="bar-fill" style={{ width: `${Math.max((band.count / peak) * 100, 1.5).toFixed(2)}%` }} />
                )}
              </span>
              <span className={`numeral ${styles.count}`}>
                <b>{band.count}</b>
                <span className="sr-only"> {labels.count}</span>
              </span>
              <span className={`numeral ${styles.share}`}>{formatPercentPlain(share, locale, 0)}</span>
              <span className={styles.names}>
                {named.map((at) => (
                  <Link key={points[at].s} href={`/hisse/${points[at].s}`} prefetch={false} title={points[at].n}>
                    {points[at].s}
                  </Link>
                ))}
                {band.count > named.length && (
                  <span className="numeral">{labels.more.replace("{n}", String(band.count - named.length))}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className={styles.note}>
        {labels.hint}
        <span className={styles.namesHint}> {labels.namesHint}</span>
        {missing > 0 && ` ${labels.missing.replace("{n}", String(missing))}`}
      </p>
    </div>
  );
}
