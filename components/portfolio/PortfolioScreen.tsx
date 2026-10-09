import { Suspense } from "react";
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
import { RealizedPanel } from "@/components/portfolio/RealizedPanel";
import { getPortfolioSales, loadRealized } from "@/lib/portfolio-sales-data";
import { getSymbolNames } from "@/lib/data";
import {
  AllocationRing,
  AllocationRingSkeleton,
  allocationSlices,
  REST_ACCENT,
  SectorStrip,
  shareAccents,
  TotalsBand,
} from "@/components/portfolio/PortfolioVisuals";
import { DataStamp, EmptyState, Panel, PanelHeader, PanelSkeleton } from "@/components/ui/primitives";
import { companySector } from "@/lib/company-sector";
import { cn, directionOf, directionText, formatPercent, formatPrice } from "@/lib/utils";
import { formatIsoDate, formatRate, TCMB_MIN_DATE } from "@/lib/fx";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { orderPositions, sectorWeights } from "@/lib/portfolio";
import { getPortfolioOrder, MAX_POSITIONS } from "@/lib/portfolio-data";
import { loadPortfolio } from "@/lib/portfolio-snapshot";
import { istanbulToday } from "@/lib/providers/fx-history";

/**
 * PORTFÖY — "neyim var ve lirada ne kazandırdı".
 *
 * Takip listesi fiyat gösteriyor; adet ve maliyet olmadan TL kâr/zarar
 * kurulamıyor. Burada her pozisyonun TL maliyeti ALIŞ GÜNÜNÜN TCMB döviz
 * alış kuruyla, bugünkü değeri BUGÜNÜN kuruyla — vergi hesaplayıcısıyla aynı
 * taraf ve aynı kaynak (`lib/portfolio.ts`, `lib/fx.ts`).
 *
 * Ekran sırası kurala göre: kapak (sağında dağılım halkası) → getiri
 * (toplam, dolar/lira kartları, lira getirisinin çözümlemesi) → pozisyon
 * listesi (telefonda kart, geniş ekranda hizalı satır) → teknik plan (yalnızca kapsamdaki
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
export async function PortfolioScreen({ userId, preset = null }: { userId: string; preset?: string | null }) {
  /* Satış tablosu var mı — Sat düğmeleri ve pencere ona bağlı. Tek küçük
     sorgu; kotasyon ve kur okumalarını (ilk baytı geciktiren asıl iş)
     beklemiyor. Aynı okuma `cache()`li, gövde onu yeniden kullanıyor. */
  const [{ locale, t }, sales, presetNames] = await Promise.all([
    getI18n(),
    getPortfolioSales(userId),
    preset ? getSymbolNames([preset]) : Promise.resolve(null),
  ]);
  const presetPick = preset
    ? { symbol: preset, name: presetNames?.[preset]?.name ?? null, logo: presetNames?.[preset]?.logoUrl ?? null }
    : null;
  const L = t.lira.portfolio;
  const today = istanbulToday();

  /* İŞ MASASI SAYFANIN TAMAMINI SARIYOR: kahramandaki düğmeler, boş durum
     ve tablo aynı pencereyi açıyor (components/portfolio/PortfolioWorkbench).
     İçindeki ağacın çoğu hâlâ sunucuda çiziliyor. */
  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <PortfolioWorkbench labels={L} locale={locale} today={today} minDate={TCMB_MIN_DATE} maxPositions={MAX_POSITIONS} sales={sales.available ? t.portfolioSales : null} preset={presetPick}>
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
  const [data, realized] = await Promise.all([loadPortfolio(userId), loadRealized(userId)]);
  /* Açık pozisyonlar alış, satılmış partiler alış + satış olarak gidiyor:
     hesaplayıcı satışı FIFO ile eşleştiriyor, portföy de satışı FIFO ile
     kaydettiği için iki ekranın kârı aynı partilerden kuruluyor. */
  const sold = realized.parts.map((part) => ({
    symbol: part.symbol,
    quantity: part.quantity,
    costUsd: part.costUsd,
    boughtAt: part.boughtAt,
    soldAt: part.soldAt,
    priceUsd: part.priceUsd,
  }));
  return (
    <ExportToTaxButton
      label={label}
      positions={[
        ...(data.ok
          ? data.positions.map((p) => ({
              symbol: p.symbol,
              quantity: p.quantity,
              costUsd: p.costUsd,
              boughtAt: p.boughtAt,
            }))
          : []),
        ...sold,
      ]}
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
  const realized = await loadRealized(userId);
  /* Satışların logoları — pozisyonu kalmamış sembol de olabilir. */
  const realizedNames =
    realized.views.length > 0 ? await getSymbolNames([...new Set(realized.views.map((view) => view.symbol))]) : {};

  if (data.positions.length === 0) {
    /* Bütün pozisyonlar satıldıysa da gerçekleşen kâr görünmeli: boş
       durum erken dönüyordu ve satışlar ekrandan kayboluyordu. */
    return (
      <>
        <Panel>
          <EmptyState title={L.emptyTitle} hint={L.emptyBody} scene="ledger" />
          <EmptyChoices />
        </Panel>
        {realized.views.length > 0 && <RealizedPanel data={realized} names={realizedNames} locale={locale} t={t} />}
      </>
    );
  }

  const { views, totals, names, buyRate, todayFx, todayRate, quotesResult, days, day, dayBasis } = data;
  const basisLabel =
    dayBasis === "session"
      ? t.companyCard.session
      : dayBasis === "pre-market"
        ? t.companyCard.preMarket
        : dayBasis === "after-hours"
          ? t.companyCard.afterHours
          : dayBasis === "sessionClose"
            ? t.companyCard.sessionClose
            : null;
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
  /* Kartın rengi halkadaki dilimin rengi; getiri çubukları tek ölçekte
     (dolar ve lira yüzdelerinin en büyük mutlak değeri). */
  const accents = shareAccents(
    allocationSlices(
      views.map((view) => ({ symbol: view.symbol, logoUrl: names[view.symbol]?.logoUrl ?? null, valueUsd: view.valueUsd })),
      L.otherSector,
    ),
  );
  const returnScale = Math.max(
    0,
    ...views.flatMap((view) => [view.pnlUsdPct, view.pnlTlPct].map((pct) => (pct === null ? 0 : Math.abs(pct)))),
  );
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
    fxTl:
      view.pnlTl !== null && view.pnlUsd !== null && todayRate !== null
        ? Math.round((view.pnlTl - view.pnlUsd * todayRate) * 100) / 100
        : null,
    accent: accents.get(view.symbol) ?? REST_ACCENT,
    returnScale,
    dayChangeUsd: days.get(view.id)?.changeUsd ?? null,
    dayChangePct: days.get(view.id)?.changePct ?? null,
    dayLabel: basisLabel,
  }));
  /* Varsayılan en ağır pozisyon üstte (halkanın lejantıyla aynı sıra);
     okuyucu elle sıra verdiyse o sıra (`orderPositions`, lib/portfolio.ts). */
  const savedOrder = await getPortfolioOrder(userId);
  const orderedRows = orderPositions(rows, savedOrder);

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
        <PanelHeader
          title={L.returnsTitle}
          action={
            /* GÜNÜN DEĞİŞİMİ başlığın sağında, künyesiyle: hangi seansı
               anlattığı adıyla yazılı; hiçbir pozisyon kanıtlanmıyorsa
               (bayat paket, önceki seans) hiç basılmıyor. */
            basisLabel && day.covered > 0 ? (
              <span className="numeral inline-flex flex-wrap items-baseline gap-x-2 text-small">
                <span className="text-muted">{t.portfolioDay.title} · {basisLabel}</span>
                <span className={cn("font-bold", directionText(directionOf(day.changeUsd)))}>
                  {`${day.changeUsd > 0 ? "+" : ""}${formatPrice(day.changeUsd, locale, { currency: true })}`}
                </span>
                <span className={cn("font-semibold", directionText(directionOf(day.changeUsd)))}>{formatPercent(day.changePct, locale)}</span>
              </span>
            ) : undefined
          }
        />
        <TotalsBand
          totals={totals}
          todayRate={todayRate}
          locale={locale}
          labels={L}
        />
      </Panel>

      {/* `overflow-clip`, `hidden` DEĞİL: sıra şeridi düzenlemede başlığın
          altına yapışıyor ve `overflow: hidden` paneli bir kaydırma kabına
          çevirip yapışkanlığı öldürüyordu. `clip` köşeleri yine kırpıyor. */}
      <Panel className="overflow-clip">
        <PanelHeader title={L.positionsTitle} action={<AddPositionButton variant="ghost" />} />
        <PositionsTable rows={orderedRows} manual={savedOrder !== null && savedOrder.length > 0} />
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
          {basisLabel && day.excluded > 0 && day.covered > 0 && (
            <p>{t.portfolioDay.excluded.replace("{n}", String(day.excluded))}</p>
          )}
          <p>{L.exportHint}</p>
          <p>{L.notAdvice}</p>
        </div>
      </Panel>

      <RealizedPanel data={realized} names={realizedNames} locale={locale} t={t} />

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
