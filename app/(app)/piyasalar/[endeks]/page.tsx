import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { getI18n, getLocale } from "@/lib/i18n";
import { indexPageBySlug, indexPageCopy, indexPagePath } from "@/lib/index-pages";
import { missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { MarketsScreen } from "../_screen/MarketsScreen";

/**
 * Endeks bileşen sayfası — `/piyasalar/sp-500`, `/piyasalar/nasdaq-100`,
 * `/piyasalar/dow-jones` (14 Kasım 2026; gerekçe lib/index-pages.ts).
 *
 * Piyasalar ekranının o endeksle açılmış hâli (`MarketsScreen`); kendi
 * `h1`i, sayıyla başlayan ilk cümlesi, canonical'ı, hreflang'i ve kırıntı
 * yolu var. Liste sabit ve kapalı: tanınmayan ad 404.
 *
 * Paylaşım görseli üst segmentin dosyası (`../opengraph-image.tsx`): üç
 * endeksi birlikte çizen Piyasalar kartı; endekse özel kart yok.
 */
export async function generateMetadata(props: PageProps<"/piyasalar/[endeks]">): Promise<Metadata> {
  const { endeks } = await props.params;
  const locale = await getLocale();
  const page = indexPageBySlug(endeks);
  if (!page) return missingMetadata(locale);
  const copy = indexPageCopy(page, locale);
  return {
    title: copy.title,
    description: copy.description,
    alternates: pageAlternates(indexPagePath(page.key), locale),
  };
}

export default async function IndexMembersPage(props: PageProps<"/piyasalar/[endeks]">) {
  const [{ endeks }, search] = await Promise.all([props.params, props.searchParams]);
  const page = indexPageBySlug(endeks);
  if (!page) notFound();
  const { locale, t } = await getI18n();
  return (
    <>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.nav.markets, path: "/piyasalar" },
          { name: indexPageCopy(page, locale).heading, path: indexPagePath(page.key) },
        ]}
      />
      <MarketsScreen search={search} index={page} />
    </>
  );
}
