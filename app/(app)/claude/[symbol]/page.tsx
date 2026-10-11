import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, LogoTile, PageHeader, TabBar, TabItem, ButtonLink } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { AnalysisReport } from "@/components/ai/AnalysisReport";
import { ClaudeWorkbench } from "@/components/ai/ClaudeWorkbench";
import { ReportTimeline, type TimelineItem } from "@/components/ai/ReportTimeline";
import { initialsOf } from "@/lib/avatars";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import type { FilmBar } from "@/components/ai/AnalysisFilm";
import styles from "@/components/ai/Claude.module.css";
import { analysisAccess } from "@/lib/ai-analysis-access";
import { getSymbolReport, listSymbolReports, type ReportSummary } from "@/lib/ai-analysis-reports";
import { FOCUS_OF, istanbulDay, nextReportAt, type AnalysisFocus } from "@/lib/ai-analysis-core";
import { getNewsForSymbol, getStatus, getSymbolNames, isKnownSymbol } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import { logoSrc } from "@/lib/logos";
import { completedBars } from "@/lib/technical";

/** Film: son 3 ayın en fazla bu kadar seansı (mum genişliği okunur kalsın). */
const FILM_SESSIONS = 60;
const FILM_HEADLINES = 5;
/** Zaman çizelgesinde en fazla bu kadar rapor; fazlası Geçmiş sekmesinde. */
const TIMELINE_REPORTS = 3;
const TABS = ["rapor", "yeni", "gecmis"] as const;
type Tab = (typeof TABS)[number];

const symbolOf = (raw: string) => decodeURIComponent(raw).toUpperCase();

/* Yapay zekâ metni ve o anın fotoğrafı: dizine girmez (bağlantılar izlenir). */
export async function generateMetadata(props: PageProps<"/claude/[symbol]">): Promise<Metadata> {
  const { symbol: raw } = await props.params;
  const symbol = symbolOf(raw);
  const { t } = await getI18n();
  return { title: `${symbol} · ${t.aiAnalysis.claude.title}`, description: t.aiAnalysis.claude.subtitle, robots: { index: false, follow: true } };
}

export default async function ClaudePage(props: PageProps<"/claude/[symbol]">) {
  const [{ symbol: raw }, params] = await Promise.all([props.params, props.searchParams]);
  const symbol = symbolOf(raw);
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) || !(await isKnownSymbol(symbol))) notFound();
  const { locale, t } = await getI18n();
  const A = t.aiAnalysis;
  const C = A.claude;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  let access: Awaited<ReturnType<typeof analysisAccess>> = null;
  try { access = viewerId && process.env.CLAUDE_ANALYSIS_API_KEY && process.env.CLAUDE_ANALYSIS_DISABLED !== "1" ? await analysisAccess() : null; } catch { access = null; }

  const [reports, names] = await Promise.all([listSymbolReports(symbol, viewerId), getSymbolNames([symbol]).catch(() => ({} as Awaited<ReturnType<typeof getSymbolNames>>))]);
  const meta = names[symbol];
  const logoUrl = meta?.logoUrl ?? logoSrc(symbol, null);
  const wantedId = typeof params.rapor === "string" ? params.rapor : null;
  const wanted = wantedId ? reports.find(r => r.id === wantedId) ?? null : null;
  // Adresteki rapor öteki odaktaysa sayfa o odakta açılır; odak kartı ile rapor aynı şeyi söylesin.
  const focus: AnalysisFocus = wanted ? FOCUS_OF[wanted.horizon] : params.odak === "secim" ? "selection" : "technical";
  const ofFocus = reports.filter(r => FOCUS_OF[r.horizon] === focus);
  // Seçili rapor: adresteki kimlik (bu hissenin raporuysa), yoksa bu odağın bu dildeki en yenisi, yoksa herhangi dilde en yenisi.
  const selected = wanted || ofFocus.find(r => r.locale === locale) || ofFocus[0] || null;
  const tab: Tab = TABS.includes(params.sekme as Tab) ? params.sekme as Tab : selected ? "rapor" : "yeni";
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
  const date = (iso: string) => new Date(iso).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "long", timeStyle: "short" });
  const href = (next: { tab?: Tab; focus?: AnalysisFocus; id?: string }) => {
    const f = next.focus ?? focus;
    return `/claude/${encodeURIComponent(symbol)}?odak=${f === "technical" ? "teknik" : "secim"}&sekme=${next.tab ?? tab}${next.id ? `&rapor=${next.id}` : ""}`;
  };

  const status = await getStatus();
  const nowAt = new Date();
  // Önerilen sonraki rapor: son rapordan bekleme (teknik 1 sa, seçim 1 gün); piyasa
  // o rapordan beri kapalıysa açılış zili. Fiyat seans sonu + gecikmeye kadar akar (`sessionEnd`).
  const next = ofFocus[0] ? nextReportAt(new Date(ofFocus[0].generatedAt), focus, { flowing: nowAt < status.sessionEnd, sessionEnd: status.sessionEnd, nextOpen: status.nextOpen }) : null;
  const shortDay = (iso: string) => istanbulDay(new Date(iso)) === istanbulDay(nowAt) ? null
    : new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", day: "numeric", month: "short" });
  const stamp = (iso: string) => { const d = shortDay(iso); return d ? `${d} ${time(iso)}` : time(iso); };
  const timelineItems: TimelineItem[] = ofFocus.slice(0, TIMELINE_REPORTS).reverse().map(r => ({
    id: r.id, href: href({ tab: "rapor", id: r.id }), verdict: r.verdict, score: r.score, at: r.generatedAt,
    time: time(r.generatedAt), day: shortDay(r.generatedAt), author: r.author, mine: r.mine, current: tab === "rapor" && r.id === selected?.id,
  }));
  const timeline = <ReportTimeline items={timelineItems} next={next} nextLabel={next ? stamp(next.at) : null} now={nowAt.toISOString()} locale={locale} t={A} focus={focus}
    more={ofFocus.length > TIMELINE_REPORTS ? href({ tab: "gecmis" }) : null} />;
  const [result, quotes, film] = await Promise.all([
    tab === "rapor" && selected ? getSymbolReport(symbol, selected.id) : Promise.resolve(null),
    tab === "rapor" && selected ? getQuotes([symbol], status).catch(() => null) : Promise.resolve(null),
    tab === "yeni" && access ? loadFilm(symbol, status) : Promise.resolve({ bars: [], headlines: [] }),
  ]);
  const quote = quotes?.ok && !quotes.stale ? quotes.data[symbol] : null;

  const focusCard = (f: AnalysisFocus) => {
    const latest = reports.find(r => FOCUS_OF[r.horizon] === f);
    // Mürekkep çizimi: teknik için grafik, seçim için defter sahnesi (lib/ink/scenes.ts); bir kez oynar.
    return <Link key={f} href={href({ focus: f, tab: tab === "gecmis" ? "gecmis" : latest ? "rapor" : "yeni" })} scroll={false}
      className={styles.focusCard} aria-current={f === focus ? "true" : undefined} data-verdict={latest?.verdict}>
      <span className={styles.focusArt} aria-hidden><InkCanvas scene={f === "technical" ? "chart" : "ledger"} seed={f === "technical" ? 7 : 13} /></span>
      <span className={styles.focusBody}>
        <span className={styles.focusName}>{f === "technical" ? A.focus.technical : A.focus.selection}</span>
        <span className={styles.focusHint}>{f === "technical" ? A.focus.technicalHint : A.focus.selectionHint}</span>
        {latest ? <span className={styles.focusLatest}>
          {latest.score !== null && <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={34} />}
          <b>{A.verdicts[latest.verdict]}</b><span>{date(latest.generatedAt)}</span>
        </span> : <span className={styles.focusLatest}><span>{A.cta.none}</span></span>}
      </span>
    </Link>;
  };

  return <MotionExperience className={polish.page}>
    <ScrollProgress />
    <PageHeader title={C.title} subtitle={C.subtitle} />
    <div className={styles.identity}>
      <LogoTile symbol={symbol} logoUrl={meta?.logoUrl} size="lg" />
      <div className={styles.identityText}>
        <span className={styles.identitySymbol}>{symbol}</span>
        <span className={styles.identityName}>{meta?.name ?? ""}</span>
      </div>
      <nav className={styles.identityLinks} aria-label={symbol}>
        <Link href={`/hisse/${encodeURIComponent(symbol)}`}>{t.nav.companies}</Link>
        <Link href={`/teknik/${symbol.toLowerCase()}`}>{t.nav.technical}</Link>
        <Link href={`/hisse-secimi/${encodeURIComponent(symbol)}`}>{t.screening.title}</Link>
      </nav>
    </div>

    <div className={styles.focusRow} role="group" aria-label={A.focus.label}>{(["technical", "selection"] as const).map(focusCard)}</div>

    <TabBar label={C.title} className={styles.tabs}>
      {TABS.map(key => <TabItem key={key} href={href({ tab: key })} active={tab === key} underlineId="claude-tabs">
        {key === "rapor" ? C.tabs.report : key === "yeni" ? C.tabs.create : `${C.tabs.history}${reports.length ? ` (${reports.length})` : ""}`}
      </TabItem>)}
    </TabBar>

    {tab === "rapor" && (result && selected ? <div className={styles.reportWrap}>
      <div className={styles.reportBar}>
        <div className={styles.reportMeta}>
          <p className={styles.createdAt}>{C.createdAt.replace("{date}", date(result.generatedAt))}{selected.locale !== locale ? ` ${C.otherLocale}` : ""}</p>
          {selected.author && <p className={styles.byline}>
            <AvatarTile icon={selected.author.icon} color={selected.author.color} initials={initialsOf(selected.author.name, locale)} className={styles.bylineAvatar} />
            <span>{C.timeline.author}</span><b>{selected.author.name}</b>{selected.mine && <i>{C.timeline.mine}</i>}
          </p>}
        </div>
        {/* Rapor varken de yeniden üretilebilir (sabah ve akşam iki rapor gibi): düğme her zaman burada. */}
        {access && <ButtonLink href={href({ tab: "yeni" })} variant="primary" size="sm" scroll={false} className={styles.regen}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>{C.regenerate}
        </ButtonLink>}
      </div>
      {timeline}
      <AnalysisReport result={result} t={A} locale={locale} symbol={symbol} horizon={selected.horizon} categoryNames={t.screening.categories} fresh={params.yeni === "1"}
        current={quote ? { price: quote.price, at: quote.tradedAt ? new Date(quote.tradedAt).toISOString() : null, realtime: !!quote.realtime } : null} />
    </div> : <EmptyState title={C.emptyTitle} hint={access ? C.emptyHint : C.emptyHintGuest} scene="chart"
      action={access ? <ButtonLink href={href({ tab: "yeni" })} variant="primary">{C.createCta}</ButtonLink> : undefined} />)}

    {tab === "yeni" && <ClaudeWorkbench symbol={symbol} name={meta?.name ?? ""} logoUrl={logoUrl} locale={locale} t={A} focus={focus}
      canGenerate={!!access} signedIn={!!viewerId} remaining={access?.remaining ?? null} limit={access?.dailyLimit ?? null}
      latest={ofFocus[0] ? { href: href({ tab: "rapor", id: ofFocus[0].id }), verdict: ofFocus[0].verdict, score: ofFocus[0].score, when: date(ofFocus[0].generatedAt) } : null}
      inProgress={!!access?.lockId && !!access?.lockUntil && access.lockUntil > new Date()}
      next={next} nextLabel={next ? stamp(next.at) : null} now={nowAt.toISOString()}
      bars={film.bars} headlines={film.headlines} />}
    {tab === "yeni" && ofFocus.length > 0 && timeline}

    {tab === "gecmis" && <HistoryList reports={reports} A={A} locale={locale} date={date} href={(r: ReportSummary) => href({ tab: "rapor", focus: FOCUS_OF[r.horizon], id: r.id })} />}
  </MotionExperience>;
}

function HistoryList({ reports, A, locale, date, href }: { reports: ReportSummary[]; A: Awaited<ReturnType<typeof getI18n>>["t"]["aiAnalysis"]; locale: string; date: (iso: string) => string; href: (r: ReportSummary) => string }) {
  if (!reports.length) return <EmptyState title={A.claude.historyEmpty} compact />;
  return <ol className={styles.history} data-motion-stagger>
    {reports.map(r => <li key={r.id}>
      <Link href={href(r)} scroll={false} className={styles.historyRow} data-verdict={r.verdict}>
        {r.score !== null ? <ScoreRing score={r.score} verdict={r.verdict === "insufficient" ? "hold" : r.verdict} size={44} /> : <span />}
        <span className={styles.historyVerdict}>{A.verdicts[r.verdict]}</span>
        <span className={styles.historyFocus}>{FOCUS_OF[r.horizon] === "technical" ? A.focus.technical : A.focus.selection}</span>
        <span className={styles.historyDate}>{date(r.generatedAt)} · TR</span>
        {r.author ? <span className={styles.historyAuthor}>
          <AvatarTile icon={r.author.icon} color={r.author.color} initials={initialsOf(r.author.name, locale)} className={styles.tlAvatar} />
          <span><span className="sr-only">{A.claude.timeline.author}: </span>{r.author.name}</span>
        </span> : <span className={styles.historyAuthor} />}
        <span className={styles.historyTags}>{r.locale.toUpperCase()}{r.mine && <b>{A.claude.mine}</b>}</span>
      </Link>
    </li>)}
  </ol>;
}

/** Film için O HİSSENİN verisi: son 60 tamamlanmış günlük mum ve son haber başlıkları (Türkçesi varsa). */
async function loadFilm(symbol: string, status: Awaited<ReturnType<typeof getStatus>>): Promise<{ bars: FilmBar[]; headlines: string[] }> {
  const [bars, news] = await Promise.all([
    getChartBarsMulti([symbol], "6M", status).catch(() => ({} as Record<string, never>)),
    getNewsForSymbol(symbol, FILM_HEADLINES * 2).catch(() => []),
  ]);
  const { locale } = await getI18n();
  return {
    bars: completedBars(bars[symbol] ?? [], status).slice(-FILM_SESSIONS).map(b => ({ o: b.open, h: b.high, l: b.low, c: b.close })),
    headlines: news.map(n => (locale === "tr" && n.headlineTr) || n.headline).filter(Boolean).slice(0, FILM_HEADLINES),
  };
}
