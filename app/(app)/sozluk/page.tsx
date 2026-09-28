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
 * Kısa açıklama tanımın İLK CÜMLESİ: dizinde her terimin kartında,
 * sayfaya girmeden "doğru terim bu mu" sorusunu cevaplıyor.
 *
 * Öne çıkan terim YOK (29 Eylül, üçüncü tur). Atlas her kategoride
 * sözlüğün ağında en çok başvurulan üç terimi (`glossaryIncoming`) büyük
 * satırla, kalanı kapalı bir listede adla gösteriyordu. Artık yüz elli
 * terimin hepsi aynı kartta, tanımıyla açıkta (GlossaryBrowser); bir
 * sıralama ölçüsüne gerek kalmadı, kategori içi sıra alfabetik.
 *
 * Ölçü tek bir yerde geri döndü (29 Eylül, dördüncü tur): telefonda
 * kategoriler katlanıyor ve kapalı bölümün özet satırı "ROA, F/K, EPS…"
 * diye kategorinin en çok başvurulan üç terimini sayıyor
 * (`glossaryIncoming`, eşitlikte dizin sırası). Alfabetik ilk üç bir
 * kategoriyi tanıtmıyordu ("Aktif Kârlılığı, Borç/Özsermaye, Brüt Kâr").
 */

/** Katlanmış bölümün özetinde adı yazılan terim sayısı. */
const PREVIEW_TERMS = 3;
/** Parantez içindeki kısaltma: "Fiyat/Kazanç Oranı (F/K)" → "F/K". */
const ABBREVIATION = /\(([^()]+)\)\s*$/;

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
/** Bir günün milisaniyesi — günün terimi takvim gününden sayılıyor. */
const DAY_MS = 86_400_000;

export default async function GlossaryIndexPage() {
  const { locale, t } = await getI18n();
  const lang = locale === "en" ? "en" : "tr";
  const terms = glossaryTerms(locale);
  const collator = new Intl.Collator(lang, { sensitivity: "base" });

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

  const items: GlossaryBrowserItem[] = terms.map((term) => ({
    slug: term.slug,
    term: term.term,
    category: term.category,
    short: sentences(term.definition, 1),
    haystack: [term.term, term.slug, ...term.match]
      .map((part) => foldForSearch(part, locale))
      .join(" "),
    letter: letterOf(term.term),
  }));

  /* Alfabe + alfabe dışında kalan baş harfler (Türkçede W: "W-8BEN"). */
  const letters = [...new Set([...ALPHABET[lang], ...items.map((item) => item.letter)])].sort(
    collator.compare,
  );
  const incoming = glossaryIncoming();
  const groups = GLOSSARY_CATEGORIES.map((category) => {
    const members = terms.filter((term) => term.category === category.key);
    const preview = members
      .map((term, order) => ({ term, links: incoming.get(term.slug) ?? 0, order }))
      .sort((a, b) => b.links - a.links || a.order - b.order)
      .slice(0, PREVIEW_TERMS)
      .map(({ term }) => ABBREVIATION.exec(term.term)?.[1] ?? term.term);
    return {
      key: category.key,
      label: glossaryCategoryLabel(category.key, locale),
      count: members.length,
      preview: preview.join(", ") + (members.length > PREVIEW_TERMS ? "…" : ""),
    };
  });
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
          /* ANAHTAR ŞART (29 Eylül). Sunucudan prop olarak gelen öğe,
             istemcide kapağın çocuk dizisine (`HeroAccent`, kapak metni,
             günün terimi) giriyor ve RSC'den gelen öğe o dizide "statik"
             sayılmıyor: anahtarsız `hero` ve `spotlight` geliştirmede
             "Each child in a list should have a unique key" basıyordu
             (ikisi birlikte kapatılınca sustu, ölçüldü). */
          <div key="hero" className={`${styles.heroCopy} page-heading-copy`}>
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
          </div>
        }
        spotlight={
          <aside key="spotlight" aria-labelledby="sozluk-gunun-terimi" className={styles.spotlight}>
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
          openCategory: t.glossary.openCategory,
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
