import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { verdictLabel, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import styles from "./Technical.module.css";

const ORDER = ["buy", "hold", "sell"] as const satisfies readonly VerdictKey[];
const TONE = { buy: "up", hold: "flat", sell: "down" } as const satisfies Record<VerdictKey, string>;
export const STANCE_GUIDE_SLUG = "teknik-gorusler";

/**
 * Görüşün ne dediği — okuyucunun iki durumu ve kademe sorusu.
 *
 * Kart görüşü tek kelimeyle söylüyor ve tek kelime bir emir gibi
 * okunuyordu: AL "şimdi hepsini al", SAT "şimdi hepsini sat". Rutinin
 * tanımı ikisi de değil; AL bir BÖLGE ve vazgeçme noktası olan plan, SAT
 * yeni alımın olmaması ve tepkide azaltma. Bu bileşen o tanımı üç soruya
 * çeviriyor: pozisyonun yoksa, varsa, alım/çıkış kademeli mi.
 *
 * İki yerleşim, aynı metin:
 *   · `detail` — hissenin kendi görüşü açık, öteki ikisi bir satır.
 *     Okuyucu bir planın içinde; ona üç görüşün ansiklopedisi değil,
 *     önündeki görüşün anlamı lazım.
 *   · `board` — üç görüş yan yana, kademe hücresi yok (üç sütunda dört
 *     paragraf listeyi boğuyordu); ayrıntısı rehberde.
 *
 * Sunucu bileşeni, JS yok.
 */
export function StanceGuide({
  variant,
  verdict = "hold",
  t,
  id,
}: {
  variant: "detail" | "board";
  verdict?: VerdictKey;
  t: Dictionary;
  id?: string;
}) {
  const g = t.technical.stanceGuide;
  const guideLink = (
    <Link href={`/rehber/${STANCE_GUIDE_SLUG}`} className={cn("tap-44", styles.stanceGuideLink)}>
      {g.guideLink}
      <ArrowUpRight size={14} weight="bold" aria-hidden />
    </Link>
  );

  if (variant === "board") {
    return (
      <section id={id} className={cn(styles.block, styles.stanceGuide)} aria-labelledby={`${id}-title`}>
        <div className={styles.blockHead}>
          <h2 id={`${id}-title`} className={styles.sectionTitle}>{g.boardTitle}</h2>
          {guideLink}
        </div>
        <p className={styles.stanceLead}>{g.boardLead}</p>
        <div className={styles.stanceColumns} data-motion-stagger>
          {ORDER.map((key) => (
            <article key={key} className={styles.stanceColumn} data-tone={TONE[key]}>
              <span className={cn(styles.stancePill, verdictPillClass(key))}>{verdictLabel(key, t)}</span>
              <p className={styles.stanceMeaning}>{g[key].meaning}</p>
              {/* TELEFONDA KATLI (29 Eylül). Üç sütun alt alta 390'da 1.893
                  piksel tutuyordu (sayfanın ~%15'i). Etiket ve anlam her
                  ekranda açık; "yoksa / varsa" ayrıntısı telefonda dokununca
                  açılıyor. Geniş ekranda `::details-content` ile hep açık ve
                  özet satırı gizli: orada hiçbir şey değişmedi. */}
              <details className={styles.stanceMore}>
                <summary>{g.whatToDo}</summary>
                <dl className={styles.stanceCases}>
                  <div>
                    <dt>{g.noPosition}</dt>
                    <dd>{g[key].noPosition}</dd>
                  </div>
                  <div>
                    <dt>{g.hasPosition}</dt>
                    <dd>{g[key].hasPosition}</dd>
                  </div>
                </dl>
              </details>
            </article>
          ))}
        </div>
        <p className={styles.stanceSticky}>
          <b>{g.stickyTitle}.</b> {g.sticky}
        </p>
      </section>
    );
  }

  const copy = g[verdict];
  const label = verdictLabel(verdict, t);
  return (
    <section id={id} className={cn(styles.block, styles.stanceGuide)} data-tone={TONE[verdict]} aria-labelledby={`${id}-title`}>
      <div className={styles.blockHead}>
        <h2 id={`${id}-title`} className={styles.sectionTitle}>{g.detailTitle.replace("{stance}", label)}</h2>
        {guideLink}
      </div>
      <p className={styles.stanceLead}>{copy.meaning}</p>
      <dl className={styles.stanceGrid}>
        <div>
          <dt>{g.noPosition}</dt>
          <dd>{copy.noPosition}</dd>
        </div>
        <div>
          <dt>{g.hasPosition}</dt>
          <dd>{copy.hasPosition}</dd>
        </div>
        <div>
          <dt>{g.scaling}</dt>
          <dd>{copy.scaling}</dd>
        </div>
      </dl>
      <div className={styles.stanceFoot}>
        <div className={styles.stanceOthers}>
          <span className={styles.readingLabel}>{g.othersLabel}</span>
          <ul>
            {ORDER.filter((key) => key !== verdict).map((key) => (
              <li key={key}>
                <span className={cn(styles.stancePill, verdictPillClass(key))}>{verdictLabel(key, t)}</span>
                <span>{g[key].short}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className={styles.stanceSticky}>
          <b>{g.stickyTitle}.</b> {g.sticky}
        </p>
      </div>
    </section>
  );
}
