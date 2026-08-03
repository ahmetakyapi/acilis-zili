import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GlyphTile } from "@/components/article/GlyphTile";
import { readingMinutes } from "@/components/article/ArticleBody";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import {
  GUIDE_ARTICLES,
  GUIDE_TOPICS,
  guideTopicLabel,
  type GuideTopicKey,
} from "@/content/guide";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Rehber — kavram yazılarının vitrini.
 *
 * Kartlar tek tek okunacak yazılar olduğu için ızgara geniş: üç sütunda
 * başlık ve giriş cümlesi kırpılmadan sığıyor. Filtre URL'de yaşıyor
 * (?konu=strateji), sunucuda çözülüyor — burada da JS gerekmiyor.
 */

export default async function GuidePage(props: PageProps<"/rehber">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const requested =
    typeof search.konu === "string" ? (search.konu as GuideTopicKey) : null;
  const activeTopic =
    GUIDE_TOPICS.find((topic) => topic.key === requested)?.key ?? null;

  const counts = new Map<string, number>();
  for (const article of GUIDE_ARTICLES) {
    counts.set(article.topic, (counts.get(article.topic) ?? 0) + 1);
  }

  const shown = activeTopic
    ? GUIDE_ARTICLES.filter((article) => article.topic === activeTopic)
    : GUIDE_ARTICLES;

  const topicHref = (key: string | null) =>
    key ? `/rehber?konu=${key}` : "/rehber";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.guide.eyebrow}
        title={t.guide.title}
        subtitle={t.guide.subtitle}
      />

      <div className="flex flex-wrap items-center gap-2">
        <TopicChip
          href={topicHref(null)}
          active={!activeTopic}
          label={t.guide.allTopics}
          count={GUIDE_ARTICLES.length}
        />
        {GUIDE_TOPICS.map((topic) => (
          <TopicChip
            key={topic.key}
            href={topicHref(topic.key === activeTopic ? null : topic.key)}
            active={topic.key === activeTopic}
            label={guideTopicLabel(topic.key, locale)}
            count={counts.get(topic.key) ?? 0}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <Panel>
          <EmptyState title={t.guide.empty} />
        </Panel>
      ) : activeTopic ? (
        <ArticleGrid articles={shown} locale={locale} t={t} />
      ) : (
        /* Filtre yokken yirmiden fazla kart tek yığın hâlinde okunmuyordu.
           Konu başlıkları hem müfredat sırasını görünür kılıyor hem de
           "nereden başlasam" sorusunu cevaplıyor. */
        <div className="flex flex-col gap-8">
          {GUIDE_TOPICS.map((topic) => {
            const group = GUIDE_ARTICLES.filter(
              (article) => article.topic === topic.key,
            );
            if (group.length === 0) return null;
            return (
              <section key={topic.key} className="flex flex-col gap-4">
                <div className="flex items-baseline gap-3 border-b border-line pb-2.5">
                  <h2 className="display-ink display-ink-tight w-fit text-[17px] font-bold tracking-[-0.03em]">
                    {guideTopicLabel(topic.key, locale)}
                  </h2>
                  <span className="numeral text-[12px] text-muted">
                    {group.length}
                  </span>
                  <Link
                    href={topicHref(topic.key)}
                    /* -my-2 py-2: 12px'lik metin tek başına 18px yüksekliğinde
                       bir dokunma hedefi bırakıyordu; dolgu onu 32px'e
                       çıkarır, negatif margin satırı olduğu yerde tutar. */
                    className="-my-2 ml-auto inline-flex min-h-8 shrink-0 items-center py-2 text-[12px] text-primary transition-colors hover:text-primary-hover"
                  >
                    {t.guide.onlyThis}
                  </Link>
                </div>
                {/* Konu etiketi kartlarda gizli: başlık zaten iki satır
                    yukarıda duruyor, tekrarı gürültü yapıyor. */}
                <ArticleGrid
                  articles={group}
                  locale={locale}
                  t={t}
                  showTopic={false}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArticleGrid({
  articles,
  locale,
  t,
  showTopic = true,
}: {
  articles: typeof GUIDE_ARTICLES;
  locale: Locale;
  t: Dictionary;
  showTopic?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {articles.map((article) => (
        <Link
          key={article.slug}
          href={`/rehber/${article.slug}`}
          prefetch={false}
          className="min-w-0"
        >
          <Panel className="panel-hover flex h-full flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <GlyphTile glyph={article.glyph} />
              {showTopic && (
                <span className="plate mt-1 text-right text-[10px] tracking-[0.09em]">
                  {guideTopicLabel(article.topic, locale)}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <h2 className="display-ink display-ink-tight w-fit text-[18px] font-bold tracking-[-0.025em]">
                {article.title}
              </h2>
              <p className="text-[13.5px] leading-[21px] text-body">
                {article.dek}
              </p>
            </div>

            <p className="flex items-center gap-1.5 border-t border-line pt-3 text-[12px] font-semibold text-primary">
              {t.guide.cardCta}
              <ArrowRight weight="bold" size={13} />
              <span className="numeral ml-auto font-normal text-muted">
                {readingMinutes(article.bodyMd)} {t.guide.readMinutes}
              </span>
            </p>
          </Panel>
        </Link>
      ))}
    </div>
  );
}

function TopicChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "border-transparent bg-primary text-on-primary"
          : "border-line bg-surface text-body hover:border-line-strong hover:text-strong",
      )}
    >
      {label}
      <span
        className={cn(
          "numeral text-[11px] font-bold",
          active ? "text-on-primary/70" : "text-muted",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
