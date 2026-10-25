import { Rss } from "@phosphor-icons/react/dist/ssr";
import { LatestRelease, MonthPanel, ReleaseStrip } from "@/components/changelog/ChangelogParts";
import { MarkChangelogSeen } from "@/components/changelog/ChangelogBadge";
import { RevealHashTarget } from "@/components/changelog/RevealHashTarget";
import styles from "@/components/changelog/Changelog.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { EmptyState, FilterChip, Panel, PageHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  CHANGE_KINDS,
  LATEST_CHANGE_DATE,
  changelogEntries,
  filterEntries,
  groupByMonth,
  monthTicks,
  releaseTimeline,
  kindCounts,
  parseKind,
  type ChangeKind,
} from "@/lib/changelog";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/page-meta";
import { TELEGRAM_URL } from "@/lib/site";

export const generateMetadata = pageMetadata({
  path: "/yenilikler",
  tr: {
    title: "Yenilikler: Sitede Neler Değişti",
    description:
      "Açılış Zili'ne eklenen özellikler, iyileştirmeler ve düzeltmeler, en yenisi üstte. 1 Ağustos 2026'dan bu yana bütün geçmiş; her yeni özelliği buradan deneyebilirsin.",
  },
  en: {
    title: "What's New on Opening Bell",
    description:
      "Features, improvements and fixes added to Opening Bell, newest first. The full history since August 1, 2026, with a link to try every new feature.",
  },
});

/**
 * /yenilikler — SİTENİN DEĞİŞİKLİK GEÇMİŞİ (25 Ekim, sahibinin isteği:
 * "neler eklendi gibisinden, geçmişi de kapsasın, kullanıcılar yeni
 * özellikleri görüp test edebilsin").
 *
 * İçerik depoda (`content/changelog.ts`, kaynağı git geçmişi); sayfa
 * sunucuda, veritabanı ve sağlayıcı çağrısı yok.
 *
 * Ekran düzeni (CLAUDE.md):
 *   başlık (sağda tek denetim: RSS) → sürüm şeridi (künye şeridi: her
 *   sürüm bir nokta, altında üç sayı) → en son sürüm (ana görsel; alanlara
 *   göre gruplu kompakt karolar, dibinde kapsam künyesi) → süzgeç → aylar
 *   (her giriş tek satır, katlı). Yeniden düzen 25 Ekim — gerekçe
 *   ChangelogParts.tsx başı.
 *   DataStamp yok: veri değil, yazılı geçmiş — tarih her girişin kendisinde.
 *   GuideHint yok: rehberde bu sayfanın sorusunu açan yazı yok.
 *
 * SÜZGEÇ ADRESTE (`?tur=yeni|iyilestirme|duzeltme`): sunucu adresten
 * okuyup basıyor, çipler `scroll={false}` (FilterChip). Geri tuşu ve
 * paylaşılan bağlantı aynı görünümü açar; istemci durumu yok.
 *
 * Okundu işareti: sayfa açılınca en son giriş "görüldü" sayılır, menüdeki
 * "Yeni" rozeti söner (`components/changelog/seen-store.ts`).
 */
export default async function ChangelogPage(props: PageProps<"/yenilikler">) {
  const { locale, t } = await getI18n();
  const L = t.changelog;
  const search = await props.searchParams;
  const kind = parseKind(search.tur);

  const all = changelogEntries(locale, TELEGRAM_URL);
  const counts = kindCounts(all);
  const shown = filterEntries(all, kind);
  const latest = shown[0]?.date === all[0].date ? shown[0] : null;
  const months = groupByMonth(latest ? shown.slice(1) : shown);
  /* Şerit süzgeçten bağımsız: sürüm akışının tamamı (süzgeç maddeyi
     süzer, sürümü değil). */
  const points = releaseTimeline(all);
  const totals = { releases: all.length, items: counts.all, updated: all[0].date };

  const filterHref = (next: ChangeKind | null) =>
    withLocale(next ? `/yenilikler?tur=${next}` : "/yenilikler", locale);

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <MarkChangelogSeen latest={LATEST_CHANGE_DATE} />
      <RevealHashTarget />
      <PageHeader
        className={styles.masthead}
        title={L.title}
        subtitle={L.subtitle}
        action={
          /* Besleme bir sayfa değil (XML): ön yükleme yok, düz bağlantı. */
          <a
            href={withLocale("/yenilikler/feed.xml", locale)}
            aria-label={L.feedLabel}
            className="tap-44 inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-small font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
          >
            <Rss weight="bold" size={14} aria-hidden />
            {L.feedLink}
          </a>
        }
      />

      <ReleaseStrip points={points} ticks={monthTicks(points)} totals={totals} locale={locale} L={L} />

      {latest && <LatestRelease entry={latest} locale={locale} L={L} />}

      <div className={styles.toolbar}>
        <div className={styles.toolGroup} role="group" aria-label={L.filterLabel}>
          {/* Dar ekranda çipler kırılmak yerine kayar (analizler kalıbı). */}
          <ScrollEdges className="no-scrollbar -mx-4 flex max-w-full gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <FilterChip href={filterHref(null)} active={!kind}>
              {L.filterAll}
              {" "}
              <span className={styles.count}>{counts.all}</span>
            </FilterChip>
            {CHANGE_KINDS.map((value) => (
              <FilterChip key={value} href={filterHref(value)} active={kind === value}>
                {L.kind[value]}{" "}
                <span className={styles.count}>{counts[value]}</span>
              </FilterChip>
            ))}
          </ScrollEdges>
        </div>
      </div>

      {shown.length === 0 ? (
        <Panel aria-label={L.emptyTitle}>
          <EmptyState
            title={L.emptyTitle}
            hint={L.emptyBody}
            action={
              <FilterChip href={filterHref(null)} active={false}>
                {L.filterAll}
              </FilterChip>
            }
          />
        </Panel>
      ) : (
        <>
          {months.map((month) => (
            <MonthPanel key={month.month} month={month} locale={locale} L={L} />
          ))}
        </>
      )}
    </MotionExperience>
  );
}
