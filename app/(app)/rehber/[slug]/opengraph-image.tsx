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
import { guideArticle, guideTopicLabel } from "@/content/guide";
import { readingMinutes } from "@/components/article/ArticleBody";
import { getI18n } from "@/lib/i18n";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili — Rehber";

/** Rehber yazısının paylaşım kartı: başlık, spot, konu ve okuma süresi. */
export default async function GuideOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale, t } = await getI18n();
  const article = guideArticle(slug, locale);
  const fonts = await ogFonts();

  const title = article?.title ?? "Rehber";
  return new ImageResponse(
    (
      <OgFrame
        eyebrow={t.nav.guide} locale={locale}
        footer={
          article ? (
            <>
              <Chip tone="primary">
                {guideTopicLabel(article.topic, locale)}
              </Chip>
              <Chip>{`${readingMinutes(article.bodyMd)} ${t.guide.readMinutes}`}</Chip>
            </>
          ) : undefined
        }
      >
        <OgTitle size={title.length > 40 ? 54 : 68}>{clip(title, 80)}</OgTitle>
        {article?.dek && (
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.34,
              color: C.body,
              display: "flex",
              maxWidth: 980,
            }}
          >
            {clip(article.dek, 150)}
          </div>
        )}
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
