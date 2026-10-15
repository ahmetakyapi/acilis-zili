import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
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
import { getPublishedPost } from "@/lib/user-post-data";

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
  const autoLink = await articleAutoLinker(post.locale);
  const minutes = readingMinutes(post.bodyMd);
  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <MotionExperience className={`${polish.page} mx-auto w-full max-w-3xl`}>
      <ScrollProgress />
      <nav className="pt-1">
        <Link
          href="/topluluk"
          className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-muted transition-colors hover:text-strong sm:min-h-0"
        >
          <ArrowLeft size={14} aria-hidden />
          {L.post.back}
        </Link>
      </nav>

      <header className="flex flex-col gap-3 border-b border-line pb-5">
        <h1 className="display-ink text-3xl font-black leading-tight tracking-tight sm:text-4xl [overflow-wrap:anywhere]">
          {post.title}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-body [overflow-wrap:anywhere]">{post.dek}</p>
        {/* Künye başlığın ALTINDA (kicker yasağı): yazar karosu, tarih, süre. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small text-muted">
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
          <time dateTime={post.publishedAt.toISOString().slice(0, 10)} className="tabular-nums">
            {dateFormat.format(post.publishedAt)}
          </time>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {minutes} {t.stories.readMinutes}
          </span>
          {post.symbols.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="flex flex-wrap gap-1.5">
                {post.symbols.slice(0, 8).map((symbol) => (
                  <Link
                    key={symbol}
                    href={`/hisse/${symbol}`}
                    className="numeral inline-flex min-h-11 items-center rounded-full border border-line bg-surface-sunken px-2 text-tiny font-semibold text-body transition-colors hover:border-line-focus hover:text-strong sm:min-h-6"
                  >
                    {symbol}
                  </Link>
                ))}
              </span>
            </>
          )}
        </div>
      </header>

      <div lang={post.locale} data-motion-article>
        <ArticleBody
          markdown={post.bodyMd}
          blocks={blocks}
          locale={post.locale}
          variant="editorial"
          className={editorial.prose}
          autoLink={autoLink}
        />
      </div>

      {/* Sorumluluk ve bildirim — hairline üstünde düz paragraf, yeni kutu yok. */}
      <footer className="flex flex-col gap-2 border-t border-line-soft pt-4">
        <p className="text-small leading-relaxed text-muted">
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
    </MotionExperience>
  );
}
