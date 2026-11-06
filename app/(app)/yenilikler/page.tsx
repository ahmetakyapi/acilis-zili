import { Rss } from "@phosphor-icons/react/dist/ssr";
import {
  FilterBar,
  HeaderAside,
  LatestDigest,
  MonthPanel,
  ScreenMap,
  WeeklyFlow,
} from "@/components/changelog/ChangelogParts";
import { MarkChangelogSeen } from "@/components/changelog/ChangelogBadge";
import { RevealHashTarget } from "@/components/changelog/RevealHashTarget";
import styles from "@/components/changelog/Changelog.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { EmptyState, FilterChip, Panel, PageHeader } from "@/components/ui/primitives";
import {
  LATEST_CHANGE_DATE,
  areaCounts,
  changelogEntries,
  filterEntries,
  groupByMonth,
  kindCounts,
  parseArea,
  parseKind,
  parseScreen,
  screenSummary,
  weeklyFlow,
  type ChangeFilter,
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
 * Ekran düzeni (CLAUDE.md), üçüncü düzen (6 Kasım; gerekçe ChangelogParts.tsx
 * başı): başlık bandı (ad, tek cümle; sağda üç sayı ve tek denetim RSS) →
 * Son Güncellemede (tür payı şeridi, Ne Geldi / Ne İyileşti / Ne Düzeldi üç
 * sütun, dokunduğu ekranlar, özet ve kapsam künyesi) → Haftalık Akış (her
 * hafta bir sütun, türe göre yığın) → Ekranlara Göre (ekran haritası, aynı
 * zamanda ekran süzgeci) → süzgeç şeridi (tür + alan) → Günlük Akış (ay ay
 * zaman çizgisi, maddeler açık).
 *   Önceki düzenlerin ölçümleri (25 Ekim): öne çıkan kartlar her alandan
 *   bir; ilk ekranda görünen alanlar 390×844'te Claude + Kişisel → Piyasa +
 *   Bilanço + Kişisel, 360×780'de hiç kart yok → üç alan. Bu düzenin
 *   ölçümleri `components/changelog/Changelog.module.css` başında.
 *   DataStamp yok: veri değil, yazılı geçmiş — tarih her girişin kendisinde.
 *   GuideHint yok: rehberde bu sayfanın sorusunu açan yazı yok.
 *
 * SÜZGEÇ ADRESTE (`?ekran=hisse|takvim|…`, `?alan=claude|piyasa|…`,
 * `?tur=yeni|iyilestirme|duzeltme`): sunucu adresten okuyup basıyor, bütün
 * süzgeç bağlantıları `scroll={false}` (FilterChip, ekran karoları) — sığ
 * adres güncellemesi yok, gezinme gerçek; geri tuşu ve paylaşılan bağlantı
 * aynı görünümü açar, istemci durumu yok. Son Güncellemede ve Haftalık Akış
 * süzgeçten BAĞIMSIZ (sabit özet ve bütün geçmiş; akış eşleşmeyeni soldurur),
 * ekran haritası öbür süzgeçlere göre sayar, günlük akış süzülür.
 *
 * Okundu işareti: sayfa açılınca en son giriş "görüldü" sayılır, menüdeki
 * "Yeni" rozeti söner; sayfadaki rozetler ziyaret BAŞINDAKİ değere bakar
 * (`components/changelog/seen-store.ts` → `baselineSnapshot`).
 */
export default async function ChangelogPage(props: PageProps<"/yenilikler">) {
  const { locale, t } = await getI18n();
  const L = t.changelog;
  const search = await props.searchParams;
  const filter: ChangeFilter = {
    kind: parseKind(search.tur),
    area: parseArea(search.alan),
    screen: parseScreen(search.ekran),
  };
  const { kind, area, screen } = filter;

  const all = changelogEntries(locale, TELEGRAM_URL);
  const shown = filterEntries(all, kind, area, screen);
  const filtered = kind !== null || area !== null || screen !== null;
  const months = groupByMonth(shown);
  const totals = { releases: all.length, items: kindCounts(all).all, updated: all[0].date };

  const hrefFor = (next: Partial<ChangeFilter>) => {
    const merged = { ...filter, ...next };
    const query = new URLSearchParams();
    if (merged.screen) query.set("ekran", merged.screen);
    if (merged.area) query.set("alan", merged.area);
    if (merged.kind) query.set("tur", merged.kind);
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

      <LatestDigest
        entry={all[0]}
        latest={LATEST_CHANGE_DATE}
        locale={locale}
        L={L}
        screenHref={(next) => `${hrefFor({ kind: null, area: null, screen: next })}#gunluk-akis`}
      />

      <WeeklyFlow weeks={weeklyFlow(all, shown)} filtered={filtered} locale={locale} L={L} />

      <ScreenMap
        summary={screenSummary(filterEntries(all, kind, area))}
        active={screen}
        hrefFor={(next) => hrefFor({ screen: next })}
        locale={locale}
        L={L}
      />

      <section id="gunluk-akis" aria-labelledby="gunluk-akis-baslik" className={styles.timeline}>
        <ChapterHeading
          id="gunluk-akis-baslik"
          title={L.timelineTitle}
          dek={filtered ? L.timelineFiltered.replace("{n}", String(kindCounts(shown).all)) : L.timelineHint}
        />
        <FilterBar
          filter={filter}
          total={kindCounts(all).all}
          kindCount={kindCounts(filterEntries(all, null, area, screen))}
          areaCount={areaCounts(filterEntries(all, kind, null, screen))}
          hrefFor={hrefFor}
          L={L}
        />
        {shown.length === 0 ? (
          <Panel aria-label={L.emptyTitle}>
            <EmptyState
              title={L.emptyTitle}
              hint={L.emptyBody}
              action={
                <FilterChip href={hrefFor({ kind: null, area: null, screen: null })} active={false}>
                  {L.filterAll}
                </FilterChip>
              }
            />
          </Panel>
        ) : (
          months.map((month, index) => (
            <MonthPanel
              key={month.month}
              month={month}
              open={filtered || index < 2}
              latest={LATEST_CHANGE_DATE}
              locale={locale}
              L={L}
            />
          ))
        )}
      </section>
    </MotionExperience>
  );
}
