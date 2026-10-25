import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";
import { INVESTORS } from "@/lib/investors";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Ünlü Yatırımcılar Ne Tutuyor · Açılış Zili";

/* Sayı listeden okunuyor (lib/investors.ts); yatırımcı eklenince kart
   kendiliğinden düzeliyor — teknik kartının gerekçesi. Detay sayfası bu
   kartı miras alıyor. */
export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "SEC 13F · Kongre Bildirimleri",
      title: "Ünlü Yatırımcılar Ne Tutuyor",
      dek: `Buffett'tan Pelosi'ye ${INVESTORS.length} ünlü yatırımcının portföyü, bu çeyrek aldıkları ve sattıkları.`,
      chips: ["Yatırımcı Kartları", "Alanlar ve Satanlar", "Çeyreklik Bildirim"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
