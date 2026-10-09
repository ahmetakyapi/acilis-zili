import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { MiniDial } from "@/components/screening/ScreenVisuals";
import styles from "@/components/screening/Screening.module.css";
import { LogoTile, Panel, PanelHeader, PanelSkeleton } from "@/components/ui/primitives";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/page-meta";
import { CATEGORY_WEIGHTS, SCREEN_CATEGORIES, type CheckId, type ScreenCategory } from "@/lib/screening";
import { loadScreen } from "@/lib/screening-data";
import { TECHNICAL_SYMBOLS } from "@/lib/technical";
import { isValidSymbol } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/hisse-secimi",
  tr: {
    title: "Hisse Seçimi",
    description:
      "Bir hisseyi incelemeye değer kılan kurallar: büyüklük, büyüme, kârlılık, finansal sağlık, fiyat gücü ve sahiplik. Sembol seç, kuralları sitenin verileriyle uygula.",
  },
  en: {
    title: "Stock Picking",
    description:
      "The rules that make a stock worth researching: size, growth, profitability, financial health, price strength and ownership. Pick a symbol and run them on the site's data.",
  },
});

/** Kategori → kuralları. Motorun sırasıyla aynı (lib/screening.ts → evaluate). */
const RULES: Record<ScreenCategory, CheckId[]> = {
  gate: ["marketCap", "price", "liquidity"],
  growth: ["epsGrowthQ", "salesGrowthQ", "epsGrowth3Y", "growthSource"],
  profitability: ["profitable", "margins"],
  health: ["currentRatio", "debt", "runway"],
  strength: ["vsMarket", "vsSector", "aboveLow", "nearHigh"],
  ownership: ["dilution", "funds", "insiders"],
  catalyst: ["analystTrend", "upside", "earningsQuality"],
};
const RULE_COUNT = Object.values(RULES).reduce((sum, list) => sum + list.length, 0);

/**
 * HİSSE SEÇİMİ — kuralların kendisi ve sembol seçimi (3 Ekim).
 *
 * İki iş: nasıl hisse seçildiğini anlatmak (kurallar, neden önemli
 * oldukları, nasıl kullanılacakları) ve okuyucunun seçtiği hissede o
 * kuralları sitenin verileriyle uygulamak (/hisse-secimi/{sembol}).
 *
 * FORM JAVASCRIPT İSTEMİYOR: sembol GET ile buraya geliyor ve sunucu rapora
 * yönlendiriyor; istemci bileşeni yok.
 *
 * Hızlı bakış teknik analiz listesini puanlıyor ve Suspense içinde akıyor:
 * on iki hissenin her biri bir düzine kaynağa gidiyor, kapak ve kurallar
 * onu beklemiyor.
 */
export default async function ScreeningPage(props: PageProps<"/hisse-secimi">) {
  const { locale, t } = await getI18n();
  const S = t.screening;
  const query = (await props.searchParams).sembol;
  const picked = (Array.isArray(query) ? query[0] : query)?.trim().toUpperCase().replace(/^\$/, "");
  if (picked && isValidSymbol(picked)) redirect(withLocale(`/hisse-secimi/${picked}`, locale));

  const weightTotal = Object.values(CATEGORY_WEIGHTS).reduce((sum, value) => sum + value, 0);

  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <DirectoryHeader
        title={S.title}
        description={S.description}
        visual={
          <div>
            <p className={directory.visualHeading}>
              {S.scoreLabel}
              <span>{S.rulesMeta.replace("{n}", String(RULE_COUNT))}</span>
            </p>
            <div className={styles.weights}>
              {(Object.keys(CATEGORY_WEIGHTS) as (keyof typeof CATEGORY_WEIGHTS)[]).map((category) => (
                <div key={category} className={styles.weight}>
                  <span>{S.categories[category]}</span>
                  <b>{S.weight.replace("{n}", String(CATEGORY_WEIGHTS[category]))}</b>
                  <span className={styles.track} aria-hidden="true">
                    <span style={{ width: `${(CATEGORY_WEIGHTS[category] / 30) * 100}%` }} data-total={weightTotal} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <form className={styles.picker} action={withLocale("/hisse-secimi", locale)} method="get" role="search">
          <label htmlFor="screen-symbol">{S.pickLabel}</label>
          <div className={styles.pickerRow}>
            <input
              id="screen-symbol"
              name="sembol"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={10}
              required
              pattern="[A-Za-z$.\-]{1,10}"
              placeholder={S.pickPlaceholder}
            />
            <button type="submit">{S.pickAction}</button>
          </div>
          <p className={styles.pickerHint}>{S.pickHint}</p>
        </form>
      </DirectoryHeader>

      <Suspense fallback={<PanelSkeleton rows={4} />}>
        <QuickLook locale={locale} t={t} />
      </Suspense>

      <Panel>
        <PanelHeader title={S.rulesTitle} meta={S.rulesMeta.replace("{n}", String(RULE_COUNT))} />
        <p className={styles.intro}>{S.rulesIntro}</p>
        <div className={styles.rules}>
          {SCREEN_CATEGORIES.map((category) => (
            <section key={category} className={styles.rule}>
              <div className={styles.ruleHead}>
                <h3>{S.categories[category]}</h3>
                {category !== "gate" && <span>{S.weight.replace("{n}", String(CATEGORY_WEIGHTS[category]))}</span>}
              </div>
              <p className={styles.ruleWhy}>{S.categoryWhy[category]}</p>
              <ul className={styles.ruleList}>
                {RULES[category].map((id) => (
                  <li key={id}>
                    <b>{S.checks[id].name}</b>
                    <span>{S.checks[id].rule}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className={styles.notes}>
          <p>{S.methodNote}</p>
          <p>
            <strong>{S.notAdvice}</strong>
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={S.stepsTitle} />
        <div className={styles.cards} data-count={S.steps.length}>
          {S.steps.map((step, index) => (
            <article key={step.title} className={styles.card}>
              <h3>
                <span>{index + 1}</span>
                {step.title}
              </h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={S.principlesTitle} />
        <div className={styles.cards} data-count={S.principles.length}>
          {S.principles.map((item) => (
            <article key={item.title} className={styles.card}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </Panel>

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["degerleme", "risk-yonetimi"]} />
    </MotionExperience>
  );
}

/** Teknik analiz listesinin puanları — en yüksekten. Bir alım listesi
    değil, araştırma sırası; panel altındaki not bunu söylüyor. */
async function QuickLook({ locale, t }: { locale: Locale; t: Dictionary }) {
  const S = t.screening;
  const results = await Promise.all(TECHNICAL_SYMBOLS.map((symbol) => loadScreen(symbol, locale).catch(() => null)));
  const rows = results
    .filter((row): row is NonNullable<typeof row> => row !== null && row.result.score !== null)
    .sort((a, b) => (b.result.score ?? 0) - (a.result.score ?? 0));
  return (
    <Panel>
      <PanelHeader title={S.quickTitle} meta={S.quickMeta.replace("{n}", String(TECHNICAL_SYMBOLS.length))} />
      {rows.length === 0 ? (
        <p className={styles.intro}>{S.quickUnavailable}</p>
      ) : (
        <ul className={styles.quick}>
          {rows.map((row) => (
            <li key={row.symbol}>
              <Link href={`/hisse-secimi/${row.symbol}`} className={styles.quickCard} data-motion-action>
                <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                <span className={styles.quickName}>
                  <strong>{row.symbol}</strong>
                  <span>{row.name}</span>
                  {row.result.band && (
                    <span className={styles.quickBand} data-band={row.result.band}>
                      {S.bands[row.result.band]}
                    </span>
                  )}
                </span>
                <MiniDial score={row.result.score} band={row.result.band} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.quickNote}>{S.quickNote}</p>
    </Panel>
  );
}
