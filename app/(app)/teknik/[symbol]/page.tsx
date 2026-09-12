import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, Reveal, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { IndicatorPanels } from "@/components/technical/IndicatorPanels";
import { LevelLadder } from "@/components/technical/LevelLadder";
import { LevelTrack } from "@/components/technical/LevelTrack";
import { changeToneClass, planPositionLabel } from "@/components/technical/TechnicalCard";
import styles from "@/components/technical/Technical.module.css";
import { EmptyState, LogoTile, Panel } from "@/components/ui/primitives";
import {
  verdictLabel,
  verdictOf,
  verdictPillClass,
  verdictTextClass,
} from "@/lib/analysis";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getDictionary, getI18n } from "@/lib/i18n";
import { articleOpenGraph, metaDescription, missingMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { pageAlternates } from "@/lib/site";
import {
  TECHNICAL_SYMBOLS,
  editionTime,
  isTechnicalSymbol,
  planPosition,
  slotLabel,
  stanceChangeLabel,
  technicalHref,
} from "@/lib/technical";
import { getTechnicalDetail } from "@/lib/technical-data";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatEtDateLong,
  formatPercent,
  formatPrice,
} from "@/lib/utils";

export async function generateMetadata(
  props: PageProps<"/teknik/[symbol]">,
): Promise<Metadata> {
  const { symbol } = await props.params;
  const { locale } = await getI18n();
  const upper = symbol.toUpperCase();
  if (!isTechnicalSymbol(upper)) return missingMetadata(locale);
  const detail = await getTechnicalDetail(upper);
  const copy = detail
    ? locale === "en"
      ? (detail.row.copy.en ?? detail.row.copy.tr)
      : detail.row.copy.tr
    : null;
  const t = getDictionary(locale);
  return {
    title: locale === "en" ? `${upper} Technical Analysis` : `${upper} Teknik Analiz`,
    /* ANALİZ YOKKEN SAYFA BOŞ BİR KABUK. Açıklaması da yoktu ve arama
       motoruna "başlık var, içerik yok" bir sayfa ilan ediliyordu; o hâlde
       dizine girmiyor, bağlantıları izleniyor. */
    description: copy ? metaDescription(copy.headline) : t.technical.noAnalysisHint,
    ...(detail ? {} : { robots: { index: false, follow: true } }),
    openGraph: detail
      ? articleOpenGraph(locale, { modifiedTime: new Date(detail.row.updatedAt).toISOString() })
      : undefined,
    /* HREFLANG YALNIZCA VAR OLAN DİLLERİ İLAN EDER — İngilizce metin yoksa
       /en adresi Türkçesini gösteriyor, o adres İngilizce sayfa değil. */
    alternates: pageAlternates(
      technicalHref(upper),
      locale,
      detail?.row.copy.en ? ["tr", "en"] : ["tr"],
    ),
  };
}

/**
 * Tek hissenin teknik analizi.
 *
 * Sıra okuyucunun sorusunun sırası: ne diyor ve neden (kapak), nereden
 * alınır nerede satılır (merdiven + değerlendirme), hangi göstergeye
 * dayanıyor (paneller), ne olursa ne olur (senaryolar), neye dikkat
 * (hacim ve takvim), daha önce ne demişti (geçmiş).
 *
 * Liste dışı sembol 404: `/teknik/aapl` bir analiz sayfası değil, "bu hisse
 * takip edilmiyor" demek. Listede olup henüz analizi olmayan sembol ise
 * sayfanın kendisini açıyor ve boş durumu gösteriyor.
 */
export default async function TechnicalDetailPage(props: PageProps<"/teknik/[symbol]">) {
  const { symbol: raw } = await props.params;
  const symbol = raw.toUpperCase();
  if (!isTechnicalSymbol(symbol)) notFound();

  const { locale, t } = await getI18n();
  const status = await getStatus();
  /* Kotasyon listenin TAMAMIYLA isteniyor, tek sembolle değil: istek içi
     önbellek anahtarı sıralanmış sembol dizesi (bkz. `getQuotes`) ve liste
     sayfasıyla aynı anahtar aynı sayıyı verir. */
  const [detail, meta, quotes] = await Promise.all([
    getTechnicalDetail(symbol),
    getSymbolNames([symbol]),
    getQuotes([...TECHNICAL_SYMBOLS], status),
  ]);
  const company = meta[symbol]?.name ?? symbol;

  const breadcrumb = (
    <nav aria-label={t.common.breadcrumb} className="flex flex-wrap items-center gap-2 text-small text-muted">
      <Link href="/teknik" className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary">
        {t.technical.title}
      </Link>
      <span aria-hidden>›</span>
      <span className="font-semibold text-strong">{symbol}</span>
    </nav>
  );

  if (!detail) {
    return (
      <MotionExperience className={directory.page}>
        {breadcrumb}
        <Panel>
          <EmptyState title={t.technical.noAnalysis} hint={t.technical.noAnalysisHint} titleAs="h1" />
        </Panel>
      </MotionExperience>
    );
  }

  const { row, previousStance, history } = detail;
  const verdict = verdictOf(row.stance);
  const change = stanceChangeLabel(verdict, previousStance, t);
  const hasEnglish = row.copy.en !== null && row.copy.en !== undefined;
  const copy = locale === "en" ? (row.copy.en ?? row.copy.tr) : row.copy.tr;
  const copyLang = locale === "en" && !hasEnglish ? "tr" : locale;
  const quote = quotes.ok ? (quotes.data[symbol] ?? null) : null;
  const price = quote?.price ?? row.snapshot.price;
  const changePct = quote ? quote.changePct : row.snapshot.changePct;
  /* ETİKET TEK YERDE: kapak ve merdiven aynı adı kullanıyor. Kotasyon yoksa
     fiyat fotoğraftan geliyor ve adı "Analiz Anında"; seans dışında "Son
     Fiyat"; yalnızca açık seansta taze kotasyon "Şu An". */
  const priceLabel = !quote
    ? t.technical.atAnalysis
    : status.session === "regular" && quotes.ok && !quotes.stale
      ? t.technical.now
      : t.market.lastPrice;
  const position = planPosition(price, row.entryLow, row.entryHigh, row.stop);
  const sectionItems = [
    { id: "technical-levels", label: t.technical.levels },
    { id: "technical-reading", label: t.technical.summary },
    { id: "technical-indicators", label: t.technical.indicators },
    { id: "technical-watch", label: t.technical.watch },
    ...(history.length > 1 ? [{ id: "technical-history", label: t.technical.history }] : []),
  ];
  const levelProps = {
    entryLow: row.entryLow,
    entryHigh: row.entryHigh,
    stop: row.stop,
    targets: row.targets,
    supports: row.supports,
    resistances: row.resistances,
  };

  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.technical.title, path: "/teknik" },
          { name: `${symbol} · ${company}`, path: technicalHref(symbol) },
        ]}
      />
      {breadcrumb}

      {/* ---- Kapak ---- */}
      <header className={styles.cover}>
        <div className={styles.coverMain} data-motion-intro>
          <div className={styles.coverIdentity}>
            <LogoTile symbol={symbol} logoUrl={meta[symbol]?.logoUrl} size="lg" />
            <div className="min-w-0">
              <h1>{symbol}</h1>
              <p className={styles.coverMeta}>
                {company} · {slotLabel(row.slot, t)} · {formatEtDateLong(row.sessionDate, locale)} ·{" "}
                <span className="numeral">{editionTime(row.sessionDate, row.slot, locale)}</span>
              </p>
            </div>
          </div>
          <div className={styles.stanceBlock}>
            <span className={styles.stanceLabel}>{t.technical.stanceLabel}</span>
            <span className={cn(styles.stanceValue, verdictTextClass(verdict))}>
              {verdictLabel(verdict, t)}
            </span>
            {change && <span className={cn(styles.change, changeToneClass(verdict))}>{change}</span>}
          </div>
          <p className={styles.coverHeadline} lang={copyLang}>
            {copy.headline}
          </p>
          {locale === "en" && !hasEnglish && (
            <p className="text-tiny text-muted">{t.technical.langNote}</p>
          )}
        </div>

        <div className={styles.coverSide}>
          <div className="flex flex-col gap-1">
            <span className={styles.stanceLabel}>{priceLabel}</span>
            <div className={styles.priceRow}>
              <span className={cn(styles.priceNow, "numeral")}>
                {formatPrice(price, locale, { currency: true })}
              </span>
              {changePct !== null && (
                <span className={cn("numeral text-read font-semibold", directionText(directionOf(changePct)))}>
                  {formatPercent(changePct, locale)}
                </span>
              )}
            </div>
            {/* Analiz anındaki fiyat ancak FARKLIYSA yazılıyor: aynı sayının
                iki etiketle yan yana durması bilgi değil. */}
            <div className={styles.priceContext}>
              {position && (
                <span className={styles.plan} data-kind={position.kind}>
                  {planPositionLabel(position, locale, t)}
                </span>
              )}
              {row.snapshot.price !== null && price !== null && Math.abs(row.snapshot.price - price) >= 0.005 && (
                <span className={styles.priceNote}>
                  {t.technical.atAnalysis}: {formatPrice(row.snapshot.price, locale, { currency: true })}
                </span>
              )}
            </div>
          </div>
          <LevelTrack price={price} {...levelProps} verdict={verdict} size="lg" locale={locale} t={t} />
        </div>
      </header>

      <SectionNav className={styles.sectionNav} label={t.technical.sectionsLabel} items={sectionItems} />

      {/* ---- Seviyeler ve değerlendirme ---- */}
      <div className={styles.twoCol}>
        <section id="technical-levels" className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.sectionTitle}>{t.technical.levels}</h2>
            <span className="text-tiny text-muted">{t.technical.levelsNote}</span>
          </div>
          <LevelLadder
            price={price}
            {...levelProps}
            copy={copy}
            verdict={verdict}
            priceLabel={priceLabel}
            lang={copyLang}
            locale={locale}
            t={t}
          />
        </section>

        <div id="technical-reading" className="flex min-w-0 flex-col gap-4">
          <section className={styles.block}>
            <h2 className={styles.sectionTitle}>{t.technical.summary}</h2>
            <p className={styles.prose} lang={copyLang}>
              {copy.summary}
            </p>
          </section>
          <section className={styles.block}>
            <h2 className={styles.sectionTitle}>{t.technical.scenarios}</h2>
            <div className={styles.scenarios} data-motion-stagger>
              <div className={styles.scenario} data-tone="up">
                <h3>{t.technical.bullCase}</h3>
                <p lang={copyLang}>{copy.bull}</p>
              </div>
              <div className={styles.scenario} data-tone="down">
                <h3>{t.technical.bearCase}</h3>
                <p lang={copyLang}>{copy.bear}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ---- Göstergeler ---- */}
      <Reveal>
        <section id="technical-indicators" className="flex flex-col gap-3">
          <h2 className={styles.sectionTitle}>{t.technical.indicators}</h2>
          <IndicatorPanels snapshot={row.snapshot} price={price} locale={locale} t={t} />
        </section>
      </Reveal>

      {/* ---- Hacim ve dikkat edilecekler ---- */}
      <div id="technical-watch" className={styles.twoCol}>
        <section className={styles.block}>
          <h2 className={styles.sectionTitle}>{t.technical.volumeRead}</h2>
          <p className={styles.prose} lang={copyLang}>
            {copy.volume}
          </p>
        </section>
        <section className={styles.block}>
          <h2 className={styles.sectionTitle}>{t.technical.watch}</h2>
          <ul className={styles.watch} lang={copyLang}>
            {copy.watch.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---- Görüş geçmişi ---- */}
      {history.length > 1 && (
        <section id="technical-history" className={styles.block}>
          <h2 className={styles.sectionTitle}>{t.technical.history}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t.technical.historyDate}</th>
                  <th scope="col">{t.technical.historyEdition}</th>
                  <th scope="col">{t.technical.historyStance}</th>
                  <th scope="col">{t.technical.entryZone}</th>
                  <th scope="col">{t.technical.stop}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => {
                  const stance = verdictOf(entry.stance);
                  const older = history[index + 1];
                  const turned = older ? stanceChangeLabel(stance, verdictOf(older.stance), t) : null;
                  return (
                    <tr key={`${entry.sessionDate}-${entry.slot}`}>
                      <td>{formatEtDateCompact(entry.sessionDate, locale)}</td>
                      <td>{slotLabel(entry.slot, t)}</td>
                      <td>
                        <span className={cn("inline-flex rounded-full px-2 py-[1px] text-nano font-bold", verdictPillClass(stance))}>
                          {verdictLabel(stance, t)}
                        </span>
                        {turned && <span className={cn("ml-2 text-nano font-bold", changeToneClass(stance))}>{turned}</span>}
                      </td>
                      <td>
                        {entry.entryLow !== null && entry.entryHigh !== null
                          ? entry.entryLow === entry.entryHigh
                            ? formatPrice(entry.entryLow, locale, { currency: true })
                            : `${formatPrice(entry.entryLow, locale, { currency: true })} – ${formatPrice(entry.entryHigh, locale, { currency: true })}`
                          : "—"}
                      </td>
                      <td>{formatPrice(entry.stop, locale, { currency: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className={styles.footNote}>
        {row.snapshot.lastSession && (
          <p>
            {t.technical.snapshotNote.replace(
              "{date}",
              formatEtDateCompact(row.snapshot.lastSession, locale),
            )}
          </p>
        )}
        <p>{t.technical.method}</p>
        <p>{t.technical.disclaimer}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={`/hisse/${symbol}`} className="font-semibold text-primary hover:text-primary-hover">
            {t.technical.companyPage} ↗
          </Link>
          <Link href="/teknik" className="font-semibold text-primary hover:text-primary-hover">
            {t.technical.allStocks} ↗
          </Link>
        </p>
      </div>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["risk-yonetimi", "emir-tipleri"]}
      />
    </MotionExperience>
  );
}
