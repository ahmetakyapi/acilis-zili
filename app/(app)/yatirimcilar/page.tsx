import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import { InvestorCard } from "@/components/investors/InvestorCard";
import { MoversBoard } from "@/components/investors/MoversBoard";
import { InvestorRoster } from "@/components/investors/InvestorRoster";
import { asOfLabel, filedLabel, quarterLabel } from "@/components/investors/format";
import styles from "@/components/investors/Investors.module.css";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { getSymbolNames } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getInvestorOverview } from "@/lib/investor-data";
import { investorBySlug } from "@/lib/investors";
import { pageMetadata } from "@/lib/page-meta";
import { cn, formatEtDateMedium, formatMoneyCompact, NO_VALUE, plural } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/yatirimcilar",
  tr: {
    title: "Ünlü Yatırımcılar: Kim Ne Tutuyor",
    description:
      "Warren Buffett, Michael Burry, Bill Ackman, Cathie Wood ve Nancy Pelosi: ünlü yatırımcıların SEC 13F ve Kongre bildirimlerinden portföyleri, alımları ve satışları.",
  },
  en: {
    title: "Famous Investors: Who Holds What",
    description:
      "Warren Buffett, Michael Burry, Bill Ackman, Cathie Wood and Nancy Pelosi: famous investors' portfolios, buys and sells from SEC 13F and congressional filings.",
  },
});

/**
 * Ünlü yatırımcılar dizini (28 Eylül).
 *
 * Ekran sırası sitenin kuralı:
 *   1. Kapak: ad, tek cümle, takip edilen portföylerin toplamı (yüklemede
 *      dönen sayı) ve sağda portre mozaiği — her karo o kişinin sayfası.
 *   2. Şerit: bu çeyreğin hareketleri — aynı hisseye aynı yönde giden
 *      yatırımcılar ("META: 4 Artırdı").
 *   3. Kartlar: portre, portföy değeri, en büyük pozisyonların ağırlık
 *      şeridi ve logo mozaiği, çeyreğin hareket sayıları. Kongre kartı ayrı
 *      türde: son işlemler, tutar aralığıyla.
 *   4. Künyeler ve uyarı panelin içinde, sonra damga ve rehber.
 *
 * VERİ BEKLENİYOR, AKIŞ YOK. Sayfanın tamamı tek bir önbellekli hesaptan
 * (`getInvestorOverview`, `unstable_cache`, günde bir değişiyor); akışa
 * bölmek yedekle canlı arasında bir sıçrama eklemekten başka bir şey
 * kazandırmazdı. Tablo yoksa (migration uygulanmadı) kapak ve boş durum
 * basılıyor, sayfa çökmüyor.
 */
export default async function InvestorsPage() {
  const { locale, t } = await getI18n();
  const ti = t.investors;
  const overview = await getInvestorOverview();

  const tickers = overview
    ? [
        ...overview.cards.flatMap((card) =>
          card.kind === "13f" ? card.top.map((top) => top.ticker) : card.trades.map((trade) => trade.ticker),
        ),
        ...overview.movers.buys.map((entry) => entry.ticker),
        ...overview.movers.sells.map((entry) => entry.ticker),
      ].filter((ticker): ticker is string => Boolean(ticker))
    : [];
  const known = await getSymbolNames(tickers);

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: ti.eyebrow, path: "/yatirimcilar" }]} />

      <header className={cn(styles.hero, "page-frame")}>
        <div className={cn(styles.heroCopy, "page-heading-copy")}>
          <p className="page-eyebrow">{ti.eyebrow}</p>
          <h1 className={styles.heroTitle}>{ti.title}</h1>
          <p className={styles.heroDek}>{ti.subtitle}</p>
          <dl className={styles.heroStats}>
            <div className={styles.heroStatLead}>
              <dt>{ti.trackedValue}</dt>
              <dd className="numeral">
                {overview ? <RollingFigure value={formatMoneyCompact(overview.trackedValue, locale)} /> : NO_VALUE}
              </dd>
            </div>
            <div>
              <dt>{ti.periodLabel}</dt>
              <dd className="numeral">
                {overview?.movers.period ? quarterLabel(overview.movers.period, ti) : NO_VALUE}
              </dd>
            </div>
            <div>
              <dt>{ti.lastFiled}</dt>
              <dd className="numeral">
                {overview?.latestFiled ? formatEtDateMedium(overview.latestFiled, locale) : NO_VALUE}
              </dd>
            </div>
          </dl>
        </div>
        <InvestorRoster overview={overview} locale={locale} t={ti} />
      </header>

      {overview ? (
        <>
          <MoversBoard movers={overview.movers} known={known} locale={locale} t={ti} />
          {/* Şirket kartı: mozaik logoları, kongre işlemleri ve hareket
              satırları. Yalnızca sembolü tabloda bilinenler; kotasyonu kart
              kendisi soruyor, akışla iniyor (sayfanın geri kalanı fiyat
              göstermiyor, yan yana ikinci bir yüzde yok). */}
          <Suspense fallback={null}>
            <CompanyCards symbols={tickers.filter((ticker) => known[ticker])} names={known} />
          </Suspense>

          <section className={styles.cardsSection} aria-labelledby="investors-cards">
            <h2 id="investors-cards" className={styles.sectionTitle}>
              {ti.cardsTitle}
              <span className="numeral">{plural(overview.cards.length, ti.investorsCountOne, ti.investorsCount).replace("{count}", String(overview.cards.length))}</span>
            </h2>
            <ul className={styles.cards} data-motion-stagger>
              {overview.cards.map((card) => {
                const investor = investorBySlug(card.slug);
                if (!investor) return null;
                return (
                  <li key={card.slug} className={styles.cardItem} data-kind={card.kind}>
                    <InvestorCard card={card} investor={investor} known={known} locale={locale} t={ti} />
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : (
        <Panel>
          <EmptyState title={ti.emptyTitle} hint={ti.emptyHint} scene="lost" />
        </Panel>
      )}

      <Panel>
        <PanelHeader title={ti.disclaimerTitle} />
        <p className="border-t border-line px-4 py-4 text-read leading-[27px] text-body sm:px-5">{ti.disclaimer}</p>
        <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">{ti.note13f}</p>
        <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">{ti.noteMoves}</p>
        <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">{ti.congressNote}</p>
      </Panel>

      {overview?.latestFiled && (
        /* Saat yok: SEC bildirimi bir GÜN taşıyor, saati değil. Damgaya
           öğlen saatiyle bir an vermek "15:00 Güncellendi" gibi uydurma bir
           kesinlik basardı; tarih künyede. */
        <DataStamp
          labels={t.data}
          source="sec"
          locale={locale}
          note={[
            filedLabel(overview.latestFiled, locale, ti),
            ...(overview.movers.period ? [asOfLabel(overview.movers.period, locale, ti)] : []),
          ].join(" · ")}
        />
      )}
      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["13f-nedir", "yatirimci-psikolojisi"]} />
    </MotionExperience>
  );
}
