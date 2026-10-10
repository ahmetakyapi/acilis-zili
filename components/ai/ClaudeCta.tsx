import { auth } from "@/auth";
import { getDictionary } from "@/lib/i18n";
import { hasAnalysisAccess } from "@/lib/ai-analysis-access";
import { listSymbolReports } from "@/lib/ai-analysis-reports";
import { HORIZON_OF, type AnalysisFocus } from "@/lib/ai-analysis-core";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { ButtonLink } from "@/components/ui/primitives";
import styles from "./Claude.module.css";

/**
 * Hisse Seçimi ve Teknik sayfalarındaki Claude girişi: tek satırlık kart.
 *
 * Eskiden sayfaya üretim paneli gömülüydü (denetimler, rapor kartları, tüm
 * rapor) ve sayfanın kendi raporunu aşağı itiyordu; sahibi "çok kötü" dedi
 * (11 Ekim). Artık son raporun özeti ve iki odaktan BU sayfanın odağına
 * açılan bağlantı. Rapor yoksa ve okuyanın üretme hakkı yoksa hiç çizilmez.
 */
export async function ClaudeCta({ symbol, locale, focus }: { symbol: string; locale: "tr" | "en"; focus: AnalysisFocus }) {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const [reports, canGenerate] = await Promise.all([
    listSymbolReports(symbol, viewerId),
    viewerId ? hasAnalysisAccess(viewerId) : Promise.resolve(false),
  ]);
  const latest = reports.find(r => r.horizon === HORIZON_OF[focus]);
  if (!latest && !canGenerate) return null;
  const t = getDictionary(locale).aiAnalysis;
  const odak = focus === "technical" ? "teknik" : "secim";
  const href = `/claude/${encodeURIComponent(symbol)}?odak=${odak}&sekme=${latest ? "rapor" : "yeni"}`;
  const date = latest && new Date(latest.generatedAt).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
  return <section className={styles.cta} data-verdict={latest?.verdict} aria-label={`${t.cta.title} · ${focus === "technical" ? t.focus.technical : t.focus.selection}`}>
    {latest && latest.score !== null
      ? <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={52} />
      : <span className={styles.ctaMark} aria-hidden>C</span>}
    <div className={styles.ctaBody}>
      <p className="plate">{t.cta.title} · {focus === "technical" ? t.focus.technical : t.focus.selection}</p>
      {latest ? <p className={styles.ctaLine}><strong className={styles.ctaVerdict}>{t.verdicts[latest.verdict]}</strong><span>{date} · TR</span></p>
        : <p className={styles.ctaLine}><span>{t.cta.none}</span></p>}
    </div>
    <ButtonLink href={href} variant={latest ? "ghost" : "primary"} size="sm">{latest ? t.cta.open : t.cta.create}</ButtonLink>
  </section>;
}
