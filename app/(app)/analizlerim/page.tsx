import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { ArrowRight, PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { PRIMARY_LINK } from "@/components/community/CommunityParts";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { DataStamp, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { analysisAccess } from "@/lib/ai-analysis-access";
import { getStatus, getSymbolNames } from "@/lib/data";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { aiAnalysisRequests } from "@/lib/schema";
import { getOwnPosts } from "@/lib/user-post-data";
import { ClaudeReports, MoreLink, OwnNotes, ReportsOverview, type ReportCard } from "@/components/analyses/AnalysesCards";

/* KİŞİSEL SAYFA — DİZİNE GİRMEZ (next.config.ts → NOINDEX_PATHS da). */
export const generateMetadata = pageMetadata({
  path: "/analizlerim",
  robots: { index: false, follow: false },
  tr: { title: "Analizlerim", description: "Kendi yazdığın analizler ve Claude ile ürettiğin hisse raporları." },
  en: { title: "My Analyses", description: "The analyses you wrote and the stock reports you generated with Claude." },
});

/**
 * ANALİZLERİM — İKİ ALAN (18 Ekim, sahibinin isteği): önce okurun KENDİ
 * yazdığı analizler (topluluk yazıları; taslak dahil) not kartı olarak,
 * sonra Claude raporları rapor kartı olarak. Eskiden yalnız Claude
 * raporları altı sütunlu bir satır listesiydi; telefonda üç sütuna
 * kırılıp künye yığınına dönüyordu.
 *
 * Kendi yazıları her üyede var; Claude bölümü analiz erişimi olan hesapta.
 * Not kartı en çok altı tane (tamamı /yazilarim'de): sayfa iki bölümlü,
 * ilk bölüm ikinciyi ekranın dışına itmesin.
 */

const PAGE_LIMIT = 100;
const MINE_LIMIT = 6;

export default async function AnalysesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/analizlerim");
  const userId = session.user.id;
  /* Kendi yazıları erişime bağlı değil: erişim denetiminden (bir `auth()` ve
     Neon turları) ÖNCE başlıyor, sayfada Suspense yok (20 Ekim).
     `getOwnPosts` hatayı kendisi yutuyor, reddedilmiyor. */
  const ownPromise = getOwnPosts(userId);
  const { locale, t } = await getI18n();
  const A = t.aiAnalysis;
  const P = A.page;
  const C = t.community;
  let access: Awaited<ReturnType<typeof analysisAccess>> = null;
  try { access = process.env.CLAUDE_ANALYSIS_API_KEY ? await analysisAccess() : null; } catch { access = null; }

  /* Raporun tamamı değil, kartın ihtiyacı: jsonb'den beş alan. */
  const [own, rows] = await Promise.all([
    ownPromise,
    access
      ? db.select({
        id: aiAnalysisRequests.id, symbol: aiAnalysisRequests.symbol, horizon: aiAnalysisRequests.horizon,
        verdict: sql<string>`${aiAnalysisRequests.result}->'output'->>'verdict'`,
        score: sql<number | null>`(${aiAnalysisRequests.result}->'output'->>'overallScore')::int`,
        reportPrice: sql<number | null>`coalesce((${aiAnalysisRequests.result}->>'quotePrice')::float8, (${aiAnalysisRequests.result}->'snapshot'->>'price')::float8)`,
        generatedAt: sql<string>`${aiAnalysisRequests.result}->>'generatedAt'`,
        /* Kart minyatürü (25 Ekim): yalnız kapanışlar ve iki tetik; raporun
           geri kalanı (metin, haber) karta gelmez. */
        bullLevel: sql<number | null>`(${aiAnalysisRequests.result}->'output'->>'bullLevel')::float8`,
        bearLevel: sql<number | null>`(${aiAnalysisRequests.result}->'output'->>'bearLevel')::float8`,
        closes: sql<number[] | null>`(select jsonb_agg((p->>'close')::float8) from jsonb_array_elements(${aiAnalysisRequests.result}->'pricePath'->'chart') p)`,
      }).from(aiAnalysisRequests)
        .where(and(eq(aiAnalysisRequests.userId, access.userId), eq(aiAnalysisRequests.status, "completed")))
        .orderBy(desc(aiAnalysisRequests.createdAt)).limit(PAGE_LIMIT).catch(() => [])
      : Promise.resolve([]),
  ]);
  const posts = own.posts.slice(0, MINE_LIMIT);

  const reportSymbols = [...new Set(rows.map(r => r.symbol))];
  const symbols = [...new Set([...reportSymbols, ...posts.flatMap(p => p.symbols.slice(0, 3))])];
  const status = reportSymbols.length ? await getStatus() : null;
  const [quotes, names] = await Promise.all([
    status ? getQuotes(reportSymbols, status).catch(() => null) : null,
    getSymbolNames(symbols).catch(() => ({} as Awaited<ReturnType<typeof getSymbolNames>>)),
  ]);
  // Bayat kotasyonla "Rapordan Bugüne" yazılmaz (veri dürüstlüğü 2).
  const live = quotes?.ok && !quotes.stale ? quotes.data : {};

  const cards: ReportCard[] = rows.map(row => {
    const now = live[row.symbol]?.price;
    return {
      id: row.id, symbol: row.symbol, horizon: row.horizon, verdict: row.verdict, score: row.score, generatedAt: row.generatedAt,
      since: now && row.reportPrice ? (now / row.reportPrice - 1) * 100 : null,
      closes: row.closes, bullLevel: row.bullLevel, bearLevel: row.bearLevel, reportPrice: row.reportPrice,
    };
  });

  const newPost = <Link href="/yazilarim/yeni" className={PRIMARY_LINK}>
    <PencilSimpleLine weight="duotone" size={16} aria-hidden />{P.mineNew}
  </Link>;

  return <MotionExperience className={polish.page}>
    <PageHeader title={P.title} subtitle={P.subtitle} />

    {/* ---- 1 · Kendi analizlerim ---- */}
    <Panel aria-label={P.mineTitle}>
      <PanelHeader
        title={P.mineTitle}
        meta={own.posts.length ? P.mineCount.replace("{n}", String(own.posts.length)) : undefined}
        action={own.available && posts.length > 0 ? newPost : undefined}
      />
      {!own.available ? <EmptyState title={C.mine.unavailable} hint={C.mine.unavailableHint} compact />
        : posts.length === 0 ? <EmptyState title={P.mineEmptyTitle} hint={P.mineEmptyHint} action={newPost} compact />
        : <>
          <OwnNotes posts={posts.map(post => ({ id: post.id, title: post.title, dek: post.dek, status: post.status, updatedAt: post.updatedAt, symbols: post.symbols }))} names={names} statusLabels={C.status} locale={locale} />
          {own.posts.length > MINE_LIMIT && <MoreLink href="/yazilarim" label={<>{P.mineAll}<ArrowRight size={14} aria-hidden /></>} />}
        </>}
    </Panel>

    {/* ---- 2 · Claude analizleri ---- */}
    <Panel aria-label={P.claudeTitle}>
      <PanelHeader title={P.claudeTitle} meta={rows.length ? `${rows.length} ${P.count}` : P.claudeHint} />
      {!access ? <EmptyState title={P.noAccessTitle} hint={P.noAccessHint} compact />
        : !rows.length ? <EmptyState title={P.emptyTitle} hint={P.emptyHint} compact />
        : <>
          {/* Panelin tepesinde özet: tek cümle, görüş dağılımı, rapordan
              bugüne getiri kovaları (25 Ekim — gerekçe ReportsOverview). */}
          <ReportsOverview rows={cards} labels={A} L={t.feedVisuals.analyses} locale={locale} />
          <ClaudeReports rows={cards} names={names} labels={A} mapAria={t.feedVisuals.analyses.mapAria} locale={locale} />
        </>}
    </Panel>
    {quotes?.ok && reportSymbols.length > 0 && <DataStamp labels={t.data} source={quotes.source} at={quotes.fetchedAt} stale={quotes.stale} locale={locale} />}
  </MotionExperience>;
}
