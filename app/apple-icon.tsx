import { ImageResponse } from "next/og";
import { BRAND_GRADIENT } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS ana ekran ikonu.
 *
 * İKİ KURAL burayı sekme ikonundan ayırıyor:
 *
 * 1. TAM TAŞMA, köşe yuvarlama YOK. iOS ikonu kendi maskesiyle kırpıyor;
 *    önceden yuvarlatılmış bir karo gönderirsen köşelerdeki saydam pikseller
 *    maskenin içinde kalıyor ve ikonun kenarında ince bir "ısırık" oluşuyor.
 *
 * 2. Zil bir kademe KÜÇÜK (%52). Maske kenardan yiyor; sekme ikonundaki
 *    %62'lik oran ana ekranda zilin eteklerini kırpıyordu.
 *
 * Zil BEYAZ — sitenin kendi logosuyla (BellMark) aynı. Bir ara koyu
 * mürekkepti ve ana ekranda başka bir uygulama gibi duruyordu.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: BRAND_GRADIENT,
        }}
      >
        <svg width="94" height="94" viewBox="0 0 256 256" fill="#ffffff">
          <circle cx="128" cy="26" r="14" />
          <path d="M128 30a82 82 0 00-82 82c0 40-6 58-17 69-6 6-2 17 7 17h184c9 0 13-11 7-17-11-11-17-29-17-69a82 82 0 00-82-82z" />
          <path d="M98 214a30 30 0 0060 0z" />
        </svg>
      </div>
    ),
    size,
  );
}
