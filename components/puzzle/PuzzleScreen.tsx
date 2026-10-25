import { cookies } from "next/headers";
import { CalendarDots, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { PageShare } from "@/components/article/PageShare";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site";
import { ARCHIVE_COOKIE, PROGRESS_COOKIE, PUZZLE_ZONE, parseProgressCookie, puzzleNumber } from "@/lib/stock-puzzle";
import { evaluatePuzzle } from "@/lib/stock-puzzle-data";
import { StockPuzzle } from "./StockPuzzle";
import styles from "./PuzzleScreen.module.css";

/**
 * "Hisseyi Bil" ekranı — günlük bulmaca (`/bulmaca`) ve arşiv günü
 * (`/bulmaca/[gun]`) aynı ekran (25 Ekim). Fark: arşivde başlığın altında
 * "Arşivden oynuyorsun" künyesi ve bugüne dönüş, oyun seriye sayılmaz.
 *
 * Durum okurun ilerleme çerezinden (`PROGRESS_COOKIE` günlük,
 * `ARCHIVE_COOKIE` son oynanan arşiv günü): yarım ya da bitmiş oyun ilk
 * çizimde yerinde, istemci geri yüklerken ekran kaymıyor. Çerez yoksa ya
 * da tutmazsa boş bulmaca; tarayıcı deposu yine geri yükler
 * (`StockPuzzle`). Cevap sayfaya yalnız bitmiş bulmacada girer (uçla aynı
 * kural, `lib/stock-puzzle-data.ts`).
 *
 * Başlığın altında künye: bulmaca numarası, TR takvim günü ve arşiv
 * bağlantısı. Üst künye yok (CLAUDE.md, `PageHeader`).
 */
export async function PuzzleScreen({ day, archive }: { day: string; archive: boolean }) {
  const { locale, t } = await getI18n();
  const L = t.stockPuzzle;
  const number = puzzleNumber(day);
  const jar = await cookies();
  const saved = parseProgressCookie(jar.get(archive ? ARCHIVE_COOKIE : PROGRESS_COOKIE)?.value, day);
  const restored = saved.length > 0 ? await evaluatePuzzle(day, saved, locale) : null;
  const result = restored?.ok ? restored : await evaluatePuzzle(day, [], locale);
  const dateLabel = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: PUZZLE_ZONE,
  }).format(new Date(`${day}T12:00:00Z`));
  const path = archive ? `/bulmaca/${day}` : "/bulmaca";
  const title = archive ? `${L.title} #${number}` : L.title;

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd
        locale={locale}
        items={archive ? [{ name: L.title, path: "/bulmaca" }, { name: L.archiveLink, path: "/bulmaca/arsiv" }, { name: title, path }] : [{ name: L.title, path }]}
      />
      <PageHeader
        title={title}
        subtitle={archive ? L.archiveDayNote : L.subtitle}
        share={<PageShare compactOnMobile align="right" path={path} title={title} locale={locale} t={t} />}
      />
      <div className={styles.meta}>
        <p className={styles.stamp}>
          <span className="numeral font-semibold text-strong">{L.number.replace("{n}", String(number))}</span>
          <time dateTime={day}>{dateLabel}</time>
        </p>
        <nav className={styles.links} aria-label={L.archiveLink}>
          {archive && (
            <Link href="/bulmaca" className={styles.link}>
              <ArrowLeft aria-hidden size={14} weight="bold" />
              {L.backToToday}
            </Link>
          )}
          <Link href="/bulmaca/arsiv" className={styles.link}>
            <CalendarDots aria-hidden size={14} weight="bold" />
            {L.archiveLink}
          </Link>
        </nav>
      </div>

      {result.ok ? (
        <StockPuzzle
          key={day}
          initial={result.state}
          options={result.options}
          labels={L}
          locale={locale}
          shareUrl={absoluteUrl(path, locale)}
          archive={archive}
        />
      ) : (
        <EmptyState title={L.unavailableTitle} hint={L.unavailable} />
      )}

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["piyasa-degeri", "hisse-senedi"]} />
    </MotionExperience>
  );
}
