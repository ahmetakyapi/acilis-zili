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
import { getContentSummary, getRecentBriefs } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { agoLabel } from "@/lib/admin-format";
import { formatEtDateShort } from "@/lib/utils";
import { analysisHref } from "@/lib/analysis";

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
    <div className="flex flex-col gap-5">
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <Summary />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Gaps />
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
        sub={`${content.storiesMissingEn.length} tanesi tek dilli`}
      />
      <StatBox
        label="Bilanço Analizi"
        value={content.analyses.toLocaleString("tr-TR")}
        sub={`${content.analysesMissingEn.length} tanesi tek dilli`}
      />
      <StatBox
        label="Grafiksiz Analiz"
        value={content.analysesWithoutCharts.length.toLocaleString("tr-TR")}
        sub="tamamlanmayı bekliyor"
      />
    </StatGrid>
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
    <div className="grid gap-5 lg:grid-cols-3">
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
      <AdminPanelTitle hint="En yeniden eskiye · yazan rutin künyede">
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
