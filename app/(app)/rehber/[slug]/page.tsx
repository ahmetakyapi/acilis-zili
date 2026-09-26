import { InkCanvas } from "@/components/ink/InkCanvas";
import { MotionExperience, ScrollProgress, SpotlightCard } from "@/components/motion/PremiumMotion";
import experience from "@/components/motion/EditorialExperience.module.css";
import editorial from "@/components/article/ArticleEditorial.module.css";
import detail from "@/components/stories/StoryDetail.module.css";
import { notFound } from "next/navigation";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  ArticleBody,
  parseBlocks,
  readingMinutes,
  sectionIndex,
} from "@/components/article/ArticleBody";
import { ShareButton } from "@/components/article/ShareButton";
import { LevelBadge } from "@/components/article/LevelBadge";
import { GlyphTile } from "@/components/article/GlyphTile";
import { Panel } from "@/components/ui/primitives";
import {
  GUIDE_SLUGS,
  guideArticle,
  guideArticles,
  guideTopicLabel,
  type GuideArticle,
} from "@/content/guide";
import { getI18n, type Dictionary } from "@/lib/i18n";
import { articleOpenGraph, metaDescription } from "@/lib/page-meta";
import { absoluteUrl, pageAlternates } from "@/lib/site";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";

/**
 * Rehber yazısı.
 *
 * Yan kolon yok — dikkat dağıtacak bir ölçüm kartı burada bilinçli olarak
 * bulunmuyor. Yazının iki ölçüsü mercekle aynı (StoryDetail.module.css):
 * kapak 1040, altındaki her şey tek bir 50rem'lik sütunda.
 *
 * KÜNYE BİR DÖNEM "(68ch)" DİYORDU, O SAYI YANLIŞTI. `<article>` 720
 * pikselken Chrome'da ölçülen değer satır başına 97 KARAKTER (rehber 97,3 ·
 * mercek 98,3). Fark `ch` biriminden geliyor: `ch` "0" glifinin genişliği,
 * ortalama harfin değil, ve Schibsted Grotesk'te "0" ortalama harften
 * belirgin geniş. Yani 720px "85ch" görünüyor ama 97 karakter taşıyor.
 *
 * DARALTMA DENENDİ VE GERİ ALINDI — dördüncü bir deneme yapılmasın.
 * Düz metin 520 piksele çekilip veri blokları 720'de bırakıldı; ölçüm
 * hedefi tutturuyordu (97 → 75,3 / 73,4) ama görsel sonuç beğenilmedi:
 * metin 520'de bitip kutular 720'ye kadar gidince sağ kenar tırtıklı
 * kalıyor ve kasıtlı bir editoryal düzenden çok hizasızlık gibi okunuyor.
 * Mercekte aynı hata 23 Eylül'de bir kez daha yapıldı (metin 42rem, kutular
 * 52rem) ve aynı gerekçeyle geri alındı.
 *
 * ÇÖZÜM ÖLÇÜYÜ PUNTOYLA KURMAK (23 Eylül). 720 piksellik sütun 1440'ta iki
 * yanda 360'ar piksel boş zemin bırakıyordu (sahibi: "sağdan soldan çok
 * boşluk var") ve 16 puntoda 97 harf taşıyordu — hem dar hem uzun satırlı.
 * Sütun 50rem'e çıktı, punto 20'ye: satır ~88 harf, kutular ve metin aynı
 * iki kenarda. Gövde mercekle aynı editoryal çizimi kullanıyor (numaralı
 * ara başlıklar, bloklar tonla ayrışan yüzeyde); `:::` bloklarının `sm:`
 * düzenleri 800 pikselde rahat.
 *
 * Kapağın sağında "Bu Yazıda": yazının bölümleri numaralı, bağlantılı. Kısa
 * bir kavram yazısında okuyucunun ilk sorusu "neyi anlatıyor"; bölüm adları
 * bunu dek cümlesinden daha somut söylüyor ve kapaktaki boş sağ yarıyı
 * işe yarar bir şeyle dolduruyor.
 *
 * Sayfa sonunda müfredat gezinmesi var: rehber sıralı bir okuma listesi ve
 * bir yazıyı bitiren okuyucunun en olası sorusu "sırada ne var". İlişkili
 * yazılar (konusal komşuluk) ile önceki/sıradaki (müfredat komşuluğu) ayrı
 * şeyler söylüyor, ikisi de duruyor.
 */

/** Üçten az bölümlü yazıda içindekiler gürültü; kapak tek sütun kalır. */
const TOC_MIN = 3;

export async function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/rehber/[slug]">) {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const article = guideArticle(slug, locale);
  if (!article) return {};
  return {
    title: article.title,
    description: metaDescription(article.dek),
    /* CANONICAL VE HREFLANG. Dinamik sayfalar künyelerini elden yazıyor ve
       `alternates` bloğunu hiç vermiyorlardı: sitenin en kalabalık
       adresleri (yüzlerce hisse, her yazı, her analiz) canonical'sız ve
       "öteki dildeki karşılığı şu" bilgisi olmadan yayımlanıyordu. Kök
       layout canonical yazmıyor (orada gerekçesi var), yani miras da yok.
       `pageAlternates` RSS keşif etiketini de birlikte taşıyor. */
    /* REHBERDE DİL LİSTESİ VERİLMİYOR ve bu doğru: rehber içeriği depoda üç
       katmanlı (meta + tr + en) ve eksik çeviri DERLEMEYİ KIRIYOR. Yani her
       rehber yazısının iki dili de her zaman var; koşulsuz `hreflang` burada
       yanlış bir vaat değil. Eksik çeviri yalnızca veritabanından gelen
       içerikte olabiliyor (mercek, bilanço analizi). */
    alternates: pageAlternates(`/rehber/${slug}`, locale),
    /* Yazı, "website" değil: gerekçe mercek sayfasında. Blok
       `articleOpenGraph`tan — kökteki `siteName` ve `locale` düşmesin diye. */
    openGraph: articleOpenGraph(locale),
  };
}

export default async function GuideArticlePage(
  props: PageProps<"/rehber/[slug]">,
) {
  const { slug } = await props.params;
  const { locale, t } = await getI18n();
  const article = guideArticle(slug, locale);
  if (!article) notFound();

  const related = article.related
    .map((key) => guideArticle(key, locale))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  /* Müfredat komşuları — sıra meta.ts'teki dizilişten gelir. */
  const all = guideArticles(locale);
  const position = all.findIndex((entry) => entry.slug === article.slug);
  const prev = position > 0 ? all[position - 1] : null;
  const next = position < all.length - 1 ? all[position + 1] : null;

  const blocks = parseBlocks(article.bodyMd, locale);
  const sections = sectionIndex(blocks);
  const hasToc = sections.length >= TOC_MIN;

  return (
    <MotionExperience className={experience.article}>
    <ScrollProgress />
    <article className={detail.article}>
      <ArticleJsonLd
        headline={article.title}
        description={article.dek}
        path={`/rehber/${article.slug}`}
        locale={locale}
      />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.nav.guide, path: "/rehber" },
          { name: article.title, path: `/rehber/${article.slug}` },
        ]}
      />
      {/* Mercek yazılarıyla aynı denetim satırı: solda listeye çıkış, sağda
          paylaşım. Rehber yazıları sitenin en çok paylaşılabilir metinleri —
          bir kavramı anlatıyorlar ve bağlantısı bir cevap olarak
          gönderiliyor. */}
      <div className={detail.utility}>
        <Link
          href="/rehber"
          className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft weight="bold" size={13} />
          {t.guide.backToList}
        </Link>
        <ShareButton
          url={absoluteUrl(`/rehber/${article.slug}`, locale)}
          title={article.title}
          labels={t.share}
        />
      </div>

      <SpotlightCard className={detail.coverSurface}>
        <header className={detail.cover} data-has-aside={hasToc}>
          <div className={detail.coverCopy} data-motion-intro>
            <div className="flex items-center gap-3.5">
              <GlyphTile glyph={article.glyph} size={48} />
              <div className="min-w-0">
                <p className="text-tiny font-semibold text-primary">
                  {guideTopicLabel(article.topic, locale)}
                </p>
                {/* Zorluk ile okuma süresi aynı satırda: ikisi de "bu yazıya
                    girmeye hazır mıyım" sorusunun parçası — biri hazırlığı,
                    öteki zamanı ölçüyor. */}
                <p className="mt-1.5 flex flex-wrap items-center gap-2">
                  <LevelBadge level={article.level} locale={locale} />
                  <span className="numeral text-small text-muted">
                    {readingMinutes(article.bodyMd)} {t.guide.readMinutes}
                  </span>
                </p>
              </div>
            </div>
            <h1 data-ink="lines" className={detail.title}><span className="ink-line">{article.title}</span></h1>
            <p className={detail.dek}>{article.dek}</p>
          </div>
          {hasToc && (
            <nav className={detail.coverToc} aria-label={t.stories.tocLabel}>
              <p>{t.stories.inThisArticle}</p>
              <ol lang={locale}>
                {sections.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>
                      <span aria-hidden>{String(item.number).padStart(2, "0")}</span>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </header>
      </SpotlightCard>

      <div className={detail.layout}>
      <div className={detail.mainCol}>
      <div data-motion-article>
        <ArticleBody
          markdown={article.bodyMd}
          blocks={blocks}
          locale={locale}
          variant="editorial"
          className={editorial.prose}
        />
        {/* YAZININ SONU: iki fırça çizgisi ortada buluşuyor ve araya
            pirinç bir zil basılıyor (lib/ink/scenes.ts → storyEnd).
            Okuyucu gövdenin dibine indiğinde çiziliyor; aşağıdaki ilgili
            yazılar yazının parçası değil, EKİ. Gövdenin kabında
            duruyor ki sütunun 56'lık aralığı ikinci kez eklenmesin. */}
        <InkCanvas scene="storyEnd" seed={13} className="mx-auto mt-8 block h-15 w-60" />
      </div>

      {related.length > 0 && (
        <section className="flex flex-col gap-3">
          {/* Başlık metnin hattında (kartın iç payı kadar içeride); kartlar
              kapakla aynı kenarda. */}
          <h2 className="display-ink display-ink-tight ml-(--read-inset) w-fit text-read font-bold">
            {t.guide.related}
          </h2>
          {/* Bağlantılardaki min-w-0: içerideki `truncate` nowrap demek, o da
              ızgara hücresinin min-content genişliğini metnin tamamına
              çıkarıyor ve sayfayı yana taşırıyordu. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((entry) => (
              <Link
                key={entry.slug}
                href={`/rehber/${entry.slug}`}
                prefetch
                className="min-w-0"
              >
                <Panel className="panel-hover flex h-full items-center gap-3 p-4">
                  <GlyphTile glyph={entry.glyph} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-strong">
                      {entry.title}
                    </span>
                    <span className="mt-0.5 block truncate text-small text-muted">
                      {entry.dek}
                    </span>
                  </span>
                  <ArrowRight
                    weight="bold"
                    size={14}
                    className="shrink-0 text-primary"
                  />
                </Panel>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(prev || next) && (
        <nav className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {prev ? (
            <CurriculumStep
              article={prev}
              label={t.guide.prevArticle}
              direction="prev"
            />
          ) : (
            <span aria-hidden className="hidden sm:block" />
          )}
          {next && (
            <CurriculumStep
              article={next}
              label={t.guide.nextArticle}
              direction="next"
            />
          )}
        </nav>
      )}
      </div>
      </div>
    </article>
    </MotionExperience>
  );
}

function CurriculumStep({
  article,
  label,
  direction,
}: {
  article: GuideArticle;
  label: Dictionary["guide"]["prevArticle"];
  direction: "prev" | "next";
}) {
  const next = direction === "next";
  return (
    <Link href={`/rehber/${article.slug}`} prefetch className="min-w-0">
      <Panel
        className={`panel-hover flex h-full items-center gap-3 p-4 ${next ? "text-right" : ""}`}
      >
        {!next && (
          <ArrowLeft weight="bold" size={14} className="shrink-0 text-primary" />
        )}
        <span className={`min-w-0 flex-1 ${next ? "order-first" : ""}`}>
          <span className="plate text-nano">{label}</span>
          <span className="mt-1 block truncate text-base font-bold text-strong">
            {article.title}
          </span>
        </span>
        {next && (
          <ArrowRight
            weight="bold"
            size={14}
            className="shrink-0 text-primary"
          />
        )}
      </Panel>
    </Link>
  );
}
