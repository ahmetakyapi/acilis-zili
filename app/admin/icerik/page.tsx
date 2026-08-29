import Link from "next/link";
import { Suspense } from "react";
import {
  AdminCell,
  AdminPanel,
  AdminPanelTitle,
  AdminRow,
  AdminTable,
  StatBox,
  StatGrid,
} from "@/components/admin/AdminUI";
import { Skeleton } from "@/components/ui/primitives";
import {
  getContentSummary,
  getEditableStories,
  getPublishRhythm,
  getRecentBriefs,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { agoLabel } from "@/lib/admin-format";
import { formatEtDateShort } from "@/lib/utils";
import { todayEt } from "@/lib/market-hours";
import { analysisHref } from "@/lib/analysis";
import { PublishGrid } from "@/components/admin/PublishGrid";

/**
 * İçerik.
 *
 * Bu ekran yayın YAPMIYOR ve bilerek: bülten, mercek yazısı ve bilanço
 * analizi `/api/brief`, `/api/mercek`, `/api/analiz` uçlarından yazılıyor ve
 * o uçları claude.ai rutinleri çağırıyor (docs/claude-rutinler.md). İkinci
 * bir yazma yolu açmak iki ayrı doğrulama, iki ayrı biçim kontrolü ve er geç
 * birbirinden ayrı düşen iki kod yolu demek.
 *
 * Panelin işi EKSİĞİ GÖSTERMEK: hangi yazının İngilizcesi yok, hangi analiz
 * grafiksiz kalmış, bülten kaç gündür yazılmamış. Rutin bu listeyi kendi
 * ucundan zaten okuyor; buradaki insanın bakabildiği hâli.
 */

export default async function ContentPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <Summary />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Gaps />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Rhythm />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Editable />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
        <Briefs />
      </Suspense>
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
            ? `son: ${formatEtDateShort(content.briefsLatest, "tr")}`
            : "hiç yazılmamış"
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

async function Editable() {
  const rows = await getEditableStories(40);

  return (
    <AdminPanel>
      {/* PANELİN YÖNETTİĞİ ŞEY BURADA LİSTELENİYOR. Ekran bugüne kadar
          içeriği SAYIYORDU; hangi yazının var olduğunu ve ona nasıl
          dokunulacağını söylemiyordu. Satırdan editöre, editörden yayındaki
          sayfaya gidiliyor. */}
      <AdminPanelTitle hint="En Yeniden Eskiye · Satıra Basınca Editör Açılır">
        Mercek Yazıları
      </AdminPanelTitle>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-base text-muted">
          Henüz mercek yazısı yok.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {rows.map((row) => (
            <li key={row.slug}>
              <Link
                href={`/admin/icerik/${row.slug}`}
                className="flex min-h-11 flex-col gap-1 rounded-(--radius-sm) px-2 py-3 transition-colors hover:bg-surface-elevated sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-strong">
                    {row.title}
                  </span>
                  <span className="numeral block truncate text-tiny text-muted">
                    {row.slug}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {/* Diller rozette: iki dilli mi, tek dilde mi kalmış —
                      eksik çeviri listesi ayrıca var ama burada da bir
                      bakışta görünüyor. */}
                  {row.locales.map((dil) => (
                    <span
                      key={dil}
                      className="numeral rounded-full bg-primary-wash px-2 py-0.5 text-nano font-bold text-primary-ink"
                    >
                      {dil}
                    </span>
                  ))}
                  {row.generatedBy === "admin" && (
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-nano font-semibold text-muted">
                      Elden Geçti
                    </span>
                  )}
                  <span className="numeral w-24 text-right text-tiny text-muted">
                    {formatEtDateShort(row.eventDate, "tr")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
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
            <p className="py-6 text-center text-base text-muted">
              Eksik yok.
            </p>
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

async function Briefs() {
  const rows = await getRecentBriefs(16);

  return (
    <AdminPanel>
      <AdminPanelTitle hint="En Yeniden Eskiye · Yazan Rutin Künyede">
        Son Bültenler
      </AdminPanelTitle>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-base text-muted">
          Henüz bülten yazılmamış.
        </p>
      ) : (
        /* "YAZAN" SÜTUNU EKLENDİ. Panelin kendi ipucu "yazan rutin künyede"
           diye söz veriyordu ama tablo o sütunu hiç basmıyordu — `generatedBy`
           sorguda zaten çekiliyordu. Bültenin rutinden mi yoksa kural tabanlı
           yedekten mi geldiği, rutin durduğunda ilk bakılacak şey. */
        <AdminTable
          label="Bülten arşivi"
          head={["Tarih", "Başlık", "Dil", "Dönem", "Yazan", "Yazılma"]}
        >
          {rows.map((row) => (
            <AdminRow key={`${row.briefDate}-${row.locale}-${row.period}`}>
              {/* Tarih hücresi kendi bültenine gidiyor: eksiği ya da tuhaf
                  bir başlığı gören yönetici kaydı doğrudan açabiliyor. */}
              <AdminCell numeral strong>
                <Link
                  href={`/bulten?${row.period === "weekly" ? "tur=haftalik&" : ""}tarih=${row.briefDate}`}
                  className="transition-colors hover:text-primary"
                >
                  {formatEtDateShort(row.briefDate, "tr")}
                </Link>
              </AdminCell>
              <AdminCell>
                <span className="line-clamp-1">{row.headline}</span>
              </AdminCell>
              <AdminCell>{row.locale === "en" ? "EN" : "TR"}</AdminCell>
              <AdminCell>
                {row.period === "weekly" ? "Haftalık" : "Günlük"}
              </AdminCell>
              <AdminCell>
                {row.generatedBy === "claude" ? "Rutin" : "Kural Tabanlı"}
              </AdminCell>
              <AdminCell align="right">{agoLabel(row.generatedAt)}</AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}

      <p className="mt-4 border-t border-line pt-3 text-small text-muted">
        Yazma yolu tek: rutinler <code>/api/brief</code>,{" "}
        <code>/api/mercek</code> ve <code>/api/analiz</code> uçlarına yazıyor.
        Talimatlar <code>docs/claude-rutinler.md</code> içinde.
      </p>
    </AdminPanel>
  );
}
