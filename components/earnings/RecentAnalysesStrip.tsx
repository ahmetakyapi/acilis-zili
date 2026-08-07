import Image from "next/image";
import Link from "next/link";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictPillClass,
} from "@/lib/analysis";
import { getAnalyses, getSymbolNames } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Takvim sekmesinin altındaki "son yazılan analizler" şeridi.
 *
 * NEDEN VAR: takvim BUGÜNDEN İLERİYE bakıyor, analizler ise açıklanmış —
 * yani geçmiş — bilançolara ait. Satırlara düşen "AL · 77 · Karne" rozeti
 * bu yüzden yalnızca aynı gün açıklayan şirketlerde ateşleniyor; dünkü ya da
 * geçen haftaki analizler takvimde hiç görünmüyordu. Okuyucunun onları
 * bulmak için Analizler sekmesine geçmesi gerekiyordu.
 *
 * Şerit tek satır: takvimle yarışmıyor, yalnızca "burada okunacak bir şey
 * var" diyor. Analiz yoksa hiçbir şey basmaz — boş bir kart, henüz analiz
 * yazılmamış bir sitede her gün tekrar eden bir vaat olurdu.
 */
export async function RecentAnalysesStrip({
  locale,
  t,
  limit = 8,
}: {
  locale: Locale;
  t: Dictionary;
  limit?: number;
}) {
  const rows = await getAnalyses(locale, { limit });
  if (rows.length === 0) return null;

  const meta = await getSymbolNames([...new Set(rows.map((r) => r.symbol))]);

  return (
    <section
      aria-label={t.analysis.recentStrip}
      className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="plate whitespace-nowrap tracking-[0.09em]">
          {t.analysis.recentStrip}
        </p>
        {/* Mobilde "Tümü" etiketle aynı satırda: altına inince şerit üç
            satıra çıkıyor ve takvimin önüne geçiyordu. */}
        <Link
          href="/bilancolar/analizler"
          className="whitespace-nowrap text-[11.5px] font-semibold text-primary hover:text-primary-hover sm:hidden"
        >
          {t.common.showAll} →
        </Link>
      </div>

      {/* Dar ekranda çipler kırılmak yerine kayar — sekiz analiz alt alta
          dizilince şerit bir listeye dönüşüyordu. */}
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:min-w-0 sm:flex-1 sm:px-0">
        {rows.map((row) => {
          const verdict = verdictOf(row.verdict);
          const logoUrl = meta[row.symbol]?.logoUrl;
          return (
            <li key={`${row.symbol}-${row.period}`} className="shrink-0">
              <Link
                href={analysisHref(row.symbol, row.period)}
                prefetch={false}
                title={row.headline}
                className="flex items-center gap-2 rounded-full border border-line bg-surface-solid py-1 pl-1 pr-2.5 transition-colors hover:border-line-strong"
              >
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt=""
                    width={22}
                    height={22}
                    className="size-[22px] shrink-0 rounded-full bg-white object-contain"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary-wash text-[9px] font-bold text-primary"
                  >
                    {row.symbol.slice(0, 2)}
                  </span>
                )}
                <span className="text-[12.5px] font-bold text-strong">
                  {row.symbol}
                </span>
                <span
                  className={cn(
                    "figure whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-bold",
                    verdictPillClass(verdict),
                  )}
                >
                  {verdictLabel(verdict, t)} · {row.score}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/bilancolar/analizler"
        className="hidden shrink-0 whitespace-nowrap text-[11.5px] font-semibold text-primary hover:text-primary-hover sm:inline"
      >
        {t.common.showAll} →
      </Link>
    </section>
  );
}
