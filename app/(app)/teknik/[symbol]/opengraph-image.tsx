import { ImageResponse } from "next/og";
import { verdictLabel, verdictOf } from "@/lib/analysis";
import { DEFAULT_LOCALE, getDictionary } from "@/lib/i18n";
import { OG_CONTENT_TYPE, OG_SIZE, clip, ogFonts, sectionOg } from "@/lib/og";
import { isTechnicalSymbol, slotLabel } from "@/lib/technical";
import { getTechnicalDetail } from "@/lib/technical-data";
import { formatEtDateCompact } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
/* Dil sabit — gerekçe lib/og.tsx başında (paylaşım adresi önek taşımıyor). */
export const alt = "Teknik Analiz · Açılış Zili";

/**
 * Tek hissenin teknik analiz kartı.
 *
 * DETAY SAYFASI KENDİ `openGraph`'INI VERİYOR (article künyesi) ve Next o
 * nesneyi derin birleştirmiyor: segmentte görsel dosyası yokken üst
 * segmentlerden gelen görseller siliniyor, paylaşımda hiç görsel çıkmıyordu.
 * Kart sayfanın kendi manşetini taşıyor: sembol, görüş, yayın ve başlık
 * cümlesi. Analiz yoksa yalnızca sembol ve bölüm adı.
 */
export default async function TechnicalOgImage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const t = getDictionary(DEFAULT_LOCALE);
  const detail = isTechnicalSymbol(symbol) ? await getTechnicalDetail(symbol) : null;
  const row = detail?.row ?? null;

  return new ImageResponse(
    sectionOg({
      eyebrow: t.technical.title,
      title: symbol,
      dek: row ? clip(row.copy.tr.headline, 150) : t.technical.description,
      chips: row
        ? [
            verdictLabel(verdictOf(row.stance), t),
            slotLabel(row.slot, t),
            formatEtDateCompact(row.sessionDate, DEFAULT_LOCALE),
          ]
        : ["AL · TUT · SAT", t.technical.entryZone, t.technical.stop],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
