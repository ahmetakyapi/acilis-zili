import { ImageResponse } from "next/og";
import { changelogEntries, entryDateLabel } from "@/lib/changelog";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { OG_CONTENT_TYPE, OG_SIZE, clip, ogFonts, sectionOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Yenilikler · Açılış Zili";

/**
 * Paylaşım kartı — EN SON GİRİŞ (25 Ekim). Bölüm kartı şablonu
 * (`sectionOg`): başlık en son girişin adı, açıklama günü ve özeti, çipler
 * madde sayısı. İçerik depoda ve yalnız dağıtımla değişiyor; kart derlemede
 * çiziliyor ve bir sonraki dağıtıma kadar doğru kalıyor. Dil sabit TR —
 * gerekçe `lib/og.tsx` başı ("kart rotaları dili istekten okumuyor").
 * Telegram adresi kartta kullanılmıyor, `null` yeterli.
 */
export default async function ChangelogOgImage() {
  const [latest] = changelogEntries(DEFAULT_LOCALE, null);
  const date = entryDateLabel(latest, DEFAULT_LOCALE);
  const fresh = latest.items.filter((item) => item.kind === "yeni").length;
  return new ImageResponse(
    sectionOg({
      eyebrow: "Yenilikler",
      title: clip(latest.title, 44),
      dek: clip(`${date}. ${latest.summary}`, 120),
      chips: [`${latest.items.length} Madde`, ...(fresh > 0 ? [`${fresh} Yeni Özellik`] : [])],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
