import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { redirect } from "next/navigation";
import { ArrowUpRight, PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getOwnPosts } from "@/lib/user-post-data";
import type { PostStatus } from "@/lib/user-posts";
import { cn } from "@/lib/utils";

/* Kişisel ekran — dizine girmez (noindex burada + NOINDEX_PATHS). */
export const generateMetadata = pageMetadata({
  path: "/yazilarim",
  robots: { index: false, follow: false },
  tr: { title: "Yazılarım", description: "Topluluk yazıların: taslaklar, kuyruk ve yayındakiler." },
  en: { title: "My Posts", description: "Your community posts: drafts, queue and published." },
});

/** Durum çipi tonları — renk anlam taşır: yayın `up`, red `down`, kalanı nötr. */
const STATUS_TONE: Record<PostStatus, string> = {
  draft: "border-line bg-surface-sunken text-body",
  pending: "border-brass/40 bg-brass/10 text-strong",
  published: "border-up/40 bg-up/10 text-up",
  rejected: "border-down/40 bg-down/10 text-down",
};

export default async function MyPostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/yazilarim");

  const { locale, t } = await getI18n();
  const L = t.community;
  const { available, posts } = await getOwnPosts(session.user.id);

  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const statusLabel = (status: PostStatus): string => L.status[status];

  return (
    <MotionExperience className={`${polish.page} mx-auto w-full max-w-2xl`}>
      <ScrollProgress />
      <PageHeader
        title={L.mine.title}
        subtitle={L.mine.subtitle}
        action={
          available ? (
            <Link
              href="/yazilarim/yeni"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) bg-primary px-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover sm:min-h-10"
            >
              <PencilSimpleLine weight="duotone" size={16} aria-hidden />
              {L.mine.newPost}
            </Link>
          ) : undefined
        }
      />

      {!available ? (
        <EmptyState title={L.mine.unavailable} hint={L.mine.unavailableHint} />
      ) : posts.length === 0 ? (
        <EmptyState
          scene="press"
          title={L.mine.emptyTitle}
          hint={L.mine.emptyHint}
          action={
            <Link
              href="/yazilarim/yeni"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              <PencilSimpleLine weight="duotone" size={16} aria-hidden />
              {L.mine.newPost}
            </Link>
          }
        />
      ) : (
        <Panel>
          <PanelHeader title={L.mine.listTitle} meta={posts.length === 1 ? L.mine.countOne : L.mine.count.replace("{n}", String(posts.length))} />
          <ul className="divide-y divide-line-soft px-4 sm:px-5">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/yazilarim/${post.id}`}
                    className="flex min-h-11 items-center text-base font-semibold text-strong transition-colors hover:text-primary sm:min-h-0"
                  >
                    <span className="truncate">{post.title}</span>
                  </Link>
                  <p className="truncate text-small text-muted">{post.dek}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-tiny font-semibold",
                    STATUS_TONE[post.status],
                  )}
                >
                  {statusLabel(post.status)}
                </span>
                <time
                  dateTime={post.updatedAt.toISOString().slice(0, 10)}
                  className="shrink-0 text-tiny tabular-nums text-muted"
                >
                  {dateFormat.format(post.updatedAt)}
                </time>
                {post.status === "published" && (
                  <Link
                    href={`/topluluk/${post.slug}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 text-small font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-0"
                    aria-label={`${post.title} — ${L.mine.view}`}
                  >
                    {L.mine.view}
                    <ArrowUpRight size={13} aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {/* Kurallar panelin içinde, hairline üstünde — yeni kutu yok. */}
          <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
            {L.mine.rules}
          </p>
        </Panel>
      )}
    </MotionExperience>
  );
}
