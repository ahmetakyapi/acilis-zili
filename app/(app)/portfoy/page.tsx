import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuideHint } from "@/components/article/GuideHint";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { ExportToTaxButton } from "@/components/portfolio/PortfolioClient";
import styles from "@/components/portfolio/Portfolio.module.css";
import {
  AddPositionButton,
  EmptyChoices,
  ImportButton,
  PortfolioWorkbench,
} from "@/components/portfolio/PortfolioWorkbench";
import { PortfolioTechnical, type TechnicalHolding } from "@/components/portfolio/PortfolioTechnical";
import { PositionsTable, type PositionRow } from "@/components/portfolio/PositionsTable";
import {
  AllocationRing,
  AllocationRingSkeleton,
  allocationSlices,
  SectorStrip,
  TotalsBand,
} from "@/components/portfolio/PortfolioVisuals";
import { DataStamp, EmptyState, Panel, PanelHeader, PanelSkeleton } from "@/components/ui/primitives";
import { companySector } from "@/lib/company-sector";
import { formatIsoDate, formatRate, TCMB_MIN_DATE } from "@/lib/fx";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { sectorWeights } from "@/lib/portfolio";
import { MAX_POSITIONS } from "@/lib/portfolio-data";
import { loadPortfolio } from "@/lib/portfolio-snapshot";
import { istanbulToday } from "@/lib/providers/fx-history";

/* KİŞİSEL SAYFA — DİZİNE GİRMEZ (gerekçe /favoriler'deki notun aynısı). */
export const generateMetadata = pageMetadata({
  path: "/portfoy",
  robots: { index: false, follow: false },
  tr: { title: "Portföy", description: "Pozisyonlarının dolar ve lira kâr/zararı." },
  en: { title: "Portfolio", description: "Dollar and lira profit and loss on your positions." },
});

/**
 * PORTFÖY — "neyim var ve lirada ne kazandırdı".
 *
 * Takip listesi fiyat gösteriyor; adet ve maliyet olmadan TL kâr/zarar
 * kurulamıyor. Burada her pozisyonun TL maliyeti ALIŞ GÜNÜNÜN TCMB döviz
 * alış kuruyla, bugünkü değeri BUGÜNÜN kuruyla — vergi hesaplayıcısıyla aynı
 * taraf ve aynı kaynak (`lib/portfolio.ts`, `lib/fx.ts`).
 *
 * Ekran sırası kurala göre: kapak (sağında dağılım halkası) → toplam şeridi
 * → pozisyon tablosu (ölçüler) → teknik plan (yalnızca kapsamdaki
 * pozisyonlar) → sektör şeridi → ekleme paneli → künyeler
 * panelin içinde → damga → rehber.
 *
 * İLK BAYT VERİYİ BEKLEMİYOR. Sayfa bir dönem pozisyonları, kotasyonları
 * ve iki kur okumasını bitirip ancak ondan sonra ilk baytı gönderiyordu
 * (soğuk önbellekte 785 ms, 28 Eylül ölçümü). Kapak ve ekleme paneli veriye
 * bağlı değil; halka ve gövde Suspense içinde akıyor ve ikisi aynı
 * `loadPortfolio` çağrısını paylaşıyor.
 *
 * TABLO YOKSA ÇÖKMÜYOR: `portfolio_positions` migration'la geliyor ve
 * migration'lar deploy'da uygulanmıyor; okuma düşerse sayfa "şu an
 * açılamıyor" der (`lib/portfolio-data.ts`).
 */
export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/portfoy");
  const userId = session.user.id;

  const { locale, t } = await getI18n();
  const L = t.lira.portfolio;
  const today = istanbulToday();

  /* İŞ MASASI SAYFANIN TAMAMINI SARIYOR: kahramandaki düğmeler, boş durum
     ve tablo aynı pencereyi açıyor (components/portfolio/PortfolioWorkbench).
     İçindeki ağacın çoğu hâlâ sunucuda çiziliyor. */
  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <PortfolioWorkbench labels={L} locale={locale} today={today} minDate={TCMB_MIN_DATE} maxPositions={MAX_POSITIONS}>
        <DirectoryHeader
          eyebrow={L.eyebrow}
          title={L.title}
          description={L.subtitle}
          visual={
            <Suspense fallback={<AllocationRingSkeleton title={L.allocationTitle} />}>
              <HeroAllocation userId={userId} locale={locale} t={t} />
            </Suspense>
          }
        >
          <div className={styles.heroActions}>
            <AddPositionButton />
            <ImportButton />
            {/* Yedek, aynı düğmenin devre dışı hâli: pozisyonlar inince
                yerinde etkinleşiyor, satır kaymıyor. Aktarım sözleşmesi
                (`TAX_HANDOFF_KEY`, sessionStorage) değişmedi. */}
            <Suspense fallback={<ExportToTaxButton label={L.exportToTax} positions={[]} />}>
              <HeroExport userId={userId} label={L.exportToTax} />
            </Suspense>
          </div>
        </DirectoryHeader>

        <Suspense
          fallback={
            <>
              <PanelSkeleton rows={2} />
              <PanelSkeleton rows={4} />
            </>
          }
        >
          <PortfolioBody userId={userId} locale={locale} t={t} />
        </Suspense>

        <GuideHint
          label={t.guide.contextLabel}
          locale={locale}
          slugs={["kur-riski", "cesitlendirme"]}
          className="pt-1"
        />
      </PortfolioWorkbench>
    </MotionExperience>
  );
}


async function HeroAllocation({ userId, locale, t }: { userId: string; locale: Locale; t: Dictionary }) {
  const L = t.lira.portfolio;
  const data = await loadPortfolio(userId);
  const slices = data.ok
    ? allocationSlices(
        data.views.map((view) => ({
          symbol: view.symbol,
          logoUrl: data.names[view.symbol]?.logoUrl ?? null,
          valueUsd: view.valueUsd,
        })),
        L.otherSector,
      )
    : [];
  return (
    <AllocationRing
      slices={slices}
      count={data.ok ? data.positions.length : 0}
      labels={{ title: L.allocationTitle, positions: L.positionsUnit, empty: L.allocationEmpty }}
      locale={locale}
    />
  );
}

async function HeroExport({ userId, label }: { userId: string; label: string }) {
  const data = await loadPortfolio(userId);
  return (
    <ExportToTaxButton
      label={label}
      positions={
        data.ok
          ? data.positions.map((p) => ({
              symbol: p.symbol,
              quantity: p.quantity,
              costUsd: p.costUsd,
              boughtAt: p.boughtAt,
            }))
          : []
      }
    />
  );
}

async function PortfolioBody({
  userId,
  locale,
  t,
}: {
  userId: string;
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.lira.portfolio;
  const data = await loadPortfolio(userId);

  if (!data.ok) {
    return (
      <Panel>
        <EmptyState title={L.unavailableTitle} hint={L.unavailableBody} scene="mishap" />
      </Panel>
    );
  }

  /* Boş portföyün İKİ yolu yan yana: elle ekle ya da ekstreden getir.
     Eskiden boş durumun altında beş alanlı form açık geliyordu ve ekstresi
     olan okuyucu satır satır yazmak zorundaydı. */
  if (data.positions.length === 0) {
    return (
      <Panel>
        <EmptyState title={L.emptyTitle} hint={L.emptyBody} scene="ledger" />
        <EmptyChoices />
      </Panel>
    );
  }

  const { views, totals, names, buyRate, todayFx, todayRate, quotesResult } = data;
  const weights = sectorWeights(
    views.map((view) => ({
      sector: companySector(view.symbol, names[view.symbol]?.industry, locale) ?? L.otherSector,
      valueUsd: view.valueUsd,
    })),
  );
  const maxValue = Math.max(0, ...views.map((view) => view.valueUsd ?? 0));
  const byId = new Map(data.positions.map((p) => [p.id, p]));

  /* Tablonun satırları: hesap burada (sunucuda) bitiyor, istemciye yalnızca
     sonuç gidiyor. */
  const rows: PositionRow[] = views.map((view) => ({
    id: view.id,
    symbol: view.symbol,
    quantity: view.quantity,
    costUsd: view.costUsd,
    boughtAt: view.boughtAt,
    note: byId.get(view.id)?.note ?? null,
    name: names[view.symbol]?.name ?? null,
    logoUrl: names[view.symbol]?.logoUrl ?? null,
    price: view.price,
    valueUsd: view.valueUsd,
    pnlUsd: view.pnlUsd,
    pnlUsdPct: view.pnlUsdPct,
    costTl: view.costTl,
    valueTl: view.valueTl,
    pnlTl: view.pnlTl,
    pnlTlPct: view.pnlTlPct,
    share: view.valueUsd !== null && totals.valueUsd > 0 ? (view.valueUsd / totals.valueUsd) * 100 : null,
    ratio: maxValue > 0 ? (view.valueUsd ?? 0) / maxValue : 0,
    rate: buyRate.get(view.boughtAt) ?? null,
  }));

  /* Teknik plan için sembol başına tek satır: aynı hissenin lotları
     birleşiyor, maliyet adetle ağırlıklı. Fiyat tablonun fiyatı. */
  const holdingMap = new Map<string, TechnicalHolding & { quantity: number; costTotal: number }>();
  for (const view of views) {
    const current = holdingMap.get(view.symbol);
    const quantity = (current?.quantity ?? 0) + view.quantity;
    const costTotal = (current?.costTotal ?? 0) + view.costTotalUsd;
    holdingMap.set(view.symbol, {
      symbol: view.symbol,
      name: names[view.symbol]?.name ?? null,
      logoUrl: names[view.symbol]?.logoUrl ?? null,
      price: view.price,
      quantity,
      costTotal,
      avgCost: quantity > 0 ? costTotal / quantity : view.costUsd,
    });
  }

  return (
    <>
      {/* ---- Toplam şeridi ---- */}
      <Panel>
        <PanelHeader title={L.totals} />
        <TotalsBand
          totals={totals}
          todayRate={todayRate}
          locale={locale}
          labels={{
            totalValue: L.totalValue,
            totalPnlUsd: L.totalPnlUsd,
            totalPnlTl: L.totalPnlTl,
            fxEffect: L.fxEffect,
            fxEffectHint: L.fxEffectHint,
            fromStock: L.fromStock,
            fromFx: L.fromFx,
            sourceTitle: L.sourceTitle,
          }}
        />
      </Panel>

      <Panel>
        <PanelHeader title={L.positionsTitle} action={<AddPositionButton variant="ghost" />} />
        <PositionsTable rows={rows} />
        {/* Künyeler PANELİN İÇİNDE, hairline ile — yeni kutu açılmıyor. */}
        <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
          <p className="numeral">
            {todayFx?.ok
              ? L.todayRate
                  .replace("{rate}", formatRate(todayFx.data.buying, locale))
                  .replace("{date}", formatIsoDate(todayFx.data.bulletinDate, locale, "long"))
              : L.fxMissing}
          </p>
          {quotesResult?.ok && quotesResult.stale && <p>{L.staleNote}</p>}
          <p>{L.exportHint}</p>
          <p>{L.notAdvice}</p>
        </div>
      </Panel>

      {/* Teknik analizi yapılan pozisyonların planı — kesişim yoksa panel
          hiç çizilmiyor (components/portfolio/PortfolioTechnical.tsx). */}
      <PortfolioTechnical holdings={[...holdingMap.values()]} locale={locale} t={t} />

      {weights.length > 0 && (
        <Panel>
          <PanelHeader title={L.sectorTitle} meta={L.sectorHint} />
          <SectorStrip weights={weights} locale={locale} />
        </Panel>
      )}

      {quotesResult?.ok && (
        <DataStamp
          labels={t.data}
          source={quotesResult.source}
          at={quotesResult.fetchedAt}
          stale={quotesResult.stale}
          locale={locale}
        />
      )}
    </>
  );
}
