import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Ekonomik Takvim · Açılış Zili";

export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "Makro Veri",
      title: "Ekonomik Takvim",
      dek: "ABD makro veri açıklamaları ve Fed toplantıları — Türkiye saatiyle.",
      chips: ["TÜFE", "İstihdam", "FOMC"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
