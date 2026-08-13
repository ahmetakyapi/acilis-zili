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
import { getI18n } from "@/lib/i18n";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili — Mercek";

/** Mercek yazısının paylaşım kartı: başlık + spot. */
export default async function StoryOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale, t } = await getI18n();
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
