import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ButtonLink } from "@/components/ui/primitives";
import type { DailyChartLabels } from "@/lib/i18n/dictionaries/daily-chart";
import { formatPercent } from "@/lib/utils";
import type { ThumbRow } from "./ChartThumb";
import styles from "./ChartColumns.module.css";

/**
 * GRAFİĞİN KÜÇÜK RESMİ — ana sayfanın Dünün Grafiği paneli (28 Kasım,
 * Görsel Tur 4; TASARIM-RAPOR #4).
 *
 * NEDEN. Sağ kolonda Günün Hareketleri, Dünya Piyasaları ve bu panel üst
 * üste aynı satırı çiziyordu: logo + ad + sağda yüzde + altında kalın
 * yatay çubuk (`arayuz.md` → "Aynı 'satır + çubuk + yüzde' kalıbı bir
 * bölümde yinelenmez"). Panel bir LİSTE değil bir GRAFİĞİN girişi; artık
 * grafiğin kendisi gibi duruyor: dikey sütunlar, ortak sıfır çizgisi,
 * sütunun ucunda değeri, altında logosu ve sembolü — Son Seansın
 * Silueti'nin sütun-ve-logo dili, aynı sayfada tanıdık.
 *
 * KORUNANLAR (sahibinin 31 Ekim ve 6–10 Kasım itirazları, ChartThumb.tsx):
 * logolar (31 Ekim: "logolar olsun"), değer birimiyle, ortada "1 Kalem
 * Daha" bağlantısı yok; dipte sakin sayaç ve "Grafiği İncele". Tek kalan
 * kalem (grafiğin öznesi) artık kırmızı/yeşil DOLU SATIR ZEMİNİYLE değil
 * (satır vurgu zemini yasak), sütun altındaki tek satırlık künyeyle
 * söyleniyor: "Tek Düşen · Nvidia".
 *
 * ÖLÇEK. Grubun TAMAMINDAN (gösterilmeyen kalemler dahil): sütun boyu
 * |değer| / (en büyük artı + en büyük eksi). Sıfır çizgisi çizimin
 * içinde, artının payı kadar aşağıda; tek yönlü grafikte dipte (hepsi
 * artı) ya da tepede (hepsi eksi). Renk yalnız işaretten.
 *
 * Değer etiketi yüzde blokta TEK ONDALIK, yuvarlanmış (`formatPercent`):
 * 360'lık telefonda sütun ~45 piksel, "+%16,79" 48 piksel tutup komşu
 * etikete biniyordu; "+%16,8" 40. Tam değer
 * sütunun `aria-label`ında ve grafiğin sayfasında.
 *
 * HAREKET: sütun sıfırdan yükselir (`scaleY`, modüle özgü `col-rise`;
 * katalogdaki `bar-fill` yatay — dikey çizimin karşılığı yok), kademe
 * `--step`, 6 sütunda toplam 200 ms; `data-draw` kapısıyla ekrana girince
 * bir kez, hareketi azaltana son kare.
 */
export function ChartColumns({
  columns,
  all,
  total,
  labels,
  href,
  label,
  locale,
  renderMark,
}: {
  /** Çizilecek sütunlar, soldan sağa. */
  columns: readonly ThumbRow[];
  /** Ölçek için bütün kalemler. */
  all: readonly ThumbRow[];
  total: number;
  labels: DailyChartLabels;
  href: string;
  label: string;
  /** Kaydın dili (sayıların yazılışı). */
  locale: string;
  renderMark: (item: ThumbRow) => ReactNode;
}) {
  const values = all.map((item) => item.value ?? 0);
  const maxUp = Math.max(0, ...values);
  const maxDown = Math.max(0, ...values.map((value) => -value));
  const span = maxUp + maxDown || 1;
  /* Sıfırın çizimdeki yeri (tepeden pay): artının payı kadar aşağıda. */
  const zero = maxUp / span;
  const subject = columns.find((item) => item.subject);
  const [countLead, countTail] = labels.home.count.replace("{total}", String(total)).split("{shown}");

  return (
    <div className={styles.wrap}>
      <ol
        className={styles.cols}
        data-draw
        aria-label={label}
        data-has-up={maxUp > 0 || undefined}
        data-has-down={maxDown > 0 || undefined}
        style={{ "--z": zero.toFixed(4), "--n": columns.length } as CSSProperties}
      >
        {columns.map((item, index) => {
          const value = item.value ?? 0;
          const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
          const code = item.symbol ?? item.fund;
          const body = (
            <>
              <span className={styles.plot} aria-hidden>
                {value !== 0 && (
                  <span
                    className={styles.bar}
                    data-dir={dir}
                    style={{ "--f": (Math.abs(value) / span).toFixed(4), "--i": index } as CSSProperties}
                  />
                )}
                <span className={`numeral ${styles.value}`} data-dir={dir} style={{ "--f": (Math.abs(value) / span).toFixed(4) } as CSSProperties}>
                  {shortDisplay(item, locale)}
                </span>
              </span>
              <span className={styles.mark} aria-hidden>{renderMark(item)}</span>
              {code && <span className={styles.code} aria-hidden>{code}</span>}
            </>
          );
          return (
            <li key={`${index}-${item.name}`}>
              {code ? (
                <Link href={`/hisse/${code}`} prefetch={false} className={styles.col} aria-label={`${item.name}, ${item.display}`}>
                  {body}
                </Link>
              ) : (
                <div className={styles.col} aria-label={`${item.name}, ${item.display}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      {subject && (
        <p className={styles.subject}>
          <span data-dir={subject.subject}>{subject.subject === "down" ? labels.home.onlyDown : labels.home.onlyUp}</span>
          {subject.name}
        </p>
      )}
      <div className={styles.end}>
        {columns.length < total && (
          <span className={`numeral ${styles.count}`}>
            {countLead}
            <i>{columns.length}</i>
            {countTail}
          </span>
        )}
        <ButtonLink href={href} prefetch={false} variant="ghost" size="sm" className={styles.open}>
          {labels.home.open}
          <ArrowRight size={12} weight="bold" aria-hidden />
        </ButtonLink>
      </div>
    </div>
  );
}

/** Yüzde yazılışında tek ondalık, yuvarlayarak ("+%16,79" → "+%16,8");
    başka birim bloğun yazdığı gibi. */
function shortDisplay(item: ThumbRow, locale: string): string {
  if (!item.display.includes("%") || item.value === undefined) return item.display;
  return formatPercent(item.value, locale, 1);
}
