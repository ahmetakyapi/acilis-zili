import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ChangePill, DataStamp, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { analysisAccess } from "@/lib/ai-analysis-access";
import { getStatus, getSymbolNames } from "@/lib/data";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { aiAnalysisRequests } from "@/lib/schema";
import styles from "./page.module.css";

/* KİŞİSEL SAYFA — DİZİNE GİRMEZ (next.config.ts → NOINDEX_PATHS da). */
export const generateMetadata = pageMetadata({
  path: "/analizlerim",
  robots: { index: false, follow: false },
  tr: { title: "Analizlerim", description: "Claude ile ürettiğin kayıtlı hisse raporları." },
  en: { title: "My Analyses", description: "Your saved stock reports generated with Claude." },
});

const PAGE_LIMIT = 100;
const VERDICTS = ["buy", "hold", "sell", "insufficient"] as const;
type Verdict = (typeof VERDICTS)[number];

export default async function AnalysesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/analizlerim");
  const { locale, t } = await getI18n();
  const A = t.aiAnalysis;
  const P = A.page;
  let access: Awaited<ReturnType<typeof analysisAccess>> = null;
  try { access = process.env.CLAUDE_ANALYSIS_API_KEY ? await analysisAccess() : null; } catch { access = null; }
  if (!access) {
    return <MotionExperience className={polish.page}>
      <PageHeader title={P.title} subtitle={P.subtitle} />
      <Panel><EmptyState title={P.noAccessTitle} hint={P.noAccessHint} /></Panel>
    </MotionExperience>;
  }

  /* Raporun tamamı değil, satırın ihtiyacı: jsonb'den beş alan. */
  const rows = await db.select({
    id: aiAnalysisRequests.id, symbol: aiAnalysisRequests.symbol, horizon: aiAnalysisRequests.horizon,
    verdict: sql<string>`${aiAnalysisRequests.result}->'output'->>'verdict'`,
    score: sql<number | null>`(${aiAnalysisRequests.result}->'output'->>'overallScore')::int`,
    confidence: sql<string | null>`${aiAnalysisRequests.result}->'output'->>'confidence'`,
    reportPrice: sql<number | null>`coalesce((${aiAnalysisRequests.result}->>'quotePrice')::float8, (${aiAnalysisRequests.result}->'snapshot'->>'price')::float8)`,
    generatedAt: sql<string>`${aiAnalysisRequests.result}->>'generatedAt'`,
  }).from(aiAnalysisRequests)
    .where(and(eq(aiAnalysisRequests.userId, access.userId), eq(aiAnalysisRequests.status, "completed")))
    .orderBy(desc(aiAnalysisRequests.createdAt)).limit(PAGE_LIMIT).catch(() => []);

  const symbols = [...new Set(rows.map(r => r.symbol))];
  const status = symbols.length ? await getStatus() : null;
  const [quotes, names] = await Promise.all([
    status ? getQuotes(symbols, status).catch(() => null) : null,
    getSymbolNames(symbols).catch(() => ({} as Awaited<ReturnType<typeof getSymbolNames>>)),
  ]);
  // Bayat kotasyonla "Rapordan Bugüne" yazılmaz (veri dürüstlüğü 2).
  const live = quotes?.ok && !quotes.stale ? quotes.data : {};
  const date = (value: string) => new Date(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });

  return <MotionExperience className={polish.page}>
    <PageHeader title={P.title} subtitle={P.subtitle} />
    <Panel aria-label={P.reports}>
      <PanelHeader title={P.reports} meta={rows.length ? `${rows.length} ${P.count}` : undefined} />
      {!rows.length ? <EmptyState title={P.emptyTitle} hint={P.emptyHint} compact /> : <ol className={styles.list}>
        {rows.map(row => {
          const verdict: Verdict = VERDICTS.includes(row.verdict as Verdict) ? row.verdict as Verdict : "insufficient";
          const now = live[row.symbol]?.price;
          const since = now && row.reportPrice ? (now / row.reportPrice - 1) * 100 : null;
          return <li key={row.id}>
            <Link href={`/hisse-secimi/${encodeURIComponent(row.symbol)}?rapor=${row.id}`} className={styles.row} data-verdict={verdict}>
              <span className={styles.stock}>
                <span className={styles.symbol}>{row.symbol}</span>
                <span className={styles.name}>{names[row.symbol]?.name ?? ""}</span>
              </span>
              <span className={styles.verdict}><small>{P.verdict}</small>{A.verdicts[verdict]}</span>
              <span className={styles.score}><small>{P.score}</small>{row.score ?? "—"}</span>
              <span className={styles.meta}><small>{P.horizon}</small>{row.horizon === "medium" ? A.medium : A.short}</span>
              <span className={styles.meta}><small>{P.date} · TR</small>{date(row.generatedAt)}</span>
              <span className={styles.since}><small>{A.sinceReport}</small>{since === null ? "—" : <ChangePill changePct={since} locale={locale} size="sm" />}</span>
              <span className="sr-only">{P.open}</span>
            </Link>
          </li>;
        })}
      </ol>}
    </Panel>
    {quotes?.ok && symbols.length > 0 && <DataStamp labels={t.data} source={quotes.source} at={quotes.fetchedAt} stale={quotes.stale} locale={locale} />}
  </MotionExperience>;
}
