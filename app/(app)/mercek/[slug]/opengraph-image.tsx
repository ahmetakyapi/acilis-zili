import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";
import { storyOgImage } from "@/lib/og-cards";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/* DİL SABİT, İSTEKTEN OKUNMUYOR — gerekçenin tamamı lib/og.tsx başında.
   Özeti: paylaşım kartının adresi önek taşımıyor, dolayısıyla `getI18n()`
   buradan hiçbir zaman `en` döndürmüyordu; çıktıyı değiştirmeden yalnızca
   her istekte `headers()` ve `cookies()` okuyordu. */
export const alt = "Mercek · Açılış Zili";

/** Mercek yazısının paylaşım kartı: başlık ve yazının rakamları (ilk
    `::: sayilar`, yoksa ilk `::: bar`; ikisi de yoksa spot). Çizim
    `lib/og-cards.tsx` → `storyOgImage`. */
export default async function StoryOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return storyOgImage(slug, DEFAULT_LOCALE);
}
