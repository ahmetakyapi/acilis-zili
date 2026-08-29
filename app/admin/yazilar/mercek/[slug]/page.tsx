import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/lib/admin";
import { AdminPanel, AdminPanelTitle } from "@/components/admin/AdminUI";
import { StoryEditor } from "@/components/admin/StoryEditor";
import { getStoryBySlug } from "@/lib/data";
import { listStoryRevisions } from "@/app/actions/content";
import { pageMetadata } from "@/lib/page-meta";

export const generateMetadata = pageMetadata({
  path: "/admin/yazilar",
  robots: { index: false, follow: false },
  tr: { title: "Yazıyı Düzenle", description: "Yönetim." },
  en: { title: "Edit Story", description: "Admin." },
});

/**
 * Mercek yazısı editörü.
 *
 * YALNIZCA VAR OLAN SLUG'I DÜZENLER. Panelden yeni yazı üretilmiyor: yeni
 * yazı rutinin işi, panelin işi düzeltmek. Kayıt yoksa 404 — yetkisiz
 * isteğin gördüğü şeyin aynısı, panelin varlığını ele vermiyor.
 *
 * DİL ADRESTE DEĞİL SORGUDA (`?dil=en`). Aynı slug iki dilde iki ayrı satır
 * ve ikisi ayrı ayrı düzenlenebilmeli; slug'ı dille birleştirmek adresi
 * `/admin/yazilar/mercek/leopold-tasfiyesi-en` gibi sahte bir kimliğe
 * çevirirdi.
 */
export default async function StoryEditorPage(
  props: PageProps<"/admin/yazilar/mercek/[slug]">,
) {
  await requireAdmin();

  const { slug } = await props.params;
  const search = await props.searchParams;
  const locale = search.dil === "en" ? "en" : "tr";

  const row = await getStoryBySlug(slug, locale);
  if (!row) notFound();

  /* Sürümler kayıtla AYNI TURDA: ikisi birbirinden bağımsız ve ardışık
     beklemenin sebebi yok. */
  const revisions = await listStoryRevisions(slug, locale);

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
          hint={`${row.slug} · ${locale === "en" ? "İngilizce" : "Türkçe"} · Son Güncelleme ${row.updatedAt ? new Date(row.updatedAt).toLocaleString("tr-TR") : "—"}`}
          action={
            /* İki dil arasında geçiş: aynı slug'ın öteki dili varsa oraya,
               yoksa bağlantı hiç çizilmiyor — var olmayan bir kayda giden
               düğme 404'e götürürdü. */
            <Link
              href={`/admin/yazilar/mercek/${slug}${locale === "en" ? "" : "?dil=en"}`}
              className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-line bg-surface px-3.5 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-9"
            >
              {locale === "en" ? "Türkçesine Geç" : "İngilizcesine Geç"}
            </Link>
          }
        >
          {row.title}
        </AdminPanelTitle>

        <StoryEditor
          revisions={revisions}
          draft={{
            slug: row.slug,
            locale: row.locale,
            title: row.title,
            dek: row.dek,
            bodyMd: row.bodyMd,
            eventDate: row.eventDate,
            symbols: row.symbols ?? [],
            sources: row.sources ?? [],
            readMinutes: row.readMinutes ?? 1,
            updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
          }}
        />
      </AdminPanel>
    </div>
  );
}
