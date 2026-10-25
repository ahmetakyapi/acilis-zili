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
 * cümlesi. Listedeki sembolün analizi henüz yoksa yalnızca sembol ve bölüm
 * adı.
 *
 * LİSTE DIŞI SEMBOL 404 (20 Ekim). Sayfa 404 verirken kart adresteki HAM
 * metni başlık olarak basıp 200 dönüyordu: `/teknik/<herhangi bir metin>/
 * opengraph-image` sitenin "Teknik Analiz" çerçevesinde, istenen cümleyle
 * bir görsel üretiyordu — ve her biri istek başına bir Satori çizimi.
 * Hisse kartıyla aynı kural (`hisse/[symbol]/opengraph-image`).
 */
export default async function TechnicalOgImage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!isTechnicalSymbol(symbol)) return new Response(null, { status: 404 });
  const t = getDictionary(DEFAULT_LOCALE);
  const detail = await getTechnicalDetail(symbol);
  const row = detail?.row ?? null;

  return new ImageResponse(
    sectionOg({
      eyebrow: t.technical.title,
      title: symbol,
      dek: row ? clip(row.copy.tr.headline, 150) : t.technical.description,
      leadVerdict: row ? verdictOf(row.stance) : undefined,
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
