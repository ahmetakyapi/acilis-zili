import { Suspense } from "react";
import {
  AdminPanel,
  AdminPanelTitle,
  HEALTH_LABEL,
  HealthDot,
  StatBox,
  StatGrid,
} from "@/components/admin/AdminUI";
import { Skeleton } from "@/components/ui/primitives";
import { getCronPulse, getHealthChecks } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { getStatus } from "@/lib/data";
import { agoLabel } from "@/lib/admin-format";
import { formatInZone, TR_ZONE } from "@/lib/session-clock";
import { ET_ZONE } from "@/lib/market-hours";

/**
 * Sistem — verinin durumu.
 *
 * Bu sayfa "her şey yolunda" demeyi de bir iş sayıyor: sağlıklı satırlar
 * gizlenmiyor. Özet ekranı yalnızca sorunluları gösteriyor çünkü orada soru
 * "bakmam gereken bir şey var mı"; burada soru "neyin durumu ne" ve cevabın
 * tamamı görünmeli.
 *
 * Renk TEK BAŞINA bilgi taşımıyor: her satırda noktanın yanında "Sağlıklı /
 * Dikkat / Sorunlu" yazıyor.
 */

export default async function SystemPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <Pulse />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Checks />
      </Suspense>
    </div>
  );
}

async function Pulse() {
  const [pulse, status] = await Promise.all([getCronPulse(), getStatus()]);

  const sessionLabel: Record<string, string> = {
    regular: "Ana seans açık",
    "pre-market": "Ön seans",
    "after-hours": "Akşam seansı",
    closed: status.holiday
      ? `Tatil · ${status.holiday.nameTr}`
      : status.isWeekend
        ? "Hafta sonu"
        : "Kapalı",
  };

  const now = new Date();

  return (
    <StatGrid>
      <StatBox
        label="Cron"
        value={pulse.ranToday ? "Bugün koştu" : "Koşmadı"}
        sub={agoLabel(pulse.lastNewsFetch)}
        delta={
          pulse.ranToday
            ? { text: "sağlıklı", tone: "up", srLabel: "sağlıklı" }
            : { text: "kontrol et", tone: "down", srLabel: "kontrol et" }
        }
      />
      <StatBox
        label="Seans"
        value={sessionLabel[status.session]}
        sub={`ET ${status.etTime}`}
      />
      <StatBox
        label="Sonraki Geçiş"
        value={formatInZone(status.nextTransition, TR_ZONE)}
        sub={`${formatInZone(status.nextTransition, ET_ZONE)} NY · seans anlatısı burada değişir`}
      />
      <StatBox
        label="Sunucu Saati"
        value={formatInZone(now, TR_ZONE)}
        sub={`${formatInZone(now, ET_ZONE)} NY`}
      />
    </StatGrid>
  );
}

async function Checks() {
  const checks = await getHealthChecks();
  const keys = checks.filter((c) => c.group === "key");
  const data = checks.filter((c) => c.group === "data");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <AdminPanel>
        <AdminPanelTitle hint="Sağlayıcı verisi ve takvimlerin güncelliği">
          Veri Sağlığı
        </AdminPanelTitle>
        <ul className="flex flex-col divide-y divide-line">
          {data.map((check) => (
            <li
              key={check.label}
              className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 items-start gap-2.5">
                <span className="mt-[6px]">
                  <HealthDot tone={check.tone} />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-strong">
                    {check.label}
                  </span>
                  <span className="block text-small text-muted">
                    {check.note}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-base font-semibold tabular-nums text-body">
                  {check.value}
                </span>
                <span className="block text-tiny text-muted">
                  {HEALTH_LABEL[check.tone]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </AdminPanel>

      <AdminPanel>
        <AdminPanelTitle hint="Ortam değişkeni tanımlı mı — DEĞERİ hiçbir yerde gösterilmez">
          Anahtarlar
        </AdminPanelTitle>
        <ul className="flex flex-col divide-y divide-line">
          {keys.map((check) => (
            <li
              key={check.label}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex items-center gap-2.5 text-base text-strong">
                <HealthDot tone={check.tone} />
                {check.label}
              </span>
              <span className="text-small text-muted">{check.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-small text-muted">
          Eksik anahtar sayfayı çökertmez: ilgili kart &ldquo;veri
          alınamadı&rdquo; gösterir ve gerisi çalışmaya devam eder.
        </p>
      </AdminPanel>
    </div>
  );
}
