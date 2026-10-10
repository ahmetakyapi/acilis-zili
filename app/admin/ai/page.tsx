import { desc, eq, ilike, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { aiAnalysisAccess, aiAnalysisAudit, aiAnalysisRequests, users } from "@/lib/schema";
import { istanbulDay, remainingAnalyses } from "@/lib/ai-analysis-core";
import { PageHeader, Button } from "@/components/ui/primitives";
import { AdminPanel, AdminPanelTitle } from "@/components/admin/AdminUI";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { AnalysisAccessForm } from "@/components/ai/AnalysisAccessForm";
import { adminDocTitle } from "@/lib/admin-sections";
import styles from "@/components/ai/Analysis.module.css";

export const metadata = { title: adminDocTitle("AI Analiz") };
const statusLabel: Record<string, string> = { processing: "Hazırlanıyor", completed: "Tamamlandı", failed: "Başarısız" };
const date = (value: Date) => value.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });
async function readAnalysisAdmin(query: string) {
  const actor = alias(users, "actor");
  try {
    const [rows, usage, totalsRows, audit] = await Promise.all([
      db.select({ id: users.id, username: users.username, role: users.role, enabled: aiAnalysisAccess.enabled, dailyLimit: aiAnalysisAccess.dailyLimit, usedCount: aiAnalysisAccess.usedCount, usedDay: aiAnalysisAccess.usedDay }).from(users).leftJoin(aiAnalysisAccess, eq(users.id, aiAnalysisAccess.userId)).where(query ? ilike(users.username, `%${query.replace(/[\\%_]/g, "\\$&")}%`) : undefined).orderBy(users.username).limit(100),
      db.select({ id: aiAnalysisRequests.id, symbol: aiAnalysisRequests.symbol, status: aiAnalysisRequests.status, model: aiAnalysisRequests.model, inputTokens: aiAnalysisRequests.inputTokens, outputTokens: aiAnalysisRequests.outputTokens, createdAt: aiAnalysisRequests.createdAt, username: users.username }).from(aiAnalysisRequests).innerJoin(users, eq(users.id, aiAnalysisRequests.userId)).orderBy(desc(aiAnalysisRequests.createdAt)).limit(30),
      db.select({ input: sql<number>`coalesce(sum(input_tokens),0)::bigint`, output: sql<number>`coalesce(sum(output_tokens),0)::bigint`, completed: sql<number>`count(*) filter (where status = 'completed')::int`, failed: sql<number>`count(*) filter (where status = 'failed')::int`, today: sql<number>`count(*) filter (where status = 'completed' and (created_at at time zone 'Europe/Istanbul')::date = ${istanbulDay()}::date)::int` }).from(aiAnalysisRequests),
      db.select({ id: aiAnalysisAudit.id, username: users.username, actor: actor.username, enabled: aiAnalysisAudit.enabled, dailyLimit: aiAnalysisAudit.dailyLimit, createdAt: aiAnalysisAudit.createdAt }).from(aiAnalysisAudit).innerJoin(users, eq(users.id, aiAnalysisAudit.userId)).leftJoin(actor, eq(actor.id, aiAnalysisAudit.adminId)).orderBy(desc(aiAnalysisAudit.createdAt)).limit(20),
    ]);
    return { rows, usage, totalsRows, audit };
  } catch { return null; }
}
export default async function AIAdminPage({ searchParams }: PageProps<"/admin/ai">) {
  await requireAdmin();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 50) : "";
  const data = await readAnalysisAdmin(query);
  if (!data) { return <div className="space-y-6"><PageHeader title="AI Analiz" subtitle="Erişim ver, günlük analiz hakkını yönet ve kullanımı izle." /><AdminPanel><AdminPanelTitle>Veritabanına Ulaşılamadı</AdminPanelTitle><p className=" text-sm text-body">Analiz tabloları henüz kurulmamış veya veritabanına erişilemiyor. Mevcut teknik analiz ve hisse seçimi ekranları çalışmaya devam eder.</p></AdminPanel></div>; }
  const { rows, usage, totalsRows, audit } = data;
  const totals = totalsRows[0];
  // 390 px ölçümü: panel 349 px; ikinci px-5 içeriği 269 px'e indiriyordu. AdminPanel tek dolguyu verir.
  return <div className="flex flex-col gap-6">
      <PageHeader title="AI Analiz" subtitle="Erişim ver, günlük analiz hakkını yönet ve kullanımı izle." />
      <AdminPanel><AdminPanelTitle>Sistem ve Kullanım</AdminPanelTitle><div className="space-y-3  text-sm text-body">
        <p>{process.env.CLAUDE_ANALYSIS_API_KEY ? "Analiz anahtarı tanımlı." : "Analiz anahtarı henüz tanımlı değil."} {process.env.CLAUDE_ANALYSIS_DISABLED === "1" ? "Analiz üretimi kapalı." : "Analiz üretimi açık."}</p>
        <p>Bugün: {totals.today} rapor · Toplam: {totals.completed} rapor · Başarısız: {totals.failed} istek</p>
        <p>Giriş: {Number(totals.input).toLocaleString("tr-TR")} token · Çıkış: {Number(totals.output).toLocaleString("tr-TR")} token. Kesin API ücretlerini Claude Console üzerinden takip edebilirsin.</p>
        <p>Yeni erişimler için varsayılan günlük hak 5’tir. Kota İstanbul saatiyle 00:00’da yenilenir. Başarısız işler kullanıcı hakkına iade edilir; kullanılan tokenlar burada kalır.</p>
      </div></AdminPanel>
      <AdminPanel><AdminPanelTitle>Kullanıcı Erişimi</AdminPanelTitle><div className="">
        <form className="mb-4 flex flex-wrap items-end gap-3" method="get"><label className={styles.field}>Kullanıcı Ara<input name="q" defaultValue={query} className={styles.input} placeholder="Kullanıcı adı" maxLength={50} /></label><Button type="submit" variant="quiet" size="sm">Ara</Button></form>
        <p className="mb-3 text-xs text-muted">İlk 100 eşleşme gösterilir. Daha fazla kullanıcı için adıyla ara. Diğer admin hesaplarına otomatik analiz erişimi verilmez.</p>
        {!rows.length && <p className="text-sm text-body">Eşleşen kullanıcı bulunamadı.</p>}
        {rows.map(row => <AnalysisAccessForm key={row.id} userId={row.id} username={row.username} owner={row.username === "ahmetakyapi" && row.role === "admin"}
          enabled={row.enabled ?? false} dailyLimit={row.enabled === null ? 5 : row.dailyLimit}
          remaining={remainingAnalyses(row.dailyLimit ?? (row.enabled === null ? 5 : null), row.usedCount ?? 0, row.usedDay)} />)}
      </div></AdminPanel>
      <AdminPanel><AdminPanelTitle>Son Analiz İstekleri</AdminPanelTitle><ScrollEdges className="overflow-x-auto "><table className="w-full min-w-[760px] text-sm"><thead><tr>{["Kullanıcı", "Hisse", "Durum", "Model", "Token (Giriş / Çıkış)", "Tarih · TR"].map(s => <th key={s} className="py-3 pr-5 text-left text-muted font-medium">{s}</th>)}</tr></thead><tbody>
        {usage.map(row => <tr key={row.id} className="border-t border-[var(--line)]"><td className="py-3 pr-5">{row.username}</td><td className="pr-5">{row.symbol}</td><td className="pr-5">{statusLabel[row.status] ?? row.status}</td><td className="pr-5">{row.model}</td><td className="pr-5 tabular-nums">{row.inputTokens ?? "—"} / {row.outputTokens ?? "—"}</td><td className="whitespace-nowrap">{date(row.createdAt)}</td></tr>)}
        {!usage.length && <tr><td colSpan={6} className="py-4 text-muted">Henüz analiz isteği yok.</td></tr>}
      </tbody></table></ScrollEdges></AdminPanel>
      <AdminPanel><AdminPanelTitle>Erişim Değişiklikleri</AdminPanelTitle><ul className="space-y-3  text-sm text-body">
        {audit.map(row => <li key={row.id}>{row.username} · {row.enabled ? row.dailyLimit === null ? "Sınırsız" : `Günlük ${row.dailyLimit} Analiz` : "Erişim Kapalı"} · {row.actor ?? "Silinmiş Yönetici"} · {date(row.createdAt)}</li>)}
        {!audit.length && <li>Henüz erişim değişikliği yok.</li>}
      </ul></AdminPanel>
    </div>;

}
