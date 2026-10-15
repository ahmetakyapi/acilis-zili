import { desc, eq, ilike, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { aiAnalysisAccess, aiAnalysisAudit, aiAnalysisRequests, users } from "@/lib/schema";
import { istanbulDay, remainingAnalyses } from "@/lib/ai-analysis-core";
import { PageHeader, Button } from "@/components/ui/primitives";
import {
  AdminCell,
  AdminPanel,
  AdminPanelError,
  AdminPanelTitle,
  AdminRow,
  AdminTable,
  HEALTH_INK,
  HEALTH_LABEL,
  HealthMark,
  StatBox,
  StatGrid,
  type HealthTone,
} from "@/components/admin/AdminUI";
import { AnalysisAccessForm } from "@/components/ai/AnalysisAccessForm";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import styles from "@/components/ai/Analysis.module.css";

/**
 * AI Analiz yönetimi — PANELİN KENDİ DİLİYLE (14 Ekim). Sayfa panelin
 * yeniden tasarımına hiç girmemişti: ham `<table>` (keyfi var'lı border
 * sınıfları ve kökün ölçerek kapattığı `tabular-nums` ile), düz paragraf
 * yığını ve durum sözcükleri renksizdi. Şimdi sayının yeri `StatGrid`,
 * listenin yeri
 * `AdminTable` (yapışkan ilk sütun + kaydırma işareti), durumun yeri
 * `HealthMark` + sözcük — öteki beş bölümle aynı parçalar.
 */

export const metadata = { title: adminDocTitle("AI Analiz") };
const STATUS: Record<string, { tone: HealthTone; label: string }> = {
  processing: { tone: "idle", label: "Hazırlanıyor" },
  completed: { tone: "ok", label: "Tamamlandı" },
  failed: { tone: "down", label: "Başarısız" },
};
const date = (value: Date) => value.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });
const count = (value: number | bigint) => Number(value).toLocaleString("tr-TR");

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
  const section = ADMIN_SECTIONS.ai;
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={section.title} subtitle={section.subtitle} />
        <AdminPanel>
          <AdminPanelTitle>Veritabanına Ulaşılamadı</AdminPanelTitle>
          <AdminPanelError>
            Analiz tabloları henüz kurulmamış veya veritabanına erişilemiyor.
            Mevcut teknik analiz ve hisse seçimi ekranları çalışmaya devam eder.
          </AdminPanelError>
        </AdminPanel>
      </div>
    );
  }
  const { rows, usage, totalsRows, audit } = data;
  const totals = totalsRows[0];
  const keyOk = Boolean(process.env.CLAUDE_ANALYSIS_API_KEY);
  const production = process.env.CLAUDE_ANALYSIS_DISABLED !== "1";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={section.title} subtitle={section.subtitle} />

      {/* Sayılar sayı kutusunda: öteki bölümlerin ilk ekranıyla aynı dil.
          Başarısız istek sıfırdan büyükse kutu dikkat tonunda. */}
      <StatGrid cols={4}>
        <StatBox label="Bugün Rapor" value={count(totals.today)} sub="İstanbul gününde" />
        <StatBox label="Toplam Rapor" value={count(totals.completed)} />
        <StatBox
          label="Başarısız İstek"
          value={count(totals.failed)}
          status={totals.failed > 0 ? { tone: "warn", label: HEALTH_LABEL.warn } : { tone: "ok", label: HEALTH_LABEL.ok }}
        />
        <StatBox
          label="Token Giriş / Çıkış"
          value={`${count(totals.input)} / ${count(totals.output)}`}
          sub="Kesin ücret Claude Console'da"
        />
      </StatGrid>

      <AdminPanel>
        <AdminPanelTitle>Sistem</AdminPanelTitle>
        <ul className="flex flex-col gap-2 text-sm text-body">
          <li className="flex items-center gap-2.5">
            <HealthMark tone={keyOk ? "ok" : "down"} />
            <span>{keyOk ? "Analiz anahtarı tanımlı." : "Analiz anahtarı henüz tanımlı değil."}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <HealthMark tone={production ? "ok" : "idle"} />
            <span>{production ? "Analiz üretimi açık." : "Analiz üretimi kapalı."}</span>
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Yeni erişimler için varsayılan günlük hak 5&apos;tir. Kota İstanbul
          saatiyle 00:00&apos;da yenilenir. Başarısız işler kullanıcı hakkına
          iade edilir; kullanılan tokenlar burada kalır.
        </p>
      </AdminPanel>

      <AdminPanel>
        <AdminPanelTitle>Kullanıcı Erişimi</AdminPanelTitle>
        <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
          <label className={styles.field}>
            Kullanıcı Ara
            <input name="q" defaultValue={query} className={styles.input} placeholder="Kullanıcı adı" maxLength={50} />
          </label>
          <Button type="submit" variant="quiet" size="sm">Ara</Button>
        </form>
        <p className="mb-3 text-xs text-muted">
          İlk 100 eşleşme gösterilir. Daha fazla kullanıcı için adıyla ara.
          Diğer admin hesaplarına otomatik analiz erişimi verilmez.
        </p>
        {!rows.length && <p className="text-sm text-body">Eşleşen kullanıcı bulunamadı.</p>}
        {rows.map(row => <AnalysisAccessForm key={row.id} userId={row.id} username={row.username} owner={row.username === "ahmetakyapi" && row.role === "admin"}
          enabled={row.enabled ?? false} dailyLimit={row.enabled === null ? 5 : row.dailyLimit}
          remaining={remainingAnalyses(row.dailyLimit ?? (row.enabled === null ? 5 : null), row.usedCount ?? 0, row.usedDay)} />)}
      </AdminPanel>

      <AdminPanel>
        <AdminPanelTitle>Son Analiz İstekleri</AdminPanelTitle>
        <AdminTable
          head={["Kullanıcı", "Hisse", "Durum", "Model", "Token (Giriş / Çıkış)", "Tarih · TR"]}
          label="Son analiz istekleri"
          minWidth={760}
          stickyFirst
        >
          {usage.map((row) => {
            const status = STATUS[row.status] ?? { tone: "info" as const, label: row.status };
            return (
              <AdminRow key={row.id}>
                <AdminCell strong>{row.username}</AdminCell>
                <AdminCell numeral>{row.symbol}</AdminCell>
                <AdminCell>
                  <span className="flex items-center gap-2">
                    <HealthMark tone={status.tone} />
                    <span className={HEALTH_INK[status.tone]}>{status.label}</span>
                  </span>
                </AdminCell>
                <AdminCell>{row.model}</AdminCell>
                <AdminCell numeral>{row.inputTokens != null ? count(row.inputTokens) : "—"} / {row.outputTokens != null ? count(row.outputTokens) : "—"}</AdminCell>
                <AdminCell align="right" numeral>{date(row.createdAt)}</AdminCell>
              </AdminRow>
            );
          })}
          {!usage.length && (
            <AdminRow>
              <AdminCell>Henüz analiz isteği yok.</AdminCell>
            </AdminRow>
          )}
        </AdminTable>
      </AdminPanel>

      <AdminPanel>
        <AdminPanelTitle>Erişim Değişiklikleri</AdminPanelTitle>
        <ul className="flex flex-col text-sm text-body">
          {audit.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-line-soft py-2.5 first:border-t-0 first:pt-0 last:pb-0">
              <span className="font-semibold text-strong">{row.username}</span>
              <span>{row.enabled ? (row.dailyLimit === null ? "Sınırsız" : `Günlük ${row.dailyLimit} Analiz`) : "Erişim Kapalı"}</span>
              <span className="ml-auto text-xs text-muted">{row.actor ?? "Silinmiş Yönetici"} · <span className="numeral">{date(row.createdAt)}</span></span>
            </li>
          ))}
          {!audit.length && <li>Henüz erişim değişikliği yok.</li>}
        </ul>
      </AdminPanel>
    </div>
  );
}
