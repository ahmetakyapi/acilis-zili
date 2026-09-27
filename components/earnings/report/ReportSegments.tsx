import { ChartPieSlice } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/PremiumMotion";
import { Panel } from "@/components/ui/primitives";
import type { AnalysisExtras } from "@/lib/earnings-extras";
import {
  kpiValueText,
  segmentShares,
  segmentTotalDiffers,
  yoyText,
} from "@/lib/earnings-report";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  cn,
  formatMoneyCompact,
  formatPercentPlain,
  tieFigures,
  titleCaseLabel,
} from "@/lib/utils";
import { PanelHead } from "./PanelHead";
import styles from "./ReportExtras.module.css";

/**
 * Segment ve KPI Verisi — çeyreğin şirkete özgü rakamları.
 *
 * Panel ekran düzeninin kendi içindeki sırasını izliyor: önce görsel
 * (segment payları), sonra ölçü ızgarası (KPI'lar), en altta hairline ile
 * ayrılmış künyeler. İkisinden biri yoksa panel yalnızca olanı taşır ve
 * başlığı da ona göre değişir; ikisi de yoksa panel hiç basılmaz.
 *
 * SAYILAR HAM GELİR, SUNUM BURADA. Kayıt dilden bağımsız ham dolar
 * tutuyor; "$4,2 Mr" ile "$4.2B" arasındaki fark biçimlendiricinin işi
 * (`kpiValueText`, `formatMoneyCompact`). Her KPI kaynağını kendi kartında
 * yazıyor — sözlükten, kayıttaki serbest metinden değil.
 */
export function ReportSegments({
  extras,
  revenue,
  lang,
  locale,
  t,
}: {
  extras: AnalysisExtras;
  /** Analizin konsolide geliri — segment toplamıyla karşılaştırmak için. */
  revenue: number | null;
  lang: string;
  locale: Locale;
  t: Dictionary;
}) {
  const segments = extras.segments ?? [];
  const kpis = extras.kpis ?? [];
  if (segments.length === 0 && kpis.length === 0) return null;

  const x = t.earningsExtra;
  const title =
    segments.length > 0 && kpis.length > 0
      ? x.dataTitle
      : segments.length > 0
        ? x.segmentsTitle
        : x.kpisTitle;
  const { rows, total } = segmentShares(segments);
  const differs = segmentTotalDiffers(total, revenue);

  return (
    <Reveal>
      <Panel className={styles.panel} aria-labelledby="report-segments">
        <PanelHead icon={ChartPieSlice} title={title} id="report-segments" />

        {rows.length > 0 && (
          <div className={styles.block}>
            {/* İki blok varsa her birinin kendi etiketi var; tek blokta
                panel başlığı zaten aynı şeyi söylüyor. */}
            {kpis.length > 0 && (
              <h3 className={cn("plate text-body", styles.blockTitle)}>{x.segmentsHeading}</h3>
            )}
            <ul className={styles.segments} lang={lang}>
              {rows.map((segment) => (
                <li key={segment.name} className={styles.segment}>
                  <div className={styles.segmentHead}>
                    <span className={styles.segmentName}>
                      {titleCaseLabel(segment.name, lang)}
                    </span>
                    <span className={styles.segmentFigures} lang={locale}>
                      <span className={cn("figure", styles.segmentMoney)}>
                        {formatMoneyCompact(segment.revenue, locale)}
                      </span>
                      <span className="figure">
                        {x.share} {formatPercentPlain(segment.share * 100, locale, 1)}
                      </span>
                      {segment.yoyPct !== null && segment.yoyPct !== undefined && (
                        <span
                          className={cn(
                            "figure font-semibold",
                            segment.yoyPct >= 0 ? "text-up" : "text-down",
                          )}
                        >
                          {yoyText(segment.yoyPct, locale)} {x.yearly}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Çubuk sayının kopyası: pay yanında metin olarak yazılı. */}
                  <div className={styles.segmentTrack} aria-hidden>
                    <span
                      className={styles.segmentFill}
                      style={{ width: `${segment.share * 100}%` }}
                    />
                  </div>
                  {segment.note && <p className={styles.segmentNote}>{segment.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {kpis.length > 0 && (
          <div className={styles.block}>
            {rows.length > 0 && (
              <h3 className={cn("plate text-body", styles.blockTitle)}>{x.kpisHeading}</h3>
            )}
            <ul className={styles.kpis}>
              {kpis.map((kpi) => (
                <li key={kpi.name} className={styles.kpi}>
                  <p className={styles.kpiLabel} lang={lang}>
                    {tieFigures(titleCaseLabel(kpi.name, lang))}
                  </p>
                  <p className={cn("figure", styles.kpiValue)}>{kpiValueText(kpi, locale)}</p>
                  <p className={styles.kpiMeta}>
                    {kpi.yoyPct !== null && kpi.yoyPct !== undefined && (
                      <span className={cn("figure", kpi.yoyPct >= 0 ? "text-up" : "text-down")}>
                        {yoyText(kpi.yoyPct, locale)} {x.yearly}
                      </span>
                    )}
                    <span className={styles.kpiSource}>
                      {x.sources[kpi.source as keyof typeof x.sources]}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.notes}>
          {rows.length > 0 && (
            <p>
              {x.segmentBasis.replace("{total}", formatMoneyCompact(total, locale))}
              {differs && revenue !== null && (
                <> {x.segmentGap.replace("{revenue}", formatMoneyCompact(revenue, locale))}</>
              )}
              {extras.segmentsSource && (
                <>
                  {" "}
                  {x.sourceLabel}: {x.sources[extras.segmentsSource]}.
                </>
              )}
            </p>
          )}
          {kpis.length > 0 && <p>{x.kpiNote}</p>}
        </div>
      </Panel>
    </Reveal>
  );
}
