import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";
import { TECHNICAL_SYMBOLS } from "@/lib/technical";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Teknik Analiz · Açılış Zili";

/* Teknik sayfalar bir süre ana sayfanın kartıyla paylaşılıyordu: dizinin
   kendi görseli yoktu, detay da ondan miras alıyordu. */
export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "Günlük Teknik Görünüm",
      title: "Teknik Analiz",
      /* SAYI LİSTEDEN OKUNUYOR, ELLE YAZILMIYOR. Kart "On iki hisse" diyordu
         ve liste on beşe çıkmıştı: paylaşılan görsel, sitenin kendi
         ekranıyla çelişen bir sayı taşıyordu. Kaynak tek — TECHNICAL_SYMBOLS
         (lib/technical.ts); listeye sembol eklendiğinde kart kendiliğinden
         düzeliyor. */
      dek: `${TECHNICAL_SYMBOLS.length} hissenin ortalamaları, destek ve dirençleri, alım bölgesi ve stop seviyesi.`,
      chips: ["AL · TUT · SAT", "Alım Bölgesi", "Stop"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
