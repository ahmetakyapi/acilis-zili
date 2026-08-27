import Link from "next/link";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictPillClass,
} from "@/lib/analysis";
import { getAnalyses, getSymbolNames } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Takvim sekmesinin altındaki "son yazılan analizler" şeridi.
 *
 * NEDEN VAR: takvim BUGÜNDEN İLERİYE bakıyor, analizler ise açıklanmış —
 * yani geçmiş — bilançolara ait. Satırlara düşen "AL · 77 · Analiz" rozeti
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
      /* SAYFANIN TEK ACCENT YÜZEYİ. Takvim sayfasında dokuz-on nötr kutu alt
         alta akıyor ve hiçbirinin önceliği yok; oysa burada OKUNACAK tek şey
         bu şerit, gerisi bakılacak veri. Depoda bu tam olarak belgeli bir
         desen (ana sayfadaki mercek bloğu, arşiv manşeti, bilanço karar
         şeridi hepsi aynı yüzeyi kullanıyor) ve glow değil: iki accent
         wash'ın ton farkı. Sayfada rakip bir accent yüzey yok — cesaret bir
         kez harcanıyor. Çipler kendi `bg-surface-solid` zemininde kalıyor,
         yani bu yüzeyin bir kademe ÖNÜNDE duruyorlar. */
      className="flex flex-col gap-2.5 rounded-lg border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))] px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="plate whitespace-nowrap tracking-[0.09em]">
          {t.analysis.recentStrip}
        </p>
        {/* Mobilde "Tümü" etiketle aynı satırda: altına inince şerit üç
            satıra çıkıyor ve takvimin önüne geçiyordu. */}
        <Link
          href="/bilancolar/analizler"
          className="-my-2 inline-flex min-h-10 items-center whitespace-nowrap py-2 text-tiny font-semibold text-primary hover:text-primary-hover sm:hidden"
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
                /* Çip 32 piksel yüksekliğinde ve yatay kayan bir şeridin
                   içinde: parmak kaydırırken nişan alıyor, en zor hedef
                   biçimi. `.tap-44` görünür hapı büyütmeden alanı açıyor —
                   şerit tek satır kalmalı, gerekçe yukarıda. */
                className="tap-44 flex items-center gap-2 rounded-full border border-line bg-surface-solid py-1 pl-1 pr-2.5 transition-colors hover:border-line-strong"
              >
                {/* Yuvarlak: karo hap biçimli bir çipin içinde. */}
                <LogoTile
                  symbol={row.symbol}
                  logoUrl={logoUrl}
                  size="xs"
                  className="rounded-full"
                />
                <span className="text-small font-bold text-strong">
                  {row.symbol}
                </span>
                <span
                  className={cn(
                    "figure whitespace-nowrap rounded-full px-1.5 py-px text-nano font-bold",
                    verdictPillClass(verdict),
                  )}
                >
                  {verdictLabel(verdict, t)} · {row.score}
                </span>
                {/* Hangi çeyreğin okunduğu yazılı değildi: `periodLabel`
                    sorguda zaten geliyor ve sunumda atılıyordu. */}
                <span className="figure whitespace-nowrap text-nano text-muted">
                  {row.periodLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/bilancolar/analizler"
        className="hidden shrink-0 whitespace-nowrap text-tiny font-semibold text-primary hover:text-primary-hover sm:inline"
      >
        {t.common.showAll} →
      </Link>
    </section>
  );
}
