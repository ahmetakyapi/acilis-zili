import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, LogoTile, PageHeader, Panel, PanelHeader, TabBar, TabItem, ButtonLink } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { AnalysisReport } from "@/components/ai/AnalysisReport";
import { ClaudeWorkbench } from "@/components/ai/ClaudeWorkbench";
import { FocusOptions, type FocusOption } from "@/components/ai/FocusOptions";
import { editionNote } from "@/components/ai/ClaudeCta";
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
/* Film: son 3 ayın 60 seansı çizilir; öncesindeki 50 seans yalnız ortalamaların gerçek
   penceresi için (25 Ekim; 6 aylık seri zaten iniyordu). Manşet üç: beşi okunmuyordu. */
import { FILM_HEADLINES, FILM_SESSIONS, MA_LEAD } from "@/lib/ink/analysis-film";

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
  // Erişim, rapor listesi ve piyasa durumu birbirine bağlı değil: aynı turda (20 Ekim). Sırayla
  // bekleniyorlardı ve rapor sorgusu başlamadan önce ~5 ardışık Neon turu birikiyordu.
  const accessP = viewerId && process.env.CLAUDE_ANALYSIS_API_KEY && process.env.CLAUDE_ANALYSIS_DISABLED !== "1"
    ? analysisAccess().catch(() => null) : Promise.resolve(null);
  const [access, [reports, names], status] = await Promise.all([
    accessP,
    Promise.all([listSymbolReports(symbol, viewerId), getSymbolNames([symbol]).catch(() => ({} as Awaited<ReturnType<typeof getSymbolNames>>))]),
    getStatus(),
  ]);
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

  // Teknik odakta, sitenin yazılı teknik analizi olan hissede sıradaki yayın (günde üç kez): Claude'dan önce beklenebilir.
  const edition = tab === "yeni" && focus === "technical" ? await editionNote(symbol, locale) : null;
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

  /* ODAK SEÇENEKLERİ (25 Ekim): sekmelerin üstündeki iki büyük kart kalktı;
     seçenek kullanıldığı yerde duruyor. Rapor sekmesinde hangi odağın raporu
     okunuyor (son karar + zaman), Yeni Analiz'de hangi odakta rapor istenecek
     (vade · ne verdiği). İkisi de adreste (`?odak=`), `scroll={false}`. */
  const focusOptions = (mode: "rapor" | "yeni"): FocusOption[] => (["technical", "selection"] as const).map(f => {
    const latest = reports.find(r => FOCUS_OF[r.horizon] === f);
    const term = f === "technical" ? A.short : A.medium;
    return {
      focus: f, current: f === focus,
      name: f === "technical" ? A.focus.technical : A.focus.selection,
      href: href({ focus: f, tab: mode === "yeni" ? "yeni" : latest || !access ? "rapor" : "yeni" }),
      line: mode === "yeni" ? `${term} · ${C.desk.gives[f]}` : `${term} · ${latest ? date(latest.generatedAt) : C.desk.noReport}`,
      latest: mode === "rapor" && latest ? { verdict: latest.verdict, label: A.verdicts[latest.verdict], score: latest.score } : null,
    };
  });

  return <MotionExperience className={polish.page}>
    <ScrollProgress />
    {/* KİMLİK BAŞLIK KARTININ İÇİNDE (25 Ekim, sahibinin isteği): şirket
        ve üç bağlantı kartın altında ayrı bir satırdı; 1440'ta sekmeleri ve
        filmi ~90 px aşağı itiyordu. Artık başlığın sağında tek blok,
        telefonda başlığın altına iner. */}
    <PageHeader title={C.title} subtitle={C.subtitle} action={
      <div className={styles.identity}>
        <div className={styles.identityHead}>
          <LogoTile symbol={symbol} logoUrl={meta?.logoUrl} size="md" />
          <div className={styles.identityText}>
            <span className={styles.identitySymbol}>{symbol}</span>
            <span className={styles.identityName}>{meta?.name ?? ""}</span>
          </div>
        </div>
        <nav className={styles.identityLinks} aria-label={symbol}>
          <Link href={`/hisse/${encodeURIComponent(symbol)}`}>{t.nav.companies}</Link>
          <Link href={`/teknik/${symbol.toLowerCase()}`}>{t.nav.technical}</Link>
          <Link href={`/hisse-secimi/${encodeURIComponent(symbol)}`}>{t.screening.title}</Link>
        </nav>
      </div>
    } />

    {/* Sekmeler kimliğin hemen altında: üç görünüm aynı hissenin, odak her görünümün içinde. */}
    <TabBar label={C.title} className={styles.tabs}>
      {TABS.map(key => <TabItem key={key} href={href({ tab: key })} active={tab === key} underlineId="claude-tabs" scroll={false}>
        {key === "rapor" ? C.tabs.report : key === "yeni" ? C.tabs.create : `${C.tabs.history}${reports.length ? ` (${reports.length})` : ""}`}
      </TabItem>)}
    </TabBar>

    {tab === "rapor" && <div className={styles.reportWrap}>
      <FocusOptions items={focusOptions("rapor")} label={A.focus.label} />
      {result && selected ? <>
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
        <AnalysisReport result={result} t={A} locale={locale} symbol={symbol} horizon={selected.horizon} categoryNames={t.screening.categories} fresh={params.yeni === "1"}
          current={quote ? { price: quote.price, at: quote.tradedAt ? new Date(quote.tradedAt).toISOString() : null, realtime: !!quote.realtime } : null} />
        {/* Son raporlar ve sıradaki önerilen an: raporun SONUNDA (25 Ekim). Kapağın üstündeyken
            1280×800'de raporun kendisini ilk ekranın dışına itiyordu. */}
        {timeline}
      </> : <EmptyState title={C.emptyTitle} hint={access ? C.emptyHint : C.emptyHintGuest} scene="chart"
        action={access ? <ButtonLink href={href({ tab: "yeni" })} variant="primary" scroll={false}>{C.createCta}</ButtonLink> : undefined} />}
    </div>}

    {/* Yetkisiz hâller sayfa düzeyi boş durum: mürekkep sahnesi, tek cümle, tek eylem. */}
    {tab === "yeni" && !viewerId && <EmptyState title={C.desk.guestTitle} hint={C.desk.guestHint} scene="ledger"
      action={<ButtonLink href={`/giris?devam=${encodeURIComponent(href({ tab: "yeni" }))}`} variant="primary">{C.desk.signIn}</ButtonLink>} />}
    {tab === "yeni" && viewerId && !access && <EmptyState title={C.desk.closedTitle} hint={C.desk.closedHint} scene="chart"
      action={reports.length ? <ButtonLink href={href({ tab: "rapor" })} variant="primary" scroll={false}>{C.desk.readReports}</ButtonLink> : undefined} />}
    {tab === "yeni" && access && <ClaudeWorkbench symbol={symbol} name={meta?.name ?? ""} logoUrl={logoUrl} locale={locale} t={A} focus={focus}
      options={focusOptions("yeni")} remaining={access.remaining ?? null} limit={access.dailyLimit ?? null}
      latest={ofFocus[0] ? { href: href({ tab: "rapor", id: ofFocus[0].id }), verdict: ofFocus[0].verdict, score: ofFocus[0].score, when: date(ofFocus[0].generatedAt) } : null}
      inProgress={!!access.lockId && !!access.lockUntil && access.lockUntil > new Date()} historyHref={href({ tab: "gecmis" })}
      next={next} nextLabel={next ? stamp(next.at) : null} now={nowAt.toISOString()} edition={edition}
      bars={film.bars} headlines={film.headlines} />}
    {tab === "yeni" && access && ofFocus.length > 0 && timeline}

    {tab === "gecmis" && <HistoryList reports={reports} A={A} locale={locale} focus={focus} date={date} time={time} href={(r: ReportSummary) => href({ tab: "rapor", focus: FOCUS_OF[r.horizon], id: r.id })} />}
  </MotionExperience>;
}

/**
 * GEÇMİŞ (25 Ekim): odak başına bir panel, seçili odak önce. Tek uzun liste
 * iki odağı karıştırıyordu ve satırın sütunları (halka, karar, odak, tarih,
 * oluşturan, dil) satırdan satıra kayıyordu. Şimdi zaman solda ve her
 * satırda aynı yerde; panel başlığı odağı söylediği için satırda tekrar yok.
 */
function HistoryList({ reports, A, locale, focus, date, time, href }: {
  reports: ReportSummary[]; A: Awaited<ReturnType<typeof getI18n>>["t"]["aiAnalysis"]; locale: string; focus: AnalysisFocus;
  date: (iso: string) => string; time: (iso: string) => string; href: (r: ReportSummary) => string;
}) {
  if (!reports.length) return <EmptyState title={A.claude.historyEmpty} scene="ledger" />;
  const order: AnalysisFocus[] = focus === "technical" ? ["technical", "selection"] : ["selection", "technical"];
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium" });
  return <div className={styles.historyGroups}>
    {order.map(f => {
      const rows = reports.filter(r => FOCUS_OF[r.horizon] === f);
      if (!rows.length) return null;
      return <Panel key={f}>
        <PanelHeader title={f === "technical" ? A.focus.technical : A.focus.selection} meta={`${A.claude.desk.reports.replace("{n}", String(rows.length))} · ${A.claude.timeline.hours}`} />
        <ol className={styles.history}>
          {rows.map(r => <li key={r.id}>
            <Link href={href(r)} scroll={false} className={styles.historyRow} data-verdict={r.verdict} title={date(r.generatedAt)}>
              <span className={styles.historyWhen}><b>{day(r.generatedAt)}</b><small className="numeral">{time(r.generatedAt)}</small></span>
              <span className={styles.historyRing}>{r.score !== null ? <ScoreRing score={r.score} verdict={r.verdict === "insufficient" ? "hold" : r.verdict} size={40} /> : <span className={styles.tlRingEmpty} aria-hidden />}</span>
              <span className={styles.historyVerdict}>{A.verdicts[r.verdict]}</span>
              {r.author ? <span className={styles.historyAuthor}>
                <AvatarTile icon={r.author.icon} color={r.author.color} initials={initialsOf(r.author.name, locale)} className={styles.tlAvatar} />
                <span><span className="sr-only">{A.claude.timeline.author}: </span>{r.author.name}</span>
              </span> : <span className={styles.historyAuthor} />}
              <span className={styles.historyTags}>{r.locale.toUpperCase()}{r.mine && <b>{A.claude.mine}</b>}</span>
            </Link>
          </li>)}
        </ol>
      </Panel>;
    })}
  </div>;
}

/** Film için O HİSSENİN verisi: son 60 tamamlanmış günlük mum ve son haber başlıkları (Türkçesi varsa). */
async function loadFilm(symbol: string, status: Awaited<ReturnType<typeof getStatus>>): Promise<{ bars: FilmBar[]; headlines: string[] }> {
  const [bars, news] = await Promise.all([
    getChartBarsMulti([symbol], "6M", status).catch(() => ({} as Record<string, never>)),
    getNewsForSymbol(symbol, FILM_HEADLINES * 2).catch(() => []),
  ]);
  const { locale } = await getI18n();
  return {
    bars: completedBars(bars[symbol] ?? [], status).slice(-(FILM_SESSIONS + MA_LEAD)).map(b => ({ o: b.open, h: b.high, l: b.low, c: b.close })),
    headlines: news.map(n => (locale === "tr" && n.headlineTr) || n.headline).filter(Boolean).slice(0, FILM_HEADLINES),
  };
}
