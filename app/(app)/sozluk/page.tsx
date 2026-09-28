import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import {
  GlossaryBrowser,
  type GlossaryBrowserItem,
} from "@/components/glossary/GlossaryBrowser";
import styles from "@/components/glossary/Glossary.module.css";
import { TermMark } from "@/components/glossary/TermMark";
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_SLUGS,
  glossaryCategoryLabel,
  glossaryIncoming,
  glossaryTerms,
  type GlossarySlug,
} from "@/content/glossary";
import { GLOSSARY_MARKS } from "@/content/glossary/marks";
import { displayZone, zoneDateKey } from "@/lib/session-clock";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { foldForSearch } from "@/lib/search-fold";

export const generateMetadata = pageMetadata({
  path: "/sozluk",
  tr: {
    title: "Borsa Sözlüğü",
    description:
      "F/K'dan getiri eğrisine, RSI'dan W-8BEN'e: ABD borsalarını takip ederken karşına çıkan terimlerin kısa ve düz Türkçe tanımları.",
  },
  en: {
    title: "Market Glossary",
    description:
      "From P/E to the yield curve, RSI to W-8BEN: short, plain definitions of the terms you meet while following US markets.",
  },
});

/**
 * Sözlük dizini.
 *
 * KATEGORİYE GÖRE, harfe göre değil. Harf dizini bir kâğıt sözlüğün
 * alışkanlığı; burada okuyucunun sorusu çoğu zaman "bilançoda geçen şu
 * kelime" ya da "Fed'in şu terimi" — yani bağlam. Kategori içinde sıra
 * alfabetik (dilin kendi harf sırasıyla, `glossaryTerms`). Harf dizini yine
 * var ama bir SÜZGEÇ olarak, bölümleme olarak değil (GlossaryBrowser).
 *
 * Kısa açıklama tanımın İLK CÜMLESİ: dizinde her terimin yanında bir satır,
 * sayfaya girmeden "doğru terim bu mu" sorusunu cevaplıyor.
 *
 * ÖNE ÇIKANLAR ÖLÇÜLÜYOR, SEÇİLMİYOR: her kategoride sözlüğün kendi
 * ağında en çok başvurulan üç terim (`glossaryIncoming`). Eşitlikte dizin
 * sırası karar veriyor, yani seçim her derlemede aynı.
 */

/** Kategoride büyük kartla öne çıkan terim sayısı. */
const FEATURED_PER_CATEGORY = 3;
/** Öne çıkan kartta adı yazılan ilişkili terim sayısı. */
const FEATURED_RELATED = 3;

/** Dilin alfabesi — harf dizininin iskeleti; boş harfler sönük basılıyor. */
const ALPHABET = {
  tr: "ABCÇDEFGHIİJKLMNOÖPRSŞTUÜVYZ",
  en: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
} as const;

/** Tanımın ilk `count` cümlesi — nokta, soru ya da ünlemle biten parçalar. */
function sentences(text: string, count: number): string {
  const out: string[] = [];
  let rest = text;
  /* Nokta ancak ardından boşluk ya da metnin sonu geliyorsa cümle bitirir:
     "1.5" ya da "S&P 500'e." ortasından bölünmesin. */
  while (out.length < count && rest) {
    const match = /^(.+?[.!?])(?:\s+|$)/.exec(rest);
    if (!match) {
      out.push(rest);
      break;
    }
    out.push(match[1]);
    rest = rest.slice(match[0].length);
  }
  return out.join(" ");
}
/** Büyük kartta tanımdan kaç cümle. Kart iki satır boyu; bir cümle boş kalıyordu. */
const LEAD_SENTENCES = 2;
/** Bir günün milisaniyesi — günün terimi takvim gününden sayılıyor. */
const DAY_MS = 86_400_000;

export default async function GlossaryIndexPage() {
  const { locale, t } = await getI18n();
  const lang = locale === "en" ? "en" : "tr";
  const terms = glossaryTerms(locale);
  const incoming = glossaryIncoming();
  const names = new Map(terms.map((term) => [term.slug, term.term]));
  const collator = new Intl.Collator(lang, { sensitivity: "base" });

  /* Öne çıkma sırası: kategori içinde bağlantı sayısına göre ilk üç. */
  const featuredRank = new Map<GlossarySlug, number>();
  for (const category of GLOSSARY_CATEGORIES) {
    terms
      .filter((term) => term.category === category.key)
      .map((term, order) => ({ slug: term.slug, links: incoming.get(term.slug) ?? 0, order }))
      .sort((a, b) => b.links - a.links || a.order - b.order)
      .slice(0, FEATURED_PER_CATEGORY)
      .forEach((entry, index) => featuredRank.set(entry.slug, index + 1));
  }

  /* GÜNÜN TERİMİ (28 Eylül, ikinci tur). Kapağın sağ yarısı kategori
     kutucuklarını taşıyordu; onlar kapağın altına bir şeride indi ve yerini
     bir editoryal giriş aldı. Seçim bir editör tercihi değil, bir SAAT:
     okuyucunun takvim günü (TR önce, `displayZone`) terim listesinin
     uzunluğuna bölünüyor, yani yüz elli günde her terim bir kez sahneye
     çıkıyor ve aynı gün her okuyucu aynı terimi görüyor. Sıra dizin
     sırası değil yapı sırası (`GLOSSARY_SLUGS`): alfabetik sırada art arda
     günler aynı harfe düşüyordu. Sayfa zaten isteğe göre çiziliyor (dil
     çerezi), gün değişince terim de değişiyor. */
  const zone = displayZone(locale);
  const now = new Date();
  const dayNumber = Math.floor(Date.parse(`${zoneDateKey(now, zone)}T00:00:00Z`) / DAY_MS);
  const todaySlug = GLOSSARY_SLUGS[dayNumber % GLOSSARY_SLUGS.length];
  const today = terms.find((term) => term.slug === todaySlug) ?? terms[0];
  const todayLabel = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", timeZone: zone }).format(now);

  const letterOf = (term: string) => term.charAt(0).toLocaleUpperCase(lang);

  const items: GlossaryBrowserItem[] = terms.map((term) => {
    const featured = featuredRank.get(term.slug) ?? 0;
    return {
      slug: term.slug,
      term: term.term,
      category: term.category,
      short: sentences(term.definition, 1),
      lede: featured === 1 ? sentences(term.definition, LEAD_SENTENCES) : undefined,
      haystack: [term.term, term.slug, ...term.match]
        .map((part) => foldForSearch(part, locale))
        .join(" "),
      letter: letterOf(term.term),
      motif: GLOSSARY_MARKS[term.slug],
      links: incoming.get(term.slug) ?? 0,
      featured,
      related:
        featured > 0
          ? term.related
              .slice(0, FEATURED_RELATED)
              .map((slug) => names.get(slug))
              .filter((name): name is string => Boolean(name))
          : [],
    };
  });

  /* Alfabe + alfabe dışında kalan baş harfler (Türkçede W: "W-8BEN"). */
  const letters = [...new Set([...ALPHABET[lang], ...items.map((item) => item.letter)])].sort(
    collator.compare,
  );
  const groups = GLOSSARY_CATEGORIES.map((category) => ({
    key: category.key,
    label: glossaryCategoryLabel(category.key, locale),
    count: terms.filter((term) => term.category === category.key).length,
  }));
  const linkTotal = terms.reduce((sum, term) => sum + term.related.length, 0);

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: t.glossary.title, path: "/sozluk" }]} />
      <GlossaryBrowser
        items={items}
        groups={groups}
        letters={letters}
        locale={locale}
        hero={
          <>
            <p className="page-eyebrow">{t.glossary.eyebrow}</p>
            <h1 className="display-ink">{t.glossary.title}</h1>
            <p>{t.glossary.subtitle}</p>
            <dl className={styles.metrics}>
              <div>
                <dt>{t.glossary.metricTerms}</dt>
                <dd className="numeral">{terms.length}</dd>
              </div>
              <div>
                <dt>{t.glossary.metricCategories}</dt>
                <dd className="numeral">{groups.length}</dd>
              </div>
              <div>
                <dt>{t.glossary.metricLinks}</dt>
                <dd className="numeral">{linkTotal}</dd>
              </div>
            </dl>
          </>
        }
        spotlight={
          <aside aria-labelledby="sozluk-gunun-terimi" className={styles.spotlight}>
            <div className={styles.spotlightPlate}>
              <TermMark motif={GLOSSARY_MARKS[today.slug]} size="plate" draw />
            </div>
            <div className={styles.spotlightCopy}>
              <h2 id="sozluk-gunun-terimi" className={styles.spotlightKicker}>
                <Sparkle aria-hidden size={14} weight="fill" />
                {t.glossary.spotlight}
                <time dateTime={zoneDateKey(now, zone)}>{todayLabel}</time>
              </h2>
              <p className={styles.spotlightTerm}>{today.term}</p>
              <p className={styles.spotlightLede}>{sentences(today.definition, 1)}</p>
              <p className={styles.spotlightMeta}>
                <Link href={`/sozluk/${today.slug}`} prefetch={false} className={styles.spotlightLink}>
                  {t.glossary.readDefinition}
                  <ArrowRight aria-hidden size={15} weight="bold" />
                </Link>
                <span>{glossaryCategoryLabel(today.category, locale)}</span>
              </p>
            </div>
          </aside>
        }
        labels={{
          filterLabel: t.glossary.filterLabel,
          filterPlaceholder: t.glossary.filterPlaceholder,
          categoryLabel: t.glossary.categoryLabel,
          allCategories: t.glossary.allCategories,
          noResults: t.glossary.noResults,
          noResultsHint: t.glossary.noResultsHint,
          count: t.glossary.count,
          letterLabel: t.glossary.letterLabel,
          clear: t.glossary.clear,
          clearQuery: t.glossary.clearQuery,
          links: t.glossary.links,
          openCategory: t.glossary.openCategory,
          moreTerms: t.glossary.moreTerms,
          scrollPrev: t.common.scrollPrev,
          scrollNext: t.common.scrollNext,
        }}
      />
      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["hisse-senedi", "bilanco"]}
      />
    </MotionExperience>
  );
}
