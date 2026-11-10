import { PageShare } from "@/components/article/PageShare";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { SymbolPicker } from "@/components/screening/SymbolPicker";
import styles from "@/components/screening/Screening.module.css";
import { QuickCards, RuleCards, WeightShare } from "@/components/screening/ScreeningIndex";
import index from "@/components/screening/ScreeningIndex.module.css";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
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
 * yönlendiriyor. Alanın kendisi istemci bileşeni (`SymbolPicker`, yazdıkça
 * öneri) ama ilerleme katmanı: JS yoksa düz bir `sembol` girdisi.
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

  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <DirectoryHeader
        shareInTitle
        share={<PageShare compactOnMobile align="right" path="/hisse-secimi" title={S.title} locale={locale} t={t} />}
        title={S.title}
        description={S.description}
        visual={
          <div>
            <p className={directory.visualHeading}>
              {S.scoreLabel}
              <span>{S.rulesMeta.replace("{n}", String(RULE_COUNT))}</span>
            </p>
            {/* Ağırlıklar tek cetvelde pay (6 Kasım) — gerekçe ScreeningIndex.tsx → WeightShare. */}
            <WeightShare
              weights={(Object.keys(CATEGORY_WEIGHTS) as (keyof typeof CATEGORY_WEIGHTS)[]).map((key) => ({ key, weight: CATEGORY_WEIGHTS[key] }))}
              names={S.categories}
              V={t.toolVisuals.screening}
            />
          </div>
        }
      >
        <form className={styles.picker} action={withLocale("/hisse-secimi", locale)} method="get" role="search">
          <label htmlFor="screen-symbol">{S.pickLabel}</label>
          <div className={styles.pickerRow}>
            {/* Yazdıkça öneren combobox (istemci); JS yoksa düz sembol alanı gibi çalışır. */}
            <SymbolPicker id="screen-symbol" labels={{ placeholder: S.pickPlaceholder, ...S.picker }} />
            <button type="submit">{S.pickAction}</button>
          </div>
          <p className={styles.pickerHint}>{S.pickHint}</p>
        </form>
      </DirectoryHeader>

      <Suspense fallback={<QuickSkeleton count={TECHNICAL_SYMBOLS.length} />}>
        <QuickLook locale={locale} t={t} />
      </Suspense>

      <Panel>
        <PanelHeader title={S.rulesTitle} meta={S.rulesMeta.replace("{n}", String(RULE_COUNT))} />
        <p className={styles.intro}>{S.rulesIntro}</p>
        {/* Kategoriler ikonlu kartlar (25 Ekim görsel turu) — gerekçe
            ScreeningIndex.tsx. Eleme tam genişlik kapı şeridi. */}
        <RuleCards categories={SCREEN_CATEGORIES} rules={RULES} S={S} V={t.toolVisuals.screening} />
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
        /* TEK YAPI (10 Kasım, gece): ayrı "Puan Sırası" listesi kalktı;
           kartlar puana göre sıralı ve puanı kalın çubukla veriyor
           (gerekçe ScreeningIndex.tsx → "TARİHÇE — PUAN SIRASI LİSTESİ"). */
        <QuickCards
          rows={rows.map((row) => ({ symbol: row.symbol, name: row.name, logoUrl: row.logoUrl, score: row.result.score, band: row.result.band }))}
          bands={S.bands}
          V={t.toolVisuals.screening}
        />
      )}
      <p className={styles.quickNote}>{S.quickNote}</p>
    </Panel>
  );
}

/**
 * Hızlı bakışın iskeleti GERÇEK panelin biçiminde (25 Ekim; ölçüler 6 Kasım
 * düzeninde güncellendi, ScreeningIndex.module.css): dört satırlık
 * genel iskelet ~300 piksel tutuyordu, gelen panel (kulvar + 16 kart)
 * 1440'ta ~650; akış inince altındaki Kurallar paneli aşağı zıplıyordu
 * (soğuk önbellekte CLS 0,05–0,16 ölçüldü). Kulvar kutusu ve kart ızgarası
 * aynı sınıflarla basılıyor. 10 Kasım (gece): puan listesi kalktı; iskelet
 * lejant kutusu + puan çubuklu kartlar.
 */
function QuickSkeleton({ count }: { count: number }) {
  return (
    <Panel>
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      <div className={index.quickWrap}>
        <div className={index.laneSkeleton}>
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="h-2.5 w-56 max-w-full" />
        </div>
        <ul className={index.quick} aria-hidden>
          {Array.from({ length: count }).map((_, i) => (
            <li key={i}>
              <div className={index.cardSkeleton}>
                <Skeleton className="size-9 rounded-lg" />
                <span className="grid gap-1.5">
                  <Skeleton className="h-3.5 w-14" />
                  <Skeleton className="h-2.5 w-24" />
                </span>
                <Skeleton className="h-6 w-9" />
                <Skeleton className="col-span-full h-2 w-full rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
