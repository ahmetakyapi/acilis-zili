import { Suspense } from "react";
import { MotionExperience, ScrollProgress, ScrollStage, SpotlightCard } from "@/components/motion/PremiumMotion";
import experience from "@/components/motion/EditorialExperience.module.css";
import editorial from "@/components/article/ArticleEditorial.module.css";
import detail from "@/components/stories/StoryDetail.module.css";
import {
  StoryFigure,
  figureRepeatsBlock,
  storyFigureIndex,
  type StoryFigureBlock,
} from "@/components/stories/StoryFigure";
import { StoryRail, type StoryTocItem } from "@/components/stories/StoryRail";
import { StoryCompanies, StoryCompaniesFallback } from "@/components/stories/StoryCompanies";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import {
  ArticleBody,
  headingIds,
  parseBlocks,
  readingMinutes,
  type Block,
} from "@/components/article/ArticleBody";
import { ShareButton } from "@/components/article/ShareButton";
import { LogoTile } from "@/components/ui/primitives";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import {
  getStories,
  getStoryBySlug,
  getStoryLocales,
  getSymbolNames,
} from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  articleOpenGraph,
  metaDescription,
  missingMetadata,
} from "@/lib/page-meta";
import { absoluteUrl, pageAlternates } from "@/lib/site";
import { formatEtDateLong, safeExternalUrl } from "@/lib/utils";

/**
 * Mercek yazısı — okuma sayfası.
 *
 * Künye kasten gövdenin ALTINDA: kaynak listesi ve sorumluluk notu okuyanı
 * metne girmeden karşılamamalı, ama yazının bir parçası olarak da mutlaka
 * bulunmalı. Bu metinler isimsiz kaynaklara dayanan haberlerden derleniyor;
 * neye dayandığını saklamak seçenek değil.
 */

export async function generateMetadata(props: PageProps<"/mercek/[slug]">) {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const [story, diller] = await Promise.all([
    getStoryBySlug(slug, locale),
    getStoryLocales(slug),
  ]);
  if (!story) return missingMetadata(locale);
  return {
    title: story.title,
    description: metaDescription(story.dek),
    /* CANONICAL VE HREFLANG. Dinamik sayfalar künyelerini elden yazıyor ve
       `alternates` bloğunu hiç vermiyorlardı: sitenin en kalabalık
       adresleri (yüzlerce hisse, her yazı, her analiz) canonical'sız ve
       "öteki dildeki karşılığı şu" bilgisi olmadan yayımlanıyordu. Kök
       layout canonical yazmıyor (orada gerekçesi var), yani miras da yok.
       `pageAlternates` RSS keşif etiketini de birlikte taşıyor. */
    /* HREFLANG YALNIZCA VAR OLAN DİLLERİ İLAN EDER. Çevirisi yazılmamış bir
       yazıda koşulsuz `hreflang="en"` var olmayan bir İngilizce sürüm vaat
       ediyordu. Gerekçe `lib/data.ts` → `getStoryLocales`. */
    alternates: pageAlternates(`/mercek/${slug}`, locale, diller),
    /* `og:type` kökten "website" miras alınıyordu: uzun okuma metinleri
       sosyal ağlara ve okuyucu uygulamalarına "bu bir web sitesi" diye
       tanıtılıyor, yayın tarihi hiçbir yere çıkmıyordu.
       Blok `articleOpenGraph`tan: kendi `openGraph`ını veren sayfa kökteki
       `siteName` ve `locale`ı düşürüyordu, gerekçe orada. */
    openGraph: articleOpenGraph(locale, {
      publishedTime: story.publishedAt?.toISOString(),
    }),
  };
}

/**
 * Yazıda geçen şirketler — logolu kartlar.
 *
 * Düz sembol rozetleri yerine logo + ad: bir okuyucu "SNDK" ile "NBIS"in
 * hangi şirket olduğunu bilmek zorunda değil. Logolar sağlayıcının şirket
 * profilinden geliyor; gelmezse sembolün ilk iki harfi kutuda durur.
 */
async function StorySymbols({ symbols }: { symbols: string[] }) {
  const meta = await getSymbolNames(symbols);

  return (
    <div className={detail.symbols}>
      {symbols.map((symbol) => {
        const logo = meta[symbol]?.logoUrl;
        const name = meta[symbol]?.name;
        return (
          <Link
            key={symbol}
            href={`/hisse/${symbol}`}
            className="panel-hover flex min-h-10 items-center gap-2 rounded-md border border-line bg-surface py-1.5 pl-1.5 pr-3 transition-colors"
          >
            <LogoTile symbol={symbol} logoUrl={logo} size="sm" />
            <span className="min-w-0">
              <span className="numeral block text-small font-bold leading-tight text-strong">
                {symbol}
              </span>
              {name && (
                <span className="block max-w-32 truncate text-nano leading-tight text-muted">
                  {name}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Yazının altındaki arşiv köprüsü.
 *
 * Bir dosyayı bitiren okuyucunun tek çıkışı geri tuşuydu; arşivde ikinci bir
 * yazıya geçmenin yolu yoktu. Üç komşu kayıt burada duruyor — kart değil
 * satır, çünkü sayfanın işi hâlâ okumak, yeni bir vitrin açmak değil.
 */
async function MoreStories({
  slug,
  locale,
  t,
}: {
  slug: string;
  locale: Locale;
  t: Dictionary;
}) {
  const rows = (await getStories(locale, 8))
    .filter((story) => story.slug !== slug)
    .slice(0, 3);

  if (rows.length === 0) return null;

  return (
    <nav id="story-more" className={detail.moreStories} aria-label={t.stories.moreStories}>
      <p className={detail.sectionTitle}>{t.stories.moreStories}</p>
      <ul className="flex flex-col">
        {rows.map((story) => (
          <li key={story.slug} data-motion-reveal>
            <Link
              href={`/mercek/${story.slug}`}
              className="-mx-3 flex flex-col gap-0.5 rounded-(--radius-lg) px-3 py-3 transition-colors hover:bg-primary-tint sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="numeral shrink-0 text-tiny text-muted">
                {formatEtDateLong(story.eventDate, locale)}
              </span>
              <span className={detail.moreCopy}>
                <strong>{story.title}</strong>
                {story.dek && <span>{story.dek}</span>}
              </span>
              <ArrowUpRight size={20} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/mercek"
        className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center py-2 text-small font-semibold text-primary transition-colors hover:text-primary-hover"
      >
        {t.stories.backToList}
      </Link>
    </nav>
  );
}

/**
 * İçindekiler — gövdenin `##` başlıkları, yazıdaki sırasıyla.
 *
 * Numara bütün `##` başlıkları sayıyor, yalnızca listelenenleri değil:
 * gövdedeki başlık numarası (CSS sayacı) ile raydaki numara aynı olmalı.
 * Kimliği olmayan başlık (yalnızca sembolden oluşan) sayıda yer tutuyor ama
 * listede yok — bağlantısı olmayan bir satır basılmaz.
 */
function tocOf(blocks: Block[]): StoryTocItem[] {
  const ids = headingIds(blocks);
  const items: StoryTocItem[] = [];
  let number = 0;
  blocks.forEach((block, index) => {
    if (block.kind !== "heading" || block.level !== 2) return;
    number += 1;
    const id = ids[index];
    if (id) items.push({ id, label: block.text, number });
  });
  return items;
}

/** Üçten az bölümlü yazıda içindekiler gürültü; liste hiç basılmıyor. */
const TOC_MIN = 3;

/**
 * "Bloomberg — AMD Set to Top…" → yayıncı + başlık.
 *
 * Rutin kaynakları "Yayıncı — Başlık" kalıbında yazıyor ve etiket olduğu gibi
 * basılıyordu: arayüzde çıplak bir uzun tire. Ayraç tire, uzun tire ya da
 * kısa tire olabiliyor. Kalıba uymayan etikette yayıncı adresin alan adı.
 */
const SOURCE_LABEL = /^(.{2,40}?)\s+[—–-]\s+(.+)$/;

function splitSource(label: string, href: string | null): { publisher: string | null; title: string } {
  const match = SOURCE_LABEL.exec(label.trim());
  if (match) return { publisher: match[1].trim(), title: match[2].trim() };
  let host: string | null = null;
  if (href) {
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      host = null;
    }
  }
  return { publisher: host, title: label };
}

/**
 * Dar ekranın içindekileri — özet kutusunun altında, kapalı.
 *
 * Mobilde yapışkan bir liste yok: üstte uygulama çubuğu, altta sekme
 * çubuğu ve şerit zaten ekranın bir dilimini tutuyor. Kapalı bir kutu tek
 * satır yer kaplıyor ve yazının şeklini isteyene veriyor.
 */
function MobileToc({
  items,
  lang,
  t,
}: {
  items: StoryTocItem[];
  lang: string;
  t: Dictionary;
}) {
  const count = (items.length === 1 ? t.stories.sectionCountOne : t.stories.sectionCountMany).replace(
    "{count}",
    String(items.length),
  );
  return (
    <details className={detail.tocMobile}>
      <summary>
        <span>{t.stories.inThisArticle}</span>
        <span>{count}</span>
        <CaretDown size={16} weight="bold" aria-hidden />
      </summary>
      <nav aria-label={t.stories.tocLabel}>
        <ol lang={lang}>
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>
                <span aria-hidden>{String(item.number).padStart(2, "0")}</span>
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}

export default async function StoryPage(props: PageProps<"/mercek/[slug]">) {
  const { slug } = await props.params;
  const { locale, t } = await getI18n();
  const story = await getStoryBySlug(slug, locale);

  /* Olmayan yazı 404 DÖNER — ekran `not-found.tsx` dosyasında. */
  if (!story) notFound();

  const minutes = story.readMinutes ?? readingMinutes(story.bodyMd);
  const minutesLabel = `${minutes} ${t.stories.readMinutes}`;
  const sources = story.sources ?? [];
  const symbols = story.symbols ?? [];

  /* TEK AYRIŞTIRMA. Kapak rakamı, gövdede düşürülecek kopyası ve
     içindekiler aynı blok dizisinden okunuyor; gövde de aynı diziyi alıyor
     (`blocks`), yani `skipIndex` ile başlık kimlikleri hiçbir zaman ayrı
     bir ayrıştırmaya bakmıyor. Dil yazının dili (`story.locale`). */
  const blocks = parseBlocks(story.bodyMd, story.locale);
  const figureIndex = storyFigureIndex(blocks);
  const figure = figureIndex < 0 ? null : (blocks[figureIndex] as StoryFigureBlock);
  const skipIndex = figure && figureRepeatsBlock(figure) ? figureIndex : undefined;
  const toc = tocOf(blocks);
  const hasToc = toc.length >= TOC_MIN;
  const hasCompanies = symbols.length > 0;
  const hasRail = hasToc || hasCompanies;
  const companyLabels = {
    relatedSymbols: t.stories.relatedSymbols,
    sinceEvent: t.stories.sinceEvent,
    lastClose: t.stories.lastClose,
    closeOn: t.stories.closeOn,
    moreCompaniesMany: t.stories.moreCompaniesMany,
  };

  return (
    <MotionExperience className={experience.article}>
    <ScrollProgress />
    <article className={detail.article} data-rail-companies={hasCompanies}>
      {/* Yazının iki denetimi aynı satırda: solda arşive çıkış, sağda
          paylaşım. Paylaş düğmesi metnin İÇİNE değil kenarına konuyor —
          okumayı kesen bir çağrı değil, elinin altında duran bir araç. İkisi
          de sessiz: sayfada ilk görülmesi gereken şey manşet. */}
      <div className={detail.utility}>
        <Link
          href="/mercek"
          className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft weight="bold" size={13} />
          {t.stories.backToList}
        </Link>
        <ShareButton
          url={absoluteUrl(`/mercek/${story.slug}`, locale)}
          title={story.title}
          labels={t.share}
        />
      </div>

      {/* KAPAK: manşet ve yazının kendi rakamları yan yana. Eski 720
          piksellik başlık 1440'ta 385 piksel tutuyordu; geniş kapak manşete
          ve yayımlanmış rakamlara ayrı yer veriyor. Şirket çipleri geniş
          ekranda rayda (getirileriyle) olduğu için burada gizli; kapak
          1440'ta bir satır kısalıyor. */}
      <SpotlightCard className={detail.coverSurface}>
      <header className={detail.cover} data-has-figure={Boolean(figure)}>
      <div className={detail.coverCopy} data-motion-intro>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-tiny">
          <span className="text-tiny font-semibold text-primary">
            {t.stories.eyebrow}
          </span>
          <span className="numeral text-muted">
            {formatEtDateLong(story.eventDate, locale)}
          </span>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <span className="numeral text-muted">{minutesLabel}</span>
        </p>

        <h1 className={detail.title}>
          {story.title}
        </h1>
        <p className={detail.dek}>{story.dek}</p>

        {/* Çeviri henüz yoksa orijinal gösterilir — ama bunu söyleyerek.
            Rutin iki dili art arda yazdığı için bu not kısa ömürlüdür. */}
        {story.locale !== locale && (
          <p className="w-fit rounded-full border border-line bg-surface-sunken px-3.5 py-1.5 text-small text-muted">
            {t.stories.fallbackNote}
          </p>
        )}

        {hasCompanies && <StorySymbols symbols={symbols} />}
      </div>
      {figure && <ScrollStage className={detail.coverFigure}>
        <StoryFigure block={figure} className={detail.figure} />
      </ScrollStage>}
      </header>
      </SpotlightCard>

      <ArticleJsonLd
        headline={story.title}
        description={story.dek}
        path={`/mercek/${story.slug}`}
        locale={locale}
        published={story.publishedAt}
      />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.nav.stories, path: "/mercek" },
          { name: story.title, path: `/mercek/${story.slug}` },
        ]}
      />

      <div className={detail.layout} data-rail={hasRail}>
        <div className={detail.mainCol}>
          {/* GÖVDE KENDİ DİLİNİ SÖYLÜYOR. Çevirisi olmayan yazı orijinal
              diliyle gösteriliyor (üstteki not bunu yazıyor) ama `lang`
              verilmediği için sayfalarca Türkçe metin `<html lang="en">`
              altında duruyordu: ekran okuyucu onu İngilizce fonetikle
              okuyor, tarayıcının "bu sayfayı çevir" önerisi de devreye
              girmiyordu. */}
          <div id="story-reading" data-motion-article lang={story.locale}>
            <ArticleBody
              markdown={story.bodyMd}
              blocks={blocks}
              locale={story.locale}
              variant="editorial"
              className={editorial.prose}
              skipIndex={skipIndex}
              afterLead={
                hasToc ? <MobileToc items={toc} lang={story.locale} t={t} /> : undefined
              }
            />
          </div>

          {/* ---- Künye ---- */}
          <footer id="story-sources" className={detail.sources}>
            {sources.length > 0 && (
              <>
                <div className={detail.sectionHead}>
                  <p className={detail.sectionTitle}>{t.stories.sources}</p>
                  <span className={detail.sectionMeta}>
                    {(sources.length === 1
                      ? t.stories.sourceCountOne
                      : t.stories.sourceCountMany
                    ).replace("{count}", String(sources.length))}
                  </span>
                </div>
                {/* HEDEF YÜKSEKLİĞİ GERÇEK, `.tap-44` DEĞİL: satır 56
                    piksel ve satırlar arasında boşluk yok, yani görünmez bir
                    genişletme komşu bağlantıyı örtemez (bilanço künyesinde
                    ölçülen hata). */}
                <ol className={detail.sourceList}>
                  {sources.map((source, index) => {
                    /* Adres /api/mercek üzerinden geliyor ve zod'un `.url()`
                       doğrulaması `javascript:` şemasını da geçiriyor; süzgeç
                       burada. Geçmeyen kaynak bağlantısız künye olarak kalır. */
                    const href = safeExternalUrl(source.url);
                    const { publisher, title } = splitSource(source.label, href);
                    const number = (
                      <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                    );
                    const copy = (
                      <span>
                        {publisher && <span className={detail.sourcePublisher}>{publisher}</span>}
                        <span className={detail.sourceTitle}>{title}</span>
                      </span>
                    );
                    return (
                      <li key={`${index}-${source.label}`}>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={detail.sourceLink}
                            aria-label={`${publisher ? `${publisher}: ` : ""}${title} (${t.stories.opensInNewTab})`}
                          >
                            {number}
                            {copy}
                            <ArrowUpRight size={14} weight="bold" aria-hidden />
                          </a>
                        ) : (
                          <span className={detail.sourceLink}>
                            {number}
                            {copy}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            <p className={detail.disclaimer}>{t.stories.disclaimer}</p>
          </footer>

          <MoreStories slug={slug} locale={locale} t={t} />
        </div>

        {hasRail && (
          <StoryRail
            items={hasToc ? toc : []}
            lang={story.locale}
            minutesLabel={minutesLabel}
            labels={{
              inThisArticle: t.stories.inThisArticle,
              tocLabel: t.stories.tocLabel,
              railLabel: t.stories.railLabel,
            }}
          >
            {hasCompanies && (
              <Suspense
                fallback={
                  <StoryCompaniesFallback
                    symbols={symbols}
                    locale={locale}
                    labels={companyLabels}
                  />
                }
              >
                <StoryCompanies
                  symbols={symbols}
                  eventDate={story.eventDate}
                  locale={locale}
                  labels={companyLabels}
                />
              </Suspense>
            )}
          </StoryRail>
        )}
      </div>
    </article>
    </MotionExperience>
  );
}
