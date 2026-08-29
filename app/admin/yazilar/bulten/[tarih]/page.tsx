import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/lib/admin";
import { AdminPanel, AdminPanelTitle } from "@/components/admin/AdminUI";
import { BriefEditor } from "@/components/admin/BriefEditor";
import { briefLocalesFor, getBriefForEdit } from "@/lib/admin-data";
import { listBriefRevisions } from "@/app/actions/content";
import { pageMetadata } from "@/lib/page-meta";
import { formatEtDateShort } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/admin/yazilar",
  robots: { index: false, follow: false },
  tr: { title: "Bülteni Düzenle", description: "Yönetim." },
  en: { title: "Edit Brief", description: "Admin." },
});

/**
 * Bülten editörü.
 *
 * KİMLİK ÜÇ PARÇA: tarih adreste, dönem ve dil sorguda (`?tur=haftalik&dil=en`).
 * Üçünü de adrese gömmek `/admin/yazilar/bulten/2026-08-29-haftalik-en` gibi
 * sahte bir kimlik üretirdi; mercek editöründe dil için verilen kararın
 * aynısı. Dönem sorguda çünkü aynı TARİHE iki kayıt düşebiliyor — pazartesi
 * hem o günün günlüğünü hem haftanın haftalığını taşıyor.
 *
 * SORGU TÜRKÇE (`tur=haftalik`), sitenin `/bulten` adresiyle aynı sözcük:
 * panelde `period=weekly`, sitede `tur=haftalik` yazmak aynı şeyin iki adı
 * demekti ve ikisi arasında gidip gelen kişi her seferinde çeviri yapardı.
 *
 * YALNIZCA VAR OLAN KAYDI DÜZENLER. Kayıt yoksa 404 — yeni bülten yazmak
 * rutinin işi, panelin işi düzeltmek.
 */
export default async function BriefEditorPage(
  props: PageProps<"/admin/yazilar/bulten/[tarih]">,
) {
  await requireAdmin();

  const { tarih } = await props.params;
  const search = await props.searchParams;
  const period = search.tur === "haftalik" ? "weekly" : "daily";
  const locale = search.dil === "en" ? "en" : "tr";

  const row = await getBriefForEdit(tarih, locale, period);
  if (!row) notFound();

  /* Sürümler ve öteki dilin varlığı AYNI TURDA: ikisi birbirinden bağımsız. */
  const [revisions, locales] = await Promise.all([
    listBriefRevisions(tarih, period, locale),
    briefLocalesFor(tarih, period),
  ]);

  const oteki = locale === "en" ? "tr" : "en";
  const otekiDil = locales.includes(oteki)
    ? `/admin/yazilar/bulten/${tarih}?tur=${period === "weekly" ? "haftalik" : "gunluk"}&dil=${oteki}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/yazilar"
        className="inline-flex min-h-11 w-fit items-center gap-1.5 text-base font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-9"
      >
        <CaretLeft weight="bold" size={15} />
        Yazılara Dön
      </Link>

      <AdminPanel>
        <AdminPanelTitle
          hint={`${period === "weekly" ? "Haftalık" : "Günlük"} · ${
            locale === "en" ? "İngilizce" : "Türkçe"
          } · ${row.generatedBy === "claude" ? "Rutin Yazdı" : "Kural Tabanlı Yedek"} · ${new Date(
            row.generatedAt,
          ).toLocaleString("tr-TR")}`}
        >
          {/* BAŞLIK TARİH, MANŞET DEĞİL. Manşet zaten formun ilk kutusunda ve
              düzenlenirken değişiyor; panel başlığında da durursa aynı metin
              iki yerde iki farklı hâlde okunur. Tarih ise kaydın kimliği. */}
          {formatEtDateShort(row.briefDate, "tr")} Bülteni
        </AdminPanelTitle>

        <BriefEditor
          revisions={revisions}
          otekiDil={otekiDil}
          draft={{
            date: row.briefDate,
            locale: row.locale,
            period: row.period === "weekly" ? "weekly" : "daily",
            headline: row.headline,
            bodyMd: row.bodyMd,
            generatedBy: row.generatedBy,
            generatedAt: row.generatedAt.toISOString(),
          }}
        />
      </AdminPanel>
    </div>
  );
}
