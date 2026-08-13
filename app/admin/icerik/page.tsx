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
import { agoLabel } from "@/lib/admin-format";
import { formatEtDateShort } from "@/lib/utils";

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

export default function ContentPage() {
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

  const sections: { title: string; hint: string; items: string[]; href?: (item: string) => string }[] =
    [
      {
        title: "İngilizcesi Eksik Mercek Yazıları",
        hint: "Sayfa boş kalmıyor — orijinali TR rozetiyle gösteriliyor.",
        items: content.storiesMissingEn,
        href: (slug) => `/mercek/${slug}`,
      },
      {
        title: "İngilizcesi Eksik Analizler",
        hint: "Rutin bunları yeni analiz yazmaya tercih ediyor.",
        items: content.analysesMissingEn,
      },
      {
        title: "Grafiksiz Analizler",
        hint: "quarterly_revenue ve guidance alanları boş — sayfa metin yığını gibi duruyor.",
        items: content.analysesWithoutCharts,
      },
    ];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {sections.map((section) => (
        <AdminPanel key={section.title}>
          <AdminPanelTitle hint={section.hint}>{section.title}</AdminPanelTitle>
          {section.items.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">
              Eksik yok.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {section.items.slice(0, 20).map((item) => (
                <li key={item}>
                  {section.href ? (
                    <Link
                      href={section.href(item)}
                      className="text-body hover:text-primary"
                    >
                      {item}
                    </Link>
                  ) : (
                    <span className="text-body">{item}</span>
                  )}
                </li>
              ))}
              {section.items.length > 20 && (
                <li className="text-[12px] text-muted">
                  …ve {section.items.length - 20} tane daha
                </li>
              )}
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
        <p className="py-8 text-center text-[13px] text-muted">
          Henüz bülten yazılmamış.
        </p>
      ) : (
        <AdminTable head={["Tarih", "Başlık", "Dil", "Dönem", "Yazılma"]}>
          {rows.map((row) => (
            <AdminRow key={`${row.briefDate}-${row.locale}-${row.period}`}>
              <AdminCell mono strong>
                {formatEtDateShort(row.briefDate, "tr")}
              </AdminCell>
              <AdminCell>
                <span className="line-clamp-1">{row.headline}</span>
              </AdminCell>
              <AdminCell>{row.locale === "en" ? "EN" : "TR"}</AdminCell>
              <AdminCell>
                {row.period === "weekly" ? "Haftalık" : "Günlük"}
              </AdminCell>
              <AdminCell align="right">{agoLabel(row.generatedAt)}</AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}

      <p className="mt-4 border-t border-line pt-3 text-[12px] text-muted">
        Yazma yolu tek: rutinler <code>/api/brief</code>,{" "}
        <code>/api/mercek</code> ve <code>/api/analiz</code> uçlarına yazıyor.
        Talimatlar <code>docs/claude-rutinler.md</code> içinde.
      </p>
    </AdminPanel>
  );
}
