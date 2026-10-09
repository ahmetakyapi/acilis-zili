import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { FavoriteSlot } from "@/components/stock/FavoriteSlot";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { CategoryPanel, ChecksPanel, NextPanel, SidesPanel, statusLabel } from "@/components/screening/ScreenReport";
import { FlagSummary } from "@/components/screening/ScreenVisuals";
import styles from "@/components/screening/Screening.module.css";
import { DataStamp, EmptyState, LogoTile } from "@/components/ui/primitives";
import { analysisHref } from "@/lib/analysis";
import { compareHref } from "@/lib/compare";
import { getSymbolNames, isKnownSymbol } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import type { CheckId } from "@/lib/screening";
import { loadScreen } from "@/lib/screening-data";
import { industryLabel } from "@/lib/sectors";
import { pageAlternates } from "@/lib/site";
import { isTechnicalSymbol, technicalHref } from "@/lib/technical";
import { formatMoneyCompact, formatPrice, isValidSymbol } from "@/lib/utils";

/* TANINMAYAN SEMBOLDE SINIR — hisse sayfasındaki gerekçenin aynısı
   (app/(app)/hisse/[symbol]/page.tsx → allowStockRender). Bir rapor on üç
   kaynağa gidiyor; tanınan evren sınırlı ve önbellekli, sonsuz uzay
   tanınmayan semboller. Tavan yalnızca oraya. */
const UNKNOWN_LIMIT = 10;
const WINDOW_MS = 60_000;

export async function generateMetadata(props: PageProps<"/hisse-secimi/[symbol]">): Promise<Metadata> {
  const { symbol: raw } = await props.params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { locale, t } = await getI18n();
  if (!isValidSymbol(symbol)) return missingMetadata(locale);
  const meta = await getSymbolNames([symbol]);
  const name = meta[symbol]?.name;
  return {
    title: t.screening.reportTitle.replace("{symbol}", symbol),
    description: metaDescription(
      t.screening.metaReport.replace("{name}", name ?? symbol).replace("{symbol}", symbol),
    ),
    alternates: pageAlternates(`/hisse-secimi/${symbol}`, locale),
    /* Tanınmayan sembol dizine girmez — hisse sayfasıyla aynı karar. */
    ...(name ? {} : { robots: { index: false, follow: true } }),
  };
}

/**
 * HİSSE SEÇİMİ — tek hissenin kural kontrolü (3 Ekim).
 *
 * Bir yapay zekâ yorumu değil: sitenin zaten taşıdığı veriler sabit
 * kurallarla karşılaştırılıyor (motor lib/screening.ts, veri
 * lib/screening-data.ts). Aynı hisse aynı veriyle her seferinde aynı puanı
 * alır ve her puanın hangi kuraldan geldiği satır satır görünür.
 *
 * Sıra ekran düzeni kuralının sırası: kapak (sağda önce bayraklar, altında
 * puan — gerekçe components/screening/ScreenVisuals.tsx → FlagSummary) → kimlik
 * şeridi ve geçiş bağlantıları (kapağın içinde) → kategoriler (ana görsel)
 * → kural kural (ölçü ızgarası) → güçlü/zayıf yanlar (metin) → sıradaki
 * adımlar, okuyucunun kontrolleri ve künyeler → damga → rehber.
 */
export default async function ScreenReportPage(props: PageProps<"/hisse-secimi/[symbol]">) {
  const { symbol: raw } = await props.params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!isValidSymbol(symbol)) notFound();
  const { locale, t } = await getI18n();
  const S = t.screening;

  if (!(await isKnownSymbol(symbol))) {
    const allowed = (await rateLimit(await requestKey("screen-unknown"), UNKNOWN_LIMIT, WINDOW_MS)).allowed;
    if (!allowed) return <EmptyState title={t.stock.throttled} hint={t.stock.throttledHint} scene="mishap" />;
  }

  const data = await loadScreen(symbol, locale);
  if (!data) {
    return (
      <MotionExperience className={directory.page}>
        <EmptyState
          title={S.notFoundTitle}
          hint={S.notFoundBody}
          scene="lost"
          action={
            <Link href="/hisse-secimi" className={styles.link}>
              {S.otherTitle}
            </Link>
          }
        />
      </MotionExperience>
    );
  }

  const industry = industryLabel(data.industry, locale);
  const days = data.input.earningsInDays;
  const facts: { label: string; value: string }[] = [
    { label: S.priceLabel, value: formatPrice(data.input.price, locale, { currency: true }) },
    { label: S.marketCapLabel, value: formatMoneyCompact(data.input.marketCap, locale) },
  ];
  const links: { href: string; label: string }[] = [
    { href: `/hisse/${symbol}`, label: S.links.company },
    ...(isTechnicalSymbol(symbol) ? [{ href: technicalHref(symbol), label: S.links.technical }] : []),
    ...(data.analysis ? [{ href: analysisHref(symbol, data.analysis.period), label: S.links.analysis }] : []),
    { href: compareHref([symbol, "SPY"]), label: S.links.compare },
  ];

  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <DirectoryHeader
        eyebrow={S.title}
        title={S.reportTitle.replace("{symbol}", symbol)}
        description={S.reportSubtitle.replace("{name}", data.name)}
        share={
          <span className="inline-flex items-center gap-2">
            <FavoriteSlot symbol={symbol} back={`/hisse-secimi/${symbol}`} t={t} />
            <PageShare path={`/hisse-secimi/${symbol}`} title={S.reportTitle.replace("{symbol}", symbol)} locale={locale} t={t} />
          </span>
        }
        visual={
          <FlagSummary
            result={data.result}
            names={Object.fromEntries(data.result.checks.map((check) => [check.id, S.checks[check.id].name])) as Record<CheckId, string>}
            statusOf={(id) => statusLabel(data.result.checks.find((check) => check.id === id)!, data, S)}
            t={S}
          />
        }
      >
        <div className={styles.identity}>
          <LogoTile symbol={symbol} logoUrl={data.logoUrl} size="md" />
          <div className={styles.identityName}>
            <strong>{data.name}</strong>
            <span>{industry ? `${symbol} · ${industry}` : symbol}</span>
          </div>
        </div>
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
          {days !== null && days >= 0 && days <= 90 && (
            <div>
              <dt>{S.earningsLabel}</dt>
              <dd>{days === 0 ? S.earningsToday : S.earningsIn.replace("{days}", String(days))}</dd>
            </div>
          )}
        </dl>
        <nav className={styles.links} aria-label={S.linksLabel}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link} data-motion-action>
              {link.label}
              <ArrowUpRight size={13} weight="bold" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </DirectoryHeader>

      <CategoryPanel data={data} t={S} />
      <ChecksPanel data={data} locale={locale} t={S} />
      <SidesPanel data={data} locale={locale} t={S} />
      <NextPanel data={data} locale={locale} t={S} />

      {data.quote && (
        <DataStamp labels={t.data} source={data.quote.source} at={data.quote.fetchedAt} stale={data.quote.stale} locale={locale} />
      )}
      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["degerleme", "risk-yonetimi"]} />
    </MotionExperience>
  );
}
