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
import {
  getCronPulse,
  getHealthChecks,
  type HealthCheck,
} from "@/lib/admin-data";
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
    <div className="flex flex-col gap-6">
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
  const [pulse, status, checks] = await Promise.all([
    getCronPulse(),
    getStatus(),
    getHealthChecks(),
  ]);
  /* Aynı istekte `Checks()` de çağırıyor; ikisi ayrı Suspense sınırında ve
     prop olarak geçmek mümkün değil. `getHealthChecks` bu yüzden `cache()`li
     — altı yoklama iki kez koşmuyor. */
  const sorunlu = checks.filter(
    (c) => c.tone === "warn" || c.tone === "down",
  ).length;

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
        value={pulse.ranToday ? "Bugün Koştu" : "Koşmadı"}
        sub={agoLabel(pulse.lastNewsFetch)}
        delta={
          pulse.ranToday
            ? { text: "Sağlıklı", tone: "up", srLabel: "sağlıklı" }
            : { text: "Kontrol Et", tone: "down", srLabel: "kontrol et" }
        }
      />
      <StatBox
        label="Seans"
        value={sessionLabel[status.session]}
        /* Sunucunun kendi saati BURAYA indi. Dört kutunun üçü saatti ve en
           büyük punto sunucunun saatindeydi — oysa o, bir sorun anında
           bakılacak son sayı. Saat yine görünüyor, yalnızca künye
           ölçüsünde; büyük punto operasyonel sayılara kaldı. */
        sub={`ET ${status.etTime} · Sunucu ${formatInZone(now, TR_ZONE)} TR`}
      />
      <StatBox
        label="Sonraki Geçiş"
        value={formatInZone(status.nextTransition, TR_ZONE)}
        sub={`${formatInZone(status.nextTransition, ET_ZONE)} NY · Seans Anlatısı Burada Değişir`}
      />
      {/* Dördüncü kutu artık bir SAYI: kaç sağlık satırı ilgi istiyor.
          Aşağıdaki liste hangileri olduğunu söylüyor, kutu kaç tane
          olduğunu — sayfanın en üstünde cevaplanması gereken soru bu.
          Yön rengi yüklenmiyor: sıfır sorun `up`, varsa `down`. */}
      <StatBox
        label="Sağlık"
        value={sorunlu === 0 ? "Tümü Sağlıklı" : `${sorunlu} Satır`}
        sub={
          sorunlu === 0
            ? `${checks.length} Kontrolün Tamamı Geçti`
            : "Aşağıdaki Listede İşaretli"
        }
        delta={
          sorunlu === 0
            ? { text: "Sorun Yok", tone: "up", srLabel: "sorun yok" }
            : { text: "İlgi Bekliyor", tone: "down", srLabel: "ilgi bekliyor" }
        }
      />
    </StatGrid>
  );
}

/**
 * Sağlık satırı listesi — üç panel de aynı satırı çiziyor.
 *
 * MODÜL SEVİYESİNDE: bileşen `Checks()` içinde tanımlıydı ve her çizimde
 * yeni bir bileşen türü doğuruyordu (`react-hooks/static-components`).
 *
 * Sorunlu satırlar Özet ekranındaki "Dikkat İsteyenler" listesine
 * kendiliğinden düşüyor — orası zaten `tone` süzüyor, yeni bir bant açmaya
 * gerek yok.
 */
function CheckList({ items }: { items: HealthCheck[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((check) => (
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
              <span className="block text-small text-muted">{check.note}</span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="numeral block text-base font-semibold text-body">
              {check.value}
            </span>
            <span className="block text-tiny text-muted">
              {HEALTH_LABEL[check.tone]}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

async function Checks() {
  const checks = await getHealthChecks();
  const keys = checks.filter((c) => c.group === "key");
  const data = checks.filter((c) => c.group === "data");
  const routines = checks.filter((c) => c.group === "routine");

  return (
    <div className="flex flex-col gap-6">
      {/* RUTİNLER EN ÜSTTE. Sitenin yazılı içeriğinin tamamını kod dışında
          koşan dört rutin üretiyor; bir tanesi durduğunda ana sayfa eski
          metni göstermeye devam ediyor ve panel bugüne kadar hiçbir şey
          demiyordu. Sağlayıcı senkronu bir altta — o zaten kendi kendini
          onaran bir cron, bu ise elle kurulmuş bir zincir. */}
      <AdminPanel>
        <AdminPanelTitle hint="İçeriği Yazan claude.ai Görevleri · Saatler TR">
          Rutinler
        </AdminPanelTitle>
        <CheckList items={routines} />
      </AdminPanel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AdminPanel>
          <AdminPanelTitle hint="Sağlayıcı Verisi ve Takvimlerin Güncelliği">
            Veri Sağlığı
          </AdminPanelTitle>
          <CheckList items={data} />
        </AdminPanel>

        <AdminPanel>
          <AdminPanelTitle hint="Ortam Değişkeni Tanımlı mı — DEĞERİ Hiçbir Yerde Gösterilmez">
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
    </div>
  );
}
