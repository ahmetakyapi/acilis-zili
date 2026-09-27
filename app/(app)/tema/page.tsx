import { Suspense } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { ScaleBar } from "@/components/markets/CompareScale";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { DataStamp, PageHeader, Panel } from "@/components/ui/primitives";
import { THEMES, themeDek, themeTitle } from "@/content/themes";
import { scaleRatios } from "@/lib/compare";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { median, sameSessionMoves } from "@/lib/theme-stats";
import { katilimMembers, katilimPool, themeRow } from "@/lib/themes-data";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/tema",
  tr: {
    title: "Tematik Hisse Listeleri",
    description:
      "Yapay zekâ, yarı iletkenler, siber güvenlik, nükleer enerji, uzay ve daha fazlası: temaya göre gruplanmış ABD hisseleri ve günün medyan hareketi.",
  },
  en: {
    title: "Thematic Stock Lists",
    description:
      "AI, semiconductors, cybersecurity, nuclear power, space and more: US stocks grouped by theme, with the day's median move.",
  },
});

/**
 * Temalar dizini — her tema bir kart, kartta günün medyan hareketi.
 *
 * TEK KOTASYON ÇAĞRISI: bütün temaların üyeleri tek anahtarda soruluyor
 * (`getQuotes` sıralı sembol dizesiyle önbellekli). NVDA üç temada birden
 * duruyor; üç ayrı çağrı üç ayrı fiyat anı demekti ve aynı hisse aynı
 * ekranda üç medyana üç farklı yüzdeyle girebilirdi.
 *
 * Medyanlar kartlar arasında bir de ÇİZGİ olarak okunuyor (ekran kuralı:
 * karşılaştırılan büyüklük). Çubuk yalnızca AYNI SEANSI anlatan medyanlar
 * arasında kuruluyor; son kapanışa kalmış bir temanın medyanı bu seansın
 * medyanlarıyla aynı ölçeğe konmuyor.
 */
export default async function ThemesIndexPage() {
  const { locale, t } = await getI18n();

  /* SAYFA KOTASYONU BEKLEMİYOR (28 Eylül, ölçüldü). Dizin önce bütün
     temaların medyanını hesaplayıp sonra çiziyordu: soğuk önbellekte
     yaklaşık 150 sembolün kotasyonu ve Katılım havuzunun Finnhub taraması
     bitmeden tek bayt gitmiyordu, ilk bayt 1,5 saniye. Kartların metni
     durağan (content/themes.ts); yalnızca medyan veriye bağlı. Yedek AYNI
     ızgarayı sayısız basıyor, sayılar akışla iniyor ve kartlar yerinden
     oynamıyor. */
  const placeholders: ThemeCard[] = THEMES.map((theme) => ({
    theme,
    count: theme.symbols === "katilim" ? null : theme.symbols.length,
    basis: null,
    median: null,
  }));

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: t.themes.title, path: "/tema" }]} />
      <PageHeader
        eyebrow={t.themes.eyebrow}
        title={t.themes.title}
        subtitle={t.themes.subtitle}
      />

      <Suspense
        fallback={
          <ThemeCardGrid cards={placeholders} ratios={placeholders.map(() => null)} signed={false} locale={locale} t={t} />
        }
      >
        <LiveThemeCards locale={locale} t={t} />
      </Suspense>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["sektor-rotasyonu", "cesitlendirme"]}
      />
    </MotionExperience>
  );
}

type ThemeCard = {
  theme: (typeof THEMES)[number];
  /** Katılım listesi taranana kadar üye sayısı bilinmiyor. */
  count: number | null;
  basis: "session" | "lastClose" | null;
  median: number | null;
};

async function LiveThemeCards({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  const pool = await katilimPool();

  const all = [
    ...new Set(THEMES.flatMap((theme) => (theme.symbols === "katilim" ? pool : [...theme.symbols]))),
  ];
  const [quotesResult, names] = await Promise.all([
    getQuotes(all, status),
    getSymbolNames(all),
  ]);
  const quotes = quotesResult.ok ? quotesResult.data : {};

  const cards: ThemeCard[] = await Promise.all(
    THEMES.map(async (theme) => {
      const members =
        theme.symbols === "katilim"
          ? await katilimMembers(pool, quotes, names)
          : [...theme.symbols];
      const moves = sameSessionMoves(members.map((symbol) => themeRow(symbol, quotes, names, status)));
      return {
        theme,
        count: members.length,
        basis: moves?.basis ?? null,
        median: moves ? median(moves.values) : null,
      };
    }),
  );

  const sessionCount = cards.filter((card) => card.basis === "session").length;
  const scaleBasis = sessionCount > 0 ? "session" : "lastClose";
  const scale = scaleRatios(
    cards.map((card) => (card.basis === scaleBasis ? card.median : null)),
  );

  return (
    <>
      <ThemeCardGrid cards={cards} ratios={scale.ratios} signed={scale.signed} locale={locale} t={t} />
      {quotesResult.ok ? (
        <DataStamp
          labels={t.data}
          source={quotesResult.source}
          at={quotesResult.fetchedAt}
          stale={quotesResult.stale}
          locale={locale}
        />
      ) : (
        <p className="text-small text-muted">{t.themes.quotesUnavailable}</p>
      )}
    </>
  );
}

function ThemeCardGrid({
  cards,
  ratios,
  signed,
  locale,
  t,
}: {
  cards: ThemeCard[];
  ratios: readonly (number | null | undefined)[];
  signed: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" data-motion-stagger>
      {cards.map((card, index) => {
        const ratio = ratios[index];
        return (
          <li key={card.theme.slug} className="min-w-0">
            <Link href={`/tema/${card.theme.slug}`} prefetch={false} className="block h-full min-w-0">
              <Panel className="panel-hover flex h-full flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lead font-bold tracking-[-0.02em] text-strong">
                    {themeTitle(card.theme, locale)}
                  </h2>
                  <ArrowRight weight="bold" size={14} className="mt-1.5 shrink-0 text-primary" aria-hidden />
                </div>
                <p className="text-small leading-relaxed text-body">{themeDek(card.theme, locale)}</p>
                {/* Künye satırı kartın dibinde: iki kart yan yana
                    durduğunda sayılar aynı hatta bitsin. */}
                <div className="mt-auto flex items-end justify-between gap-3 border-t border-line-soft pt-3">
                  <span className="text-tiny text-muted">
                    {card.count === null
                      ? NO_VALUE
                      : t.themes.companies.replace("{count}", String(card.count))}
                  </span>
                  <span className="min-w-[96px] text-right">
                    <span className="block text-nano text-muted">
                      {t.themes.median}
                      {card.basis === "lastClose" ? ` · ${t.themes.medianLastClose}` : ""}
                    </span>
                    <span
                      className={cn(
                        "numeral block text-base font-bold",
                        card.median === null
                          ? "text-muted"
                          : card.basis === "lastClose"
                            ? "text-body"
                            : directionText(directionOf(card.median)),
                      )}
                    >
                      {card.median === null ? NO_VALUE : formatPercent(card.median, locale)}
                    </span>
                    {ratio != null && <ScaleBar ratio={ratio} signed={signed} tone="signal" />}
                  </span>
                </div>
              </Panel>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
