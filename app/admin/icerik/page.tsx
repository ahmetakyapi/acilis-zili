import Link from "next/link";
import { Suspense } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Button, PageHeader, PanelLink, Skeleton } from "@/components/ui/primitives";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import {
  AdminPanel,
  AdminPanelError,
  AdminPanelTitle,
  AdminReadStamp,
  HEALTH_INK,
  HealthMark,
  HealthRow,
  StatBox,
  StatGrid,
  StatGridSkeleton,
  adminInput,
  type HealthTone,
} from "@/components/admin/AdminUI";
import { getContentSummary, getPublishRhythm, type PublishDay } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { BRIEF_PUBLISH_TR } from "@/lib/data";
import {
  adminDay,
  adminDayIn,
  adminDayYear,
  adminWeekRange,
} from "@/lib/admin-format";
import { analysisHref } from "@/lib/analysis";
import { GUNLER, PublishGrid, PublishGridSkeleton } from "@/components/admin/PublishGrid";
import { cn } from "@/lib/utils";
import { briefHref } from "@/lib/brief";

/**
 * İçerik — yayının SAĞLIK PANOSU.
 *
 * Bu ekran metin DEĞİŞTİRMİYOR ve bu bir bölünmenin sonucu: düzenleme
 * Yazılar ekranına taşındı (`/admin/yazilar`). İkisi bir dönem tek sayfadaydı
 * ve o sayfa aynı anda hem ölçüyor hem düzenletiyordu; iki farklı iş için
 * açılan tek ekran, ikisinde de uzun ve dağınık kalıyordu.
 *
 * Burada kalan iş EKSİĞİ GÖSTERMEK: hangi yazının İngilizcesi yok, hangi
 * analiz grafiksiz kalmış, bülten hangi günde yazılmamış. Rutin bu
 * listeyi kendi ucundan zaten okuyor; buradaki insanın bakabildiği hâli.
 *
 * SIRA: EKSİKLER → RİTİM → TOPLAMLAR (23 Eylül denetimi). Ekran toplamlarla
 * açılıyordu (124 / 98 / 41) — hiçbir eylem istemeyen üç sayı — ve altında
 * üçü de "Eksik yok." diyen üç panel duruyordu: 390'da 607 piksel aynı
 * cümleye gidiyor, rutinlerin çalışıp çalışmadığını gösteren TEK görünüm
 * olan Yayın Ritmi 1.114. pikselden, 1440'ta da ekranın altından (şeritler
 * 973'te bitiyordu) başlıyordu. Şimdi önce cevap (eksik var mı), sonra ana
 * görsel (ritim), en son arşivin büyüklüğü — CLAUDE.md'nin "ana görsel,
 * sonra ölçü ızgarası" sırası.
 *
 * YENİ İÇERİK YİNE UÇLARDAN geliyor: `/api/brief`, `/api/mercek`,
 * `/api/analiz` — onları claude.ai rutinleri çağırıyor
 * (docs/claude-rutinler.md). Panel var olanı düzeltiyor ve ikisi de aynı
 * doğrulamadan, aynı yazma yolundan geçiyor (`lib/content-write.ts`).
 */

/* Her bölümün kendi sekme başlığı: altısı "Yönetim · Açılış Zili"
   paylaşıyordu ve tarayıcı sekmesi, geçmiş, ekran okuyucu bölümleri
   ayıramıyordu. */
export const metadata = { title: adminDocTitle(ADMIN_SECTIONS.content.title) };

/** Izgaranın kapsadığı hafta sayısı — ritim ve "Yazılmamış Bülten" satırı aynı pencere. */
const RITIM_HAFTA = 8;

/* RİTİM İKİ YERDEN OKUNUYOR, BİR KEZ KOŞUYOR. "Yazılmamış Bülten" satırı
   ile ızgara aynı günleri sayıyor; iki sınır da `getPublishRhythm`i AYNI
   argümanla soruyor ve okuyucu `cache()`li (lib/admin-data.ts) — beş sorgu
   bir kez gidiyor. Sarmal bir dönem burada, sayfaya özel bir kopyaydı.
   Özet (`getContentSummary`) de sarılı: Eksikler ve Toplamlar aynı sözü
   bekliyor, aynı anda açılıyor. */
const ritim = () => getPublishRhythm(RITIM_HAFTA);

export default async function ContentPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Yönetim"
        title={ADMIN_SECTIONS.content.title}
        subtitle={ADMIN_SECTIONS.content.subtitle}
      />

      {/* YER TUTUCULAR GERÇEK DÜZENİ ÇİZİYOR. İki sabit `h-64` çubuğu vardı:
          Eksikler için 256 piksel ayırıp 215 (390'da 607), ritim için 256
          ayırıp 549 (390'da 1.307) kaplıyordu — akış inince sayfa aşağı
          sıçrıyordu. Şimdi aynı panel, aynı satırlar, veri yerine iskelet. */}
      <Suspense fallback={<GapsSkeleton />}>
        <Gaps />
      </Suspense>

      <Suspense fallback={<RhythmSkeleton />}>
        <Rhythm />
      </Suspense>

      <Suspense fallback={<StatGridSkeleton boxes={3} cols={3} />}>
        <Summary />
      </Suspense>

      {/* Ekran sırasının son satırı (CLAUDE.md, "Ekran düzeni" 7): ızgaranın
          "Bugün" hücresi ve gecikme sayısı çizim anına göre. */}
      <AdminReadStamp />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Eksikler
   -------------------------------------------------------------------------- */

type GapItem = {
  key: string;
  label: string;
  /** Asıl bağlantı — yönetimde düzeltilebilen kayıtta editör, değilse sitedeki sayfa. */
  href?: string;
  /** "Sitede Gör" — editöre giden satırın ikinci yolu. */
  site?: string;
};

type Gap = {
  key: string;
  label: string;
  /** Açılan listenin üstündeki cümle — eksiğin okura etkisi ve rutinin tavrı. */
  note: string;
  items: GapItem[];
  /** Okunamadıysa sayı yerine tire, "Okunamadı". */
  unavailable?: boolean;
};

/**
 * Eksikler — BEŞ KONTROL, TEK PANEL (23 Eylül denetimi).
 *
 * Dört ayrı paneldi ve üçü "Eksik yok." diyordu: 1440'ta iki sıra × 188
 * piksel, 390'da 607 piksel boyunca aynı cümle. Aynı bilgiyi yukarıdaki
 * sayı kutuları zaten söylüyordu ("0 Tanesi Tek Dilli"). Şimdi her kontrol
 * bir satır: sayısı, durumu, eksik varsa açılan listesi.
 *
 * SATIR TEK SATIR, NOT LİSTENİN İÇİNDE. Sağlık satırının iki katlı düzeni
 * (solda ad ve not, sağda değer ve durum sözcüğü alt alta) burada beş
 * satırı 390'da ~88'er piksele çıkarıyordu ve ritmin üst kenarı 700
 * pikselin altına inmiyordu. Not yalnızca eksik VARKEN anlam taşıyor —
 * "okur orijinali görüyor" cümlesi sıfır eksikte okunacak bir şey değil —
 * ve açılan listenin başına indi. Satır 44 piksel, dokunma hedefi de o.
 *
 * `lg`DE BEŞ HÜCRELİ ŞERİT. Beş satır alt alta 1440'ta ~250 piksel tutuyor
 * ve ritmin şeritlerini ekranın altına itiyordu (900 pikselin altında
 * bitmesi hedef); yan yana tek sıra ~60 piksel.
 *
 * `<details>`, JAVASCRIPT YOK: yerli açılır, klavyeyle açılıyor, ekran
 * okuyucu açık/kapalı durumunu kendisi duyuruyor (RankList'in "Tümünü Gör"ü
 * aynı kalıp).
 */
async function Gaps() {
  const [summary, rhythm] = await Promise.all([getContentSummary(), ritim()]);
  /* Eksik listesi YALNIZCA başarılı bir okumada: okunamayan özet, eksiği
     olmayan bir arşiv gibi görünüyordu. */
  if (!summary.ok) {
    return (
      <AdminPanel id="eksikler">
        <AdminPanelTitle>Eksikler</AdminPanelTitle>
        <AdminPanelError />
      </AdminPanel>
    );
  }
  const content = summary.data;

  /* HER SATIR GİDİLEBİLİR. Analiz listeleri düz metindi: eksiği gören
     yönetici kaydı açmak için sembolü kopyalayıp siteden aramak zorundaydı.
     Adres `analysisHref` ile kuruluyor — elle `/bilancolar/NVDA/...` yazmak
     sayfayı açardı ama sitede olmayan İKİNCİ bir adres biçimi doğurur ve
     ölçüm onu ayrı bir yol olarak sayıp okunmayı bölerdi.

     EDİTÖR ÖNCE, SİTE İKİNCİ. Mercek satırı sitedeki yazıya gidiyordu;
     düzeltme yapılacak yer yönetimdeki editör. Analizin editörü yok
     (panelden yalnızca mercek ve bülten düzeltiliyor), o satır sitede açılır.

     BAŞLIK, SLUG DEĞİL: mercek listesi ham slug basıyordu. */
  const gaps: Gap[] = [
    {
      key: "story-en",
      label: "İngilizcesi Eksik Mercek",
      note: "İngilizce okur orijinali TR notuyla görüyor; rutin boş bir günde çevirisini tamamlıyor.",
      items: content.storiesMissingEn.map((story) => ({
        key: story.slug,
        label: story.title,
        href: `/admin/yazilar/mercek/${story.slug}`,
        site: `/mercek/${story.slug}`,
      })),
    },
    {
      key: "analysis-en",
      label: "İngilizcesi Eksik Analiz",
      note: "Rutin bunların İngilizcesini yeni analiz yazmaya tercih ediyor.",
      items: content.analysesMissingEn.map((ref) => ({
        key: ref.label,
        label: ref.label,
        href: analysisHref(ref.symbol, ref.period),
      })),
    },
    {
      key: "brief-en",
      label: "İngilizcesi Eksik Bülten",
      /* Bülten rutininin geriye dönük tamamlama adımı yok
         (docs/claude-rutinler.md § 1, adım 5: "bozulmaz ama eksik kalır"). */
      note: "İngilizce okur o günün Türkçesini TR notuyla görüyor; rutin geriye dönük tamamlamıyor.",
      /* Günlük gününün adıyla, haftalık kapsadığı haftayla — kayıt biten
         haftanın pazartesisine çapalı (lib/admin-format.ts →
         `adminWeekRange`). */
      items: content.briefsMissingEn.map((brief) => {
        const haftalik = brief.period === "weekly";
        return {
          key: `${brief.date}-${brief.period}`,
          label: haftalik
            ? `${adminWeekRange(brief.date)} · Haftalık`
            : `${adminDayYear(brief.date)} · Günlük`,
          href: `/admin/yazilar/bulten/${brief.date}?tur=${haftalik ? "haftalik" : "gunluk"}&dil=tr`,
          site: briefHref(brief.date, haftalik ? "weekly" : "daily"),
        };
      }),
    },
    {
      key: "charts",
      label: "Grafiksiz Analiz",
      /* Alan adları ("quarterly_revenue ve guidance alanları boş") okura
         değil şemaya konuşuyordu. */
      note: "Çeyreklik gelir ve öngörü grafiği yok; rutin bunları tamamlamayı yeni analize tercih ediyor.",
      items: content.analysesWithoutCharts.map((ref) => ({
        key: ref.label,
        label: ref.label,
        href: analysisHref(ref.symbol, ref.period),
      })),
    },
    rhythm.ok
      ? {
          key: "brief-missed",
          label: "Yazılmamış Bülten",
          note: `Son ${RITIM_HAFTA} hafta. Günlük bülten her gün ${BRIEF_PUBLISH_TR.daily} TR'de, haftalık pazartesi ${BRIEF_PUBLISH_TR.weekly} TR'de yazılır; kaçırılan gün geri yazılmıyor.`,
          items: missedBriefs(rhythm.data.days),
        }
      : { key: "brief-missed", label: "Yazılmamış Bülten", note: "", items: [], unavailable: true },
  ];

  const hepsiTamam = gaps.every((gap) => !gap.unavailable && gap.items.length === 0);

  return (
    <AdminPanel id="eksikler">
      <AdminPanelTitle
        hint={hepsiTamam ? undefined : "Satıra basmak eksik listesini açar."}
        action={<YazilarLink />}
      >
        Eksikler
      </AdminPanelTitle>
      {hepsiTamam ? (
        /* BEŞ YEŞİL SATIR YERİNE TEK SATIR. Hiçbir şey eksik değilken beş
           "0 · Tamam" satırı okunacak bir şey söylemiyor; ritme yer açıyor. */
        <ul>
          <HealthRow
            tone="ok"
            label="Hepsi Tamam"
            note="Çeviri, grafik ve bülten günü eksiği yok."
            status="Tamam"
          />
        </ul>
      ) : (
        <ul className={GAP_LIST}>
          {gaps.map((gap) => (
            <GapCell key={gap.key} gap={gap} />
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

/**
 * DÜZENLEMENİN YOLU PANELİN BAŞLIĞINDA. Sayfanın dibinde, hiçbir panelin
 * içinde olmayan bir cümleydi ("Var olan bir metni düzeltmek için Yazılar
 * ekranına geç") — CLAUDE.md sırasının 6. maddesi: uyarı ve künye panelin
 * içinde. Eksiği gören kişinin bir sonraki adımı orası; başlık satırının
 * eylem yuvası yükseklik de harcamıyor (panelin altına bir satır, ritmi
 * 1440'ta 900 pikselin altına iterdi).
 */
function YazilarLink() {
  return <PanelLink href="/admin/yazilar">Yazılara Git</PanelLink>;
}

/** Kaçırılan bülten günleri, en yeniden eskiye — ızgaranın kırmızı ve sarı hücreleri. */
function missedBriefs(days: PublishDay[]): GapItem[] {
  const items: GapItem[] = [];
  days.forEach((day, i) => {
    /* Izgara pazartesi başlıyor: dizideki sıra haftanın günü. */
    const gunAdi = GUNLER[i % 7].ad;
    if (day.dailyState === "late") {
      items.push({ key: `${day.day}-daily`, label: `Bugün · Günlük · Gecikti` });
    } else if (day.dailyState === "missed") {
      items.push({ key: `${day.day}-daily`, label: `${adminDay(day.day)} ${gunAdi} · Günlük` });
    }
    if (day.weeklyMissing) {
      items.push({
        key: `${day.day}-weekly`,
        label: `${adminWeekRange(addEtDays(day.day, -7))} · Haftalık`,
      });
    }
  });
  return items.reverse();
}

/* Liste: dar ekranda alt alta satırlar, aralarında saç teli; `lg`de beş
   sütun, aralarında dikey saç teli. */
const GAP_LIST =
  "flex flex-col divide-y divide-line lg:grid lg:grid-cols-5 lg:divide-x lg:divide-y-0";

/* Satırın iki yüzü. `-mx-2.5 px-2.5`: üzerine gelince açılan zemin için
   dolgu; metin panel başlığının hizasında kalıyor (HealthRow ve RankList
   ile aynı). `lg`de hücre: ad üstte, sayı ve durum altta. */
const GAP_ROW =
  "-mx-2.5 flex min-h-11 items-center justify-between gap-3 rounded-(--radius-sm) px-2.5 py-2 text-base lg:min-h-0 lg:flex-col lg:items-start lg:justify-start lg:gap-1";

/* Hücrenin yan dolgusu `li`de: ilk hücre panel başlığının hizasında, son
   hücre sağ kenarda; aradakiler dikey saç telinden 16 piksel içeride. */
const GAP_CELL = "min-w-0 lg:px-4 lg:first:pl-0 lg:last:pr-0";

/* ADLAR `lg`DE İKİ SATIRLIK YER AYIRIYOR, `xl`E KADAR. 1024'te beş hücreye
   ~135 piksellik ad alanı düşüyor ve "İngilizcesi Eksik Analiz" sarıyor,
   "Grafiksiz Analiz" sarmıyordu: sayılar iki ayrı yükseklikte duruyordu
   (454 ve 474 piksel, ölçüldü). Ayrılan ikinci satır sayıları aynı hatta
   tutuyor; 1440'ta adlar tek satıra sığıyor ve yer ayrılmıyor. */
const GAP_LABEL = "block min-w-0 font-semibold text-strong lg:max-xl:min-h-[2lh]";

function GapCell({ gap }: { gap: Gap }) {
  const count = gap.items.length;
  const tone: HealthTone = gap.unavailable ? "idle" : count > 0 ? "warn" : "ok";
  const word = gap.unavailable ? "Okunamadı" : count > 0 ? "Dikkat" : "Tamam";

  const body = (
    <>
      <span className="flex min-w-0 items-start gap-2.5">
        <HealthMark tone={tone} />
        <span className={GAP_LABEL}>{gap.label}</span>
      </span>
      {/* SAYILAR BİR SÜTUNDA. Telefonda sayı, sözcük ve ok üç sabit
          yuvada: yuvasız hâlinde "2 Dikkat ⌄" satırının sayısı okun
          genişliği kadar sola kayıyor, beş satırın sayıları zikzak
          çiziyordu. `lg`de yuvalar kalkıyor — sayı adın altında, noktanın
          değil ADIN hizasında (nokta 8 + aralık 10 = 18 piksel). */}
      <span className="flex shrink-0 items-baseline gap-2 lg:pl-[18px]">
        <span className="numeral min-w-[3ch] text-right font-bold text-strong lg:min-w-0 lg:text-left lg:text-title">
          {gap.unavailable ? "—" : count.toLocaleString("tr-TR")}
        </span>
        <span
          className={cn(
            "w-[3.75rem] text-small font-semibold lg:w-auto",
            gap.unavailable ? "text-brass-ink" : HEALTH_INK[tone],
          )}
        >
          {word}
        </span>
        <span aria-hidden className={cn("flex w-3 self-center", count === 0 && "lg:hidden")}>
          {count > 0 && (
            <CaretDown
              size={12}
              weight="bold"
              className="text-muted transition-transform group-open/gap:rotate-180"
            />
          )}
        </span>
      </span>
    </>
  );

  return (
    <li className={GAP_CELL}>
      {count === 0 ? (
        <div className={GAP_ROW}>{body}</div>
      ) : (
        <details className="group/gap">
          <summary
            className={cn(
              GAP_ROW,
              "cursor-pointer list-none transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus) [&::-webkit-details-marker]:hidden",
            )}
          >
            {body}
          </summary>
          <div className="pb-3 pl-[18px]">
            <p className="mt-1 text-small leading-relaxed text-muted">{gap.note}</p>
            <ul className="mt-2 flex flex-col">
              {gap.items.map((item) => (
                <GapItemRow key={item.key} item={item} />
              ))}
            </ul>
          </div>
        </details>
      )}
    </li>
  );
}

/**
 * Listenin satırı. YİRMİ SATIR TAVANI YOK: fazlası "…ve N tane daha" diye
 * yazılıyordu ve o satır hiçbir yere gitmiyordu — eksik listesi tam da
 * tamamlanması için var, kırpılmış hâli işe yaramıyor. Listeler onlarca
 * satır mertebesinde ve kapalı duruyor, sayfalama gerekmiyor.
 *
 * Dokunma hedefi 44 piksel, gerçek yükseklikle: satırlar alt alta ve
 * `.tap-44` bir alttakinin hedefini kapardı.
 */
function GapItemRow({ item }: { item: GapItem }) {
  const linkClass =
    "flex min-h-11 items-center transition-colors hover:text-primary sm:min-h-8";
  return (
    <li className="flex items-center justify-between gap-3 text-base">
      {item.href ? (
        <Link href={item.href} prefetch={false} className={cn(linkClass, "numeral min-w-0 text-body")}>
          {item.label}
        </Link>
      ) : (
        <span className="numeral flex min-h-11 items-center text-body sm:min-h-8">{item.label}</span>
      )}
      {item.site && (
        <Link
          href={item.site}
          prefetch={false}
          className={cn(linkClass, "shrink-0 whitespace-nowrap text-small font-semibold text-muted")}
        >
          Sitede Gör
        </Link>
      )}
    </li>
  );
}

/** Eksikler'in yer tutucusu — aynı beş satır, sayılar iskelet. */
function GapsSkeleton() {
  const labels = [
    "İngilizcesi Eksik Mercek",
    "İngilizcesi Eksik Analiz",
    "İngilizcesi Eksik Bülten",
    "Grafiksiz Analiz",
    "Yazılmamış Bülten",
  ];
  return (
    <div aria-hidden>
      <AdminPanel>
        <AdminPanelTitle hint="Satıra basmak eksik listesini açar." action={<YazilarLink />}>
          Eksikler
        </AdminPanelTitle>
        <ul className={GAP_LIST}>
          {labels.map((label) => (
            <li key={label} className={GAP_CELL}>
              <div className={GAP_ROW}>
                <span className="flex min-w-0 items-start gap-2.5">
                  <HealthMark tone="idle" />
                  <span className={GAP_LABEL}>{label}</span>
                </span>
                <span className="flex shrink-0 items-center lg:pl-[18px]">
                  <span className="flex h-[1lh] items-center lg:text-title">
                    <span className="skeleton block h-3 w-16" />
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </AdminPanel>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Yayın ritmi
   -------------------------------------------------------------------------- */

async function Rhythm() {
  const result = await ritim();
  if (!result.ok) {
    return (
      <AdminPanel id="ritim">
        <AdminPanelTitle hint={`Son ${RITIM_HAFTA} Hafta`}>Yayın Ritmi</AdminPanelTitle>
        <AdminPanelError />
      </AdminPanel>
    );
  }
  const { days, firstBriefDay } = result.data;
  /* HAFTA SONU DA SAYILIYOR: rutin her gün yazıyor (lib/admin-data.ts →
     `getPublishRhythm`, ölçüm orada). Bugünün gecikmesi de eksik. */
  const bosGun = days.filter(
    (d) => d.dailyState === "missed" || d.dailyState === "late",
  ).length;
  const haftalikEksik = days.filter((d) => d.weeklyMissing).length;

  /* Künye YARGI DEĞİL SAYI veriyor: kaç günde bülten yazılmadığı ızgaraya
     bakmadan da okunsun. Sıfırsa cümle de olumlu. */
  const hint = [
    `Son ${RITIM_HAFTA} Hafta`,
    bosGun === 0 ? "Bülten Her Gün Yazılmış" : `Bülten ${bosGun} Günde Yazılmamış`,
    haftalikEksik > 0 ? `${haftalikEksik} Haftalık Yazılmamış` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AdminPanel id="ritim">
      <AdminPanelTitle hint={hint}>Yayın Ritmi</AdminPanelTitle>
      <PublishGrid days={days} />
      <DayPicker firstBriefDay={firstBriefDay} />
    </AdminPanel>
  );
}

/**
 * TARİH SEÇİMİ — ızgaranın kapsamadığı geçmişe gitmek için. Izgara son
 * sekiz haftayı gösteriyor; arşiv daha eskiye gidiyor ve oraya ulaşmanın
 * hiçbir yolu yoktu.
 *
 * JAVASCRIPT YOK: düz bir GET formu, tarayıcının kendi takvimi. `min`
 * arşivin İLK GÜNLÜK bülteni (`PublishRhythm.firstBriefDay`): sınır bir
 * dönem en eski HAFTALIK çapadan geliyordu (20 Tem) ve günlükleri 31 Tem'de
 * başlayan arşivde on bir boş gün seçilebiliyordu — yorum "seçici veri
 * olmayan bir güne izin vermiyor" diyordu, seçici veriyordu. `max` bugün:
 * yarının bülteni yok.
 *
 * YÖNETİMDE AÇIYOR, SİTE İKİNCİ YOL (23 Eylül denetimi). Form sitedeki
 * `/bulten`e gidiyordu ve panelden çıkılıyordu; düzeltme yapılacak yer
 * yönetimdeki bülten listesi (o günün iki dili, iki editörü). Site ikinci
 * düğmenin `formaction`ı — aynı tarih, JavaScript'siz.
 *
 * KÜNYEDE EK YOK. "Arşiv 31 Tem 2026'da Başlıyor" yılın okunuşuna bağlı bir
 * ek ister (2026'da, 2027'de); tarih veriden geliyor, ek sabit yazılamaz.
 */
function DayPicker({ firstBriefDay }: { firstBriefDay: string | null }) {
  const today = todayEt();
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
      {/* TELEFONDA ÜÇ KAT: tarih tam genişlikte, iki düğme yan yana ve eşit,
          künye altta. Tek sarılan satırdı ve 390'da "Sitede Gör" tek başına
          ikinci satıra, künye de onun yanına kaymış bir yüksekliğe düşüyordu. */}
      <form
        action="/admin/yazilar/bulten"
        method="get"
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-2"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-small font-semibold text-muted">Geçmiş Bir Güne Git</span>
          <input
            type="date"
            name="tarih"
            required
            defaultValue={today}
            min={firstBriefDay ?? undefined}
            max={today}
            /* Yükseklik düğmeyle aynı: telefonda 44, geniş ekranda 40
               (`Button` md). */
            className={cn(adminInput, "numeral h-11 w-full sm:h-10 sm:w-auto")}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="submit" variant="ghost">
            Bülteni Aç
          </Button>
          <Button type="submit" variant="quiet" formAction="/bulten">
            Sitede Gör
          </Button>
        </div>
        <span className="numeral text-small text-muted sm:flex sm:h-10 sm:items-center sm:pl-2">
          {firstBriefDay ? `İlk Günlük ${adminDayYear(firstBriefDay)}` : "Arşivde Kayıt Yok"}
        </span>
      </form>
      {/* TEK SATIR, 360 PİKSELDE DE: iki satıra saran uzun hâli ("…yönetimdeki
          bülten listesinde açar.") 390'da yer tutucudan 18 piksel uzun
          ölçüldü; kısa hâli her genişlikte bir satır, yer tutucu da bir. */}
      <p className="text-small text-muted">
        Dolu bülten hücresi o günün kaydını panelde açar.
      </p>
    </div>
  );
}

/** Ritmin yer tutucusu — aynı başlık, aynı şeritler, aynı form satırı. */
function RhythmSkeleton() {
  return (
    <div aria-hidden>
      <AdminPanel>
        <AdminPanelTitle hint={`Son ${RITIM_HAFTA} Hafta`}>Yayın Ritmi</AdminPanelTitle>
        <PublishGridSkeleton weeks={RITIM_HAFTA} />
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-2">
            <div className="flex flex-col gap-1.5">
              <span className="flex h-[1lh] items-center text-small">
                <Skeleton className="h-2.5 w-28" />
              </span>
              <Skeleton className="h-11 w-full rounded-(--radius-md) sm:h-10 sm:w-36" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Skeleton className="h-11 rounded-md sm:h-10 sm:w-24" />
              <Skeleton className="h-11 rounded-md sm:h-10 sm:w-24" />
            </div>
            <span className="flex h-[1lh] items-center text-small sm:h-10">
              <Skeleton className="h-2.5 w-32" />
            </span>
          </div>
          <span className="flex h-[1lh] items-center text-small">
            <Skeleton className="h-2.5 w-72 max-w-full" />
          </span>
        </div>
      </AdminPanel>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Toplamlar
   -------------------------------------------------------------------------- */

/** "Hepsi İki Dilli" ya da "3 Tanesi Tek Dilli" — sıfırsa olumlu cümle, sayı değil. */
function dilKunyesi(tekDilli: number, toplam: number): string {
  if (toplam === 0) return "Hiç Yazılmamış";
  return tekDilli === 0 ? "Hepsi İki Dilli" : `${tekDilli.toLocaleString("tr-TR")} Tanesi Tek Dilli`;
}

/**
 * Arşivin büyüklüğü — sayfanın en altında, çünkü hiçbir eylem istemiyor.
 *
 * ÜÇ KUTU, DÖRT DEĞİL. "Grafiksiz Analiz" dördüncü kutuydu ve aynı sayıyı
 * artık Eksikler satırı taşıyor; burada analiz kutusunun künyesine indi.
 *
 * KÜNYE SIFIRA GÖRE (23 Eylül denetimi): "0 Tanesi Tek Dilli" ve "Grafiksiz
 * Analiz 0 · Tamamlanmayı Bekliyor" yazıyordu — bekleyen bir şey yokken.
 * Sıfır olumlu bir cümle ("Hepsi İki Dilli"), sayı yalnızca eksik varken.
 */
async function Summary() {
  const result = await getContentSummary();
  /* Okunamadı "0 bülten, eksik yok" değil: üç kutu da tire. */
  if (!result.ok) {
    return (
      <StatGrid cols={3}>
        {["Bülten", "Mercek Yazısı", "Bilanço Analizi"].map((label) => (
          <StatBox key={label} label={label} value="—" state="unavailable" />
        ))}
      </StatGrid>
    );
  }
  const content = result.data;
  const tekDilliAnaliz = content.analysesMissingEn.length;
  const grafiksiz = content.analysesWithoutCharts.length;
  const analizKunyesi =
    content.analyses === 0
      ? "Hiç Yazılmamış"
      : tekDilliAnaliz === 0 && grafiksiz === 0
        ? "Hepsi İki Dilli ve Grafikli"
        : [
            tekDilliAnaliz === 0 ? "Hepsi İki Dilli" : `${tekDilliAnaliz} Tek Dilli`,
            grafiksiz === 0 ? "Hepsi Grafikli" : `${grafiksiz} Grafiksiz`,
          ].join(" · ");

  return (
    <StatGrid cols={3}>
      {/* FARKLI BÜLTEN, dil satırı değil (lib/admin-data.ts →
          `ContentSummary.briefs`): yanındaki iki kutuyla aynı tanım. "Son"
          en yeni GÜNLÜK — haftalık kayıt biten haftaya çapalı, eski duruyor. */}
      <StatBox
        label="Bülten"
        value={content.briefs.toLocaleString("tr-TR")}
        sub={
          content.briefs > 0
            ? [
                `${content.dailyCount} Günlük`,
                `${content.weeklyCount} Haftalık`,
                content.briefsLatest ? `Son ${adminDayIn(content.briefsLatest, todayEt())}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Hiç Yazılmamış"
        }
      />
      <StatBox
        label="Mercek Yazısı"
        value={content.storySlugs.toLocaleString("tr-TR")}
        sub={dilKunyesi(content.storiesMissingEn.length, content.storySlugs)}
      />
      <StatBox
        label="Bilanço Analizi"
        value={content.analyses.toLocaleString("tr-TR")}
        sub={analizKunyesi}
      />
    </StatGrid>
  );
}
