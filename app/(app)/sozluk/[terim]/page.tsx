import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import { HeroAccent } from "@/components/motion/HeroAccent";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArticleBody } from "@/components/article/ArticleBody";
import { GlyphTile } from "@/components/article/GlyphTile";
import { GuideHint } from "@/components/article/GuideHint";
import { GLOSSARY_CATEGORY_ICONS } from "@/components/glossary/category-icons";
import styles from "@/components/glossary/Glossary.module.css";
import { ConceptVisual, TermNetwork } from "@/components/glossary/TermVisuals";
import { BreadcrumbJsonLd, DefinedTermJsonLd } from "@/components/seo/JsonLd";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import {
  GLOSSARY_SLUGS,
  glossaryCategoryLabel,
  glossaryGlyph,
  glossaryIncoming,
  glossaryNeighbors,
  glossaryTerm,
} from "@/content/glossary";
import { GLOSSARY_VISUALS } from "@/content/glossary/visuals";
import { getI18n } from "@/lib/i18n";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { articleAutoLinker } from "@/lib/autolink-data";

/**
 * Sözlük terimi.
 *
 * Sayfa kısa ve bilerek öyle: başlık, tanım, varsa örnek, ilişkili terimler
 * ve kavramı uzun anlatan rehber yazısı. Yazılardaki otomatik bağlantı bu
 * sayfaya iniyor; okuyucu tanımı okuyup yazısına dönmeli, burada ikinci bir
 * makaleye takılmamalı.
 *
 * TANIMIN İLK CÜMLESİ DISPLAY PUNTOSUNDA (28 Eylül). Sayfaya gelen okuyucu
 * tek bir şey soruyor: "bu ne demek". İlk cümle o sorunun cevabı; kapağın
 * içinde, başlığın hemen altında ve büyük. Geri kalan cümleler (nasıl
 * okunur, nerede yanıltır) gövde puntosunda ve `ArticleBody` ile, yani
 * içlerindeki BAŞKA terimler bağlanıyor (terimin kendisi hariç —
 * `excludeTerm`). Sözlük böylece kendi içinde gezilebilir bir ağ.
 *
 * ÖRNEK ÇİZİLİYOR, UYDURULMUYOR. Örneği çizilebilen terimlerde yazıların
 * `:::` blokları (`content/glossary/visuals.ts`): her sayı örnek metninden
 * aynen geliyor ve bunu bir test denetliyor. Getiri eğrisi ve RSI gibi
 * şekli olan kavramlarda sayısız bir kavram çizimi. Hiçbiri yoksa panel
 * yalnızca örnek metnini taşıyor.
 *
 * İKİ DİL DE HER ZAMAN VAR: içerik `Record<GlossarySlug, …>` tipinde ve
 * eksik çeviri derlemeyi kırıyor, o yüzden `hreflang` koşulsuz (rehberle
 * aynı gerekçe).
 */

export async function generateStaticParams() {
  return GLOSSARY_SLUGS.map((terim) => ({ terim }));
}

export async function generateMetadata(props: PageProps<"/sozluk/[terim]">) {
  const { terim } = await props.params;
  const { locale, t } = await getI18n();
  const term = glossaryTerm(terim, locale);
  if (!term) return missingMetadata(locale);
  return {
    title: t.glossary.metaTitle.replace("{term}", term.term),
    description: metaDescription(term.definition),
    alternates: pageAlternates(`/sozluk/${term.slug}`, locale),
  };
}

/** Tanımı ilk cümle ve geri kalanı olarak böler. */
function splitLede(text: string): { lede: string; rest: string } {
  const match = /^(.+?[.!?])(?:\s+|$)/.exec(text);
  if (!match) return { lede: text, rest: "" };
  return { lede: match[1], rest: text.slice(match[0].length).trim() };
}

export default async function GlossaryTermPage(props: PageProps<"/sozluk/[terim]">) {
  const { terim } = await props.params;
  const { locale, t } = await getI18n();
  const term = glossaryTerm(terim, locale);
  if (!term) notFound();

  const lang = locale === "en" ? "en" : "tr";
  const related = term.related
    .map((slug) => glossaryTerm(slug, locale))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const { previous, next } = glossaryNeighbors(term.slug, locale);
  const links = glossaryIncoming().get(term.slug) ?? 0;
  const { lede, rest } = splitLede(term.definition);
  const autoLink = await articleAutoLinker(locale, { excludeTerm: term.slug });
  const categoryLabel = glossaryCategoryLabel(term.category, locale);
  const CategoryIcon = GLOSSARY_CATEGORY_ICONS[term.category];
  const visual = GLOSSARY_VISUALS[term.slug];
  const hasExamplePanel = Boolean(term.example || visual);

  return (
    <MotionExperience className={polish.page}>
      <DefinedTermJsonLd
        name={term.term}
        description={term.definition}
        path={`/sozluk/${term.slug}`}
        setName={t.glossary.title}
        setPath="/sozluk"
        locale={locale}
      />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.glossary.title, path: "/sozluk" },
          { name: term.term, path: `/sozluk/${term.slug}` },
        ]}
      />
      <Link
        href="/sozluk"
        className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {t.glossary.backToList}
      </Link>

      {/* KAPAK: künye (kategori), ad, kavramın karosu ve tanım. Tanım
          kapağın İÇİNDE: ayrı bir "Tanım" paneli başlığın altında ikinci
          bir başlangıç gibi duruyordu. */}
      <header className={`${styles.termHero} page-frame`}>
        <HeroAccent />
        <div className={`${styles.termHeading} page-heading-copy`}>
          <p className="page-eyebrow">
            <CategoryIcon aria-hidden size={15} weight="bold" />
            {categoryLabel}
          </p>
          <h1 className="display-ink">{term.term}</h1>
        </div>
        <GlyphTile glyph={glossaryGlyph(term.term, locale)} size={64} className={styles.termGlyph} />
        <div className={styles.termDefinition}>
          <p className={styles.lede}>{lede}</p>
          {rest && (
            <ArticleBody markdown={rest} locale={locale} autoLink={autoLink} className={styles.restBody} />
          )}
        </div>
      </header>

      {hasExamplePanel && (
        <Panel className={styles.examplePanel}>
          <PanelHeader
            title={term.example ? t.glossary.example : t.glossary.conceptTitle}
            meta={visual?.kind === "concept" ? t.glossary.conceptNote : undefined}
          />
          <div className={styles.exampleBody}>
            {visual?.kind === "blocks" && (
              <ArticleBody markdown={visual[lang]} locale={locale} className={styles.exampleVisual} />
            )}
            {visual?.kind === "concept" && (
              <ConceptVisual
                concept={visual.concept}
                focus={visual.focus}
                labels={t.glossary.concept}
                title={`${term.term}: ${t.glossary.conceptNote}`}
              />
            )}
            {term.example && (
              <div className={styles.exampleBox}>
                <Lightbulb aria-hidden size={20} weight="duotone" />
                <ArticleBody markdown={term.example} locale={locale} autoLink={autoLink} />
              </div>
            )}
          </div>
        </Panel>
      )}

      {related.length > 0 && (
        <Panel>
          <PanelHeader
            title={t.glossary.related}
            meta={links > 0 ? t.glossary.links.replace("{count}", String(links)) : undefined}
          />
          <nav aria-label={t.glossary.related} className={styles.networkWrap}>
            <TermNetwork
              center={term.term}
              glyph={glossaryGlyph(term.term, locale)}
              nodes={related.map((entry) => ({
                slug: entry.slug,
                term: entry.term,
                glyph: glossaryGlyph(entry.term, locale),
                category:
                  entry.category === term.category
                    ? null
                    : glossaryCategoryLabel(entry.category, locale),
              }))}
            />
          </nav>
        </Panel>
      )}

      {(previous || next) && (
        /* Kategorideki komşular — dizindeki sırayla. Uçta olmayan yön
           boş bırakılıyor ama hücresi duruyor: "Sonraki" her zaman sağda. */
        <nav aria-label={t.glossary.neighbors} className={styles.neighbors}>
          {previous ? (
            <Link href={`/sozluk/${previous.slug}`} prefetch={false} className={styles.neighbor} data-side="previous">
              <ArrowLeft aria-hidden size={18} weight="bold" className={styles.neighborArrow} />
              <span className="min-w-0">
                <span className={styles.neighborLabel}>{t.glossary.previous}</span>
                <span className={styles.neighborTerm}>{previous.term}</span>
              </span>
            </Link>
          ) : (
            <span aria-hidden />
          )}
          {next && (
            <Link href={`/sozluk/${next.slug}`} prefetch={false} className={styles.neighbor} data-side="next">
              <span className="min-w-0">
                <span className={styles.neighborLabel}>{t.glossary.next}</span>
                <span className={styles.neighborTerm}>{next.term}</span>
              </span>
              <ArrowRight aria-hidden size={18} weight="bold" className={styles.neighborArrow} />
            </Link>
          )}
        </nav>
      )}

      {term.guides.length > 0 && (
        <GuideHint label={t.glossary.guide} locale={locale} slugs={term.guides} />
      )}
    </MotionExperience>
  );
}
