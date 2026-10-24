import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";
import { PUZZLE_ZONE, puzzleDayKey, puzzleNumber } from "@/lib/stock-puzzle";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Hisseyi Bil · Açılış Zili";
/* GÜNE GÖRE DEĞİŞİYOR, SAATTE BİR YENİDEN ÇİZİLİYOR. Kart bulmacanın
   numarasını ve tarihini taşıyor; rota istek zamanı API'si kullanmadığı
   için `revalidate` olmasa derleme gününde donardı (gerekçe
   `app/opengraph-image.tsx`). Gece yarısından sonra en çok bir saat dünün
   numarası görünebilir. CEVAP KARTA GİRMEZ: paylaşılan görsel bulmacayı
   bozmasın. */
export const revalidate = 3600;

export default async function PuzzleOgImage() {
  const day = puzzleDayKey();
  const date = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: PUZZLE_ZONE,
  }).format(new Date(`${day}T12:00:00Z`));
  return new ImageResponse(
    sectionOg({
      eyebrow: "Günlük Bulmaca",
      title: `Hisseyi Bil #${puzzleNumber(day)}`,
      dek: `${date}. Grafiğin siluetinden, sektöründen ve piyasa değerinden günün hissesini altı tahminde bul.`,
      chips: ["6 Tahmin", "Her Gün Yeni Hisse"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
