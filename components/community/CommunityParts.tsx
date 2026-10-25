import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { readingMinutes } from "@/components/article/ArticleBody";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { initialsOf } from "@/lib/avatars";
import type { Locale } from "@/lib/i18n/config";
import { POST_TEMPLATES, type PostTemplateKey } from "@/lib/post-templates";
import { TEMPLATE_ICONS } from "./template-icons";
import type { PublishedPost } from "@/lib/user-post-data";
import { cn } from "@/lib/utils";

/**
 * Topluluk ekranının parçaları (15 Ekim). Akış eskiden 672 piksellik ortalı
 * dar bir sütundu: sitenin geri kalanı sayfa kabının tamamını kullanırken bu
 * ekran kendine özel bir girinti açıyordu (sahibi: "her ekran aynı
 * başlamalı"). Artık kap `polish.page`, ızgara iki kolon: solda akış, sağda
 * yazma rehberi. Akışın ilk yazısı manşet kartı — en yeni yazı okuyucunun
 * ilk gördüğü şey; kalanlar iki sütunlu kart ızgarası.
 *
 * Kartlar panelin İÇİNDE tonla ayrılır (surface-sunken), gölgeyle değil.
 */

export const PRIMARY_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) bg-primary px-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover sm:min-h-10";


type CardLabels = { readMinutes: string; symbolsLabel?: string };

function AuthorLine({
  post,
  locale,
  dateFormat,
  large = false,
}: {
  post: PublishedPost;
  locale: Locale;
  dateFormat: Intl.DateTimeFormat;
  large?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-tiny text-muted">
      <Link
        href={`/u/${post.author.username}`}
        className="relative z-10 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-body transition-colors hover:text-strong sm:min-h-0"
      >
        <AvatarTile
          icon={post.author.avatar?.icon ?? null}
          color={post.author.avatar?.color}
          initials={initialsOf(post.author.username, locale)}
          className={cn("rounded-full", large ? "size-7 text-[11px]" : "size-6 text-[10px]")}
        />
        {post.author.username}
      </Link>
      <span aria-hidden>·</span>
      <time dateTime={post.publishedAt.toISOString().slice(0, 10)} className="tabular-nums">
        {dateFormat.format(post.publishedAt)}
      </time>
    </div>
  );
}

export type SymbolNames = Record<string, { logoUrl?: string | null; name?: string | null } | undefined>;

/**
 * Yazıda geçen semboller — logolu rozet, hissenin sayfasına bağlantı
 * (25 Ekim, görsel tur: düz yazı çip "hangi şirket" sorusunu logoyla
 * cevaplamıyordu). Kart bütünüyle tek hedef olduğu için rozetler `z-10`
 * ile örtünün üstünde; dokunma alanı 44 (`tap-44`).
 */
export function SymbolChips({ symbols, max, names, label }: { symbols: string[]; max: number; names?: SymbolNames; label?: string }) {
  if (symbols.length === 0) return null;
  return (
    <ul aria-label={label} className="relative z-10 flex flex-wrap gap-1.5">
      {symbols.slice(0, max).map((symbol) => (
        <li key={symbol}>
          <Link
            href={`/hisse/${symbol}`}
            prefetch={false}
            className="tap-44 numeral inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5 text-tiny font-semibold text-body transition-colors hover:border-primary-faint hover:text-strong"
          >
            <LogoTile symbol={symbol} logoUrl={names?.[symbol]?.logoUrl} size="xs" className="rounded-full" />
            {symbol}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Yazı kartı. Bütün kart tek hedef (başlıktaki bağlantının `::after`'ı kartı
 * örter); yazar bağlantısı `z-10` ile üstte kalır — iç içe `<a>` yok.
 */
export function PostCard({
  post,
  locale,
  dateFormat,
  labels,
  lead = false,
  names,
}: {
  post: PublishedPost;
  locale: Locale;
  dateFormat: Intl.DateTimeFormat;
  labels: CardLabels;
  lead?: boolean;
  names?: SymbolNames;
}) {
  return (
    <article
      className={cn(
        "group relative flex h-full min-w-0 flex-col rounded-(--radius-md) border border-line-soft bg-surface-sunken transition-colors duration-300 ease-brand hover:border-primary-faint hover:bg-primary-tint",
        lead ? "gap-4 p-5 sm:p-7" : "gap-3 p-4 sm:p-5",
      )}
    >
      <AuthorLine post={post} locale={locale} dateFormat={dateFormat} large={lead} />
      <div className="flex flex-col gap-2">
        <h3
          className={cn(
            "font-bold tracking-tight text-strong [overflow-wrap:anywhere] [text-wrap:balance]",
            lead ? "text-2xl leading-tight sm:text-3xl" : "text-lg leading-snug",
          )}
        >
          <Link
            href={`/topluluk/${post.slug}`}
            className="transition-colors after:absolute after:inset-0 after:rounded-(--radius-md) group-hover:text-primary"
          >
            {post.title}
          </Link>
        </h3>
        <p
          className={cn(
            "leading-relaxed text-body [overflow-wrap:anywhere]",
            lead ? "max-w-[62ch] text-base" : "line-clamp-3 text-sm",
          )}
        >
          {post.dek}
        </p>
      </div>
      {/* Künye kartın dibine yaslanır: ızgarada yan yana kartların alt
          satırları aynı hatta biter (ölçü ızgarası kuralı). */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
        <SymbolChips symbols={post.symbols} max={lead ? 6 : 3} names={names} label={labels.symbolsLabel} />
        <span className="ml-auto inline-flex items-center gap-1 text-tiny tabular-nums text-muted">
          {readingMinutes(post.bodyMd)} {labels.readMinutes}
          <ArrowRight
            size={12}
            aria-hidden
            className="transition-transform duration-300 ease-brand group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </article>
  );
}

type GuideLabels = {
  howTitle: string;
  steps: readonly { title: string; body: string }[];
  templatesTitle: string;
  templatesHint: string;
  templates: Record<PostTemplateKey, { label: string; hint: string }>;
  rules: string;
};

/**
 * Yazma rehberi — üç adım ve şablonla başlama bağlantıları. Şablon bağlantısı
 * editörü `?sablon=` ile o iskelet dolu açar (PostEditor). Kurallar panelin
 * içinde, hairline üstünde düz paragraf.
 */
export function WriteGuide({ labels }: { labels: GuideLabels }) {
  return (
    <>
      <ol className="flex flex-col gap-4 px-4 pb-5 pt-1 sm:px-5">
        {labels.steps.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[28px_1fr] gap-3">
            <span
              aria-hidden
              className="numeral grid size-7 place-items-center rounded-full border border-line bg-surface-sunken text-tiny font-bold text-strong"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-strong">{step.title}</p>
              <p className="text-small leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-line-soft px-4 pb-2 pt-4 sm:px-5">
        <h3 className="text-sm font-bold text-strong">{labels.templatesTitle}</h3>
        <p className="mt-0.5 text-small leading-relaxed text-muted">{labels.templatesHint}</p>
      </div>
      <ul className="flex flex-col px-2 pb-3 sm:px-3">
        {POST_TEMPLATES.map((template) => {
          const TemplateIcon = TEMPLATE_ICONS[template.key];
          return (
            <li key={template.key}>
              <Link
                href={`/yazilarim/yeni?sablon=${template.key}`}
                className="group flex min-h-14 items-center gap-3 rounded-(--radius-md) px-2 py-2 transition-colors duration-300 ease-brand hover:bg-primary-tint"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-(--radius-sm) bg-surface-sunken text-body transition-colors group-hover:text-primary">
                  <TemplateIcon size={18} weight="duotone" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-strong">{labels.templates[template.key].label}</span>
                  <span className="block text-small leading-snug text-muted">{labels.templates[template.key].hint}</span>
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden
                  className="shrink-0 text-muted transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
        {labels.rules}
      </p>
    </>
  );
}
