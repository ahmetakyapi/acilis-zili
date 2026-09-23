import { Suspense } from "react";
import { PageHeader, Segment, SegmentItem, Skeleton } from "@/components/ui/primitives";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import { requireAdmin } from "@/lib/admin";
import {
  AdminPanel,
  AdminPanelError,
  AdminPanelSkeleton,
  AdminPanelTitle,
  AdminReadStamp,
  RankList,
  StatBox,
  StatGrid,
  StatGridSkeleton,
} from "@/components/admin/AdminUI";
import { TrafficChart, TrafficChartSkeleton } from "@/components/admin/TrafficChart";
import {
  getDeviceSplit,
  getLocaleSplit,
  getSignedInShare,
  getTopDetailPaths,
  getTopReferrers,
  getTopRoutes,
  getTrackingRange,
  getTrafficSeries,
  getTrafficTotals,
  fullDayWindow,
} from "@/lib/admin-data";
import { addEtDays } from "@/lib/market-hours";
import { METRIC, adminDayYear, deltaOf } from "@/lib/admin-format";
import { dayBoundaryNote } from "@/lib/session-clock";
import { cn } from "@/lib/utils";

/**
 * Trafik.
 *
 * PENCERE URL'DE (`?gun=7|30|90`) — paylaşılabilir ve geri tuşuyla gezilebilir
 * olması için, ve sunucuda hesaplandığı için istemciye tek satır JS inmiyor.
 *
 * EKRAN SIRASI CLAUDE.md'NİN SIRASI (23 Eylül denetimi): başlık ve tek
 * denetimi (aralık), ölçü ızgarası, ana grafik, sıralı listeler, kırılımlar,
 * en altta damga. Ekranın başlığı yoktu; ilk öğesi 1.132 piksellik kutulu bir
 * aralık çubuğuydu ve sitenin hiçbir seçicisine benzemiyordu.
 */

const WINDOWS = [7, 30, 90] as const;
type WindowDays = (typeof WINDOWS)[number];

function windowOf(raw: string | string[] | undefined): WindowDays {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return (WINDOWS as readonly number[]).includes(value)
    ? (value as WindowDays)
    : 30;
}

/** İki ET günü arasındaki gün sayısı, iki uç dahil. */
function daysInclusive(from: string, to: string): number {
  let n = 0;
  for (let day = from; day <= to; day = addEtDays(day, 1)) n += 1;
  return n;
}

/* Her bölümün kendi sekme başlığı: altısı "Yönetim · Açılış Zili"
   paylaşıyordu ve tarayıcı sekmesi, geçmiş, ekran okuyucu bölümleri
   ayıramıyordu. */
export const metadata = { title: adminDocTitle(ADMIN_SECTIONS.traffic.title) };

/**
 * Liste panellerinin yer tutucusu — telefonda katlanmış liste (künyeli
 * satır 72,5 piksel, altında 44 piksellik "Tümünü Gör"), genişte on iki
 * satır (50). Yer tutucu tek boyda olsaydı akış inince liste bir kırılımda
 * büyür, ötekinde çökerdi. Katlama satırı, satır boyuna paylaştırılıyor —
 * iskeletin kendi satır sayısı var, ayrı bir çubuğu yok.
 */
function ListSkeleton({ rows = LIST_LIMIT, fold = LIST_FOLD }: { rows?: number; fold?: number }) {
  const folded = rows > fold;
  const phoneRows = Math.min(rows, fold);
  return (
    <>
      <AdminPanelSkeleton
        rows={phoneRows}
        rowHeight={72.5 + (folded ? FOLD_SUMMARY / phoneRows : 0)}
        className="sm:hidden"
      />
      <AdminPanelSkeleton rows={rows} rowHeight={50} className="hidden sm:block" />
    </>
  );
}

export default async function TrafficPage(props: PageProps<"/admin/trafik">) {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  const search = await props.searchParams;
  const days = windowOf(search.gun);

  return (
    /* ARALIK `gap-5` — CLAUDE.md "Aralık her zaman gap-5"; sayfa 24
       piksellik kendi aralığını taşıyordu. */
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Yönetim"
        title={ADMIN_SECTIONS.traffic.title}
        subtitle={ADMIN_SECTIONS.traffic.subtitle}
        /* EKRANIN TEK DENETİMİ BAŞLIĞIN SAĞINDA, sitenin `Segment`i. Aralık
           bir dönem sayfanın tamamını kaplayan kutulu bir `nav`dı (1440'ta
           1.132 × 44 piksel, üç 371 piksellik hücre) ve seçili hücreyi
           neredeyse yalnızca yazı rengi ayırıyordu; site aynı işi yuvarlak
           bir rayın içindeki dolu hapla yapıyor (/takvim, /karsilastir).
           `SegmentItem` sayfa içi filtrenin iki kuralını zaten taşıyor:
           `scroll={false}` (okuyucu sayfanın başına fırlamasın) ve telefonda
           44 piksellik hedef. Yer işareti değil `role="group"`: bu bir
           gezinme bölgesi değil, bir süzgeç. */
        action={
          <Segment label="Zaman Aralığı">
            {WINDOWS.map((option) => (
              <SegmentItem
                key={option}
                href={`/admin/trafik?gun=${option}`}
                active={option === days}
              >
                Son {option} Gün
              </SegmentItem>
            ))}
          </Segment>
        }
      />

      {/* "Dünkü Görüntüleme"nin künyesi telefonda iki satır: değişim ile
          taban ("+%1985", "Bir Hafta Önce 13") 145 piksel, künye alanı 136.
          Tek satırlık yer tutucu akış inince 20 piksel sıçrıyordu (390, üç
          pencerede de ölçüldü). */}
      <Suspense key={`sum-${days}`} fallback={<StatGridSkeleton wrapOnPhone={[3]} />}>
        <Totals days={days} />
      </Suspense>

      <Suspense key={`chart-${days}`} fallback={<ChartSkeleton />}>
        <Chart days={days} />
      </Suspense>

      {/* `lg:items-start`: ızgara satırı kısa paneli uzununun boyuna
          geriyordu ve boşluk panelin İÇİNDE kalıyordu — Bölümler'in dibinde
          151, Nereden Geliniyor'un dibinde 208 piksel (7 günde 308), 1440
          ve 1024'te ölçüldü. Kısa panel artık erken bitiyor; iki sütunlu bir
          düzende olması gereken de bu (CLAUDE.md, "Boşluk esnetilmez"). */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Suspense key={`routes-${days}`} fallback={<ListSkeleton />}>
          <Routes days={days} />
        </Suspense>
        <Suspense key={`paths-${days}`} fallback={<ListSkeleton />}>
          <DetailPaths days={days} />
        </Suspense>
      </div>

      {/* KISA PANELLER YAN YANA, BOŞLUK İÇERİDE DEĞİL. Nereden Geliniyor
          bir dönem dört bloklu Okuyucu paneliyle aynı ızgara satırındaydı
          ve 1–3 satırlık listesinin altında 208 piksel boşluk taşıyordu (7
          günde 308). `lg:items-start` ile kısa panel erken bitiyor.

          1024–1279 ARASI İKİ SÜTUN, 1280'DEN SONRA ÜÇ (Okuyucu ikisini
          kaplıyor). Kaynaklar üç sütunun birinde 1024'te 264 piksellik bir
          iç genişliğe iniyordu ve satırın künyesi ("60 Giriş · 9
          Ziyaretçi-Günü", ~150 piksel) ile sayı sütunu (64) alan adına ~26
          piksel bırakıyordu. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start xl:grid-cols-3">
        <Suspense key={`ref-${days}`} fallback={<ListSkeleton rows={3} fold={3} />}>
          <Referrers days={days} />
        </Suspense>
        <Suspense
          key={`readers-${days}`}
          fallback={<ReadersSkeleton />}
        >
          <Readers days={days} />
        </Suspense>
      </div>

      {/* Yer tutucu damganın kendi satırı — sayfanın dibi akışla oynamasın. */}
      <Suspense fallback={<p aria-hidden className="h-[1lh] text-tiny" />}>
        <Stamp />
      </Suspense>
    </div>
  );
}

async function Totals({ days }: { days: WindowDays }) {
  /* KARŞILAŞTIRMA TAM GÜNLERLE. Güncel pencere BUGÜNÜ içeriyordu ve bugün
     henüz bitmemiş: trafik tamamen sabit olsa bile panel her gün kalıcı bir
     düşüş gösteriyordu (30 günün 29'u tam + bugünün yarısı, karşısında 30
     tam gün). Her iki pencere de dünde bitiyor; bugünün kendisi grafikte
     zaten görünüyor ve orada eksik olduğu belli. */
  const now = fullDayWindow(days);
  const before = fullDayWindow(days * 2);
  const dun = now.to;
  const birHaftaOnce = addEtDays(dun, -7);
  const [current, previous, range, yesterday, weekAgo] = await Promise.all([
    getTrafficTotals(now.from, now.to),
    /* Önceki pencere: iki katı geriden başlar, güncel pencerenin bir gün
       öncesinde biter. */
    getTrafficTotals(before.from, addEtDays(now.from, -1)),
    getTrackingRange(),
    getTrafficTotals(dun, dun),
    getTrafficTotals(birHaftaOnce, birHaftaOnce),
  ]);

  /* Payda ziyaretçi-günü, yani günlük tekil ziyaretçilerin toplamı: sonuç
     bir ziyaretçinin BİR GÜNDE ortalama kaç sayfa okuduğu. Etiket "Ziyaret
     Başı Sayfa" idi ve bir ZİYARETİ (oturumu) sayıyormuş gibi okunuyordu.
     Adı artık ölçünün adı: `METRIC.dailyVisitors` panelde tek günün tekil
     ziyaretçisi demek. Plan "Ziyaretçi-Günü Başına Sayfa" öneriyordu; o ad
     390'da 160 piksel, kutunun içi 138 — iki satıra sarıyor ve değeri
     yanındaki kutunun değerinden bir satır aşağı itiyordu. */
  const perVisitDay =
    current.ok && current.data.visitorDays > 0
      ? (current.data.views / current.data.visitorDays).toFixed(1).replace(".", ",")
      : "—";

  /* Önceki pencere ölçüm başlamadan açılıyorsa kıyas yok — 30 günlük
     pencerede "+%222" böyle doğuyordu (lib/admin-format.ts → `deltaOf`). */
  const firstDay = range.ok ? range.data.firstDay : null;
  const kiyas = { trackingFrom: firstDay, previousFrom: before.from };

  /* KÜNYE DEĞERİN PENCERESİNİ SÖYLER, KARŞILAŞTIRMANINKİNİ DEĞİL.
     "Önceki" yazıyordu ama sayı `fullDayWindow(days)` yani GÜNCEL
     pencereden geliyor; ekranın en büyük puntolu sayısı böylece geçmiş bir
     dönemin sayısı gibi okunuyordu.

     PENCERE EKSİK ÖLÇÜLDÜYSE KÜNYE BUNU SÖYLER (23 Eylül denetimi): 90
     günlük kutu "Son 90 Tam Gün" diyordu, verinin kapsadığı 41 gündü.
     Önceki pencere eksikse değişim yazılmıyor ve boş kalan yerde NEDENİ
     duruyor — değişimi kaybolmuş bir kutu yoksa bozuk gibi okunur.
     "Önceki Dönem Eksik Ölçüldü" yazıyordu: 158 piksel, telefondaki 136
     piksellik künye alanında iki satır ve ızgaranın ilk satırını iki kutu
     için birden geriyordu (390, ölçüldü). "Önceki Dönem Eksik" 113. */
  const measuredDays =
    firstDay && firstDay > now.from
      ? firstDay > now.to
        ? 0
        : daysInclusive(firstDay, now.to)
      : days;
  const windowSub =
    range.ok && !firstDay
      ? "Henüz Kayıt Yok"
      : measuredDays === 0
        ? "Henüz Tam Gün Yok"
        : measuredDays < days
          ? `${measuredDays} Ölçülen Gün`
          : `Son ${days} Tam Gün`;
  const compareSub =
    measuredDays === days && firstDay && firstDay > before.from
      ? "Önceki Dönem Eksik"
      : windowSub;
  const okunamadi = current.ok ? undefined : ("unavailable" as const);

  /* DÜN — ölçüm başlangıcı yerine (23 Eylül denetimi). Dördüncü kutu bir
     kurulum bilgisiydi ("Ölçüm Başlangıcı 13.08.2026"), her gün aynı; o
     bilgi artık sayfanın en altındaki damgada. Yerine eyleme dönük bir
     sayı: son tam gün ve BİR HAFTA ÖNCESİNİN AYNI GÜNÜYLE kıyası — trafik
     hafta içi ile hafta sonu arasında planlı olarak salınıyor ve dünü
     evvelsi günle kıyaslamak her pazartesi bir "artış" üretirdi. */
  const dunDelta =
    yesterday.ok && weekAgo.ok
      ? deltaOf(yesterday.data.views, weekAgo.data.views, {
          trackingFrom: firstDay,
          previousFrom: birHaftaOnce,
        })
      : null;
  /* KÜNYE KIYASIN TABANINI YAZIYOR. "+%1985 · Bir Hafta Önceye Göre"
     yazıyordu ve ekranın en göz alıcı yeşili, tabanının 13 görüntüleme
     olduğunu saklıyordu (22 Eyl'de 271, 15 Eyl'de 13 — ölçüldü). Tek günün
     sayısı küçük ve yüzde küçük tabanda patlar; tabanı yanında yazmak onu
     okunur kılıyor. Taban sıfırsa yüzde yok ama taban yine yazılı — kıyasın
     neden olmadığını söylüyor. */
  const dunSub = !weekAgo.ok
    ? "Kıyas Okunamadı"
    : firstDay && firstDay > birHaftaOnce
      ? "Bir Hafta Önce Ölçülmedi"
      : `Bir Hafta Önce ${weekAgo.data.views.toLocaleString("tr-TR")}`;

  return (
    <StatGrid>
      <StatBox
        label={METRIC.views}
        value={current.ok ? current.data.views.toLocaleString("tr-TR") : "—"}
        state={okunamadi}
        sub={compareSub}
        delta={
          current.ok && previous.ok
            ? deltaOf(current.data.views, previous.data.views, kiyas)
            : null
        }
      />
      {/* KÜNYE TEK SATIR. "30 Tam Gün · Aynı Kişi Her Gün Yeniden Sayılır"
          üç satıra sarıyor ve ızgara satırını 159 piksele geriyordu, öteki
          üç kutunun dibinde 38 piksel boş kalıyordu. Tanım bir kez, grafiğin
          altındaki notta. */}
      <StatBox
        label={METRIC.visitorDays}
        value={current.ok ? current.data.visitorDays.toLocaleString("tr-TR") : "—"}
        state={okunamadi}
        sub={compareSub}
        delta={
          current.ok && previous.ok
            ? deltaOf(current.data.visitorDays, previous.data.visitorDays, kiyas)
            : null
        }
      />
      <StatBox
        label={`${METRIC.dailyVisitors} Başı Sayfa`}
        value={perVisitDay}
        state={okunamadi}
        sub={windowSub}
      />
      <StatBox
        label={`Dünkü ${METRIC.views}`}
        value={yesterday.ok ? yesterday.data.views.toLocaleString("tr-TR") : "—"}
        state={yesterday.ok ? undefined : "unavailable"}
        sub={dunSub}
        delta={dunDelta}
      />
    </StatGrid>
  );
}

/** Grafiğin altındaki tanım notu — panel ve yer tutucusu aynı dizeyle. */
const CHART_NOTE = "mt-4 border-t border-line pt-3 text-small leading-relaxed";

/**
 * Grafik panelinin yer tutucusu: başlık bloğu, grafiğin gövdesi ve not.
 * Gövde grafiğin kendi yer tutucusu (components/admin/TrafficChart.tsx →
 * `TrafficChartSkeleton`), grafiğin dizeleriyle çiziliyor. Bir dönem burada
 * elle yazılmış boylardı (`h-32`, `mt-5 h-14`, sabit okuma satırı) ve Özet
 * aynı şeyi ayrı yazıyordu; iki kopya grafikten ayrı düştü.
 */
function ChartSkeleton() {
  return (
    <div className="panel min-w-0 p-5 sm:p-6" aria-hidden>
      <AdminPanelSkeletonTitle hintLines={2} />
      <TrafficChartSkeleton />
      {/* Grafiğin altındaki tanım notu — `Chart`la aynı dize. */}
      <div className={CHART_NOTE}>
        <div className="flex h-[1lh] items-center">
          <Skeleton className="h-2.5 w-56 max-w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * `AdminPanelSkeleton`in başlık bloğunun aynısı — grafik yer tutucusu için.
 * `hintLines`: künye telefonda kaç satıra sarıyor. Grafiğin künyesi ("Son 30
 * Tam Gün + Bugün · Gün 07:00 TR'de Döner (New York Gece Yarısı)") 390'da
 * iki satır; genişte her zaman bir.
 */
function AdminPanelSkeletonTitle({ hintLines = 1 }: { hintLines?: 1 | 2 }) {
  return (
    <div className="mb-5 grid gap-y-1.5">
      <div className="box-content flex h-[1lh] items-center pb-[0.06em] text-lead font-bold">
        <Skeleton className="h-[0.7em] w-40" />
      </div>
      <div
        className={cn(
          "flex items-start pt-[0.5lh] text-small leading-relaxed sm:h-[1lh] sm:items-center sm:pt-0",
          hintLines === 2 ? "h-[2lh]" : "h-[1lh]",
        )}
      >
        <Skeleton className="h-2.5 w-72 max-w-full" />
      </div>
    </div>
  );
}

/**
 * Okuyucu panelinin yer tutucusu — panelin iç ızgarası kırılıma göre üç
 * biçim aldığı için üç ayrı boy (ölçüldü, 30 gün): telefonda alt alta üç
 * blok, gövde 428,5 piksel; iki sütunda (640–1279) 286,5; üç sütunda
 * (1280+) 144,5. Satır sayısı × satır boyu o gövdeyi veriyor.
 */
function ReadersSkeleton() {
  return (
    <>
      <AdminPanelSkeleton rows={6} rowHeight={428.5 / 6} className="sm:hidden" />
      <AdminPanelSkeleton rows={4} rowHeight={286.5 / 4} className="hidden sm:block xl:hidden" />
      <AdminPanelSkeleton rows={2} rowHeight={144.5 / 2} className="hidden xl:col-span-2 xl:block" />
    </>
  );
}

async function Chart({ days }: { days: WindowDays }) {
  const series = await getTrafficSeries(days);
  return (
    <AdminPanel>
      {/* Seri kutuların penceresi + bugün (lib/admin-data.ts →
          `getTrafficSeries`); gün sınırı TR saatiyle. */}
      <AdminPanelTitle hint={`Son ${days} Tam Gün + Bugün · ${dayBoundaryNote()}`}>
        Günlük Trafik
      </AdminPanelTitle>
      {/* Dil çerezine bağlı DEĞİL: panel yalnızca Türkçe ve İngilizce
          çerezle tarihler "08/25/2026" basılıyordu (23 Eylül denetimi). */}
      <TrafficChart points={series.ok ? series.data : null} />
      {/* TANIM BİR KEZ, BURADA. Ziyaretçi-günü kutunun künyesindeydi ve onu
          üç satıra sarıyordu; grafiğin ziyaretçi şeridi tam da o toplamın
          günlere bölünmüş hâli, tanım en çok burada anlam taşıyor. */}
      <p className={cn(CHART_NOTE, "text-muted")}>
        {METRIC.visitorDays} aynı kişiyi her gün yeniden sayar.
      </p>
    </AdminPanel>
  );
}

/* İKİ LİSTE AYNI BOYDA (on iki satır) ve telefonda üçte katlanıyor.
   On beş satırlık iki liste 390'da 2.226 piksel tutuyordu — sayfanın
   yarısından fazlası. Plan sekizde katlamayı öneriyordu; künyeli satır
   telefonda 72,5 piksel (künye alt satıra iniyor) ve sekiz satırla iki liste
   yine 1.500 piksel, sayfa 4.061 ölçüldü. Üç satır + "Tümünü Gör" bir
   bakışta ilk üçü veriyor, geri kalanı bir dokunuş ötede. Geniş ekranda
   katlama yok: liste yanındaki panelle aynı boyda ve katlamak yalnızca bir
   tık eklerdi. */
const LIST_LIMIT = 12;
const LIST_FOLD = 3;
/** "Tümünü Gör" satırı — telefonda 44 piksellik hedef (AdminUI → `RankList`). */
const FOLD_SUMMARY = 44;

async function Routes({ days }: { days: WindowDays }) {
  const rows = await getTopRoutes(days, LIST_LIMIT);
  return (
    <AdminPanel>
      {/* Künye telefonda tek satır: "Dinamik Sayfalar Şablonlarında
          Toplanır" 390'da iki piksel taştı ve satır atladı (316 / 314). */}
      <AdminPanelTitle hint={`Son ${days} Tam Gün · Detay Sayfaları Şablonda Toplanır`}>
        Bölümler
      </AdminPanelTitle>
      {rows.ok ? (
        <RankList
          hiddenAfter={LIST_FOLD}
          hiddenOn="mobile"
          rows={rows.data.map((r) => ({
            key: r.key,
            label: r.key,
            value: r.views,
            secondary: `${r.visitors.toLocaleString("tr-TR")} ${METRIC.visitorDays}`,
          }))}
        />
      ) : (
        <AdminPanelError />
      )}
    </AdminPanel>
  );
}

/**
 * Tek sayfalar — "Sayfalar" listesinin yerine.
 *
 * İKİ LİSTE AYNI SORUYU CEVAPLIYORDU (23 Eylül denetimi): 30 günlük
 * pencerede "Sayfalar"ın 15 satırının 9'u "Bölümler"le aynı etiket ve aynı
 * sayıydı ("/", "/piyasalar", "/takvim"…) — sabit bir sayfanın yolu ile
 * şablonu aynı şey. Bu liste artık yalnızca bir şablonun ALTINDAKİ tek
 * adresleri sayıyor (lib/admin-data.ts → `getTopDetailPaths`): hangi hisse,
 * hangi yazı, hangi analiz. İki listede ortak etiket kalmıyor.
 */
async function DetailPaths({ days }: { days: WindowDays }) {
  const rows = await getTopDetailPaths(days, LIST_LIMIT);
  return (
    <AdminPanel>
      <AdminPanelTitle hint={`Son ${days} Tam Gün · Hisse, Analiz ve Yazı Detayları`}>
        Tek Sayfalar
      </AdminPanelTitle>
      {rows.ok ? (
        <RankList
          hiddenAfter={LIST_FOLD}
          hiddenOn="mobile"
          emptyLabel="Bu aralıkta tek sayfa kaydı yok."
          rows={rows.data.map((r) => ({
            key: r.key,
            label: r.key,
            /* Satır sitedeki gerçek sayfaya gider: paneli okurken "bu sayfa
               nasıl görünüyordu" sorusu hemen orada cevaplanıyor. */
            href: r.key,
            value: r.views,
            secondary: `${r.visitors.toLocaleString("tr-TR")} ${METRIC.visitorDays}`,
          }))}
        />
      ) : (
        <AdminPanelError />
      )}
    </AdminPanel>
  );
}

async function Referrers({ days }: { days: WindowDays }) {
  const rows = await getTopReferrers(days, 10);
  return (
    <AdminPanel>
      {/* Künye telefonda tek satır: "Arama Terimi Saklanmaz" onu 390'da
          ikinci satıra itiyordu (334 piksel, panelin içi 314). Saklanan tek
          şeyin alan adı olduğunu söylemek aynı bilgiyi veriyor. */}
      <AdminPanelTitle hint={`Son ${days} Tam Gün · Yalnızca Alan Adı Saklanır`}>
        Nereden Geliniyor
      </AdminPanelTitle>
      {rows.ok ? (
        <RankList
          hiddenAfter={LIST_FOLD}
          hiddenOn="mobile"
          rows={rows.data.map((r) => ({
            key: r.key,
            label: r.key,
            value: r.views,
            /* SAYI GİRİŞTİR, GÖRÜNTÜLEME DEĞİL. Yönlendiren yalnızca ziyaretin
               İLK görüntülemesinde gönderiliyor (ViewBeacon), yani bu
               satırların sayısı sitenin öteki listeleriyle aynı birimde
               değil. Birimi künye söylüyor; ötekilerden farklı olan tek
               liste bu. */
            secondary: `${r.views.toLocaleString("tr-TR")} ${METRIC.entries} · ${r.visitors.toLocaleString("tr-TR")} ${METRIC.visitorDays}`,
          }))}
          /* Boş liste "herkes adresi doğrudan açmış" DEMİYOR: yönlendiren
             bilgisi sitenin kendi politikası, uygulamalar ve tarayıcılar
             yüzünden de boş gelir. Söylenebilen tek şey kayıt olmadığı. */
          emptyLabel="Bu aralıkta dış kaynaklı giriş kaydı yok."
        />
      ) : (
        <AdminPanelError />
      )}
    </AdminPanel>
  );
}

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Mobil",
  tablet: "Tablet",
  desktop: "Masaüstü",
};
const LOCALE_LABEL: Record<string, string> = {
  tr: "Türkçe",
  en: "İngilizce",
};

/**
 * Alt başlık — panel içindeki kırılımın adı.
 *
 * Title Case, BÜYÜK HARF DEĞİL: "CİHAZ / DİL / ÜYELİK" `uppercase` ile
 * basılıyordu; site künyeleri 23 Eylül'de Title Case'e geçti ve Türkçede
 * `uppercase` yanlış büyütüyor. Ölçü sayı kutusunun künyesiyle aynı.
 */
function SubHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 text-small font-semibold text-muted">{children}</h3>;
}

/** Payın yazımı — `RankList`in pay sütunuyla aynı kural: sıfırdan büyük ama %1'in altı "<%1". */
function shareText(part: number, whole: number): string {
  const pct = (part / whole) * 100;
  return part > 0 && pct < 1 ? "<%1" : `%${Math.round(pct)}`;
}

/**
 * Okuyucu — PARÇA–BÜTÜN kırılımları: cihaz, dil ve üyelik.
 *
 * Çubuk BÜTÜNE göre (`scale="total"`) ve pay sayının yanında (23 Eylül
 * denetimi): "Masaüstü 1.786" en büyük satır olduğu için %100'lük bir çubuk
 * çiziyordu, gerçek payı %73'tü; "Türkçe" %98'lik bir payla yine %100.
 * Panelin cevapladığı soru "mobilin payı ne" ve okur onu elle bölerek
 * buluyordu.
 *
 * TEK PANEL, İÇİNDE ÜÇ SÜTUN. Plan kırılımları üç ayrı panele bölmeyi
 * öneriyordu; telefonda her panel kendi başlığını ve dolgusunu taşıyor ve
 * 390'da sayfa üç bin pikselin üstünde kalıyordu (ölçüldü: iki panel 773,
 * tek panel 541 piksel). Geniş ekranda kırılımlar panelin içinde yan yana,
 * ızgara satırı üçünü aynı hizada başlatıyor.
 *
 * ÜYELİK İKİ ÖLÇÜYLE ve adları yazılı (23 Eylül denetimi): satır
 * "1.351 üye · 1.085 ziyaretçi" diyordu — sitede beş üye varken; iki sayının
 * toplamı Görüntüleme kutusuydu. Liste görüntüleme payını (üyeler ne kadar
 * OKUYOR), altındaki künye ziyaretçi-günü payını (kaç kişi-gün girişliydi)
 * veriyor. İkisi çok farklı olabiliyor — birkaç yoğun üye görüntülemenin
 * yarısını üretip kişi-günlerin küçük bir dilimi kalabilir; yalnızca birini
 * göstermek üyeliği olduğundan büyük ya da küçük gösterirdi.
 *
 * EK SABİT YAZILAMAZ. Pay bir dönem "%{oran}'ı" diye bir cümleye
 * yerleştiriliyordu ve Türkçe ünlü uyumu sayının okunuşuna bağlı: %2'si,
 * %6'sı, %11'i, %40'ı... Sayı her gün değiştiği için doğru ek seçilemez.
 * Pay artık cümle değil — listenin pay sütunu ve ek istemeyen bir künye.
 * Buraya bir cümle geri gelirse aynı kural geçerli: eki olmayan bir kuruluş.
 */
async function Readers({ days }: { days: WindowDays }) {
  const [devices, locales, signed] = await Promise.all([
    getDeviceSplit(days),
    getLocaleSplit(days),
    getSignedInShare(days),
  ]);
  const kisiGun = signed.ok ? signed.data.visitorDays : null;
  const kisiGunToplam = kisiGun ? kisiGun.signedIn + kisiGun.anonymous : 0;
  return (
    <AdminPanel className="xl:col-span-2">
      <AdminPanelTitle hint={`Son ${days} Tam Gün · Cihaz, Dil ve Üyelik Payı`}>
        Okuyucu
      </AdminPanelTitle>
      {/* Üç sütun yalnızca panel geniş olduğunda (1280+, 852 piksellik iç).
          Daha darda iki sütun ve üyelik alt satırı tam kaplıyor — üçüncü
          sütun 544 piksellik içte etikete 40 piksel bırakıyordu. */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0">
          <SubHead>Cihaz</SubHead>
          {devices.ok ? (
            <RankList
              scale="total"
              rows={devices.data.map((d) => ({
                key: d.key,
                label: DEVICE_LABEL[d.key] ?? d.key,
                value: d.views,
              }))}
            />
          ) : (
            <AdminPanelError />
          )}
        </div>
        <div className="min-w-0">
          <SubHead>Dil</SubHead>
          {locales.ok ? (
            <RankList
              scale="total"
              rows={locales.data.map((l) => ({
                key: l.key,
                label: LOCALE_LABEL[l.key] ?? l.key,
                value: l.views,
              }))}
            />
          ) : (
            <AdminPanelError />
          )}
        </div>
        <div className="min-w-0 sm:col-span-2 xl:col-span-1">
          <SubHead>Üyelik · {METRIC.views}</SubHead>
          {signed.ok ? (
            <>
              <RankList
                scale="total"
                rows={[
                  { key: "signed", label: "Girişli", value: signed.data.views.signedIn },
                  { key: "anon", label: "Anonim", value: signed.data.views.anonymous },
                ]}
              />
              {kisiGun && kisiGunToplam > 0 && (
                <p className="numeral mt-1.5 text-tiny text-muted">
                  {METRIC.visitorDays} Payı{" "}
                  <span className="font-semibold text-body">
                    {shareText(kisiGun.signedIn, kisiGunToplam)}
                  </span>{" "}
                  · {kisiGun.signedIn.toLocaleString("tr-TR")} Girişli ·{" "}
                  {kisiGun.anonymous.toLocaleString("tr-TR")} Anonim
                </p>
              )}
            </>
          ) : (
            <AdminPanelError />
          )}
        </div>
      </div>
    </AdminPanel>
  );
}

/**
 * Sayfanın damgası — ölçümün kapsamı ve okunduğu an (CLAUDE.md ekran
 * sırası § 7).
 *
 * "Ölçüm Başlangıcı" bir sayı kutusuydu ve ekranın en görünür dört yerinden
 * birini her gün aynı kalan bir kurulum bilgisine veriyordu; tarih de o
 * kutuda 19 piksele küçülüp ızgaranın öteki değerlerinden ayrı bir taban
 * çizgisine iniyordu. Bilgi burada, künye olarak.
 *
 * Saat İSTANBUL saatiyle ve saniyesiz (lib/admin-format.ts → `adminStamp`in
 * kuralı). Tarihe ek yapıştırılmıyor ("13 Ağu 2026'dan"): ek tarihin
 * okunuşuna bağlı ve sabit yazılamaz.
 */
async function Stamp() {
  const range = await getTrackingRange();
  /* Okunduğu an ortak damgada (AdminUI → `AdminReadStamp`): burada "TR"siz
     yazılıyordu, Sistem ve Üyeler "15:03 TR Okundu" derken. */
  return (
    <AdminReadStamp>
      {range.ok ? (
        range.data.firstDay ? (
          <>
            <span>Ölçüm Başlangıcı {adminDayYear(range.data.firstDay)}</span>
            <span aria-hidden>·</span>
            <span className="numeral">
              {range.data.rows.toLocaleString("tr-TR")} Kayıt
            </span>
          </>
        ) : (
          <span>Henüz Kayıt Yok</span>
        )
      ) : (
        <span className="font-semibold text-brass-ink">Ölçüm Kaydı Okunamadı</span>
      )}
    </AdminReadStamp>
  );
}
