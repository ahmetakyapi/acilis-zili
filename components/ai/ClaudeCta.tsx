import { auth } from "@/auth";
import { getDictionary } from "@/lib/i18n";
import { hasAnalysisAccess } from "@/lib/ai-analysis-access";
import { listSymbolReports, type ReportSummary } from "@/lib/ai-analysis-reports";
import { FOCUS_OF, type AnalysisFocus } from "@/lib/ai-analysis-core";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { ButtonLink, Panel, PanelHeader } from "@/components/ui/primitives";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { initialsOf } from "@/lib/avatars";
import { getHolidays } from "@/lib/data";
import { editionClock, isTechnicalSymbol, nextEdition } from "@/lib/technical";
import styles from "./Claude.module.css";

const odakOf = (focus: AnalysisFocus) => (focus === "technical" ? "teknik" : "secim");
/* Bağlantılar `rel="nofollow"`: /claude/* kişisel, `noindex` bir ekran
   (next.config.ts → NOINDEX_PATHS) ve her hisse × odak × sekme ayrı adres
   — taranmaya çağırmak tarama bütçesini dizine hiç girmeyecek sayfalara
   harcıyordu (22 Ekim, Search Console). */
const claudeHref = (symbol: string, focus: AnalysisFocus, tab: "rapor" | "yeni") =>
  `/claude/${encodeURIComponent(symbol)}?odak=${odakOf(focus)}&sekme=${tab}`;

/** Okuyanın hakkı ve bu hissenin raporları — panel ile küçük eylem aynı iki sorguyu paylaşır (ikisi de `cache`li). */
async function claudeState(symbol: string) {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const [reports, canGenerate] = await Promise.all([
    listSymbolReports(symbol, viewerId).catch(() => [] as ReportSummary[]),
    viewerId ? hasAnalysisAccess(viewerId).catch(() => false) : Promise.resolve(false),
  ]);
  const latestOf = (focus: AnalysisFocus) => reports.find(r => FOCUS_OF[r.horizon] === focus) ?? null;
  return { canGenerate, signedIn: viewerId !== null, latestOf };
}

/** Yayın notu: saat ("15:45 TR") satır sonunda bölünmez ve kalın (390'da "15:45" / "TR" diye bölünüyordu). */
export function EditionText({ text, time }: { text: string; time: string }) {
  const [before, after = ""] = text.split("{time}");
  return <span>{before}<b className="whitespace-nowrap font-semibold text-strong">{time}</b>{after}</span>;
}

/** Teknik odakta ve yazılı teknik analizi olan hissede sıradaki yayın: Claude'dan önce onu beklemek mümkün. */
export async function editionNote(symbol: string, locale: "tr" | "en") {
  if (!isTechnicalSymbol(symbol)) return null;
  const next = nextEdition(new Date(), await getHolidays().catch(() => []));
  return next ? editionClock(next.at, locale) : null;
}

/**
 * Şirket Analizi paneli (araç Claude). YER, 11 Ekim'de iki kez değişti:
 * önce sayfanın en üstündeydi ("okumadan ikinci görüş"), sonra okumanın
 * sonuna indi; telefonda 7.000. piksele düştü (teknik sayfada 10.641'in
 * 6.876'sı, ölçüldü) ve sahibi "çok aşağıda, üstte bir yerde olmalı" dedi.
 * Artık sayfanın KAPAĞININ hemen altında: önce sitenin kendi özeti
 * (görüş, plan ya da kural kontrolü), hemen ardından Claude — üstte ama
 * okumanın önünde değil.
 *
 * Her odak bir satır: son raporun puanı ve kararı, zamanı, oluşturanı;
 * sağda eylemler. Panel misafire de basılır; misafir "Claude ile Analiz
 * Et"e basınca Claude sayfası girişi ister. Hakkı olmayan oturumlu
 * okuyucuya rapor yoksa panel çizilmez.
 *
 * Teknik odakta, sitenin yazılı teknik analizi olan hissede panel
 * sıradaki yayını söyler (günde üç kez, `nextEdition`): okuyucu yeni bir
 * Claude raporu istemek yerine onu bekleyebilir (sahibinin isteği).
 */
export async function ClaudeCta({ symbol, locale, focus }: { symbol: string; locale: "tr" | "en"; focus: AnalysisFocus | "both" }) {
  const { canGenerate, signedIn, latestOf } = await claudeState(symbol);
  const focuses: AnalysisFocus[] = focus === "both" ? ["technical", "selection"] : [focus];
  // Misafire de: düğme Claude sayfasına, o sayfa girişi ister. Hakkı olmayan oturumlu okuyucuya boş vitrin yok.
  const canAsk = canGenerate || !signedIn;
  if (!canAsk && focuses.every(f => !latestOf(f))) return null;
  const t = getDictionary(locale).aiAnalysis;
  const edition = focuses.includes("technical") ? await editionNote(symbol, locale) : null;
  const date = (iso: string) => new Date(iso).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });

  return <Panel className={styles.ctaPanel}>
    <PanelHeader title={t.cta.title} meta={focus === "both" ? t.cta.tool : `${focus === "technical" ? t.focus.technical : t.focus.selection} · ${t.cta.tool}`} />
    <ul className={styles.ctaRows}>
      {focuses.map(f => {
        const latest = latestOf(f);
        if (!latest && !canAsk) return null;
        return <li key={f} className={styles.ctaRow} data-verdict={latest?.verdict}>
          {latest && latest.score !== null
            ? <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={48} />
            : <span className={styles.ctaRing} aria-hidden />}
          <div className={styles.ctaBody}>
            {focus === "both" && <span className={styles.ctaFocus}>{f === "technical" ? t.focus.technical : t.focus.selection}</span>}
            {latest ? <>
              <Link href={claudeHref(symbol, f, "rapor")} rel="nofollow" className={styles.ctaVerdict}>{t.verdicts[latest.verdict]}</Link>
              <span className={styles.ctaMeta}>
                <span>{date(latest.generatedAt)} · TR</span>
                {latest.author && <span className={styles.ctaAuthor}>
                  <AvatarTile icon={latest.author.icon} color={latest.author.color} initials={initialsOf(latest.author.name, locale)} className={styles.tlAvatar} />
                  <span className="sr-only">{t.claude.timeline.author}: </span>{latest.author.name}
                </span>}
              </span>
            </> : <span className={styles.ctaNone}>{t.cta.none}</span>}
          </div>
          <div className={styles.ctaActions}>
            {latest && <ButtonLink href={claudeHref(symbol, f, "rapor")} rel="nofollow" variant="ghost" size="sm">{t.cta.open}</ButtonLink>}
            {canAsk && <ButtonLink href={claudeHref(symbol, f, "yeni")} rel="nofollow" variant="primary" size="sm">{latest ? t.cta.newAnalysis : t.cta.create}</ButtonLink>}
          </div>
        </li>;
      })}
    </ul>
    {edition && <p className={styles.ctaEdition}>
      <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
      <EditionText text={t.cta.editions} time={edition} />
    </p>}
    <p className={styles.ctaHint}>{t.cta.hint}</p>
  </Panel>;
}

/**
 * Kartın içindeki Claude düğmesi: şirket sayfasındaki teknik analiz kartı ve
 * teknik fotoğraf paneli. GÖRÜNÜR BİR DÜĞME (11 Ekim, sahibinin itirazı:
 * görüş satırındaki tonlu hap, dar kartta "Claude" ya da yalnız ikon,
 * "düğme olduğu anlaşılmıyor"). Düz mavi zemin, tam ad, sonda ok.
 *
 * `block`: kartın dibinde tam genişlik ve HER ZAMAN basılır — misafire de
 * (Claude sayfası giriş ister). Kartın boyu böylece okuyana göre değişmiyor
 * ve yedeği tek ölçüyle tutuluyor (stock.module.css → .technicalSkeleton).
 * Satır içi kullanımda hak ve rapor yoksa hiç basılmaz.
 */
export async function ClaudeAction({ symbol, locale, focus, className, block = false, label }: {
  symbol: string; locale: "tr" | "en"; focus: AnalysisFocus; className?: string; block?: boolean;
  /** Yeni analiz düğmesinin adı ("Bu Şirketi Analiz Et"); verilmezse "Claude ile Analiz Et". */
  label?: string;
}) {
  const { canGenerate, latestOf } = await claudeState(symbol);
  const latest = latestOf(focus);
  if (!block && !canGenerate && !latest) return null;
  const t = getDictionary(locale).aiAnalysis;
  const openReport = !canGenerate && !!latest;
  return <Link href={claudeHref(symbol, focus, openReport ? "rapor" : "yeni")} rel="nofollow"
    className={[styles.ctaAction, block && styles.ctaActionBlock, className].filter(Boolean).join(" ")}>
    <svg className={styles.ctaSpark} viewBox="0 0 24 24" aria-hidden><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" /></svg>
    <span className={styles.ctaActionText}>{openReport ? t.cta.actionOpen : label ?? t.cta.create}</span>
    <svg className={styles.ctaArrow} viewBox="0 0 24 24" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" /></svg>
  </Link>;
}

/**
 * Şirket sayfasında, sitenin yazılı teknik analizi OLMAYAN hissede teknik
 * kartın yerine (11 Ekim, sahibinin isteği: "teknik analiz kartı yoksa
 * analiz kartı çıkmaz; bu şirketi analiz et gibi bir kart"). Aynı yer,
 * aynı ağırlık: profil kartının altı. Varsa son Claude raporunun özeti,
 * yoksa ne yapacağını söyleyen tek cümle; dipte tam genişlik düğme.
 *
 * Her okuyucuya basılır (misafire de; Claude sayfası giriş ister) ki kartın
 * boyu sabit kalsın ve yedeği tek ölçüyle tutulsun (.claudeCardSkeleton).
 */
export async function ClaudeCompanyCard({ symbol, locale }: { symbol: string; locale: "tr" | "en" }) {
  const { latestOf } = await claudeState(symbol);
  const t = getDictionary(locale).aiAnalysis;
  const latest = latestOf("technical") ?? latestOf("selection");
  const date = (iso: string) => new Date(iso).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
  return <section className={styles.companyCard} data-verdict={latest?.verdict}>
    <div className={styles.companyHead}>
      {/* `text-read`: büyük başlığın üst im kaydırması (globals.css) bu kartta gerekmiyor. */}
      <h2 className="text-read font-bold">{t.cta.title}</h2>
      <span className={styles.companyTool}>{t.cta.tool}</span>
    </div>
    {latest ? <div className={styles.companyLatest}>
      {latest.score !== null
        ? <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={40} />
        : <span className={styles.ctaRing} aria-hidden />}
      <span className={styles.ctaBody}>
        <span className={styles.companyVerdict}>{t.verdicts[latest.verdict]}</span>
        <span className={styles.ctaMeta}>{FOCUS_OF[latest.horizon] === "technical" ? t.focus.technical : t.focus.selection} · {date(latest.generatedAt)} · TR</span>
      </span>
    </div> : <p className={styles.companyHint}>{t.cta.companyHint}</p>}
    <ClaudeAction symbol={symbol} locale={locale} focus={latest ? FOCUS_OF[latest.horizon] : "technical"} block label={t.cta.analyzeCompany} />
  </section>;
}
