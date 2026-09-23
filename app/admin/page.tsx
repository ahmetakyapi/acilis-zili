import { requireAdmin } from "@/lib/admin";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import { Suspense } from "react";
import {
  AdminPanel,
  AdminPanelError,
  AdminPanelSkeleton,
  AdminPanelTitle,
  AdminReadStamp,
  HealthList,
  HealthRow,
  RankList,
  StatBox,
  StatGrid,
  StatGridSkeleton,
  type HealthTone,
} from "@/components/admin/AdminUI";
import { TrafficChart, TrafficChartSkeleton } from "@/components/admin/TrafficChart";
import {
  fullDayWindow,
  getContentSummary,
  getHealthChecks,
  getMemberSummary,
  getTopRoutes,
  getTrackingRange,
  getTrafficSeries,
  getTrafficTotals,
  type HealthCheck,
} from "@/lib/admin-data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { PageHeader, PanelLink, Skeleton } from "@/components/ui/primitives";
import {
  METRIC,
  adminDayIn,
  adminWeekRange,
  deltaOf,
} from "@/lib/admin-format";
import { dayBoundaryNote } from "@/lib/session-clock";

/**
 * Özet — panelin açılış ekranı.
 *
 * Sorusu tek: "bugün bakmam gereken bir şey var mı". Bu yüzden en üstte
 * sayılar, hemen altında SORUNLU sağlık satırları duruyor; sağlıklı olanlar
 * burada değil, Sistem sekmesinde. Bir yönetim panelinin en kötü hâli her
 * şeyi eşit ağırlıkta gösterip hiçbir şeyi söylememesi.
 */

/* Her bölümün kendi sekme başlığı: altısı "Yönetim · Açılış Zili"
   paylaşıyordu ve tarayıcı sekmesi, geçmiş, ekran okuyucu bölümleri
   ayıramıyordu. */
export const metadata = { title: adminDocTitle(ADMIN_SECTIONS.overview.title) };

/**
 * "En Çok Okunan Bölümler"in satır sayısı — yanındaki Trafik paneliyle
 * AYNI HATTA bitsin diye. Satır 50 piksel; sayı grafiğin boyuna bağlı ve
 * grafik değişirse yeniden ölçülür.
 *
 * Tek çizimli grafikte Trafik paneli 423 pikseldi ve sekiz satırlık liste
 * (520,5) onun 97,5 piksel altında bitiyordu; altıya inildi (2,5 fark).
 * Grafik ziyaretçi şeridini ayrı çizmeye başlayınca panel 528 (1440) ve
 * 554 piksele (1024, okuma satırı ikiye sarıyor) uzadı ve altı satırlık
 * liste bu kez 107,5 / 133,5 piksel kısa kaldı. Sekizde fark 7,5 ve 33,5
 * (ölçüldü). Kalan satırlar "Tümünü Gör"ün arkasında, Trafik sekmesinde.
 */
const TOP_ROUTES = 8;

export default async function AdminOverviewPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    /* SIRA HER GENİŞLİKTE AYNI: SAYILAR → DİKKAT → TRAFİK | BÖLÜMLER.
       Telefon sırası bir dönem yalnızca telefonda geçerliydi: DOM sırası
       mobil sıraydı, masaüstü `col-start`/`row-start`/`row-span-2` ile
       yeniden diziliyordu. Trafik iki satıra yayıldığı için hücresi sağdaki
       iki panelin toplam boyuna geriliyor, panel ise yerinde kalıyordu —
       grafiğin altında 382 piksel (1024'te 400) boş sayfa (23 Eylül
       denetimi, ölçüldü). Dikkat artık tam genişlikte ve cevap her
       genişlikte sayıların hemen altında; altındaki iki panel yan yana,
       `items-start` ile hiçbiri öbürünün boyuna gerilmiyor. */
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Yönetim"
        title={ADMIN_SECTIONS.overview.title}
        subtitle={ADMIN_SECTIONS.overview.subtitle}
      />

      <div className="flex flex-col gap-3">
        {/* YER TUTUCU IZGARANIN KENDİ ŞEKLİ. Tek bir `h-28` çubuktu ve o ölçü
            yalnızca masaüstünde doğruydu: telefonda ızgara iki kolona iniyor
            ve akış inince altındaki her şey 155+ piksel aşağı kayıyordu. Yer
            tutucu gerçek ızgarayı gerçek kutunun dizeleriyle çiziyor
            (AdminUI → `StatGridSkeleton`); kutuların künyesi tek satır
            olduğu sürece boy her kırılımda birebir. */}
        <Suspense fallback={<StatGridSkeleton boxes={4} />}>
          <Headline />
        </Suspense>
        {/* TANIM KUTUDA DEĞİL, BURADA. "Son 7 Tam Gün · Aynı Kişi Her Gün
            Yeniden Sayılır" kutunun künyesiydi ve 1440'ta iki, 1024'te üç,
            390'da dört satıra sarıyordu: ızgara satırı dört kutuyu da o boya
            geriyor, ötekilerin dibinde 20–56 piksel boş kalıyordu (ölçüldü).
            Künye kısa, tanım sayfanın notu. Akıştan bağımsız, yer tutucuyla
            birlikte basılıyor — kutular inince hiçbir şey kaymıyor. */}
        <p className="text-small leading-relaxed text-muted">
          {METRIC.visitorDays} aynı kişiyi her gün yeniden sayar, yani yedi
          günün toplamı kişi sayısı değildir. Yüzdeler önceki yedi tam günle
          kıyaslanır; aktif üye sayısına yönetici hesapları girmez.
        </p>
      </div>

      <Suspense fallback={<AttentionSkeleton />}>
        <AttentionCard />
      </Suspense>

      {/* `items-start`: kısa kalan panel erken biter, hücresi öbürünün boyuna
          gerilmez ("Boşluk esnetilmez, doldurulur", CLAUDE.md). İki panelin
          dengesi `TOP_ROUTES`ta ölçülüp kuruldu.
          Yer tutucular hücrenin KENDİSİ: yerleşim sınıfı yok, akış inince
          içerik aynı hücreye iniyor. Yerleşim sınıfları bir dönem
          Suspense'in İÇİNDEKİ sarmalayıcıdaydı ve yer tutucular DOM
          sırasıyla yanlış hücrelere diziliyordu — Dikkat'in iskeleti
          Trafik'in yerinde, her panel inerken başka bir hücreye sıçrıyordu. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Suspense fallback={<TrafficSkeleton />}>
          <TrafficCard />
        </Suspense>
        <Suspense fallback={<TopRoutesSkeleton />}>
          <TopRoutesCard />
        </Suspense>
      </div>

      {/* Ekran sırasının son satırı (CLAUDE.md, "Ekran düzeni" 7): kutuların
          "Son 7 Tam Gün"ü ve Dikkat satırlarının yaşı çizim anına göre. */}
      <AdminReadStamp />
    </div>
  );
}

async function Headline() {
  /* İki pencere de DÜNDE biter: bugünü içeren yarım gün, tam bir haftayla
     karşılaştırılınca trafik sabitken bile kalıcı düşüş gösteriyordu.
     Pencere `fullDayWindow`dan — Bölümler listesi de aynı yedi günü
     sayıyor ve iki sayı ayrı tanımlarla ayrı düşmüyor. */
  const last7Window = fullDayWindow(7);
  const previousFrom = addEtDays(last7Window.from, -7);
  const [last7, prev7, members, range] = await Promise.all([
    getTrafficTotals(last7Window.from, last7Window.to),
    getTrafficTotals(previousFrom, addEtDays(last7Window.from, -1)),
    getMemberSummary(),
    getTrackingRange(),
  ]);
  /* Kıyas yalnızca iki pencere de okunduysa ve önceki pencere tam
     ölçüldüyse (lib/admin-format.ts → `deltaOf`). */
  const kiyas = {
    trackingFrom: range.ok ? range.data.firstDay : null,
    previousFrom,
  };
  const yeniUye = members.ok ? members.data.last30 : 0;

  return (
    <StatGrid>
      <StatBox
        label={METRIC.views}
        value={last7.ok ? last7.data.views.toLocaleString("tr-TR") : "—"}
        state={last7.ok ? undefined : "unavailable"}
        sub="Son 7 Tam Gün"
        delta={
          last7.ok && prev7.ok ? deltaOf(last7.data.views, prev7.data.views, kiyas) : null
        }
      />
      {/* "Tekil Ziyaretçi" DEĞİL: özet her gün döndüğü için çok günlük
          pencerede sayılan şey kişi değil ziyaretçi-günü (bkz. TrafficTotals).
          Tanımı ızgaranın altındaki notta. */}
      <StatBox
        label={METRIC.visitorDays}
        value={last7.ok ? last7.data.visitorDays.toLocaleString("tr-TR") : "—"}
        state={last7.ok ? undefined : "unavailable"}
        sub="Son 7 Tam Gün"
        delta={
          last7.ok && prev7.ok
            ? deltaOf(last7.data.visitorDays, prev7.data.visitorDays, kiyas)
            : null
        }
      />
      {/* YALIN "0" YOK. Değişim yuvası yeni üye sayısını pencere adı olmadan
          basıyordu ve kutu "0  2 Kişi Liste Kurmuş" diye okunuyordu (23
          Eylül denetimi): yanındaki kutularda aynı yuva yüzde taşıyor.
          Artık yalnızca bir artış varsa ve penceresiyle birlikte yazılıyor;
          yoksa künye bunu söylüyor ("Son 30 Günde Kayıt Yok": 130 piksel,
          390'daki 136 piksellik kutuya tek satır sığıyor).
          "Liste kurmuş" sayısı buradan ÇIKTI: künyeye eklenince
          ("+1 · Son 30 Günde · 2 Kişi Liste Kurmuş", 209 piksel) 1024'te
          192, 390'da 136 piksellik kutuda iki satıra sarıyor ve satırın öbür
          kutularını geriyordu (ölçüldü). Sayı Üyeler sekmesinde kendi
          kutusunda. */}
      <StatBox
        label="Üye"
        value={members.ok ? members.data.total.toLocaleString("tr-TR") : "—"}
        state={members.ok ? undefined : "unavailable"}
        sub={yeniUye > 0 ? "Son 30 Günde" : "Son 30 Günde Kayıt Yok"}
        delta={
          yeniUye > 0
            ? {
                text: `+${yeniUye.toLocaleString("tr-TR")}`,
                tone: "up",
                srLabel: `son 30 günde ${yeniUye} yeni üye`,
              }
            : null
        }
      />
      {/* "YENİ ÜYE" YERİNE "AKTİF ÜYE". Yeni üye sayısı yan kutunun
          değişimiyle aynı soruyu üçüncü bir pencereyle cevaplıyordu; kayıtlı
          ile KULLANAN ayrı sayılar ve yöneticinin eyleme döktüğü ikincisi.
          Sayı Üyeler sekmesindeki "Aktif Üye" ile aynı alan
          (`readersActiveLast30`, yöneticisiz) — aynı ad iki ekranda iki
          sayı göstermesin. */}
      <StatBox
        label="Aktif Üye"
        value={members.ok ? members.data.readersActiveLast30.toLocaleString("tr-TR") : "—"}
        state={members.ok ? undefined : "unavailable"}
        sub="Son 30 Günde Giriş"
      />
    </StatGrid>
  );
}

async function TrafficCard() {
  const series = await getTrafficSeries(30);
  return (
    <AdminPanel>
      <AdminPanelTitle
        /* Cümle /admin/trafik'tekiyle AYNI: iki ekran aynı seriyi çiziyor ve
           biri bugünün dahil olduğunu söylerken öteki susuyordu. Gün sınırı
           TR saatiyle (lib/session-clock.ts → `dayBoundaryNote`); seri 30
           tam gün + bugün (lib/admin-data.ts → `getTrafficSeries`). */
        hint={`Son 30 Tam Gün + Bugün · ${dayBoundaryNote()}`}
        action={
          /* Sitenin kendi ilkeli: dokunma hedefini `.tap-44` ile açıyor,
             görünür ölçü aynı kalıyor. Elle yazılan bağlantı 18 piksellik
             bir hedefti. */
          <PanelLink href="/admin/trafik">Tümünü Gör</PanelLink>
        }
      >
        Trafik
      </AdminPanelTitle>
      {/* Dil verilmiyor: grafik panel gibi yalnızca Türkçe. Bu çağrı sitenin
          dil çerezini geçiyordu ve İngilizce çerezle eksen "08/25/2026"
          yazıyordu (gerekçe TrafficChart'ta). */}
      <TrafficChart points={series.ok ? series.data : null} />
    </AdminPanel>
  );
}

/** Dikkat satırı — sağlık yoklaması da içerik eksiği de aynı kalıpta. */
type AttentionRow = {
  key: string;
  tone: HealthTone;
  label: string;
  note?: string;
  value?: string;
  status?: string;
  href: string;
};

/**
 * Satırın gideceği yer — sorunun GİDERİLDİĞİ panel.
 *
 * Bülten rutinleri Sistem'de ölçülüyor ama düzeltmesi Yazılar'da; geri
 * kalan her yoklama Sistem'deki kendi panelinin çapasına iniyor. Ad
 * eşleşmesi yalnızca iki bülten satırı için ve adı değişirse satır
 * KIRILMIYOR, grubunun Sistem paneline düşüyor.
 */
const CHECK_HREF: Readonly<Record<string, string>> = {
  "Günlük Bülten": "/admin/yazilar/bulten",
  "Haftalık Bülten": "/admin/yazilar/bulten",
};
const GROUP_HREF: Record<HealthCheck["group"], string> = {
  key: "/admin/sistem#anahtarlar",
  data: "/admin/sistem#veri",
  routine: "/admin/sistem#rutinler",
};
const GAPS_HREF = "/admin/icerik#eksikler";

/** Sorunlu önce: kırmızı satır sarının altında kalmasın. */
const SEVERITY: Record<HealthTone, number> = { down: 0, warn: 1, info: 2, idle: 3, ok: 4 };

/** Eksik listesinin künyesi: ilk üçü, fazlası sayıyla. */
function sample(items: string[], max = 3): string {
  const shown = items.slice(0, max).join(" · ");
  return items.length > max ? `${shown} · +${items.length - max}` : shown;
}

/**
 * Dikkat isteyenler — yalnızca sorunlu ve uyarılı satırlar.
 * Hepsi yolundaysa bunu açıkça yazar; boş bir kutu "yüklenemedi" gibi durur.
 */
async function AttentionCard() {
  const [checks, contentResult] = await Promise.all([
    getHealthChecks(),
    getContentSummary(),
  ]);
  const today = todayEt();

  /* SATIR SİSTEM'İN SATIRI (23 Eylül denetimi). Değer ile not tek cümlede
     " — " ile birleşiyordu ve "2026-09-14 — 2026-09-21 haftasının kaydı
     yok" bir tarih ARALIĞI gibi okunuyordu. Artık Sistem'le aynı
     `HealthRow`: solda ad ve not, sağda ölçülen değer ve durum sözcüğü. */
  const rows: AttentionRow[] = checks
    .filter((c) => c.tone === "down" || c.tone === "warn")
    .map((c) => ({
      key: `check:${c.label}`,
      tone: c.tone,
      label: c.label,
      note: c.note,
      value: c.value,
      status: c.status,
      href: CHECK_HREF[c.label] ?? GROUP_HREF[c.group],
    }));

  /* OKUNAMAYAN İÇERİK SESSİZCE DÜŞMÜYOR: özet okunamadığında eksik
     satırları hiç oluşmuyor ve kart "Her şey yolunda" diyebiliyordu.
     Okunamadı kendi satırı; "yolunda" satırı yalnızca her okuma başarılıyken. */
  if (!contentResult.ok) {
    rows.push({
      key: "content-down",
      tone: "down",
      label: "İçerik Özeti",
      value: "Okunamadı",
      note: "Veritabanı Sorgusu Başarısız",
      href: "/admin/icerik",
    });
  } else {
    /* EKSİKLER İÇERİK SEKMESİNE gidiyor, Sistem'e değil: çeviri ve grafik
       eksiği orada listeleniyor ve oradan düzeltiliyor. Satır bir sayı
       değil, HANGİLERİ olduğunu da söylüyor — ilk üçü not olarak. */
    const c = contentResult.data;
    const gaps: [string, string, string[]][] = [
      [
        "Bülten Çevirisi",
        "Eksik",
        c.briefsMissingEn.map((b) =>
          b.period === "weekly" ? adminWeekRange(b.date) : adminDayIn(b.date, today),
        ),
      ],
      ["Mercek Çevirisi", "Eksik", c.storiesMissingEn.map((s) => s.title)],
      ["Analiz Çevirisi", "Eksik", c.analysesMissingEn.map((a) => a.label)],
      ["Analiz Grafikleri", "Grafiksiz", c.analysesWithoutCharts.map((a) => a.label)],
    ];
    for (const [label, word, items] of gaps) {
      if (items.length === 0) continue;
      rows.push({
        key: `gap:${label}`,
        tone: "warn",
        label,
        /* Mercek başlıkları uzun: tek başlık yeter, gerisi sayı. */
        note: label === "Mercek Çevirisi" ? sample(items, 1) : sample(items),
        value: `${items.length.toLocaleString("tr-TR")} ${word}`,
        href: GAPS_HREF,
      });
    }
  }

  rows.sort((a, b) => SEVERITY[a.tone] - SEVERITY[b.tone]);

  /* İKİ SÜTUN, SÜTUN SÜTUN. Panel artık tam genişlikte ve 1440'ta tek
     satır 1.270 piksel: ad solda, değer sağ uçta, göz satırı bir uçtan öbür
     uca taşıyordu. `lg`de liste ikiye bölünüyor — sol sütun önce, sonra
     sağ; okuma ve odak sırası DOM sırasıyla aynı. CSS `columns` değil:
     sütunun son satırı altına saç teli çekiyordu. Dar ekranda iki liste
     alt alta ve aralarına aynı saç teli giriyor. */
  const half = Math.ceil(rows.length / 2);
  const columns = rows.length > 1 ? [rows.slice(0, half), rows.slice(half)] : [rows];

  return (
    <AdminPanel>
      {/* Panelin çıkışı VAR ve her SATIRIN da çıkışı var: satır sorunun
          giderildiği panele iniyor, başlıktaki bağlantı bütün yoklamalara.
          Tek çıkış "Sistemi Aç"tı ve içerik eksikleri de oraya
          götürülüyordu — düzeltildikleri yer İçerik sekmesi. */}
      <AdminPanelTitle
        hint="Yalnızca Sorunlu ve Eksik Olanlar"
        action={<PanelLink href="/admin/sistem">Tümünü Gör</PanelLink>}
      >
        Dikkat İsteyenler
      </AdminPanelTitle>

      {rows.length === 0 ? (
        <HealthList>
          <HealthRow
            tone="ok"
            label="Her Şey Yolunda"
            note="Eksik ya da güncellenmemiş kayıt yok."
            href="/admin/sistem"
          />
        </HealthList>
      ) : (
        <div className="grid lg:grid-cols-2 lg:gap-x-10">
          {columns.map((column, i) => (
            <HealthList
              key={i}
              className={
                i > 0
                  ? "mt-1 border-t border-line pt-1 lg:mt-0 lg:border-t-0 lg:pt-0"
                  : undefined
              }
            >
              {column.map((row) => (
                <HealthRow
                  key={row.key}
                  tone={row.tone}
                  label={row.label}
                  note={row.note}
                  value={row.value}
                  status={row.status}
                  href={row.href}
                />
              ))}
            </HealthList>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}

async function TopRoutesCard() {
  const routes = await getTopRoutes(7, TOP_ROUTES);
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
      {routes.ok ? (
        <RankList
          rows={routes.data.map((r) => ({
            key: r.key,
            label: r.key,
            value: r.views,
            /* "kişi" DEĞİL. Sayı `countDistinct(visitorHash)` ve özet her
               gün dönüyor: çok günlük pencerede sayılan şey kişi değil
               ziyaretçi-günü. Aynı ayrım `TrafficTotals` yorumunda yazılı ve
               üstteki kutu zaten doğru adı kullanıyordu; bu satır geride
               kalmıştı. */
            secondary: `${r.visitors.toLocaleString("tr-TR")} ${METRIC.visitorDays}`,
          }))}
          emptyLabel="Henüz ölçüm kaydı yok."
        />
      ) : (
        <AdminPanelError />
      )}
    </AdminPanel>
  );
}

/* --------------------------------------------------------------------------
   Yer tutucular — her biri GERÇEK panelin boyunda.

   Üçü de sabit gri çubuktu (h-48 / h-72 / h-48 = 192 / 288 / 192 piksel)
   ve gerçek paneller 240 / 423 / 520 pikseldi (1440, ölçüldü): akış inince
   sayfa 230 piksel aşağı sıçrıyordu. Satır boyları AdminUI'deki ölçümden
   (`AdminPanelSkeleton`); telefonda satırlar uzadığı için iki boy var.
   -------------------------------------------------------------------------- */

function AttentionSkeleton() {
  /* Bugünkü sık durum: üç satır — geniş ekranda iki sütunda iki satır.
     Satır boyu bu listenin ölçüsü, genel sağlık satırınınki (62,5) değil:
     `lg`de iki satır 118 piksel (satır başı 59), dar ekranda notlar iki
     satıra sardığı için üç satır 216 piksel (satır başı 72). */
  return (
    <>
      <AdminPanelSkeleton rows={3} rowHeight={72} className="lg:hidden" />
      <AdminPanelSkeleton rows={2} rowHeight={59} className="hidden lg:block" />
    </>
  );
}

function TopRoutesSkeleton() {
  /* Künyeli satır telefonda iki satır: 72,5 piksel, geniş ekranda 50. */
  return (
    <>
      <AdminPanelSkeleton rows={TOP_ROUTES} rowHeight={72.5} className="sm:hidden" />
      <AdminPanelSkeleton rows={TOP_ROUTES} rowHeight={50} className="hidden sm:block" />
    </>
  );
}

/**
 * Grafik panelinin yer tutucusu: başlık bloğu burada, gövde grafiğin kendi
 * yer tutucusu (components/admin/TrafficChart.tsx → `TrafficChartSkeleton`).
 *
 * GÖVDE BİR DÖNEM BURADA ELLE ÇİZİLİYORDU ve grafikten ayrı düştü: kopya
 * `h-36 sm:h-48` ve `mt-6 h-14` yazıyordu, grafik `h-32` ve `mt-5` — 390'da
 * akış inince panel 20 piksel kısalıyordu (ölçüldü). Boylar artık grafiğin
 * kendi dizelerinden geliyor. Başlık bloğu sayfanın: buradaki başlığın
 * yanında "Tümünü Gör" var, Trafik'inkinde yok.
 */
function TrafficSkeleton() {
  return (
    <div className="panel min-w-0 p-5 sm:p-6" aria-hidden>
      {/* Başlık bloğu `AdminPanelSkeleton`ınkiyle aynı dizeler. Künye
          telefonda İKİ satıra sarıyor (gün sınırı notu). */}
      <div className="mb-5 grid gap-y-1.5">
        <div className="box-content flex h-[1lh] items-center pb-[0.06em] text-lead font-bold">
          <Skeleton className="h-[0.7em] w-24" />
        </div>
        <div className="text-small leading-relaxed">
          <div className="flex h-[1lh] items-center">
            <Skeleton className="h-2.5 w-72 max-w-full" />
          </div>
          <div className="flex h-[1lh] items-center sm:hidden">
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      </div>
      <TrafficChartSkeleton />
    </div>
  );
}
