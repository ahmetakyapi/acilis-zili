import type { CSSProperties, ReactNode } from "react";
import { CalendarDots, Scales, SealCheck, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/PremiumMotion";
import { RichText } from "@/components/earnings/RichText";
import type { AutoLinker } from "@/lib/autolink";
import { splitPoint } from "@/lib/analysis-visuals";
import { splitLeadingDate } from "@/lib/earnings-report";
import { cn } from "@/lib/utils";
import styles from "./ReportVisuals.module.css";

/**
 * GÜÇLÜ YÖNLER / RİSKLER — KARŞILAŞTIRMALI TEK KART (25 Ekim görsel zirve).
 *
 * Üç eşit kart yan yanaydı ve başlıkları yön renginde yazılıydı: "Güçlü
 * Yönler" yeşil, "Riskler" kırmızı. Oysa güçlü yön bir fiyat yönü değil;
 * sitenin rengi yalnız yukarı/aşağıyı söylüyor (CLAUDE.md "Renk anlam
 * taşır"). Ayrım artık TONLA ve İKONLA: güçlü yönler açık kartta mühürlü
 * onay, riskler çukur zeminde uyarı karosu. İki sütun yan yana, aynı
 * satırdan başlıyor; okuyucu iki listeyi karşılıklı tartıyor.
 *
 * Madde "baş; açıklama" kalıbındaysa baş kalın kısa başlık olur
 * (`splitPoint`); kalıp yoksa başlık UYDURULMAZ, madde tek parça kalır.
 */
export function OutlookBalance({
  title,
  strengths,
  risks,
  labels,
  linker,
  lang,
}: {
  title: string;
  strengths: string[];
  risks: string[];
  labels: { strengths: string; risks: string; count: string };
  linker: AutoLinker;
  lang: string;
}) {
  if (strengths.length === 0 && risks.length === 0) return null;
  const columns = [
    { key: "strength", title: labels.strengths, points: strengths, Icon: SealCheck },
    { key: "risk", title: labels.risks, points: risks, Icon: WarningDiamond },
  ].filter((column) => column.points.length > 0);
  return (
    <Reveal>
      <section className={styles.balance} aria-labelledby="report-balance">
        <header className={styles.cardHead}>
          <span aria-hidden className={styles.cardIcon}>
            <Scales weight="duotone" size={16} />
          </span>
          <h2 id="report-balance" className="text-read">
            {title}
          </h2>
          <span className={styles.cardMeta}>
            {labels.count
              .replace("{strengths}", String(strengths.length))
              .replace("{risks}", String(risks.length))}
          </span>
        </header>
        <div className={styles.balanceGrid} data-columns={columns.length} lang={lang}>
          {columns.map(({ key, title: columnTitle, points, Icon }) => (
            <div key={key} className={styles.balanceColumn} data-kind={key}>
              <div className={styles.balanceTitle}>
                <span aria-hidden className={styles.balanceGlyph}>
                  <Icon weight="duotone" size={18} />
                </span>
                <h3 className="text-base">{columnTitle}</h3>
                <span className={cn(styles.balanceCount, "numeral")}>{points.length}</span>
              </div>
              <ol className={styles.balanceList} data-motion-stagger>
                {points.map((point, index) => {
                  const { lead, rest } = splitPoint(point);
                  return (
                    <li key={index} style={{ "--i": index } as CSSProperties}>
                      <span aria-hidden className={styles.balanceBullet}>
                        <Icon weight="fill" size={11} />
                      </span>
                      <span className={styles.balanceText}>
                        {lead && (
                          <b>
                            <RichText text={lead} linker={linker} />
                          </b>
                        )}
                        <span>
                          <RichText text={rest} linker={linker} />
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

/** İlk harf dile göre büyür (i → İ); `capitalize` kullanılmaz. */
function sentenceStart(text: string, lang: string): string {
  return text.charAt(0).toLocaleUpperCase(lang === "tr" ? "tr-TR" : "en-US") + text.slice(1);
}

/**
 * BEKLENEN GELİŞMELER — YATAY ZAMAN ÇİZGİSİ.
 *
 * Maddeler tarihle başlıyor ("Ekim sonu — …", "Aralık 2026: …"); tarih
 * ayrılıp çizginin üstündeki durağa yazılıyor (`splitLeadingDate`).
 * Tarihsiz madde durağı boş bırakır, tarih uydurulmaz. Geniş ekranda
 * duraklar soldan sağa aynı hatta, telefonda dikey çizgi.
 */
export function UpcomingTrack({
  title,
  points,
  linker,
  lang,
  footer,
}: {
  title: string;
  points: string[];
  linker: AutoLinker;
  lang: string;
  footer?: ReactNode;
}) {
  if (points.length === 0 && !footer) return null;
  return (
    <Reveal>
      <section className={styles.upcoming} aria-labelledby="report-upcoming">
        <header className={styles.cardHead}>
          <span aria-hidden className={styles.cardIcon}>
            <CalendarDots weight="duotone" size={16} />
          </span>
          <h2 id="report-upcoming" className="text-read">
            {title}
          </h2>
          <span className={cn(styles.cardMeta, "numeral")}>{points.length}</span>
        </header>
        {points.length > 0 && (
          <ol
            className={styles.track}
            lang={lang}
            data-motion-stagger
            style={{ "--stops": Math.min(points.length, 4) } as CSSProperties}
          >
            {points.map((point, index) => {
              const dated = splitLeadingDate(point);
              return (
                <li key={index} className={styles.trackStop}>
                  <span aria-hidden className={styles.trackDot} />
                  {dated && <span className={styles.trackDate}>{dated.date}</span>}
                  <span className={styles.trackText}>
                    {/* Tarih ayrılınca kalan cümle küçük harfle başlayabiliyor
                        ("Ekim sonu — …" kalıbında İngilizce metin "payment of…" diye kalıyordu); ilk harf
                        dile göre büyür, gerisine dokunulmaz. */}
                    <RichText text={dated ? sentenceStart(dated.text, lang) : point} linker={linker} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {footer && <div className={styles.upcomingFooter}>{footer}</div>}
      </section>
    </Reveal>
  );
}
