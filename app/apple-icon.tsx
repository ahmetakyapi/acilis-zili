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
 * 2. Zil bir kademe KÜÇÜK. Maske kenardan yiyor; sekme ikonuyla aynı oran
 *    ana ekranda zilin eteklerini kırpıyordu. Görüş kutusu zilin sınırlarına
 *    çekildiği için (bkz. BellMark § BELL_VIEWBOX) aynı görsel büyüklük
 *    artık daha küçük bir kutuyla elde ediliyor: zil karonun ~%58'i.
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
        <svg width="116" height="116" viewBox="35 31 186 186" fill="#ffffff">
          <circle cx="128" cy="50" r="11" />
          <path d="M128 68c-30 0-53 24-53 54v33h106v-33c0-30-23-54-53-54z" />
          <rect x="56" y="159" width="144" height="16" rx="8" />
          <circle cx="128" cy="196" r="12" />
        </svg>
      </div>
    ),
    size,
  );
}
