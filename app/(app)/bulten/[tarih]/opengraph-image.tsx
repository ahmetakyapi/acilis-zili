import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";
import { briefOgImage } from "@/lib/og-cards";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/* Dil sabit, istekten okunmuyor — gerekçe lib/og.tsx başında. */
export const alt = "Günlük Bülten · Açılış Zili";

/** Bülten sayısının paylaşım kartı: manşet ve ilk cümleler (`briefOgImage`). */
export default async function BriefOgImage({
  params,
}: {
  params: Promise<{ tarih: string }>;
}) {
  const { tarih } = await params;
  return briefOgImage(tarih, "daily", DEFAULT_LOCALE);
}
