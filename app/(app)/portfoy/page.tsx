import { Suspense, type ComponentProps, type CSSProperties } from "react";
import { redirect } from "next/navigation";
import { Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { deletePositionAction } from "@/app/actions/portfolio";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { AddPanelLink, AddPositionForm, ExportToTaxButton } from "@/components/portfolio/PortfolioClient";
import styles from "@/components/portfolio/Portfolio.module.css";
import {
  AllocationRing,
  AllocationRingSkeleton,
  allocationSlices,
  SectorStrip,
  TotalsBand,
} from "@/components/portfolio/PortfolioVisuals";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  buttonClass,
  DataStamp,
  EmptyState,
  LogoTile,
  Panel,
  PanelHeader,
  PanelSkeleton,
} from "@/components/ui/primitives";
import { companySector } from "@/lib/company-sector";
import { formatIsoDate, formatLira, formatRate, TCMB_MIN_DATE } from "@/lib/fx";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { sectorWeights } from "@/lib/portfolio";
import { MAX_POSITIONS } from "@/lib/portfolio-data";
import { loadPortfolio } from "@/lib/portfolio-snapshot";
import { istanbulToday } from "@/lib/providers/fx-history";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, formatPrice, NO_VALUE } from "@/lib/utils";

/* KİŞİSEL SAYFA — DİZİNE GİRMEZ (gerekçe /favoriler'deki notun aynısı). */
export const generateMetadata = pageMetadata({
  path: "/portfoy",
  robots: { index: false, follow: false },
  tr: { title: "Portföy", description: "Pozisyonlarının dolar ve lira kâr/zararı." },
  en: { title: "Portfolio", description: "Dollar and lira profit and loss on your positions." },
});

type AddLabels = ComponentProps<typeof AddPositionForm>["labels"];

/** Ekleme panelinin çapası — kahramandaki "Pozisyon Ekle" ve boş durum buraya iner. */
const ADD_ANCHOR = "pozisyon-ekle";

/**
 * PORTFÖY — "neyim var ve lirada ne kazandırdı".
 *
 * Takip listesi fiyat gösteriyor; adet ve maliyet olmadan TL kâr/zarar
 * kurulamıyor. Burada her pozisyonun TL maliyeti ALIŞ GÜNÜNÜN TCMB döviz
 * alış kuruyla, bugünkü değeri BUGÜNÜN kuruyla — vergi hesaplayıcısıyla aynı
 * taraf ve aynı kaynak (`lib/portfolio.ts`, `lib/fx.ts`).
 *
 * Ekran sırası kurala göre: kapak (sağında dağılım halkası) → toplam şeridi
 * → pozisyon tablosu (ölçüler) → sektör şeridi → ekleme paneli → künyeler
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

  const formLabels = {
    symbol: L.symbol,
    quantity: L.quantity,
    costUsd: L.costUsd,
    boughtAt: L.boughtAt,
    note: L.note,
    notePlaceholder: L.notePlaceholder,
    add: L.add,
    adding: L.adding,
    errors: { ...L.errors, limit: L.errors.limit.replace("{max}", String(MAX_POSITIONS)) },
  };

  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
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
          <AddPanelLink targetId={ADD_ANCHOR} className={buttonClass({ size: "md" })}>
            <Plus size={16} weight="bold" aria-hidden />
            {L.addTitle}
          </AddPanelLink>
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
        <PortfolioBody userId={userId} locale={locale} t={t} addPanel={{ labels: formLabels, today }} />
      </Suspense>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["kur-riski", "cesitlendirme"]}
        className="pt-1"
      />
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

/**
 * EKLEME BİR AÇILIR PANEL. Form sayfanın dibinde hep açık duruyordu ve
 * pozisyonları olan okuyucu için beş boş alan tablonun altında yer
 * kaplıyordu. Artık kapalı gelir; portföy boşsa açık, çünkü o zaman
 * sayfanın tek işi bu. `<details>` JavaScript'siz de açılıp kapanıyor ve
 * kahramandaki bağlantının çapası (`#pozisyon-ekle`) onu açarak iniyor.
 */
function AddPanel({
  open,
  title,
  labels,
  today,
}: {
  open: boolean;
  title: string;
  labels: AddLabels;
  today: string;
}) {
  return (
    <details open={open} className={cn("panel overflow-hidden", styles.addPanel)}>
      <summary className={styles.addSummary}>
        <PanelHeader title={title} />
        <span className={styles.addToggle} aria-hidden>
          <Plus size={16} weight="bold" />
        </span>
      </summary>
      {/* ÇAPA İÇERİKTE, `<details>`in kendisinde değil: tarayıcı kapalı
          bir `<details>`in İÇİNDEKİ hedefe giderken paneli kendisi açıyor;
          çapa paneldeyse yalnızca oraya kayıp kapalı bırakıyordu. */}
      <div id={ADD_ANCHOR} className={styles.addBody}>
        <AddPositionForm labels={labels} today={today} minDate={TCMB_MIN_DATE} />
      </div>
    </details>
  );
}

async function PortfolioBody({
  userId,
  locale,
  t,
  addPanel,
}: {
  userId: string;
  locale: Locale;
  t: Dictionary;
  addPanel: { labels: AddLabels; today: string };
}) {
  const L = t.lira.portfolio;
  const data = await loadPortfolio(userId);
  const add = (open: boolean) => (
    <AddPanel open={open} title={L.addTitle} labels={addPanel.labels} today={addPanel.today} />
  );

  if (!data.ok) {
    return (
      <Panel>
        <EmptyState title={L.unavailableTitle} hint={L.unavailableBody} scene="mishap" />
      </Panel>
    );
  }

  /* Boş portföyde ekleme paneli AÇIK geliyor ve hemen altında; boş
     durumun kendi düğmesi aynı işi ikinci kez söylerdi. */
  if (data.positions.length === 0) {
    return (
      <>
      <Panel>
        <EmptyState
          title={L.emptyTitle}
          hint={L.emptyBody}
          scene="ledger"
        />
      </Panel>
      {add(true)}
      </>
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

  const usd = (value: number | null, signed = false) =>
    value === null
      ? NO_VALUE
      : `${signed && value > 0 ? "+ " : ""}${formatPrice(value, locale, { currency: true })}`;

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
        <PanelHeader title={L.positionsTitle} />
        <ScrollEdges
          className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
          tabIndex={0}
          role="region"
          aria-label={L.positionsTitle}
        >
          {/* TABAN GENİŞLİK, `table-fixed` DEĞİL (CLAUDE.md "Kaydırma
              saklanmaz"): on sayı sütunu dar ekranda kaba zorlanınca
              hücreler birbirinin üstüne biniyor. Tablo kaydırılıyor,
              sembol sütunu yerinde kalıyor. */}
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left text-nano text-muted">
                <th scope="col" className="sticky left-0 z-10 bg-(--panel-fixed) px-4 py-2.5 font-medium sm:px-5">
                  {L.symbol}
                </th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.weight}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.quantity}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.costUsd}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.price}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.value}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.pnlUsd}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.costTl}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.valueTl}</th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-medium">{L.pnlTl}</th>
                {/* `relative` ŞART: `sr-only` mutlak konumlu ve konumlu bir
                    ata bulamayınca kaydırma kabının DIŞINA, sayfanın
                    839. pikseline yerleşiyordu — 390'da 449 piksellik
                    yatay taşma (ölçüldü). */}
                <th scope="col" className="relative px-4 py-2.5 sm:px-5">
                  <span className="sr-only">{L.remove}</span>
                </th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-line-soft", styles.rows)}>
              {views.map((view) => {
                const rate = buyRate.get(view.boughtAt);
                const share = view.valueUsd !== null && totals.valueUsd > 0 ? (view.valueUsd / totals.valueUsd) * 100 : null;
                return (
                  <tr key={view.id} className="align-top">
                    <th scope="row" className="sticky left-0 z-10 bg-(--panel-fixed) px-4 py-3 text-left font-normal sm:px-5">
                      <span className="flex items-center gap-2.5">
                        <LogoTile symbol={view.symbol} logoUrl={names[view.symbol]?.logoUrl ?? null} size="md" />
                        <span className="flex min-w-0 flex-col">
                          <Link
                            href={`/hisse/${view.symbol}`}
                            className="numeral w-fit font-bold text-strong transition-colors hover:text-primary"
                          >
                            {view.symbol}
                          </Link>
                          <span className="numeral whitespace-nowrap text-nano text-muted">
                            {formatIsoDate(view.boughtAt, locale)}
                          </span>
                        </span>
                      </span>
                    </th>
                    {/* AĞIRLIK BİR BÜYÜKLÜK: sayı portföy içindeki pay, çubuk
                        en büyük pozisyona göre — sıralama okumadan çıkıyor
                        (CLAUDE.md "karşılaştırılan her büyüklük bir de
                        çizgi"). Fiyatı olmayan pozisyonun ağırlığı yok. */}
                    <td className="px-2.5 py-3 text-right">
                      {share === null ? (
                        NO_VALUE
                      ) : (
                        <span className={styles.weight}>
                          <span className="numeral font-semibold text-strong">
                            {formatPercentPlain(share, locale, 1)}
                          </span>
                          <span className={styles.weightBar} aria-hidden>
                            <span
                              className={styles.weightFill}
                              style={{ "--ratio": maxValue > 0 ? (view.valueUsd ?? 0) / maxValue : 0 } as CSSProperties}
                            />
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="numeral px-2.5 py-3 text-right">
                      {new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
                        maximumFractionDigits: 8,
                      }).format(view.quantity)}
                    </td>
                    <td className="numeral px-2.5 py-3 text-right">{usd(view.costUsd)}</td>
                    <td className="numeral px-2.5 py-3 text-right">
                      {view.price === null ? <span className="text-muted">{L.noQuote}</span> : usd(view.price)}
                    </td>
                    <td className="numeral px-2.5 py-3 text-right text-strong">{usd(view.valueUsd)}</td>
                    <td className={cn("numeral px-2.5 py-3 text-right", directionText(directionOf(view.pnlUsd)))}>
                      {usd(view.pnlUsd, true)}
                      <span className="block text-nano">{formatPercent(view.pnlUsdPct, locale)}</span>
                    </td>
                    <td className="numeral px-2.5 py-3 text-right">
                      {formatLira(view.costTl, locale)}
                      {rate && (
                        <span className="block text-nano text-muted">
                          {L.rateAt
                            .replace("{date}", formatIsoDate(rate.bulletin, locale))
                            .replace("{rate}", formatRate(rate.rate, locale))}
                        </span>
                      )}
                    </td>
                    <td className="numeral px-2.5 py-3 text-right text-strong">{formatLira(view.valueTl, locale)}</td>
                    <td className={cn("numeral px-2.5 py-3 text-right", directionText(directionOf(view.pnlTl)))}>
                      {formatLira(view.pnlTl, locale, 2, true)}
                      <span className="block text-nano">{formatPercent(view.pnlTlPct, locale)}</span>
                    </td>
                    <td className="px-4 py-2 text-right sm:px-5">
                      <form action={deletePositionAction}>
                        <input type="hidden" name="id" value={view.id} />
                        <button
                          type="submit"
                          aria-label={L.removeAria.replace("{symbol}", view.symbol)}
                          className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-down-wash hover:text-down sm:size-9"
                        >
                          <Trash size={16} weight="duotone" aria-hidden />
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollEdges>
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

      {weights.length > 0 && (
        <Panel>
          <PanelHeader title={L.sectorTitle} meta={L.sectorHint} />
          <SectorStrip weights={weights} locale={locale} />
        </Panel>
      )}

      {add(false)}

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
