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
import styles from "./Claude.module.css";

const odakOf = (focus: AnalysisFocus) => (focus === "technical" ? "teknik" : "secim");
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
  return { canGenerate, latestOf };
}

/**
 * Claude girişi: PANEL, sayfanın en üstünde değil SAYFANIN KENDİ OKUMASINDAN
 * SONRA (11 Ekim, sahibinin isteği: "en üstte çıkmak yerine mantıklı yere").
 * Claude ikinci görüştür; okuyucu önce sitenin teknik analizini ya da seçim
 * raporunu okur, sonra karşılaştırır. Teknik sayfada izleme listesinin
 * ardından, Hisse Seçimi'nde "sırada ne var"ın ardından, şirket sayfasında
 * Değerleme bölümünün sonunda (iki odak birden).
 *
 * Her odak bir satır: son raporun puanı ve kararı, zamanı, oluşturanı;
 * sağda eylemler. Hak varsa "Yeni Analiz Oluştur" birincil eylemdir —
 * şirket sayfasından da üretilebilsin diye. Rapor yoksa ve hak yoksa hiç
 * çizilmez (oturum açmamış okuyucuya boş bir vitrin göstermeyelim).
 */
export async function ClaudeCta({ symbol, locale, focus }: { symbol: string; locale: "tr" | "en"; focus: AnalysisFocus | "both" }) {
  const { canGenerate, latestOf } = await claudeState(symbol);
  const focuses: AnalysisFocus[] = focus === "both" ? ["technical", "selection"] : [focus];
  if (!canGenerate && focuses.every(f => !latestOf(f))) return null;
  const t = getDictionary(locale).aiAnalysis;
  const date = (iso: string) => new Date(iso).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });

  return <Panel className={styles.ctaPanel}>
    <PanelHeader title={t.cta.title} meta={focus === "both" ? undefined : focus === "technical" ? t.focus.technical : t.focus.selection} />
    <ul className={styles.ctaRows}>
      {focuses.map(f => {
        const latest = latestOf(f);
        if (!latest && !canGenerate) return null;
        return <li key={f} className={styles.ctaRow} data-verdict={latest?.verdict}>
          {latest && latest.score !== null
            ? <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={48} />
            : <span className={styles.ctaRing} aria-hidden />}
          <div className={styles.ctaBody}>
            {focus === "both" && <span className={styles.ctaFocus}>{f === "technical" ? t.focus.technical : t.focus.selection}</span>}
            {latest ? <>
              <Link href={claudeHref(symbol, f, "rapor")} className={styles.ctaVerdict}>{t.verdicts[latest.verdict]}</Link>
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
            {latest && <ButtonLink href={claudeHref(symbol, f, "rapor")} variant="ghost" size="sm">{t.cta.open}</ButtonLink>}
            {canGenerate && <ButtonLink href={claudeHref(symbol, f, "yeni")} variant="primary" size="sm">{latest ? t.cta.newAnalysis : t.cta.create}</ButtonLink>}
          </div>
        </li>;
      })}
    </ul>
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
export async function ClaudeAction({ symbol, locale, focus, className, block = false }: {
  symbol: string; locale: "tr" | "en"; focus: AnalysisFocus; className?: string; block?: boolean;
}) {
  const { canGenerate, latestOf } = await claudeState(symbol);
  const latest = latestOf(focus);
  if (!block && !canGenerate && !latest) return null;
  const t = getDictionary(locale).aiAnalysis;
  const openReport = !canGenerate && !!latest;
  return <Link href={claudeHref(symbol, focus, openReport ? "rapor" : "yeni")}
    className={[styles.ctaAction, block && styles.ctaActionBlock, className].filter(Boolean).join(" ")}>
    <svg className={styles.ctaSpark} viewBox="0 0 24 24" aria-hidden><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" /></svg>
    <span className={styles.ctaActionText}>{openReport ? t.cta.actionOpen : t.cta.create}</span>
    <svg className={styles.ctaArrow} viewBox="0 0 24 24" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" /></svg>
  </Link>;
}
