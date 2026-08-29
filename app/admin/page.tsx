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
  StatGridSkeleton,
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
import { PanelLink, Skeleton } from "@/components/ui/primitives";
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
    <div className="flex flex-col gap-6">
      {/* YER TUTUCU IZGARANIN KENDİ ŞEKLİ. Tek bir `h-28` çubuktu ve o ölçü
          masaüstünde doğru: dört kutu tek satırda. Telefonda ızgara iki
          kolona iniyor ve gerçek yükseklik 250–285 piksel — akış inince
          altındaki her şey 155+ piksel aşağı kayıyordu. Sabit bir piksel
          değeri yazmak yerine yer tutucu gerçek ızgarayı çiziyor: hangi
          kırılımda kaç satır olursa olsun boy kendiliğinden doğru. */}
      <Suspense fallback={<StatGridSkeleton boxes={4} />}>
        <Headline />
      </Suspense>

      {/* TELEFONDA SIRA: SAYILAR → DİKKAT → TRAFİK.
          Izgara `lg` altında tek kolon ve orada DOM sırası geçerliydi; grafik
          önce geldiği için "bugün bakmam gereken bir şey var mı" sorusunun
          cevabı (sorunlu sağlık satırları) ~950 piksel aşağıda, ikinci
          ekranın da altında başlıyordu — bu ekranın kendi başlık yorumundaki
          söze aykırı. DOM sırası artık mobil sıra; masaüstü yerleşim
          `col-start`/`row-start` ile açıkça veriliyor ve birebir aynı. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <div className="lg:col-start-2 lg:row-start-1">
            <AttentionCard />
          </div>
        </Suspense>
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
          <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <TrafficCard />
          </div>
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <div className="lg:col-start-2 lg:row-start-2">
            <TopRoutesCard />
          </div>
        </Suspense>
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
        sub="Son 7 Tam Gün"
        delta={deltaOf(last7.views, prev7.views)}
      />
      {/* "Tekil Ziyaretçi" DEĞİL: özet her gün döndüğü için çok günlük
          pencerede sayılan şey kişi değil ziyaretçi-günü (bkz. TrafficTotals). */}
      <StatBox
        label="Ziyaretçi Günü"
        value={last7.visitorDays.toLocaleString("tr-TR")}
        sub="Son 7 Tam Gün · Aynı Kişi Her Gün Yeniden Sayılır"
        delta={deltaOf(last7.visitorDays, prev7.visitorDays)}
      />
      <StatBox
        label="Üye"
        value={members.total.toLocaleString("tr-TR")}
        sub={`${members.withWatchlistItems} Kişi Liste Kurmuş`}
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
        sub="Son 30 Gün"
      />
    </StatGrid>
  );
}

async function TrafficCard() {
  const [series, locale] = await Promise.all([
    getTrafficSeries(30),
    getLocale(),
  ]);
  return (
    <AdminPanel>
      <AdminPanelTitle
        /* Cümle /admin/trafik'tekiyle AYNI: iki ekran aynı seriyi çiziyor ve
           biri bugünün dahil olduğunu söylerken öteki susuyordu. */
        hint="Son 30 Gün · Bugün Dahil, ET Takvim Günü"
        action={
          /* Sitenin kendi ilkeli: dokunma hedefini `.tap-44` ile açıyor,
             görünür ölçü aynı kalıyor. Elle yazılan bağlantı 18 piksellik
             bir hedefti. */
          <PanelLink href="/admin/trafik">Tümünü Gör</PanelLink>
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
    gaps.push(
      `${content.storiesMissingEn.length} mercek yazısının İngilizcesi yok`,
    );
  }
  if (content.analysesMissingEn.length > 0) {
    gaps.push(`${content.analysesMissingEn.length} analizin İngilizcesi yok`);
  }
  if (content.analysesWithoutCharts.length > 0) {
    gaps.push(`${content.analysesWithoutCharts.length} analiz grafiksiz`);
  }

  return (
    <AdminPanel>
      {/* Panelin çıkışı VAR. Sorunu gören yöneticinin bir sonraki adımı
          Sistem sekmesi — o adım bugüne kadar elle gezinmeyle atılıyordu. */}
      <AdminPanelTitle
        hint="Yalnızca Sorunlu ve Eksik Olanlar"
        action={<PanelLink href="/admin/sistem">Sistemi Aç</PanelLink>}
      >
        Dikkat İsteyenler
      </AdminPanelTitle>

      {problems.length === 0 && gaps.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-base text-body">
          <HealthDot tone="ok" />
          Her şey yolunda — eksik ya da güncellenmemiş kayıt yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {problems.map((check) => (
            <li
              key={check.label}
              className="flex items-start gap-2.5 text-base"
            >
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
      {/* Bağlantı KARTIN PENCERESİYLE aynı pencereye gidiyor (7 gün); başka
          bir pencereye götürmek okuyucuya farklı sayılar gösterirdi.
          Yalnızca başlık bağlanıyor — satır anahtarları `/hisse/[symbol]`
          gibi rota ŞABLONLARI, gidilebilir adres değil. */}
      <AdminPanelTitle
        hint="Son 7 Tam Gün · Rota Şablonuna Göre"
        action={<PanelLink href="/admin/trafik?gun=7">Tümünü Gör</PanelLink>}
      >
        En Çok Okunan Bölümler
      </AdminPanelTitle>
      <RankList
        rows={routes.map((r) => ({
          key: r.key,
          label: r.key,
          value: r.views,
          /* "kişi" DEĞİL. Sayı `countDistinct(visitorHash)` ve özet her
             gün dönüyor: çok günlük pencerede sayılan şey kişi değil
             ziyaretçi-günü. Aynı ayrım `TrafficTotals` yorumunda yazılı ve
             üstteki kutu zaten doğru adı kullanıyordu; bu satır geride
             kalmıştı. */
          secondary: `${r.visitors.toLocaleString("tr-TR")} Ziyaretçi-Günü`,
        }))}
        emptyLabel="Henüz ölçüm kaydı yok."
      />
    </AdminPanel>
  );
}
