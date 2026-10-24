import Link from "next/link";
import {
  AdminPanel,
  AdminPanelTitle,
  HealthRow,
} from "@/components/admin/AdminUI";
import { getHolidays } from "@/lib/data";
import { adminDay } from "@/lib/admin-format";
import { chartGaps, dailyChartHref, lastCompletedSession, recentSessions } from "@/lib/daily-chart";
import { getDailyChartHealth } from "@/lib/daily-chart-data";

/** Pencere: son on işlem günü — iki hafta, rutinin kaçırdığını görmeye yeter. */
const WINDOW_SESSIONS = 10;

/**
 * Günün Grafiği'nin sağlığı — İçerik ÖLÇER (24 Ekim).
 *
 * AYRI PANEL, Eksikler şeridinin yedinci hücresi DEĞİL: şerit `lg`de altı
 * sütunluk bir ızgara ve hücre genişlikleri ölçülerek kurulmuş (bkz.
 * app/admin/icerik/page.tsx → `GAP_LIST`). Bu panel kendi penceresini
 * soruyor: son on işlem gününün hangisinde grafik yok, hangisinin
 * İngilizcesi eksik. Tablo yoksa (migration uygulanmadı) bunu söylüyor —
 * "eksik yok" gibi görünmüyor.
 *
 * Düzeltme Yazılar'da DEĞİL (henüz editörü yok): rutin aynı günü yeniden
 * POST ederek düzeltir, eski hâl `story_revisions`ta (`grafik:{gün}`).
 */
export async function DailyChartHealth() {
  const holidays = await getHolidays();
  const sessions = recentSessions(lastCompletedSession(new Date(), holidays), WINDOW_SESSIONS, holidays);
  const oldest = sessions[sessions.length - 1];
  const health = await getDailyChartHealth(oldest);

  if (!health.available) {
    return (
      <AdminPanel id="gunun-grafigi">
        <AdminPanelTitle>Günün Grafiği</AdminPanelTitle>
        <ul>
          <HealthRow
            tone="idle"
            label="Tablo Okunamadı"
            note="daily_charts migration'ı uygulanmamış olabilir; uç yazmayı 503 ile reddeder."
            status="Okunamadı"
          />
        </ul>
      </AdminPanel>
    );
  }

  const gaps = chartGaps(sessions, health.days);
  const missingDays = gaps.filter((gap) => gap.missing === "chart");
  const missingEn = gaps.filter((gap) => gap.missing === "en");

  return (
    <AdminPanel id="gunun-grafigi">
      <AdminPanelTitle hint={`Son ${WINDOW_SESSIONS} İşlem Günü`}>Günün Grafiği</AdminPanelTitle>
      <ul>
        <HealthRow
          tone={missingDays.length > 0 ? "warn" : "ok"}
          label="Yazılmamış Gün"
          note={
            missingDays.length > 0
              ? missingDays.map((gap) => adminDay(gap.day)).join(", ")
              : "Her işlem gününün grafiği var."
          }
          value={missingDays.length.toLocaleString("tr-TR")}
          status={missingDays.length > 0 ? "Dikkat" : "Tamam"}
        />
        <HealthRow
          tone={missingEn.length > 0 ? "warn" : "ok"}
          label="İngilizcesi Eksik"
          note={
            missingEn.length > 0 ? (
              <span className="flex flex-wrap gap-x-3">
                {missingEn.map((gap) => (
                  <Link key={gap.day} href={dailyChartHref(gap.day)} prefetch={false} className="hover:text-primary">
                    {adminDay(gap.day)}
                  </Link>
                ))}
              </span>
            ) : (
              "Yazılan her grafiğin iki dili var."
            )
          }
          value={missingEn.length.toLocaleString("tr-TR")}
          status={missingEn.length > 0 ? "Dikkat" : "Tamam"}
        />
      </ul>
    </AdminPanel>
  );
}
