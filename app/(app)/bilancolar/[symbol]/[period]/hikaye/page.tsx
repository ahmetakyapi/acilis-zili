import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { PageShare } from "@/components/article/PageShare";
import { StoryCardView } from "@/components/earnings/story/StoryCardView";
import { StoryDeck } from "@/components/earnings/story/StoryDeck";
import styles from "@/components/earnings/story/Story.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/ui/primitives";
import { analysisHref } from "@/lib/analysis";
import { getAnalysisLocales, getSymbolNames } from "@/lib/data";
import { earningsHref } from "@/lib/earnings-company";
import { storyCardTitle, storyImagePath, STORY_MIN_CARDS } from "@/lib/earnings-story";
import { getStory } from "@/lib/earnings-story-data";
import { STORY_OG_SIZES } from "@/lib/earnings-story-og";
import { getI18n, type Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { articleOpenGraph, missingMetadata } from "@/lib/page-meta";
import { absoluteUrl, pageAlternates } from "@/lib/site";

/**
 * Bilanço Hikâye Kartları — `/bilancolar/[symbol]/[period]/hikaye` (24 Ekim).
 *
 * Skorlu analizin dikey kartlara bölünmüş, paylaşılabilir hâli: beklenti
 * ve gerçekleşen, rehberlik, fiyat tepkisi, tek cümle, skor. Kart seçimi
 * ve "veri olmayan kart basılmaz" kuralı `lib/earnings-story.ts`; her
 * kartın görseli `hikaye/gorsel` rotasında.
 *
 * Analiz sayfasının bir GÖRÜNÜMÜ, yeni bir içerik değil: metin kaynağı
 * aynı kayıt. Bu yüzden canonical kendisi ama hreflang analizin var olan
 * dilleriyle sınırlı (`getAnalysisLocales`) — çevirisi olmayan analizin
 * hikâyesi de o dilde yok.
 */

const FILE_PREFIX = "aciliszili-hikaye";

function storyPath(symbol: string, period: string): string {
  return `${analysisHref(symbol, period)}/hikaye`;
}

export async function generateMetadata(
  props: PageProps<"/bilancolar/[symbol]/[period]/hikaye">,
): Promise<Metadata> {
  const { symbol: raw, period } = await props.params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { locale, t } = await getI18n();
  const [story, diller] = await Promise.all([getStory(symbol, period, locale), getAnalysisLocales(symbol, period)]);
  if (!story || story.cards.length < STORY_MIN_CARDS) return missingMetadata(locale);
  const s = t.earningsSeason.story;
  const vars = (text: string) =>
    text.replace("{company}", story.row.company).replace("{period}", story.row.periodLabel);
  const first = story.cards[0];
  const image = absoluteUrl(storyImagePath(analysisHref(symbol, period), first.kind, "yatay"), locale);
  return {
    title: vars(s.title),
    description: vars(s.metaDescription),
    alternates: pageAlternates(storyPath(symbol, period), locale, diller),
    /* Paylaşım kartı İLK kartın yatay görseli. Kök alanlar
       `articleOpenGraph`ten ve hreflang ile AYNI dil listesiyle (CLAUDE.md
       "Çevirisi eksik olabilen içerik"): elle kurulmuş hâli `og:locale`a
       arayüzün dilini ve `alternateLocale`a çevirisi olmayan dili de
       yazıyordu. */
    openGraph: {
      ...articleOpenGraph(locale, { availableLocales: diller }),
      images: [
        {
          url: image,
          ...STORY_OG_SIZES.landscape,
          alt: vars(s.ogLandscapeAlt).replace("{card}", storyCardTitle(first, s)),
        },
      ],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function StoryPage(props: PageProps<"/bilancolar/[symbol]/[period]/hikaye">) {
  const { symbol: raw, period } = await props.params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { locale, t } = await getI18n();
  const story = await getStory(symbol, period, locale);
  if (!story || story.cards.length < STORY_MIN_CARDS) notFound();
  const meta = (await getSymbolNames([symbol]))[symbol];

  const s = t.earningsSeason.story;
  const { row, cards } = story;
  const title = s.title.replace("{company}", row.company).replace("{period}", row.periodLabel);
  const analysisPath = analysisHref(symbol, period);
  const path = storyPath(symbol, period);
  const currency = meta?.currency || true;
  const imagesOf = (kind: (typeof cards)[number]["kind"]) => {
    const name = (size: "portrait" | "landscape") => {
      const dims = STORY_OG_SIZES[size];
      return `${FILE_PREFIX}-${symbol.toLowerCase()}-${period}-${kind}-${dims.width}x${dims.height}.png`;
    };
    return {
      portrait: withLocale(storyImagePath(analysisPath, kind, "dikey"), locale),
      landscape: withLocale(storyImagePath(analysisPath, kind, "yatay"), locale),
      portraitName: name("portrait"),
      landscapeName: name("landscape"),
    };
  };

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <BreadcrumbJsonLd
        locale={row.locale as Locale}
        items={[
          { name: t.analysis.title, path: "/bilancolar/analizler" },
          { name: `${row.company} · ${row.periodLabel}`, path: analysisPath },
          { name: s.link, path },
        ]}
      />
      <nav aria-label={t.common.breadcrumb} className="flex flex-wrap items-center gap-2 text-small text-muted">
        <Link href={earningsHref(symbol)} className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary">
          {row.company}
        </Link>
        <span aria-hidden>›</span>
        <Link href={analysisPath} className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary">
          {row.periodLabel}
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-strong">{s.link}</span>
      </nav>

      {/* Paylaş başlığın sağında (sitenin kalıbı: `PageHeader share=`). */}
      <PageHeader
        title={title}
        subtitle={s.linkHint}
        share={<PageShare compactOnMobile align="right" path={path} title={title} locale={locale} t={t} />}
      />

      <StoryDeck label={s.deckLabel} prevLabel={s.prev} nextLabel={s.next}>
        {cards.map((card, index) => (
          <StoryCardView
            key={card.kind}
            card={card}
            index={index}
            total={cards.length}
            ident={{ symbol, periodLabel: row.periodLabel, logoUrl: meta?.logoUrl }}
            images={imagesOf(card.kind)}
            analysisPath={analysisPath}
            currency={currency}
            locale={locale}
            t={t}
          />
        ))}
      </StoryDeck>

      <Link href={analysisPath} className={styles.back}>
        <ArrowLeft size={14} weight="bold" aria-hidden />
        {s.back}
      </Link>
    </MotionExperience>
  );
}
