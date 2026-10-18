import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { InvestorBalance } from "@/components/investors/InvestorBalance";
import { InvestorCard } from "@/components/investors/InvestorCard";
import { CapitalMap } from "@/components/investors/CapitalMap";
import { InvestorCast } from "@/components/investors/InvestorCast";
import { MoversBoard } from "@/components/investors/MoversBoard";
import { asOfLabel, filedLabel, quarterLabel } from "@/components/investors/format";
import styles from "@/components/investors/Investors.module.css";
import ix from "@/components/investors/InvestorsIndex.module.css";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { DataStamp, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getSymbolNames } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getInvestorOverview } from "@/lib/investor-data";
import { investorBySlug } from "@/lib/investors";
import { pageMetadata } from "@/lib/page-meta";
import { cn, plural } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/yatirimcilar",
  tr: {
    title: "Ünlü Yatırımcılar Ne Tutuyor",
    description:
      "Warren Buffett, Michael Burry, Bill Ackman, Cathie Wood ve Nancy Pelosi: ünlü yatırımcıların SEC 13F ve Kongre bildirimlerinden portföyleri, alımları ve satışları.",
  },
  en: {
    title: "What Famous Investors Hold",
    description:
      "Warren Buffett, Michael Burry, Bill Ackman, Cathie Wood and Nancy Pelosi: famous investors' portfolios, buys and sells from SEC 13F and congressional filings.",
  },
});

/**
 * Ünlü yatırımcılar dizini (28 Eylül; 18 Ekim yeniden kuruldu).
 *
 * 18 EKİM. Sahibi sayfayı "zayıf ve kötü görünüyor" diye buldu: kapakta
 * başlığın yanında havada duran Paylaş, sağ üstte üç künye sayısı, tek
 * fonun %60'ını kapladığı bir sermaye şeridi ve iki sütunlu, tablo gibi
 * okunan bir hareket panosu. Başlık "Kim Ne Tutuyor"du; sahibinin isteğiyle
 * "Ünlü Yatırımcılar Ne Tutuyor" (kimin kim olduğu başlıkta).
 *
 * Ekran sırası sitenin kuralı (CLAUDE.md "her ekranda aynı sıra"):
 *   1. Kapak: `PageHeader` — ad, tek cümle, Paylaş başlık satırının sağında
 *      (dizin kapaklarının ortak yeri, `PageShare` yorumu). Dönem ve son
 *      bildirim başlığın ALTINDA; altında kadro (`InvestorCast`): on altı
 *      yüz, her biri sayfasına bağlantı ve bu çeyreğin yönünü taşıyan nokta.
 *   2. Ana görsel: sermaye haritası (`CapitalMap`) — pay ALANLA, karoda
 *      portre; uzun kuyruk tek karo, üyeleri altında adıyla. Ölçü ızgarası
 *      (toplam, fon sayısı, dönem, son bildirim) ve 13F gecikme künyesi
 *      haritanın altında, panelin içinde.
 *   3. Hisse hisse alanlar ve satanlar (`MoversBoard`): tek ayrışan grafik,
 *      her yüz bir yatırımcı.
 *   3b. Kim alıyor, kim satıyor (`InvestorBalance`): aynı çeyrek KİŞİ başına.
 *   4. Kartlar: portre, portföy değeri, en büyük pozisyonlar, hareket sayıları.
 *   5. Künyeler ve uyarı panelin içinde, sonra damga ve rehber.
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
  const period = overview?.movers.period ?? null;

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: ti.eyebrow, path: "/yatirimcilar" }]} />

      <section className={cn("page-frame", ix.masthead)}>
        <PageHeader
          embedded
          title={ti.title}
          subtitle={ti.subtitle}
          share={<PageShare compactOnMobile align="right" path="/yatirimcilar" title={ti.title} locale={locale} t={t} />}
        />
        {/* Künye başlığın ALTINDA (üst künye yok, 9 Ekim): hangi çeyreğin
            portföyleri ve en son ne zaman bildirildi. */}
        {(period || overview?.latestFiled) && (
          <p className={cn(ix.kunye, "numeral")}>
            {period && <span>{quarterLabel(period, ti)}</span>}
            {overview?.latestFiled && <span>{filedLabel(overview.latestFiled, locale, ti)}</span>}
          </p>
        )}
        <InvestorCast overview={overview} locale={locale} t={ti} />
      </section>

      {overview ? (
        <>
          <CapitalMap overview={overview} locale={locale} t={ti} />
          <MoversBoard movers={overview.movers} known={known} locale={locale} t={ti} />
          <InvestorBalance overview={overview} locale={locale} t={ti} />
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
