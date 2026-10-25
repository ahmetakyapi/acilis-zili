import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowsLeftRight,
  BookOpenText,
  Calculator,
  ChartBar,
  ChartLine,
  ChartPieSlice,
  ClockCounterClockwise,
  FlowArrow,
  ListChecks,
  NumberSquareFour,
  PencilSimpleLine,
  SealCheck,
  SquaresFour,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { readingMinutes } from "@/components/article/ArticleBody";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { initialsOf } from "@/lib/avatars";
import type { Locale } from "@/lib/i18n/config";
import { POST_TEMPLATES, type PostTemplateKey } from "@/lib/post-templates";
import { TEMPLATE_ICONS } from "./template-icons";
import type { VisualKind } from "./feed-model";
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
 *
 * GÖRSEL TUR (25 Ekim, sahibi: "Burayı da görsel olarak çok iyi hâle
 * getirelim"). Üç değişiklik:
 * - Kart, yazının içinde ne olduğunu söyler: gövdeden ayrıştırılan ::: blok
 *   türleri ikonlu künye olarak (gerekçe `feed-model.ts` → kategori rozeti
 *   neden şablondan değil). Manşet kartı yazının ilk veri bloğunu yazı
 *   sayfasındakiyle aynı çizimle yanında taşır.
 * - Sağ kolon kompakt: üç adım tek satırlık ikonlu bir şerit, şablonlar
 *   2×2 küçük karo. Eski hâl 1440'ta 720 piksel boyundaydı ve akış kısa
 *   kaldığında kolonun yarısı boş dururdu.
 * - Boş akışta şablonlar ana panele iner (büyük karolar); rehber yalnız
 *   adımları taşır, aynı dört bağlantı iki yerde basılmaz.
 */

export const PRIMARY_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) bg-primary px-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover sm:min-h-10";

type CardLabels = {
  readMinutes: string;
  symbolsLabel?: string;
  kindsLabel: string;
  kinds: Record<VisualKind, string>;
  previewLabel?: string;
};

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
          className={cn("rounded-full", large ? "size-8 text-[11px]" : "size-6 text-[10px]")}
        />
        {post.author.username}
      </Link>
      <span aria-hidden>·</span>
      <time dateTime={post.publishedAt.toISOString().slice(0, 10)} className="numeral">
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

/** Blok türünün ikonu — yazı sayfasındaki kutu ikonlarıyla aynı aile
 *  (ArticleBody: dikkat WarningCircle, özet ListChecks, tanım BookOpenText). */
const KIND_ICONS: Record<VisualKind, Icon> = {
  sayilar: NumberSquareFour,
  bar: ChartBar,
  pay: ChartPieSlice,
  akis: FlowArrow,
  oncesi: ArrowsLeftRight,
  zaman: ClockCounterClockwise,
  grafik: ChartLine,
  ornek: Calculator,
  dikkat: WarningCircle,
  ozet: ListChecks,
  tanim: BookOpenText,
};

/**
 * Yazıdaki görsel blokların künyesi. Etkileşimli değil, bu yüzden mavi
 * değil (renk anlam taşır: mavi = etkileşim); ikon + ad, metin tonunda.
 */
function KindChips({ kinds, labels }: { kinds: readonly VisualKind[]; labels: CardLabels }) {
  if (kinds.length === 0) return null;
  return (
    <ul aria-label={labels.kindsLabel} className="flex flex-wrap gap-x-3 gap-y-1">
      {kinds.map((kind) => {
        const KindIcon = KIND_ICONS[kind];
        return (
          <li key={kind} className="inline-flex items-center gap-1 text-tiny font-semibold text-muted">
            <KindIcon size={14} weight="duotone" aria-hidden className="text-body" />
            {labels.kinds[kind]}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Yazı kartı. Bütün kart tek hedef (başlıktaki bağlantının `::after`'ı kartı
 * örter); yazar ve sembol bağlantıları `z-10` ile üstte kalır — iç içe
 * `<a>` yok.
 *
 * MANŞET (`lead`) geniş ekranda iki kolon: solda künye, başlık ve giriş,
 * sağda `preview` — yazının ilk veri bloğu, yazı sayfasındaki çizimle.
 * Önizleme `aria-hidden` + `inert`: aynı içerik yazının içinde okunuyor,
 * ekran okuyucuya iki kez söylenmez, klavye odağı içine düşmez; tık kartın
 * örtüsüne gider (`pointer-events-none`).
 */
export function PostCard({
  post,
  locale,
  dateFormat,
  labels,
  lead = false,
  names,
  kinds = [],
  preview,
}: {
  post: PublishedPost;
  locale: Locale;
  dateFormat: Intl.DateTimeFormat;
  labels: CardLabels;
  lead?: boolean;
  names?: SymbolNames;
  kinds?: readonly VisualKind[];
  preview?: ReactNode;
}) {
  const hasPreview = lead && Boolean(preview);
  return (
    <article
      className={cn(
        "group relative grid h-full min-w-0 rounded-(--radius-md) border border-line-soft bg-surface-sunken transition-colors duration-300 ease-brand hover:border-primary-faint",
        lead ? "gap-5 p-5 sm:p-6" : "gap-3 p-4 sm:p-5",
        hasPreview && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-7",
      )}
    >
      <div className={cn("flex min-w-0 flex-col", lead ? "gap-4" : "gap-3")}>
        <AuthorLine post={post} locale={locale} dateFormat={dateFormat} large={lead} />
        <div className="flex flex-col gap-2">
          <h3
            className={cn(
              "font-bold tracking-tight text-strong [overflow-wrap:anywhere] [text-wrap:balance]",
              lead ? "text-2xl leading-tight sm:text-[1.75rem]" : "text-lg leading-snug",
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
              lead ? "line-clamp-4 max-w-[62ch] text-base" : "line-clamp-2 text-sm",
            )}
          >
            {post.dek}
          </p>
        </div>
        <KindChips kinds={kinds} labels={labels} />
        {/* Künye kartın dibine yaslanır: ızgarada yan yana kartların alt
            satırları aynı hatta biter (ölçü ızgarası kuralı). */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line-soft pt-3">
          <SymbolChips symbols={post.symbols} max={lead ? 6 : 3} names={names} label={labels.symbolsLabel} />
          <span className="numeral ml-auto inline-flex items-center gap-1 text-tiny text-muted">
            {readingMinutes(post.bodyMd)} {labels.readMinutes}
            <ArrowRight
              size={12}
              aria-hidden
              className="transition-transform duration-300 ease-brand group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
      {hasPreview && (
        <figure aria-hidden className="pointer-events-none m-0 flex min-w-0 flex-col gap-2 self-start">
          {labels.previewLabel && (
            <figcaption className="text-tiny font-semibold text-muted">{labels.previewLabel}</figcaption>
          )}
          <div inert className="min-w-0 [&>*]:my-0">
            {preview}
          </div>
        </figure>
      )}
    </article>
  );
}

type Step = { title: string; body: string };

/** Adımların ikonları — sırası sözlükteki `steps` dizisiyle aynı. */
const STEP_ICONS: readonly Icon[] = [SquaresFour, PencilSimpleLine, SealCheck];

/**
 * Üç adım tek şeritte: ikon, altında ad. Açıklama cümlesi görünür değil ama
 * kaybolmuyor — `title` ile imleçte, ekran okuyucuda adla birlikte okunur
 * (editörün kendi adım şeridi aynı üç adımı uzun hâliyle gösteriyor).
 * Adımlar arası çizgi sırayı söyler; numara gerekmez.
 */
export function StepStrip({ steps, label }: { steps: readonly Step[]; label: string }) {
  return (
    <ol aria-label={label} className="grid grid-cols-3 gap-2 px-4 pb-5 pt-1 sm:px-5">
      {steps.map((step, index) => {
        const StepIcon = STEP_ICONS[index] ?? SealCheck;
        return (
          <li key={step.title} title={step.body} className="relative flex min-w-0 flex-col items-center gap-2 text-center">
            {index > 0 && (
              <span aria-hidden className="absolute right-[calc(50%+26px)] top-[19px] h-px w-[calc(100%-44px)] bg-line" />
            )}
            <span className="grid size-10 place-items-center rounded-full border border-line bg-surface-sunken text-strong">
              <StepIcon size={18} weight="duotone" aria-hidden />
            </span>
            <span className="text-small font-semibold leading-snug text-strong">
              {step.title}
              <span className="sr-only">: {step.body}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type TemplateLabels = Record<PostTemplateKey, { label: string; hint: string }>;

/**
 * Şablon karoları. `size="compact"`: rehber kolonunda 2×2 küçük karo (ikon +
 * ad, açıklama `title`da ve ekran okuyucuda). `size="large"`: boş akışta ana
 * panelin içinde, açıklamasıyla birlikte — orada okuyucu ilk yazısını
 * düşünüyor, karar için cümle lazım.
 */
export function TemplateTiles({ templates, size }: { templates: TemplateLabels; size: "compact" | "large" }) {
  const large = size === "large";
  return (
    <ul className={cn("grid gap-2", large ? "sm:grid-cols-2 sm:gap-3" : "grid-cols-2")}>
      {POST_TEMPLATES.map((template) => {
        const TemplateIcon = TEMPLATE_ICONS[template.key];
        const copy = templates[template.key];
        return (
          <li key={template.key} className="min-w-0">
            <Link
              href={`/yazilarim/yeni?sablon=${template.key}`}
              title={large ? undefined : copy.hint}
              className={cn(
                "group flex h-full min-w-0 rounded-(--radius-md) border border-line-soft bg-surface-sunken transition-colors duration-300 ease-brand hover:border-primary-faint hover:bg-primary-tint",
                large ? "min-h-[88px] items-start gap-3 p-4" : "min-h-[76px] flex-col justify-between gap-2 p-3",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded-(--radius-sm) bg-surface text-body transition-colors group-hover:text-primary",
                  large ? "size-10" : "size-8",
                )}
              >
                <TemplateIcon size={large ? 20 : 17} weight="duotone" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("flex items-center gap-1 font-semibold leading-snug text-strong", large ? "text-sm" : "text-small")}>
                  {copy.label}
                  {large && (
                    <ArrowRight
                      size={13}
                      aria-hidden
                      className="shrink-0 text-muted transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  )}
                </span>
                {large ? (
                  <span className="mt-1 block text-small leading-snug text-muted">{copy.hint}</span>
                ) : (
                  <span className="sr-only">: {copy.hint}</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

type GuideLabels = {
  stepsLabel: string;
  steps: readonly Step[];
  templatesTitle: string;
  templates: TemplateLabels;
  rules: string;
};

/**
 * Yazma rehberi — adım şeridi, şablon karoları (`withTemplates`), kurallar.
 * Şablon bağlantısı editörü `?sablon=` ile o iskelet dolu açar (PostEditor).
 * Kurallar panelin içinde, hairline üstünde düz paragraf.
 */
export function WriteGuide({ labels, withTemplates }: { labels: GuideLabels; withTemplates: boolean }) {
  return (
    <>
      <StepStrip steps={labels.steps} label={labels.stepsLabel} />
      {withTemplates && (
        <div className="flex flex-col gap-3 border-t border-line-soft px-4 pb-4 pt-4 sm:px-5">
          <h3 className="text-sm font-bold text-strong">{labels.templatesTitle}</h3>
          <TemplateTiles templates={labels.templates} size="compact" />
        </div>
      )}
      <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
        {labels.rules}
      </p>
    </>
  );
}

export type BandFigure = { label: string; value: string };

/**
 * Başlık bandının sağ yarısı: akışın sayıları ve en çok geçen sembollerin
 * logoları, yanında tek denetim (Sen de Yaz). Sayıların hepsi akışın kendi
 * satırlarından (`feedStats`); boş akışta band basılmaz, yalnız düğme kalır.
 */
export function FeedBand({
  figures,
  symbols,
  symbolsLabel,
  names,
  label,
  action,
}: {
  figures: readonly BandFigure[];
  symbols: readonly string[];
  symbolsLabel: string;
  names?: SymbolNames;
  label: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 lg:justify-end">
      {figures.length > 0 && (
        <dl aria-label={label} className="flex flex-wrap items-stretch gap-x-6 gap-y-3">
          {figures.map((figure) => (
            <div key={figure.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-tiny font-semibold text-muted">{figure.label}</dt>
              <dd className="numeral text-lg font-bold leading-tight text-strong">{figure.value}</dd>
            </div>
          ))}
          {symbols.length > 0 && (
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-tiny font-semibold text-muted">{symbolsLabel}</dt>
              <dd className="flex items-center">
                {symbols.map((symbol, index) => (
                  <Link
                    key={symbol}
                    href={`/hisse/${symbol}`}
                    prefetch={false}
                    title={names?.[symbol]?.name ?? symbol}
                    aria-label={names?.[symbol]?.name ?? symbol}
                    className={cn(
                      "tap-44 relative rounded-full ring-2 ring-(--premium-surface) transition-transform duration-300 ease-brand hover:-translate-y-0.5",
                      index > 0 && "-ml-1.5",
                    )}
                  >
                    <LogoTile symbol={symbol} logoUrl={names?.[symbol]?.logoUrl} size="xs" className="rounded-full" />
                  </Link>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
      {action}
    </div>
  );
}

type AuthorCardLabels = {
  title: string;
  profile: string;
  posts: string;
  postsOne: string;
  since: string;
  more: string;
};

export type AuthorOtherPost = { slug: string; title: string; publishedAt: Date | null };

/**
 * Yazı sayfasının yazar kimlik kartı (25 Ekim görsel turu). Gövdenin
 * altında, sorumluluk notunun hemen üstünde: içerik yazarın imzası, okuyucu
 * yazıyı bitirince "kim yazdı, başka ne yazdı" sorusunu orada sorar. Kutu
 * gölgesiz, ton farkıyla (surface-sunken). Sayı yazarın YAYINDAKİ yazıları
 * (`getPublishedPostsByUser`); üyelik tarihi hesabın açılış ayı.
 */
export function AuthorCard({
  username,
  avatar,
  locale,
  joinedAt,
  postCount,
  others,
  dateFormat,
  labels,
}: {
  username: string;
  avatar: PublishedPost["author"]["avatar"];
  locale: Locale;
  joinedAt: Date | null;
  postCount: number;
  others: readonly AuthorOtherPost[];
  dateFormat: Intl.DateTimeFormat;
  labels: AuthorCardLabels;
}) {
  const monthYear = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { month: "long", year: "numeric" });
  const facts = [
    postCount === 1 ? labels.postsOne : labels.posts.replace("{n}", String(postCount)),
    joinedAt ? labels.since.replace("{date}", monthYear.format(joinedAt)) : null,
  ].filter((fact): fact is string => Boolean(fact));
  return (
    <section
      aria-label={labels.title}
      className="flex flex-col gap-4 rounded-(--radius-md) border border-line-soft bg-surface-sunken p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <AvatarTile
          icon={avatar?.icon ?? null}
          color={avatar?.color}
          initials={initialsOf(username, locale)}
          className="size-12 shrink-0 rounded-full text-sm"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-strong [overflow-wrap:anywhere]">{username}</h2>
          <p className="numeral text-small text-muted">{facts.join(" · ")}</p>
        </div>
        <Link
          href={`/u/${username}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-(--radius-md) border border-line bg-surface px-3 text-small font-semibold text-body transition-colors hover:border-primary-faint hover:text-primary sm:min-h-10"
        >
          {labels.profile}
          <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
      {others.length > 0 && (
        <div className="border-t border-line-soft pt-3">
          <h3 className="text-small font-semibold text-muted">{labels.more}</h3>
          <ul className="mt-1 flex flex-col">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/topluluk/${other.slug}`}
                  className="group flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm font-semibold text-strong transition-colors hover:text-primary"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">{other.title}</span>
                  {other.publishedAt && (
                    <time dateTime={other.publishedAt.toISOString().slice(0, 10)} className="numeral shrink-0 text-tiny font-normal text-muted">
                      {dateFormat.format(other.publishedAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
