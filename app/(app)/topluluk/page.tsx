import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import { PostCard, PRIMARY_LINK, WriteGuide } from "@/components/community/CommunityParts";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getPublishedPosts } from "@/lib/user-post-data";
import { getSymbolNames } from "@/lib/data";

export const generateMetadata = pageMetadata({
  path: "/topluluk",
  tr: {
    title: "Topluluk",
    description: "Üyelerin yazdığı, moderasyondan geçmiş piyasa yazıları.",
  },
  en: {
    title: "Community",
    description: "Member-written market posts, published after review.",
  },
});

/**
 * Topluluk akışı — üyelerin yazdığı, moderasyondan geçmiş yazılar.
 * Gerekçe lib/schema.ts → userPosts. Kart dili Mercek listesine komşu ama
 * künye farklı: yazar karosu + kullanıcı adı başta — bu içeriğin kimliği
 * sitenin değil yazarın imzası.
 *
 * KAP DİĞER EKRANLARLA AYNI (15 Ekim): `mx-auto max-w-2xl` kaldırıldı;
 * düzenin gerekçesi components/community/CommunityParts.tsx.
 */
export default async function CommunityPage() {
  const { locale, t } = await getI18n();
  const L = t.community;
  const posts = await getPublishedPosts();
  const [lead, ...rest] = posts;
  const authors = new Set(posts.map((post) => post.author.username)).size;

  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const cardLabels = { readMinutes: t.stories.readMinutes, symbolsLabel: t.feedVisuals.community.symbolsLabel };
  /* Rozet logoları (25 Ekim): kartlarda görünen sembollerin tamamı tek sorguda. */
  const names = posts.length
    ? await getSymbolNames([...new Set(posts.flatMap((post) => post.symbols.slice(0, 6)))]).catch(() => ({}) as Awaited<ReturnType<typeof getSymbolNames>>)
    : {};
  const countLabel = posts.length === 1 ? L.mine.countOne : L.mine.count.replace("{n}", String(posts.length));

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader
        title={L.feed.title}
        subtitle={L.feed.subtitle}
        action={
          <Link href="/yazilarim/yeni" className={PRIMARY_LINK}>
            <PencilSimpleLine weight="duotone" size={16} aria-hidden />
            {L.feed.write}
          </Link>
        }
      />

      {/* İki kolon, aralık gap-5; kolonlar üstten hizalı (justify-between
          yok — CLAUDE.md "Düzen"). Telefonda rehber akışın altına iner. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {posts.length === 0 || !lead ? (
          /* Boş akış da panelin içinde: rehber panelinin yanında başıboş
             bir sahne değil, aynı hatta başlayan bir kart (ölçüldü, 1280). */
          <Panel>
            <PanelHeader title={L.feed.listTitle} />
            <EmptyState
              scene="press"
              title={L.feed.emptyTitle}
              hint={L.feed.emptyHint}
              className="py-12"
              action={
                <Link href="/yazilarim/yeni" className={PRIMARY_LINK}>
                  <PencilSimpleLine weight="duotone" size={16} aria-hidden />
                  {L.feed.write}
                </Link>
              }
            />
          </Panel>
        ) : (
          <Panel>
            <PanelHeader
              title={L.feed.listTitle}
              meta={`${countLabel} · ${L.feed.authors.replace("{n}", String(authors))}`}
            />
            <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
              <PostCard post={lead} locale={locale} dateFormat={dateFormat} labels={cardLabels} names={names} lead />
              {rest.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {rest.map((post) => (
                    <li key={post.id} className="min-w-0">
                      <PostCard post={post} locale={locale} dateFormat={dateFormat} labels={cardLabels} names={names} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Uyarı panelin içinde, hairline üstünde düz paragraf. */}
            <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
              {L.feed.note}
            </p>
          </Panel>
        )}

        <Panel className="lg:sticky lg:top-[calc(var(--app-bar-h)+20px)]">
          <PanelHeader title={L.feed.howTitle} />
          <WriteGuide
            labels={{
              howTitle: L.feed.howTitle,
              steps: L.feed.steps,
              templatesTitle: L.feed.templatesTitle,
              templatesHint: L.feed.templatesHint,
                templates: L.templates,
              rules: L.mine.rules,
            }}
          />
        </Panel>
      </div>
    </MotionExperience>
  );
}
