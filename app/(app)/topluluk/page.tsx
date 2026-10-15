import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { readingMinutes } from "@/components/article/ArticleBody";
import { initialsOf } from "@/lib/avatars";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getPublishedPosts } from "@/lib/user-post-data";

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
 */
export default async function CommunityPage() {
  const { locale, t } = await getI18n();
  const L = t.community;
  const posts = await getPublishedPosts();

  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <MotionExperience className={`${polish.page} mx-auto w-full max-w-2xl`}>
      <ScrollProgress />
      <PageHeader
        title={L.feed.title}
        subtitle={L.feed.subtitle}
        action={
          <Link
            href="/yazilarim/yeni"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) bg-primary px-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover sm:min-h-10"
          >
            <PencilSimpleLine weight="duotone" size={16} aria-hidden />
            {L.feed.write}
          </Link>
        }
      />

      {posts.length === 0 ? (
        <EmptyState scene="press" title={L.feed.emptyTitle} hint={L.feed.emptyHint} />
      ) : (
        <Panel>
          <PanelHeader title={L.feed.listTitle} meta={posts.length === 1 ? L.mine.countOne : L.mine.count.replace("{n}", String(posts.length))} />
          <ul className="divide-y divide-line-soft px-4 sm:px-5">
            {posts.map((post) => (
              <li key={post.id} className="py-4">
                <article className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/u/${post.author.username}`}
                      className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-body transition-colors hover:text-strong sm:min-h-0"
                    >
                      <AvatarTile
                        icon={post.author.avatar?.icon ?? null}
                        color={post.author.avatar?.color}
                        initials={initialsOf(post.author.username, locale)}
                        className="size-6 rounded-full text-[10px]"
                      />
                      {post.author.username}
                    </Link>
                    <span className="text-tiny text-muted" aria-hidden>
                      ·
                    </span>
                    <time
                      dateTime={post.publishedAt.toISOString().slice(0, 10)}
                      className="text-tiny tabular-nums text-muted"
                    >
                      {dateFormat.format(post.publishedAt)}
                    </time>
                  </div>
                  <Link href={`/topluluk/${post.slug}`} className="group flex flex-col gap-1">
                    <h3 className="text-lg font-bold leading-snug tracking-tight text-strong transition-colors group-hover:text-primary [overflow-wrap:anywhere]">
                      {post.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-body [overflow-wrap:anywhere]">{post.dek}</p>
                  </Link>
                  <p className="text-tiny text-muted">
                    {t.stories.readMinutes
                      ? `${readingMinutes(post.bodyMd)} ${t.stories.readMinutes}`
                      : null}
                    {post.symbols.length > 0 && (
                      <span className="numeral"> · {post.symbols.slice(0, 6).join(" · ")}</span>
                    )}
                  </p>
                </article>
              </li>
            ))}
          </ul>
          {/* Uyarı panelin içinde, hairline üstünde düz paragraf. */}
          <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
            {L.feed.note}
          </p>
        </Panel>
      )}
    </MotionExperience>
  );
}
