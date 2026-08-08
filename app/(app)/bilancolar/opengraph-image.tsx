import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili — Bilançolar";

export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "Takvim ve Analiz",
      title: "Bilançolar",
      dek: "Şirketlerin finansal sonuç tarihleri ve okunmuş çeyrek analizleri.",
      chips: ["Takvim", "Analizler", "Takip Ettiklerim"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
