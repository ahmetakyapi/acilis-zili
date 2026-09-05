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
import { DEFAULT_LOCALE, getDictionary } from "@/lib/i18n";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/* DİL SABİT, İSTEKTEN OKUNMUYOR — gerekçenin tamamı lib/og.tsx başında.
   Özeti: paylaşım kartının adresi önek taşımıyor, dolayısıyla `getI18n()`
   buradan hiçbir zaman `en` döndürmüyordu; çıktıyı değiştirmeden yalnızca
   her istekte `headers()` ve `cookies()` okuyordu. */
export const alt = "Rehber · Açılış Zili";

/** Rehber yazısının paylaşım kartı: başlık, spot, konu ve okuma süresi. */
export default async function GuideOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getDictionary(locale);
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
