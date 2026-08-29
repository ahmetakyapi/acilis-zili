import Link from "next/link";
import { Suspense } from "react";
import {
  AdminPanel,
  AdminPanelTitle,
  StatBox,
  StatGrid,
  StatGridSkeleton,
} from "@/components/admin/AdminUI";
import { Skeleton } from "@/components/ui/primitives";
import { getContentSummary, getPublishRhythm } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { formatEtDateShort } from "@/lib/utils";
import { todayEt } from "@/lib/market-hours";
import { analysisHref } from "@/lib/analysis";
import { PublishGrid } from "@/components/admin/PublishGrid";

/**
 * İçerik — yayının SAĞLIK PANOSU.
 *
 * Bu ekran metin DEĞİŞTİRMİYOR ve bu bir bölünmenin sonucu: düzenleme
 * Yazılar ekranına taşındı (`/admin/yazilar`). İkisi bir dönem tek sayfadaydı
 * ve o sayfa aynı anda hem ölçüyor hem düzenletiyordu; iki farklı iş için
 * açılan tek ekran, ikisinde de uzun ve dağınık kalıyordu.
 *
 * Burada kalan iş EKSİĞİ GÖSTERMEK: hangi yazının İngilizcesi yok, hangi
 * analiz grafiksiz kalmış, bülten hangi iş gününde yazılmamış. Rutin bu
 * listeyi kendi ucundan zaten okuyor; buradaki insanın bakabildiği hâli.
 *
 * YENİ İÇERİK YİNE UÇLARDAN geliyor: `/api/brief`, `/api/mercek`,
 * `/api/analiz` — onları claude.ai rutinleri çağırıyor
 * (docs/claude-rutinler.md). Panel var olanı düzeltiyor ve ikisi de aynı
 * doğrulamadan, aynı yazma yolundan geçiyor (`lib/content-write.ts`).
 */

export default async function ContentPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<StatGridSkeleton boxes={4} cols={4} />}>
        <Summary />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Gaps />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Rhythm />
      </Suspense>

      {/* DÜZENLEMENİN YOLU YAZILI. Sekme çubuğu "Yazılar"ı zaten gösteriyor
          ama eksiği burada gören kişinin bir sonraki adımı orası; sekmeye
          bakıp aradaki bağı kendi kurması gerekmesin. */}
      <p className="text-small text-muted">
        Var olan bir metni düzeltmek için{" "}
        <Link
          href="/admin/yazilar"
          className="font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          Yazılar
        </Link>{" "}
        ekranına geç — mercek yazıları ve bültenler oradan açılıyor.
      </p>
    </div>
  );
}

async function Summary() {
  const content = await getContentSummary();
  return (
    <StatGrid>
      <StatBox
        label="Bülten"
        value={content.briefs.toLocaleString("tr-TR")}
        sub={
          content.briefsLatest
            ? `Son: ${formatEtDateShort(content.briefsLatest, "tr")}`
            : "Hiç Yazılmamış"
        }
      />
      <StatBox
        label="Mercek Yazısı"
        value={content.storySlugs.toLocaleString("tr-TR")}
        sub={`${content.storiesMissingEn.length} Tanesi Tek Dilli`}
      />
      <StatBox
        label="Bilanço Analizi"
        value={content.analyses.toLocaleString("tr-TR")}
        sub={`${content.analysesMissingEn.length} Tanesi Tek Dilli`}
      />
      <StatBox
        label="Grafiksiz Analiz"
        value={content.analysesWithoutCharts.length.toLocaleString("tr-TR")}
        sub="Tamamlanmayı Bekliyor"
      />
    </StatGrid>
  );
}

async function Rhythm() {
  const { days, firstBriefDay } = await getPublishRhythm(8);
  const bosIsGunu = days.filter(
    (d) => !d.daily && !d.offDay && !d.isToday,
  ).length;
  const today = todayEt();

  return (
    <AdminPanel>
      {/* Künye YARGI DEĞİL SAYI veriyor: kaç iş gününde bülten yazılmadığı
          ızgaraya bakmadan da okunsun. Sıfırsa cümle de olumlu. */}
      <AdminPanelTitle
        hint={
          bosIsGunu === 0
            ? "Son 8 Hafta · Bülten Beklenen Her İş Gününde Yazılmış"
            : `Son 8 Hafta · ${bosIsGunu} İş Gününde Bülten Yazılmamış`
        }
      >
        Yayın Ritmi
      </AdminPanelTitle>
      <PublishGrid days={days} />

      {/* TARİH SEÇİMİ — ızgaranın kapsamadığı geçmişe gitmek için.
          Izgara son sekiz haftayı gösteriyor; arşiv daha eskiye gidiyor ve
          oraya ulaşmanın hiçbir yolu yoktu.

          JAVASCRIPT YOK: düz bir GET formu, tarayıcının kendi takvimi.
          `min`/`max` ARŞİVİN gerçek aralığından geliyor, yani seçici veri
          olmayan bir güne hiç izin vermiyor — "veri olan günü işaretlemek"
          kuralının en ucuz hâli. `max` bugün: yarının bülteni yok. */}
      <form
        action="/bulten"
        method="get"
        className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-tiny font-semibold text-muted">
            Geçmiş Bir Güne Git
          </span>
          <input
            type="date"
            name="tarih"
            defaultValue={today}
            min={firstBriefDay ?? undefined}
            max={today}
            className="numeral h-11 rounded-(--radius-md) border border-line bg-surface px-3 text-base text-strong outline-none focus:border-line-focus sm:h-9"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-(--radius-md) border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:h-9"
        >
          Bülteni Aç
        </button>
        <span className="text-tiny text-muted">
          {firstBriefDay
            ? `arşiv ${formatEtDateShort(firstBriefDay, "tr")} tarihinde başlıyor`
            : "arşivde henüz kayıt yok"}
        </span>
      </form>

      <p className="mt-3 text-tiny text-muted">
        Dolu bir bülten hücresine basmak o günün bültenini açar. Pazartesi
        hücresindeki küçük nokta, haftalık bültenin de o güne yazıldığını
        söyler.
      </p>
    </AdminPanel>
  );
}

async function Gaps() {
  const content = await getContentSummary();

  /* HER SATIR ARTIK GİDİLEBİLİR. Analiz listeleri düz metindi: eksiği gören
     yönetici kaydı açmak için sembolü kopyalayıp siteden aramak zorundaydı.
     Adres `analysisHref` ile kuruluyor — elle `/bilancolar/NVDA/...` yazmak
     sayfayı açardı ama sitede olmayan İKİNCİ bir adres biçimi doğurur ve
     ölçüm onu ayrı bir yol olarak sayıp okunmayı bölerdi. */
  const sections: {
    title: string;
    hint: string;
    items: { key: string; label: string; href: string }[];
  }[] = [
    {
      title: "İngilizcesi Eksik Mercek Yazıları",
      hint: "Sayfa boş kalmıyor — orijinali TR rozetiyle gösteriliyor.",
      items: content.storiesMissingEn.map((slug) => ({
        key: slug,
        label: slug,
        href: `/mercek/${slug}`,
      })),
    },
    {
      title: "İngilizcesi Eksik Analizler",
      hint: "Rutin bunları yeni analiz yazmaya tercih ediyor.",
      items: content.analysesMissingEn.map((ref) => ({
        key: ref.label,
        label: ref.label,
        href: analysisHref(ref.symbol, ref.period),
      })),
    },
    {
      title: "Grafiksiz Analizler",
      hint: "quarterly_revenue ve guidance alanları boş — sayfa metin yığını gibi duruyor.",
      items: content.analysesWithoutCharts.map((ref) => ({
        key: ref.label,
        label: ref.label,
        href: analysisHref(ref.symbol, ref.period),
      })),
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {sections.map((section) => (
        <AdminPanel key={section.title}>
          <AdminPanelTitle hint={section.hint}>{section.title}</AdminPanelTitle>
          {section.items.length === 0 ? (
            <p className="py-6 text-center text-base text-muted">Eksik yok.</p>
          ) : (
            /* YİRMİ SATIR TAVANI KALKTI. Fazlası "…ve N tane daha" diye
               yazılıyordu ve o satır hiçbir yere gitmiyordu: eksik listesi
               tam da tamamlanması için var, kırpılmış hâli işe yaramıyor.
               Listeler onlarca satır mertebesinde, sayfalama gerekmiyor.
               Dokunma hedefi 44 piksel: satırlar alt alta ve `.tap-44`
               burada bir alttakinin hedefini kapardı. */
            <ul className="flex flex-col text-base">
              {section.items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="numeral flex min-h-11 items-center text-body transition-colors hover:text-primary sm:min-h-8"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      ))}
    </div>
  );
}
