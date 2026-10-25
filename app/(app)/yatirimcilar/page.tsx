import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { CapitalStrip, InvestorGrid } from "@/components/investors/InvestorGrid";
import { MoversBoard } from "@/components/investors/MoversBoard";
import { asOfLabel, filedLabel, quarterLabel } from "@/components/investors/format";
import ix from "@/components/investors/InvestorsIndex.module.css";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { DataStamp, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getSymbolNames } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getInvestorOverview } from "@/lib/investor-data";
import { pageMetadata } from "@/lib/page-meta";
import { cn, formatEtDateMedium } from "@/lib/utils";

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
 * Ünlü yatırımcılar dizini (28 Eylül; 18 Ekim ve 25 Ekim yeniden kuruldu).
 *
 * 25 EKİM. Sahibi sayfayı "çok saçma ve büyük bazı yerler, ne anlattığından
 * uzaklaşıyoruz" diye buldu: kapakta iki satırlık başlık ve on altı yüzlük
 * kadro, altında ekranın yarısını kaplayan sermaye haritası (Buffett'ın
 * karosunda yalnız portre), sonra hareket grafiği, denge paneli ve en dipte
 * iki sütunlu büyük kartlar — 1440'ta 8.250 piksel. Şimdi sayfa kartlı:
 *
 *   1. Kapak: `PageHeader` (kısa ad, tek cümle, Paylaş), altında dönem
 *      künyesi ve tek satırlık sermaye şeridi (`CapitalStrip`).
 *   2. Ana görsel: yatırımcı kart ızgarası (`InvestorGrid`) — kişi başına
 *      pay, yön rozeti, en büyük üç pozisyon ve çeyreğin hamlesi. Kadro,
 *      sermaye haritası ve denge paneli bu kartlarda eridi.
 *   3. Hisse kartları (`MoversBoard`): bu çeyrek aynı hisseye kim girdi,
 *      kim çıktı.
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
          card.kind === "13f"
            ? [...card.top.map((top) => top.ticker), card.highlight?.ticker ?? null]
            : card.trades.map((trade) => trade.ticker),
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
        {overview && <CapitalStrip overview={overview} locale={locale} t={ti} />}
      </section>

      {overview ? (
        <>
          <InvestorGrid overview={overview} known={known} locale={locale} t={ti} />
          <MoversBoard movers={overview.movers} known={known} locale={locale} t={ti} />
          {/* Şirket kartı: kartlardaki logolar, Kongre işlemleri ve hisse
              kartları. Yalnızca sembolü tabloda bilinenler; kotasyonu kart
              kendisi soruyor, akışla iniyor (sayfanın geri kalanı fiyat
              göstermiyor, yan yana ikinci bir yüzde yok). */}
          <Suspense fallback={null}>
            <CompanyCards symbols={tickers.filter((ticker) => known[ticker])} names={known} />
          </Suspense>
        </>
      ) : (
        <Panel>
          <EmptyState title={ti.emptyTitle} hint={ti.emptyHint} scene="lost" />
        </Panel>
      )}

      <Panel>
        <PanelHeader title={ti.disclaimerTitle} />
        <p className="border-t border-line px-4 py-4 text-read leading-[27px] text-body sm:px-5">{ti.disclaimer}</p>
        <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
          {ti.note13f}
          {period && <> {ti.lagNote.replace("{date}", formatEtDateMedium(period, locale))}</>}
        </p>
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
