import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili — Piyasalar";

export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "ABD Piyasası",
      title: "Piyasalar",
      dek: "Endeksler, tahvil faizleri ve gün içi hareket — piyasanın nabzı.",
      chips: ["Endeksler", "Tahvil Faizleri", "Korku Endeksi"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
