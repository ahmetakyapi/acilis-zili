"use server";

import { TermPeek } from "@/components/glossary/TermPeek";
import { glossaryTerm } from "@/content/glossary";
import { articleAutoLinker } from "@/lib/autolink-data";
import { getI18n } from "@/lib/i18n";

/**
 * Sözlük penceresinin gövdesi — sunucuda çizilip JSX olarak dönüyor.
 *
 * Kalıp `content-preview.tsx`in aynısı: `ArticleBody` istemciye inmiyor,
 * pencereye yalnızca çizilmiş RSC yükü geliyor. Tanım sayfadaki çizimin
 * KENDİSİ, ikinci bir çizici yok.
 *
 * Açık uç, yetki yok: içerik zaten herkese açık `/sozluk/{terim}`
 * sayfasının bir alt kümesi. Dil isteğin kendisinden (çerez/önek), istemciden
 * gelen bir parametreden değil. Bilinmeyen slug `null` döner, pencere hata
 * cümlesini ve terim sayfasına giden bağlantıyı gösterir.
 */
export async function glossaryPeekAction(slug: string) {
  const { locale, t } = await getI18n();
  const term = glossaryTerm(slug, locale);
  if (!term) return null;
  const autoLink = await articleAutoLinker(locale, { excludeTerm: term.slug });
  return <TermPeek term={term} locale={locale} t={t} autoLink={autoLink} />;
}
