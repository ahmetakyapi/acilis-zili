import { angleOf } from "./model";

/**
 * Seans Kadranı — DÜZ görünüm geometrisi (14 Ekim, dördüncü sürüm).
 *
 * Üçüncü sürüm izometrik bir masa makinesiydi (kadran + çan + bobin) ve
 * sahibinin itirazıyla kalktı: "ne anlatıyor burası, anlamsız" — soluk
 * gri makine telefonda hiçbir şey söylemiyor, geniş sahne dar ekranda
 * eziliyordu. Dördüncü sürüm cepheden bakılan tek bir 24 saat kadranı:
 * seans bantları halkanın KENDİSİNDE (mavi asıl seans, pirinç ön/akşam —
 * zil şeridiyle aynı dil), ziller halkanın üstünde iki im, ortada iki
 * saatli dev okuma. Kare sahne telefonda kolonu dolduruyor, makine
 * perspektifinin boşa harcadığı yer yok. Makinenin ANLATTIĞI şey (ibre
 * kontağı geçince çan vurulur) kaybolmadı: ibre zil iminin üstünden
 * geçince im çınlıyor — mekanizma değil, olayın kendisi gösteriliyor.
 *
 * Açı kuralı modelden: 00:00 NY tepede, saat yönünde (angleOf).
 */

export const SIZE = 360;
export const CX = SIZE / 2;
export const CY = SIZE / 2;

/** Seans bantlarının (ve zil imlerinin) halkası. */
export const BAND_R = 132;
export const BAND_W = 16;
/** Saat çentikleri bandın dışında, rakamlar onların dışında. */
export const TICK_R0 = 145;
export const TICK_R1 = 151;
export const TICK_MAJOR_R1 = 155;
export const NUM_R = 167;
/** İbre göbekten değil, okumanın DIŞINDAN başlar: merkezde iki saatli
    okuma var ve ibrenin üstünden geçmesi onu okunmaz kılardı (gösterge
    kadranlarının yüzen iğne dili). */
export const NEEDLE_R = 127;
export const NEEDLE_IN = 54;
export const ELAPSED_R = 108;
/** Kadrana dokunma/gezinme bu yarıçapa kadar sayılır (live.tsx). */
export const HIT_R = 176;

export const point = (angle: number, radius: number): [number, number] => [
  CX + radius * Math.sin(angle),
  CY - radius * Math.cos(angle),
];

const fine = (value: number) => Math.round(value * 100) / 100;

/** Dakika aralığının yayı (saat yönünde). Tam tur ayrı çizilir (daire). */
export function arcPath(fromMinutes: number, toMinutes: number, radius: number) {
  const a0 = angleOf(fromMinutes);
  const a1 = angleOf(toMinutes === fromMinutes ? fromMinutes : toMinutes);
  const [x0, y0] = point(a0, radius).map(fine);
  const [x1, y1] = point(a1, radius).map(fine);
  const sweep = (((toMinutes - fromMinutes) % 1440) + 1440) % 1440;
  const large = sweep > 720 ? 1 : 0;
  return `M${x0} ${y0}A${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
}

/** İbre: tepeye bakan sivri levha, tabanı yuvarlak — `rotate` ile döner. */
export function needleShape() {
  const tip = CY - NEEDLE_R;
  const base = CY - NEEDLE_IN;
  return `M${CX} ${tip}L${CX + 4} ${base - 5}A5.2 5.2 0 1 1 ${CX - 4} ${base - 5}Z`;
}
