import { PageShare } from "@/components/article/PageShare";
import { GuideHint } from "@/components/article/GuideHint";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { StockPuzzle } from "@/components/puzzle/StockPuzzle";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { absoluteUrl } from "@/lib/site";
import { PUZZLE_ZONE, puzzleDayKey, puzzleNumber } from "@/lib/stock-puzzle";
import { evaluatePuzzle } from "@/lib/stock-puzzle-data";

export const generateMetadata = pageMetadata({
  path: "/bulmaca",
  tr: {
    title: "Hisseyi Bil: Günlük Hisse Bulmacası",
    description:
      "Günlük hisse bulmacası: grafiğin siluetinden, sektöründen ve piyasa değerinden günün ABD hissesini altı tahminde bul.",
  },
  en: {
    title: "Guess the Stock: Daily Stock Puzzle",
    description:
      "A daily stock puzzle: find the day's US stock in six guesses from its chart silhouette, sector and market cap.",
  },
});

/**
 * "Hisseyi Bil" — günlük hisse bulmacası (24 Ekim).
 *
 * Sayfa yalnızca günün İLK durumunu (tahminsiz, tek ipucu) ve arama
 * kutusunun havuzunu basar; cevap sayfaya girmez. Okurun bu tarayıcıdaki
 * ilerlemesi istemcide geri yüklenir (`StockPuzzle`). Gerekçeler
 * `lib/stock-puzzle.ts` ve `lib/stock-puzzle-data.ts` başında.
 *
 * Başlığın altında künye: bulmaca numarası ve TR takvim günü. Üst künye
 * yok (CLAUDE.md, `PageHeader`).
 */
export default async function StockPuzzlePage() {
  const { locale, t } = await getI18n();
  const L = t.stockPuzzle;
  const day = puzzleDayKey();
  const number = puzzleNumber(day);
  const result = await evaluatePuzzle(day, [], locale);
  const dateLabel = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: PUZZLE_ZONE,
  }).format(new Date(`${day}T12:00:00Z`));

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: L.title, path: "/bulmaca" }]} />
      <PageHeader
        title={L.title}
        subtitle={L.subtitle}
        share={<PageShare compactOnMobile align="right" path="/bulmaca" title={L.title} locale={locale} t={t} />}
      />
      <p className="-mt-2 flex flex-wrap gap-x-3 text-small text-muted">
        <span className="numeral font-semibold text-strong">{L.number.replace("{n}", String(number))}</span>
        <time dateTime={day}>{dateLabel}</time>
      </p>

      {result.ok ? (
        <StockPuzzle
          key={day}
          initial={result.state}
          options={result.options}
          labels={L}
          locale={locale}
          shareUrl={absoluteUrl("/bulmaca", locale)}
        />
      ) : (
        <EmptyState title={L.unavailableTitle} hint={L.unavailable} />
      )}

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["piyasa-degeri", "hisse-senedi"]} />
    </MotionExperience>
  );
}
