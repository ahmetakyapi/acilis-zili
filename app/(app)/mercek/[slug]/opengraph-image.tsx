import { ImageResponse } from "next/og";
import {
  C,
  Chip,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  OgTitle,
  clip,
  ogFonts,
} from "@/lib/og";
import { getStoryBySlug } from "@/lib/data";
import { DEFAULT_LOCALE, getDictionary } from "@/lib/i18n";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/* DİL SABİT, İSTEKTEN OKUNMUYOR — gerekçenin tamamı lib/og.tsx başında.
   Özeti: paylaşım kartının adresi önek taşımıyor, dolayısıyla `getI18n()`
   buradan hiçbir zaman `en` döndürmüyordu; çıktıyı değiştirmeden yalnızca
   her istekte `headers()` ve `cookies()` okuyordu. */
export const alt = "Açılış Zili — Mercek";

/** Mercek yazısının paylaşım kartı: başlık + spot. */
export default async function StoryOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getDictionary(locale);
  const story = await getStoryBySlug(slug, locale);
  const fonts = await ogFonts();

  const title = story?.title ?? "Mercek";
  return new ImageResponse(
    (
      <OgFrame
        eyebrow={t.nav.stories} locale={locale}
        footer={story?.dek ? <Chip tone="primary">Uzun Okuma</Chip> : undefined}
      >
        <OgTitle size={title.length > 46 ? 50 : title.length > 28 ? 60 : 70}>
          {clip(title, 88)}
        </OgTitle>
        {story?.dek && (
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.34,
              color: C.body,
              display: "flex",
              maxWidth: 980,
            }}
          >
            {clip(story.dek, 150)}
          </div>
        )}
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
