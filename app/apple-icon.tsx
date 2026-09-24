import { ImageResponse } from "next/og";
import {
  BELL_BODY_PATH,
  BELL_CLAPPER,
  BELL_HANGER,
  BELL_LIP,
} from "@/components/brand/BellMark";
import { MARK } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Zil karoda bir kademe küçük: görüş kutusu sitedeki işaretin (BELL_VIEWBOX,
 * kenar 278,26) %110'u, merkez yine (128, 124). Zil sitede karonun %64'ü,
 * burada %58'i.
 */
const APPLE_VIEWBOX = "-25 -29 306 306";

/**
 * iOS ana ekran ikonu.
 *
 * İKİ KURAL burayı sekme ikonundan ayırıyor:
 *
 * 1. TAM TAŞMA, köşe yuvarlama YOK. iOS ikonu kendi maskesiyle kırpıyor;
 *    önceden yuvarlatılmış bir karo gönderirsen köşelerdeki saydam pikseller
 *    maskenin içinde kalıyor ve ikonun kenarında ince bir "ısırık" oluşuyor.
 *    İç kenar çizgisi de bu yüzden yok — maske onu yarım kırpardı.
 *
 * 2. Zil bir kademe KÜÇÜK. Maske kenardan yiyor; sekme ikonuyla aynı oran
 *    ana ekranda zilin eteklerini kırpıyordu.
 *
 * Mavi degrade karo, beyaz zil — sitenin kendi işaretiyle (BellMark) aynı.
 * Ana ekran temayı bilmiyor; sitenin iki teması da zaten aynı karoyu
 * kullanıyor.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundImage: MARK.tile,
        }}
      >
        <svg width="180" height="180" viewBox={APPLE_VIEWBOX} fill={MARK.ink}>
          <rect {...BELL_HANGER} />
          <path d={BELL_BODY_PATH} />
          <rect {...BELL_LIP} fill={MARK.lip} />
          <circle {...BELL_CLAPPER} />
        </svg>
      </div>
    ),
    size,
  );
}
