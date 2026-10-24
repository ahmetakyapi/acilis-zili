import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { PageShare } from "@/components/article/PageShare";
import { GuideHint } from "@/components/article/GuideHint";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { timingOf } from "@/components/earnings/EarningsCalendar";
import { SymbolAnalyses } from "@/components/earnings/SymbolAnalyses";
import css from "@/components/earnings/company/CompanyEarnings.module.css";
import { EarningsVote } from "@/components/earnings/vote/EarningsVote";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import {
  ButtonLink,
  DataStamp,
  LogoTile,
  PageHeader,
  Panel,
  PanelHeader,
  TimingChip,
} from "@/components/ui/primitives";
import { analysisHref } from "@/lib/analysis";
import {
  getAnalyses,
  getEarningsForSymbol,
  getHolidays,
  getSymbolNames,
  isKnownSymbol,
} from "@/lib/data";
import { companyCopy, companyWhen, dayMonth, earningsHref, lockLabel } from "@/lib/earnings-company";
import { storyGuaranteed } from "@/lib/earnings-story";
import {
  accuracyPercent,
  beatRecord,
  boardFor,
  buildVoteView,
  tallyTotal,
} from "@/lib/earnings-vote";
import { getVoteAccuracy, getVoteBoard } from "@/lib/earnings-vote-data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { daysBetweenEt, todayEt } from "@/lib/market-hours";
import { missingMetadata } from "@/lib/page-meta";
import { zoneTag } from "@/lib/session-clock";
import { getEarningsSurprises } from "@/lib/providers/finnhub";
import { pageAlternates } from "@/lib/site";
import type { EarningsRow } from "@/lib/schema";
import {
  formatEtDateCompact,
  formatEtDateLong,
  formatMoneyCompact,
  formatPercentPlain,
  formatPrice,
  isValidSymbol,
} from "@/lib/utils";

/**
 * Şirket bazlı bilanço sayfası — `/bilancolar/[symbol]` (24 Ekim).
 *
 * "[Şirket] bilançosu ne zaman" sorusunun cevabı: `<title>` soruyu sorar ve
 * cevabı taşır, `h1` altı tek cümleyle, panelin ilk paragrafı ayrıntıyla
 * cevaplar. Metin kuralları ve gerekçesi `lib/earnings-company.ts`; üç
 * metin tek fonksiyondan (`companyCopy`) çıkıyor ki birbirini tutsun.
 *
 * ESKİ KARAR DEĞİŞTİ. Bu adres bilinçli olarak yoktu
 * (lib/admin-data.ts → `ROUTE_READ`: "sayfası olmayan bir şablon uydurmak
 * olurdu"); artık sayfası var ve ölçüm şablonu `lib/analytics.ts`te.
 *
 * Ekran sırası (CLAUDE.md "Ekran düzeni"): başlık → künye şeridi (şirket,
 * hisse bağlantısı) → Sıradaki Bilanço (tarih, ölçüler, metin, künye) →
 * oylama → okunan çeyrekler → `DataStamp` → `GuideHint`.
 *
 * Event/FAQ yapılandırılmış verisi YOK — belgeli karar
 * (`components/seo/JsonLd.tsx` başında). Yalnız kırıntı.
 */

/** Takvim satırı geçmişi: sıradaki + son rapor için yeterli derinlik. */
const CALENDAR_DEPTH = 6;
/** Okunan çeyreklerden kaçı listelenir — iki yıl. */
const ANALYSES_LIMIT = 8;

/* Künye ve gövde aynı okumayı istiyor; istek içinde tek tur. */
const loadCompany = cache(async function loadCompany(symbol: string, locale: Locale) {
  const today = todayEt();
  const [meta, rows, known, analyses, holidays] = await Promise.all([
    getSymbolNames([symbol]),
    getEarningsForSymbol(symbol, CALENDAR_DEPTH),
    isKnownSymbol(symbol),
    getAnalyses(locale, { symbols: [symbol], limit: ANALYSES_LIMIT }),
    getHolidays(),
  ]);
  /* Satırlar yeniden eskiye; sıradaki bugünden (ET) itibaren EN YAKINI. */
  const upcoming = rows.filter((row) => row.reportDate >= today);
  const next = upcoming.at(-1) ?? null;
  const previous = rows.find((row) => row.reportDate < today) ?? null;
  const name = meta[symbol]?.name ?? analyses[0]?.company ?? symbol;
  return { meta: meta[symbol], rows, next, previous, known, analyses, holidays, name, today };
});

type Loaded = Awaited<ReturnType<typeof loadCompany>>;

function textsOf(data: Loaded, symbol: string, locale: Locale, t: Dictionary) {
  const names = {
    afterClose: t.earnings.afterClose,
    beforeOpen: t.earnings.beforeOpen,
    duringMarket: t.earnings.duringMarket,
  };
  const next = data.next ? { date: data.next.reportDate, hour: data.next.hour?.trim() || null } : null;
  const when = companyWhen(next, data.holidays, locale, names);
  const lower = (text: string | null) =>
    text ? text.toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US") : null;
  const copy = companyCopy({
    name: data.name,
    symbol,
    when,
    dateLong: next ? formatEtDateLong(next.date, locale) : null,
    dateShort: next ? dayMonth(next.date, locale) : null,
    labels: t.earningsSeason.company,
    windowLower: lower(when.windowName),
  });
  return { when, copy };
}

function symbolOf(raw: string): string {
  return decodeURIComponent(raw).toUpperCase();
}

export async function generateMetadata(
  props: PageProps<"/bilancolar/[symbol]">,
): Promise<Metadata> {
  const symbol = symbolOf((await props.params).symbol);
  const { locale, t } = await getI18n();
  if (!isValidSymbol(symbol)) return missingMetadata(locale);
  const data = await loadCompany(symbol, locale);
  if (!data.known && data.analyses.length === 0 && !data.next) return missingMetadata(locale);
  const { copy } = textsOf(data, symbol, locale, t);
  return {
    title: copy.metaTitle,
    description: copy.description,
    alternates: pageAlternates(earningsHref(symbol), locale),
    /* İNCE SAYFA DİZİNE GİRMEZ: takvimde tarihi de okunmuş çeyreği de
       olmayan şirketin sayfası yalnız "henüz yok" diyor. Site haritası da
       aynı ölçütle listeliyor (app/sitemap.ts). `follow` açık. */
    ...(data.next || data.analyses.length > 0 ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function CompanyEarningsPage(props: PageProps<"/bilancolar/[symbol]">) {
  const symbol = symbolOf((await props.params).symbol);
  if (!isValidSymbol(symbol)) notFound();
  const { locale, t } = await getI18n();
  const data = await loadCompany(symbol, locale);
  if (!data.known && data.analyses.length === 0 && !data.next) notFound();

  const c = t.earningsSeason.company;
  const v = t.earningsSeason.vote;
  const { when, copy } = textsOf(data, symbol, locale, t);
  const href = earningsHref(symbol);
  const session = await auth();
  const userId = session?.user?.id ?? null;

  /* Oy tahtası son rapordan sıradakine — iki hedef, tek sorgu çifti. */
  const voteTargets = [data.previous, data.next].filter((row): row is EarningsRow => row !== null);
  /* Beklenti karnesi hisse sayfasının Geçmiş Bilançolar tablosuyla AYNI
     uçtan (`getEarningsSurprises`, altı saat önbellekli; iki sayfa tek
     tur). Sağlayıcı düşerse karne basılmaz, panel yine çizilir. */
  const [board, record, surprises] = await Promise.all([
    voteTargets.length > 0
      ? getVoteBoard(userId, voteTargets[0].reportDate, voteTargets.at(-1)!.reportDate, [symbol])
      : Promise.resolve(null),
    userId ? getVoteAccuracy(userId, Number(data.today.slice(0, 4))) : Promise.resolve(null),
    getEarningsSurprises(symbol).catch(() => null),
  ]);
  const karne = surprises?.ok ? beatRecord(surprises.data) : null;
  const now = new Date();
  /* `boardFor`: tarih anahtarı kaymış eski oylar da aynı rapora sayılır
     (gerekçe `lib/earnings-vote.ts`, "TARİH ANAHTARI KAYABİLİR"). */
  const viewOf = (row: EarningsRow) =>
    buildVoteView({ row, holidays: data.holidays, now, ...(board ? boardFor(board, row) : { mine: null, tally: null }) });
  const nextView = board?.available && data.next ? viewOf(data.next) : null;
  /* Son raporun sonucu ancak gösterecek bir şey varsa: okurun oyu ya da
     topluluğun dağılımı. Kimsenin oy vermediği geçmiş rapor panelde yer
     tutmaz. */
  const previousView = board?.available && data.previous ? viewOf(data.previous) : null;
  const showPrevious =
    previousView !== null && (previousView.mine !== null || (previousView.tally !== null && tallyTotal(previousView.tally) > 0));
  const currency = data.meta?.currency || true;
  const epsLine = (row: EarningsRow) =>
    row.epsActual !== null && row.epsEstimate !== null
      ? v.epsLine
          .replace("{actual}", formatPrice(row.epsActual, locale, { currency }))
          .replace("{estimate}", formatPrice(row.epsEstimate, locale, { currency }))
      : null;
  const accuracy = record?.available ? record.accuracy : null;
  const accuracyPct = accuracy ? accuracyPercent(accuracy) : null;

  const tag = zoneTag(locale);
  const timing = data.next ? timingOf(data.next.hour?.trim() || null, t) : null;
  const clockLine =
    when.window === "amc" && when.closeClock
      ? `~${when.closeClock} ${tag.primary} · ${when.secondaryClock} ${tag.secondary}`
      : when.window === "bmo" && when.openClock
        ? `${c.openLabel} ${when.openClock} ${tag.primary} · ${when.secondaryClock} ${tag.secondary}`
        : null;
  const daysLeft = data.next ? daysBetweenEt(data.today, data.next.reportDate) : null;
  const latest = data.analyses[0] ?? null;

  return (
    <MotionExperience className={css.page}>
      <ScrollProgress />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: c.breadcrumb, path: "/bilancolar" },
          { name: data.name, path: href },
        ]}
      />

      <nav aria-label={t.common.breadcrumb} className="flex flex-wrap items-center gap-2 text-small text-muted">
        <Link href="/bilancolar" className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary">
          {c.breadcrumb}
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-strong">{data.name}</span>
      </nav>

      {/* PAYLAŞ BAŞLIĞIN SAĞINDA — sitenin öteki sayfalarının kalıbı
          (`/teknik`, `/bilancolar`, `/rehber`: `PageHeader share=`). Yol
          satırında başlık kartının DIŞINDA duruyordu (24 Ekim denetimi). */}
      <PageHeader
        title={copy.title}
        subtitle={copy.answer}
        share={<PageShare compactOnMobile align="right" path={href} title={copy.title} locale={locale} t={t} />}
      />

      {/* ---- Künye şeridi: şirket ve hisse sayfası ---- */}
      <div className={css.identity}>
        <LogoTile symbol={symbol} logoUrl={data.meta?.logoUrl} size="lg" />
        <div className="min-w-0">
          <p className="text-read font-bold text-strong">{symbol}</p>
          <p className="truncate text-small text-muted">{data.name}</p>
        </div>
        <ButtonLink href={`/hisse/${symbol}`} size="sm" className={css.stockLink}>
          {c.stockPage}
          <ArrowUpRight size={14} weight="bold" aria-hidden />
        </ButtonLink>
      </div>

      {/* ---- Sıradaki bilanço ---- */}
      <Panel>
        <PanelHeader
          title={data.next ? c.nextTitle : c.noneTitle}
          meta={when.estimated ? c.estimatedTag : undefined}
        />
        <div className={css.body}>
          {data.next && (
            <div className={css.when}>
              <p className={css.date}>
                {formatEtDateLong(data.next.reportDate, locale)}
              </p>
              <div className={css.windowRow}>
                {timing && <TimingChip tone={timing.tone}>{timing.label}</TimingChip>}
                {clockLine && <span className="figure text-small text-body">{clockLine}</span>}
              </div>
            </div>
          )}

          {data.next && (
            <dl className={css.figures}>
              {daysLeft !== null && (
                <div>
                  <dt>{c.daysLeft}</dt>
                  <dd className="figure">{daysLeft === 0 ? c.today : c.daysValue.replace("{n}", String(daysLeft))}</dd>
                </div>
              )}
              {data.next.epsEstimate !== null && (
                <div>
                  <dt>{c.epsEstimate}</dt>
                  <dd className="figure">{formatPrice(data.next.epsEstimate, locale, { currency })}</dd>
                </div>
              )}
              {data.next.revenueEstimate !== null && (
                <div>
                  <dt>{c.revenueEstimate}</dt>
                  <dd className="figure">
                    {formatMoneyCompact(data.next.revenueEstimate, locale, data.meta?.currency)}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <p className={css.lead}>{copy.lead}</p>

          {data.next && (
            <AddToCalendar
              symbol={symbol}
              date={data.next.reportDate}
              label={t.earnings.addToCalendar}
              className="mb-0 w-fit"
            />
          )}

          {data.next && (
            <div className={css.notes}>
              <p>{c.sourceNote}</p>
            </div>
          )}
        </div>
      </Panel>

      {/* ---- Beklentiyi Geçer mi? ----
          Tablo yoksa (`available: false`) panel hiç basılmıyor. */}
      {(nextView || showPrevious) && (
        <Panel>
          <PanelHeader title={v.title} />
          <div className={css.body}>
            {/* İKİ KOLON: solda oy (düğmeler ya da sonuç çizgisi), sağda
                hissenin beklenti karnesi. Okur "geçer mi" derken şirketin
                son dört çeyreğine bakıyordu ve o sayı hisse sayfasının
                dibindeydi. Karne yoksa (sağlayıcı düştü) tek kolon. */}
            <div className={karne ? css.voteGrid : undefined}>
              <div className={css.voteMain}>
                {nextView && (
                  <EarningsVote
                    view={nextView}
                    signedIn={userId !== null}
                    labels={v}
                    lock={lockLabel(new Date(nextView.lockAt), locale)}
                    variant="panel"
                    signInHref={`/giris?devam=${encodeURIComponent(href)}`}
                    locale={locale}
                    outcomeLine={data.next ? epsLine(data.next) : null}
                  />
                )}
                {showPrevious && previousView && data.previous && (
                  <div className={nextView ? css.previous : undefined}>
                    <p className={css.previousTitle}>
                      {v.previousTitle} · {formatEtDateCompact(data.previous.reportDate, locale)}
                    </p>
                    <EarningsVote
                      view={previousView}
                      signedIn={userId !== null}
                      labels={v}
                      lock={lockLabel(new Date(previousView.lockAt), locale)}
                      variant="panel"
                      signInHref={`/giris?devam=${encodeURIComponent(href)}`}
                      locale={locale}
                      outcomeLine={epsLine(data.previous)}
                    />
                  </div>
                )}
              </div>
              {karne && (
                <aside className={css.karne} aria-label={v.recordTitle}>
                  <p className={css.karneLabel}>{v.recordTitle}</p>
                  <p className={css.karneValue}>
                    <span className="figure">
                      {karne.beats}/{karne.total}
                    </span>
                  </p>
                  {/* Çeyrek başına bir şerit, eskiden yeniye: geçti yukarı,
                      kaçırdı aşağı rengi, denk nötr çizgi. Sayının kopyası. */}
                  <span aria-hidden className={css.karnePips} data-motion-track>
                    {karne.marks.map((mark, index) => (
                      <span key={index} className={css.karnePip} data-mark={mark} data-motion-draw="line" />
                    ))}
                  </span>
                  <p className={css.karneNote}>
                    {v.recordNote.replace("{n}", String(karne.total)).replace("{beats}", String(karne.beats))}
                  </p>
                </aside>
              )}
            </div>
            {accuracy && accuracy.scored > 0 && (
              <p className={css.record}>
                <span className="text-muted">
                  {v.accuracy.replace("{year}", data.today.slice(0, 4))}
                </span>{" "}
                <span className="figure font-semibold text-strong">
                  {v.accuracyValue
                    .replace("{correct}", String(accuracy.correct))
                    .replace("{scored}", String(accuracy.scored))}
                  {accuracyPct !== null && ` · ${formatPercentPlain(accuracyPct, locale, 0)}`}
                </span>
                {accuracy.pending > 0 && (
                  <span className="text-muted"> · {v.accuracyNote.replace("{pending}", String(accuracy.pending))}</span>
                )}
              </p>
            )}
            <div className={css.notes}>
              <p>
                <strong>{v.disclaimer}.</strong> {v.disclaimerNote}
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* HİKÂYE GİRİŞİ ANALİZ PANELİNİN İÇİNDE, son satır olarak — paneller
          arasında tek başına bir bağlantı satırıydı ve bir panelin künyesi
          gibi değil sayfanın boşluğunda yüzen bir satır gibi okunuyordu
          (24 Ekim denetimi). Hikâye o analizin görünümü; yeri de o panel. */}
      <SymbolAnalyses
        rows={data.analyses}
        locale={locale}
        t={t}
        footer={
          latest && storyGuaranteed({ eps: latest.eps, epsSurprisePct: latest.epsSurprisePct, guidance: null }) ? (
            <Link href={`${analysisHref(latest.symbol, latest.period)}/hikaye`} className={css.storyEntry}>
              <span aria-hidden className={css.storyStack}>
                <span />
                <span />
                <span />
              </span>
              <span className={css.storyText}>
                <span className={css.storyTitle}>
                  {latest.periodLabel} · {c.storyLink}
                </span>
                <span className={css.storyHint}>{t.earningsSeason.story.linkHint}</span>
              </span>
              <ArrowUpRight size={16} weight="bold" aria-hidden className={css.storyArrow} />
            </Link>
          ) : null
        }
      />

      {data.next && (
        <DataStamp source="finnhub" at={data.next.updatedAt} locale={locale} labels={t.data} />
      )}
      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["bilanco"]} />
    </MotionExperience>
  );
}
