import { MotionExperience, ScrollProgress, SpotlightCard } from "@/components/motion/PremiumMotion";
import experience from "@/components/motion/EditorialExperience.module.css";
import detail from "@/components/stories/StoryDetail.module.css";
import editorial from "@/components/article/ArticleEditorial.module.css";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody, parseBlocks, readingMinutes } from "@/components/article/ArticleBody";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { articleAutoLinker } from "@/lib/autolink-data";
import { initialsOf } from "@/lib/avatars";
import { getI18n } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { articleOpenGraph, metaDescription, missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { getPublishedPost, getPublishedPostsByUser } from "@/lib/user-post-data";
import { getAuthorProfile } from "@/lib/profile-data";
import { AuthorCard, SymbolChips } from "@/components/community/CommunityParts";
import { getSymbolNames } from "@/lib/data";

/**
 * Topluluk yazısı — okuma sayfası. Gövde Mercek'le AYNI çiziciden geçiyor
 * (ArticleBody, variant="editorial"): bir ::: bloğu orada nasıl görünüyorsa
 * burada da öyle. Yazar künyesi başta — içerik yazarın imzası, sitenin değil;
 * sorumluluk notu gövdenin altında, hairline üstünde.
 *
 * DIŞ BAĞLANTILAR MODERASYONLA KORUNUYOR, çizici kısıtlamasıyla değil:
 * ArticleBody şema süzgeci zaten javascript:/data:'yı düz metne düşürüyor;
 * kalan risk (istenmeyen reklam/olta adresi) her yayının insan onayından
 * geçmesiyle kapanıyor. Çözümleyiciye kullanıcıya özgü ikinci bir kip
 * eklemek, iki çizim dili demekti.
 */

/** Yazar kartında listelenen öteki yazı sayısı. */
const AUTHOR_OTHERS = 3;

export async function generateMetadata(props: PageProps<"/topluluk/[slug]">) {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const post = await getPublishedPost(slug);
  if (!post) return missingMetadata(locale);
  const dil = isLocale(post.locale) ? post.locale : "tr";
  return {
    title: post.title,
    description: metaDescription(post.dek),
    alternates: pageAlternates(`/topluluk/${post.slug}`, locale, [dil]),
    openGraph: articleOpenGraph(locale, {
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      availableLocales: [dil],
    }),
  };
}

export default async function CommunityPostPage(props: PageProps<"/topluluk/[slug]">) {
  const { slug } = await props.params;
  const { locale, t } = await getI18n();
  const L = t.community;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const blocks = parseBlocks(post.bodyMd, post.locale);
  const [autoLink, names, author] = await Promise.all([
    articleAutoLinker(post.locale),
    post.symbols.length
      ? getSymbolNames(post.symbols.slice(0, 8)).catch(() => ({}) as Awaited<ReturnType<typeof getSymbolNames>>)
      : Promise.resolve({} as Awaited<ReturnType<typeof getSymbolNames>>),
    getAuthorProfile(post.author.username),
  ]);
  /* Yazar kartı (25 Ekim): yazı sayısı ve öteki yazılar yayındakilerden;
     profil okunamazsa kart yine basılır, yalnız sayı bu yazıyla sınırlı. */
  const authorPosts = author ? await getPublishedPostsByUser(author.userId) : [];
  const otherPosts = authorPosts.filter((other) => other.slug !== post.slug).slice(0, AUTHOR_OTHERS);
  const minutes = readingMinutes(post.bodyMd);
  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    /* OKUMA KABI MERCEK'LE AYNI (15 Ekim): `max-w-3xl` dar sütun yerine
       StoryDetail'in 1040'lık kartı ve iki hattı (yüzey kenarda, metin
       `--read-inset` içeride). Bir ::: bloğu Mercek'te nerede duruyorsa
       burada da orada — kullanıcı yazısı ikinci sınıf bir sayfa değil. */
    <MotionExperience className={experience.article}>
      <ScrollProgress />
      <article className={detail.article}>
        <div className={detail.utility}>
          <Link
            href="/topluluk"
            className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft weight="bold" size={13} aria-hidden />
            {L.post.back}
          </Link>
        </div>

        <SpotlightCard className={detail.coverSurface}>
          <header className={detail.cover} data-has-aside="false">
            <div className={detail.coverCopy} data-motion-intro>
              <h1 data-ink="lines" className={detail.title}>
                <span className="ink-line">{post.title}</span>
              </h1>
              {/* Künye başlığın ALTINDA (kicker yasağı): yazar, tarih, süre. */}
              <div className="-mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-small text-muted">
                <Link
                  href={`/u/${post.author.username}`}
                  className="inline-flex min-h-11 items-center gap-2 font-semibold text-body transition-colors hover:text-strong sm:min-h-0"
                >
                  <AvatarTile
                    icon={post.author.avatar?.icon ?? null}
                    color={post.author.avatar?.color}
                    initials={initialsOf(post.author.username, locale)}
                    className="size-7 rounded-full text-[11px]"
                  />
                  {post.author.username}
                </Link>
                <span aria-hidden>·</span>
                <time dateTime={post.publishedAt.toISOString().slice(0, 10)} className="numeral">
                  {dateFormat.format(post.publishedAt)}
                </time>
                <span aria-hidden>·</span>
                <span className="numeral">
                  {minutes} {t.stories.readMinutes}
                </span>
              </div>
              <p className={detail.dek}>{post.dek}</p>
              {/* Semboller logolu rozet (25 Ekim) — akış kartıyla aynı bileşen. */}
              <SymbolChips symbols={post.symbols} max={8} names={names} label={t.feedVisuals.community.symbolsLabel} />
            </div>
          </header>
        </SpotlightCard>

        <div className={detail.layout}>
          <div className={detail.mainCol}>
            <div lang={post.locale} data-motion-article>
              <ArticleBody
                markdown={post.bodyMd}
                blocks={blocks}
                locale={post.locale}
                variant="editorial"
                className={editorial.prose}
                autoLink={autoLink}
                ugc
              />
            </div>

            <div className="mt-10">
              <AuthorCard
                username={post.author.username}
                avatar={post.author.avatar}
                locale={locale}
                joinedAt={author?.joinedAt ?? null}
                postCount={Math.max(authorPosts.length, 1)}
                others={otherPosts}
                dateFormat={dateFormat}
                labels={t.communityVisuals.author}
              />
            </div>

            {/* Sorumluluk ve bildirim — hairline üstünde düz paragraf, yeni kutu yok. */}
            <footer className={detail.sources}>
              <p className={detail.disclaimer}>
                {L.post.disclaimer.replace("{author}", post.author.username)}
              </p>
              <a
                href="https://github.com/ahmetakyapi/acilis-zili/issues"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-11 w-fit items-center gap-1 text-small font-semibold text-muted underline decoration-line underline-offset-2 transition-colors hover:text-strong sm:min-h-0"
              >
                {L.post.report}
                <ArrowUpRight size={13} aria-hidden />
              </a>
            </footer>
          </div>
        </div>
      </article>
    </MotionExperience>
  );
}
