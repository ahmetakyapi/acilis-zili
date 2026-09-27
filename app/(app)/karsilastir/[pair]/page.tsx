import { notFound } from "next/navigation";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { COMPARE_PAIRS, COMPARE_PAIR_SLUGS, comparePairBySlug } from "@/content/compare-pairs";
import { DEFAULT_COMPARE_RANGE, isCompareRange, type CompareRange } from "@/lib/compare";
import { getI18n } from "@/lib/i18n";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { CompareBoard, resolveCompareCurrency } from "../page";

/**
 * Küratörlü karşılaştırma çifti — `/karsilastir/nvda-amd`.
 *
 * AYNI TAHTA. `/karsilastir?semboller=NVDA,AMD` ile birebir aynı grafik,
 * şerit, tablo ve aralık denetimi; tahta karşılaştırma sayfasının kendi
 * bileşeni (`CompareBoard`), kopya değil. Farklar yalnızca bu sayfaya ait:
 * "Nvidia ve AMD" diyen bir başlık, tablonun altında kısa bir "neden bu
 * ikisi" paragrafı ve kendi künyesi.
 *
 * CANONICAL KENDİSİ. Aynı içerik `?semboller=` adresinde de açılıyor ama
 * o adres canonical'sız bir araç ekranı; aranan, paylaşılan ve bağlanan
 * adres bu. Aralık (`?aralik=1Y`) adreste kalabiliyor — denetim sığ
 * güncellemeyle yazıyor — ama canonical onu taşımıyor.
 *
 * Sembol eklemek ya da çıkarmak bu sayfadan `/karsilastir?semboller=…`
 * ekranına geçiriyor ve bu doğru: seçim artık küratörlü çift değil.
 */

export async function generateStaticParams() {
  return COMPARE_PAIR_SLUGS.map((pair) => ({ pair }));
}

function pairNames(names: readonly string[], joiner: string): string {
  return names.join(joiner);
}

export async function generateMetadata(props: PageProps<"/karsilastir/[pair]">) {
  const { pair: slug } = await props.params;
  const { locale, t } = await getI18n();
  const pair = comparePairBySlug(slug);
  if (!pair) return missingMetadata(locale);
  const names = pairNames(pair.names, t.pairs.joiner);
  return {
    title: t.pairs.metaTitle.replace("{names}", names),
    description: metaDescription(locale === "en" ? pair.introEn : pair.introTr),
    alternates: pageAlternates(`/karsilastir/${pair.slug}`, locale),
  };
}

export default async function ComparePairPage(props: PageProps<"/karsilastir/[pair]">) {
  const [{ pair: slug }, search] = await Promise.all([props.params, props.searchParams]);
  const { locale, t } = await getI18n();
  const pair = comparePairBySlug(slug);
  if (!pair) notFound();

  const range: CompareRange = isCompareRange(search.aralik) ? search.aralik : DEFAULT_COMPARE_RANGE;
  const { currency, realAvailable } = resolveCompareCurrency(search.para);
  const names = pairNames(pair.names, t.pairs.joiner);
  const others = COMPARE_PAIRS.filter((entry) => entry.slug !== pair.slug);

  return (
    <MotionExperience className={`${polish.page} ${polish.compare}`}>
      <ScrollProgress />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.compare.title, path: "/karsilastir" },
          { name: names, path: `/karsilastir/${pair.slug}` },
        ]}
      />
      <CompareBoard
        symbols={[...pair.symbols]}
        range={range}
        dropped={[]}
        currency={currency}
        realAvailable={realAvailable}
        heading={{
          eyebrow: t.pairs.eyebrow,
          title: t.pairs.title.replace("{names}", names),
          subtitle: t.pairs.subtitle,
        }}
      >
        <Panel>
          <PanelHeader title={t.pairs.introTitle} />
          <p className="border-t border-line px-4 py-4 text-read leading-[27px] text-body sm:px-5">
            {locale === "en" ? pair.introEn : pair.introTr}
          </p>
          {/* ÖTEKİ ÇİFTLER PANELİN İÇİNDE: okuyucunun bir sonraki sorusu
              çoğu zaman "peki şu ikisi" ve bu adresler başka hiçbir yerden
              bağlanmıyordu — iç bağlantı ağının bu ucu burası. */}
          <nav
            aria-label={t.pairs.others}
            className="flex flex-col gap-2.5 border-t border-line px-4 py-4 sm:px-5"
          >
            <p className="plate text-nano">{t.pairs.others}</p>
            <ul className="flex flex-wrap gap-2">
              {others.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/karsilastir/${entry.slug}`}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded-full bg-surface-elevated px-3 py-1.5 text-small font-semibold text-body transition-colors hover:text-primary sm:min-h-8"
                  >
                    {pairNames(entry.names, t.pairs.joiner)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Panel>
      </CompareBoard>
      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={[...pair.guides]}
        className="pt-1"
      />
    </MotionExperience>
  );
}
