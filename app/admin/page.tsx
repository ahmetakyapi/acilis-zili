import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Suspense } from "react";
import {
  AdminPanel,
  AdminPanelTitle,
  HEALTH_LABEL,
  HealthDot,
  RankList,
  StatBox,
  StatGrid,
} from "@/components/admin/AdminUI";
import { TrafficChart } from "@/components/admin/TrafficChart";
import {
  getContentSummary,
  getHealthChecks,
  getMemberSummary,
  getTopRoutes,
  getTrafficSeries,
  getTrafficTotals,
} from "@/lib/admin-data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getLocale } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/primitives";
import { deltaOf } from "@/lib/admin-format";

/**
 * Özet — panelin açılış ekranı.
 *
 * Sorusu tek: "bugün bakmam gereken bir şey var mı". Bu yüzden en üstte
 * sayılar, hemen altında SORUNLU sağlık satırları duruyor; sağlıklı olanlar
 * burada değil, Sistem sekmesinde. Bir yönetim panelinin en kötü hâli her
 * şeyi eşit ağırlıkta gösterip hiçbir şeyi söylememesi.
 */

export default async function AdminOverviewPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
        <Headline />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
          <TrafficCard />
        </Suspense>
        <div className="flex flex-col gap-5">
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
            <AttentionCard />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
            <TopRoutesCard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Headline() {
  /* İki pencere de DÜNDE biter: bugünü içeren yarım gün, tam bir haftayla
     karşılaştırılınca trafik sabitken bile kalıcı düşüş gösteriyordu. */
  const lastFull = addEtDays(todayEt(), -1);
  const [last7, prev7, members] = await Promise.all([
    getTrafficTotals(addEtDays(lastFull, -6), lastFull),
    getTrafficTotals(addEtDays(lastFull, -13), addEtDays(lastFull, -7)),
    getMemberSummary(),
  ]);

  return (
    <StatGrid>
      <StatBox
        label="Görüntüleme"
        value={last7.views.toLocaleString("tr-TR")}
        sub="son 7 tam gün"
        delta={deltaOf(last7.views, prev7.views)}
      />
      {/* "Tekil Ziyaretçi" DEĞİL: özet her gün döndüğü için çok günlük
          pencerede sayılan şey kişi değil ziyaretçi-günü (bkz. TrafficTotals). */}
      <StatBox
        label="Ziyaretçi Günü"
        value={last7.visitorDays.toLocaleString("tr-TR")}
        sub="son 7 gün · aynı kişi her gün yeniden sayılır"
        delta={deltaOf(last7.visitorDays, prev7.visitorDays)}
      />
      <StatBox
        label="Üye"
        value={members.total.toLocaleString("tr-TR")}
        sub={`${members.withWatchlistItems} kişi liste kurmuş`}
        delta={
          members.last7 > 0
            ? {
                text: `+${members.last7}`,
                tone: "up",
                srLabel: `${members.last7} yeni üye`,
              }
            : { text: "0", tone: "neutral", srLabel: "0" }
        }
      />
      <StatBox
        label="Yeni Üye"
        value={members.last30.toLocaleString("tr-TR")}
        sub="son 30 gün"
      />
    </StatGrid>
  );
}

async function TrafficCard() {
  const [series, locale] = await Promise.all([getTrafficSeries(30), getLocale()]);
  return (
    <AdminPanel>
      <AdminPanelTitle
        hint="Son 30 gün · ET takvim günü"
        action={
          <Link
            href="/admin/trafik"
            className="text-small font-semibold text-primary hover:text-primary-hover"
          >
            Tümünü Gör
          </Link>
        }
      >
        Trafik
      </AdminPanelTitle>
      <TrafficChart points={series} locale={locale} />
    </AdminPanel>
  );
}

/**
 * Dikkat isteyenler — yalnızca sorunlu ve uyarılı satırlar.
 * Hepsi yolundaysa bunu açıkça yazar; boş bir kutu "yüklenemedi" gibi durur.
 */
async function AttentionCard() {
  const [checks, content] = await Promise.all([
    getHealthChecks(),
    getContentSummary(),
  ]);
  const problems = checks.filter((c) => c.tone === "down" || c.tone === "warn");

  const gaps: string[] = [];
  if (content.storiesMissingEn.length > 0) {
    gaps.push(`${content.storiesMissingEn.length} mercek yazısının İngilizcesi yok`);
  }
  if (content.analysesMissingEn.length > 0) {
    gaps.push(`${content.analysesMissingEn.length} analizin İngilizcesi yok`);
  }
  if (content.analysesWithoutCharts.length > 0) {
    gaps.push(`${content.analysesWithoutCharts.length} analiz grafiksiz`);
  }

  return (
    <AdminPanel>
      <AdminPanelTitle hint="Yalnızca sorunlu ve eksik olanlar">
        Dikkat İsteyenler
      </AdminPanelTitle>

      {problems.length === 0 && gaps.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-base text-body">
          <HealthDot tone="ok" />
          Her şey yolunda — eksik veri ya da bayat kayıt yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {problems.map((check) => (
            <li key={check.label} className="flex items-start gap-2.5 text-base">
              <span className="mt-[5px]">
                <HealthDot tone={check.tone} />
              </span>
              <span className="min-w-0">
                <span className="font-semibold text-strong">{check.label}</span>{" "}
                <span className="text-muted">· {HEALTH_LABEL[check.tone]}</span>
                <span className="block text-small text-muted">
                  {check.value} — {check.note}
                </span>
              </span>
            </li>
          ))}
          {gaps.map((gap) => (
            <li key={gap} className="flex items-start gap-2.5 text-base">
              <span className="mt-[5px]">
                <HealthDot tone="warn" />
              </span>
              <span className="text-body">{gap}</span>
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

async function TopRoutesCard() {
  const routes = await getTopRoutes(7, 8);
  return (
    <AdminPanel>
      <AdminPanelTitle hint="Son 7 gün · rota şablonuna göre">
        En Çok Okunan Bölümler
      </AdminPanelTitle>
      <RankList
        rows={routes.map((r) => ({
          key: r.key,
          label: r.key,
          value: r.views,
          secondary: `${r.visitors} kişi`,
        }))}
        emptyLabel="Henüz ölçüm kaydı yok."
      />
    </AdminPanel>
  );
}
