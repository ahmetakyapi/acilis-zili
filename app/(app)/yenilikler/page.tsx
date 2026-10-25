import { Rss } from "@phosphor-icons/react/dist/ssr";
import { FilterBar, HeaderAside, LatestRelease, MonthPanel, ReleaseStrip } from "@/components/changelog/ChangelogParts";
import { MarkChangelogSeen } from "@/components/changelog/ChangelogBadge";
import { RevealHashTarget } from "@/components/changelog/RevealHashTarget";
import styles from "@/components/changelog/Changelog.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { EmptyState, FilterChip, Panel, PageHeader } from "@/components/ui/primitives";
import {
  LATEST_CHANGE_DATE,
  areaCounts,
  changelogEntries,
  filterEntries,
  groupByMonth,
  monthTicks,
  releaseTimeline,
  kindCounts,
  parseArea,
  parseKind,
  type ChangeArea,
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
 * Ekran düzeni (CLAUDE.md), kompakt düzen (25 Ekim, ikinci tur):
 *   başlık bandı (ad, tek cümle; sağda üç sayı ve tek denetim RSS) →
 *   sürüm akışı (her sürüm bir çubuk) → süzgeç şeridi (alan + tür) → en
 *   son sürüm (ana görsel: öne çıkan kartlar, kalanı kompakt ızgara; dibinde
 *   özet ve kapsam künyesi) → aylar (her giriş tek satır, katlı).
 *   Gerekçe ChangelogParts.tsx başı.
 *   Alan çeşitliliği (25 Ekim, mobil turu): öne çıkan kartlar her alandan
 *   bir (Piyasa önce), Claude maddeleri "Claude ile" grubunda
 *   (`splitLatest`). Ölçüldü (TR/EN, açık/koyu): ilk ekranda görünen
 *   alanlar 390×844'te Claude + Kişisel → Piyasa + Bilanço + Kişisel,
 *   360×780'de hiç kart yok → üç alan, 430×932'de dört alan.
 *   DataStamp yok: veri değil, yazılı geçmiş — tarih her girişin kendisinde.
 *   GuideHint yok: rehberde bu sayfanın sorusunu açan yazı yok.
 *
 * SÜZGEÇ ADRESTE (`?alan=claude|piyasa|…`, `?tur=yeni|iyilestirme|duzeltme`):
 * sunucu adresten okuyup basıyor, çipler `scroll={false}` (FilterChip).
 * Geri tuşu ve paylaşılan bağlantı aynı görünümü açar; istemci durumu yok.
 *
 * Okundu işareti: sayfa açılınca en son giriş "görüldü" sayılır, menüdeki
 * "Yeni" rozeti söner; sayfadaki rozetler ziyaret BAŞINDAKİ değere bakar
 * (`components/changelog/seen-store.ts` → `baselineSnapshot`).
 */
export default async function ChangelogPage(props: PageProps<"/yenilikler">) {
  const { locale, t } = await getI18n();
  const L = t.changelog;
  const search = await props.searchParams;
  const kind = parseKind(search.tur);
  const area = parseArea(search.alan);

  const all = changelogEntries(locale, TELEGRAM_URL);
  const shown = filterEntries(all, kind, area);
  const latest = shown[0]?.date === all[0].date ? shown[0] : null;
  const months = groupByMonth(latest ? shown.slice(1) : shown);
  /* Akış süzgeçten bağımsız: sürüm akışının tamamı; süzgeç yalnız
     eşleşmeyen çubukları soldurur. */
  const points = releaseTimeline(all);
  const filtered = kind !== null || area !== null;
  const matches = filtered ? new Set(shown.map((entry) => entry.date)) : null;
  const totals = { releases: all.length, items: kindCounts(all).all, updated: all[0].date };

  const hrefFor = (nextKind: ChangeKind | null, nextArea: ChangeArea | null) => {
    const query = new URLSearchParams();
    if (nextArea) query.set("alan", nextArea);
    if (nextKind) query.set("tur", nextKind);
    const qs = query.toString();
    return withLocale(qs ? `/yenilikler?${qs}` : "/yenilikler", locale);
  };

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
          <HeaderAside
            totals={totals}
            feedHref={withLocale("/yenilikler/feed.xml", locale)}
            feedIcon={<Rss weight="bold" size={14} aria-hidden />}
            locale={locale}
            L={L}
          />
        }
      />

      <ReleaseStrip points={points} ticks={monthTicks(points)} matches={matches} locale={locale} L={L} />

      <FilterBar
        kind={kind}
        area={area}
        total={kindCounts(all).all}
        kindCount={kindCounts(filterEntries(all, null, area))}
        areaCount={areaCounts(filterEntries(all, kind))}
        hrefFor={hrefFor}
        L={L}
      />

      {shown.length === 0 ? (
        <Panel aria-label={L.emptyTitle}>
          <EmptyState
            title={L.emptyTitle}
            hint={L.emptyBody}
            action={
              <FilterChip href={hrefFor(null, null)} active={false}>
                {L.filterAll}
              </FilterChip>
            }
          />
        </Panel>
      ) : (
        <>
          {latest && <LatestRelease entry={latest} latest={LATEST_CHANGE_DATE} locale={locale} L={L} />}
          {months.map((month) => (
            <MonthPanel key={month.month} month={month} latest={LATEST_CHANGE_DATE} locale={locale} L={L} />
          ))}
        </>
      )}
    </MotionExperience>
  );
}
