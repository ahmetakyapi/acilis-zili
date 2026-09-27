import { DataStamp, Panel } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { getNextFomc } from "@/lib/macro-data";
import { readerDayOffset, timePair, zoneTag } from "@/lib/session-clock";
import {
  formatEtDateLong,
  formatEtDateMedium,
  formatPercentPlain,
  relativeDayLabel,
} from "@/lib/utils";
import styles from "./MacroExperience.module.css";

/**
 * Sonraki FOMC — tarih, saat ve bugünkü hedef aralık.
 *
 * PİYASA FİYATLAMASI YOK ve olmaması bilinçli: "Ekim'de indirim olasılığı
 * %72" gibi bir satır vadeli faiz kontratlarından hesaplanıyor ve elimizde
 * o kontratların fiyatını veren bir kaynak yok. Başka bir sitenin
 * sayısını kopyalamak ya da kendi tahminimizi yazmak, ekranda nereden
 * geldiğini söyleyemediğimiz bir sayı olurdu. Kart bu yüzden yalnızca
 * bildiğini yazıyor: takvimdeki tarih (federalreserve.gov, elle tohumlanan
 * takvim) ve FRED'in yayımladığı hedef aralık.
 *
 * Hedef aralık TOPLANTIDAN SONRA değişir; gözlem tarihi künyede.
 */
export async function FomcCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const x = t.marketExtras;
  const next = await getNextFomc();
  if (!next) return null;
  const times = next.timeEt ? timePair(next.date, next.timeEt, locale) : null;
  const tags = zoneTag(locale);
  const away = readerDayOffset(next.date, next.timeEt, locale);

  return (
    <Panel className={`${styles.card} flex flex-col p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold leading-snug text-strong">{x.fomcTitle}</h2>
        {away >= 0 && (
          <span className="numeral shrink-0 text-nano font-semibold text-primary-ink">
            {relativeDayLabel(away, t.calendar)}
          </span>
        )}
      </div>

      <p className="mt-3 text-read font-bold leading-tight text-strong">
        {formatEtDateLong(next.date, locale)}
      </p>
      {times && (
        <p className="numeral mt-1 text-small text-body">
          {times.primary} <span className="text-muted">· {times.secondary} {tags.secondary}</span>
        </p>
      )}
      {next.withProjections && (
        <p className="mt-2 w-fit rounded-full bg-surface-elevated px-2 py-0.5 text-nano font-semibold text-body">
          {x.fomcProjections}
        </p>
      )}

      <dl className="mt-4 flex-1 divide-y divide-line-soft border-t border-line-soft text-xs">
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-muted">{x.fomcTarget}</dt>
          <dd className="numeral text-right font-semibold text-strong">
            {next.target
              ? `${formatPercentPlain(next.target.lower, locale, 2)} – ${formatPercentPlain(next.target.upper, locale, 2)}`
              : t.common.noData}
          </dd>
        </div>
        {next.target && (
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-muted">{x.observed}</dt>
            <dd className="numeral text-right text-body">{formatEtDateMedium(next.target.date, locale)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 border-t border-line-soft pt-3 text-tiny leading-relaxed text-muted">{x.fomcNoPricing}</p>
      {next.target && (
        <DataStamp labels={t.data} source="fred" at={next.target.fetchedAt} locale={locale} className="mt-2" />
      )}
    </Panel>
  );
}
