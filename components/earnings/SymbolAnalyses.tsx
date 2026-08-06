import Link from "next/link";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictPillClass,
  verdictTextClass,
} from "@/lib/analysis";
import { getAnalyses } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, formatEtDateLong } from "@/lib/utils";

/**
 * Bir şirketin yayımlanmış bilanço analizleri — hisse sayfasında.
 *
 * Geçmiş Bilançolar tablosunun HEMEN ÜSTÜNDE duruyor: tablo çeyreklerin
 * rakamları, bu panel o rakamların okunmuş hâli. Aralarına başka bir kart
 * girerse ikisi arasındaki bağ kopuyor.
 *
 * Analizi olmayan şirkette hiçbir şey basmaz — boş bir "henüz analiz yok"
 * kartı, beş yüzden fazla hisse sayfasının her birinde tekrar eden ve
 * hiçbir şey söylemeyen bir gürültü olurdu.
 */
export async function SymbolAnalyses({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const rows = await getAnalyses(locale, { symbols: [symbol], limit: 6 });
  if (rows.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title={t.analysis.symbolPanelTitle}
        action={
          <PanelLink href="/bilancolar/analizler">
            {t.analysis.symbolPanelAll}
          </PanelLink>
        }
      />
      <ul>
        {rows.map((row) => {
          const verdict = verdictOf(row.verdict);
          return (
            <li key={`${row.symbol}-${row.period}`}>
              <Link
                href={analysisHref(row.symbol, row.period)}
                prefetch={false}
                className="flex flex-col gap-2 border-t border-line px-4 py-3.5 transition-colors hover:bg-primary-tint sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              >
                <span className="flex shrink-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "figure rounded-full px-2.5 py-[3px] text-[11.5px] font-bold",
                      verdictPillClass(verdict),
                    )}
                  >
                    {row.score}
                  </span>
                  <span
                    className={cn(
                      "w-9 text-[12.5px] font-bold",
                      verdictTextClass(verdict),
                    )}
                  >
                    {verdictLabel(verdict, t)}
                  </span>
                  <span className="text-[13.5px] font-bold text-strong">
                    {row.periodLabel}
                  </span>
                </span>
                {/* Manşet cümlesi tek satır: panel bir okuma listesi değil,
                    hangi çeyreğin okunduğunu gösteren bir dizin. */}
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-body">
                  {row.headline}
                </span>
                <span className="shrink-0 text-[11.5px] text-muted sm:text-right">
                  {formatEtDateLong(row.reportDate, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
