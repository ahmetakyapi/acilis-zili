import Link from "next/link";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
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
                className="flex items-start gap-3.5 border-t border-line px-4 py-4 transition-colors hover:bg-primary-tint sm:gap-4 sm:px-5"
              >
                {/* PUAN HALKASI, DÜZ HAP DEĞİL. Satırın tamamı tek bir metin
                    şerididir: 12 puntoluk bir hap, üç kelime ve kırpılmış bir
                    cümle — panelin taşıdığı asıl bilgi (bu çeyrek kaç puan
                    aldı) hiçbir görsel ağırlık taşımıyordu. Halka bu sitede
                    zaten var ve analiz sayfasının kendi dili
                    (`components/earnings/ScoreRing.tsx`); panel de artık onu
                    konuşuyor. Renk tek başına bırakılmıyor — yanında AL/TUT/
                    SAT yazısı duruyor. */}
                {/* KARAR SÖZÜ PUANIN ALTINDA. Başlık satırında duruyordu ve
                    orada dönem etiketiyle yarışıyordu; oysa "93" ile "AL"
                    aynı hükmün iki yazımı — biri sayı, öteki kelime. Yan
                    yana değil alt alta durunca tek bir işaret oluyorlar ve
                    başlık satırı yalnızca döneme kalıyor. Renk yine tek
                    başına konuşmuyor: kelime halkanın altında yazılı. */}
                <span className="flex shrink-0 flex-col items-center gap-1">
                  <ScoreRing score={row.score} verdict={verdict} size={44} />
                  <span
                    className={cn(
                      /* `uppercase` YOK: sözlükteki değerler zaten
                         büyük harfli ("AL"/"TUT"/"SAT") ve CSS ile
                         ikinci kez büyütmek Türkçede i→I tuzağını
                         davet ederdi. */
                      "text-nano font-bold tracking-[0.06em]",
                      verdictTextClass(verdict),
                    )}
                  >
                    {verdictLabel(verdict, t)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-read font-bold text-strong">
                      {row.periodLabel}
                    </span>
                    <span className="numeral ml-auto shrink-0 text-tiny text-muted">
                      {formatEtDateLong(row.reportDate, locale)}
                    </span>
                  </span>
                  {/* Manşet iki satıra kadar açılıyor. Tek satıra kırpılmıştı
                      ve cümlenin yarısı "…" ile bitiyordu: dizin olsun diye
                      okunmaz hâle gelmişti. İki satır, hem cümleyi
                      tamamlıyor hem de satıra gövde kazandırıyor. */}
                  <span className="line-clamp-2 text-small leading-[17px] text-body">
                    {row.headline}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
