import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { CongressBody, CongressStrip } from "@/components/investors/CongressDetail";
import { FundBody, FundStrip } from "@/components/investors/FundDetail";
import { InvestorHero } from "@/components/investors/InvestorHero";
import { filedLabel, asOfLabel, quarterLabel } from "@/components/investors/format";
import styles from "@/components/investors/Investors.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { getSymbolNames } from "@/lib/data";
import { getI18n, type Dictionary } from "@/lib/i18n";
import { getInvestorDetail } from "@/lib/investor-data";
import { INVESTOR_SLUGS, investorBySlug, investorFirm, investorPortrait, type Investor } from "@/lib/investors";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { formatMoneyCompact } from "@/lib/utils";

/**
 * Ünlü yatırımcının sayfası (28 Eylül).
 *
 * Sıra sitenin kuralı: kapak (portre, ad, tek cümle, portföy değeri) →
 * künye şeridi (dönem, bildirim, pozisyon, kaynak) → ana görsel (13F'te
 * portföy haritası, Kongre'de hisse bazında işlem çizgileri) → hareketler
 * ve tam tablo → geçmiş → künyeler ve uyarı panelin içinde → damga →
 * rehber. İki tür aynı iskeleti paylaşıyor; gövde türe göre.
 *
 * Veri yoksa (tablo yok ya da henüz senkron koşmadı) kapak yine basılıyor,
 * gövdenin yerinde boş durum. Yatırımcı listede yoksa 404.
 */

export async function generateStaticParams() {
  return INVESTOR_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/yatirimcilar/[slug]">) {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const investor = investorBySlug(slug);
  if (!investor) return missingMetadata(locale);
  const firm = investorFirm(investor, locale);
  return {
    title:
      locale === "en"
        ? `${investor.name} Portfolio: ${firm} Holdings, Buys and Sells`
        : `${investor.name} Portföyü: ${firm} Hisseleri, Alım ve Satışlar`,
    description: metaDescription(locale === "en" ? investor.tagline.en : investor.tagline.tr),
    alternates: pageAlternates(`/yatirimcilar/${investor.slug}`, locale),
  };
}

export default async function InvestorPage(props: PageProps<"/yatirimcilar/[slug]">) {
  const { slug } = await props.params;
  const investor = investorBySlug(slug);
  if (!investor) notFound();
  const { locale, t } = await getI18n();
  const ti = t.investors;
  const detail = await getInvestorDetail(investor.slug);

  const tickers =
    detail?.kind === "13f"
      ? Object.values(detail.tickers).filter((ticker): ticker is string => Boolean(ticker))
      : detail?.kind === "congress"
        ? detail.trades.map((trade) => trade.ticker).filter((ticker): ticker is string => Boolean(ticker))
        : [];
  const known = await getSymbolNames(tickers);
  const closed = investor.status === "closed";

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: ti.eyebrow, path: "/yatirimcilar" },
          { name: investor.name, path: `/yatirimcilar/${investor.slug}` },
        ]}
      />
      <Link
        href="/yatirimcilar"
        className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {ti.back}
      </Link>

      {detail?.kind === "13f" ? (
        <>
          <InvestorHero
            investor={investor}
            locale={locale}
            t={ti}
            figure={formatMoneyCompact(detail.diff.longValue, locale)}
            figureLabel={ti.portfolioValue}
            figureMeta={
              <>
                <span className="numeral">{quarterLabel(detail.period, ti)}</span>
                <span className="numeral">{ti.positions.replace("{count}", String(detail.diff.positions.length))}</span>
              </>
            }
            note={closed ? ti.closedNote : undefined}
          />
          <FundStrip detail={detail} locale={locale} t={ti} />
          <FundBody detail={detail} investor={investor} known={known} locale={locale} t={ti} />
          <Notes investor={investor} t={t}>
            <p className={styles.note}>{ti.note13f}</p>
            <p className={styles.note}>{ti.noteMoves}</p>
            {detail.valueScaled && <p className={styles.note}>{ti.noteScaled}</p>}
            {detail.amendments > 0 && (
              <p className={styles.note}>{ti.noteAmend.replace("{count}", String(detail.amendments))}</p>
            )}
            {detail.diff.positions.some((position) => !detail.tickers[position.cusip]) && (
              <p className={styles.note}>{ti.noteTickers}</p>
            )}
          </Notes>
          <DataStamp
            labels={t.data}
            source="sec"
            locale={locale}
            note={`${filedLabel(detail.filedAt, locale, ti)} · ${asOfLabel(detail.period, locale, ti)}`}
          />
        </>
      ) : detail?.kind === "congress" ? (
        <>
          <InvestorHero
            investor={investor}
            locale={locale}
            t={ti}
            figure={String(detail.trades.length)}
            figureLabel={ti.stripTrades}
            figureMeta={
              detail.filings[0] ? <span className="numeral">{filedLabel(detail.filings[0].filedAt, locale, ti)}</span> : undefined
            }
          />
          <CongressStrip detail={detail} locale={locale} t={ti} />
          <CongressBody detail={detail} known={known} locale={locale} t={ti} />
          <Notes investor={investor} t={t}>
            <p className={styles.note}>{ti.congressNote}</p>
            <p className={styles.note}>{ti.congressOwnerNote}</p>
          </Notes>
          {detail.filings[0] && (
            <DataStamp
              labels={t.data}
              source="house"
              locale={locale}
              note={filedLabel(detail.filings[0].filedAt, locale, ti)}
            />
          )}
        </>
      ) : (
        <>
          <InvestorHero investor={investor} locale={locale} t={ti} figure={null} figureLabel={ti.portfolioValue} />
          <Panel>
            <EmptyState title={ti.emptyTitle} hint={ti.emptyHint} scene="lost" />
          </Panel>
        </>
      )}

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["13f-nedir", "opsiyonlar"]} />
    </MotionExperience>
  );
}

/**
 * Künyeler ve uyarı — TEK panelde, hairline ile ayrılmış düz paragraflar
 * (ekran düzeni kuralı 6). Fotoğraf atfı da burada: lisans ve kaynak
 * bağlantılı (CC BY / BY-SA bunu istiyor; kamu malında da kaynak gösterilir).
 */
function Notes({ investor, t, children }: { investor: Investor; t: Dictionary; children: React.ReactNode }) {
  const ti = t.investors;
  const photo = investorPortrait(investor.slug);
  return (
    <Panel>
      <PanelHeader title={ti.disclaimerTitle} />
      <p className="border-t border-line px-4 py-4 text-read leading-[27px] text-body sm:px-5">{ti.disclaimer}</p>
      {children}
      {photo && (
        <p className={styles.note}>
          {ti.photoCredit}:{" "}
          <a href={photo.source} target="_blank" rel="noopener noreferrer" className={styles.noteLink}>
            {photo.author}
          </a>
          {photo.license && photo.licenseUrl && (
            <>
              {" · "}
              <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer license" className={styles.noteLink}>
                {photo.license === "Public Domain" ? ti.publicDomain : photo.license}
              </a>
            </>
          )}
          {" · "}
          {ti.photoCropped}
        </p>
      )}
    </Panel>
  );
}
