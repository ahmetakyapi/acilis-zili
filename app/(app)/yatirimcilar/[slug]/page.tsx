import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { CongressBody, CongressStrip } from "@/components/investors/CongressDetail";
import { FundBody, FundStrip } from "@/components/investors/FundDetail";
import { InvestorHero } from "@/components/investors/InvestorHero";
import { PageShare } from "@/components/article/PageShare";
import { filedLabel, asOfLabel, quarterLabel } from "@/components/investors/format";
import styles from "@/components/investors/Investors.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { getSymbolNames } from "@/lib/data";
import { getArkActivity } from "@/lib/ark-data";
import { ArkTrades } from "@/components/investors/ArkTrades";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getInvestorDetail } from "@/lib/investor-data";
import { INVESTOR_SLUGS, investorBySlug, investorFirm, investorPortrait, type Investor } from "@/lib/investors";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { formatMoneyCompact, plural } from "@/lib/utils";

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
    /* Kongre üyesinin "portföyü" ve "kurumu" yok: başlık "Nancy Pelosi
       Portfolio: U.S. House of Representatives Holdings" (93 karakter)
       çıkıyordu. Bildirilen işlemler (25 Ekim). */
    title:
      investor.kind === "congress"
        ? locale === "en"
          ? `${investor.name} Stock Trades: Disclosed Buys and Sells`
          : `${investor.name} Hisse İşlemleri: Bildirilen Alım ve Satışlar`
        : locale === "en"
          ? `${investor.name} Portfolio: ${firm} Holdings, Buys and Sells`
          : `${investor.name} Portföyü: ${firm} Hisseleri, Alım ve Satışlar`,
    /* İLK CÜMLE SAYFANIN NE OLDUĞU (25 Ekim). Sorgular "warren buffett
       portfolio", "li lu portfolio", "carl icahn portfolio" (EN, sıra
       55-80); açıklama yalnız yatırımcının tanıtım cümlesiydi. Veri
       kaynağı adıyla söyleniyor: 13F ya da Kongre işlem bildirimi. */
    description: metaDescription(`${investorLead(investor, firm, locale)} ${locale === "en" ? investor.tagline.en : investor.tagline.tr}`),
    alternates: pageAlternates(`/yatirimcilar/${investor.slug}`, locale),
  };
}

/** Açıklamanın ilk cümlesi — sayfanın verisi hangi bildirimden geliyor. */
function investorLead(investor: Investor, firm: string, locale: Locale): string {
  if (investor.kind === "congress") {
    return locale === "en"
      ? `Stock trades disclosed by ${investor.name}: purchases and sales.`
      : `${investor.name} adına bildirilen hisse işlemleri: alımlar ve satışlar.`;
  }
  return locale === "en"
    ? `${firm} portfolio from its latest 13F filing: holdings and the quarter's buys and sells.`
    : `Son 13F bildirimine göre ${firm} portföyü: elindeki hisseler, çeyreğin alımları ve satışları.`;
}

/** Günlük ETF dosyaları olan tek yatırımcı. */
const ARK_INVESTOR = "cathie-wood";

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
  const [known, ark] = await Promise.all([
    getSymbolNames(tickers),
    /* ARK'ın günlük dosyaları yalnızca Cathie Wood'u anlatıyor. */
    investor.slug === ARK_INVESTOR ? getArkActivity() : Promise.resolve(null),
  ]);
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
            share={<PageShare path={`/yatirimcilar/${investor.slug}`} title={`${investor.name} · ${ti.eyebrow}`} locale={locale} t={t} />}
            locale={locale}
            t={ti}
            figure={formatMoneyCompact(detail.diff.longValue, locale)}
            figureLabel={ti.portfolioValue}
            figureMeta={
              <>
                <span className="numeral">{quarterLabel(detail.period, ti)}</span>
                <span className="numeral">{plural(detail.diff.positions.length, ti.positionsOne, ti.positions).replace("{count}", String(detail.diff.positions.length))}</span>
              </>
            }
            note={
              closed
                ? (investor.closedOn ? ti.closedNote : ti.closedNoteUndated)
                    .replace("{firm}", investorFirm(investor, locale))
                    .replace(
                      "{date}",
                      investor.closedOn
                        ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
                            month: "long",
                            year: "numeric",
                            timeZone: "UTC",
                          }).format(new Date(`${investor.closedOn}-15T12:00:00Z`))
                        : "",
                    )
                    .replace("{quarter}", quarterLabel(detail.period, ti))
                : undefined
            }
          />
          <FundStrip detail={detail} locale={locale} t={ti} />
          {ark && <ArkTrades activity={ark} locale={locale} t={t} />}
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
            share={<PageShare path={`/yatirimcilar/${investor.slug}`} title={`${investor.name} · ${ti.eyebrow}`} locale={locale} t={t} />}
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
          <InvestorHero investor={investor} locale={locale} t={ti} figure={null} figureLabel={ti.portfolioValue} share={<PageShare path={`/yatirimcilar/${investor.slug}`} title={`${investor.name} · ${ti.eyebrow}`} locale={locale} t={t} />} />
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
