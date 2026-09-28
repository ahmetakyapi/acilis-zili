import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";
import { INVESTORS } from "@/lib/investors";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Ünlü Yatırımcılar · Açılış Zili";

/* Sayı listeden okunuyor (lib/investors.ts); yatırımcı eklenince kart
   kendiliğinden düzeliyor — teknik kartının gerekçesi. Detay sayfası bu
   kartı miras alıyor. */
export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "Ünlü Yatırımcılar",
      title: "Kim Ne Tutuyor",
      dek: `Buffett'tan Pelosi'ye ${INVESTORS.length} ünlü yatırımcının portföyü, bu çeyrek aldıkları ve sattıkları.`,
      chips: ["SEC 13F", "Kongre Bildirimi", "Yeni · Artırdı · Sattı"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
